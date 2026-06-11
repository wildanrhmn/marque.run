"use client"
import { type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  createDelegation,
  signDelegation,
  ScopeType,
  type Delegation,
  type SmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit"
import { encodeDelegations } from "@metamask/smart-accounts-kit/utils"
import { USDC_BASE, type SpecialistKind } from "@marque/shared"

export interface SignSpecialistRedelegationArgs {
  directorKey: Hex
  delegate: Address
  parent: Delegation
  environment: SmartAccountsEnvironment
  delegationManager: Address
  chainId: number
  specialistKind: SpecialistKind
  perCallCapAtoms: bigint
  ttlSeconds: number
  startTime: number
}

export async function signSpecialistRedelegation(args: SignSpecialistRedelegationArgs): Promise<Delegation> {
  const director = privateKeyToAccount(args.directorKey)
  const child = createDelegation({
    environment: args.environment,
    from: director.address,
    to: args.delegate,
    parentDelegation: args.parent,
    scope: {
      type: ScopeType.Erc20PeriodTransfer,
      tokenAddress: USDC_BASE as Hex,
      periodAmount: args.perCallCapAtoms,
      periodDuration: args.ttlSeconds,
      startDate: args.startTime,
    },
  })
  const signature = await signDelegation({
    privateKey: args.directorKey,
    delegation: child,
    delegationManager: args.delegationManager,
    chainId: args.chainId,
  })
  return { ...child, signature }
}

export function encodeDelegationChain(leaf: Delegation, root: Delegation): Hex {
  return encodeDelegations([leaf, root])
}
