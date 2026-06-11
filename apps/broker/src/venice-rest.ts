import { VeniceError } from "@marque/shared"
import { logger } from "./log"

export interface VeniceRestOptions {
  apiBase: string
  apiKey: string
  fetchImpl?: typeof fetch
}

interface QueueResponse {
  model: string
  queue_id: string
  status?: string
}

interface RetrieveStatus {
  status?: string
  error?: string
  download_url?: string
}

const SYNC_TIMEOUT_MS = 120_000
const ASYNC_TIMEOUT_MS = 300_000
const POLL_INTERVAL_MS = 4_000

export class VeniceRestClient {
  private readonly base: string
  private readonly key: string
  private readonly fetchImpl: typeof fetch

  constructor(opts: VeniceRestOptions) {
    this.base = opts.apiBase.replace(/\/+$/, "")
    this.key = opts.apiKey
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.key}`, "content-type": "application/json" }
  }

  async balanceUsd(): Promise<number | null> {
    try {
      const res = await this.fetchImpl(`${this.base}/api_keys/rate_limits`, { headers: this.headers() })
      if (!res.ok) return null
      const body = (await res.json()) as { data?: { balances?: { USD?: number } } }
      return body.data?.balances?.USD ?? null
    } catch {
      return null
    }
  }

  private async post(path: string, body: unknown, timeoutMs = SYNC_TIMEOUT_MS): Promise<Response> {
    const maxAttempts = 4
    let last: Response | undefined
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await this.fetchImpl(`${this.base}/${path}`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (res.status !== 429 && res.status !== 503) return res
        last = res
        logger.warn({ path, status: res.status, attempt }, "venice overloaded, retrying")
      } finally {
        clearTimeout(timer)
      }
      if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
    return last as Response
  }

  async chat(args: { model: string; system?: string; user: string; jsonObject?: boolean; maxTokens?: number }): Promise<string> {
    const messages = [
      ...(args.system ? [{ role: "system", content: args.system }] : []),
      { role: "user", content: args.user },
    ]
    const body: Record<string, unknown> = { model: args.model, messages, max_tokens: args.maxTokens ?? 1200 }
    if (args.jsonObject) body.response_format = { type: "json_object" }
    const res = await this.post("chat/completions", body)
    if (!res.ok) throw new VeniceError(`chat ${res.status}: ${await res.text()}`, res.status)
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new VeniceError("chat returned empty content")
    return content
  }

  async image(args: {
    model: string
    prompt: string
    width?: number
    height?: number
    negativePrompt?: string
  }): Promise<{ base64: string; mime: string }> {
    const res = await this.post("image/generate", {
      model: args.model,
      prompt: args.prompt,
      width: args.width ?? 1024,
      height: args.height ?? 576,
      negative_prompt: args.negativePrompt ?? "low quality, watermark, text overlay",
    })
    if (!res.ok) throw new VeniceError(`image ${res.status}: ${await res.text()}`, res.status)
    const json = (await res.json()) as { images?: string[] }
    const b64 = json.images?.[0]
    if (!b64) throw new VeniceError("image returned no data")
    return { base64: b64, mime: "image/webp" }
  }

  async tts(args: { model: string; input: string; voice: string }): Promise<Buffer> {
    const res = await this.post("audio/speech", {
      model: args.model,
      input: args.input,
      voice: args.voice,
      response_format: "mp3",
    })
    if (!res.ok) throw new VeniceError(`tts ${res.status}: ${await res.text()}`, res.status)
    return Buffer.from(await res.arrayBuffer())
  }

  async music(args: { model: string; prompt: string }): Promise<Buffer> {
    return this.queueAndPoll({
      queuePath: "audio/queue",
      retrievePath: "audio/retrieve",
      model: args.model,
      body: { model: args.model, prompt: args.prompt },
      mediaPrefix: "audio/",
    })
  }

  async videoQuote(args: VideoArgs): Promise<number> {
    const res = await this.post("video/quote", this.videoBody(args))
    if (!res.ok) throw new VeniceError(`video/quote ${res.status}: ${await res.text()}`, res.status)
    const json = (await res.json()) as { quote?: number }
    return json.quote ?? 0
  }

  async video(args: VideoArgs): Promise<Buffer> {
    return this.queueAndPoll({
      queuePath: "video/queue",
      retrievePath: "video/retrieve",
      model: args.model,
      body: this.videoBody(args),
      mediaPrefix: "video/",
    })
  }

  private videoBody(args: VideoArgs): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: args.model,
      prompt: args.prompt,
      duration: args.duration,
      resolution: args.resolution,
    }
    if (args.imageUrl) {
      body.image_url = args.imageUrl
    } else {
      body.aspect_ratio = args.aspectRatio
    }
    return body
  }

  private async queueAndPoll(args: {
    queuePath: string
    retrievePath: string
    model: string
    body: Record<string, unknown>
    mediaPrefix: string
  }): Promise<Buffer> {
    const queued = await this.post(args.queuePath, args.body)
    if (!queued.ok) throw new VeniceError(`${args.queuePath} ${queued.status}: ${await queued.text()}`, queued.status)
    const q = (await queued.json()) as QueueResponse
    if (!q.queue_id) throw new VeniceError(`${args.queuePath} returned no queue_id`)
    logger.info({ path: args.queuePath, queueId: q.queue_id }, "venice job queued")

    const start = Date.now()
    while (Date.now() - start < ASYNC_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      const res = await this.post(args.retrievePath, { model: args.model, queue_id: q.queue_id })
      const ct = res.headers.get("content-type") ?? ""
      if (ct.startsWith(args.mediaPrefix)) {
        return Buffer.from(await res.arrayBuffer())
      }
      if (ct.includes("application/json")) {
        const status = (await res.json()) as RetrieveStatus
        if (status.error) throw new VeniceError(`${args.retrievePath} failed: ${status.error}`)
        if (status.status === "FAILED") throw new VeniceError(`${args.retrievePath} status FAILED`)
        if (status.download_url) {
          const dl = await this.fetchImpl(status.download_url)
          return Buffer.from(await dl.arrayBuffer())
        }
      }
    }
    throw new VeniceError(`${args.retrievePath} timed out`)
  }
}

export interface VideoArgs {
  model: string
  prompt: string
  duration: string
  resolution: string
  aspectRatio: string
  imageUrl?: string
}
