"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useAccount, useWalletClient } from "wagmi"
import type { Address } from "viem"
import type { PrivateKeyAccount } from "viem/accounts"
import { deriveSessionAccount, loadCachedSessionAccount } from "./identities"
import {
  buildSessionBudget,
  sessionUsdcBalance,
  usdcTransferCalldata,
  waitForTx,
  withdrawSession,
  type SessionBudget,
} from "./smartaccount"

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address

interface StudioContextValue {
  sessionAddress: Address | null
  balanceAtoms: bigint
  balanceUsd: number
  busy: string | null
  error: string | null
  budget: SessionBudget | null
  manageOpen: boolean
  setManageOpen: (v: boolean) => void
  ensureSession: () => Promise<PrivateKeyAccount>
  ensureBudget: () => Promise<SessionBudget>
  refresh: () => Promise<void>
  deposit: (usd: number) => Promise<void>
  withdraw: () => Promise<void>
  openManage: () => void
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error("useStudio used outside StudioProvider")
  return ctx
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const account = useAccount()
  const { data: walletClient } = useWalletClient()
  const [session, setSession] = useState<PrivateKeyAccount | null>(null)
  const [balanceAtoms, setBalanceAtoms] = useState<bigint>(0n)
  const [budget, setBudget] = useState<SessionBudget | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)

  useEffect(() => {
    if (!account.address || session) return
    const cached = loadCachedSessionAccount(account.address)
    if (cached) {
      setSession(cached)
      sessionUsdcBalance(cached.address)
        .then(setBalanceAtoms)
        .catch(() => {})
    }
  }, [account.address, session])

  const refresh = async () => {
    if (!session) return
    try {
      setBalanceAtoms(await sessionUsdcBalance(session.address))
    } catch {
      /* ignore */
    }
  }

  const ensureSession = async (): Promise<PrivateKeyAccount> => {
    if (session) return session
    if (!account.address || !walletClient) throw new Error("Connect your wallet first")
    const s = await deriveSessionAccount(account.address, (m) => walletClient.signMessage({ message: m }))
    setSession(s)
    try {
      setBalanceAtoms(await sessionUsdcBalance(s.address))
    } catch {
      /* ignore */
    }
    return s
  }

  const ensureBudget = async (): Promise<SessionBudget> => {
    const s = await ensureSession()
    if (budget) return budget
    const bal = await sessionUsdcBalance(s.address)
    const b = await buildSessionBudget({ session: s, budgetAtoms: bal })
    setBudget(b)
    return b
  }

  const deposit = async (usd: number) => {
    if (!account.address || !walletClient) return
    setBusy("deposit")
    setError(null)
    try {
      const s = await ensureSession()
      const atoms = BigInt(Math.floor(usd * 1_000_000))
      const hash = await walletClient.sendTransaction({
        account: account.address,
        to: USDC_BASE,
        data: usdcTransferCalldata(s.address, atoms),
      })
      await waitForTx(hash)
      await refresh()
      setBudget(null)
      setManageOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const withdraw = async () => {
    if (!session || !account.address) return
    setBusy("withdraw")
    setError(null)
    try {
      await withdrawSession({ session, to: account.address })
      await refresh()
      setBudget(null)
      setManageOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const value: StudioContextValue = {
    sessionAddress: session?.address ?? null,
    balanceAtoms,
    balanceUsd: Number(balanceAtoms) / 1_000_000,
    busy,
    error,
    budget,
    manageOpen,
    setManageOpen,
    ensureSession,
    ensureBudget,
    refresh,
    deposit,
    withdraw,
    openManage: () => setManageOpen(true),
  }

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}
