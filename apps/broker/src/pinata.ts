import { loadEnv } from "./env"
import { logger } from "./log"

const UPLOAD_URL = "https://uploads.pinata.cloud/v3/files"

export interface PinResult {
  cid: string
  ipfsUri: string
  gatewayUrl: string
}

export function pinataEnabled(): boolean {
  return !!loadEnv().PINATA_JWT
}

function gatewayUrl(cid: string): string {
  const env = loadEnv()
  if (env.PINATA_GATEWAY) {
    const base = env.PINATA_GATEWAY.replace(/^https?:\/\//, "").replace(/\/+$/, "")
    const token = env.PINATA_GATEWAY_TOKEN ? `?pinataGatewayToken=${env.PINATA_GATEWAY_TOKEN}` : ""
    return `https://${base}/ipfs/${cid}${token}`
  }
  return `https://gateway.pinata.cloud/ipfs/${cid}`
}

async function uploadForm(form: FormData): Promise<string> {
  const env = loadEnv()
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.PINATA_JWT}` },
    body: form,
  })
  if (!res.ok) throw new Error(`pinata upload ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data?: { cid?: string }; cid?: string }
  const cid = json.data?.cid ?? json.cid
  if (!cid) throw new Error("pinata upload returned no cid")
  return cid
}

export async function pinBuffer(data: Buffer, name: string, mime: string): Promise<PinResult> {
  const blob = new Blob([data], { type: mime })
  const file = new File([blob], name, { type: mime })
  const form = new FormData()
  form.append("file", file)
  form.append("network", "public")
  const cid = await uploadForm(form)
  logger.info({ cid, name, bytes: data.byteLength }, "pinned to ipfs")
  return { cid, ipfsUri: `ipfs://${cid}`, gatewayUrl: gatewayUrl(cid) }
}

export async function pinJson(value: unknown, name: string): Promise<PinResult> {
  const data = Buffer.from(JSON.stringify(value, null, 2), "utf8")
  return pinBuffer(data, name.endsWith(".json") ? name : `${name}.json`, "application/json")
}
