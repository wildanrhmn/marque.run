export {
  TEMPLATES,
  VIDEO_TIERS,
  VOICES,
  DEFAULT_VOICE,
  estimateJob,
  sceneCountFor,
  resolutionFor,
  type TemplateKey,
  type QualityTier,
  type Resolution,
  type Aspect,
  type AdEstimate,
  type VoiceOption,
} from "@marque/shared"

export const RESOLUTIONS = ["480p", "720p", "1080p"] as const

export const FORMATS = [
  { key: "16:9", label: "Landscape", ratio: "aspect-video", aspect: "16:9" },
  { key: "9:16", label: "Portrait", ratio: "aspect-[9/16]", aspect: "9:16" },
  { key: "1:1", label: "Square", ratio: "aspect-square", aspect: "1:1" },
] as const
export type Format = (typeof FORMATS)[number]

export const TONES = ["Cinematic", "Moody", "Upbeat", "Minimal"] as const
