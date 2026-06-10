export const RESOLUTIONS = ["480p", "720p", "1080p"] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const FORMATS = [
  { key: "16:9", label: "Landscape", ratio: "aspect-video", aspect: "16:9" },
  { key: "9:16", label: "Portrait", ratio: "aspect-[9/16]", aspect: "9:16" },
  { key: "1:1", label: "Square", ratio: "aspect-square", aspect: "1:1" },
] as const
export type Format = (typeof FORMATS)[number]

export const TONES = ["Cinematic", "Moody", "Upbeat", "Minimal"] as const

export const MODELS = {
  concept: "qwen3-235b-a22b-instruct-2507",
  image: "seedream-v4",
  voice: "tts-kokoro",
  music: "stable-audio-25",
  videoText: "seedance-2-0-fast-text-to-video",
  videoImage: "seedance-2-0-fast-image-to-video",
} as const

export const VIDEO_MODELS = [MODELS.videoText, MODELS.videoImage] as const

export const CLIP_SECONDS = 5
export const MAX_SCENES = 6

export function sceneCount(durationSec: number): number {
  return Math.min(MAX_SCENES, Math.max(2, Math.round(durationSec / CLIP_SECONDS)))
}

const VIDEO_PRICE_5S: Record<Resolution, number> = {
  "480p": 0.35,
  "720p": 0.6,
  "1080p": 1.1,
}
const IMAGE_PRICE = 0.12
const SCRIPT_PRICE = 0.02
const VOICE_PRICE = 0.05
const MUSIC_PRICE = 0.12

export interface AdEstimate {
  total: number
  scenes: number
  clipSeconds: number
  realDurationSec: number
  lines: { label: string; amount: number }[]
}

export function estimateAd(args: { durationSec: number; resolution: Resolution }): AdEstimate {
  const scenes = sceneCount(args.durationSec)
  const images = scenes * IMAGE_PRICE
  const video = scenes * VIDEO_PRICE_5S[args.resolution]
  const lines = [
    { label: "Script", amount: SCRIPT_PRICE },
    { label: `Scenes (${scenes})`, amount: Number(images.toFixed(2)) },
    { label: "Voiceover", amount: VOICE_PRICE },
    { label: "Soundtrack", amount: MUSIC_PRICE },
    { label: `Video (${scenes} × ${CLIP_SECONDS}s)`, amount: Number(video.toFixed(2)) },
  ]
  const total = lines.reduce((a, b) => a + b.amount, 0)
  return {
    total: Number(total.toFixed(2)),
    scenes,
    clipSeconds: CLIP_SECONDS,
    realDurationSec: scenes * CLIP_SECONDS,
    lines,
  }
}

export function videoModelFor(hasReferenceImage: boolean): string {
  return hasReferenceImage ? MODELS.videoImage : MODELS.videoText
}
