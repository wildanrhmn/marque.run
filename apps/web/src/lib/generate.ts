import type { Hex } from "viem"
import type { TemplateKey, QualityTier } from "@marque/shared"
import { publicEnv } from "./env"

export interface GenerateRequest {
  prompt: string
  template: TemplateKey
  quality: QualityTier
  durationSec: number
  resolution: "480p" | "720p" | "1080p"
  aspectRatio: "16:9" | "9:16" | "1:1"
  tone?: string
  voice?: string
  exactText?: boolean
}

export interface GenerateStarted {
  briefId: Hex
  status: string
  stream: string
}

export async function startGeneration(req: GenerateRequest): Promise<GenerateStarted> {
  const url = `${publicEnv.NEXT_PUBLIC_BROKER_URL.replace(/\/+$/, "")}/generate`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${publicEnv.NEXT_PUBLIC_BROKER_BEARER_TOKEN}`,
    },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`generate failed: ${res.status} ${text}`)
  }
  return (await res.json()) as GenerateStarted
}

export function brokerStreamUrl(briefId: Hex): string {
  return `${publicEnv.NEXT_PUBLIC_BROKER_URL.replace(/\/+$/, "")}/stream/brief/${briefId}`
}
