import { Hono } from "hono"
import { z } from "zod"
import { VeniceRestClient } from "../venice-rest"
import { quoteJob } from "../pricing"
import { quoteNetworkFeeAtoms } from "../settle"
import { loadEnv } from "../env"
import { logger } from "../log"

const BodySchema = z.object({
  template: z.enum(["ad", "product", "explainer", "music", "voiceover", "images"]),
  quality: z.enum(["draft", "standard", "cinematic"]).default("draft"),
  durationSec: z.number().int().min(5).max(60).default(30),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  exactText: z.boolean().optional(),
  promptChars: z.number().int().min(0).max(20000).optional(),
  imageCount: z.number().int().min(1).max(4).optional(),
})

let venice: VeniceRestClient | undefined

function getVenice(): VeniceRestClient {
  if (venice) return venice
  const env = loadEnv()
  venice = new VeniceRestClient({ apiBase: env.VENICE_API_BASE, apiKey: env.VENICE_API_KEY ?? "" })
  return venice
}

export const quoteRoute = new Hono()

quoteRoute.post("/", async (c) => {
  const json = await c.req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.flatten() }, 400)
  try {
    const g = await quoteJob(getVenice(), parsed.data)
    let networkUsd = 0
    try {
      networkUsd = Number(await quoteNetworkFeeAtoms()) / 1_000_000
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "network fee quote failed, omitting")
    }
    const totalUsd = Math.round((g.usd + networkUsd) * 1_000_000) / 1_000_000
    return c.json({
      generationUsd: g.usd,
      generationAtoms: g.atoms,
      networkUsd,
      totalUsd,
      lines: g.lines,
      scenes: g.scenes,
      imageCount: g.imageCount,
    })
  } catch (err) {
    logger.error({ err: (err as Error).message }, "quote failed")
    return c.json({ error: (err as Error).message }, 502)
  }
})
