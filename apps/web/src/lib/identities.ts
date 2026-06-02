"use client"
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import type { Address, Hex } from "viem"
import type { SpecialistKind } from "@marque/shared"

const STORAGE_KEY = "marque.session.v1"

interface SessionIdentities {
  directorKey: Hex
  specialistKey: Hex
}

let cached: { director: PrivateKeyAccount; specialist: PrivateKeyAccount } | null = null

function load(): SessionIdentities | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionIdentities
  } catch {
    return null
  }
}

function persist(identities: SessionIdentities): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identities))
}

export function getSessionIdentities(): { director: PrivateKeyAccount; specialist: PrivateKeyAccount } {
  if (cached) return cached
  const existing = load()
  const directorKey = existing?.directorKey ?? generatePrivateKey()
  const specialistKey = existing?.specialistKey ?? generatePrivateKey()
  if (!existing) persist({ directorKey, specialistKey })
  cached = {
    director: privateKeyToAccount(directorKey),
    specialist: privateKeyToAccount(specialistKey),
  }
  return cached
}

export function clearSessionIdentities(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
  cached = null
}

export function describeAgentAddress(kind: SpecialistKind | "director" | "specialist"): Address {
  const ids = getSessionIdentities()
  if (kind === "director") return ids.director.address
  return ids.specialist.address
}
