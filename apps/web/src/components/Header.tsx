"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
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

  return (
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
                  onClick={studio.openManage}
                  className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-brass/30 bg-brass/[0.07] px-3 transition hover:bg-brass/[0.14]"
                >
                  <span className="font-display text-[13px] font-semibold text-bone">${studio.balanceUsd.toFixed(2)}</span>
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-brass/25 text-[13px] leading-none text-brass">
                    +
                  </span>
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
  )
}
