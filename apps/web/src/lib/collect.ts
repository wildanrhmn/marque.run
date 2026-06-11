import type { Hex } from "viem"
import { publicEnv } from "./env"

export interface MintInput {
  recipient: string
  contentType: string
  base64: string
  name: string
  description?: string
  template?: string
  briefId?: string
  spentUsd?: number
  settlementHashes?: string[]
}

export interface MintResult {
  txHash: Hex
  tokenUri: string
  assetCid: string
  metadataCid: string
}

export async function urlToBase64(url: string): Promise<{ base64: string; contentType: string }> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",")
    const head = url.slice(5, comma)
    return { base64: url.slice(comma + 1), contentType: head.split(";")[0] || "application/octet-stream" }
  }
  const res = await fetch(url)
  const blob = await res.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("failed to read asset"))
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(",")
  return { base64: dataUrl.slice(comma + 1), contentType: blob.type || "application/octet-stream" }
}

export async function mintToCollection(input: MintInput): Promise<MintResult> {
  const url = `${publicEnv.NEXT_PUBLIC_BROKER_URL.replace(/\/+$/, "")}/mint`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${publicEnv.NEXT_PUBLIC_BROKER_BEARER_TOKEN}`,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`mint failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as MintResult
}
