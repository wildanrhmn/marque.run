import { cn } from "@/lib/cn"
import { SealMark } from "./SealMark"

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex select-none items-center gap-2.5", className)}>
      <SealMark size={26} />
      <span className="font-display text-[15px] font-semibold tracking-[0.02em] text-bone">
        marque
      </span>
    </div>
  )
}
