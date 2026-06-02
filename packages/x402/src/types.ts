import { z } from "zod"
import type { Address, Hex } from "viem"
import type { Caip2Network } from "@marque/shared"

export const X402_VERSION = 1 as const
export const X402_HEADER = "X-PAYMENT"
export const X402_RESPONSE_HEADER = "X-PAYMENT-RESPONSE"

export const PaymentSchemes = ["exact"] as const
export type PaymentScheme = (typeof PaymentSchemes)[number]

export const SupportedNetworks = ["eip155:8453", "eip155:84532"] as const
export type SupportedNetwork = (typeof SupportedNetworks)[number]

export const ErrorReasons = [
  "insufficient_funds",
  "invalid_scheme",
  "invalid_network",
  "invalid_signature",
  "expired",
  "settlement_failed",
] as const
export type ErrorReason = (typeof ErrorReasons)[number]

export const HexAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>
export const Bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/) as z.ZodType<Hex>
export const SignatureSchema = z.string().regex(/^0x[a-fA-F0-9]{130}$/) as z.ZodType<Hex>

export const PaymentRequirementsSchema = z.object({
  scheme: z.enum(PaymentSchemes),
  network: z.enum(SupportedNetworks),
  maxAmountRequired: z.string().regex(/^\d+$/),
  resource: z.string().url(),
  description: z.string(),
  mimeType: z.string().optional(),
  outputSchema: z.record(z.unknown()).optional(),
  payTo: HexAddressSchema,
  maxTimeoutSeconds: z.number().int().positive(),
  asset: HexAddressSchema,
  extra: z
    .object({
      name: z.string(),
      version: z.string(),
    })
    .optional(),
})
export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>

export const Eip3009AuthorizationSchema = z.object({
  from: HexAddressSchema,
  to: HexAddressSchema,
  value: z.string().regex(/^\d+$/),
  validAfter: z.string().regex(/^\d+$/),
  validBefore: z.string().regex(/^\d+$/),
  nonce: Bytes32Schema,
})
export type Eip3009Authorization = z.infer<typeof Eip3009AuthorizationSchema>

export const ExactEvmPayloadSchema = z.object({
  signature: SignatureSchema,
  authorization: Eip3009AuthorizationSchema,
})
export type ExactEvmPayload = z.infer<typeof ExactEvmPayloadSchema>

export const PaymentPayloadSchema = z.object({
  x402Version: z.literal(X402_VERSION),
  scheme: z.enum(PaymentSchemes),
  network: z.enum(SupportedNetworks),
  payload: ExactEvmPayloadSchema,
})
export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>

export const VerifyRequestSchema = z.object({
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: PaymentRequirementsSchema,
})
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>

export const VerifyResponseSchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.enum(ErrorReasons).nullable(),
  payer: HexAddressSchema.nullable(),
})
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>

export const SettleRequestSchema = VerifyRequestSchema
export type SettleRequest = z.infer<typeof SettleRequestSchema>

export const SettleResponseSchema = z.object({
  success: z.boolean(),
  errorReason: z.enum(ErrorReasons).nullable(),
  payer: HexAddressSchema.nullable(),
  transaction: z.string(),
  network: z.string(),
})
export type SettleResponse = z.infer<typeof SettleResponseSchema>

export const PaymentResponseHeaderSchema = z.object({
  verified: z.boolean(),
  settled: z.boolean(),
  txHash: z.string(),
  clientAddress: HexAddressSchema,
  timestamp: z.number(),
})
export type PaymentResponseHeader = z.infer<typeof PaymentResponseHeaderSchema>

export const SupportedPaymentKindSchema = z.object({
  x402Version: z.literal(X402_VERSION),
  scheme: z.enum(PaymentSchemes),
  network: z.enum(SupportedNetworks),
})
export type SupportedPaymentKind = z.infer<typeof SupportedPaymentKindSchema>

export interface PaymentRequiredBody {
  x402Version: typeof X402_VERSION
  error: string
  accepts: PaymentRequirements[]
}

export type Caip2 = Caip2Network
