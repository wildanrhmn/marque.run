import { createPrivateKey } from "crypto"
import { privateKeyToAccount } from "viem/accounts"
import type { Address, Hex } from "viem"
import { buildEip3009Payment, encodePaymentHeader } from "@marque/x402"
import { BASE_CHAIN_ID, USDC_BASE, VENICE_DEFAULT_TIMEOUT_SECONDS, VeniceError } from "@marque/shared"
import type { VeniceEndpoint } from "@marque/shared"
import { logger } from "./log"

export interface VeniceClientArgs {
  apiBase: string
  payTo: Address
  floatPrivateKey: Hex
  usdc?: Address
  chainId?: number
  apiKey?: string
}

export interface VeniceCallArgs {
  endpoint: VeniceEndpoint
  body: unknown
  priceAtoms: bigint
}

export interface VeniceCallResult {
  status: number
  body: unknown
  contentType: string
  paymentTxHash?: string
  balanceRemaining?: string
}

export class VeniceClient {
  private readonly apiBase: string
  private readonly payTo: Address
  private readonly account = privateKeyToAccount as never
  private readonly floatAccount: ReturnType<typeof privateKeyToAccount>
  private readonly usdc: Address
  private readonly chainId: number
  private readonly apiKey?: string

  constructor(args: VeniceClientArgs) {
    this.apiBase = args.apiBase.replace(/\/+$/, "")
    this.payTo = args.payTo
    this.floatAccount = privateKeyToAccount(args.floatPrivateKey)
    this.usdc = args.usdc ?? USDC_BASE
    this.chainId = args.chainId ?? BASE_CHAIN_ID
    this.apiKey = args.apiKey
    void createPrivateKey
  }

  async call(args: VeniceCallArgs): Promise<VeniceCallResult> {
    const url = `${this.apiBase}/${args.endpoint}`
    const headers: Record<string, string> = { "content-type": "application/json" }

    if (this.apiKey) {
      headers["authorization"] = `Bearer ${this.apiKey}`
    } else {
      const { paymentPayload } = await buildEip3009Payment({
        account: this.floatAccount,
        to: this.payTo,
        valueAtoms: args.priceAtoms,
        validBefore: Math.floor(Date.now() / 1000) + VENICE_DEFAULT_TIMEOUT_SECONDS,
        asset: this.usdc,
        chainId: this.chainId,
      })
      const header = encodePaymentHeader(paymentPayload)
      headers["X-402-Payment"] = header
      headers["X-PAYMENT"] = header
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(args.body),
    })

    const contentType = response.headers.get("content-type") ?? "application/octet-stream"
    const balanceRemaining = response.headers.get("X-Balance-Remaining") ?? undefined
    const paymentTxHash = response.headers.get("X-PAYMENT-RESPONSE") ?? undefined

    if (response.status === 402) {
      const text = await response.text()
      logger.error({ status: 402, body: text }, "venice rejected payment")
      throw new VeniceError("venice returned 402 after payment attached", 402, text)
    }
    if (!response.ok) {
      const text = await response.text()
      throw new VeniceError(`venice ${response.status}: ${text}`, response.status)
    }

    let body: unknown
    if (contentType.includes("application/json")) body = await response.json()
    else if (contentType.startsWith("image/") || contentType.startsWith("audio/") || contentType.startsWith("video/")) {
      body = await response.arrayBuffer()
    } else body = await response.text()

    return { status: response.status, body, contentType, balanceRemaining, paymentTxHash }
  }
}
