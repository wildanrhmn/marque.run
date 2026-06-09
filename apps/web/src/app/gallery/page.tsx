"use client"
import Link from "next/link"
import { useAccount } from "wagmi"
import { Header } from "@/components/Header"
import { GradientMesh } from "@/components/GradientMesh"
import { TiltCard } from "@/components/TiltCard"
import { SealMark } from "@/components/SealMark"
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal"
import { adPoster } from "@/lib/poster"
import { shortTx } from "@/lib/format"

interface Ad {
  id: number
  title: string
  brief: string
  spendUsdc: string
  durationS: number
  mintedOn: string
  tokenId: number
  txHash: string
}

const MOCK_ADS: Ad[] = [
  {
    id: 1,
    title: "Lichen Cold Brew",
    brief: "30s ad for a cold brew brand called Lichen, moody indie tone",
    spendUsdc: "2.00",
    durationS: 30,
    mintedOn: "2026-05-19",
    tokenId: 4,
    txHash: "0x9c1f4a7b2e8d05c63a1b4f80e2d9a3c6b5e7f10428d6c91aa3f0b7e2c4d6815ab",
  },
  {
    id: 2,
    title: "Wavelength DAW",
    brief: "30s ad for an open-source DAW called Wavelength, retro arcade vibe",
    spendUsdc: "2.50",
    durationS: 35,
    mintedOn: "2026-05-18",
    tokenId: 3,
    txHash: "0x3a91cf7e20bb4d6815aa2c9e0f1d83b7c4e62a55c7df47158725c0cc407b5382",
  },
  {
    id: 3,
    title: "Husk Vegan Jerky",
    brief: "30s ad for a vegan jerky brand called Husk, gritty desert aesthetic",
    spendUsdc: "1.75",
    durationS: 30,
    mintedOn: "2026-05-16",
    tokenId: 2,
    txHash: "0xc4e7b1f93aa0d2658c1e40b7d96f2a8b35e10c72b9d03e5c7a1b4f80e2d9a3c6",
  },
  {
    id: 4,
    title: "Anchor Savings",
    brief: "30s ad for a neobank called Anchor, calm and trustworthy",
    spendUsdc: "2.25",
    durationS: 30,
    mintedOn: "2026-05-14",
    tokenId: 1,
    txHash: "0x52b68e5580726e648ac64c459528ac698cbd7e3168071b4e56f746313528a669",
  },
]

export default function GalleryPage() {
  const account = useAccount()
  const ads = account.isConnected ? MOCK_ADS : []

  return (
    <>
      <Header variant="app" />
      <div className="fixed inset-0 -z-10">
        <GradientMesh />
      </div>
      <main className="relative mx-auto max-w-6xl px-6 pb-20 pt-28">
        <Reveal>
          <div className="mb-10 flex flex-col gap-3">
            <span className="pill w-fit">your collection</span>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
              Everything your crews have made.
            </h1>
            <p className="max-w-2xl text-bone/60">
              Each piece is an asset you hold, minted to your wallet with a full record of what was
              made and what it cost.
            </p>
          </div>
        </Reveal>

        {!account.isConnected ? (
          <EmptyState
            title="Connect to see your collection"
            body="Your minted pieces live in your wallet. Connect to load them here."
          />
        ) : ads.length === 0 ? (
          <EmptyState
            title="Nothing minted yet"
            body="Run a crew and mint the result, and it will show up here."
            cta
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-3">
              <Stat label="pieces" value={String(ads.length)} />
              <Stat label="total spent" value={`$${ads.reduce((a, b) => a + Number(b.spendUsdc), 0).toFixed(2)}`} />
              <Stat label="wallet" value={shortTx(account.address ?? "")} mono />
            </div>
            <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ads.map((ad) => (
                <RevealItem key={ad.id}>
                  <TiltCard className="rounded-[14px]">
                    <article className="panel h-full overflow-hidden">
                      <div className="aspect-video w-full overflow-hidden border-b border-bone/[0.06]">
                        <img src={adPoster(ad.title)} alt={ad.title} className="h-full w-full object-cover" />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-base font-semibold text-bone">{ad.title}</h3>
                          <span className="pill-brass shrink-0">#{ad.tokenId}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-bone/55">
                          {ad.brief}
                        </p>
                        <div className="mt-4 flex items-center justify-between border-t border-bone/[0.06] pt-3">
                          <div className="flex gap-4 text-[11px]">
                            <Meta label="spend" value={`$${ad.spendUsdc}`} />
                            <Meta label="length" value={`${ad.durationS}s`} />
                            <Meta label="minted" value={ad.mintedOn} />
                          </div>
                        </div>
                        <a
                          href={`https://basescan.org/tx/${ad.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-live hover:underline"
                        >
                          {shortTx(ad.txHash)}
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M7 17 17 7M9 7h8v8" />
                          </svg>
                        </a>
                      </div>
                    </article>
                  </TiltCard>
                </RevealItem>
              ))}
            </RevealStagger>
          </>
        )}
      </main>
    </>
  )
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="panel flex flex-col items-center gap-4 px-6 py-20 text-center">
      <SealMark size={48} className="opacity-70" />
      <div>
        <h2 className="font-display text-xl font-semibold text-bone">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-bone/55">{body}</p>
      </div>
      {cta ? (
        <Link href="/run" className="btn-primary shine-host mt-2">
          launch a crew
        </Link>
      ) : null}
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="panel-plain px-4 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-dim">{label}</div>
      <div className={mono ? "font-mono text-sm text-bone" : "text-sm font-semibold text-bone"}>{value}</div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-dim">{label}</div>
      <div className="font-mono text-[11px] text-bone/80">{value}</div>
    </div>
  )
}
