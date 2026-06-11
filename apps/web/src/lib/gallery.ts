import { createPublicClient, http, parseAbiItem, type Address } from "viem"
import { base } from "viem/chains"
import { publicEnv } from "./env"

export type MediaKind = "video" | "audio" | "image"

export interface Piece {
  tokenId: number
  title: string
  description: string
  kind: MediaKind
  mediaUrl: string
  posterUrl: string
  spendUsd: string
  template: string
  txHash?: string
  mintedDate?: string
  sample?: boolean
}

interface MetaAttribute {
  trait_type: string
  value: string | number
}

interface PieceMetadata {
  name?: string
  description?: string
  animation_url?: string
  image?: string
  attributes?: MetaAttribute[]
}

const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY
const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_PINATA_GATEWAY_TOKEN
const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_MINT_DEPLOY_BLOCK ?? "0")

export function ipfsToHttp(uri?: string): string {
  if (!uri) return ""
  if (uri.startsWith("http")) return uri
  const cidPath = uri.replace(/^ipfs:\/\//, "")
  if (GATEWAY) {
    const host = GATEWAY.replace(/^https?:\/\//, "").replace(/\/+$/, "")
    const token = GATEWAY_TOKEN ? `?pinataGatewayToken=${GATEWAY_TOKEN}` : ""
    return `https://${host}/ipfs/${cidPath}${token}`
  }
  return `https://gateway.pinata.cloud/ipfs/${cidPath}`
}

function attr(meta: PieceMetadata, trait: string): string | undefined {
  const found = meta.attributes?.find((a) => a.trait_type === trait)
  return found ? String(found.value) : undefined
}

function kindFromMeta(meta: PieceMetadata): MediaKind {
  const tpl = attr(meta, "template")
  if (tpl === "music" || tpl === "voiceover") return "audio"
  if (tpl === "images") return "image"
  return "video"
}

const PIECE_MINTED = parseAbiItem(
  "event PieceMinted(uint256 indexed tokenId, bytes32 indexed briefId, address indexed operator, uint96 totalSpendAtoms, string ipfsUri)",
)

const client = createPublicClient({
  chain: base,
  transport: http(publicEnv.NEXT_PUBLIC_BASE_RPC_URL),
})

export const DUMMY_PIECES: Piece[] = [
  {
    tokenId: 0,
    title: "Aurelia Cold Brew",
    description:
      "A 15 second launch spot with brass-lit hero pours and a moody indie tempo, scored end to end.",
    kind: "video",
    mediaUrl: ipfsToHttp("ipfs://bafybeiged6fuymnxymwdmld73qnomev6vg4f5dmuruhp2luj4pre7olegy"),
    posterUrl: "",
    spendUsd: "1.92",
    template: "ad",
    mintedDate: "2026-06-11",
    sample: true,
  },
  {
    tokenId: 0,
    title: "Lumen Metals",
    description: "Studio macro image set, matte brass on black velvet, four variations.",
    kind: "image",
    mediaUrl: ipfsToHttp("ipfs://bafybeiftbmvk5y656d7y77ef55aymo7uasfmar3lhawdrfyydseyshsdku"),
    posterUrl: ipfsToHttp("ipfs://bafybeiftbmvk5y656d7y77ef55aymo7uasfmar3lhawdrfyydseyshsdku"),
    spendUsd: "0.20",
    template: "images",
    mintedDate: "2026-06-11",
    sample: true,
  },
]

export async function fetchPieces(owner: Address): Promise<Piece[]> {
  const contract = publicEnv.NEXT_PUBLIC_MINT_CONTRACT as Address
  if (contract === "0x0000000000000000000000000000000000000000") return []

  const logs = await client.getLogs({
    address: contract,
    event: PIECE_MINTED,
    args: { operator: owner },
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest",
  })

  const dateCache = new Map<string, string>()
  const resolveDate = async (blockNumber: bigint): Promise<string | undefined> => {
    const key = blockNumber.toString()
    if (dateCache.has(key)) return dateCache.get(key)
    try {
      const block = await client.getBlock({ blockNumber })
      const iso = new Date(Number(block.timestamp) * 1000).toISOString().slice(0, 10)
      dateCache.set(key, iso)
      return iso
    } catch {
      return undefined
    }
  }

  const pieces = await Promise.all(
    logs.map(async (log): Promise<Piece | null> => {
      try {
        const { tokenId, totalSpendAtoms, ipfsUri } = log.args
        if (tokenId === undefined || ipfsUri === undefined) return null
        const res = await fetch(ipfsToHttp(ipfsUri))
        if (!res.ok) return null
        const meta = (await res.json()) as PieceMetadata
        const kind = kindFromMeta(meta)
        const spend = totalSpendAtoms !== undefined ? (Number(totalSpendAtoms) / 1_000_000).toFixed(2) : "0.00"
        const mintedDate = log.blockNumber ? await resolveDate(log.blockNumber) : undefined
        return {
          tokenId: Number(tokenId),
          title: meta.name ?? `Piece #${Number(tokenId)}`,
          description: meta.description ?? "",
          kind,
          mediaUrl: ipfsToHttp(meta.animation_url),
          posterUrl: kind === "image" ? ipfsToHttp(meta.image ?? meta.animation_url) : ipfsToHttp(meta.image),
          spendUsd: spend,
          template: attr(meta, "template") ?? "ad",
          txHash: log.transactionHash ?? undefined,
          mintedDate,
        }
      } catch {
        return null
      }
    }),
  )

  return pieces.filter((p): p is Piece => p !== null).sort((a, b) => b.tokenId - a.tokenId)
}
