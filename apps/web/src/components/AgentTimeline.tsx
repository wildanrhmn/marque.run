"use client"
import { useMemo } from "react"
import type { AgentTimelineEvent } from "@marque/shared"
import { cn } from "@/lib/cn"
import { relativeTime, shortTx } from "@/lib/format"

const KIND_LABEL: Record<AgentTimelineEvent["kind"], string> = {
  "operator.brief.submitted": "brief submitted",
  "operator.upgrade.7702.signed": "EIP-7702 authorization signed",
  "operator.root.delegation.signed": "root permission granted",
  "director.plan.ready": "director planned the run",
  "specialist.redelegation.signed": "redelegation signed",
  "specialist.venice.request": "specialist called Venice",
  "broker.relay.submitted": "1Shot relay submitted",
  "broker.relay.confirmed": "1Shot relay confirmed",
  "specialist.venice.response": "specialist got Venice output",
  "composer.scene.rendered": "composer rendered scene",
  "composer.final.encoded": "composer finalized",
  "mint.tx.submitted": "mint tx submitted",
  "mint.tx.confirmed": "minted",
  error: "error",
}

const KIND_TONE: Partial<Record<AgentTimelineEvent["kind"], string>> = {
  "operator.brief.submitted": "text-neutral-300",
  "operator.upgrade.7702.signed": "text-amber-300",
  "operator.root.delegation.signed": "text-amber-300",
  "director.plan.ready": "text-sky-300",
  "specialist.redelegation.signed": "text-violet-300",
  "broker.relay.submitted": "text-emerald-300",
  "broker.relay.confirmed": "text-emerald-300",
  "specialist.venice.response": "text-fuchsia-300",
  "mint.tx.submitted": "text-sig",
  "mint.tx.confirmed": "text-sig",
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
    <div className="panel relative h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-white">live timeline</span>
          <span className="pill">{events.length} events</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-emerald-400 animate-pulse-soft" : "bg-neutral-600",
            )}
          />
          <span className={connected ? "text-emerald-300" : "text-neutral-500"}>
            {connected ? "streaming" : "idle"}
          </span>
        </div>
      </div>
      <div className="max-h-[640px] overflow-y-auto px-2 py-2">
        {sorted.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-neutral-500">
            waiting for the first event…
          </div>
        ) : (
          <ol className="space-y-1">
            {sorted.map((e, idx) => (
              <li
                key={`${e.ts}-${idx}`}
                className="group relative rounded-lg border border-transparent px-3 py-2 transition hover:border-white/8 hover:bg-white/[0.025]"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30 group-hover:bg-white" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("text-[13px] font-medium", KIND_TONE[e.kind] ?? "text-neutral-200")}>
                        {KIND_LABEL[e.kind]}
                        {e.specialistKind ? (
                          <span className="ml-2 text-[11px] uppercase tracking-wide text-neutral-500">
                            · {e.specialistKind}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[10px] text-neutral-500">{relativeTime(e.ts)}</span>
                    </div>
                    {Object.keys(e.details).length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-neutral-400">
                        {Object.entries(e.details).map(([k, v]) => (
                          <span key={k}>
                            <span className="text-neutral-600">{k}</span>:{" "}
                            <span className="text-neutral-200">
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
