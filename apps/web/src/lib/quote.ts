import type { TemplateKey, QualityTier } from "@marque/shared"
import { publicEnv } from "./env"

export interface QuoteParams {
  template: TemplateKey
  quality: QualityTier
  durationSec: number
  resolution: "480p" | "720p" | "1080p"
  aspectRatio: "16:9" | "9:16" | "1:1"
  exactText?: boolean
  promptChars?: number
  imageCount?: number
}

export interface QuoteLine {
  label: string
  usd: number
}

export interface QuoteResult {
  generationUsd: number
  generationAtoms: string
  networkUsd: number
  totalUsd: number
  lines: QuoteLine[]
  scenes: number
  imageCount: number
}

export async function fetchQuote(params: QuoteParams, signal?: AbortSignal): Promise<QuoteResult> {
  const url = `${publicEnv.NEXT_PUBLIC_BROKER_URL.replace(/\/+$/, "")}/quote`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${publicEnv.NEXT_PUBLIC_BROKER_BEARER_TOKEN}`,
    },
    body: JSON.stringify(params),
    signal,
  })
  if (!res.ok) throw new Error(`quote failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as QuoteResult
}
