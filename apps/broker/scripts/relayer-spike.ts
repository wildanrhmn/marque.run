import "dotenv/config"
import { randomBytes } from "node:crypto"
import {
  Implementation,
  ScopeType,
  createDelegation,
  getSmartAccountsEnvironment,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit"
import { createPublicClient, encodeFunctionData, erc20Abi, getAddress, http, parseUnits, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"
import { bytesToHex } from "viem/utils"

const RELAYER_URL = process.env.ONESHOT_RELAYER_URL ?? "https://relayer.1shotapi.com/relayers"
const RPC_URL = process.env.BASE_RPC_URL ?? "https://mainnet.base.org"
const FLOAT_KEY = process.env.BROKER_FLOAT_PRIVATE_KEY as Hex

let rpcId = 1
async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  })
  const json = (await res.json()) as
    | { result: T }
    | { error: { code: number; message: string; data?: unknown } }
  if ("error" in json) throw new Error(`[${json.error.code}] ${json.error.message} ${JSON.stringify(json.error.data ?? "")}`)
  return json.result
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

function toAtoms(v: string, decimals: number): bigint {
  return v.includes(".") ? parseUnits(v as `${number}`, decimals) : BigInt(v)
}

function computeFeeAmount(
  feeData: { gasPrice: Hex; rate: number; minFee: string },
  estimatedGasUsed: bigint,
  decimals: number,
): bigint {
  const minFee = toAtoms(feeData.minFee, decimals)
  let computed = 0n
  try {
    const nativeFeeWei = BigInt(feeData.gasPrice) * estimatedGasUsed
    computed = BigInt(Math.ceil(Number(nativeFeeWei) * feeData.rate))
  } catch {
    computed = 0n
  }
  return computed < minFee ? minFee : computed
}

async function main() {
  if (!FLOAT_KEY) throw new Error("BROKER_FLOAT_PRIVATE_KEY missing")
  const chainId = base.id
  const operator = privateKeyToAccount(FLOAT_KEY)
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
  const environment = getSmartAccountsEnvironment(chainId)
  const statelessImpl = environment.implementations.EIP7702StatelessDeleGatorImpl

  console.log("operator:", operator.address)
  console.log("delegationManager:", environment.DelegationManager)

  const caps = await rpc<Record<string, {
    feeCollector: Hex
    targetAddress: Hex
    tokens: { address: Hex; symbol?: string; decimals: number | string }[]
  }>>("relayer_getCapabilities", [String(chainId)])
  const chainCaps = caps[String(chainId)]!
  const usdc = chainCaps.tokens.find((t) => t.symbol === "USDC")!
  console.log("targetAddress:", chainCaps.targetAddress, "feeCollector:", chainCaps.feeCollector, "usdc:", usdc.address)

  const feeData = await rpc<{
    gasPrice: Hex; rate: number; minFee: string; expiry: number; context?: string
  }>("relayer_getFeeData", { chainId: String(chainId), token: usdc.address })
  console.log("feeData:", JSON.stringify(feeData))
  const decimals = Number(usdc.decimals)
  const minFee = toAtoms(feeData.minFee, decimals)
  const feeAmount = minFee * 2n // headroom above the floor so the relayer's required fee is covered
  const workAmount = 10_000n // 0.01 USDC, self-transfer (proves execution, no net loss)
  console.log("feeAmount(atoms):", feeAmount.toString(), "workAmount:", workAmount.toString())

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: operator.address,
    signer: { account: operator },
  })

  let authorizationList: unknown[] | undefined
  const code = await publicClient.getCode({ address: operator.address })
  const alreadyUpgraded = !!code && code.toLowerCase().includes(statelessImpl.slice(2).toLowerCase())
  console.log("account code present:", !!code, "alreadyUpgraded:", alreadyUpgraded)
  if (!alreadyUpgraded) {
    const nonce = await publicClient.getTransactionCount({ address: operator.address, blockTag: "pending" })
    const auth = await operator.signAuthorization({
      chainId,
      contractAddress: getAddress(statelessImpl),
      nonce,
    })
    authorizationList = [{
      address: auth.address,
      chainId: auth.chainId,
      nonce: auth.nonce,
      r: auth.r,
      s: auth.s,
      yParity: auth.yParity ?? 0,
    }]
    console.log("signed 7702 authorization, nonce:", nonce)
  }

  const delegation = createDelegation({
    to: chainCaps.targetAddress,
    from: smartAccount.address,
    environment: smartAccount.environment,
    salt: bytesToHex(Uint8Array.from(randomBytes(32))) as Hex,
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: usdc.address,
      maxAmount: feeAmount + workAmount,
    },
  })
  const signature = await smartAccount.signDelegation({ delegation })
  const signedDelegation = { ...delegation, signature }
  console.log("delegation signed, from:", delegation.from, "to:", delegation.to)

  const feeCalldata = encodeFunctionData({
    abi: erc20Abi, functionName: "transfer", args: [chainCaps.feeCollector, feeAmount],
  })
  const workCalldata = encodeFunctionData({
    abi: erc20Abi, functionName: "transfer", args: [operator.address, workAmount],
  })

  const taskId = await rpc<string>("relayer_send7710Transaction", {
    chainId: String(chainId),
    context: feeData.context,
    ...(authorizationList ? { authorizationList } : {}),
    transactions: [{
      permissionContext: [toRelayerJson(signedDelegation)],
      executions: [
        { target: usdc.address, value: "0", data: feeCalldata },
        { target: usdc.address, value: "0", data: workCalldata },
      ],
    }],
  })
  console.log("submitted taskId:", taskId)

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const status = await rpc<{ code: number; label: string; hash?: Hex; message?: string | null }>(
      "relayer_getStatus", { id: taskId, logs: false },
    )
    console.log(`status[${i}]:`, status.code, status.label, status.hash ?? "", status.message ?? "")
    if (status.hash) console.log("BASESCAN:", `https://basescan.org/tx/${status.hash}`)
    if (status.code >= 200) break
  }
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e)
  process.exit(1)
})
