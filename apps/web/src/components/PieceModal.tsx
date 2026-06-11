"use client"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { Piece } from "@/lib/gallery"
import { shortTx } from "@/lib/format"

const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
}

const EXT_BY_KIND: Record<Piece["kind"], string> = { video: "mp4", audio: "mp3", image: "webp" }

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "marque-piece"
}

export function PieceModal({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [downloading, setDownloading] = useState(false)
  useEffect(() => setMounted(true), [])

  const download = async () => {
    if (!piece || downloading) return
    setDownloading(true)
    try {
      const res = await fetch(piece.mediaUrl)
      const blob = await res.blob()
      const ext = EXT_BY_TYPE[blob.type] ?? EXT_BY_KIND[piece.kind]
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${slug(piece.title)}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(piece.mediaUrl, "_blank", "noopener")
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!piece) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [piece, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {piece ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-bone/10 bg-ink-900/90 shadow-2xl"
          >
            <button
              aria-label="Close"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-bone/10 bg-ink-950/60 text-bone/70 backdrop-blur transition hover:border-brass/40 hover:text-bone"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
              <PieceMedia piece={piece} />
            </div>

            <div className="shrink-0 border-t border-bone/[0.06] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-bone">{piece.title}</h2>
                  <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-bone/55">{piece.description}</p>
                </div>
                <span className="pill-brass shrink-0 capitalize">{piece.template}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-bone/[0.06] pt-3 text-[11px]">
                <Meta label="spend" value={`$${piece.spendUsd}`} />
                {piece.mintedDate ? <Meta label="minted" value={piece.mintedDate} /> : null}
                {piece.sample ? (
                  <span className="pill text-[10px]">sample</span>
                ) : (
                  <Meta label="token" value={`#${piece.tokenId}`} />
                )}
                <div className="ml-auto flex items-center gap-3">
                  {piece.txHash ? (
                    <a
                      href={`https://basescan.org/tx/${piece.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-live hover:underline"
                    >
                      {shortTx(piece.txHash)}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M7 17 17 7M9 7h8v8" />
                      </svg>
                    </a>
                  ) : null}
                  <button
                    onClick={download}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-bone/10 bg-bone/[0.03] px-3 py-1.5 text-[11px] font-medium text-bone transition hover:border-brass/40 disabled:opacity-50"
                  >
                    {downloading ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
                      </svg>
                    )}
                    {downloading ? "Saving" : "Download"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

function PieceMedia({ piece }: { piece: Piece }) {
  if (piece.kind === "video") {
    return (
      <video
        src={piece.mediaUrl}
        poster={piece.posterUrl || undefined}
        controls
        autoPlay
        playsInline
        className="max-h-[70vh] w-full bg-black object-contain"
      />
    )
  }
  if (piece.kind === "audio") {
    return (
      <div className="flex w-full flex-col items-center gap-6 px-6 py-14">
        <div className="grid h-24 w-24 place-items-center rounded-2xl border border-brass/30 bg-brass/10">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c9a45c" strokeWidth="1.8">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <audio src={piece.mediaUrl} controls autoPlay className="w-full max-w-md" />
      </div>
    )
  }
  return (
    <img src={piece.mediaUrl} alt={piece.title} className="max-h-[70vh] w-full bg-black object-contain" />
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
