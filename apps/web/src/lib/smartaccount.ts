"use client"
import { createPublicClient, http, type Address, type Hex, type WalletClient } from "viem"
import { base } from "viem/chains"
import {
  toMetaMaskSmartAccount,
  Implementation,
  getSmartAccountsEnvironment,
  createDelegation,
  ScopeType,
  type Delegation,
  type MetaMaskSmartAccount,
  type SmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit"
import { USDC_BASE } from "@marque/shared"
import { publicEnv } from "./env"

const BASE_RPC = publicEnv.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org"

export interface RootBudget {
  delegation: Delegation
  delegationManager: Address
  environment: SmartAccountsEnvironment
  smartAccountAddress: Address
  directorAddress: Address
}

export function smartAccountsEnvironment(): SmartAccountsEnvironment {
  return getSmartAccountsEnvironment(base.id)
}

export async function toUserSmartAccount(
  walletClient: WalletClient,
  owner: Address,
): Promise<MetaMaskSmartAccount> {
  const client = createPublicClient({ chain: base, transport: http(BASE_RPC) })
  return toMetaMaskSmartAccount({
    client: client as never,
    implementation: Implementation.Stateless7702,
    address: owner,
    signer: { walletClient: walletClient as never },
  })
}

export async function signRootBudgetDelegation(args: {
  smartAccount: MetaMaskSmartAccount
  directorAddress: Address
  budgetUsdcAtoms: bigint
  ttlSeconds: number
  startTime: number
}): Promise<RootBudget> {
  const environment = smartAccountsEnvironment()
  const delegation = createDelegation({
    environment,
    from: args.smartAccount.address,
    to: args.directorAddress,
    scope: {
      type: ScopeType.Erc20PeriodTransfer,
      tokenAddress: USDC_BASE as Hex,
      periodAmount: args.budgetUsdcAtoms,
      periodDuration: args.ttlSeconds,
      startDate: args.startTime,
    },
  })
  const signature = await args.smartAccount.signDelegation({ delegation })
  return {
    delegation: { ...delegation, signature },
    delegationManager: environment.DelegationManager as Address,
    environment,
    smartAccountAddress: args.smartAccount.address,
    directorAddress: args.directorAddress,
  }
}
