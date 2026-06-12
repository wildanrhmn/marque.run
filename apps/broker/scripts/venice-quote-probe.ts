import "dotenv/config"

const BASE = (process.env.VENICE_API_BASE ?? "https://api.venice.ai/api/v1").replace(/\/+$/, "")
const KEY = process.env.VENICE_API_KEY

if (!KEY) {
  console.error("VENICE_API_KEY missing. Run from apps/broker with the key in .env, or prefix the command with it.")
  process.exit(1)
}

const headers = { authorization: `Bearer ${KEY}`, "content-type": "application/json" }

function line() {
  console.log("\n" + "=".repeat(72))
}

async function balance() {
  line()
  console.log("BALANCE (confirms the key works)")
  const res = await fetch(`${BASE}/api_keys/rate_limits`, { headers })
  const body = await res.json().catch(() => null)
  console.log("status", res.status)
  console.log(JSON.stringify((body as { data?: { balances?: unknown } })?.data?.balances ?? body, null, 2))
}

async function listVideoModels() {
  line()
  console.log("VIDEO MODELS (real model ids + any pricing the API publishes)")
  const res = await fetch(`${BASE}/models?type=video`, { headers })
  const body = (await res.json().catch(() => null)) as { data?: Array<Record<string, unknown>> } | null
  if (!body?.data) {
    console.log("status", res.status, "raw:", JSON.stringify(body, null, 2)?.slice(0, 1200))
    return
  }
  for (const m of body.data) {
    console.log("-", m.id, JSON.stringify((m as { model_spec?: { pricing?: unknown; constraints?: unknown } }).model_spec?.pricing ?? "no pricing field"))
  }
}

async function quote(model: string, duration: unknown, resolution: string) {
  const bodyReq = { model, duration, resolution, aspect_ratio: "16:9", audio: false }
  const res = await fetch(`${BASE}/video/quote`, { method: "POST", headers, body: JSON.stringify(bodyReq) })
  const raw = await res.text()
  console.log(`\n  req: ${JSON.stringify(bodyReq)}`)
  console.log(`  status ${res.status}`)
  console.log(`  raw: ${raw.slice(0, 600)}`)
}

async function probeQuotes() {
  line()
  console.log("VIDEO QUOTE (locks the response price field + the duration format)")
  const combos: Array<[string, unknown, string]> = [
    ["seedance-1-5-pro-text-to-video", "5s", "480p"],
    ["seedance-1-5-pro-text-to-video", 5, "480p"],
    ["seedance-1-5-pro-text-to-video", "5", "480p"],
    ["kling-2.5-turbo-pro-text-to-video", "5s", "720p"],
    ["veo3-fast-text-to-video", "8s", "720p"],
  ]
  for (const [model, duration, resolution] of combos) {
    await quote(model, duration, resolution)
  }
}

async function main() {
  console.log("Venice base:", BASE)
  await balance()
  await listVideoModels()
  await probeQuotes()
  line()
  console.log("done. paste the output back so we wire pricing to the real response shape.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
