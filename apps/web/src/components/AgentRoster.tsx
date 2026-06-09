"use client"
import { cn } from "@/lib/cn"
import type { SpecialistKind } from "@marque/shared"
import { TiltCard } from "./TiltCard"

export interface AgentStatus {
  kind: SpecialistKind
  state: "idle" | "redelegating" | "calling" | "settled" | "done" | "error"
  budgetUsdc: string
  veniceEndpoint: string
  lastTxHash?: string
  output?: { previewType: "text" | "image" | "audio" | "video"; previewUrl?: string; text?: string }
  error?: string
}

const KIND_META: Record<SpecialistKind, { title: string; venice: string; glyph: string }> = {
  concept: { title: "Concept", venice: "/chat/completions", glyph: "✎" },
  image: { title: "Image", venice: "/image/generate", glyph: "◫" },
  voice: { title: "Voice", venice: "/audio/speech", glyph: "◉" },
  music: { title: "Music", venice: "/audio/music", glyph: "♪" },
  video: { title: "Video", venice: "/video/complete", glyph: "▶" },
}

const STATE_BORDER: Record<AgentStatus["state"], string> = {
  idle: "border-bone/[0.08]",
  redelegating: "border-brass/40",
  calling: "border-live/40",
  settled: "border-live/40",
  done: "border-brass/50",
  error: "border-red-500/40",
}

const STATE_LABEL: Record<AgentStatus["state"], string> = {
  idle: "queued",
  redelegating: "signing sub-mandate",
  calling: "calling venice",
  settled: "relay confirmed",
  done: "done",
  error: "error",
}

const STATE_DOT: Record<AgentStatus["state"], string> = {
  idle: "bg-slate-dim",
  redelegating: "bg-brass",
  calling: "bg-live shadow-glow-live animate-pulse-soft",
  settled: "bg-live shadow-glow-live",
  done: "bg-brass shadow-glow-brass",
  error: "bg-red-400",
}

const STATE_TEXT: Record<AgentStatus["state"], string> = {
  idle: "text-slate-dim",
  redelegating: "text-brass",
  calling: "text-live",
  settled: "text-live",
  done: "text-brass",
  error: "text-red-300",
}

export function AgentRoster({ statuses }: { statuses: AgentStatus[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {statuses.map((s) => {
        const meta = KIND_META[s.kind]
        const active = s.state === "calling" || s.state === "redelegating"
        return (
          <TiltCard key={s.kind} className="rounded-[14px]">
            <div
              className={cn(
                "panel h-full overflow-hidden p-4 transition-colors duration-300",
                STATE_BORDER[s.state],
              )}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-md border font-mono text-sm transition",
                        active
                          ? "border-live/40 bg-live/10 text-live"
                          : s.state === "done"
                            ? "border-brass/40 bg-brass/10 text-brass"
                            : "border-bone/10 bg-bone/[0.03] text-bone/70",
                      )}
                    >
                      {meta.glyph}
                    </span>
                    <span className="font-display text-sm font-semibold text-bone">{meta.title}</span>
                  </div>
                  <div className="data mt-1.5 truncate">venice{meta.venice}</div>
                </div>
                <span className="pill-brass shrink-0">{s.budgetUsdc}</span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em]">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[s.state])} />
                <span className={STATE_TEXT[s.state]}>{STATE_LABEL[s.state]}</span>
              </div>

              {s.lastTxHash ? (
                <a
                  href={`https://basescan.org/tx/${s.lastTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-mono text-[11px] text-live hover:underline"
                >
                  {s.lastTxHash.slice(0, 10)}…{s.lastTxHash.slice(-6)}
                </a>
              ) : null}

              {s.output?.previewType === "image" && s.output.previewUrl ? (
                <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-bone/[0.08]">
                  <img src={s.output.previewUrl} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
              {s.output?.previewType === "text" && s.output.text ? (
                <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed text-bone/70">
                  {s.output.text}
                </p>
              ) : null}
              {s.error ? <p className="mt-2 text-[12px] text-red-300">{s.error}</p> : null}
            </div>
          </TiltCard>
        )
      })}
    </div>
  )
}
