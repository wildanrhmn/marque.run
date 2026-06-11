"use client"
import type { Hex } from "viem"
import type { SpecialistKind } from "@marque/shared"
import { brokerCall } from "./broker"
import type { SessionBudget, OperatorAuthorization } from "./smartaccount"

export interface OrchestratorRunArgs {
  briefId: Hex
  prompt: string
  durationSeconds: number
  perSpecialistAtoms: bigint
  budget: SessionBudget
  conceptOnly?: boolean
  onSpecialistStart?: (kind: SpecialistKind) => void
  onSpecialistDone?: (kind: SpecialistKind, output: unknown) => void
  onError?: (kind: SpecialistKind | "compose", error: Error) => void
  onSettlement?: (kind: SpecialistKind, txHash?: Hex) => void
}

export interface SwarmOutputs {
  concept?: unknown
  images: unknown[]
  voice?: unknown
  music?: unknown
  video?: unknown
}

interface DispatchState {
  pendingAuthorization?: OperatorAuthorization
}

async function dispatchSpecialist(args: {
  briefId: Hex
  kind: SpecialistKind
  body: unknown
  amountAtoms: bigint
  budget: SessionBudget
  shared: DispatchState
  onSettlement?: (kind: SpecialistKind, txHash?: Hex) => void
}): Promise<unknown> {
  const authorization = args.shared.pendingAuthorization
  const result = await brokerCall<unknown>({
    specialistKind: args.kind,
    body: args.body,
    amountAtoms: args.amountAtoms,
    briefId: args.briefId,
    delegations: args.budget.delegations,
    authorization,
  })
  if (authorization) args.shared.pendingAuthorization = undefined
  args.onSettlement?.(args.kind, result.brokerSettlementTxHash)
  return result.data
}

export async function runSwarm(args: OrchestratorRunArgs): Promise<SwarmOutputs> {
  const outputs: SwarmOutputs = { images: [] }
  const shared: DispatchState = { pendingAuthorization: args.budget.authorization }

  args.onSpecialistStart?.("concept")
  try {
    const concept = await dispatchSpecialist({
      briefId: args.briefId,
      kind: "concept",
      body: { prompt: args.prompt, durationSeconds: args.durationSeconds },
      amountAtoms: args.perSpecialistAtoms,
      budget: args.budget,
      shared,
      onSettlement: args.onSettlement,
    })
    outputs.concept = concept
    args.onSpecialistDone?.("concept", concept)
  } catch (err) {
    args.onError?.("concept", err as Error)
    throw err
  }

  if (args.conceptOnly) return outputs

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
        budget: args.budget,
        shared,
        onSettlement: args.onSettlement,
      })
      outputs.images.push(out)
      args.onSpecialistDone?.("image", out)
    } catch (err) {
      args.onError?.("image", err as Error)
    }
  }

  const finalJobs: { kind: SpecialistKind; body: unknown }[] = [
    { kind: "voice", body: { prompt: scenes.map((s) => s.voiceLine).join(" ") || args.prompt } },
    { kind: "music", body: { prompt: conceptObj?.musicPrompt ?? `Soundtrack for: ${args.prompt}` } },
    { kind: "video", body: { prompt: args.prompt, durationSeconds: Math.min(args.durationSeconds, 8) } },
  ]

  for (const job of finalJobs) {
    args.onSpecialistStart?.(job.kind)
    try {
      const out = await dispatchSpecialist({
        briefId: args.briefId,
        kind: job.kind,
        body: job.body,
        amountAtoms: args.perSpecialistAtoms,
        budget: args.budget,
        shared,
        onSettlement: args.onSettlement,
      })
      if (job.kind === "voice") outputs.voice = out
      if (job.kind === "music") outputs.music = out
      if (job.kind === "video") outputs.video = out
      args.onSpecialistDone?.(job.kind, out)
    } catch (err) {
      args.onError?.(job.kind, err as Error)
    }
  }

  return outputs
}
