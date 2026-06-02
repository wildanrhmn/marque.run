import { Hono } from "hono"
import { z } from "zod"
import type { Address, Hex } from "viem"
import { composeAd } from "../compose"
import { logger } from "../log"
import { state } from "../state"
import { storeAsset, storeJson } from "../asset-store"
import { loadEnv } from "../env"

const SceneSchema = z.object({
  imageBase64: z.string().min(1),
  voiceLineMs: z.number().int().positive().max(20000),
  description: z.string().optional(),
})

const ComposeBodySchema = z.object({
  briefId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  operator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  prompt: z.string(),
  scenes: z.array(SceneSchema).min(1).max(8),
  musicBase64: z.string().optional(),
  voiceBase64: z.string().optional(),
  videoBase64: z.string().optional(),
  totalSpendUsdc: z.string().optional(),
  settlementHashes: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().max(60).optional(),
})

export const composeRoute = new Hono()

composeRoute.post("/", async (c) => {
  const env = loadEnv()
  const json = await c.req.json().catch(() => null)
  const parsed = ComposeBodySchema.safeParse(json)
  if (!parsed.success) {
    return c.json({ error: "invalid compose body", issues: parsed.error.flatten() }, 400)
  }

  const body = parsed.data
  const briefId = body.briefId as Hex
  const operator = body.operator as Address

  state.emit({
    briefId,
    ts: Date.now(),
    kind: "composer.scene.rendered",
    details: { scenes: body.scenes.length },
  })

  try {
    const composeArgs: Parameters<typeof composeAd>[0] = {
      scenes: body.scenes.map((s) => ({ imageBase64: s.imageBase64, voiceLineMs: s.voiceLineMs })),
    }
    if (body.musicBase64) composeArgs.musicBase64 = body.musicBase64
    if (body.voiceBase64) composeArgs.voiceBase64 = body.voiceBase64
    if (body.videoBase64) composeArgs.videoBase64 = body.videoBase64
    if (body.width) composeArgs.width = body.width
    if (body.height) composeArgs.height = body.height
    if (body.fps) composeArgs.fps = body.fps

    const result = await composeAd(composeArgs)
    const stored = await storeAsset({ data: result.mp4, contentType: "video/mp4" })

    const publicBase = env.ONESHOT_WEBHOOK_PUBLIC_BASE_URL.replace(/\/+$/, "")
    const assetUrl = `${publicBase}/asset/${stored.filename}`

    const metadata = {
      name: `MARQUE ad ${briefId.slice(0, 10)}`,
      description: body.prompt,
      image: assetUrl,
      animation_url: assetUrl,
      external_url: `https://marque.run/runs/${briefId}`,
      attributes: [
        { trait_type: "operator", value: operator },
        { trait_type: "duration_ms", value: result.durationMs },
        { trait_type: "scenes", value: body.scenes.length },
        { trait_type: "total_spend_usdc", value: body.totalSpendUsdc ?? "" },
        { trait_type: "settlement_count", value: body.settlementHashes?.length ?? 0 },
      ],
      delegate_run: {
        briefId,
        prompt: body.prompt,
        settlementHashes: body.settlementHashes ?? [],
      },
    }
    const metaStored = await storeJson(`metadata-${briefId.slice(2, 14)}`, metadata)
    const metadataFilename = metaStored.path.split("/").pop() ?? metaStored.path.split("\\").pop() ?? ""
    const metadataUrl = `${publicBase}/asset/${metadataFilename}`

    state.emit({
      briefId,
      ts: Date.now(),
      kind: "composer.final.encoded",
      details: {
        cid: stored.cid,
        bytes: result.mp4.byteLength,
        durationMs: result.durationMs,
        assetUrl,
        metadataUrl,
      },
    })

    return c.json({
      cid: stored.cid,
      durationMs: result.durationMs,
      bytes: result.mp4.byteLength,
      assetUrl,
      metadataUrl,
      contentType: "video/mp4",
    })
  } catch (err) {
    logger.error({ err }, "compose failed")
    state.emit({
      briefId,
      ts: Date.now(),
      kind: "error",
      details: { stage: "compose", message: (err as Error).message },
    })
    return c.json({ error: (err as Error).message }, 500)
  }
})
