"use client"
import Link from "next/link"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { Logo } from "./Logo"
import { shortAddress } from "@/lib/format"
import { cn } from "@/lib/cn"

export function Header({ variant = "landing" }: { variant?: "landing" | "app" }) {
  const account = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const metamask = connectors.find((c) => c.id === "metaMask") ?? connectors[0]

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-neutral-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          {variant === "landing" ? (
            <>
              <Link
                href="https://github.com/wildanrhmn/marque.run"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                github
              </Link>
              <Link href="/run" className="btn-primary">
                launch app
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </>
          ) : account.isConnected && account.address ? (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "pill",
                  account.chainId === 8453 ? "text-emerald-300 border-emerald-500/30" : "text-amber-300 border-amber-500/30",
                )}
              >
                {account.chainId === 8453 ? "Base mainnet" : `chain ${account.chainId}`}
              </div>
              <div className="pill font-mono text-neutral-200">{shortAddress(account.address)}</div>
              <button className="btn-ghost" onClick={() => disconnect()}>
                disconnect
              </button>
            </div>
          ) : (
            <button
              className="btn-primary"
              disabled={isPending || !metamask}
              onClick={() => metamask && connect({ connector: metamask })}
            >
              {isPending ? "connecting…" : "connect MetaMask"}
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
