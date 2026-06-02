import type { Address } from "viem"
import { USDC_BASE } from "@marque/shared"

export interface MultiTokenPeriodSpec {
  token: Address
  periodAmountAtoms: bigint
  periodSeconds: number
  startTimestamp: number
}

export interface LimitedCallsSpec {
  maxCalls: number
}

export interface AllowedTargetsSpec {
  targets: Address[]
}

export interface AllowedMethodsSpec {
  selectors: `0x${string}`[]
}

export interface TimestampWindowSpec {
  notBefore: number
  notAfter: number
}

export interface RootBudgetSpec {
  perDayUsdc: bigint
  startTimestamp?: number
  brokerAddress: Address
  finalMintTarget: Address
}

export interface SpecialistScopeSpec {
  perCallCapUsdc: bigint
  maxCalls: number
  brokerAddress: Address
  notAfter: number
}

export function rootBudgetSpec(args: {
  perDayUsdc: bigint
  brokerAddress: Address
  finalMintTarget: Address
  startTimestamp?: number
}): RootBudgetSpec {
  return {
    perDayUsdc: args.perDayUsdc,
    brokerAddress: args.brokerAddress,
    finalMintTarget: args.finalMintTarget,
    startTimestamp: args.startTimestamp ?? Math.floor(Date.now() / 1000),
  }
}

export function specialistScopeSpec(args: {
  perCallCapUsdc: bigint
  maxCalls: number
  brokerAddress: Address
  ttlSeconds: number
}): SpecialistScopeSpec {
  return {
    perCallCapUsdc: args.perCallCapUsdc,
    maxCalls: args.maxCalls,
    brokerAddress: args.brokerAddress,
    notAfter: Math.floor(Date.now() / 1000) + args.ttlSeconds,
  }
}

export const DEFAULT_PAYMENT_TOKEN = USDC_BASE
