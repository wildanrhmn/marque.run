import type { Address, Hex } from "viem"
import { OneShotRelayError } from "@marque/shared"

export interface OneShotCapabilities {
  feeCollector: Address
  targetAddress: Address
  tokens: { address: Address; symbol: string; decimals: string }[]
}

export interface OneShotFeeQuote {
  gasPrice: Hex
  rate: number
  minFee: string
  expiry: number
  feeCollector: Address
  targetAddress: Address
  context: string
}

export interface OneShotAuthorizationListEntry {
  chainId: string
  contractAddress: Address
  nonce: Hex
  signature: Hex
}

export interface OneShotExecution {
  to: Address
  value: string
  data: Hex
}

export interface OneShotSend7710Args {
  chainId: number
  context: string
  destinationUrl?: string
  authorizationList?: OneShotAuthorizationListEntry[]
  transactions: {
    permissionContext: Hex[]
    executions: OneShotExecution[]
  }[]
}

export type OneShotStatusCode = 100 | 110 | 200 | 400 | 500

export interface OneShotStatus {
  code: OneShotStatusCode
  label: "Pending" | "Submitted" | "Confirmed" | "Rejected" | "Reverted"
  hash?: Hex
  receipt?: unknown
  message?: string | null
  data?: Hex
}

export interface OneShotClientOptions {
  endpoint: string
  fetchImpl?: typeof fetch
}

export class OneShotClient {
  private readonly endpoint: string
  private readonly fetchImpl: typeof fetch
  private nextId = 1

  constructor(options: OneShotClientOptions) {
    this.endpoint = options.endpoint
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async getCapabilities(chainIds: number[]): Promise<Record<string, OneShotCapabilities>> {
    return this.rpc<Record<string, OneShotCapabilities>>("relayer_getCapabilities",
      chainIds.map(String),
    )
  }

  async getFeeData(args: { chainId: number; token: Address }): Promise<OneShotFeeQuote> {
    return this.rpc<OneShotFeeQuote>("relayer_getFeeData", [
      { chainId: String(args.chainId), token: args.token },
    ])
  }

  async send7710Transaction(args: OneShotSend7710Args): Promise<{ taskId: Hex }> {
    return this.rpc<{ taskId: Hex }>("relayer_send7710Transaction", [
      {
        chainId: String(args.chainId),
        context: args.context,
        destinationUrl: args.destinationUrl,
        authorizationList: args.authorizationList,
        transactions: args.transactions,
      },
    ])
  }

  async getStatus(taskId: Hex, includeLogs = false): Promise<OneShotStatus> {
    return this.rpc<OneShotStatus>("relayer_getStatus", [{ id: taskId, logs: includeLogs }])
  }

  private async rpc<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params })
    let res: Response
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    } catch (cause) {
      throw new OneShotRelayError(`network error calling ${method}`, undefined, cause)
    }

    const text = await res.text()
    let parsed: { result?: T; error?: { code: number; message: string; data?: unknown } }
    try {
      parsed = JSON.parse(text)
    } catch (cause) {
      throw new OneShotRelayError(`bad json from ${method}: ${text}`, undefined, cause)
    }

    if (parsed.error) {
      throw new OneShotRelayError(parsed.error.message, parsed.error.code, parsed.error.data)
    }
    if (parsed.result === undefined) {
      throw new OneShotRelayError(`no result for ${method}`)
    }
    return parsed.result
  }
}
