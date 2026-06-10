const BASE = process.env.VENICE_API_BASE ?? "https://api.venice.ai/api/v1"
const KEY = process.env.VENICE_API_KEY
if (!KEY) {
  console.error("Set VENICE_API_KEY")
  process.exit(1)
}
const auth = { Authorization: `Bearer ${KEY}`, "content-type": "application/json" }

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${path}`, { method: "POST", headers: auth, body: JSON.stringify(body) })
  const ct = res.headers.get("content-type") ?? ""
  return { status: res.status, ct, res }
}

async function probeImage() {
  console.log("\n=== image: seedream-v4 ===")
  const { status, ct, res } = await post("image/generate", {
    model: "seedream-v4",
    prompt: "a single brass coin on a black studio backdrop, cinematic",
    width: 1024,
    height: 576,
  })
  console.log("status", status, "content-type", ct)
  if (ct.includes("application/json")) {
    const j = (await res.json()) as Record<string, unknown>
    console.log("top-level keys:", Object.keys(j))
    const sample = JSON.stringify(j).slice(0, 300)
    console.log("sample:", sample)
  } else {
    const buf = await res.arrayBuffer()
    console.log("binary bytes:", buf.byteLength)
  }
}

async function probeTts() {
  console.log("\n=== tts: tts-kokoro ===")
  const { status, ct, res } = await post("audio/speech", {
    model: "tts-kokoro",
    input: "Cold brew, brewed cold.",
    voice: "af_sky",
    response_format: "mp3",
  })
  console.log("status", status, "content-type", ct)
  if (ct.includes("application/json")) {
    const t = await res.text()
    console.log("json:", t.slice(0, 400))
  } else {
    const buf = await res.arrayBuffer()
    console.log("binary bytes:", buf.byteLength)
  }
}

async function probeMusic() {
  console.log("\n=== music: stable-audio-25 ===")
  const { status, ct, res } = await post("audio/music", {
    model: "stable-audio-25",
    prompt: "moody indie instrumental, slow tempo, warm",
    duration: 10,
  })
  console.log("status", status, "content-type", ct)
  const t = ct.includes("application/json") ? (await res.text()).slice(0, 400) : `binary ${(await res.arrayBuffer()).byteLength} bytes`
  console.log(t)
}

async function main() {
  const which = process.argv.slice(2)
  const all = which.length === 0
  if (all || which.includes("image")) await probeImage().catch((e) => console.error("image err", e.message))
  if (all || which.includes("tts")) await probeTts().catch((e) => console.error("tts err", e.message))
  if (which.includes("music")) await probeMusic().catch((e) => console.error("music err", e.message))
  console.log("\nDone.")
}
main()
