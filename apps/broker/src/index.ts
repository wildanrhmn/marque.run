import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { loadEnv } from "./env"
import { logger } from "./log"
import { healthRoute } from "./routes/health"
import { facilitatorRoute } from "./routes/facilitator"
import { brokerRoute } from "./routes/broker"
import { webhookRoute } from "./routes/webhook"
import { streamRoute } from "./routes/stream"
import { composeRoute } from "./routes/compose"
import { assetRoute } from "./routes/asset"
import { generateRoute } from "./routes/generate"
import { quoteRoute } from "./routes/quote"
import { mintRoute } from "./routes/mint"

const env = loadEnv()

const app = new Hono()

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-payment"],
  }),
)

const bearerOnly = async (c: import("hono").Context, next: () => Promise<void>) => {
  const auth = c.req.header("authorization")
  if (!auth || !auth.startsWith("Bearer ")) return c.text("unauthorized", 401)
  if (auth.slice("Bearer ".length).trim() !== env.BROKER_BEARER_TOKEN) {
    return c.text("unauthorized", 401)
  }
  await next()
}

app.use("/broker/*", bearerOnly)
app.use("/compose/*", bearerOnly)
app.use("/generate/*", bearerOnly)
app.use("/quote/*", bearerOnly)
app.use("/quote", bearerOnly)
app.use("/mint/*", bearerOnly)

app.route("/health", healthRoute)
app.route("/x402", facilitatorRoute)
app.route("/broker", brokerRoute)
app.route("/webhook", webhookRoute)
app.route("/stream", streamRoute)
app.route("/compose", composeRoute)
app.route("/asset", assetRoute)
app.route("/generate", generateRoute)
app.route("/quote", quoteRoute)
app.route("/mint", mintRoute)

app.onError((err, c) => {
  logger.error({ err }, "unhandled broker error")
  return c.json({ error: err.message, name: err.name }, 500)
})

const port = env.BROKER_PORT
const hostname = process.env.BROKER_BIND ?? "127.0.0.1"
serve({ fetch: app.fetch, port, hostname }, (info) => {
  logger.info({ port: info.port, hostname }, "marque-broker listening")
})
