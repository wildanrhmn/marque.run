import { Hono } from "hono"
import { z } from "zod"
import { keccak256, toHex, type Hex } from "viem"
import {
  FIXED_MODELS,
  TEMPLATES,
  VIDEO_TIERS,
  resolutionFor,
  sceneCountFor,
  videoModelFor,
  type QualityTier,
  type TemplateKey,
} from "@marque/shared"
import { VeniceRestClient } from "../venice-rest"
import { composeFromClips } from "../compose"
import { storeAsset, storeJson } from "../asset-store"
import { pinataEnabled, pinBuffer, pinJson } from "../pinata"
import { state } from "../state"
import { loadEnv } from "../env"
import { logger } from "../log"
import { settleExact } from "../settle"
import type { OneShotAuthorizationListEntry } from "../oneshot"

const AuthEntrySchema = z.object({
  address: z.string(),
  chainId: z.number(),
  nonce: z.number(),
  r: z.string(),
  s: z.string(),
  yParity: z.number(),
})

const BodySchema = z.object({
  briefId: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  prompt: z.string().min(3),
  template: z.enum(["ad", "product", "explainer", "music", "voiceover", "images"]).default("ad"),
  quality: z.enum(["draft", "standard", "cinematic"]).default("draft"),
  durationSec: z.number().int().min(5).max(60).default(30),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  tone: z.string().optional(),
  voice: z.string().optional(),
  exactText: z.boolean().default(false),
  imageCount: z.number().int().min(1).max(4).optional(),
  chargeAtoms: z.string().regex(/^\d+$/).optional(),
  payment: z
    .object({
      delegations: z.array(z.record(z.string(), z.unknown())).min(1),
      authorizationList: z.array(AuthEntrySchema).optional(),
    })
    .optional(),
})

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

const CONCEPT_SYSTEM = `You are a creative director. Given a creative brief, return ONLY a JSON object with:
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
  const tpl = TEMPLATES[body.template as TemplateKey]
  const tier = body.quality as QualityTier
  const tierSpec = VIDEO_TIERS[tier]
  const resolution = resolutionFor(tier, body.resolution)
  const exactVoiceover = body.template === "voiceover" && body.exactText
  const { w, h } = dims(body.aspectRatio)

  const emit = (kind: Parameters<typeof state.emit>[0]["kind"], details: Record<string, unknown>, specialistKind?: string) =>
    state.emit({ briefId, ts: Date.now(), kind, specialistKind: specialistKind as never, details })

  ;(async () => {
    const balanceStart = await venice.balanceUsd()
    try {
      emit("operator.brief.submitted", { template: body.template, quality: body.quality })

      const singleImage = body.template === "images" && (body.imageCount ?? tpl.stillCount ?? 1) <= 1
      let concept: ConceptOutput | null = null
      if (tpl.steps.script && !exactVoiceover && !singleImage) {
        const conceptRaw = await venice.chat({
          model: FIXED_MODELS.concept,
          system: CONCEPT_SYSTEM,
          user: body.prompt + (body.tone ? ` Tone: ${body.tone}.` : ""),
          jsonObject: true,
          maxTokens: 1400,
        })
        concept = JSON.parse(stripFences(conceptRaw)) as ConceptOutput
        emit("director.plan.ready", { scenes: concept.scenes?.length ?? 0, hook: concept.hook?.slice(0, 60) })
      }

      const sceneSource = concept?.scenes ?? []
      const wantScenes = tpl.steps.video
        ? sceneCountFor(body.durationSec, tier)
        : (body.imageCount ?? tpl.stillCount ?? sceneSource.length)
      const scenes = sceneSource.slice(0, Math.max(1, wantScenes))
      while ((tpl.steps.video || tpl.steps.image) && scenes.length < wantScenes) {
        const src =
          sceneSource.length > 0
            ? sceneSource[scenes.length % sceneSource.length]!
            : { description: body.prompt, voiceLine: body.prompt }
        scenes.push(src)
      }
      const stylePalette = (concept?.brand?.palette ?? []).join(", ")

      const images: { base64: string; mime: string; cid: string; filename: string }[] = []
      if (tpl.steps.image) {
        const count = tpl.steps.video ? scenes.length : Math.min(scenes.length, body.imageCount ?? tpl.stillCount ?? 4)
        for (let i = 0; i < count; i++) {
          const scene = scenes[i]!
          emit("specialist.venice.request", { step: "image", scene: i + 1 }, "image")
          const img = await venice.image({
            model: FIXED_MODELS.image,
            prompt: `${scene.description}. ${stylePalette} palette, cinematic, high quality`,
            width: w,
            height: h,
          })
          const stored = await storeAsset({ data: Buffer.from(img.base64, "base64"), contentType: img.mime })
          images.push({ ...img, cid: stored.cid, filename: stored.filename })
          emit("specialist.venice.response", { step: "image", scene: i + 1, cid: stored.cid }, "image")
        }
      }

      const clips: Buffer[] = []
      if (tpl.steps.video) {
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i]!
          const ref = images[i]
          emit("specialist.venice.request", { step: "video", scene: i + 1, model: tierSpec.imageModel }, "video")
          let clip: Buffer
          try {
            const v = videoModelFor(tier, true)
            clip = await venice.video({
              model: v.model,
              prompt: scene.description,
              duration: v.duration,
              resolution,
              aspectRatio: body.aspectRatio,
              imageUrl: ref ? `data:${ref.mime};base64,${ref.base64}` : undefined,
            })
          } catch (err) {
            logger.warn({ err: (err as Error).message }, "image-to-video failed, falling back to text-to-video")
            const v = videoModelFor(tier, false)
            clip = await venice.video({
              model: v.model,
              prompt: scene.description,
              duration: v.duration,
              resolution,
              aspectRatio: body.aspectRatio,
            })
          }
          clips.push(clip)
          emit("broker.relay.confirmed", { step: "video", scene: i + 1, bytes: clip.byteLength }, "video")
        }
      }

      let voice: Buffer | undefined
      if (tpl.steps.voice) {
        emit("specialist.venice.request", { step: "voice" }, "voice")
        const lines = exactVoiceover
          ? body.prompt
          : scenes.map((s) => s.voiceLine).filter(Boolean).join(" ") || body.prompt
        voice = await venice.tts({
          model: FIXED_MODELS.voice,
          input: lines,
          voice: body.voice ?? env.VENICE_VOICE,
        })
        emit("specialist.venice.response", { step: "voice", bytes: voice.byteLength }, "voice")
      }

      let music: Buffer | undefined
      if (tpl.steps.music) {
        emit("specialist.venice.request", { step: "music" }, "music")
        music = await venice.music({ model: FIXED_MODELS.music, prompt: concept?.musicPrompt ?? body.prompt })
        emit("specialist.venice.response", { step: "music", bytes: music.byteLength }, "music")
      }

      let assetData: Buffer
      let contentType: string
      if (tpl.steps.video) {
        emit("composer.scene.rendered", { scenes: clips.length })
        const composed = await composeFromClips({ clips, voice, music, width: w, height: h })
        assetData = composed.mp4
        contentType = "video/mp4"
      } else if (music && !voice) {
        assetData = music
        contentType = "audio/wav"
      } else if (voice && !music) {
        assetData = voice
        contentType = "audio/mpeg"
      } else if (images.length > 0) {
        assetData = Buffer.from(images[0]!.base64, "base64")
        contentType = images[0]!.mime
      } else {
        throw new Error("template produced no output")
      }

      const stored = await storeAsset({ data: assetData, contentType })
      const publicBase = env.ONESHOT_WEBHOOK_PUBLIC_BASE_URL.replace(/\/+$/, "")

      let settlementTxHash: Hex | undefined
      let chargedAtoms: string | undefined
      let feeUsd: number | undefined
      if (body.payment && body.chargeAtoms && BigInt(body.chargeAtoms) > 0n) {
        emit("broker.relay.submitted", { step: "settle", atoms: body.chargeAtoms })
        const settled = await settleExact({
          delegations: body.payment.delegations,
          authorizationList: body.payment.authorizationList as OneShotAuthorizationListEntry[] | undefined,
          workAtoms: BigInt(body.chargeAtoms),
        })
        settlementTxHash = settled.hash
        chargedAtoms = settled.workAtoms.toString()
        feeUsd = Number(settled.feeAtoms) / 1_000_000
        emit("broker.relay.confirmed", { step: "settle", hash: settled.hash, chargedAtoms, feeUsd })
      }

      const balanceEnd = await venice.balanceUsd()
      const balanceSpentUsd =
        balanceStart != null && balanceEnd != null ? Number(Math.max(0, balanceStart - balanceEnd).toFixed(4)) : null
      const spentUsd = chargedAtoms != null ? Number(chargedAtoms) / 1_000_000 : balanceSpentUsd
      if (balanceSpentUsd != null && chargedAtoms != null) {
        logger.info({ charged: spentUsd, veniceCost: balanceSpentUsd }, "settled: charged vs venice cost")
      }

      let assetUrl = `${publicBase}/asset/${stored.filename}`
      let assetRef = assetUrl
      let imageRefs = images.map((im) => `${publicBase}/asset/${im.filename}`)
      let imageUrls = imageRefs
      let assetCid: string | undefined
      if (pinataEnabled()) {
        try {
          const assetPin = await pinBuffer(assetData, stored.filename, contentType)
          const imagePins = await Promise.all(
            images.map((im) => pinBuffer(Buffer.from(im.base64, "base64"), im.filename, im.mime)),
          )
          assetCid = assetPin.cid
          assetUrl = assetPin.gatewayUrl
          assetRef = assetPin.ipfsUri
          imageRefs = imagePins.map((p) => p.ipfsUri)
          imageUrls = imagePins.map((p) => p.gatewayUrl)
          emit("broker.ipfs.pinned", { assetCid: assetPin.cid, images: imagePins.length })
        } catch (err) {
          logger.warn({ err: (err as Error).message }, "pinata pin failed, using vps urls")
        }
      }

      const metadata = {
        name: concept?.brand?.name ? `${concept.brand.name} — ${tpl.label}` : `Marque ${tpl.label}`,
        description: body.prompt,
        animation_url: assetRef,
        image: tpl.steps.image && imageRefs[0] ? imageRefs[0] : assetRef,
        attributes: [
          { trait_type: "template", value: body.template },
          { trait_type: "quality", value: body.quality },
          { trait_type: "resolution", value: resolution },
          { trait_type: "aspect", value: body.aspectRatio },
          ...(spentUsd != null ? [{ trait_type: "spend_usd", value: spentUsd }] : []),
        ],
        images: imageRefs,
      }

      let metadataUrl: string
      let tokenUri: string | undefined
      let metadataCid: string | undefined
      if (pinataEnabled() && assetCid) {
        try {
          const metaPin = await pinJson(metadata, `meta-${briefId.slice(2, 14)}`)
          metadataCid = metaPin.cid
          metadataUrl = metaPin.gatewayUrl
          tokenUri = metaPin.ipfsUri
        } catch (err) {
          logger.warn({ err: (err as Error).message }, "pinata metadata pin failed, using vps json")
          const metaStored = await storeJson(`meta-${briefId.slice(2, 14)}`, metadata)
          metadataUrl = `${publicBase}/asset/${metaStored.path.split(/[\\/]/).pop()}`
        }
      } else {
        const metaStored = await storeJson(`meta-${briefId.slice(2, 14)}`, metadata)
        metadataUrl = `${publicBase}/asset/${metaStored.path.split(/[\\/]/).pop()}`
      }

      emit("composer.final.encoded", {
        cid: stored.cid,
        bytes: assetData.byteLength,
        assetUrl,
        contentType,
        metadataUrl,
        imageUrls,
        ...(assetCid ? { assetCid } : {}),
        ...(metadataCid ? { metadataCid } : {}),
        ...(tokenUri ? { tokenUri } : {}),
        ...(spentUsd != null ? { spentUsd } : {}),
        ...(feeUsd != null ? { feeUsd } : {}),
        ...(settlementTxHash ? { settlementTxHash } : {}),
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
