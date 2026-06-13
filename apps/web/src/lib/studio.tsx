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

export interface ActivityItem {
  kind: "deposit" | "withdraw" | "spend"
  usd: number
  label: string
  ts: number
  hash?: string
}

interface StudioContextValue {
  sessionAddress: Address | null
  balanceAtoms: bigint
  balanceUsd: number
  busy: string | null
  error: string | null
  budget: SessionBudget | null
  manageOpen: boolean
  setManageOpen: (v: boolean) => void
  activity: ActivityItem[]
  recordActivity: (item: ActivityItem) => void
  ensureSession: () => Promise<PrivateKeyAccount>
  ensureBudget: () => Promise<SessionBudget>
  refresh: () => Promise<void>
  deposit: (usd: number) => Promise<void>
  withdraw: () => Promise<void>
  openManage: () => void
}

function activityKey(addr: string): string {
  return `marque.activity.${addr.toLowerCase()}`
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
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    if (!account.address) {
      setSession(null)
      setBalanceAtoms(0n)
      setBudget(null)
      setActivity([])
      setManageOpen(false)
      return
    }
    const cached = loadCachedSessionAccount(account.address)
    setBudget(null)
    if (cached) {
      setSession(cached)
      sessionUsdcBalance(cached.address)
        .then(setBalanceAtoms)
        .catch(() => {})
      try {
        const raw = window.localStorage.getItem(activityKey(cached.address))
        setActivity(raw ? (JSON.parse(raw) as ActivityItem[]) : [])
      } catch {
        /* ignore */
      }
    } else {
      setSession(null)
      setBalanceAtoms(0n)
      setActivity([])
    }
  }, [account.address])

  const recordActivity = (item: ActivityItem) => {
    setActivity((prev) => {
      const next = [item, ...prev].slice(0, 20)
      if (session) {
        try {
          window.localStorage.setItem(activityKey(session.address), JSON.stringify(next))
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }

  const refresh = async (addr?: Address, changedFrom?: bigint) => {
    const target = addr ?? session?.address
    if (!target) return
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const bal = await sessionUsdcBalance(target)
        setBalanceAtoms(bal)
        if (changedFrom === undefined || bal !== changedFrom) return
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 1500))
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
      const beforeAtoms = await sessionUsdcBalance(s.address)
      const atoms = BigInt(Math.floor(usd * 1_000_000))
      const hash = await walletClient.sendTransaction({
        account: account.address,
        to: USDC_BASE,
        data: usdcTransferCalldata(s.address, atoms),
      })
      await waitForTx(hash)
      await refresh(s.address, beforeAtoms)
      setBudget(null)
      recordActivity({ kind: "deposit", usd, label: "Deposit", ts: Date.now(), hash })
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
    const before = Number(balanceAtoms) / 1_000_000
    const beforeAtoms = balanceAtoms
    try {
      await withdrawSession({ session, to: account.address })
      await refresh(session.address, beforeAtoms)
      setBudget(null)
      recordActivity({ kind: "withdraw", usd: before, label: "Withdraw to wallet", ts: Date.now() })
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
    activity,
    recordActivity,
    ensureSession,
    ensureBudget,
    refresh,
    deposit,
    withdraw,
    openManage: () => setManageOpen(true),
  }

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}
