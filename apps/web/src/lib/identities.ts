"use client"
import { keccak256, type Address, type Hex } from "viem"
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"

const DERIVE_MESSAGE =
  "Marque session account v1\n\nSign to derive your in-browser agent budget account. This is a signature only, it costs nothing and authorizes no transfer."

function storageKey(owner: Address): string {
  return `marque.session.${owner.toLowerCase()}`
}

const cache = new Map<string, PrivateKeyAccount>()

export async function deriveSessionAccount(
  owner: Address,
  signMessage: (message: string) => Promise<Hex>,
): Promise<PrivateKeyAccount> {
  const key = owner.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKey(owner)) : null
  let priv: Hex
  if (stored) {
    priv = stored as Hex
  } else {
    const signature = await signMessage(DERIVE_MESSAGE)
    priv = keccak256(signature)
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey(owner), priv)
  }
  const account = privateKeyToAccount(priv)
  cache.set(key, account)
  return account
}

export function getCachedSessionAccount(owner: Address): PrivateKeyAccount | null {
  return cache.get(owner.toLowerCase()) ?? null
}

export function forgetSessionAccount(owner: Address): void {
  cache.delete(owner.toLowerCase())
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(owner))
}
