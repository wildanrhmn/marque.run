import type { Hex } from "viem"
import type { SpecialistKind } from "@marque/shared"
import { publicEnv } from "./env"

export interface BrokerCallArgs {
  specialistKind: SpecialistKind
  body: unknown
  amountAtoms: bigint
  briefId: Hex
  delegationContext: Hex
  delegationManager: string
  authorizationList?: unknown[]
}

export interface BrokerCallResult<T = unknown> {
  brokerSettlementTaskId: Hex
  brokerSettlementTxHash?: Hex
  venicePaymentTxHash?: string
  veniceBalanceRemaining?: string
  contentType: string
  data: T
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function buildEnvelope(args: BrokerCallArgs): string {
  const envelope = {
    scheme: "marque-v1",
    network: "eip155:8453",
    amountAtoms: args.amountAtoms.toString(),
    briefId: args.briefId,
    specialistKind: args.specialistKind,
    delegationContext: args.delegationContext,
    delegationManager: args.delegationManager,
    authorizationList: args.authorizationList ?? [],
  }
  return toBase64(new TextEncoder().encode(JSON.stringify(envelope)))
}

export async function brokerCall<T = unknown>(args: BrokerCallArgs): Promise<BrokerCallResult<T>> {
  const url = `${publicEnv.NEXT_PUBLIC_BROKER_URL.replace(/\/+$/, "")}/broker/venice/${args.specialistKind}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${publicEnv.NEXT_PUBLIC_BROKER_BEARER_TOKEN}`,
      "x-payment": buildEnvelope(args),
    },
    body: JSON.stringify(args.body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`broker ${args.specialistKind} ${res.status}: ${text}`)
  }
  return (await res.json()) as BrokerCallResult<T>
}
