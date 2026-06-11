import "dotenv/config"
import { z } from "zod"
import type { Address, Hex } from "viem"

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>
const HexSchema = z.string().regex(/^0x[a-fA-F0-9]+$/) as z.ZodType<Hex>

const Schema = z.object({
  BROKER_PORT: z.coerce.number().int().positive().default(8789),
  BROKER_BEARER_TOKEN: z.string().min(32),
  BROKER_FLOAT_PRIVATE_KEY: HexSchema,
  BROKER_FLOAT_ADDRESS: AddressSchema,
  ONESHOT_RELAYER_URL: z.string().url(),
  ONESHOT_JWKS_URL: z.string().url(),
  ONESHOT_WEBHOOK_PUBLIC_BASE_URL: z.string().url(),
  VENICE_API_BASE: z.string().url(),
  VENICE_PAY_TO: AddressSchema,
  VENICE_API_KEY: z.string().optional(),
  VENICE_MODE: z.enum(["apikey", "x402"]).default("apikey"),
  VENICE_VOICE: z.string().default("af_sky"),
  BASE_RPC_URL: z.string().url(),
  USDC_BASE: AddressSchema,
  DELEGATION_MANAGER_ADDRESS: AddressSchema,
  EIP7702_STATELESS_DELEGATOR: AddressSchema.default("0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B" as Address),
  PINATA_JWT: z.string().optional(),
  PINATA_GATEWAY: z.string().optional(),
  PINATA_GATEWAY_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
})

export type BrokerEnv = z.infer<typeof Schema>

let cached: BrokerEnv | undefined

export function loadEnv(): BrokerEnv {
  if (cached) return cached
  const parsed = Schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ")
    throw new Error(`broker env invalid:\n  ${issues}`)
  }
  cached = parsed.data
  return cached
}
