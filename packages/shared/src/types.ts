import type { Address, Hex } from "viem"

export type Caip2Network = `eip155:${number}`

export type SpecialistKind = "concept" | "image" | "voice" | "music" | "video"

export type VeniceEndpoint =
  | "chat/completions"
  | "image/generate"
  | "audio/speech"
  | "audio/music"
  | "video/complete"

export const SPECIALIST_TO_VENICE: Record<SpecialistKind, VeniceEndpoint> = {
  concept: "chat/completions",
  image: "image/generate",
  voice: "audio/speech",
  music: "audio/music",
  video: "video/complete",
}

export interface BriefRequest {
  operator: Address
  prompt: string
  budgetUsdc: string
  durationSeconds: number
}

export interface SpecialistTask {
  kind: SpecialistKind
  budgetUsdc: string
  prompt: string
  parameters: Record<string, unknown>
}

export interface DirectorPlan {
  briefId: Hex
  storyboard: string
  tasks: SpecialistTask[]
  composition: {
    scenes: { imageIndex: number; voiceIndex: number; musicSegment: number; durationMs: number }[]
  }
}

export interface AgentTimelineEvent {
  briefId: Hex
  ts: number
  kind:
    | "operator.brief.submitted"
    | "operator.upgrade.7702.signed"
    | "operator.root.delegation.signed"
    | "director.plan.ready"
    | "specialist.redelegation.signed"
    | "specialist.venice.request"
    | "broker.relay.submitted"
    | "broker.relay.confirmed"
    | "specialist.venice.response"
    | "composer.scene.rendered"
    | "broker.ipfs.pinned"
    | "composer.final.encoded"
    | "mint.tx.submitted"
    | "mint.tx.confirmed"
    | "error"
  specialistKind?: SpecialistKind
  details: Record<string, unknown>
}
