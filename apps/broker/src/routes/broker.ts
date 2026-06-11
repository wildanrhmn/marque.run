import { Hono } from "hono"
import { z } from "zod"
import { type Address, type Hex, encodeFunctionData, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  BASE_CHAIN_ID,
  BrokerSettlementError,
  BrokerVerificationError,
  USDC_BASE,
  type SpecialistKind,
  SPECIALIST_TO_VENICE,
  FIXED_MODELS,
  DEFAULT_VOICE,
} from "@marque/shared"
import { loadEnv } from "../env"
import { logger } from "../log"
import { OneShotClient, type OneShotCapabilities, type OneShotAuthorizationListEntry } from "../oneshot"
import { VeniceRestClient } from "../venice-rest"
import { state } from "../state"

const SPECIALIST_KINDS = ["concept", "image", "voice", "music", "video"] as const

const CONCEPT_SYSTEM = `You are a creative director. Given a creative brief, return ONLY a JSON object with:
hook (one sentence), scenes (array of objects with description and voiceLine), musicPrompt (one phrase), brand { name, palette: array of 3 hex colors }.
Keep scene descriptions vivid and cinematic. Output JSON only, no prose.`

interface VeniceOutput {
  contentType: string
  json?: unknown
  buffer?: Buffer
}

async function runVenice(rest: VeniceRestClient, kind: SpecialistKind, raw: unknown): Promise<VeniceOutput> {
  const r = (raw ?? {}) as { prompt?: string; durationSeconds?: number; voice?: string }
  const prompt = (r.prompt ?? "").toString().trim()
  switch (kind) {
    case "concept": {
      const content = await rest.chat({
        model: FIXED_MODELS.concept,
        system: CONCEPT_SYSTEM,
        user: prompt || "A short brand film.",
        jsonObject: true,
        maxTokens: 1200,
      })
      return { contentType: "application/json", json: { content } }
    }
    case "image": {
      const img = await rest.image({
        model: FIXED_MODELS.image,
        prompt: prompt || "cinematic brass-lit product hero shot",
        width: 1024,
        height: 1024,
      })
      return { contentType: "application/json", json: { images: [img.base64], mime: img.mime } }
    }
    case "voice": {
      const buf = await rest.tts({ model: FIXED_MODELS.voice, input: prompt || "Marque.", voice: r.voice ?? DEFAULT_VOICE })
      return { contentType: "audio/mpeg", buffer: buf }
    }
    case "music": {
      const buf = await rest.music({ model: FIXED_MODELS.music, prompt: prompt || "moody cinematic ambient soundtrack" })
      return { contentType: "audio/wav", buffer: buf }
    }
    case "video": {
      const buf = await rest.video({
        model: "seedance-1-5-pro",
        prompt: prompt || "cinematic brand film",
        duration: "5",
        resolution: "480p",
        aspectRatio: "16:9",
      })
      return { contentType: "video/mp4", buffer: buf }
    }
    default:
      throw new BrokerVerificationError(`unknown specialist ${kind}`)
  }
}

const HEX_BYTES = /^0x[a-fA-F0-9]*$/
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

const AuthorizationListEntrySchema = z.object({
  address: z.string().regex(ADDRESS_REGEX),
  chainId: z.number(),
  nonce: z.number(),
  r: z.string().regex(HEX_BYTES),
  s: z.string().regex(HEX_BYTES),
  yParity: z.number(),
})

const PaymentEnvelopeSchema = z.object({
  scheme: z.literal("marque-v1"),
  network: z.literal("eip155:8453"),
  amountAtoms: z.string().regex(/^\d+$/),
  briefId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  specialistKind: z.enum(SPECIALIST_KINDS),
  delegations: z.array(z.record(z.string(), z.unknown())).min(1),
  authorizationList: z.array(AuthorizationListEntrySchema).optional(),
})

type PaymentEnvelope = z.infer<typeof PaymentEnvelopeSchema>

function parsePaymentHeader(header: string | null): PaymentEnvelope | null {
  if (!header) return null
  try {
    const json = Buffer.from(header, "base64").toString("utf8")
    const obj = JSON.parse(json)
    return PaymentEnvelopeSchema.parse(obj)
  } catch (err) {
    logger.debug({ err }, "failed to parse X-PAYMENT envelope")
    return null
  }
}

interface RouteContext {
  oneShot: OneShotClient
  venice: VeniceRestClient
  brokerAddress: Address
  webhookUrl: string
  delegationManager: Address
  capabilitiesCache?: { ts: number; value: OneShotCapabilities }
  upgradedEoas: Set<string>
}

let context: RouteContext | undefined

function getContext(): RouteContext {
  if (context) return context
  const env = loadEnv()
  const floatAccount = privateKeyToAccount(env.BROKER_FLOAT_PRIVATE_KEY)
  context = {
    oneShot: new OneShotClient({ endpoint: env.ONESHOT_RELAYER_URL }),
    venice: new VeniceRestClient({
      apiBase: env.VENICE_API_BASE,
      apiKey: env.VENICE_API_KEY ?? "",
    }),
    brokerAddress: floatAccount.address,
    webhookUrl: `${env.ONESHOT_WEBHOOK_PUBLIC_BASE_URL.replace(/\/+$/, "")}/webhook/relay`,
    delegationManager: env.DELEGATION_MANAGER_ADDRESS,
    upgradedEoas: new Set(),
  }
  return context
}

const ERC20_ABI = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"])

function encodeErc20Transfer(to: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, amount],
  })
}

async function getCapabilitiesCached(ctx: RouteContext): Promise<OneShotCapabilities> {
  const ttlMs = 60_000
  if (ctx.capabilitiesCache && Date.now() - ctx.capabilitiesCache.ts < ttlMs) {
    return ctx.capabilitiesCache.value
  }
  const all = await ctx.oneShot.getCapabilities([BASE_CHAIN_ID])
  const caps = all[BASE_CHAIN_ID.toString()]
  if (!caps) throw new BrokerSettlementError("1Shot returned no capabilities for Base mainnet")
  ctx.capabilitiesCache = { ts: Date.now(), value: caps }
  return caps
}

interface SettleArgs {
  ctx: RouteContext
  envelope: PaymentEnvelope
}

interface SettleResult {
  taskId: Hex
  hash?: Hex
}

async function relayDelegationRedemption(args: SettleArgs): Promise<SettleResult> {
  const { ctx, envelope } = args
  const caps = await getCapabilitiesCached(ctx)
  const feeCollector = caps.feeCollector
  const usdcToken = caps.tokens.find((t) => t.address.toLowerCase() === USDC_BASE.toLowerCase())
  if (!usdcToken) {
    throw new BrokerSettlementError("USDC not listed in 1Shot capabilities for Base mainnet")
  }

  const quote = await ctx.oneShot.getFeeData({ chainId: BASE_CHAIN_ID, token: USDC_BASE })
  const usdcDecimals = Number(usdcToken.decimals)
  const minFee = quote.minFee.includes(".")
    ? parseUnits(quote.minFee as `${number}`, usdcDecimals)
    : BigInt(quote.minFee)
  const feeAtoms = minFee * 2n
  const paymentAtoms = BigInt(envelope.amountAtoms)

  const executions = [
    { target: USDC_BASE, value: "0", data: encodeErc20Transfer(feeCollector, feeAtoms) },
    { target: USDC_BASE, value: "0", data: encodeErc20Transfer(ctx.brokerAddress, paymentAtoms) },
  ]

  const authorizationList: OneShotAuthorizationListEntry[] | undefined =
    envelope.authorizationList && envelope.authorizationList.length > 0
      ? (envelope.authorizationList as OneShotAuthorizationListEntry[])
      : undefined

  const taskId = await ctx.oneShot.send7710Transaction({
    chainId: BASE_CHAIN_ID,
    context: quote.context,
    destinationUrl: ctx.webhookUrl,
    authorizationList,
    transactions: [
      {
        permissionContext: envelope.delegations,
        executions,
      },
    ],
  })

  state.recordTask({
    taskId,
    briefId: envelope.briefId as Hex,
    specialistKind: envelope.specialistKind,
    status: "Pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    meta: {
      amountAtoms: envelope.amountAtoms,
      feeAtoms: feeAtoms.toString(),
      had7702: !!authorizationList,
    },
  })

  state.emit({
    briefId: envelope.briefId as Hex,
    ts: Date.now(),
    kind: "broker.relay.submitted",
    specialistKind: envelope.specialistKind,
    details: { taskId, amountAtoms: envelope.amountAtoms, feeAtoms: feeAtoms.toString() },
  })

  if (authorizationList) {
    state.emit({
      briefId: envelope.briefId as Hex,
      ts: Date.now(),
      kind: "operator.upgrade.7702.signed",
      specialistKind: envelope.specialistKind,
      details: { target: authorizationList[0]!.address },
    })
  }

  return { taskId }
}

async function awaitTaskConfirmed(args: {
  ctx: RouteContext
  taskId: Hex
  timeoutMs: number
}): Promise<{ hash?: Hex }> {
  const start = Date.now()
  while (Date.now() - start < args.timeoutMs) {
    const status = await args.ctx.oneShot.getStatus(args.taskId)
    if (status.status === 200) return { hash: status.receipt?.transactionHash }
    if (status.status >= 400) {
      throw new BrokerSettlementError(`relay terminal status ${status.status}: ${status.message ?? ""}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new BrokerSettlementError(`relay timed out after ${args.timeoutMs}ms`)
}

export const brokerRoute = new Hono()

brokerRoute.post("/venice/:specialistKind", async (c) => {
  const ctx = getContext()
  const kindParam = c.req.param("specialistKind") as SpecialistKind
  if (!SPECIALIST_KINDS.includes(kindParam)) return c.text("unknown specialist", 404)

  const envelope = parsePaymentHeader(c.req.header("x-payment") ?? c.req.header("X-PAYMENT") ?? null)
  if (!envelope) {
    return c.json(
      {
        x402Version: 1,
        error: "X-PAYMENT (marque-v1) header required",
        accepts: [
          {
            scheme: "marque-v1",
            network: "eip155:8453",
            description: `marque.run broker for venice ${SPECIALIST_TO_VENICE[kindParam]}`,
            payTo: ctx.brokerAddress,
            asset: USDC_BASE,
            maxTimeoutSeconds: 120,
          },
        ],
      },
      402,
    )
  }

  if (envelope.specialistKind !== kindParam) {
    throw new BrokerVerificationError("specialistKind mismatch between url and envelope")
  }

  const { taskId } = await relayDelegationRedemption({ ctx, envelope })
  const { hash } = await awaitTaskConfirmed({ ctx, taskId, timeoutMs: 90_000 })

  const veniceEndpoint = SPECIALIST_TO_VENICE[kindParam]
  const requestBody = (await c.req.json().catch(() => null)) as unknown
  if (requestBody === null) {
    throw new BrokerVerificationError("missing JSON body for venice call")
  }

  state.emit({
    briefId: envelope.briefId as Hex,
    ts: Date.now(),
    kind: "specialist.venice.request",
    specialistKind: kindParam,
    details: { veniceEndpoint, priceAtoms: envelope.amountAtoms },
  })

  const result = await runVenice(ctx.venice, kindParam, requestBody)

  state.emit({
    briefId: envelope.briefId as Hex,
    ts: Date.now(),
    kind: "specialist.venice.response",
    specialistKind: kindParam,
    details: { veniceEndpoint, contentType: result.contentType, settlementHash: hash },
  })

  if (result.json !== undefined) {
    return c.json({
      brokerSettlementTaskId: taskId,
      brokerSettlementTxHash: hash,
      contentType: result.contentType,
      data: result.json,
    })
  }

  return new Response(new Uint8Array(result.buffer!), {
    status: 200,
    headers: {
      "content-type": result.contentType,
      "x-broker-settlement-task": taskId,
      "x-broker-settlement-tx": hash ?? "",
    },
  })
})
