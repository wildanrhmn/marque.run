"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAccount } from "wagmi"
import { Header } from "@/components/Header"
import { GradientMesh } from "@/components/GradientMesh"
import { TiltCard } from "@/components/TiltCard"
import { SealMark } from "@/components/SealMark"
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal"
import { PieceModal } from "@/components/PieceModal"
import { adPoster } from "@/lib/poster"
import { shortTx } from "@/lib/format"
import { cn } from "@/lib/cn"
import { fetchPieces, type Piece, type MediaKind } from "@/lib/gallery"
import { useStudio } from "@/lib/studio"

type Filter = "all" | MediaKind

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "image", label: "Image" },
]

export default function GalleryPage() {
  const account = useAccount()
  const studio = useStudio()
  const [pieces, setPieces] = useState<Piece[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Piece | null>(null)
  const studioAddress = studio.sessionAddress

  useEffect(() => {
    if (!studioAddress) {
      setPieces([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchPieces(studioAddress)
      .then((real) => {
        if (!cancelled) setPieces(real)
      })
      .catch(() => {
        if (!cancelled) setPieces([])
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [studioAddress])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: pieces.length, video: 0, audio: 0, image: 0 }
    for (const p of pieces) c[p.kind]++
    return c
  }, [pieces])

  const visible = useMemo(
    () => (filter === "all" ? pieces : pieces.filter((p) => p.kind === filter)),
    [pieces, filter],
  )

  const totalSpent = useMemo(
    () => pieces.reduce((a, b) => a + Number(b.spendUsd), 0).toFixed(2),
    [pieces],
  )

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
              Everything you have made.
            </h1>
            <p className="max-w-2xl text-bone/60">
              Each piece is an asset you hold, minted to your studio account with its media pinned to IPFS
              and a full record of what was made and what it cost.
            </p>
          </div>
        </Reveal>

        {!account.isConnected ? (
          <EmptyState
            title="Connect to see your collection"
            body="Your minted pieces live in your Marque studio account. Connect to load them here."
          />
        ) : !studioAddress ? (
          <div className="panel flex flex-col items-center gap-4 px-6 py-20 text-center">
            <SealMark size={48} className="opacity-70" />
            <div>
              <h2 className="font-display text-xl font-semibold text-bone">Open your studio account</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-bone/55">
                One signature loads your Marque studio account, where your pieces live.
              </p>
            </div>
            <button className="btn-primary shine-host mt-2" onClick={() => studio.ensureSession().catch(() => {})}>
              Open studio account
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Stat label="pieces" value={String(pieces.length)} />
              <Stat label="total spent" value={`$${totalSpent}`} />
              <Stat label="studio wallet" value={shortTx(studioAddress)} mono />
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                    filter === f.id
                      ? "border-brass/40 bg-brass/15 text-brass"
                      : "border-bone/[0.07] text-bone/60 hover:border-brass/30 hover:text-bone",
                  )}
                >
                  {f.label}
                  <span className="ml-1.5 text-[10px] opacity-60">{counts[f.id]}</span>
                </button>
              ))}
            </div>

            {loading && pieces.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="panel h-64 animate-pulse opacity-40" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                body="Run a crew and mint the result, and it will show up in your collection."
                cta
              />
            ) : (
              <RevealStagger key={filter} className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((piece, i) => (
                  <RevealItem key={`${piece.tokenId}-${piece.title}-${i}`}>
                    <PieceCard piece={piece} onClick={() => setSelected(piece)} />
                  </RevealItem>
                ))}
              </RevealStagger>
            )}
          </>
        )}
      </main>

      <PieceModal piece={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function PieceCard({ piece, onClick }: { piece: Piece; onClick: () => void }) {
  return (
    <TiltCard className="h-full rounded-[14px]">
      <button onClick={onClick} className="flex h-full w-full flex-col text-left">
        <article className="panel flex h-full flex-col overflow-hidden transition-colors hover:border-brass/25">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden border-b border-bone/[0.06] bg-black">
            <Thumb piece={piece} />
            <KindBadge kind={piece.kind} />
            {piece.images && piece.images.length > 1 ? (
              <span className="absolute right-2 top-2 rounded-md bg-ink-950/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-bone/70 backdrop-blur">
                {piece.images.length} images
              </span>
            ) : piece.sample ? (
              <span className="absolute right-2 top-2 rounded-md bg-ink-950/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-bone/60 backdrop-blur">
                sample
              </span>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-1 font-display text-base font-semibold text-bone">{piece.title}</h3>
              {!piece.sample ? <span className="pill-brass shrink-0">#{piece.tokenId}</span> : null}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-bone/55">{piece.description}</p>
            <div className="mt-auto flex items-center gap-4 border-t border-bone/[0.06] pt-3 text-[11px]">
              <Meta label="spend" value={`$${piece.spendUsd}`} />
              <Meta label="type" value={piece.template} />
              {piece.mintedDate ? <Meta label="minted" value={piece.mintedDate} /> : null}
            </div>
          </div>
        </article>
      </button>
    </TiltCard>
  )
}

function Thumb({ piece }: { piece: Piece }) {
  if (piece.kind === "image" && piece.images && piece.images.length > 1) {
    const imgs = piece.images.slice(0, 4)
    return (
      <div className={cn("grid h-full w-full gap-0.5", imgs.length >= 3 ? "grid-cols-2 grid-rows-2" : "grid-cols-2")}>
        {imgs.map((src, i) => (
          <img key={i} src={src} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
    )
  }
  if (piece.kind === "image" && piece.posterUrl) {
    return <img src={piece.posterUrl} alt={piece.title} className="h-full w-full object-cover" />
  }
  if (piece.kind === "video") {
    if (piece.posterUrl) {
      return (
        <>
          <img src={piece.posterUrl} alt={piece.title} className="h-full w-full object-cover" />
          <PlayGlyph />
        </>
      )
    }
    return (
      <>
        <video src={piece.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <PlayGlyph />
      </>
    )
  }
  if (piece.kind === "audio") {
    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brass/10 to-ink-950">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#c9a45c" strokeWidth="1.6" opacity="0.85">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    )
  }
  return <img src={adPoster(piece.title)} alt={piece.title} className="h-full w-full object-cover" />
}

function PlayGlyph() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-bone/20 bg-ink-950/50 backdrop-blur">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-bone">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  )
}

function KindBadge({ kind }: { kind: MediaKind }) {
  return (
    <span className="absolute left-2 top-2 rounded-md bg-ink-950/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-bone/70 backdrop-blur">
      {kind}
    </span>
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
      <div className="font-mono text-[11px] capitalize text-bone/80">{value}</div>
    </div>
  )
}
