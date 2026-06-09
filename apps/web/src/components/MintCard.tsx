"use client"
import { cn } from "@/lib/cn"
import { shortTx } from "@/lib/format"

export interface MintCardProps {
  videoBlobUrl?: string
  poster?: string
  totalSpendUsdc: string
  txHash?: string
  isMinting: boolean
  minted: boolean
  onMint: () => void
}

export function MintCard({ videoBlobUrl, poster, totalSpendUsdc, txHash, isMinting, minted, onMint }: MintCardProps) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-bone/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-bone">final asset</span>
          <span className="pill-brass">{totalSpendUsdc} USDC spent</span>
        </div>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[3fr_2fr]">
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-bone/[0.08] bg-black">
          {videoBlobUrl ? (
            <video src={videoBlobUrl} className="h-full w-full object-cover" autoPlay loop muted playsInline controls />
          ) : poster ? (
            <img src={poster} alt="finished piece" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-slate-dim">
              <div className="flex flex-col items-center gap-3">
                <div className="shimmer h-2 w-32 rounded-full" />
                <span>compositing…</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between">
          <div className="space-y-2 text-sm text-bone/75">
            <p className="text-balance">
              The finished piece, assembled by the crew and settled on-chain in USDC. Mint it to
              hold the asset with a full record of every step that went into it.
            </p>
            <div className="rounded-lg border border-bone/[0.08] bg-bone/[0.02] p-3 font-mono text-[11px] text-slate">
              {txHash ? (
                <>
                  mint tx:{" "}
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-live hover:underline"
                  >
                    {shortTx(txHash)}
                  </a>
                </>
              ) : (
                <span className="text-slate-dim">not yet minted</span>
              )}
            </div>
          </div>
          <button
            className={cn("btn-primary shine-host mt-4", minted && "pointer-events-none opacity-70")}
            onClick={onMint}
            disabled={isMinting || !videoBlobUrl}
          >
            {minted ? "minted ✓" : isMinting ? "minting…" : "mint to operator wallet"}
          </button>
        </div>
      </div>
    </div>
  )
}
