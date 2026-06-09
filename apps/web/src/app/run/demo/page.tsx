"use client"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Address, Hex } from "viem"
import type { AgentTimelineEvent, SpecialistKind } from "@marque/shared"
import { Header } from "@/components/Header"
import { AgentTimeline } from "@/components/AgentTimeline"
import { type AgentStatus } from "@/components/AgentRoster"
import { ConsoleStage } from "@/components/ConsoleStage"
import { MintCard } from "@/components/MintCard"
import { GradientMesh } from "@/components/GradientMesh"
import { cn } from "@/lib/cn"
import { shortAddress } from "@/lib/format"

const SPECIALIST_ORDER: SpecialistKind[] = ["concept", "image", "voice", "music", "video"]

const MOCK = {
  operator: "0x8F2c4e1A6b9D03e5C7a1B4f80E2d9A3c6B5e7F10" as Address,
  director: "0x3a91Cf7E20bb4D6815aA2c9e0F1d83B7c4E62a55" as Address,
  specialist: "0xC4e7B1f93Aa0D2658c1E40b7d96F2a8B35e10C72" as Address,
}

const POSTER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1c1708'/><stop offset='1' stop-color='#08090b'/></linearGradient>
        <radialGradient id='r' cx='50%' cy='42%' r='55%'><stop offset='0' stop-color='rgba(201,164,92,0.35)'/><stop offset='1' stop-color='rgba(201,164,92,0)'/></radialGradient>
      </defs>
      <rect width='640' height='360' fill='url(#g)'/><rect width='640' height='360' fill='url(#r)'/>
      <circle cx='320' cy='150' r='52' fill='none' stroke='#c9a45c' stroke-width='2'/>
      <path d='M296 178 V126 L320 150 L344 126 V178' fill='none' stroke='#e2bd74' stroke-width='9'/>
      <text x='320' y='250' text-anchor='middle' fill='#ece6d8' font-family='sans-serif' font-size='18' letter-spacing='2'>FINISHED PIECE</text>
      <text x='320' y='276' text-anchor='middle' fill='#8b8d98' font-family='monospace' font-size='12'>Demo asset · marque</text>
    </svg>`,
  )

function randHex(bytes: number): Hex {
  let s = "0x"
  const hex = "0123456789abcdef"
  for (let i = 0; i < bytes * 2; i++) s += hex[Math.floor(Math.random() * 16)]
  return s as Hex
}

function idleRoster(): AgentStatus[] {
  return SPECIALIST_ORDER.map((kind) => ({ kind, state: "idle" as const, budgetUsdc: "0.40", veniceEndpoint: "" }))
}

const ENDPOINT: Record<SpecialistKind, string> = {
  concept: "/chat/completions",
  image: "/image/generate",
  voice: "/audio/speech",
  music: "/audio/music",
  video: "/video/complete",
}

type Phase = "connect" | "grant" | "brief" | "run" | "mint"
const STEPS: { key: Phase; label: string }[] = [
  { key: "connect", label: "Connect" },
  { key: "grant", label: "Grant" },
  { key: "brief", label: "Brief" },
  { key: "run", label: "Run" },
  { key: "mint", label: "Mint" },
]

export default function RunDemoPage() {
  const [connected, setConnected] = useState(false)
  const [granted, setGranted] = useState(false)
  const [prompt, setPrompt] = useState("30s ad for a cold brew brand called Lichen, moody indie tone")
  const [duration, setDuration] = useState(30)
  const [budgetUsdc, setBudgetUsdc] = useState(2.0)

  const [running, setRunning] = useState(false)
  const [composing, setComposing] = useState(false)
  const [roster, setRoster] = useState<AgentStatus[]>(idleRoster())
  const [events, setEvents] = useState<AgentTimelineEvent[]>([])
  const [spentUsdc, setSpentUsdc] = useState(0)
  const [composed, setComposed] = useState(false)
  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState(false)
  const [mintTx, setMintTx] = useState<Hex | undefined>()
  const [speed, setSpeed] = useState(1)

  const briefId = useRef<Hex>(randHex(32))
  const cancel = useRef(false)
  const speedRef = useRef(speed)
  useEffect(() => {
    speedRef.current = speed
  }, [speed])
  useEffect(
    () => () => {
      cancel.current = true
    },
    [],
  )

  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms / speedRef.current))
  const push = (kind: AgentTimelineEvent["kind"], details: Record<string, unknown>, specialistKind?: SpecialistKind) =>
    setEvents((prev) => [...prev, { briefId: briefId.current, ts: Date.now(), kind, specialistKind, details }])
  const setState = (kind: SpecialistKind, state: AgentStatus["state"]) =>
    setRoster((prev) => prev.map((r) => (r.kind === kind ? { ...r, state } : r)))

  const phase: Phase = !connected ? "connect" : !granted ? "grant" : running || composing ? "run" : composed ? "mint" : "brief"
  const completed = new Set<Phase>()
  if (connected) completed.add("connect")
  if (granted) completed.add("grant")
  if (running || composing || composed) completed.add("brief")
  if (composed) completed.add("run")
  if (minted) completed.add("mint")

  const reset = () => {
    cancel.current = true
    setConnected(false)
    setGranted(false)
    setRunning(false)
    setComposing(false)
    setRoster(idleRoster())
    setEvents([])
    setSpentUsdc(0)
    setComposed(false)
    setMinting(false)
    setMinted(false)
    setMintTx(undefined)
    briefId.current = randHex(32)
  }

  const runSwarm = async () => {
    if (!granted || running || composing) return
    cancel.current = false
    setRunning(true)
    setRoster(idleRoster())
    setEvents([])
    setSpentUsdc(0)
    setComposed(false)
    setMinted(false)
    setMintTx(undefined)

    push("operator.brief.submitted", { prompt: prompt.slice(0, 24) + "…" })
    await sleep(600)
    push("operator.upgrade.7702.signed", { target: shortAddress(MOCK.specialist) })
    await sleep(600)
    push("director.plan.ready", { specialists: SPECIALIST_ORDER.length })
    await sleep(900)

    const per = Number((budgetUsdc / SPECIALIST_ORDER.length).toFixed(2))
    for (const kind of SPECIALIST_ORDER) {
      if (cancel.current) {
        setRunning(false)
        return
      }
      setState(kind, "redelegating")
      push("specialist.redelegation.signed", { cap: `$${per.toFixed(2)}` }, kind)
      await sleep(650)
      setState(kind, "calling")
      push("specialist.venice.request", { endpoint: ENDPOINT[kind] }, kind)
      const settle = randHex(32)
      push("broker.relay.submitted", { hash: settle }, kind)
      await sleep(1100)
      push("broker.relay.confirmed", { hash: settle }, kind)
      push("specialist.venice.response", { settlementHash: settle }, kind)
      setState(kind, "done")
      setSpentUsdc((v) => Number((v + per).toFixed(2)))
      await sleep(450)
    }

    setRunning(false)
    setComposing(true)
    push("composer.scene.rendered", { scenes: 3 })
    await sleep(1100)
    push("composer.final.encoded", { durationMs: duration * 1000 })
    setComposing(false)
    setComposed(true)
  }

  const runMint = async () => {
    if (!composed || minted) return
    setMinting(true)
    push("mint.tx.submitted", {})
    await sleep(1000)
    const tx = randHex(32)
    setMintTx(tx)
    push("mint.tx.confirmed", { hash: tx })
    setMinted(true)
    setMinting(false)
  }

  const playAll = async () => {
    reset()
    cancel.current = false
    await sleep(400)
    setConnected(true)
    await sleep(800)
    setGranted(true)
    push("operator.root.delegation.signed", { cap: `$${budgetUsdc.toFixed(2)}` })
    await sleep(800)
    await runSwarm()
  }

  const doneCount = roster.filter((r) => r.state === "done").length
  const canDeploy = granted && !!prompt.trim() && !running && !composing

  return (
    <>
      <Header variant="app" />
      <div className="fixed inset-0 -z-10">
        <GradientMesh />
      </div>
      <main className="relative mx-auto max-w-[1480px] px-4 pb-8 pt-24">
        {/* DEMO BAR + STEPPER */}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-brass/20 bg-brass/[0.04] p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="pill-brass">Demo</span>
            <span className="text-[12px] text-bone/60">Simulated flow, no wallet or funds</span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <StepStrip phase={phase} completed={completed} />
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <div className="flex overflow-hidden rounded-full border border-bone/10">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "px-2.5 py-1 font-mono text-[11px] transition",
                    speed === s ? "bg-brass text-ink-950" : "text-slate hover:text-bone",
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
            <button className="btn-ghost h-9 px-4 text-[13px]" onClick={reset}>
              Reset
            </button>
            <button className="btn-primary shine-host h-9 px-4 text-[13px]" onClick={playAll}>
              Run full flow
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[320px_1fr_280px]">
          {/* LEFT */}
          <aside className="flex flex-col gap-3">
            <div className="panel-plain p-4">
              <PanelLabel>Mandate</PanelLabel>
              {!connected ? (
                <div className="mt-3 space-y-3">
                  <p className="text-[12px] leading-relaxed text-bone/55">
                    Connect a wallet on Base mainnet to issue a spending mandate to the crew.
                  </p>
                  <button className="btn-primary shine-host w-full" onClick={() => setConnected(true)}>
                    Connect wallet
                  </button>
                </div>
              ) : !granted ? (
                <div className="mt-3 space-y-3">
                  <div className="writ space-y-2 p-3 text-[12px]">
                    <Row label="Cap" value="$5 / day" />
                    <Row label="Token" value="USDC · Base" />
                    <Row label="Expiry" value="1 hour" />
                  </div>
                  <button
                    className="btn-primary shine-host w-full"
                    onClick={() => {
                      setGranted(true)
                      push("operator.root.delegation.signed", { cap: `$${budgetUsdc.toFixed(2)}` })
                    }}
                  >
                    Grant mandate
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-live/25 bg-live/[0.06] px-3 py-2">
                  <span className="flex items-center gap-2 text-[12px] text-live">
                    <span className="h-1.5 w-1.5 rounded-full bg-live shadow-glow-live" />
                    Mandate active
                  </span>
                  <span className="data text-live/80">${budgetUsdc.toFixed(2)} cap</span>
                </div>
              )}
            </div>

            <div className={cn("panel-plain p-4 transition", !granted && "pointer-events-none opacity-40")}>
              <PanelLabel>Intent</PanelLabel>
              <textarea
                className="field mt-3 min-h-[92px] resize-y"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={!granted || running || composing}
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Slider
                  label="Duration"
                  value={`${duration}s`}
                  input={
                    <input type="range" min="10" max="45" step="5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={!granted || running || composing} className="w-full accent-brass" />
                  }
                />
                <Slider
                  label="Budget"
                  value={`$${budgetUsdc.toFixed(2)}`}
                  input={
                    <input type="range" min="1" max="5" step="0.25" value={budgetUsdc} onChange={(e) => setBudgetUsdc(Number(e.target.value))} disabled={!granted || running || composing} className="w-full accent-brass" />
                  }
                />
              </div>
              <button className="btn-primary shine-host mt-4 w-full" onClick={runSwarm} disabled={!canDeploy}>
                {running ? "Crew running…" : composing ? "Composing…" : "Deploy crew"}
              </button>
            </div>

            <MandateChain operator={connected ? MOCK.operator : null} director={granted ? MOCK.director : null} specialist={granted ? MOCK.specialist : null} />
          </aside>

          {/* CENTER STAGE */}
          <section className="panel relative min-h-[640px] overflow-hidden">
            <div className="absolute inset-0 dotgrid opacity-30" />
            <div className="relative flex items-center justify-between border-b border-bone/[0.06] px-5 py-3">
              <PanelLabel>Orchestration canvas</PanelLabel>
              <div className="flex items-center gap-3">
                <PhaseHint phase={phase} composing={composing} />
                <span className="data">{doneCount}/{roster.length}</span>
              </div>
            </div>
            <div className="relative h-[540px]">
              <ConsoleStage statuses={roster} composed={composed} minted={minted} />
            </div>

            <AnimatePresence>
              {composed ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-xl border border-brass/30 bg-ink-900/90 p-3 backdrop-blur"
                >
                  <span className="flex h-2 w-2 shrink-0 rounded-full bg-brass shadow-glow-brass" />
                  <span className="text-[12px] text-bone/80">Final asset composed and ready to mint</span>
                  <button className="btn-primary ml-auto h-9 px-4 text-[13px]" onClick={runMint} disabled={minting || minted}>
                    {minted ? "Minted ✓" : minting ? "Minting…" : "Mint"}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          {/* RIGHT */}
          <aside className="hidden flex-col gap-3 lg:flex">
            <div className="panel-plain p-4">
              <PanelLabel>Run parameters</PanelLabel>
              <div className="mt-3 space-y-2 text-[12px]">
                <Row label="Chain" value="Base mainnet" />
                <Row label="Settlement" value="USDC" />
                <Row label="Per specialist" value={`$${(budgetUsdc / 5).toFixed(2)}`} />
                <Row label="Updates" value="Live webhook" />
              </div>
            </div>
            <div className="panel-plain p-4">
              <PanelLabel>Spend</PanelLabel>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <motion.span
                    key={spentUsdc}
                    initial={{ opacity: 0.4, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-mono text-xl text-bone"
                  >
                    ${spentUsdc.toFixed(2)}
                  </motion.span>
                  <span className="data">of ${budgetUsdc.toFixed(2)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-brass"
                    animate={{ width: `${Math.min(100, (spentUsdc / budgetUsdc) * 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
            <div className="panel-plain flex-1 p-4">
              <PanelLabel>Status</PanelLabel>
              <div className="mt-3 space-y-2.5">
                {roster.map((r) => (
                  <div key={r.kind} className="flex items-center justify-between text-[12px]">
                    <span className="capitalize text-bone/70">{r.kind}</span>
                    <StatusTag state={r.state} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* LOG + ASSET */}
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
          <AgentTimeline events={events} connected={running || composing} />
          {composed ? (
            <MintCard poster={POSTER} totalSpendUsdc={budgetUsdc.toFixed(2)} txHash={mintTx} isMinting={minting} minted={minted} onMint={runMint} />
          ) : (
            <div className="panel-plain grid place-items-center p-6 text-center text-[12px] text-slate-dim">
              The final asset and its on-chain provenance appear here once the crew finishes.
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function StepStrip({ phase, completed }: { phase: Phase; completed: Set<Phase> }) {
  const idx = STEPS.findIndex((s) => s.key === phase)
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((s, i) => {
        const done = completed.has(s.key)
        const active = s.key === phase
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold transition",
                done
                  ? "bg-brass text-ink-950"
                  : active
                    ? "bg-brass/15 text-brass ring-1 ring-brass/50"
                    : "bg-bone/5 text-slate-dim",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={cn("hidden text-[12px] sm:inline", active ? "text-bone" : done ? "text-bone/70" : "text-slate-dim")}>
              {s.label}
            </span>
            {i < STEPS.length - 1 ? <span className={cn("mx-1 h-px w-5", i < idx ? "bg-brass/40" : "bg-bone/10")} /> : null}
          </li>
        )
      })}
    </ol>
  )
}

function PhaseHint({ phase, composing }: { phase: Phase; composing: boolean }) {
  const text =
    composing
      ? "Composing the final cut"
      : phase === "connect"
        ? "Connect to begin"
        : phase === "grant"
          ? "Grant a budget"
          : phase === "brief"
            ? "Describe the piece, then deploy"
            : phase === "run"
              ? "Crew at work"
              : "Ready to mint"
  return <span className="hidden font-mono text-[11px] text-brass sm:inline">{text}</span>
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1 w-1 rounded-full bg-brass" />
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate">{children}</span>
    </div>
  )
}

function Slider({ label, value, input }: { label: string; value: string; input: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-dim">{label}</span>
        <span className="font-mono text-[11px] text-bone">{value}</span>
      </div>
      {input}
    </div>
  )
}

function StatusTag({ state }: { state: AgentStatus["state"] }) {
  const map: Record<AgentStatus["state"], { t: string; c: string; d: string }> = {
    idle: { t: "Queued", c: "text-slate-dim", d: "bg-slate-dim" },
    redelegating: { t: "Signing", c: "text-brass", d: "bg-brass" },
    calling: { t: "Calling", c: "text-live", d: "bg-live shadow-glow-live animate-pulse-soft" },
    settled: { t: "Settled", c: "text-live", d: "bg-live shadow-glow-live" },
    done: { t: "Done", c: "text-brass", d: "bg-brass shadow-glow-brass" },
    error: { t: "Error", c: "text-red-300", d: "bg-red-400" },
  }
  const v = map[state]
  return (
    <span className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]", v.c)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", v.d)} />
      {v.t}
    </span>
  )
}

function MandateChain({ operator, director, specialist }: { operator: Address | null; director: Address | null; specialist: Address | null }) {
  return (
    <div className="panel-plain p-4">
      <PanelLabel>Authority chain</PanelLabel>
      <div className="mt-3 grid gap-2.5 text-[12px]">
        <ChainLink label="Operator" address={operator} tint="text-live" />
        <Connector />
        <ChainLink label="Director" address={director} tint="text-brass" />
        <Connector />
        <ChainLink label="Specialist" address={specialist} tint="text-brass-bright" />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-dim">
        Each link narrows the one above it. The operator signs once.
      </p>
    </div>
  )
}

function ChainLink({ label, address, tint }: { label: string; address: string | null; tint: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-current", tint)} />
      <span className={cn("text-[12px] font-medium", tint)}>{label}</span>
      <span className="ml-auto font-mono text-[11px] text-bone/60">{shortAddress(address)}</span>
    </div>
  )
}

function Connector() {
  return <div className="ml-[3px] h-2.5 w-px bg-bone/[0.12]" />
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] uppercase tracking-[0.12em] text-slate-dim">{label}</span>
      <span className="font-mono text-[12px] text-bone">{value}</span>
    </div>
  )
}
