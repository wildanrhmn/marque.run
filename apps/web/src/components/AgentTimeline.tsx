"use client"
import { useMemo } from "react"
import type { AgentTimelineEvent } from "@marque/shared"
import { cn } from "@/lib/cn"
import { relativeTime, shortTx } from "@/lib/format"

const KIND_LABEL: Record<AgentTimelineEvent["kind"], string> = {
  "operator.brief.submitted": "Brief submitted",
  "operator.upgrade.7702.signed": "Account upgraded",
  "operator.root.delegation.signed": "Mandate granted",
  "director.plan.ready": "Director planned the run",
  "specialist.redelegation.signed": "Sub-mandate signed",
  "specialist.venice.request": "Specialist started work",
  "broker.relay.submitted": "Settlement submitted",
  "broker.relay.confirmed": "Settlement confirmed",
  "specialist.venice.response": "Specialist returned output",
  "composer.scene.rendered": "Composer rendered scene",
  "broker.ipfs.pinned": "Pinned to IPFS",
  "composer.final.encoded": "Composer finalized",
  "mint.tx.submitted": "Mint submitted",
  "mint.tx.confirmed": "Minted",
  error: "Error",
}

const KIND_TONE: Partial<Record<AgentTimelineEvent["kind"], string>> = {
  "operator.brief.submitted": "text-bone/80",
  "operator.upgrade.7702.signed": "text-brass",
  "operator.root.delegation.signed": "text-brass",
  "director.plan.ready": "text-brass-bright",
  "specialist.redelegation.signed": "text-brass",
  "broker.relay.submitted": "text-live",
  "broker.relay.confirmed": "text-live",
  "specialist.venice.response": "text-live",
  "mint.tx.submitted": "text-brass-bright",
  "mint.tx.confirmed": "text-brass-bright",
  error: "text-red-300",
}

export function AgentTimeline({
  events,
  connected,
}: {
  events: AgentTimelineEvent[]
  connected: boolean
}) {
  const sorted = useMemo(() => [...events].sort((a, b) => a.ts - b.ts), [events])

  return (
    <div className="panel relative flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-bone/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-bone">Live timeline</span>
          <span className="pill">{events.length} events</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "animate-pulse-soft bg-live shadow-glow-live" : "bg-slate-dim",
            )}
          />
          <span className={connected ? "text-live" : "text-slate-dim"}>
            {connected ? "Streaming" : "Idle"}
          </span>
        </div>
      </div>
      <div className="max-h-[640px] flex-1 overflow-y-auto px-2 py-2">
        {sorted.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-slate-dim">
            waiting for the first event…
          </div>
        ) : (
          <ol className="relative space-y-0.5 before:absolute before:bottom-2 before:left-[14px] before:top-2 before:w-px before:bg-bone/[0.06]">
            {sorted.map((e, idx) => (
              <li
                key={`${e.ts}-${idx}`}
                className="group relative rounded-lg border border-transparent px-3 py-2 transition hover:border-bone/[0.08] hover:bg-bone/[0.02]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2 ring-ink-950",
                      KIND_TONE[e.kind]?.replace("text-", "bg-") ?? "bg-bone/40",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("text-[13px] font-medium", KIND_TONE[e.kind] ?? "text-bone/80")}>
                        {KIND_LABEL[e.kind]}
                        {e.specialistKind ? (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-slate-dim">
                            · {e.specialistKind}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[10px] text-slate-dim">{relativeTime(e.ts)}</span>
                    </div>
                    {Object.keys(e.details).length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-slate">
                        {Object.entries(e.details).map(([k, v]) => (
                          <span key={k}>
                            <span className="text-slate-dim">{k}</span>:{" "}
                            <span className="text-bone/80">
                              {typeof v === "string" && v.startsWith("0x") ? shortTx(v) : String(v)}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
