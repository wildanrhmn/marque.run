import { Hono } from "hono"
import { z } from "zod"
import {
  PaymentPayloadSchema,
  PaymentRequirementsSchema,
  VerifyResponseSchema,
  SettleResponseSchema,
  type VerifyResponse,
  type SettleResponse,
} from "@marque/x402"
import { logger } from "../log"

const BodySchema = z.object({
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: PaymentRequirementsSchema,
})

export const facilitatorRoute = new Hono()

facilitatorRoute.post("/verify", async (c) => {
  const json = await c.req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    const reply: VerifyResponse = {
      isValid: false,
      invalidReason: "invalid_scheme",
      payer: null,
    }
    return c.json(VerifyResponseSchema.parse(reply), 400)
  }

  const { paymentPayload, paymentRequirements } = parsed.data

  if (paymentPayload.network !== paymentRequirements.network) {
    return c.json<VerifyResponse>({
      isValid: false,
      invalidReason: "invalid_network",
      payer: null,
    })
  }

  const value = BigInt(paymentPayload.payload.authorization.value)
  const required = BigInt(paymentRequirements.maxAmountRequired)
  if (value < required) {
    return c.json<VerifyResponse>({
      isValid: false,
      invalidReason: "insufficient_funds",
      payer: paymentPayload.payload.authorization.from,
    })
  }

  const now = Math.floor(Date.now() / 1000)
  const validAfter = Number(paymentPayload.payload.authorization.validAfter)
  const validBefore = Number(paymentPayload.payload.authorization.validBefore)
  if (now < validAfter || now > validBefore) {
    return c.json<VerifyResponse>({
      isValid: false,
      invalidReason: "expired",
      payer: paymentPayload.payload.authorization.from,
    })
  }

  logger.info(
    {
      from: paymentPayload.payload.authorization.from,
      to: paymentPayload.payload.authorization.to,
      value: paymentPayload.payload.authorization.value,
    },
    "facilitator verify ok",
  )

  return c.json<VerifyResponse>({
    isValid: true,
    invalidReason: null,
    payer: paymentPayload.payload.authorization.from,
  })
})

facilitatorRoute.post("/settle", async (c) => {
  const json = await c.req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    const reply: SettleResponse = {
      success: false,
      errorReason: "invalid_scheme",
      payer: null,
      transaction: "0x",
      network: "eip155:8453",
    }
    return c.json(SettleResponseSchema.parse(reply), 400)
  }
  return c.json<SettleResponse>({
    success: false,
    errorReason: "settlement_failed",
    payer: parsed.data.paymentPayload.payload.authorization.from,
    transaction: "0x",
    network: parsed.data.paymentPayload.network,
  })
})

facilitatorRoute.get("/supported", (c) =>
  c.json({
    kinds: [
      { x402Version: 1, scheme: "exact", network: "eip155:8453" },
      { x402Version: 1, scheme: "exact", network: "eip155:84532" },
    ],
  }),
)
