import { Hono } from "hono"
import { z } from "zod"
import { createWalletClient, http, keccak256, parseAbi, toHex, type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"
import { loadEnv } from "../env"
import { logger } from "../log"
import { pinataEnabled, pinBuffer, pinJson } from "../pinata"

const MARQUE_PIECE_ABI = parseAbi([
  "function mintPiece(address to, bytes32 briefId, uint96 totalSpendAtoms, bytes32[] settlementTxHashes, string ipfsUri) returns (uint256)",
])

const BodySchema = z.object({
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenUri: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  base64: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  template: z.string().optional(),
  briefId: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  spentUsd: z.number().optional(),
  settlementHashes: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)).optional(),
})

function extFor(contentType: string): string {
  if (contentType.includes("image")) return "webp"
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3"
  if (contentType.includes("audio")) return "wav"
  if (contentType.includes("video")) return "mp4"
  return "bin"
}

export const mintRoute = new Hono()

mintRoute.post("/", async (c) => {
  const env = loadEnv()
  if (!env.MARQUE_PIECE_ADDRESS) return c.json({ error: "mint contract not configured" }, 400)

  const json = await c.req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.flatten() }, 400)
  const body = parsed.data

  let tokenUri = body.tokenUri
  let assetCid: string | undefined
  let metadataCid: string | undefined

  if (!tokenUri) {
    if (!pinataEnabled()) return c.json({ error: "pinata not configured" }, 400)
    if (!body.base64 || !body.contentType || !body.name) {
      return c.json({ error: "tokenUri or (base64 + contentType + name) required" }, 400)
    }
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "marque-piece"
    const assetBuf = Buffer.from(body.base64, "base64")
    const assetPin = await pinBuffer(assetBuf, `${slug}.${extFor(body.contentType)}`, body.contentType)
    const metadata = {
      name: body.name,
      description: body.description ?? "",
      image: assetPin.ipfsUri,
      animation_url: assetPin.ipfsUri,
      attributes: [
        ...(body.template ? [{ trait_type: "template", value: body.template }] : []),
        ...(body.spentUsd != null ? [{ trait_type: "spend_usd", value: body.spentUsd }] : []),
      ],
    }
    const metaPin = await pinJson(metadata, `meta-${slug}`)
    tokenUri = metaPin.ipfsUri
    assetCid = assetPin.cid
    metadataCid = metaPin.cid
  }

  const briefId = (body.briefId ?? keccak256(toHex(`${body.recipient}|${tokenUri}`))) as Hex
  const settlements = (
    body.settlementHashes && body.settlementHashes.length > 0 ? body.settlementHashes : [briefId]
  ) as Hex[]
  const spendAtoms = BigInt(Math.floor((body.spentUsd ?? 0) * 1_000_000))

  const float = privateKeyToAccount(env.BROKER_FLOAT_PRIVATE_KEY)
  const wallet = createWalletClient({ account: float, chain: base, transport: http(env.BASE_RPC_URL) })

  let txHash: Hex
  try {
    txHash = await wallet.writeContract({
      address: env.MARQUE_PIECE_ADDRESS as Address,
      abi: MARQUE_PIECE_ABI,
      functionName: "mintPiece",
      args: [body.recipient as Address, briefId, spendAtoms, settlements, tokenUri],
    })
  } catch (err) {
    logger.error({ err: (err as Error).message }, "mint failed")
    return c.json({ error: `mint failed: ${(err as Error).message}` }, 500)
  }

  logger.info({ txHash, recipient: body.recipient, tokenUri, assetCid }, "minted MarquePiece")
  return c.json({ txHash, tokenUri, assetCid, metadataCid })
})
