"use client"
import { useRef, type ReactNode, type PointerEvent } from "react"
import { cn } from "@/lib/cn"

export function TiltCard({
  children,
  className,
  max = 8,
  glow = true,
}: {
  children: ReactNode
  className?: string
  max?: number
  glow?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const rx = (0.5 - py) * max
    const ry = (px - 0.5) * max
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`
    if (glow) {
      el.style.setProperty("--mx", `${px * 100}%`)
      el.style.setProperty("--my", `${py * 100}%`)
    }
  }

  const reset = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)"
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn("transition-transform duration-200 ease-out will-change-transform", className)}
      style={
        glow
          ? {
              backgroundImage:
                "radial-gradient(220px circle at var(--mx,50%) var(--my,50%), rgba(201,164,92,0.10), transparent 60%)",
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
