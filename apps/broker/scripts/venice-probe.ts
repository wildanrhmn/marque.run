const BASE = process.env.VENICE_API_BASE ?? "https://api.venice.ai/api/v1"
const KEY = process.env.VENICE_API_KEY

if (!KEY) {
  console.error("Set VENICE_API_KEY first. Example:")
  console.error('  $env:VENICE_API_KEY="vk-..."   (PowerShell)')
  console.error("  VENICE_API_KEY=vk-... pnpm ... (bash)")
  process.exit(1)
}

const auth = { Authorization: `Bearer ${KEY}` }
const doImage = process.argv.includes("--image")

interface ModelEntry {
  id: string
  type?: string
  model_spec?: { name?: string }
}

async function listModels(): Promise<ModelEntry[]> {
  const res = await fetch(`${BASE}/models`, { headers: auth })
  if (!res.ok) throw new Error(`GET /models ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { data?: ModelEntry[] }
  return body.data ?? []
}

async function checkBalance(): Promise<void> {
  const res = await fetch(`${BASE}/api_keys/rate_limits`, { headers: auth }).catch(() => null)
  if (res && res.ok) {
    const body = await res.json()
    console.log("\n[rate limits / balance]")
    console.log(JSON.stringify(body, null, 2).slice(0, 800))
  }
}

async function cheapChat(model: string): Promise<void> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      max_tokens: 5,
    }),
  })
  const text = await res.text()
  console.log(`\n[chat ${model}] -> ${res.status}`)
  console.log(text.slice(0, 400))
}

async function smallImage(model: string): Promise<void> {
  const res = await fetch(`${BASE}/image/generate`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ model, prompt: "a single brass coin on black, studio lighting", width: 512, height: 512 }),
  })
  console.log(`\n[image ${model}] -> ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    const j = await res.json()
    console.log("keys:", Object.keys(j))
  } else {
    console.log("content-type:", ct, "(binary image returned)")
  }
}

async function main() {
  console.log(`Venice probe -> ${BASE}`)
  const models = await listModels()
  const byType = new Map<string, string[]>()
  for (const m of models) {
    const t = m.type ?? "unknown"
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(m.id)
  }
  console.log("\n[models by type]")
  for (const [t, ids] of byType) console.log(`${t}: ${ids.join(", ")}`)

  const textModels = byType.get("text") ?? []
  if (textModels.length) await cheapChat(textModels[0]!)

  await checkBalance()

  if (doImage) {
    const imageModels = byType.get("image") ?? []
    if (imageModels.length) await smallImage(imageModels[0]!)
  } else {
    console.log("\n(skip image gen; pass --image to test one, costs ~$0.01-0.10)")
  }

  console.log("\nDone. Paste the [models by type] block back so I can bake the real ids in.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
