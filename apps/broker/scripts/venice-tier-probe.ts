const BASE = process.env.VENICE_API_BASE ?? "https://api.venice.ai/api/v1"
const KEY = process.env.VENICE_API_KEY
if (!KEY) {
  console.error("Set VENICE_API_KEY")
  process.exit(1)
}
const auth = { Authorization: `Bearer ${KEY}`, "content-type": "application/json" }

async function quote(model: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/video/quote`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ model, prompt: "a brass coin spinning on black, cinematic", ...body }),
  })
  const text = await res.text()
  return { status: res.status, text: text.slice(0, 220) }
}

const TEXT_MODELS = [
  "seedance-2-0-fast-text-to-video",
  "seedance-2-0-text-to-video",
  "seedance-1-5-pro-text-to-video",
  "veo3-fast-text-to-video",
  "veo3-full-text-to-video",
  "kling-2-5-turbo-pro-text-to-video",
  "kling-2.5-turbo-pro-text-to-video",
  "wan-2-7-text-to-video",
  "ltx-2-fast-text-to-video",
]

const IMG_MODELS = [
  "seedance-2-0-fast-image-to-video",
  "veo3-fast-image-to-video",
  "kling-2.5-turbo-pro-image-to-video",
]

async function main() {
  console.log("=== TEXT-TO-VIDEO (duration 5s, 720p, 16:9) ===")
  for (const m of TEXT_MODELS) {
    const r = await quote(m, { duration: "5s", resolution: "720p", aspect_ratio: "16:9" })
    console.log(`${m}\n   ${r.status} ${r.text}`)
  }
  console.log("\n=== IMAGE-TO-VIDEO (duration 5s, 720p, no aspect) ===")
  for (const m of IMG_MODELS) {
    const r = await quote(m, { duration: "5s", resolution: "720p" })
    console.log(`${m}\n   ${r.status} ${r.text}`)
  }
  console.log("\nDone.")
}
main()
