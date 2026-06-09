"use client"
import { useEffect, useRef } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import gsap from "gsap"
import { SealMark } from "./SealMark"

const PixelBlast = dynamic(() => import("./PixelBlast"), { ssr: false })

const CREW = ["Concept", "Image", "Voice", "Music", "Video"]

export function Hero() {
  const root = useRef<HTMLDivElement>(null)
  const underline = useRef<SVGPathElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.from(".hero-badge", { opacity: 0, y: 16, duration: 0.6 })
        .from(".hero-line", { opacity: 0, y: 28, duration: 0.9, stagger: 0.08 }, "-=0.3")
        .from(".hero-sub", { opacity: 0, y: 18, duration: 0.7 }, "-=0.5")
        .from(".hero-cta", { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 }, "-=0.4")
        .from(".hero-crew", { opacity: 0, y: 12, duration: 0.5, stagger: 0.06 }, "-=0.3")

      const path = underline.current
      if (path) {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(path, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", delay: 0.9 })
      }
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} className="relative flex min-h-screen flex-col justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <PixelBlast
          variant="circle"
          color="#c9a45c"
          pixelSize={3}
          patternScale={2.4}
          patternDensity={0.9}
          liquid
          liquidStrength={0.12}
          enableRipples
          rippleIntensityScale={1.4}
          rippleSpeed={0.34}
          speed={0.42}
          edgeFade={0.5}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, transparent 30%, rgba(8,9,11,0.55) 75%, rgba(8,9,11,0.9) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        aria-hidden
      >
        <SealMark size={560} />
      </div>

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 text-center">
        <div className="hero-badge">
          <span className="pill-brass">A serverless runtime for agent swarms</span>
        </div>

        <h1 className="mt-7 font-display text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.01em] text-balance text-bone sm:text-6xl lg:text-[5rem]">
          <span className="hero-line block">Agents that pay</span>
          <span className="hero-line relative inline-block">
            for themselves.
            <svg
              className="absolute -bottom-3 left-0 w-full"
              height="22"
              viewBox="0 0 420 22"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                ref={underline}
                d="M6 14C84 6 196 4 280 8C330 10 380 12 414 16"
                stroke="#c9a45c"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="hero-sub mt-8 max-w-2xl text-pretty text-base text-bone/65 sm:text-lg">
          Marque puts a crew of specialist agents to work on a budget you control. Give a brief,
          they divide the work and build a finished piece, and you own the result. No keys handed
          over, no funds held, nothing left running.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/run" className="hero-cta btn-primary shine-host">
            launch the runtime
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <a href="#how" className="hero-cta btn-ghost">
            how it works
          </a>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {CREW.map((c) => (
            <div
              key={c}
              className="hero-crew group flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-slate-dim transition-colors hover:text-brass"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-slate-dim transition-colors group-hover:bg-brass group-hover:shadow-glow-brass" />
              {c}
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-dim">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse-soft">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </div>
    </section>
  )
}
