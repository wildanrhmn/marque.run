const BASE = process.env.VENICE_API_BASE ?? "https://api.venice.ai/api/v1"
const KEY = process.env.VENICE_API_KEY
if (!KEY) {
  console.error("Set VENICE_API_KEY")
  process.exit(1)
}
const auth = { Authorization: `Bearer ${KEY}`, "content-type": "application/json" }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function tryPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${path}`, { method: "POST", headers: auth, body: JSON.stringify(body) })
  const ct = res.headers.get("content-type") ?? ""
  let payload: unknown
  if (ct.includes("application/json")) payload = await res.json()
  else payload = `binary ${(await res.arrayBuffer()).byteLength} bytes (${ct})`
  return { status: res.status, ct, payload }
}

async function probeMusic() {
  console.log("\n========== MUSIC (stable-audio-25) ==========")
  const body = { model: "stable-audio-25", prompt: "moody indie instrumental, warm, slow" }
  let qid: unknown
  for (const path of ["audio/queue", "audio/generate", "audio/generations"]) {
    const r = await tryPost(path, body)
    console.log(`POST ${path} -> ${r.status} ${r.ct}`)
    console.log(typeof r.payload === "string" ? r.payload : JSON.stringify(r.payload).slice(0, 300))
    if (r.status < 400) {
      if (r.ct.includes("audio")) {
        console.log("MUSIC returned audio directly (sync).")
        return
      }
      const obj = r.payload as Record<string, unknown>
      qid = obj?.queue_id ?? obj?.id
      break
    }
  }
  if (!qid) {
    console.log("no music queue id; endpoint still unknown")
    return
  }
  for (let i = 0; i < 20; i++) {
    await sleep(3000)
    const r = await tryPost("audio/retrieve", { model: body.model, queue_id: qid })
    const obj = typeof r.payload === "object" ? (r.payload as Record<string, unknown>) : null
    console.log(`audio/retrieve #${i} -> ${r.status} ${r.ct} ${obj ? Object.keys(obj).join(",") : ""}`)
    if (r.ct.includes("audio") || (obj && (obj.status === "COMPLETED" || obj.download_url))) {
      console.log("MUSIC FINAL:", typeof r.payload === "string" ? r.payload : JSON.stringify(r.payload).slice(0, 300))
      return
    }
  }
}

async function probeVideo() {
  console.log("\n========== VIDEO (seedance fast, 5s, 480p) ==========")
  const reqBody = {
    model: "seedance-2-0-fast-text-to-video",
    prompt: "a brass coin spinning on a black studio table, cinematic, slow motion",
    duration: "5s",
    resolution: "480p",
    aspect_ratio: "16:9",
  }

  try {
    const q = await tryPost("video/quote", reqBody)
    console.log(`quote -> ${q.status}`, JSON.stringify(q.payload).slice(0, 300))
  } catch (e) {
    console.log("quote err", (e as Error).message)
  }

  const queued = await tryPost("video/queue", reqBody)
  console.log(`queue -> ${queued.status} ${queued.ct}`)
  console.log(JSON.stringify(queued.payload).slice(0, 400))

  const qid =
    typeof queued.payload === "object" && queued.payload
      ? ((queued.payload as Record<string, unknown>).queue_id ??
        (queued.payload as Record<string, unknown>).id ??
        (queued.payload as Record<string, unknown>).request_id)
      : undefined
  console.log("queue id field ->", qid)
  if (!qid) return

  for (let i = 0; i < 40; i++) {
    await sleep(4000)
    const r = await tryPost("video/retrieve", { model: reqBody.model, queue_id: qid })
    const obj = typeof r.payload === "object" ? (r.payload as Record<string, unknown>) : null
    const status = obj?.status ?? r.ct
    console.log(`retrieve #${i} -> ${r.status} status=${JSON.stringify(status)} keys=${obj ? Object.keys(obj).join(",") : "binary"}`)
    if (r.ct.includes("video") || (obj && (obj.status === "COMPLETED" || obj.download_url || obj.video))) {
      console.log("FINAL:", typeof r.payload === "string" ? r.payload : JSON.stringify(r.payload).slice(0, 500))
      return
    }
    if (obj && (obj.status === "FAILED" || obj.error)) {
      console.log("FAILED:", JSON.stringify(obj).slice(0, 400))
      return
    }
  }
  console.log("timed out polling video/retrieve")
}

async function main() {
  const which = process.argv.slice(2)
  if (which.length === 0 || which.includes("music")) await probeMusic().catch((e) => console.error(e))
  if (which.length === 0 || which.includes("video")) await probeVideo().catch((e) => console.error(e))
  console.log("\nDone.")
}
main()
