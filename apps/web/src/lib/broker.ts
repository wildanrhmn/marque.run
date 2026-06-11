import type { Hex } from "viem"
import type { SpecialistKind } from "@marque/shared"
import type { OperatorAuthorization } from "./smartaccount"
import { publicEnv } from "./env"

export interface BrokerCallArgs {
  specialistKind: SpecialistKind
  body: unknown
  amountAtoms: bigint
  briefId: Hex
  delegations: unknown[]
  authorization?: OperatorAuthorization
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
    delegations: args.delegations,
    ...(args.authorization ? { authorizationList: [args.authorization] } : {}),
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
  const contentType = res.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return (await res.json()) as BrokerCallResult<T>
  }
  const blob = await res.blob()
  const mediaUrl = URL.createObjectURL(blob)
  return {
    brokerSettlementTaskId: (res.headers.get("x-broker-settlement-task") ?? "0x") as Hex,
    brokerSettlementTxHash: (res.headers.get("x-broker-settlement-tx") || undefined) as Hex | undefined,
    contentType,
    data: { mediaUrl, mediaType: contentType } as T,
  }
}
