import { cn } from "@/lib/cn"

export function GradientMesh({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div
        className="absolute -left-[10%] -top-[20%] h-[60vh] w-[60vh] animate-mesh-drift rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(201,164,92,0.22), transparent 65%)" }}
      />
      <div
        className="absolute -right-[5%] top-[10%] h-[50vh] w-[50vh] animate-mesh-drift-slow rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(95,212,196,0.14), transparent 65%)" }}
      />
      <div
        className="absolute bottom-[-20%] left-[30%] h-[45vh] w-[45vh] animate-mesh-drift rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(168,132,63,0.14), transparent 65%)" }}
      />
      <div className="absolute inset-0 dotgrid opacity-50" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, transparent 40%, rgba(8,9,11,0.6) 100%)",
        }}
      />
    </div>
  )
}
