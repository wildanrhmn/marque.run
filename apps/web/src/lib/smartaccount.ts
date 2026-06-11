"use client"
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  type Address,
  type Hex,
  type PrivateKeyAccount,
} from "viem"
import { base } from "viem/chains"
import { bytesToHex } from "viem/utils"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  toMetaMaskSmartAccount,
  Implementation,
  getSmartAccountsEnvironment,
  createDelegation,
  signDelegation,
  ScopeType,
  type MetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit"
import { USDC_BASE } from "@marque/shared"
import { publicEnv } from "./env"

const BASE_RPC = publicEnv.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org"
const RELAYER_URL = publicEnv.NEXT_PUBLIC_ONESHOT_RELAYER_URL

export interface OperatorAuthorization {
  address: Address
  chainId: number
  nonce: number
  r: Hex
  s: Hex
  yParity: number
}

export interface SessionBudget {
  smartAccountAddress: Address
  directorAddress: Address
  delegations: unknown[]
  authorization?: OperatorAuthorization
}

function publicClient() {
  return createPublicClient({ chain: base, transport: http(BASE_RPC) })
}

function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "bigint") return `0x${value.toString(16)}`
  if (value instanceof Uint8Array) return bytesToHex(value)
  if (Array.isArray(value)) return value.map(toRelayerJson)
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toRelayerJson(v)
    return out
  }
  return value
}

let cachedTarget: Address | undefined
export async function fetchRelayerTarget(): Promise<Address> {
  if (cachedTarget) return cachedTarget
  const res = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "relayer_getCapabilities", params: [String(base.id)] }),
  })
  const json = (await res.json()) as { result?: Record<string, { targetAddress: Address }> }
  const target = json.result?.[String(base.id)]?.targetAddress
  if (!target) throw new Error("relayer returned no targetAddress for Base mainnet")
  cachedTarget = getAddress(target)
  return cachedTarget
}

export async function toSessionSmartAccount(session: PrivateKeyAccount): Promise<MetaMaskSmartAccount> {
  return toMetaMaskSmartAccount({
    client: publicClient() as never,
    implementation: Implementation.Stateless7702,
    address: session.address,
    signer: { account: session as never },
  })
}

export async function buildSessionBudget(args: {
  session: PrivateKeyAccount
  budgetAtoms: bigint
}): Promise<SessionBudget> {
  const environment = getSmartAccountsEnvironment(base.id)
  const target = await fetchRelayerTarget()
  const smartAccount = await toSessionSmartAccount(args.session)

  const directorKey = generatePrivateKey()
  const director = privateKeyToAccount(directorKey)
  const scope = {
    type: ScopeType.Erc20TransferAmount as const,
    tokenAddress: USDC_BASE as Hex,
    maxAmount: args.budgetAtoms,
  }

  const root = createDelegation({
    to: director.address,
    from: smartAccount.address,
    environment: smartAccount.environment,
    salt: bytesToHex(crypto.getRandomValues(new Uint8Array(32))) as Hex,
    scope,
  })
  const rootSig = await smartAccount.signDelegation({ delegation: root })
  const signedRoot = { ...root, signature: rootSig }

  const child = createDelegation({
    to: target,
    from: director.address,
    environment: smartAccount.environment,
    parentDelegation: signedRoot,
    salt: bytesToHex(crypto.getRandomValues(new Uint8Array(32))) as Hex,
    scope,
  })
  const childSig = await signDelegation({
    privateKey: directorKey,
    delegation: child,
    delegationManager: environment.DelegationManager as Address,
    chainId: base.id,
  })
  const signedChild = { ...child, signature: childSig }

  let authorization: OperatorAuthorization | undefined
  const client = publicClient()
  const code = await client.getCode({ address: args.session.address })
  const impl = environment.implementations.EIP7702StatelessDeleGatorImpl
  if (!impl) throw new Error("EIP7702StatelessDeleGatorImpl not found in environment")
  const upgraded = !!code && code.toLowerCase().includes(impl.slice(2).toLowerCase())
  if (!upgraded) {
    const nonce = await client.getTransactionCount({ address: args.session.address, blockTag: "pending" })
    const auth = await args.session.signAuthorization({
      chainId: base.id,
      contractAddress: getAddress(impl),
      nonce,
    })
    authorization = {
      address: auth.address,
      chainId: auth.chainId,
      nonce: auth.nonce,
      r: auth.r,
      s: auth.s,
      yParity: auth.yParity ?? 0,
    }
  }

  return {
    smartAccountAddress: smartAccount.address,
    directorAddress: director.address,
    delegations: [toRelayerJson(signedChild), toRelayerJson(signedRoot)],
    authorization,
  }
}

export async function sessionUsdcBalance(address: Address): Promise<bigint> {
  return publicClient().readContract({
    address: USDC_BASE as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  }) as Promise<bigint>
}

export function usdcTransferCalldata(to: Address, atoms: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, atoms] })
}

export async function waitForTx(hash: Hex): Promise<void> {
  await publicClient().waitForTransactionReceipt({ hash })
}
