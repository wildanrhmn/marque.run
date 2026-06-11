import "dotenv/config"
import { randomBytes } from "node:crypto"
import {
  Implementation,
  ScopeType,
  createDelegation,
  signDelegation,
  getSmartAccountsEnvironment,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit"
import { createPublicClient, encodeFunctionData, erc20Abi, getAddress, http, parseUnits, type Hex } from "viem"
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"
import { base } from "viem/chains"
import { bytesToHex } from "viem/utils"

const RELAYER_URL = process.env.ONESHOT_RELAYER_URL ?? "https://relayer.1shotapi.com/relayers"
const RPC_URL = process.env.BASE_RPC_URL ?? "https://mainnet.base.org"
const FLOAT_KEY = process.env.BROKER_FLOAT_PRIVATE_KEY as Hex
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

let rpcId = 1
async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  })
  const json = (await res.json()) as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result as T
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

async function main() {
  const chainId = base.id
  const operator = privateKeyToAccount(FLOAT_KEY)
  const directorKey = generatePrivateKey()
  const director = privateKeyToAccount(directorKey)
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
  const environment = getSmartAccountsEnvironment(chainId)

  console.log("operator(session):", operator.address)
  console.log("director:", director.address)

  const caps = await rpc<Record<string, { feeCollector: Hex; targetAddress: Hex; tokens: { address: Hex; symbol?: string; decimals: number | string }[] }>>(
    "relayer_getCapabilities", [String(chainId)],
  )
  const chainCaps = caps[String(chainId)]!
  const usdc = chainCaps.tokens.find((t) => t.symbol === "USDC")!
  const decimals = Number(usdc.decimals)

  const feeData = await rpc<{ gasPrice: Hex; rate: number; minFee: string; context?: string }>(
    "relayer_getFeeData", { chainId: String(chainId), token: usdc.address },
  )
  const minFee = feeData.minFee.includes(".") ? parseUnits(feeData.minFee as `${number}`, decimals) : BigInt(feeData.minFee)
  const feeAmount = minFee * 2n
  const workAmount = 10_000n
  const cap = feeAmount + workAmount + 50_000n

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: operator.address,
    signer: { account: operator },
  })

  // root: session smart account -> director
  const root = createDelegation({
    to: director.address,
    from: smartAccount.address,
    environment: smartAccount.environment,
    salt: bytesToHex(Uint8Array.from(randomBytes(32))) as Hex,
    scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: usdc.address, maxAmount: cap },
  })
  const rootSig = await smartAccount.signDelegation({ delegation: root })
  const signedRoot = { ...root, signature: rootSig }

  // child: director -> relayer target, redelegated from root
  const child = createDelegation({
    to: chainCaps.targetAddress,
    from: director.address,
    environment: smartAccount.environment,
    parentDelegation: signedRoot,
    salt: bytesToHex(Uint8Array.from(randomBytes(32))) as Hex,
    scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: usdc.address, maxAmount: cap },
  })
  const childSig = await signDelegation({
    privateKey: directorKey,
    delegation: child,
    delegationManager: environment.DelegationManager,
    chainId,
  })
  const signedChild = { ...child, signature: childSig }
  console.log("2-hop chain built (session -> director -> relayer)")

  // session already upgraded from prior spike; include auth only if needed
  let authorizationList: unknown[] | undefined
  const code = await publicClient.getCode({ address: operator.address })
  const impl = environment.implementations.EIP7702StatelessDeleGatorImpl!
  if (!code || !code.toLowerCase().includes(impl.slice(2).toLowerCase())) {
    const nonce = await publicClient.getTransactionCount({ address: operator.address, blockTag: "pending" })
    const auth = await operator.signAuthorization({ chainId, contractAddress: getAddress(impl), nonce })
    authorizationList = [{ address: auth.address, chainId: auth.chainId, nonce: auth.nonce, r: auth.r, s: auth.s, yParity: auth.yParity ?? 0 }]
  }

  const feeCalldata = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [chainCaps.feeCollector, feeAmount] })
  const workCalldata = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [operator.address, workAmount] })

  const taskId = await rpc<string>("relayer_send7710Transaction", {
    chainId: String(chainId),
    context: feeData.context,
    ...(authorizationList ? { authorizationList } : {}),
    transactions: [{
      permissionContext: [toRelayerJson(signedChild), toRelayerJson(signedRoot)],
      executions: [
        { target: usdc.address, value: "0", data: feeCalldata },
        { target: usdc.address, value: "0", data: workCalldata },
      ],
    }],
  })
  console.log("submitted taskId:", taskId)

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await rpc<{ status: number; receipt?: { transactionHash?: Hex }; message?: string }>(
      "relayer_getStatus", { id: taskId, logs: false },
    )
    console.log(`status[${i}]:`, s.status, s.receipt?.transactionHash ?? "", s.message ?? "")
    if (s.receipt?.transactionHash) console.log("BASESCAN:", `https://basescan.org/tx/${s.receipt.transactionHash}`)
    if (s.status >= 200) break
  }
}

main().catch((e) => {
  console.error("A2A SPIKE FAILED:", e)
  process.exit(1)
})
