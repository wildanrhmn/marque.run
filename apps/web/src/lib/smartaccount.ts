"use client"
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  parseUnits,
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

async function relayerRpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result as T
}

export async function withdrawSession(args: {
  session: PrivateKeyAccount
  to: Address
}): Promise<{ hash?: Hex; amount: bigint }> {
  const environment = getSmartAccountsEnvironment(base.id)
  const smartAccount = await toSessionSmartAccount(args.session)
  const balance = await sessionUsdcBalance(args.session.address)

  const caps = await relayerRpc<Record<string, { feeCollector: Address; targetAddress: Address; tokens: { address: Address; symbol?: string; decimals: number | string }[] }>>(
    "relayer_getCapabilities",
    [String(base.id)],
  )
  const chainCaps = caps[String(base.id)]!
  const usdc = chainCaps.tokens.find((t) => t.symbol === "USDC")!
  const decimals = Number(usdc.decimals)

  const feeData = await relayerRpc<{ minFee: string; context?: string }>("relayer_getFeeData", {
    chainId: String(base.id),
    token: USDC_BASE,
  })
  const minFee = feeData.minFee.includes(".") ? parseUnits(feeData.minFee as `${number}`, decimals) : BigInt(feeData.minFee)
  const feeAtoms = minFee * 2n
  if (balance <= feeAtoms) throw new Error("session balance too low to cover the withdrawal fee")
  const amount = balance - feeAtoms

  const delegation = createDelegation({
    to: chainCaps.targetAddress,
    from: smartAccount.address,
    environment: smartAccount.environment,
    salt: bytesToHex(crypto.getRandomValues(new Uint8Array(32))) as Hex,
    scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: USDC_BASE as Hex, maxAmount: balance },
  })
  const signature = await smartAccount.signDelegation({ delegation })

  let authorizationList: OperatorAuthorization[] | undefined
  const client = publicClient()
  const code = await client.getCode({ address: args.session.address })
  const impl = environment.implementations.EIP7702StatelessDeleGatorImpl
  if (!impl) throw new Error("EIP7702StatelessDeleGatorImpl not found")
  if (!code || !code.toLowerCase().includes(impl.slice(2).toLowerCase())) {
    const nonce = await client.getTransactionCount({ address: args.session.address, blockTag: "pending" })
    const auth = await args.session.signAuthorization({ chainId: base.id, contractAddress: getAddress(impl), nonce })
    authorizationList = [{ address: auth.address, chainId: auth.chainId, nonce: auth.nonce, r: auth.r, s: auth.s, yParity: auth.yParity ?? 0 }]
  }

  const taskId = await relayerRpc<string>("relayer_send7710Transaction", {
    chainId: String(base.id),
    context: feeData.context,
    ...(authorizationList ? { authorizationList } : {}),
    transactions: [
      {
        permissionContext: [toRelayerJson({ ...delegation, signature })],
        executions: [
          { target: USDC_BASE, value: "0", data: usdcTransferCalldata(chainCaps.feeCollector, feeAtoms) },
          { target: USDC_BASE, value: "0", data: usdcTransferCalldata(args.to, amount) },
        ],
      },
    ],
  })

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await relayerRpc<{ status: number; receipt?: { transactionHash?: Hex }; message?: string }>(
      "relayer_getStatus",
      { id: taskId, logs: false },
    )
    if (s.receipt?.transactionHash) return { hash: s.receipt.transactionHash, amount }
    if (s.status >= 400) throw new Error(`withdrawal failed: ${s.message ?? s.status}`)
  }
  return { amount }
}
