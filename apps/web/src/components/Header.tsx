"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { SealMark } from "./SealMark"
import { shortAddress } from "@/lib/format"
import { cn } from "@/lib/cn"
import { useStudio } from "@/lib/studio"

const BASE_CHAIN_ID = 8453

const NETWORK_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  84532: "Base Sepolia",
  10: "Optimism",
  137: "Polygon",
  42161: "Arbitrum",
  42220: "Celo",
}

function networkName(chainId?: number): string {
  if (!chainId) return "Unknown network"
  return NETWORK_NAMES[chainId] ?? "Unknown network"
}

const LANDING_NAV = [
  { href: "/#crew", label: "The crew" },
  { href: "/#how", label: "How it works" },
  { href: "/gallery", label: "Gallery" },
]

const APP_NAV = [
  { href: "/", label: "Home" },
  { href: "/run", label: "Console" },
  { href: "/gallery", label: "Gallery" },
]

function AnimatedNavLink({
  href,
  children,
  isActive,
}: {
  href: string
  children: React.ReactNode
  isActive: boolean
}) {
  return (
    <Link href={href} className="group relative block h-5 overflow-hidden text-sm">
      <span className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
        <span className={cn("flex h-5 items-center", isActive ? "text-bone" : "text-bone/60")}>
          {children}
        </span>
        <span className="flex h-5 items-center text-brass-bright">{children}</span>
      </span>
    </Link>
  )
}

export function Header({ variant = "landing" }: { variant?: "landing" | "app" }) {
  const pathname = usePathname()
  const account = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const studio = useStudio()
  const metamask = connectors.find((c) => c.id === "metaMask") ?? connectors[0]
  const navItems = variant === "landing" ? LANDING_NAV : APP_NAV
  const onBase = account.chainId === BASE_CHAIN_ID

  const [amount, setAmount] = useState(2)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!studio.manageOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && studio.setManageOpen(false)
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [studio])

  const copyStudio = async () => {
    if (!studio.sessionAddress) return
    try {
      await navigator.clipboard.writeText(studio.sessionAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
    <header
      className={cn(
        "fixed left-1/2 top-5 z-50 -translate-x-1/2",
        "flex h-14 items-center justify-between rounded-full border border-bone/[0.1] bg-ink-900/80 px-4 shadow-lg backdrop-blur-md",
        "w-[calc(100%-1.5rem)] max-w-4xl",
      )}
    >
      <div className="flex items-center pl-1">
        <Link href="/" aria-label="Marque home" className="flex items-center gap-2">
          <SealMark size={26} />
          <span className="font-display text-[15px] font-semibold tracking-tight text-bone">Marque</span>
        </Link>
      </div>

      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 sm:flex">
        {navItems.map((link) => (
          <AnimatedNavLink
            key={link.href}
            href={link.href}
            isActive={
              pathname === link.href || (link.href === "/gallery" && pathname.startsWith("/gallery"))
            }
          >
            {link.label}
          </AnimatedNavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        {variant === "landing" ? (
          <Link href="/run" className="btn-primary shine-host h-9 px-4 text-[13px]">
            Launch
          </Link>
        ) : account.isConnected && account.address ? (
          <>
            {!onBase ? (
              <button
                onClick={() => switchChain({ chainId: BASE_CHAIN_ID })}
                disabled={isSwitching}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brass/40 bg-brass/[0.08] px-3 text-[12px] text-brass transition-colors hover:bg-brass/[0.16]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                {isSwitching ? "Switching…" : "Switch to Base"}
              </button>
            ) : variant === "app" ? (
              !studio.sessionAddress ? (
                <button
                  onClick={() => studio.ensureSession().catch(() => {})}
                  className="inline-flex h-9 items-center rounded-full bg-white px-3.5 text-[12px] font-medium text-neutral-950 transition hover:bg-white/90"
                >
                  Set up account
                </button>
              ) : (
                <button
                  onClick={() => studio.setManageOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-brass/30 bg-brass/[0.07] px-3.5 transition hover:bg-brass/[0.14]"
                >
                  <span className="font-display text-[13px] font-semibold text-bone">${studio.balanceUsd.toFixed(2)}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brass/80">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              )
            ) : null}
            <button
              onClick={() => disconnect()}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-bone/[0.1] bg-bone/[0.03] px-3 transition-colors hover:border-brass/30"
              title={`${networkName(account.chainId)} · click to disconnect`}
            >
              <span className="h-2 w-2 rounded-full bg-live shadow-glow-live" />
              <span className="hidden font-mono text-xs text-bone/80 sm:inline">{shortAddress(account.address)}</span>
            </button>
          </>
        ) : (
          <button
            className="btn-primary shine-host h-9 px-4 text-[13px]"
            disabled={isPending || !metamask}
            onClick={() => metamask && connect({ connector: metamask })}
          >
            {isPending ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </header>

      <AnimatePresence>
        {studio.manageOpen && studio.sessionAddress ? (
          <>
            <motion.button
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => studio.setManageOpen(false)}
              className="fixed inset-0 z-[190] bg-ink-950/70 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 z-[200] flex h-full w-full max-w-[380px] flex-col border-l border-bone/10 bg-ink-900/95 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between px-6 pb-4 pt-6">
                <span className="font-display text-base font-semibold text-bone">Your balance</span>
                <button
                  onClick={() => studio.setManageOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-bone/50 transition hover:bg-bone/[0.06] hover:text-bone"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="font-display text-[44px] font-semibold leading-none text-bone">${studio.balanceUsd.toFixed(2)}</div>
                <button
                  onClick={copyStudio}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-bone/10 bg-bone/[0.03] px-3 py-1.5 font-mono text-[11px] text-bone/65 transition hover:border-brass/30 hover:text-bone"
                >
                  {shortAddress(studio.sessionAddress)}
                  {copied ? (
                    <span className="text-[10px] uppercase tracking-[0.1em] text-live">copied</span>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                  )}
                </button>

                <div className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-dim">Add funds</div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[5, 10, 25, 50].map((a) => (
                    <button
                      key={a}
                      onClick={() => setAmount(a)}
                      className={cn(
                        "rounded-xl border py-2.5 text-[13px] font-semibold transition",
                        amount === a ? "border-brass/50 bg-brass/10 text-brass" : "border-bone/[0.08] text-bone/65 hover:border-brass/30",
                      )}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-bone/[0.08] bg-bone/[0.02] px-3.5">
                  <span className="text-[15px] text-slate-dim">$</span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-transparent py-3 text-[16px] font-medium text-bone outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[12px] text-slate-dim">USDC</span>
                </div>
                <button
                  className="btn-primary shine-host mt-3 h-12 w-full text-[14px]"
                  onClick={() => studio.deposit(amount)}
                  disabled={studio.busy === "deposit" || amount <= 0}
                >
                  {studio.busy === "deposit" ? "Depositing…" : `Deposit $${amount.toFixed(2)}`}
                </button>
                {studio.error ? (
                  <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-center text-[11px] text-red-300">{studio.error}</p>
                ) : null}

                {studio.activity.length > 0 ? (
                  <div className="mt-8">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-dim">Recent</div>
                    <ul className="mt-3 space-y-1">
                      {studio.activity.map((a, i) => (
                        <li key={`${a.ts}-${i}`} className="flex items-center justify-between rounded-lg px-1 py-2 text-[12.5px]">
                          <span className="flex items-center gap-2.5 text-bone/75">
                            <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[13px]", a.kind === "deposit" ? "bg-live/10 text-live" : a.kind === "withdraw" ? "bg-bone/[0.06] text-bone/70" : "bg-brass/10 text-brass")}>
                              {a.kind === "deposit" ? "↓" : a.kind === "withdraw" ? "↑" : "◆"}
                            </span>
                            {a.label}
                          </span>
                          <span className={cn("font-mono", a.kind === "deposit" ? "text-live" : "text-bone/60")}>
                            {a.kind === "deposit" ? "+" : "−"}${a.usd.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {studio.balanceAtoms > 0n ? (
                <div className="border-t border-bone/[0.06] px-6 py-4">
                  <button
                    className="h-11 w-full rounded-xl text-[13px] font-medium text-bone/55 transition hover:text-bone disabled:opacity-50"
                    onClick={studio.withdraw}
                    disabled={studio.busy === "withdraw"}
                  >
                    {studio.busy === "withdraw" ? "Withdrawing…" : `Withdraw $${studio.balanceUsd.toFixed(2)} to my wallet`}
                  </button>
                </div>
              ) : null}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
