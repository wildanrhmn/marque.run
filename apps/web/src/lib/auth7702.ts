import { type Address, type Hex, toHex, pad } from "viem"
import type { PrivateKeyAccount } from "viem/accounts"

export interface AuthorizationListEntry {
  chainId: string
  contractAddress: Address
  nonce: Hex
  signature: Hex
}

interface NonceReader {
  getTransactionCount: (args: { address: Address; blockTag?: "latest" | "pending" }) => Promise<number>
}

export interface SignSpecialistAuthorizationArgs {
  specialist: PrivateKeyAccount
  publicClient: NonceReader
  contractAddress: Address
  chainId: number
}

export async function signSpecialistAuthorization(
  args: SignSpecialistAuthorizationArgs,
): Promise<AuthorizationListEntry> {
  const nonce = await args.publicClient.getTransactionCount({
    address: args.specialist.address,
    blockTag: "pending",
  })

  const signer = args.specialist as unknown as {
    signAuthorization?: (input: {
      chainId: number
      contractAddress: Address
      nonce: number
    }) => Promise<{ r: Hex; s: Hex; v?: bigint; yParity?: number }>
  }
  if (typeof signer.signAuthorization !== "function") {
    throw new Error("PrivateKeyAccount.signAuthorization unavailable; needs viem >= 2.21")
  }
  const signed = await signer.signAuthorization({
    chainId: args.chainId,
    contractAddress: args.contractAddress,
    nonce,
  })

  const yParity = signed.yParity ?? Number((signed.v ?? 0n) - 27n)
  const vByte = yParity === 0 ? "1b" : "1c"
  const signature = `${signed.r}${signed.s.slice(2)}${vByte}` as Hex

  return {
    chainId: args.chainId.toString(),
    contractAddress: args.contractAddress,
    nonce: pad(toHex(nonce), { size: 32 }),
    signature,
  }
}

const SESSION_FLAG_KEY = "marque.specialist-upgraded.v1"

export function markSpecialistUpgraded(address: Address): void {
  if (typeof window === "undefined") return
  const set = new Set(JSON.parse(window.localStorage.getItem(SESSION_FLAG_KEY) ?? "[]") as string[])
  set.add(address.toLowerCase())
  window.localStorage.setItem(SESSION_FLAG_KEY, JSON.stringify([...set]))
}

export function isSpecialistUpgraded(address: Address): boolean {
  if (typeof window === "undefined") return false
  try {
    const set = new Set(JSON.parse(window.localStorage.getItem(SESSION_FLAG_KEY) ?? "[]") as string[])
    return set.has(address.toLowerCase())
  } catch {
    return false
  }
}
