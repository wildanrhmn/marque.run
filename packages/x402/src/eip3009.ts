import { type Address, type Hex, getAddress, hexToBytes, bytesToHex } from "viem"
import type { LocalAccount } from "viem/accounts"
import { BASE_CHAIN_ID, USDC_BASE, USDC_EIP712_NAME, USDC_EIP712_VERSION } from "@marque/shared"
import type { Eip3009Authorization, ExactEvmPayload, PaymentPayload } from "./types"

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const

export interface BuildEip3009Args {
  account: LocalAccount
  to: Address
  valueAtoms: bigint
  validAfter?: number
  validBefore?: number
  nonce?: Hex
  asset?: Address
  chainId?: number
  name?: string
  version?: string
}

export interface BuildEip3009Result {
  authorization: Eip3009Authorization
  signature: Hex
  payload: ExactEvmPayload
  paymentPayload: PaymentPayload
}

function randomBytes32(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function buildEip3009Payment(args: BuildEip3009Args): Promise<BuildEip3009Result> {
  const now = Math.floor(Date.now() / 1000)
  const validAfter = args.validAfter ?? now - 5
  const validBefore = args.validBefore ?? now + 300
  const nonce = args.nonce ?? randomBytes32()
  const asset = args.asset ?? USDC_BASE
  const chainId = args.chainId ?? BASE_CHAIN_ID
  const name = args.name ?? USDC_EIP712_NAME
  const version = args.version ?? USDC_EIP712_VERSION

  const authorization: Eip3009Authorization = {
    from: getAddress(args.account.address),
    to: getAddress(args.to),
    value: args.valueAtoms.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  }

  const signature = await args.account.signTypedData({
    domain: { name, version, chainId, verifyingContract: asset },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  })

  const payload: ExactEvmPayload = { signature, authorization }
  const paymentPayload: PaymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: chainId === BASE_CHAIN_ID ? "eip155:8453" : "eip155:84532",
    payload,
  }

  return { authorization, signature, payload, paymentPayload }
}

export function splitSignature(sig: Hex): { r: Hex; s: Hex; v: number } {
  const bytes = hexToBytes(sig)
  if (bytes.length !== 65) throw new Error(`signature wrong length: ${bytes.length}`)
  return {
    r: bytesToHex(bytes.slice(0, 32)),
    s: bytesToHex(bytes.slice(32, 64)),
    v: bytes[64]!,
  }
}
