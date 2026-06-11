"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
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
import { shortAddress } from "./format"
import { cn } from "./cn"

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address

interface StudioContextValue {
  sessionAddress: Address | null
  balanceAtoms: bigint
  balanceUsd: number
  busy: string | null
  error: string | null
  budget: SessionBudget | null
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
  const [depositUsd, setDepositUsd] = useState(2)

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
    ensureSession,
    ensureBudget,
    refresh,
    deposit,
    withdraw,
    openManage: () => setManageOpen(true),
  }

  return (
    <StudioContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {manageOpen ? (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button aria-label="Close" className="absolute inset-0 bg-ink-950/80 backdrop-blur-xl" onClick={() => setManageOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 w-full max-w-sm rounded-2xl border border-bone/10 bg-ink-900/95 p-6 shadow-2xl"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold text-bone">Your balance</h2>
                <span className="font-display text-2xl font-semibold text-bone">${(Number(balanceAtoms) / 1e6).toFixed(2)}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-bone/55">
                Your studio balance pays the agents as they work. Top it up, and withdraw whatever you do not spend.
                {session ? <span className="ml-1 font-mono text-bone/40">{shortAddress(session.address)}</span> : null}
              </p>

              <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-dim">Deposit</div>
              <div className="mt-2 flex gap-2">
                {[1, 2, 5, 10].map((a) => (
                  <button
                    key={a}
                    onClick={() => setDepositUsd(a)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-[13px] font-medium transition",
                      depositUsd === a ? "border-brass/50 bg-brass/10 text-brass" : "border-bone/[0.08] text-bone/70 hover:border-brass/30",
                    )}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <button
                className="btn-primary shine-host mt-3 h-11 w-full"
                onClick={() => deposit(depositUsd)}
                disabled={busy === "deposit" || !walletClient}
              >
                {busy === "deposit" ? "Depositing…" : `Deposit $${depositUsd.toFixed(2)}`}
              </button>

              {balanceAtoms > 0n ? (
                <button
                  className="mt-2 h-10 w-full rounded-lg border border-bone/10 text-[13px] font-medium text-bone/80 transition hover:border-brass/40 disabled:opacity-50"
                  onClick={withdraw}
                  disabled={busy === "withdraw"}
                >
                  {busy === "withdraw" ? "Withdrawing…" : "Withdraw all to my wallet"}
                </button>
              ) : null}

              {error ? (
                <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-center text-[11px] text-red-300">{error}</p>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </StudioContext.Provider>
  )
}
