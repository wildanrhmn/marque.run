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
import { createPublicClient, http, type Hex } from "viem"
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"
import { base } from "viem/chains"
import { bytesToHex } from "viem/utils"

const RELAYER_URL = process.env.ONESHOT_RELAYER_URL ?? "https://relayer.1shotapi.com/relayers"
const RPC_URL = process.env.BASE_RPC_URL ?? "https://mainnet.base.org"
const BROKER_URL = process.env.BROKER_LOCAL_URL ?? "http://127.0.0.1:8789"
const BEARER = process.env.BROKER_BEARER_TOKEN as string
const FLOAT_KEY = process.env.BROKER_FLOAT_PRIVATE_KEY as Hex
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

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

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result as T
}

async function main() {
  const operator = privateKeyToAccount(FLOAT_KEY)
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
  const caps = await rpc<Record<string, { targetAddress: Hex }>>("relayer_getCapabilities", [String(base.id)])
  const targetAddress = caps[String(base.id)]!.targetAddress

  const environment = getSmartAccountsEnvironment(base.id)
  const directorKey = generatePrivateKey()
  const director = privateKeyToAccount(directorKey)
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: operator.address,
    signer: { account: operator },
  })
  const scope = { type: ScopeType.Erc20TransferAmount as const, tokenAddress: USDC as Hex, maxAmount: 200_000n }

  const root = createDelegation({
    to: director.address,
    from: smartAccount.address,
    environment: smartAccount.environment,
    salt: bytesToHex(Uint8Array.from(randomBytes(32))) as Hex,
    scope,
  })
  const rootSig = await smartAccount.signDelegation({ delegation: root })
  const signedRoot = { ...root, signature: rootSig }

  const child = createDelegation({
    to: targetAddress,
    from: director.address,
    environment: smartAccount.environment,
    parentDelegation: signedRoot,
    salt: bytesToHex(Uint8Array.from(randomBytes(32))) as Hex,
    scope,
  })
  const childSig = await signDelegation({
    privateKey: directorKey,
    delegation: child,
    delegationManager: environment.DelegationManager,
    chainId: base.id,
  })
  const signedChild = { ...child, signature: childSig }

  const briefId = bytesToHex(Uint8Array.from(randomBytes(32)))
  const envelope = {
    scheme: "marque-v1",
    network: "eip155:8453",
    amountAtoms: "20000",
    briefId,
    specialistKind: "concept",
    delegations: [toRelayerJson(signedChild), toRelayerJson(signedRoot)],
  }
  const xPayment = Buffer.from(JSON.stringify(envelope)).toString("base64")

  const body = { prompt: "30s ad for a cold brew brand called Lichen, moody indie tone", durationSeconds: 30 }

  console.log("posting to broker /broker/venice/concept ...")
  const res = await fetch(`${BROKER_URL}/broker/venice/concept`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${BEARER}`,
      "x-payment": xPayment,
    },
    body: JSON.stringify(body),
  })
  console.log("HTTP", res.status)
  const text = await res.text()
  console.log("response:", text.slice(0, 1200))
}

main().catch((e) => {
  console.error("TEST FAILED:", e)
  process.exit(1)
})
