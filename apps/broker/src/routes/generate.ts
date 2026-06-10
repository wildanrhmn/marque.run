import { Hono } from "hono"
import { z } from "zod"
import { keccak256, toHex, type Hex } from "viem"
import { VeniceRestClient } from "../venice-rest"
import { composeFromClips } from "../compose"
import { storeAsset, storeJson } from "../asset-store"
import { state } from "../state"
import { loadEnv } from "../env"
import { logger } from "../log"

const BodySchema = z.object({
  briefId: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  prompt: z.string().min(3),
  durationSec: z.number().int().min(5).max(60).default(30),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  tone: z.string().optional(),
  maxScenes: z.number().int().min(1).max(5).default(3),
})

const MODELS = {
  concept: "qwen3-235b-a22b-instruct-2507",
  image: "seedream-v4",
  voice: "tts-kokoro",
  music: "stable-audio-25",
  videoText: "seedance-2-0-fast-text-to-video",
  videoImage: "seedance-2-0-fast-image-to-video",
}

function dims(aspect: string): { w: number; h: number } {
  if (aspect === "9:16") return { w: 576, h: 1024 }
  if (aspect === "1:1") return { w: 768, h: 768 }
  return { w: 1024, h: 576 }
}

interface ConceptOutput {
  hook: string
  scenes: { description: string; voiceLine: string }[]
  musicPrompt: string
  brand: { name: string; palette: string[] }
}

const CONCEPT_SYSTEM = `You are a creative director. Given an ad brief, return ONLY a JSON object with:
hook (one sentence), scenes (array of objects with description and voiceLine), musicPrompt (one phrase), brand { name, palette: array of 3 hex colors }.
Keep scene descriptions vivid and cinematic. Output JSON only, no prose.`

export const generateRoute = new Hono()

generateRoute.post("/", async (c) => {
  const env = loadEnv()
  if (env.VENICE_MODE !== "apikey" || !env.VENICE_API_KEY) {
    return c.json({ error: "broker not in apikey mode or VENICE_API_KEY missing" }, 400)
  }
  const json = await c.req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.flatten() }, 400)
  const body = parsed.data
  const briefId = (body.briefId ?? keccak256(toHex(`${body.prompt}|${Date.now()}`))) as Hex

  const venice = new VeniceRestClient({ apiBase: env.VENICE_API_BASE, apiKey: env.VENICE_API_KEY })
  const { w, h } = dims(body.aspectRatio)
  const videoDuration: "5s" | "10s" = "5s"

  const emit = (kind: Parameters<typeof state.emit>[0]["kind"], details: Record<string, unknown>, specialistKind?: string) =>
    state.emit({ briefId, ts: Date.now(), kind, specialistKind: specialistKind as never, details })

  ;(async () => {
    const balanceStart = await venice.balanceUsd()
    try {
      emit("operator.brief.submitted", { prompt: body.prompt.slice(0, 40) })

      const conceptRaw = await venice.chat({
        model: MODELS.concept,
        system: CONCEPT_SYSTEM,
        user: body.prompt + (body.tone ? ` Tone: ${body.tone}.` : ""),
        jsonObject: true,
        maxTokens: 1400,
      })
      const concept = JSON.parse(stripFences(conceptRaw)) as ConceptOutput
      emit("director.plan.ready", { scenes: concept.scenes.length, hook: concept.hook?.slice(0, 60) })

      const scenes = concept.scenes.slice(0, body.maxScenes)
      const stylePalette = (concept.brand?.palette ?? []).join(", ")
      const clips: Buffer[] = []

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]!
        emit("specialist.venice.request", { step: "image", scene: i + 1 }, "image")
        const img = await venice.image({
          model: MODELS.image,
          prompt: `${scene.description}. ${stylePalette} palette, cinematic, high quality`,
          width: w,
          height: h,
        })
        const imgStored = await storeAsset({
          data: Buffer.from(img.base64, "base64"),
          contentType: img.mime,
        })
        emit("specialist.venice.response", { step: "image", scene: i + 1, cid: imgStored.cid }, "image")

        emit("specialist.venice.request", { step: "video", scene: i + 1 }, "video")
        let clip: Buffer
        try {
          clip = await venice.video({
            model: MODELS.videoImage,
            prompt: scene.description,
            duration: videoDuration,
            resolution: body.resolution,
            aspectRatio: body.aspectRatio,
            imageUrl: `data:${img.mime};base64,${img.base64}`,
          })
        } catch (err) {
          logger.warn({ err: (err as Error).message }, "image-to-video failed, falling back to text-to-video")
          clip = await venice.video({
            model: MODELS.videoText,
            prompt: scene.description,
            duration: videoDuration,
            resolution: body.resolution,
            aspectRatio: body.aspectRatio,
          })
        }
        clips.push(clip)
        emit("broker.relay.confirmed", { step: "video", scene: i + 1, bytes: clip.byteLength }, "video")
      }

      emit("specialist.venice.request", { step: "voice" }, "voice")
      const voice = await venice.tts({
        model: MODELS.voice,
        input: scenes.map((s) => s.voiceLine).join(" "),
        voice: env.VENICE_VOICE,
      })
      emit("specialist.venice.response", { step: "voice", bytes: voice.byteLength }, "voice")

      emit("specialist.venice.request", { step: "music" }, "music")
      const music = await venice.music({ model: MODELS.music, prompt: concept.musicPrompt ?? body.prompt })
      emit("specialist.venice.response", { step: "music", bytes: music.byteLength }, "music")

      emit("composer.scene.rendered", { scenes: clips.length })
      const composed = await composeFromClips({ clips, voice, music, width: w, height: h })
      const stored = await storeAsset({ data: composed.mp4, contentType: "video/mp4" })
      const publicBase = env.ONESHOT_WEBHOOK_PUBLIC_BASE_URL.replace(/\/+$/, "")
      const assetUrl = `${publicBase}/asset/${stored.filename}`

      const metadata = {
        name: concept.brand?.name ? `${concept.brand.name} — ad` : "Marque ad",
        description: body.prompt,
        animation_url: assetUrl,
        image: assetUrl,
        attributes: [
          { trait_type: "scenes", value: clips.length },
          { trait_type: "resolution", value: body.resolution },
          { trait_type: "aspect", value: body.aspectRatio },
        ],
      }
      const balanceEnd = await venice.balanceUsd()
      const spentUsd =
        balanceStart != null && balanceEnd != null
          ? Number(Math.max(0, balanceStart - balanceEnd).toFixed(2))
          : null

      const metaStored = await storeJson(`meta-${briefId.slice(2, 14)}`, {
        ...metadata,
        attributes: [
          ...metadata.attributes,
          ...(spentUsd != null ? [{ trait_type: "spend_usd", value: spentUsd }] : []),
        ],
      })
      const metaFile = metaStored.path.split(/[\\/]/).pop()

      emit("composer.final.encoded", {
        cid: stored.cid,
        bytes: composed.mp4.byteLength,
        assetUrl,
        metadataUrl: `${publicBase}/asset/${metaFile}`,
        ...(spentUsd != null ? { spentUsd } : {}),
      })
    } catch (err) {
      logger.error({ err }, "generate pipeline failed")
      emit("error", { message: (err as Error).message })
    }
  })()

  return c.json({ briefId, status: "started", stream: `/stream/brief/${briefId}` })
})

function stripFences(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(json)?/i, "").replace(/```$/, "").trim()
  }
  return t
}
