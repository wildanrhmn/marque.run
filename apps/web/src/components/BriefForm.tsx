"use client"
import { useState } from "react"

export interface BriefSubmission {
  prompt: string
  durationSeconds: number
  budgetUsdcAtoms: bigint
}

const SUGGESTIONS = [
  "30s ad for a cold brew brand called Lichen, moody indie tone",
  "30s ad for an open-source DAW called Wavelength, retro arcade vibe",
  "30s ad for a vegan jerky brand called Husk, gritty desert aesthetic",
]

export function BriefForm({
  onSubmit,
  busy,
}: {
  onSubmit: (b: BriefSubmission) => void
  busy: boolean
}) {
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState(30)
  const [budgetUsdc, setBudgetUsdc] = useState(2.0)

  const submit = () => {
    if (!prompt.trim()) return
    const atoms = BigInt(Math.floor(budgetUsdc * 1_000_000))
    onSubmit({ prompt: prompt.trim(), durationSeconds: duration, budgetUsdcAtoms: atoms })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate">
          your brief
        </label>
        <textarea
          className="field min-h-[120px] resize-y"
          placeholder="describe the ad in one or two sentences"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              disabled={busy}
              className="rounded-full border border-bone/[0.08] bg-bone/[0.02] px-3 py-1 text-[11px] text-slate transition hover:border-brass/30 hover:text-bone"
            >
              {s.slice(0, 38)}…
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate">
            duration · <span className="text-bone">{duration}s</span>
          </label>
          <input
            type="range"
            min="10"
            max="45"
            step="5"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={busy}
            className="w-full accent-brass"
          />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate">
            budget · <span className="text-bone">${budgetUsdc.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="1"
            max="5"
            step="0.25"
            value={budgetUsdc}
            onChange={(e) => setBudgetUsdc(Number(e.target.value))}
            disabled={busy}
            className="w-full accent-brass"
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-bone/[0.06] pt-4">
        <div className="text-[12px] text-slate-dim">
          delegation budget caps total spend. agent never holds funds.
        </div>
        <button
          className="btn-primary shine-host"
          disabled={busy || !prompt.trim()}
          onClick={submit}
        >
          {busy ? "running…" : "send brief"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
