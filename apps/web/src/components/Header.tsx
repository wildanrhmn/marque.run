"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { SealMark } from "./SealMark"
import { shortAddress } from "@/lib/format"
import { cn } from "@/lib/cn"

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

function formatBalance(value?: { formatted: string; symbol: string }): string {
  if (!value) return "—"
  const n = parseFloat(value.formatted)
  const shown = n === 0 ? "0" : n < 0.0001 ? "<0.0001" : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
  return `${shown} ${value.symbol}`
}

const LANDING_NAV = [
  { href: "/#crew", label: "The crew" },
  { href: "/#how", label: "How it works" },
  { href: "/gallery", label: "Gallery" },
]

const APP_NAV = [
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
  const { data: balance } = useBalance({ address: account.address })
  const metamask = connectors.find((c) => c.id === "metaMask") ?? connectors[0]
  const navItems = variant === "landing" ? LANDING_NAV : APP_NAV
  const onBase = account.chainId === BASE_CHAIN_ID

  return (
    <header
      className={cn(
        "fixed left-1/2 top-5 z-50 -translate-x-1/2",
        "flex h-14 items-center gap-x-4 rounded-full border border-bone/[0.1] bg-ink-900/80 px-3 shadow-lg backdrop-blur-md sm:gap-x-6 sm:px-4",
        "w-[calc(100%-1.5rem)] sm:w-auto",
      )}
    >
      <Link href="/" className="flex items-center pl-1" aria-label="Marque home">
        <SealMark size={26} />
      </Link>

      <nav className="hidden items-center gap-6 sm:flex">
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
            {onBase ? (
              <span className="hidden h-9 items-center gap-1.5 rounded-full border border-live/30 px-3 text-[12px] text-live sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-live shadow-glow-live" />
                {networkName(account.chainId)}
              </span>
            ) : (
              <button
                onClick={() => switchChain({ chainId: BASE_CHAIN_ID })}
                disabled={isSwitching}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brass/40 bg-brass/[0.08] px-3 text-[12px] text-brass transition-colors hover:bg-brass/[0.16]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                {isSwitching ? "Switching…" : `${networkName(account.chainId)} · Switch to Base`}
              </button>
            )}
            {onBase ? (
              <span className="hidden h-9 items-center rounded-full border border-bone/[0.1] bg-bone/[0.03] px-3 font-mono text-xs text-bone/80 md:inline-flex">
                {formatBalance(balance)}
              </span>
            ) : null}
            <button
              onClick={() => disconnect()}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-bone/[0.1] bg-bone/[0.03] px-3 transition-colors hover:border-brass/30"
            >
              <span className="h-2 w-2 rounded-full bg-live shadow-glow-live" />
              <span className="font-mono text-xs text-bone/80">{shortAddress(account.address)}</span>
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
