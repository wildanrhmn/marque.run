"use client"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { AgentTimelineEvent, SpecialistKind } from "@marque/shared"
import type { Hex } from "viem"
import { Header } from "@/components/Header"
import { AgentTimeline } from "@/components/AgentTimeline"
import { GradientMesh } from "@/components/GradientMesh"
import { cn } from "@/lib/cn"
import { shortTx } from "@/lib/format"
import { FORMATS, RESOLUTIONS, TONES, estimateAd, type Format, type Resolution } from "@/lib/venice-demo"
import { startGeneration, brokerStreamUrl } from "@/lib/generate"

type Stage = "compose" | "generating" | "result"

const SAMPLES = [
  "A moody, indie ad for a cold brew brand called Lichen",
  "An upbeat ad for an open-source music app called Wavelength",
  "A gritty desert ad for a vegan jerky brand called Husk",
]

const DURATIONS = [15, 30, 45]

const STEPS: { key: SpecialistKind; label: string; sub: string }[] = [
  { key: "concept", label: "Writing the script", sub: "Turning your brief into scenes" },
  { key: "image", label: "Designing the scenes", sub: "Generating the visuals" },
  { key: "voice", label: "Recording the voiceover", sub: "Narration in a natural voice" },
  { key: "music", label: "Scoring the soundtrack", sub: "Original music to match" },
  { key: "video", label: "Editing the final cut", sub: "Stitching the scenes into your ad" },
]

function randHex(bytes: number): Hex {
  let s = "0x"
  const hex = "0123456789abcdef"
  for (let i = 0; i < bytes * 2; i++) s += hex[Math.floor(Math.random() * 16)]
  return s as Hex
}

function poster(title: string, w = 1280, h = 720): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1c1708'/><stop offset='1' stop-color='#08090b'/></linearGradient>
      <radialGradient id='r' cx='50%' cy='42%' r='60%'><stop offset='0' stop-color='rgba(201,164,92,0.34)'/><stop offset='1' stop-color='rgba(201,164,92,0)'/></radialGradient>
    </defs>
    <rect width='${w}' height='${h}' fill='url(#g)'/><rect width='${w}' height='${h}' fill='url(#r)'/>
    <circle cx='${w / 2}' cy='${h * 0.42}' r='${h * 0.13}' fill='none' stroke='#c9a45c' stroke-width='3'/>
    <path d='M ${w / 2 - h * 0.07} ${h * 0.5} V ${h * 0.34} L ${w / 2} ${h * 0.42} L ${w / 2 + h * 0.07} ${h * 0.34} V ${h * 0.5}' fill='none' stroke='#e2bd74' stroke-width='${h * 0.022}'/>
    <text x='${w / 2}' y='${h * 0.72}' text-anchor='middle' fill='#ece6d8' font-family='sans-serif' font-size='${h * 0.06}' font-weight='600'>${escapeXml(title)}</text>
  </svg>`
  return "data:image/svg+xml," + encodeURIComponent(svg)
}
function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function titleFrom(prompt: string): string {
  const m = prompt.match(/called\s+([A-Z][\w'’]*)/)
  if (m) return m[1]!
  const words = prompt.split(/\s+/).filter(Boolean).slice(0, 3).join(" ")
  return words || "Your ad"
}

export default function RunDemoPage() {
  const [stage, setStage] = useState<Stage>("compose")
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState(30)
  const [format, setFormat] = useState<Format>(FORMATS[0])
  const [resolution, setResolution] = useState<Resolution>("720p")
  const [tone, setTone] = useState<string | null>(null)
  const [speed, setSpeed] = useState(1)

  const est = estimateAd({ durationSec: duration, resolution })

  const [stepIndex, setStepIndex] = useState(-1)
  const [statusLine, setStatusLine] = useState("Approving your budget")
  const [events, setEvents] = useState<AgentTimelineEvent[]>([])
  const [showDetails, setShowDetails] = useState(false)

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tx, setTx] = useState<Hex | undefined>()
  const [live, setLive] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | undefined>()
  const [actualSpent, setActualSpent] = useState<number | undefined>()

  const speedRef = useRef(speed)
  useEffect(() => {
    speedRef.current = speed
  }, [speed])
  const cancel = useRef(false)
  useEffect(
    () => () => {
      cancel.current = true
    },
    [],
  )
  const briefId = useRef<Hex>(randHex(32))

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms / speedRef.current))
  const push = (kind: AgentTimelineEvent["kind"], details: Record<string, unknown>, specialistKind?: SpecialistKind) =>
    setEvents((p) => [...p, { briefId: briefId.current, ts: Date.now(), kind, specialistKind, details }])

  const generate = async () => {
    if (!prompt.trim()) return
    cancel.current = false
    briefId.current = randHex(32)
    setEvents([])
    setStepIndex(-1)
    setSaved(false)
    setTx(undefined)
    setVideoUrl(undefined)
    setActualSpent(undefined)
    setStage("generating")
    if (live) await generateLive()
    else await generateSimulated()
  }

  const generateSimulated = async () => {
    setStatusLine("Approving your budget")
    push("operator.root.delegation.signed", { cap: "$5.00" })
    await sleep(1100)
    if (cancel.current) return
    push("director.plan.ready", { specialists: STEPS.length })

    for (let i = 0; i < STEPS.length; i++) {
      if (cancel.current) return
      setStepIndex(i)
      setStatusLine(STEPS[i]!.label)
      const settle = randHex(32)
      push("specialist.venice.request", {}, STEPS[i]!.key)
      push("broker.relay.submitted", { hash: settle }, STEPS[i]!.key)
      await sleep(1300)
      push("broker.relay.confirmed", { hash: settle }, STEPS[i]!.key)
      push("specialist.venice.response", { settlementHash: settle }, STEPS[i]!.key)
    }
    if (cancel.current) return
    setStepIndex(STEPS.length)
    setStatusLine("Done")
    push("composer.final.encoded", { durationMs: duration * 1000 })
    await sleep(700)
    setStage("result")
  }

  const generateLive = async () => {
    setStatusLine("Approving your budget")
    let started
    try {
      started = await startGeneration({
        prompt: prompt.trim(),
        durationSec: duration,
        resolution,
        aspectRatio: format.key,
        tone: tone ?? undefined,
        maxScenes: est.scenes,
      })
    } catch (err) {
      setStatusLine(`Failed: ${(err as Error).message}`)
      return
    }
    briefId.current = started.briefId

    await new Promise<void>((resolve) => {
      const source = new EventSource(brokerStreamUrl(started.briefId))
      const finish = () => {
        source.close()
        resolve()
      }
      const onEvent = (e: MessageEvent) => {
        let ev: AgentTimelineEvent
        try {
          ev = JSON.parse(e.data) as AgentTimelineEvent
        } catch {
          return
        }
        if (cancel.current) {
          finish()
          return
        }
        setEvents((p) => [...p, ev])
        applyLiveEvent(ev)
        if (ev.kind === "composer.final.encoded") {
          const url = (ev.details["assetUrl"] as string | undefined) ?? undefined
          const spent = ev.details["spentUsd"] as number | undefined
          setStepIndex(STEPS.length)
          setStatusLine("Done")
          if (url) setVideoUrl(url)
          if (typeof spent === "number") setActualSpent(spent)
          setStage("result")
          finish()
        }
        if (ev.kind === "error") {
          setStatusLine(`Failed: ${String(ev.details["message"] ?? "error")}`)
          finish()
        }
      }
      const kinds: AgentTimelineEvent["kind"][] = [
        "operator.brief.submitted",
        "director.plan.ready",
        "specialist.venice.request",
        "specialist.venice.response",
        "broker.relay.confirmed",
        "composer.scene.rendered",
        "composer.final.encoded",
        "error",
      ]
      for (const k of kinds) source.addEventListener(k, onEvent)
      source.onerror = () => {
        /* keep open; broker SSE heartbeats */
      }
    })
  }

  const applyLiveEvent = (ev: AgentTimelineEvent) => {
    const step = ev.details["step"] as string | undefined
    if (ev.kind === "director.plan.ready") {
      setStepIndex(0)
      setStatusLine(STEPS[0]!.label)
    } else if (step === "image" || step === "video") {
      setStepIndex(1)
      setStatusLine(STEPS[1]!.label)
    } else if (step === "voice") {
      setStepIndex(2)
      setStatusLine(STEPS[2]!.label)
    } else if (step === "music") {
      setStepIndex(3)
      setStatusLine(STEPS[3]!.label)
    } else if (ev.kind === "composer.scene.rendered") {
      setStepIndex(4)
      setStatusLine(STEPS[4]!.label)
    }
  }

  const save = async () => {
    if (saved) return
    setSaving(true)
    push("mint.tx.submitted", {})
    await sleep(1100)
    const h = randHex(32)
    setTx(h)
    push("mint.tx.confirmed", { hash: h }, undefined)
    setSaved(true)
    setSaving(false)
  }

  const startOver = () => {
    cancel.current = true
    setStage("compose")
    setStepIndex(-1)
    setEvents([])
    setSaved(false)
    setTx(undefined)
    setShowDetails(false)
  }

  const title = titleFrom(prompt)

  return (
    <>
      <Header variant="app" />
      <div className="fixed inset-0 -z-10">
        <GradientMesh />
      </div>

      {/* tiny demo control, unobtrusive */}
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-bone/10 bg-ink-900/80 px-2.5 py-1.5 backdrop-blur">
        <span className="pill-brass">Demo</span>
        <div className="flex overflow-hidden rounded-full border border-bone/10">
          {[
            { v: false, label: "Sim" },
            { v: true, label: "Live" },
          ].map((m) => (
            <button
              key={m.label}
              onClick={() => setLive(m.v)}
              className={cn(
                "px-2.5 py-0.5 text-[11px] font-medium transition",
                live === m.v ? "bg-brass text-ink-950" : "text-slate hover:text-bone",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {!live ? (
          <div className="flex overflow-hidden rounded-full border border-bone/10">
            {[1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn("px-2 py-0.5 font-mono text-[11px] transition", speed === s ? "bg-brass text-ink-950" : "text-slate hover:text-bone")}
              >
                {s}x
              </button>
            ))}
          </div>
        ) : (
          <span className="px-1 text-[10px] text-live">real Venice · ~3 min</span>
        )}
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 pb-16 pt-28">
        <AnimatePresence mode="wait">
          {stage === "compose" ? (
            <motion.div
              key="compose"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-7 text-center">
                <span className="pill-brass">New ad</span>
                <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
                  What are you advertising?
                </h1>
                <p className="mx-auto mt-2 max-w-md text-bone/55">
                  Describe it in a sentence. A crew of agents writes, designs, voices, scores, and
                  edits a finished ad for you.
                </p>
              </div>

              <div className="panel p-5">
                <textarea
                  autoFocus
                  className="field min-h-[120px] resize-none border-0 bg-transparent px-1 text-base focus:ring-0"
                  placeholder="e.g. A moody, cinematic ad for a cold brew brand called Lichen…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {SAMPLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      className="rounded-full border border-bone/[0.08] px-3 py-1 text-[12px] text-slate transition hover:border-brass/30 hover:text-bone"
                    >
                      {s.length > 40 ? s.slice(0, 40) + "…" : s}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 border-t border-bone/[0.06] pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label={`Length · ${est.scenes} scenes`}>
                    <Segmented
                      options={DURATIONS.map((d) => ({ key: String(d), label: `${d}s` }))}
                      value={String(duration)}
                      onChange={(v) => setDuration(Number(v))}
                    />
                  </Field>
                  <Field label="Format">
                    <Segmented
                      options={FORMATS.map((f) => ({ key: f.key, label: f.key }))}
                      value={format.key}
                      onChange={(v) => setFormat(FORMATS.find((f) => f.key === v) ?? FORMATS[0])}
                    />
                  </Field>
                  <Field label="Quality">
                    <Segmented
                      options={RESOLUTIONS.map((r) => ({ key: r, label: r }))}
                      value={resolution}
                      onChange={(v) => setResolution(v as Resolution)}
                    />
                  </Field>
                  <Field label="Tone">
                    <Segmented
                      options={TONES.map((t) => ({ key: t, label: t }))}
                      value={tone ?? ""}
                      onChange={(v) => setTone(v === tone ? null : v)}
                      compact
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-4">
                <button
                  className="btn-primary shine-host h-12 w-full max-w-sm px-7 text-base"
                  onClick={generate}
                  disabled={!prompt.trim()}
                >
                  Generate ad · ~${est.total.toFixed(2)}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
                <p className="max-w-md text-center text-[12px] text-slate-dim">
                  Estimated ${est.total.toFixed(2)} in USDC for a {est.realDurationSec}s ad (
                  {est.scenes} scenes at {resolution}). Final price is quoted per step before it
                  runs, and can never exceed the budget you approve.
                </p>
              </div>
            </motion.div>
          ) : stage === "generating" ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-7 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
                  <span className="absolute h-12 w-12 animate-ping rounded-full bg-brass/20" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-brass shadow-glow-brass" />
                </div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-bone sm:text-3xl">
                  Creating your ad
                </h1>
                <p className="mx-auto mt-2 max-w-md text-[13px] italic text-bone/50">“{prompt}”</p>
              </div>

              <div className="panel p-6">
                <ol className="space-y-1">
                  {STEPS.map((s, i) => {
                    const state = stepIndex > i || stepIndex >= STEPS.length ? "done" : stepIndex === i ? "active" : "pending"
                    return (
                      <li key={s.key} className="flex items-center gap-4 rounded-xl px-2 py-3">
                        <StepDot state={state} />
                        <div className="min-w-0 flex-1">
                          <div className={cn("text-[15px] font-medium", state === "pending" ? "text-slate-dim" : "text-bone")}>
                            {s.label}
                          </div>
                          <div className="text-[12px] text-slate-dim">{s.sub}</div>
                        </div>
                        {state === "done" ? (
                          <span className="text-[11px] uppercase tracking-[0.14em] text-brass">Done</span>
                        ) : state === "active" ? (
                          <span className="text-[11px] uppercase tracking-[0.14em] text-live">Working</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-bone/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-brass"
                    animate={{ width: `${(Math.max(0, stepIndex) / STEPS.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-slate-dim">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-live" />
                {statusLine} · settled on-chain in USDC
              </div>

              <DetailsDisclosure open={showDetails} onToggle={() => setShowDetails((v) => !v)} events={events} />
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-5 text-center">
                <span className="pill-brass">Ready</span>
                <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-bone">
                  Your ad is ready.
                </h1>
              </div>

              <div className="panel overflow-hidden">
                <div className={cn("relative mx-auto w-full overflow-hidden bg-black", format.ratio, format.key === "16:9" ? "" : "max-w-sm")}>
                  {videoUrl ? (
                    <video src={videoUrl} className="h-full w-full object-cover" autoPlay loop controls playsInline />
                  ) : (
                    <>
                      <img src={poster(title)} alt={title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="grid h-14 w-14 place-items-center rounded-full bg-bone/90 text-ink-950 shadow-glow-brass">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bone/[0.06] px-5 py-3 text-[12px]">
                  <span className="font-medium text-bone">
                    {title} · {est.realDurationSec}s · {format.label} · {resolution}
                  </span>
                  <span className="data">
                    {actualSpent != null ? `$${actualSpent.toFixed(2)} spent` : `~$${est.total.toFixed(2)} est.`}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button className="btn-primary shine-host h-11 px-6" onClick={save} disabled={saving || saved}>
                  {saved ? "Saved to collection ✓" : saving ? "Saving…" : "Save to collection"}
                </button>
                <button className="btn-ghost h-11 px-6">Download</button>
                <button className="btn-ghost h-11 px-6" onClick={startOver}>
                  New ad
                </button>
              </div>

              {saved && tx ? (
                <p className="mt-4 text-center text-[12px] text-slate-dim">
                  Minted to your wallet ·{" "}
                  <a
                    href={`https://basescan.org/tx/${tx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-live hover:underline"
                  >
                    {shortTx(tx)}
                  </a>
                </p>
              ) : null}

              <DetailsDisclosure open={showDetails} onToggle={() => setShowDetails((v) => !v)} events={events} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-slate-dim">{label}</div>
      {children}
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
  compact,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
  compact?: boolean
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", !compact && "rounded-full border border-bone/[0.08] p-1")}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full text-[12px] font-medium transition",
            compact ? "border border-bone/[0.08] px-2.5 py-1" : "flex-1 px-2 py-1.5",
            value === o.key ? "bg-brass text-ink-950" : "text-slate hover:text-bone",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StepDot({ state }: { state: "pending" | "active" | "done" }) {
  if (state === "done")
    return (
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brass text-ink-950">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l4 4L19 6" />
        </svg>
      </span>
    )
  if (state === "active")
    return (
      <span className="relative grid h-8 w-8 place-items-center rounded-full border border-live/40 bg-live/10">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-live border-t-transparent" />
      </span>
    )
  return <span className="grid h-8 w-8 place-items-center rounded-full border border-bone/[0.1] bg-bone/[0.02]" />
}

function DetailsDisclosure({
  open,
  onToggle,
  events,
}: {
  open: boolean
  onToggle: () => void
  events: AgentTimelineEvent[]
}) {
  return (
    <div className="mt-6">
      <button
        onClick={onToggle}
        className="mx-auto flex items-center gap-1.5 text-[12px] text-slate-dim transition hover:text-bone"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={cn("transition-transform", open && "rotate-90")}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        {open ? "Hide the on-chain detail" : "See what's happening on-chain"}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3">
              <AgentTimeline events={events} connected={events.length > 0} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
