import type { Address, Hex } from "viem"
import { publicEnv } from "./env"

export interface ComposeSceneInput {
  imageBase64: string
  voiceLineMs: number
  description?: string
}

export interface ComposeRequestInput {
  briefId: Hex
  operator: Address
  prompt: string
  scenes: ComposeSceneInput[]
  voiceBase64?: string
  musicBase64?: string
  videoBase64?: string
  totalSpendUsdc?: string
  settlementHashes?: Hex[]
  width?: number
  height?: number
  fps?: number
}

export interface ComposeResult {
  cid: string
  durationMs: number
  bytes: number
  assetUrl: string
  metadataUrl: string
  contentType: string
  tokenUri?: string
  assetCid?: string
  metadataCid?: string
}

export async function composeFinalAd(req: ComposeRequestInput): Promise<ComposeResult> {
  const url = `${publicEnv.NEXT_PUBLIC_BROKER_URL.replace(/\/+$/, "")}/compose`
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
    throw new Error(`compose failed: ${res.status} ${text}`)
  }
  return (await res.json()) as ComposeResult
}
