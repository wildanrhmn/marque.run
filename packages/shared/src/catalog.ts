export type QualityTier = "draft" | "standard" | "cinematic"
export type TemplateKey = "ad" | "product" | "music" | "voiceover" | "explainer" | "images"
export type Resolution = "480p" | "720p" | "1080p"
export type Aspect = "16:9" | "9:16" | "1:1"

export interface VideoTierSpec {
  label: string
  blurb: string
  textModel: string
  imageModel: string
  durationEnum: "5s" | "8s"
  imageDurationEnum: "5s" | "8s"
  clipSeconds: number
  resolutions: Resolution[]
  priceByRes: Record<Resolution, number>
}

export const VIDEO_TIERS: Record<QualityTier, VideoTierSpec> = {
  draft: {
    label: "Draft",
    blurb: "Fast and cheap. Seedance 1.5 Pro.",
    textModel: "seedance-1-5-pro-text-to-video",
    imageModel: "seedance-1-5-pro-image-to-video",
    durationEnum: "5s",
    imageDurationEnum: "5s",
    clipSeconds: 5,
    resolutions: ["480p", "720p", "1080p"],
    priceByRes: { "480p": 0.13, "720p": 0.29, "1080p": 0.66 },
  },
  standard: {
    label: "Standard",
    blurb: "Balanced. Kling 2.5 Turbo Pro.",
    textModel: "kling-2.5-turbo-pro-text-to-video",
    imageModel: "kling-2.5-turbo-pro-image-to-video",
    durationEnum: "5s",
    imageDurationEnum: "5s",
    clipSeconds: 5,
    resolutions: ["480p", "720p", "1080p"],
    priceByRes: { "480p": 0.39, "720p": 0.39, "1080p": 0.39 },
  },
  cinematic: {
    label: "Cinematic",
    blurb: "Top quality. Google Veo 3.",
    textModel: "veo3-fast-text-to-video",
    imageModel: "veo3-fast-image-to-video",
    durationEnum: "8s",
    imageDurationEnum: "8s",
    clipSeconds: 8,
    resolutions: ["720p", "1080p"],
    priceByRes: { "480p": 0.88, "720p": 0.88, "1080p": 0.88 },
  },
}

export const FIXED_MODELS = {
  concept: "qwen3-235b-a22b-instruct-2507",
  image: "seedream-v4",
  voice: "tts-kokoro",
  music: "stable-audio-25",
} as const

export interface VoiceOption {
  id: string
  label: string
}

export const VOICES: VoiceOption[] = [
  { id: "af_sky", label: "Sky · F" },
  { id: "af_bella", label: "Bella · F" },
  { id: "af_nova", label: "Nova · F" },
  { id: "af_river", label: "River · F" },
  { id: "af_sarah", label: "Sarah · F" },
  { id: "am_adam", label: "Adam · M" },
  { id: "am_michael", label: "Michael · M" },
  { id: "am_onyx", label: "Onyx · M" },
  { id: "am_echo", label: "Echo · M" },
  { id: "bf_emma", label: "Emma · UK F" },
  { id: "bm_george", label: "George · UK M" },
]

export const DEFAULT_VOICE = "af_sky"

export interface TemplateSteps {
  script: boolean
  image: boolean
  voice: boolean
  music: boolean
  video: boolean
}

export interface TemplateSpec {
  label: string
  tagline: string
  placeholder: string
  steps: TemplateSteps
  stillCount?: number
}

export const TEMPLATES: Record<TemplateKey, TemplateSpec> = {
  ad: {
    label: "Ad",
    tagline: "A short, scored, narrated video ad",
    placeholder: "A moody, cinematic ad for a cold brew brand called Lichen",
    steps: { script: true, image: true, voice: true, music: true, video: true },
  },
  product: {
    label: "Product video",
    tagline: "Cinematic shots of your product, scored",
    placeholder: "A sleek showcase of a matte-black water bottle on marble, soft light",
    steps: { script: true, image: true, voice: false, music: true, video: true },
  },
  explainer: {
    label: "Explainer",
    tagline: "Narrated walkthrough with simple visuals",
    placeholder: "Explain how photosynthesis works, for high-school students",
    steps: { script: true, image: true, voice: true, music: false, video: true },
  },
  music: {
    label: "Music",
    tagline: "An original instrumental track from your description",
    placeholder: "Warm lo-fi instrumental, slow tempo, vinyl crackle, mellow keys",
    steps: { script: false, image: false, voice: false, music: true, video: false },
  },
  voiceover: {
    label: "Voiceover",
    tagline: "Narration in a natural voice",
    placeholder: "A confident 20-second intro for a tech podcast",
    steps: { script: true, image: false, voice: true, music: false, video: false },
  },
  images: {
    label: "Image set",
    tagline: "A set of on-brand still images",
    placeholder: "Three earthy product shots of artisan coffee bags, warm tones",
    steps: { script: true, image: true, voice: false, music: false, video: false },
    stillCount: 4,
  },
}

const PRICE = {
  script: 0.02,
  image: 0.12,
  voice: 0.05,
  music: 0.12,
}

const MAX_SCENES = 6

export function sceneCountFor(durationSec: number, tier: QualityTier): number {
  const clip = VIDEO_TIERS[tier].clipSeconds
  return Math.min(MAX_SCENES, Math.max(2, Math.round(durationSec / clip)))
}

export function resolutionFor(tier: QualityTier, wanted: Resolution): Resolution {
  const spec = VIDEO_TIERS[tier]
  return spec.resolutions.includes(wanted) ? wanted : (spec.resolutions[1] ?? spec.resolutions[0]!)
}

export interface AdEstimate {
  total: number
  scenes: number
  imageCount: number
  realDurationSec: number
  lines: { label: string; amount: number }[]
}

export function estimateJob(args: {
  template: TemplateKey
  tier: QualityTier
  resolution: Resolution
  durationSec: number
}): AdEstimate {
  const tpl = TEMPLATES[args.template]
  const tier = VIDEO_TIERS[args.tier]
  const resolution = resolutionFor(args.tier, args.resolution)
  const scenes = tpl.steps.video ? sceneCountFor(args.durationSec, args.tier) : 0
  const imageCount = tpl.steps.video ? scenes : tpl.steps.image ? (tpl.stillCount ?? 0) : 0

  const lines: { label: string; amount: number }[] = []
  if (tpl.steps.script) lines.push({ label: "Script", amount: PRICE.script })
  if (tpl.steps.image && imageCount > 0)
    lines.push({ label: `Images (${imageCount})`, amount: Number((imageCount * PRICE.image).toFixed(2)) })
  if (tpl.steps.voice) lines.push({ label: "Voiceover", amount: PRICE.voice })
  if (tpl.steps.music) lines.push({ label: "Soundtrack", amount: PRICE.music })
  if (tpl.steps.video && scenes > 0)
    lines.push({
      label: `Video (${scenes} × ${tier.clipSeconds}s)`,
      amount: Number((scenes * tier.priceByRes[resolution]).toFixed(2)),
    })

  const total = Number(lines.reduce((a, b) => a + b.amount, 0).toFixed(2))
  return {
    total,
    scenes,
    imageCount,
    realDurationSec: tpl.steps.video ? scenes * tier.clipSeconds : 0,
    lines,
  }
}

export function videoModelFor(tier: QualityTier, hasReferenceImage: boolean): { model: string; duration: "5s" | "8s" } {
  const spec = VIDEO_TIERS[tier]
  return {
    model: hasReferenceImage ? spec.imageModel : spec.textModel,
    duration: hasReferenceImage ? spec.imageDurationEnum : spec.durationEnum,
  }
}
