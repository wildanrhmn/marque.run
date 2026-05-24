import type { Address, Hex } from "viem"
import type { Delegation } from "@delegate/delegation"
import type { SpecialistKind } from "@delegate/shared"

export interface BrokerCallArgs {
  specialistKind: SpecialistKind
  body: unknown
  amountAtoms: bigint
  briefId: Hex
  delegationChain: Delegation[]
}

export interface BrokerJsonResult<T = unknown> {
  brokerSettlementTaskId: Hex
  brokerSettlementTxHash?: Hex
  venicePaymentTxHash?: string
  veniceBalanceRemaining?: string
  contentType: string
  data: T
}

export interface BrokerClientOptions {
  baseUrl: string
  bearerToken: string
  fetchImpl?: typeof fetch
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function serializeDelegation(d: Delegation): unknown {
  return {
    delegate: d.delegate,
    delegator: d.delegator,
    authority: d.authority,
    caveats: d.caveats,
    salt: d.salt.toString(),
    signature: d.signature,
  }
}

function buildEnvelope(args: BrokerCallArgs): string {
  const envelope = {
    scheme: "delegate-run-v1",
    network: "eip155:8453",
    amountAtoms: args.amountAtoms.toString(),
    briefId: args.briefId,
    specialistKind: args.specialistKind,
    delegationChain: args.delegationChain.map(serializeDelegation),
  }
  return toBase64(new TextEncoder().encode(JSON.stringify(envelope)))
}

export class BrokerClient {
  private readonly baseUrl: string
  private readonly bearerToken: string
  private readonly fetchImpl: typeof fetch

  constructor(options: BrokerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "")
    this.bearerToken = options.bearerToken
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async call<T = unknown>(args: BrokerCallArgs): Promise<BrokerJsonResult<T>> {
    const url = `${this.baseUrl}/broker/venice/${args.specialistKind}`
    const header = buildEnvelope(args)
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.bearerToken}`,
        "x-payment": header,
      },
      body: JSON.stringify(args.body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`broker call ${args.specialistKind} failed ${res.status}: ${text}`)
    }
    const contentType = res.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      return (await res.json()) as BrokerJsonResult<T>
    }
    const buf = await res.arrayBuffer()
    return {
      brokerSettlementTaskId: (res.headers.get("x-broker-settlement-task") ?? "0x") as Hex,
      brokerSettlementTxHash: (res.headers.get("x-broker-settlement-tx") ?? undefined) as Hex | undefined,
      venicePaymentTxHash: res.headers.get("x-venice-payment-tx") ?? undefined,
      veniceBalanceRemaining: res.headers.get("x-balance-remaining") ?? undefined,
      contentType,
      data: buf as unknown as T,
    }
  }
}

export type { Address }
