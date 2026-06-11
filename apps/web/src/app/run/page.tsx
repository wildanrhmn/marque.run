"use client"
import { useEffect, useRef, useState } from "react"
import { useAccount, useConnect, useWriteContract, useWalletClient } from "wagmi"
import type { Address, Hex } from "viem"
import type { AgentTimelineEvent, SpecialistKind } from "@marque/shared"
import { Header } from "@/components/Header"
import { AgentTimeline } from "@/components/AgentTimeline"
import { type AgentStatus } from "@/components/AgentRoster"
import { ConsoleGraph } from "@/components/ConsoleGraph"
import { MintCard } from "@/components/MintCard"
import { GradientMesh } from "@/components/GradientMesh"
import { generateBriefId } from "@/lib/briefId"
import { deriveSessionAccount } from "@/lib/identities"
import {
  buildSessionBudget,
  sessionUsdcBalance,
  usdcTransferCalldata,
  waitForTx,
  type SessionBudget,
} from "@/lib/smartaccount"
import { runSwarm, type SwarmOutputs } from "@/lib/orchestrator"
import type { PrivateKeyAccount } from "viem/accounts"
import { useBriefStream } from "@/lib/sse"
import { composeFinalAd, type ComposeResult } from "@/lib/compose"
import { mintArgsForWagmi } from "@/lib/mint"
import { publicEnv } from "@/lib/env"
import { shortAddress } from "@/lib/format"
import { cn } from "@/lib/cn"

const USDC_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const BASE_CHAIN_ID = 8453
const SPECIALIST_ORDER: SpecialistKind[] = ["concept", "image", "voice", "music", "video"]

const SUGGESTIONS = [
  "30s ad for a cold brew brand called Lichen, moody indie tone",
  "30s ad for an open-source DAW called Wavelength, retro arcade vibe",
  "30s ad for a vegan jerky brand called Husk, gritty desert aesthetic",
]

function initialRoster(): AgentStatus[] {
  return [
    { kind: "concept", state: "idle", budgetUsdc: "0.40", veniceEndpoint: "/chat/completions" },
    { kind: "image", state: "idle", budgetUsdc: "0.40", veniceEndpoint: "/image/generate" },
    { kind: "voice", state: "idle", budgetUsdc: "0.40", veniceEndpoint: "/audio/speech" },
    { kind: "music", state: "idle", budgetUsdc: "0.40", veniceEndpoint: "/audio/music" },
    { kind: "video", state: "idle", budgetUsdc: "0.40", veniceEndpoint: "/video/complete" },
  ]
}

export default function RunPage() {
  const account = useAccount()
  const { connectors, connect } = useConnect()
  const { writeContractAsync } = useWriteContract()
  const { data: walletClient } = useWalletClient()

  const [sessionAccount, setSessionAccount] = useState<PrivateKeyAccount | null>(null)
  const [sessionBalance, setSessionBalance] = useState<bigint>(0n)
  const [funding, setFunding] = useState(false)

  const [grant, setGrant] = useState<SessionBudget | null>(null)
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState(30)
  const [budgetUsdc, setBudgetUsdc] = useState(2.0)
  const [cheapTest, setCheapTest] = useState(true)

  const [briefId, setBriefId] = useState<Hex | null>(null)
  const [running, setRunning] = useState(false)
  const [composing, setComposing] = useState(false)
  const [outputs, setOutputs] = useState<SwarmOutputs | null>(null)
  const [composeResult, setComposeResult] = useState<ComposeResult | null>(null)
  const [roster, setRoster] = useState<AgentStatus[]>(initialRoster())
  const [spentUsdc, setSpentUsdc] = useState(0)

  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState(false)
  const [mintTx, setMintTx] = useState<Hex | undefined>()
  const [mintError, setMintError] = useState<string | null>(null)

  const settlementHashesRef = useRef<Set<Hex>>(new Set())
  const stream = useBriefStream(briefId)

  useEffect(() => {
    for (const ev of stream.events) collectSettlementHashes(ev, settlementHashesRef.current)
  }, [stream.events])

  const sessionAddress = sessionAccount?.address ?? null
  const budgetAtoms = BigInt(Math.floor(budgetUsdc * 1_000_000))

  const refreshSessionBalance = async (addr: Address) => {
    try {
      setSessionBalance(await sessionUsdcBalance(addr))
    } catch {
      /* ignore */
    }
  }

  const ensureSession = async (): Promise<PrivateKeyAccount> => {
    if (sessionAccount) return sessionAccount
    if (!account.address || !walletClient) throw new Error("connect wallet first")
    const session = await deriveSessionAccount(account.address, (message) =>
      walletClient.signMessage({ message }),
    )
    setSessionAccount(session)
    await refreshSessionBalance(session.address)
    return session
  }

  const doneCount = roster.filter((r) => r.state === "done").length
  const phase = !account.isConnected
    ? "connect"
    : !grant
      ? "grant"
      : running || composing
        ? "run"
        : composeResult
          ? "mint"
          : "brief"

  const handleConnect = () => {
    const mm = connectors.find((c) => c.id === "metaMask") ?? connectors[0]
    if (mm) connect({ connector: mm })
  }

  const handleFund = async () => {
    if (!account.address || !walletClient) return
    setFunding(true)
    setGrantError(null)
    try {
      const session = await ensureSession()
      const hash = await walletClient.sendTransaction({
        account: account.address,
        to: USDC_BASE,
        data: usdcTransferCalldata(session.address, budgetAtoms),
      })
      await waitForTx(hash)
      await refreshSessionBalance(session.address)
    } catch (err) {
      setGrantError((err as Error).message)
    } finally {
      setFunding(false)
    }
  }

  const handleGrant = async () => {
    if (!account.address || !walletClient) return
    setGranting(true)
    setGrantError(null)
    try {
      const session = await ensureSession()
      const budget = await buildSessionBudget({ session, budgetAtoms })
      setGrant(budget)
    } catch (err) {
      setGrantError((err as Error).message)
    } finally {
      setGranting(false)
    }
  }

  const handleDeploy = async () => {
    if (!grant || !account.address || !prompt.trim()) return
    const budgetUsdcAtoms = budgetAtoms
    settlementHashesRef.current = new Set()
    const id = generateBriefId({ operator: account.address, prompt: prompt.trim() })
    setBriefId(id)
    setRunning(true)
    setOutputs(null)
    setComposeResult(null)
    setMintTx(undefined)
    setMinted(false)
    setMintError(null)
    setSpentUsdc(0)
    setRoster(initialRoster())

    let swarm: SwarmOutputs | null = null
    try {
      const perSpecialistAtoms = budgetUsdcAtoms / BigInt(SPECIALIST_ORDER.length)
      swarm = await runSwarm({
        briefId: id,
        prompt: prompt.trim(),
        durationSeconds: duration,
        perSpecialistAtoms,
        budget: grant,
        conceptOnly: cheapTest,
        onSpecialistStart: (kind) => {
          setRoster((prev) => prev.map((r) => (r.kind === kind ? { ...r, state: "calling" } : r)))
        },
        onSpecialistDone: (kind, output) => {
          setRoster((prev) =>
            prev.map((r) =>
              r.kind === kind ? { ...r, state: "done", output: shapePreview(kind, output) } : r,
            ),
          )
          setSpentUsdc((v) => Number((v + Number(perSpecialistAtoms) / 1_000_000).toFixed(2)))
        },
        onError: (kind, err) => {
          setRoster((prev) =>
            prev.map((r) => (r.kind === kind ? { ...r, state: "error", error: err.message } : r)),
          )
        },
      })
      setOutputs(swarm)
    } finally {
      setRunning(false)
    }

    if (!swarm || cheapTest) return
    setComposing(true)
    try {
      const scenesRaw =
        (swarm.concept as { scenes?: { description: string; voiceLine: string; durationMs?: number }[] } | undefined)
          ?.scenes ?? []
      const images = swarm.images as { base64: string }[]
      const voice = swarm.voice as { base64: string } | undefined
      const music = swarm.music as { base64: string } | undefined
      const video = swarm.video as { base64: string } | undefined

      const scenes = scenesRaw
        .slice(0, Math.max(images.length, 1))
        .map((s, i) => ({
          imageBase64: images[i]?.base64 ?? images[0]?.base64 ?? "",
          voiceLineMs:
            s.durationMs ?? Math.max(3000, Math.round((duration * 1000) / Math.max(scenesRaw.length, 1))),
          description: s.description,
        }))
        .filter((s) => s.imageBase64.length > 0)

      const args: Parameters<typeof composeFinalAd>[0] = {
        briefId: id,
        operator: account.address,
        prompt: prompt.trim(),
        scenes,
        settlementHashes: [...settlementHashesRef.current],
        totalSpendUsdc: budgetUsdc.toFixed(2),
      }
      if (voice?.base64) args.voiceBase64 = voice.base64
      if (music?.base64) args.musicBase64 = music.base64
      if (video?.base64) args.videoBase64 = video.base64

      const result = await composeFinalAd(args)
      setComposeResult(result)
    } catch (err) {
      setMintError((err as Error).message)
    } finally {
      setComposing(false)
    }
  }

  const handleMint = async () => {
    if (!account.address || !briefId || !composeResult) return
    setMinting(true)
    setMintError(null)
    try {
      const contract = publicEnv.NEXT_PUBLIC_MINT_CONTRACT as Address
      if (contract === "0x0000000000000000000000000000000000000000") {
        throw new Error("mint contract not yet deployed; set NEXT_PUBLIC_MINT_CONTRACT")
      }
      const settlementHashes = [...settlementHashesRef.current]
      const args = mintArgsForWagmi({
        to: account.address,
        briefId,
        totalSpendAtoms: BigInt(Math.floor(budgetUsdc * 1_000_000)),
        settlementTxHashes: settlementHashes.length > 0 ? settlementHashes : [briefId],
        uri: composeResult.tokenUri ?? composeResult.metadataUrl,
      })
      const tx = await writeContractAsync({ address: contract, ...args })
      setMintTx(tx)
      setMinted(true)
    } catch (err) {
      setMintError((err as Error).message)
    } finally {
      setMinting(false)
    }
  }

  const canDeploy = !!grant && !!prompt.trim() && !running && !composing

  return (
    <>
      <Header variant="app" />
      <div className="fixed inset-0 -z-10">
        <GradientMesh />
      </div>
      <main className="relative mx-auto max-w-[1440px] px-4 pb-6 pt-24">
        <div className="grid gap-3 lg:grid-cols-[320px_1fr_280px]">
          {/* LEFT — controls */}
          <aside className="flex flex-col gap-3">
            <div className="panel-plain p-4">
              <PanelLabel>mandate</PanelLabel>
              {phase === "connect" ? (
                <div className="mt-3 space-y-3">
                  <p className="text-[12px] leading-relaxed text-bone/55">
                    Connect a wallet on Base mainnet to issue a spending mandate to the crew.
                  </p>
                  <button className="btn-primary shine-host w-full" onClick={handleConnect}>
                    connect wallet
                  </button>
                </div>
              ) : !grant ? (
                <div className="mt-3 space-y-3">
                  <div className="writ space-y-2 p-3 text-[12px]">
                    <Row label="session" value={sessionAddress ? shortAddress(sessionAddress) : "not created"} />
                    <Row label="balance" value={`$${(Number(sessionBalance) / 1e6).toFixed(2)} USDC`} />
                    <Row label="budget" value={`$${budgetUsdc.toFixed(2)} USDC`} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-dim">
                      <span className="uppercase tracking-[0.12em]">budget</span>
                      <span className="data text-bone/80">${budgetUsdc.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.25"
                      value={budgetUsdc}
                      onChange={(e) => setBudgetUsdc(Number(e.target.value))}
                      disabled={!!grant || funding || granting}
                      className="w-full accent-brass"
                    />
                  </div>
                  {!sessionAddress ? (
                    <button
                      className="btn-primary shine-host w-full"
                      onClick={() => ensureSession().catch((e) => setGrantError((e as Error).message))}
                      disabled={!walletClient}
                    >
                      create session account
                    </button>
                  ) : sessionBalance < budgetAtoms ? (
                    <button
                      className="btn-primary shine-host w-full"
                      onClick={handleFund}
                      disabled={funding || !walletClient}
                    >
                      {funding ? "funding…" : `fund $${budgetUsdc.toFixed(2)}`}
                    </button>
                  ) : (
                    <button
                      className="btn-primary shine-host w-full"
                      onClick={handleGrant}
                      disabled={granting || !walletClient}
                    >
                      {granting ? "authorizing…" : "authorize budget"}
                    </button>
                  )}
                  <p className="text-[11px] leading-relaxed text-slate-dim">
                    Marque derives an in-browser Smart Account from your signature, you fund it, it delegates a
                    capped budget the agents redeem through 1Shot.
                  </p>
                  {grantError ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
                      {grantError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-live/25 bg-live/[0.06] px-3 py-2">
                  <span className="flex items-center gap-2 text-[12px] text-live">
                    <span className="h-1.5 w-1.5 rounded-full bg-live shadow-glow-live" />
                    mandate active
                  </span>
                  <span className="data text-live/80">${budgetUsdc.toFixed(2)} cap</span>
                </div>
              )}
            </div>

            <div className={cn("panel-plain p-4 transition", !grant && "pointer-events-none opacity-40")}>
              <PanelLabel>intent</PanelLabel>
              <textarea
                className="field mt-3 min-h-[96px] resize-y"
                placeholder="describe the piece in one sentence"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={!grant || running || composing}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrompt(s)}
                    disabled={!grant || running || composing}
                    className="rounded-full border border-bone/[0.08] px-2 py-0.5 text-[10px] text-slate transition hover:border-brass/30 hover:text-bone"
                  >
                    sample {i + 1}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Slider
                  label="duration"
                  value={`${duration}s`}
                  input={
                    <input
                      type="range"
                      min="10"
                      max="45"
                      step="5"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      disabled={!grant || running || composing}
                      className="w-full accent-brass"
                    />
                  }
                />
                <Slider
                  label="budget"
                  value={`$${budgetUsdc.toFixed(2)}`}
                  input={
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.25"
                      value={budgetUsdc}
                      onChange={(e) => setBudgetUsdc(Number(e.target.value))}
                      disabled={!grant || running || composing}
                      className="w-full accent-brass"
                    />
                  }
                />
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-bone/[0.07] bg-bone/[0.02] p-3">
                <input
                  type="checkbox"
                  checked={cheapTest}
                  onChange={(e) => setCheapTest(e.target.checked)}
                  disabled={!grant || running || composing}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brass"
                />
                <span className="text-[12px] leading-relaxed text-bone/70">
                  <span className="font-medium text-bone">Chain test only</span> — run just the concept agent to
                  prove the delegation settles on-chain. Costs a fraction of a cent. Turn off for a full render.
                </span>
              </label>
              <button className="btn-primary shine-host mt-3 w-full" onClick={handleDeploy} disabled={!canDeploy}>
                {running ? "crew running…" : composing ? "composing…" : cheapTest ? "run chain test" : "deploy crew"}
                {canDeploy ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                ) : null}
              </button>
            </div>

            <MandateChain
              operator={account.address ?? null}
              director={sessionAddress}
              specialist={grant?.smartAccountAddress ?? null}
              broker={publicEnv.NEXT_PUBLIC_BROKER_FLOAT_ADDRESS}
            />
          </aside>

          {/* CENTER — canvas */}
          <section className="panel relative min-h-[560px] overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at 50% 35%, rgba(201,164,92,0.05), transparent 60%)" }}
            />
            <div className="absolute inset-0 dotgrid opacity-40" />
            <div className="relative flex items-center justify-between px-5 py-3">
              <PanelLabel>orchestration canvas</PanelLabel>
              <span className="data">
                {doneCount}/{roster.length} specialists
              </span>
            </div>
            <div className="relative h-[440px] px-4">
              <ConsoleGraph statuses={roster} />
            </div>

            {composeResult ? (
              <div className="relative mx-4 mb-4 flex items-center gap-3 rounded-xl border border-brass/30 bg-brass/[0.06] p-3">
                <span className="flex h-2 w-2 shrink-0 rounded-full bg-brass shadow-glow-brass" />
                <span className="text-[12px] text-bone/80">final asset composed and ready to mint</span>
                <button
                  className="btn-primary ml-auto h-9 px-4 text-[13px]"
                  onClick={handleMint}
                  disabled={minting || minted}
                >
                  {minted ? "minted ✓" : minting ? "minting…" : "mint"}
                </button>
              </div>
            ) : null}
          </section>

          {/* RIGHT — parameters */}
          <aside className="hidden flex-col gap-3 lg:flex">
            <div className="panel-plain p-4">
              <PanelLabel>run parameters</PanelLabel>
              <div className="mt-3 space-y-2 text-[12px]">
                <Row label="chain" value="Base mainnet" />
                <Row label="settlement" value="USDC" />
                <Row label="per specialist" value={`$${(budgetUsdc / 5).toFixed(2)}`} />
                <Row label="updates" value="live webhook" />
              </div>
            </div>

            <div className="panel-plain p-4">
              <PanelLabel>spend</PanelLabel>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xl text-bone">${spentUsdc.toFixed(2)}</span>
                  <span className="data">of ${budgetUsdc.toFixed(2)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone/[0.06]">
                  <div
                    className="h-full rounded-full bg-brass transition-all duration-500"
                    style={{ width: `${Math.min(100, (spentUsdc / budgetUsdc) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="panel-plain flex-1 p-4">
              <PanelLabel>status</PanelLabel>
              <div className="mt-3 space-y-2">
                {roster.map((r) => (
                  <div key={r.kind} className="flex items-center justify-between text-[12px]">
                    <span className="uppercase tracking-[0.12em] text-bone/70">{r.kind}</span>
                    <StatusTag state={r.state} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* LOG DRAWER */}
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
          <AgentTimeline events={stream.events} connected={stream.connected} />
          {composeResult ? (
            <MintCard
              videoBlobUrl={composeResult.assetUrl}
              totalSpendUsdc={budgetUsdc.toFixed(2)}
              txHash={mintTx}
              isMinting={minting}
              minted={minted}
              onMint={handleMint}
            />
          ) : (
            <div className="panel-plain grid place-items-center p-6 text-center text-[12px] text-slate-dim">
              the final asset and its on-chain provenance appear here once the crew finishes.
            </div>
          )}
        </div>
        {mintError ? (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {mintError}
          </div>
        ) : null}
      </main>
    </>
  )
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
    idle: { t: "queued", c: "text-slate-dim", d: "bg-slate-dim" },
    redelegating: { t: "signing", c: "text-brass", d: "bg-brass" },
    calling: { t: "calling", c: "text-live", d: "bg-live shadow-glow-live animate-pulse-soft" },
    settled: { t: "settled", c: "text-live", d: "bg-live shadow-glow-live" },
    done: { t: "done", c: "text-brass", d: "bg-brass shadow-glow-brass" },
    error: { t: "error", c: "text-red-300", d: "bg-red-400" },
  }
  const v = map[state]
  return (
    <span className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]", v.c)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", v.d)} />
      {v.t}
    </span>
  )
}

function MandateChain({
  operator,
  director,
  specialist,
  broker,
}: {
  operator: Address | null
  director: Address | null
  specialist: Address | null
  broker: string
}) {
  return (
    <div className="panel-plain p-4">
      <PanelLabel>authority chain</PanelLabel>
      <div className="mt-3 grid gap-2.5 text-[12px]">
        <ChainLink label="operator" address={operator} tint="text-live" />
        <Connector />
        <ChainLink label="director" address={director} tint="text-brass" />
        <Connector />
        <ChainLink label="specialist" address={specialist} tint="text-brass-bright" />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-dim">
        each link narrows the one above it. the operator signs once.
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

function collectSettlementHashes(event: AgentTimelineEvent, set: Set<Hex>): void {
  const details = event.details
  if (event.kind === "broker.relay.confirmed" || event.kind === "broker.relay.submitted") {
    const hash = details["hash"]
    if (typeof hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(hash)) set.add(hash as Hex)
  }
  if (event.kind === "specialist.venice.response") {
    const hash = details["settlementHash"]
    if (typeof hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(hash)) set.add(hash as Hex)
  }
}

function shapePreview(kind: SpecialistKind, output: unknown): AgentStatus["output"] | undefined {
  if (kind === "concept") {
    const concept = output as { hook?: string }
    return { previewType: "text", text: concept?.hook }
  }
  if (kind === "image") {
    const img = output as { base64?: string; mimeType?: string }
    if (img?.base64)
      return { previewType: "image", previewUrl: `data:${img.mimeType ?? "image/png"};base64,${img.base64}` }
  }
  return undefined
}
