"use client"
import { type Address, type Hex, createPublicClient, http } from "viem"
import { base } from "viem/chains"
import type { SpecialistKind } from "@marque/shared"
import { brokerCall } from "./broker"
import { getSessionIdentities } from "./identities"
import {
  signSpecialistRedelegation,
  encodeChildDelegationAsContext,
} from "./redelegate"
import type { GrantedPermissionContext } from "./permissions"
import {
  signSpecialistAuthorization,
  isSpecialistUpgraded,
  markSpecialistUpgraded,
  type AuthorizationListEntry,
} from "./auth7702"
import { publicEnv } from "./env"

const EIP7702_STATELESS_DELEGATOR: Address = "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B"

export interface OrchestratorRunArgs {
  briefId: Hex
  prompt: string
  durationSeconds: number
  perSpecialistAtoms: bigint
  rootGrant: GrantedPermissionContext
  delegationManager: Address
  chainId: number
  onSpecialistStart?: (kind: SpecialistKind) => void
  onSpecialistDone?: (kind: SpecialistKind, output: unknown) => void
  onError?: (kind: SpecialistKind | "compose", error: Error) => void
  onAuthorizationSigned?: (entry: AuthorizationListEntry) => void
}

export interface SwarmOutputs {
  concept?: unknown
  images: unknown[]
  voice?: unknown
  music?: unknown
  video?: unknown
}

interface DispatchSharedState {
  pendingAuthorization?: AuthorizationListEntry
}

async function dispatchSpecialist(args: {
  briefId: Hex
  kind: SpecialistKind
  body: unknown
  amountAtoms: bigint
  rootGrant: GrantedPermissionContext
  delegationManager: Address
  chainId: number
  shared: DispatchSharedState
}): Promise<unknown> {
  const identities = getSessionIdentities()
  const child = await signSpecialistRedelegation({
    delegator: identities.director,
    delegate: identities.specialist.address,
    delegationManager: args.delegationManager,
    chainId: args.chainId,
    parent: args.rootGrant,
    specialistKind: args.kind,
    brokerAddress: publicEnv.NEXT_PUBLIC_BROKER_FLOAT_ADDRESS as Address,
    perCallCapAtoms: args.amountAtoms,
    ttlSeconds: 600,
  })

  const delegationContext = encodeChildDelegationAsContext(child, args.rootGrant.context)

  const authorizationList = args.shared.pendingAuthorization
    ? [args.shared.pendingAuthorization]
    : undefined

  const result = await brokerCall<unknown>({
    specialistKind: args.kind,
    body: args.body,
    amountAtoms: args.amountAtoms,
    briefId: args.briefId,
    delegationContext,
    delegationManager: args.delegationManager,
    authorizationList,
  })

  if (args.shared.pendingAuthorization) {
    markSpecialistUpgraded(identities.specialist.address)
    args.shared.pendingAuthorization = undefined
  }

  return result.data
}

export async function runSwarm(args: OrchestratorRunArgs): Promise<SwarmOutputs> {
  const outputs: SwarmOutputs = { images: [] }
  const identities = getSessionIdentities()

  const publicClient = createPublicClient({
    chain: base,
    transport: http(publicEnv.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org"),
  })

  const shared: DispatchSharedState = {}
  if (!isSpecialistUpgraded(identities.specialist.address)) {
    try {
      shared.pendingAuthorization = await signSpecialistAuthorization({
        specialist: identities.specialist,
        publicClient,
        contractAddress: EIP7702_STATELESS_DELEGATOR,
        chainId: args.chainId,
      })
      args.onAuthorizationSigned?.(shared.pendingAuthorization)
    } catch (err) {
      args.onError?.("compose", err as Error)
    }
  }

  args.onSpecialistStart?.("concept")
  try {
    const concept = await dispatchSpecialist({
      briefId: args.briefId,
      kind: "concept",
      body: { prompt: args.prompt, durationSeconds: args.durationSeconds },
      amountAtoms: args.perSpecialistAtoms,
      rootGrant: args.rootGrant,
      delegationManager: args.delegationManager,
      chainId: args.chainId,
      shared,
    })
    outputs.concept = concept
    args.onSpecialistDone?.("concept", concept)
  } catch (err) {
    args.onError?.("concept", err as Error)
    throw err
  }

  const conceptObj = outputs.concept as
    | { scenes?: { description: string; voiceLine: string }[]; musicPrompt?: string }
    | undefined
  const scenes = conceptObj?.scenes ?? []

  for (let i = 0; i < Math.min(scenes.length, 3); i++) {
    args.onSpecialistStart?.("image")
    try {
      const out = await dispatchSpecialist({
        briefId: args.briefId,
        kind: "image",
        body: { prompt: scenes[i]?.description ?? args.prompt },
        amountAtoms: args.perSpecialistAtoms,
        rootGrant: args.rootGrant,
        delegationManager: args.delegationManager,
        chainId: args.chainId,
        shared,
      })
      outputs.images.push(out)
      args.onSpecialistDone?.("image", out)
    } catch (err) {
      args.onError?.("image", err as Error)
    }
  }

  const finalJobs: { kind: SpecialistKind; body: unknown }[] = [
    {
      kind: "voice",
      body: { prompt: scenes.map((s) => s.voiceLine).join(" ") || args.prompt },
    },
    {
      kind: "music",
      body: { prompt: conceptObj?.musicPrompt ?? `Soundtrack for: ${args.prompt}` },
    },
    {
      kind: "video",
      body: { prompt: args.prompt, durationSeconds: Math.min(args.durationSeconds, 8) },
    },
  ]

  await Promise.allSettled(
    finalJobs.map(async (job) => {
      args.onSpecialistStart?.(job.kind)
      try {
        const out = await dispatchSpecialist({
          briefId: args.briefId,
          kind: job.kind,
          body: job.body,
          amountAtoms: args.perSpecialistAtoms,
          rootGrant: args.rootGrant,
          delegationManager: args.delegationManager,
          chainId: args.chainId,
          shared,
        })
        if (job.kind === "voice") outputs.voice = out
        if (job.kind === "music") outputs.music = out
        if (job.kind === "video") outputs.video = out
        args.onSpecialistDone?.(job.kind, out)
      } catch (err) {
        args.onError?.(job.kind, err as Error)
      }
    }),
  )

  return outputs
}
