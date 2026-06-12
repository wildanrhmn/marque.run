import { type Address, type Hex, encodeFunctionData, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { BASE_CHAIN_ID, BrokerSettlementError, USDC_BASE } from "@marque/shared"
import { loadEnv } from "./env"
import { OneShotClient, type OneShotCapabilities, type OneShotAuthorizationListEntry } from "./oneshot"

interface SettleContext {
  oneShot: OneShotClient
  brokerAddress: Address
  webhookUrl: string
  capabilitiesCache?: { ts: number; value: OneShotCapabilities }
}

let ctx: SettleContext | undefined

function getCtx(): SettleContext {
  if (ctx) return ctx
  const env = loadEnv()
  const floatAccount = privateKeyToAccount(env.BROKER_FLOAT_PRIVATE_KEY)
  ctx = {
    oneShot: new OneShotClient({ endpoint: env.ONESHOT_RELAYER_URL }),
    brokerAddress: floatAccount.address,
    webhookUrl: `${env.ONESHOT_WEBHOOK_PUBLIC_BASE_URL.replace(/\/+$/, "")}/webhook/relay`,
  }
  return ctx
}

const ERC20_ABI = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"])

function encodeErc20Transfer(to: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [to, amount] })
}

async function getCapabilitiesCached(c: SettleContext): Promise<OneShotCapabilities> {
  const ttlMs = 60_000
  if (c.capabilitiesCache && Date.now() - c.capabilitiesCache.ts < ttlMs) return c.capabilitiesCache.value
  const all = await c.oneShot.getCapabilities([BASE_CHAIN_ID])
  const caps = all[BASE_CHAIN_ID.toString()]
  if (!caps) throw new BrokerSettlementError("1Shot returned no capabilities for Base mainnet")
  c.capabilitiesCache = { ts: Date.now(), value: caps }
  return caps
}

export async function quoteNetworkFeeAtoms(): Promise<bigint> {
  const c = getCtx()
  const caps = await getCapabilitiesCached(c)
  const usdcToken = caps.tokens.find((t) => t.address.toLowerCase() === USDC_BASE.toLowerCase())
  if (!usdcToken) throw new BrokerSettlementError("USDC not listed in 1Shot capabilities for Base mainnet")
  const quote = await c.oneShot.getFeeData({ chainId: BASE_CHAIN_ID, token: USDC_BASE })
  const usdcDecimals = Number(usdcToken.decimals)
  const minFee = quote.minFee.includes(".") ? parseUnits(quote.minFee as `${number}`, usdcDecimals) : BigInt(quote.minFee)
  return minFee * 2n
}

export interface SettleExactArgs {
  delegations: unknown[]
  authorizationList?: OneShotAuthorizationListEntry[]
  workAtoms: bigint
  timeoutMs?: number
}

export interface SettleExactResult {
  taskId: Hex
  hash?: Hex
  workAtoms: bigint
  feeAtoms: bigint
}

export async function settleExact(args: SettleExactArgs): Promise<SettleExactResult> {
  const c = getCtx()
  const caps = await getCapabilitiesCached(c)
  const feeCollector = caps.feeCollector
  const usdcToken = caps.tokens.find((t) => t.address.toLowerCase() === USDC_BASE.toLowerCase())
  if (!usdcToken) throw new BrokerSettlementError("USDC not listed in 1Shot capabilities for Base mainnet")

  const quote = await c.oneShot.getFeeData({ chainId: BASE_CHAIN_ID, token: USDC_BASE })
  const usdcDecimals = Number(usdcToken.decimals)
  const minFee = quote.minFee.includes(".") ? parseUnits(quote.minFee as `${number}`, usdcDecimals) : BigInt(quote.minFee)
  const feeAtoms = minFee * 2n

  const executions = [
    { target: USDC_BASE, value: "0", data: encodeErc20Transfer(feeCollector, feeAtoms) },
    { target: USDC_BASE, value: "0", data: encodeErc20Transfer(c.brokerAddress, args.workAtoms) },
  ]

  const taskId = await c.oneShot.send7710Transaction({
    chainId: BASE_CHAIN_ID,
    context: quote.context,
    destinationUrl: c.webhookUrl,
    authorizationList: args.authorizationList && args.authorizationList.length > 0 ? args.authorizationList : undefined,
    transactions: [{ permissionContext: args.delegations, executions }],
  })

  const timeoutMs = args.timeoutMs ?? 90_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await c.oneShot.getStatus(taskId)
    if (status.status === 200) return { taskId, hash: status.receipt?.transactionHash, workAtoms: args.workAtoms, feeAtoms }
    if (status.status >= 400) throw new BrokerSettlementError(`relay terminal status ${status.status}: ${status.message ?? ""}`)
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new BrokerSettlementError(`relay timed out after ${timeoutMs}ms`)
}
