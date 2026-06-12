import {
  TEMPLATES,
  VIDEO_TIERS,
  VENICE_RATES,
  sceneCountFor,
  resolutionFor,
  narrationCharEstimate,
  videoModelFor,
  type TemplateKey,
  type QualityTier,
  type Resolution,
  type Aspect,
} from "@marque/shared"
import type { VeniceRestClient } from "./venice-rest"

export interface QuoteParams {
  template: TemplateKey
  quality: QualityTier
  durationSec: number
  resolution: Resolution
  aspectRatio: Aspect
  exactText?: boolean
  promptChars?: number
  imageCount?: number
}

export interface QuoteLine {
  label: string
  usd: number
}

export interface QuoteResult {
  usd: number
  atoms: string
  lines: QuoteLine[]
  scenes: number
  imageCount: number
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

export function countsFor(params: QuoteParams): { scenes: number; imageCount: number } {
  const tpl = TEMPLATES[params.template]
  const scenes = tpl.steps.video ? sceneCountFor(params.durationSec, params.quality) : 0
  const imageCount = tpl.steps.video
    ? scenes
    : tpl.steps.image
      ? (params.imageCount ?? tpl.stillCount ?? 1)
      : 0
  return { scenes, imageCount }
}

export async function quoteJob(venice: VeniceRestClient, params: QuoteParams): Promise<QuoteResult> {
  const tpl = TEMPLATES[params.template]
  const tier = VIDEO_TIERS[params.quality]
  const resolution = resolutionFor(params.quality, params.resolution)
  const { scenes, imageCount } = countsFor(params)
  const lines: QuoteLine[] = []

  if (tpl.steps.image && imageCount > 0) {
    lines.push({ label: `Images (${imageCount})`, usd: round6(imageCount * VENICE_RATES.imageUsd) })
  }
  if (tpl.steps.voice) {
    const chars = params.exactText && params.promptChars ? params.promptChars : narrationCharEstimate(params.durationSec)
    lines.push({ label: "Voiceover", usd: round6((chars * VENICE_RATES.ttsUsdPerMillionChars) / 1_000_000) })
  }
  if (tpl.steps.music) {
    lines.push({ label: "Soundtrack", usd: VENICE_RATES.musicUsd })
  }
  if (tpl.steps.video && scenes > 0) {
    const v = videoModelFor(params.quality, false)
    const perClip = await venice.videoQuote({
      model: v.model,
      duration: v.duration,
      resolution,
      aspectRatio: params.aspectRatio,
    })
    lines.push({ label: `Video (${scenes} x ${tier.clipSeconds}s)`, usd: round6(scenes * perClip) })
  }

  const usd = round6(lines.reduce((acc, l) => acc + l.usd, 0))
  return { usd, atoms: String(Math.ceil(usd * 1_000_000)), lines, scenes, imageCount }
}
