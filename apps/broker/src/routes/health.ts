import { Hono } from "hono"

export const healthRoute = new Hono()

healthRoute.get("/", (c) =>
  c.json({
    service: "marque-broker",
    status: "ok",
    ts: Date.now(),
  }),
)
