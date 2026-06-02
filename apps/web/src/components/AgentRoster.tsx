"use client"
import { cn } from "@/lib/cn"
import type { SpecialistKind } from "@marque/shared"

export interface AgentStatus {
  kind: SpecialistKind
  state: "idle" | "redelegating" | "calling" | "settled" | "done" | "error"
  budgetUsdc: string
  veniceEndpoint: string
  lastTxHash?: string
  output?: { previewType: "text" | "image" | "audio" | "video"; previewUrl?: string; text?: string }
  error?: string
}

const KIND_META: Record<SpecialistKind, { title: string; venice: string; emoji: string }> = {
  concept: { title: "Concept", venice: "/chat/completions", emoji: "✎" },
  image: { title: "Image", venice: "/image/generate", emoji: "▲" },
  voice: { title: "Voice", venice: "/audio/speech", emoji: "◉" },
  music: { title: "Music", venice: "/audio/music", emoji: "♪" },
  video: { title: "Video", venice: "/video/complete", emoji: "▶" },
}

const STATE_TONE: Record<AgentStatus["state"], string> = {
  idle: "text-neutral-500 border-white/8",
  redelegating: "text-violet-300 border-violet-500/30",
  calling: "text-fuchsia-300 border-fuchsia-500/30 animate-pulse-soft",
  settled: "text-emerald-300 border-emerald-500/30",
  done: "text-white border-white/30",
  error: "text-red-300 border-red-500/30",
}

const STATE_LABEL: Record<AgentStatus["state"], string> = {
  idle: "queued",
  redelegating: "signing redelegation",
  calling: "calling venice",
  settled: "relay confirmed",
  done: "done",
  error: "error",
}

export function AgentRoster({ statuses }: { statuses: AgentStatus[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {statuses.map((s) => {
        const meta = KIND_META[s.kind]
        return (
          <div key={s.kind} className={cn("panel overflow-hidden p-4 transition", STATE_TONE[s.state])}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-white/[0.04] font-mono text-sm text-white/80">
                    {meta.emoji}
                  </span>
                  <span className="font-display text-sm font-semibold text-white">{meta.title}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-neutral-500">
                  <span>venice{meta.venice}</span>
                </div>
              </div>
              <span className="pill">{s.budgetUsdc} USDC</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  s.state === "idle"
                    ? "bg-neutral-600"
                    : s.state === "done"
                      ? "bg-white"
                      : s.state === "error"
                        ? "bg-red-400"
                        : "bg-current",
                )}
              />
              <span>{STATE_LABEL[s.state]}</span>
            </div>
            {s.lastTxHash ? (
              <a
                href={`https://basescan.org/tx/${s.lastTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-mono text-[11px] text-sky-300 hover:underline"
              >
                {s.lastTxHash.slice(0, 10)}…{s.lastTxHash.slice(-6)}
              </a>
            ) : null}
            {s.output?.previewType === "image" && s.output.previewUrl ? (
              <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-white/8">
                <img src={s.output.previewUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}
            {s.output?.previewType === "text" && s.output.text ? (
              <p className="mt-3 line-clamp-3 text-[12px] text-neutral-300">{s.output.text}</p>
            ) : null}
            {s.error ? <p className="mt-2 text-[12px] text-red-300">{s.error}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
