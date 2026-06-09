import { cn } from "@/lib/cn"

export function SealMark({ className, size = 28 }: { className?: string; size?: number }) {
  const ticks = Array.from({ length: 24 })
  return (
    <span
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="animate-seal-spin"
        style={{ animationDuration: "48s" }}
        aria-hidden
      >
        <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(201,164,92,0.5)" strokeWidth="1" />
        <circle cx="50" cy="50" r="39" fill="none" stroke="rgba(201,164,92,0.22)" strokeWidth="0.6" />
        {ticks.map((_, i) => {
          const a = (i / ticks.length) * Math.PI * 2
          const r1 = 47
          const r2 = i % 2 === 0 ? 42 : 44
          const cos = Math.cos(a)
          const sin = Math.sin(a)
          return (
            <line
              key={i}
              x1={(50 + cos * r1).toFixed(3)}
              y1={(50 + sin * r1).toFixed(3)}
              x2={(50 + cos * r2).toFixed(3)}
              y2={(50 + sin * r2).toFixed(3)}
              stroke="rgba(201,164,92,0.55)"
              strokeWidth="0.8"
            />
          )
        })}
      </svg>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0" aria-hidden>
        <path
          d="M30 66 V36 L50 56 L70 36 V66"
          fill="none"
          stroke="#e2bd74"
          strokeWidth="6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    </span>
  )
}
