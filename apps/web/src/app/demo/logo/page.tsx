"use client"
import { useRef, useState } from "react"
import { MARKS, type MarkId } from "@/components/logo/marque-marks"
import { cn } from "@/lib/cn"

export default function LogoDemoPage() {
  const [selected, setSelected] = useState<MarkId>("seal")
  const current = MARKS.find((m) => m.id === selected)!

  return (
    <div className="min-h-screen bg-ink-950 text-bone">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-brass">Demo · branding</div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-bone">Marque identity</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone/55">
          Four directions for the mark, all in the brass-on-ink hallmark language. &ldquo;Marque&rdquo; is a maker&apos;s mark,
          so every option reads as something struck or sealed into metal. Pick one below and export the 1024&times;1024
          submission asset; I&apos;ll then wire it through the header, favicon, and the rest of the app.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {MARKS.map((opt) => {
            const Mark = opt.Mark
            const active = opt.id === selected
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={cn(
                  "group rounded-2xl border p-5 text-left transition-colors",
                  active ? "border-brass/50 bg-brass/[0.06]" : "border-bone/10 bg-ink-900/40 hover:border-brass/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-semibold text-bone">{opt.label}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                      active ? "border-brass/50 text-brass" : "border-bone/15 text-bone/40",
                    )}
                  >
                    {active ? "selected" : "select"}
                  </span>
                </div>
                <p className="mt-1.5 min-h-[40px] text-[12px] leading-relaxed text-bone/50">{opt.sub}</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex h-28 items-center justify-center rounded-xl bg-ink-950">
                    <Mark size={64} className="text-brass" />
                  </div>
                  <div className="flex h-28 items-center justify-center rounded-xl bg-bone">
                    <Mark size={64} className="text-ink-950" />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-bone/10 bg-ink-950/60 px-4 py-3">
                  <Mark size={24} className="text-bone" />
                  <span className="font-display text-[15px] font-semibold tracking-[0.02em] text-bone">marque</span>
                  <span className="ml-auto flex items-center gap-3 text-bone/40">
                    {[16, 20, 28].map((s) => (
                      <Mark key={s} size={s} className="text-brass/80" />
                    ))}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <Submission id={selected} label={current.label} />
      </div>
    </div>
  )
}

function Submission({ id, label }: { id: MarkId; label: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [busy, setBusy] = useState(false)

  const exportPng = async () => {
    if (!svgRef.current || busy) return
    setBusy(true)
    try {
      const xml = new XMLSerializer().serializeToString(svgRef.current)
      const svg = `<?xml version="1.0" encoding="UTF-8"?>${xml}`
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("svg load failed"))
        img.src = url
      })
      const canvas = document.createElement("canvas")
      canvas.width = 1024
      canvas.height = 1024
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("canvas unavailable")
      ctx.drawImage(img, 0, 0, 1024, 1024)
      URL.revokeObjectURL(url)
      const a = document.createElement("a")
      a.href = canvas.toDataURL("image/png")
      a.download = `marque-logo-${id}-1024.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      window.alert("PNG export failed — use the SVG download and convert in any browser.")
    } finally {
      setBusy(false)
    }
  }

  const downloadSvg = () => {
    if (!svgRef.current) return
    const xml = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>${xml}`], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `marque-logo-${id}-1024.svg`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-14 border-t border-bone/10 pt-10">
      <div className="text-[11px] uppercase tracking-[0.2em] text-bone/40">Submission asset</div>
      <div className="mt-1 font-display text-2xl font-semibold text-bone">{label} · 1024&times;1024</div>
      <p className="mt-1 max-w-xl text-sm text-bone/50">
        Ink base with a brass glow, a teal settlement glow, a faint dot grid, and the mark struck in bone at the center.
        Mark only — the submission renders the name underneath.
      </p>

      <div className="mt-6 grid items-start gap-6 sm:grid-cols-[auto_1fr]">
        <div className="overflow-hidden rounded-2xl border border-bone/10">
          <SubmissionSvg ref={svgRef} id={id} display={320} />
        </div>
        <div className="space-y-4 text-sm text-bone/55">
          <p>The export renders this exact composition to a 1024&times;1024 canvas. PNG for HackQuest, SVG for everything else.</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportPng}
              disabled={busy}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Rendering…" : "Download 1024 PNG"}
            </button>
            <button
              onClick={downloadSvg}
              className="rounded-lg border border-bone/15 bg-ink-900/60 px-4 py-2 text-sm text-bone transition-colors hover:border-brass/40"
            >
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SubmissionSvgProps {
  id: MarkId
  display: number
}

function SubmissionSvg({ ref, id, display }: SubmissionSvgProps & { ref: React.Ref<SVGSVGElement> }) {
  const Mark = MARKS.find((m) => m.id === id)!.Mark
  return (
    <svg ref={ref} width={display} height={display} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mqBrass" cx="0.24" cy="0.2" r="0.5">
          <stop offset="0%" stopColor="#e2bd74" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e2bd74" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mqLive" cx="0.8" cy="0.82" r="0.5">
          <stop offset="0%" stopColor="#5fd4c4" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#5fd4c4" stopOpacity="0" />
        </radialGradient>
        <pattern id="mqGrid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0 H0 V64" fill="none" stroke="#ece6d8" strokeOpacity="0.04" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1024" height="1024" rx="180" fill="#08090b" />
      <rect width="1024" height="1024" rx="180" fill="url(#mqGrid)" />
      <rect width="1024" height="1024" rx="180" fill="url(#mqBrass)" />
      <rect width="1024" height="1024" rx="180" fill="url(#mqLive)" />
      <rect x="2" y="2" width="1020" height="1020" rx="178" fill="none" stroke="#c9a45c" strokeOpacity="0.28" strokeWidth="2" />
      <Mark x={172} y={172} width={680} height={680} stroke="#ece6d8" />
    </svg>
  )
}
