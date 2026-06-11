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
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (!session) return
    try {
      await navigator.clipboard.writeText(session.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

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
              style={{ padding: "28px" }}
              className="relative z-10 w-full max-w-sm rounded-2xl border border-bone/10 bg-ink-900/95 shadow-2xl"
            >
              <button
                aria-label="Close"
                onClick={() => setManageOpen(false)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-bone/50 transition hover:bg-bone/[0.06] hover:text-bone"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-dim">Marque balance</div>
              <div className="mt-1 font-display text-[44px] font-semibold leading-none text-bone">
                ${(Number(balanceAtoms) / 1e6).toFixed(2)}
              </div>

              {session ? (
                <button
                  onClick={copyAddress}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-bone/10 bg-bone/[0.03] px-3 py-1.5 font-mono text-[11px] text-bone/70 transition hover:border-brass/30 hover:text-bone"
                >
                  {shortAddress(session.address)}
                  {copied ? (
                    <span className="text-[10px] uppercase tracking-[0.1em] text-live">copied</span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                  )}
                </button>
              ) : null}

              <div className="mt-6 grid grid-cols-4 gap-2.5">
                {[1, 2, 5, 10].map((a) => (
                  <button
                    key={a}
                    onClick={() => setDepositUsd(a)}
                    className={cn(
                      "rounded-xl border py-2.5 text-[14px] font-semibold transition",
                      depositUsd === a
                        ? "border-brass/50 bg-brass/10 text-brass"
                        : "border-bone/[0.08] text-bone/70 hover:border-brass/30 hover:text-bone",
                    )}
                  >
                    ${a}
                  </button>
                ))}
              </div>

              <button
                className="btn-primary shine-host mt-4 h-12 w-full text-[14px]"
                onClick={() => deposit(depositUsd)}
                disabled={busy === "deposit" || !walletClient}
              >
                {busy === "deposit" ? "Depositing…" : `Deposit $${depositUsd.toFixed(2)}`}
              </button>

              {balanceAtoms > 0n ? (
                <button
                  className="mt-2.5 flex h-12 w-full items-center justify-center rounded-xl border border-bone/12 text-[13.5px] font-medium text-bone/85 transition hover:border-brass/40 hover:text-bone disabled:opacity-50"
                  onClick={withdraw}
                  disabled={busy === "withdraw"}
                >
                  {busy === "withdraw" ? "Withdrawing…" : `Withdraw $${(Number(balanceAtoms) / 1e6).toFixed(2)} to my wallet`}
                </button>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-center text-[11px] text-red-300">{error}</p>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </StudioContext.Provider>
  )
}
