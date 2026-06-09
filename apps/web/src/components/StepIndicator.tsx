"use client"
import { cn } from "@/lib/cn"

export type StepKey = "connect" | "grant" | "brief" | "run" | "mint"

export interface Step {
  key: StepKey
  label: string
  caption: string
}

export const RUN_STEPS: Step[] = [
  { key: "connect", label: "Connect", caption: "MetaMask Smart Account" },
  { key: "grant", label: "Grant", caption: "ERC-7715 budget" },
  { key: "brief", label: "Brief", caption: "one sentence" },
  { key: "run", label: "Run", caption: "swarm at work" },
  { key: "mint", label: "Mint", caption: "ERC-721 to wallet" },
]

export function StepIndicator({ currentStep, completed }: { currentStep: StepKey; completed: Set<StepKey> }) {
  const currentIndex = RUN_STEPS.findIndex((s) => s.key === currentStep)
  return (
    <ol className="flex w-full items-center justify-between gap-2">
      {RUN_STEPS.map((step, i) => {
        const isComplete = completed.has(step.key)
        const isActive = step.key === currentStep
        return (
          <li key={step.key} className="flex-1">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold transition",
                    isComplete && "bg-brass text-ink-950",
                    !isComplete &&
                      isActive &&
                      "bg-brass/15 text-brass shadow-[0_0_0_4px_rgba(201,164,92,0.14)] ring-1 ring-brass/50",
                    !isComplete && !isActive && "bg-bone/5 text-slate-dim",
                  )}
                >
                  {isComplete ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l4 4L19 6" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="flex flex-col leading-tight">
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      isActive ? "text-bone" : isComplete ? "text-bone/80" : "text-slate-dim",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-slate-dim">{step.caption}</span>
                </div>
              </div>
              {i < RUN_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "ml-9 mt-2 h-px w-full transition",
                    i < currentIndex || isComplete ? "bg-brass/40" : "bg-bone/[0.08]",
                  )}
                />
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
