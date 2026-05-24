import type { Hex } from "viem"
import type { Delegation } from "@delegate/delegation"
import type { SpecialistKind } from "@delegate/shared"
import { BrokerClient } from "./broker-client"

export interface SpecialistRunArgs {
  briefId: Hex
  prompt: string
  parameters: Record<string, unknown>
  delegationChain: Delegation[]
  amountAtoms: bigint
}

export interface SpecialistOutput<T = unknown> {
  kind: SpecialistKind
  data: T
  contentType: string
  veniceBalanceRemaining?: string
  brokerSettlementTxHash?: string
  venicePaymentTxHash?: string
}

export interface SpecialistDefinition<TInput = unknown, TOutput = unknown> {
  kind: SpecialistKind
  buildVeniceBody: (args: SpecialistRunArgs) => TInput
  parseResult?: (raw: unknown) => TOutput
}

export function createSpecialistRunner<TInput, TOutput>(args: {
  broker: BrokerClient
  definition: SpecialistDefinition<TInput, TOutput>
}) {
  return async (run: SpecialistRunArgs): Promise<SpecialistOutput<TOutput>> => {
    const body = args.definition.buildVeniceBody(run)
    const result = await args.broker.call<unknown>({
      specialistKind: args.definition.kind,
      amountAtoms: run.amountAtoms,
      briefId: run.briefId,
      delegationChain: run.delegationChain,
      body,
    })
    const parsed = args.definition.parseResult
      ? args.definition.parseResult(result.data)
      : (result.data as TOutput)
    return {
      kind: args.definition.kind,
      data: parsed,
      contentType: result.contentType,
      veniceBalanceRemaining: result.veniceBalanceRemaining,
      brokerSettlementTxHash: result.brokerSettlementTxHash,
      venicePaymentTxHash: result.venicePaymentTxHash,
    }
  }
}
