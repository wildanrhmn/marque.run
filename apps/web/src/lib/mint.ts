"use client"
import { parseAbi, type Address, type Hex } from "viem"

export const MARQUE_PIECE_ABI = parseAbi([
  "function mintPiece(address to, bytes32 briefId, uint96 totalSpendAtoms, bytes32[] settlementTxHashes, string ipfsUri) returns (uint256)",
  "event PieceMinted(uint256 indexed tokenId, bytes32 indexed briefId, address indexed operator, uint96 totalSpendAtoms, string ipfsUri)",
])

export interface MintArgs {
  to: Address
  briefId: Hex
  totalSpendAtoms: bigint
  settlementTxHashes: Hex[]
  uri: string
}

export function mintArgsForWagmi(args: MintArgs) {
  return {
    abi: MARQUE_PIECE_ABI,
    functionName: "mintPiece" as const,
    args: [args.to, args.briefId, args.totalSpendAtoms, args.settlementTxHashes, args.uri] as const,
  }
}
