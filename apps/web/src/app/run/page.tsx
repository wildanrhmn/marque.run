"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAccount, useConnect, useWriteContract } from "wagmi"
import type { Address, Hex } from "viem"
import type { AgentTimelineEvent, SpecialistKind } from "@marque/shared"
import { Header } from "@/components/Header"
import { StepIndicator, type StepKey } from "@/components/StepIndicator"
import { AgentTimeline } from "@/components/AgentTimeline"
import { AgentRoster, type AgentStatus } from "@/components/AgentRoster"
import { BriefForm, type BriefSubmission } from "@/components/BriefForm"
import { MintCard } from "@/components/MintCard"
import { Logo } from "@/components/Logo"
import { generateBriefId } from "@/lib/briefId"
import { getSessionIdentities } from "@/lib/identities"
import { requestBudgetPermission, type GrantedPermissionContext } from "@/lib/permissions"
import { runSwarm, type SwarmOutputs } from "@/lib/orchestrator"
import { useBriefStream } from "@/lib/sse"
import { composeFinalAd, type ComposeResult } from "@/lib/compose"
import { mintArgsForWagmi } from "@/lib/mint"
import { publicEnv } from "@/lib/env"
import { shortAddress, shortTx } from "@/lib/format"
import { cn } from "@/lib/cn"

const USDC_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const BASE_CHAIN_ID = 8453

const SPECIALIST_ORDER: SpecialistKind[] = ["concept", "image", "voice", "music", "video"]

function initialRoster(): AgentStatus[] {
  return [
    { kind: "concept", state: "idle", budgetUsdc: "0.20", veniceEndpoint: "/chat/completions" },
    { kind: "image", state: "idle", budgetUsdc: "0.50", veniceEndpoint: "/image/generate" },
    { kind: "voice", state: "idle", budgetUsdc: "0.10", veniceEndpoint: "/audio/speech" },
    { kind: "music", state: "idle", budgetUsdc: "0.30", veniceEndpoint: "/audio/music" },
    { kind: "video", state: "idle", budgetUsdc: "0.80", veniceEndpoint: "/video/complete" },
  ]
}

export default function RunPage() {
  const account = useAccount()
  const { connectors, connect } = useConnect()
  const { writeContractAsync } = useWriteContract()

  const [grant, setGrant] = useState<GrantedPermissionContext | null>(null)
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  const [briefId, setBriefId] = useState<Hex | null>(null)
  const [brief, setBrief] = useState<BriefSubmission | null>(null)
  const [running, setRunning] = useState(false)
  const [composing, setComposing] = useState(false)
  const [outputs, setOutputs] = useState<SwarmOutputs | null>(null)
  const [composeResult, setComposeResult] = useState<ComposeResult | null>(null)
  const [roster, setRoster] = useState<AgentStatus[]>(initialRoster())

  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState(false)
  const [mintTx, setMintTx] = useState<Hex | undefined>()
  const [mintError, setMintError] = useState<string | null>(null)

  const settlementHashesRef = useRef<Set<Hex>>(new Set())

  const stream = useBriefStream(briefId)

  useEffect(() => {
    for (const ev of stream.events) {
      collectSettlementHashes(ev, settlementHashesRef.current)
    }
  }, [stream.events])

  const step: StepKey = useMemo(() => {
    if (!account.isConnected) return "connect"
    if (!grant) return "grant"
    if (!brief) return "brief"
    if (running || composing) return "run"
    return "mint"
  }, [account.isConnected, grant, brief, running, composing])

  const completed = useMemo(() => {
    const set = new Set<StepKey>()
    if (account.isConnected) set.add("connect")
    if (grant) set.add("grant")
    if (brief) set.add("brief")
    if (outputs) set.add("run")
    if (minted) set.add("mint")
    return set
  }, [account.isConnected, grant, brief, outputs, minted])

  const sessionIds = typeof window !== "undefined" ? getSessionIdentities() : null

  const handleConnect = () => {
    const mm = connectors.find((c) => c.id === "metaMask") ?? connectors[0]
    if (mm) connect({ connector: mm })
  }

  const handleGrant = async () => {
    if (!account.address || !sessionIds) return
    setGranting(true)
    setGrantError(null)
    try {
      const granted = await requestBudgetPermission({
        delegateAddress: sessionIds.director.address,
        chainId: BASE_CHAIN_ID,
        perDayUsdcAtoms: 5_000_000n,
        ttlSeconds: 3600,
        paymentToken: USDC_BASE,
      })
      setGrant(granted)
    } catch (err) {
      setGrantError((err as Error).message)
    } finally {
      setGranting(false)
    }
  }

  const handleBrief = async (submission: BriefSubmission) => {
    if (!grant || !account.address || !sessionIds) return
    setBrief(submission)
    settlementHashesRef.current = new Set()
    const id = generateBriefId({ operator: account.address, prompt: submission.prompt })
    setBriefId(id)
    setRunning(true)
    setOutputs(null)
    setComposeResult(null)
    setMintTx(undefined)
    setMinted(false)
    setMintError(null)
    setRoster(initialRoster())

    let swarm: SwarmOutputs | null = null
    try {
      const perSpecialistAtoms = submission.budgetUsdcAtoms / BigInt(SPECIALIST_ORDER.length)
      swarm = await runSwarm({
        briefId: id,
        prompt: submission.prompt,
        durationSeconds: submission.durationSeconds,
        perSpecialistAtoms,
        rootGrant: grant,
        delegationManager: grant.delegationManager,
        chainId: BASE_CHAIN_ID,
        onSpecialistStart: (kind) => {
          setRoster((prev) => prev.map((r) => (r.kind === kind ? { ...r, state: "calling" } : r)))
        },
        onSpecialistDone: (kind, output) => {
          setRoster((prev) =>
            prev.map((r) =>
              r.kind === kind
                ? { ...r, state: "done", output: shapePreview(kind, output) }
                : r,
            ),
          )
        },
        onError: (kind, err) => {
          setRoster((prev) =>
            prev.map((r) =>
              r.kind === kind ? { ...r, state: "error", error: err.message } : r,
            ),
          )
        },
      })
      setOutputs(swarm)
    } finally {
      setRunning(false)
    }

    if (!swarm) return

    setComposing(true)
    try {
      const scenesRaw = (swarm.concept as { scenes?: { description: string; voiceLine: string; durationMs?: number }[] } | undefined)?.scenes ?? []
      const images = swarm.images as { base64: string }[]
      const voice = swarm.voice as { base64: string } | undefined
      const music = swarm.music as { base64: string } | undefined
      const video = swarm.video as { base64: string } | undefined

      const scenes = scenesRaw
        .slice(0, Math.max(images.length, 1))
        .map((s, i) => ({
          imageBase64: images[i]?.base64 ?? images[0]?.base64 ?? "",
          voiceLineMs: s.durationMs ?? Math.max(3000, Math.round((submission.durationSeconds * 1000) / Math.max(scenesRaw.length, 1))),
          description: s.description,
        }))
        .filter((s) => s.imageBase64.length > 0)

      const args: Parameters<typeof composeFinalAd>[0] = {
        briefId: id,
        operator: account.address,
        prompt: submission.prompt,
        scenes,
        settlementHashes: [...settlementHashesRef.current],
        totalSpendUsdc: (Number(submission.budgetUsdcAtoms) / 1_000_000).toFixed(2),
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
    if (!account.address || !brief || !briefId || !composeResult) return
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
        totalSpendAtoms: brief.budgetUsdcAtoms,
        settlementTxHashes: settlementHashes.length > 0 ? settlementHashes : [briefId],
        uri: composeResult.metadataUrl,
      })
      const tx = await writeContractAsync({
        address: contract,
        ...args,
      })
      setMintTx(tx)
      setMinted(true)
    } catch (err) {
      setMintError((err as Error).message)
    } finally {
      setMinting(false)
    }
  }

  return (
    <>
      <Header variant="app" />
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <div className="panel mb-6 p-5">
          <StepIndicator currentStep={step} completed={completed} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {step === "connect" ? (
              <section className="panel p-8">
                <Logo className="opacity-70" />
                <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
                  Connect a MetaMask wallet to begin.
                </h2>
                <p className="mt-2 max-w-prose text-sm text-neutral-400">
                  MARQUE runs on Base mainnet. You will sign one ERC-7715 permission
                  granting an in-browser director up to $5 USDC/day, expiring in one hour. The
                  director never leaves your browser session, and the broker handles relay through 1Shot.
                </p>
                <div className="mt-6">
                  <button className="btn-primary" onClick={handleConnect}>
                    connect MetaMask
                  </button>
                </div>
              </section>
            ) : step === "grant" ? (
              <section className="panel p-8">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  Grant the director a scoped budget.
                </h2>
                <p className="mt-2 max-w-prose text-sm text-neutral-400">
                  MetaMask Advanced Permissions (ERC-7715) lets you grant a periodic ERC-20 spend
                  cap to an arbitrary delegate. The director is{" "}
                  <span className="font-mono text-white">{shortAddress(sessionIds?.director.address)}</span>,
                  a session-scoped EOA in this browser. It will redelegate further to specialist
                  agents per Venice call.
                </p>
                <div className="mt-5 grid gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm">
                  <Row label="permission type" value="erc20-token-periodic" />
                  <Row label="token" value="USDC on Base" />
                  <Row label="period" value="24 hours" />
                  <Row label="cap" value="$5 USDC / period" />
                  <Row label="expiry" value="1 hour from grant" />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button className="btn-primary" onClick={handleGrant} disabled={granting}>
                    {granting ? "waiting on MetaMask…" : "grant permission"}
                  </button>
                  <span className="text-[12px] text-neutral-500">
                    requires MetaMask Flask for ERC-7715
                  </span>
                </div>
                {grantError ? (
                  <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {grantError}
                  </div>
                ) : null}
              </section>
            ) : step === "brief" ? (
              <section className="panel p-8">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  One sentence. One swarm. One mint.
                </h2>
                <p className="mt-2 max-w-prose text-sm text-neutral-400">
                  Describe an ad. The director redelegates to five specialist agents, each paying
                  Venice via x402 through the broker. Every settlement hits 1Shot and lands in your timeline.
                </p>
                <div className="mt-6">
                  <BriefForm onSubmit={handleBrief} busy={running || composing} />
                </div>
              </section>
            ) : (
              <>
                <section className="panel p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold tracking-tight">specialist roster</h2>
                    <span className="pill">
                      {roster.filter((r) => r.state === "done").length} / {roster.length} done
                    </span>
                  </div>
                  <AgentRoster statuses={roster} />
                </section>
                <MintCard
                  videoBlobUrl={composeResult?.assetUrl}
                  totalSpendUsdc={brief ? (Number(brief.budgetUsdcAtoms) / 1_000_000).toFixed(2) : "0.00"}
                  txHash={mintTx}
                  isMinting={minting}
                  minted={minted}
                  onMint={handleMint}
                />
                {mintError ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {mintError}
                  </div>
                ) : null}
                {composing ? (
                  <div className="panel p-4 text-sm text-neutral-400">
                    composer is stitching {roster.filter((r) => r.state === "done").length} outputs into the final ad…
                  </div>
                ) : null}
              </>
            )}

            <SessionSummary
              operator={account.address ?? null}
              director={sessionIds?.director.address ?? null}
              specialist={sessionIds?.specialist.address ?? null}
              broker={publicEnv.NEXT_PUBLIC_BROKER_FLOAT_ADDRESS}
              grant={grant}
            />
          </div>

          <aside>
            <AgentTimeline events={stream.events} connected={stream.connected} />
          </aside>
        </div>
      </main>
    </>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12px] uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="font-mono text-[13px] text-neutral-100">{value}</span>
    </div>
  )
}

function SessionSummary({
  operator,
  director,
  specialist,
  broker,
  grant,
}: {
  operator: Address | null
  director: Address | null
  specialist: Address | null
  broker: string
  grant: GrantedPermissionContext | null
}) {
  return (
    <section className="panel p-5">
      <h3 className="font-display text-sm font-semibold tracking-tight">session</h3>
      <p className="mt-1 text-[12px] text-neutral-500">
        the redelegation chain involved in every specialist call
      </p>
      <div className="mt-4 grid gap-3 text-[12px]">
        <ChainLink label="operator (smart account)" address={operator} tint="text-emerald-300" />
        <Connector />
        <ChainLink label="director (session EOA)" address={director} tint="text-violet-300" />
        <Connector />
        <ChainLink label="specialist (session EOA)" address={specialist} tint="text-fuchsia-300" />
        <Connector />
        <ChainLink label="broker float" address={broker} tint="text-sig" sub="pays Venice via x402" />
      </div>
      {grant ? (
        <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] p-3 font-mono text-[11px] text-neutral-400">
          <span className="text-neutral-600">grant context:</span>{" "}
          <span className="text-neutral-200">{shortTx(grant.context)}</span>
          <br />
          <span className="text-neutral-600">delegation manager:</span>{" "}
          <span className="text-neutral-200">{shortAddress(grant.delegationManager)}</span>
        </div>
      ) : null}
    </section>
  )
}

function ChainLink({
  label,
  address,
  tint,
  sub,
}: {
  label: string
  address: string | null
  tint: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current", tint)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn("text-[13px] font-medium", tint)}>{label}</span>
          <span className="font-mono text-[11px] text-neutral-300">{shortAddress(address)}</span>
        </div>
        {sub ? <span className="text-[11px] text-neutral-500">{sub}</span> : null}
      </div>
    </div>
  )
}

function Connector() {
  return <div className="ml-[3px] h-3 w-px bg-white/10" />
}

function shapePreview(kind: SpecialistKind, output: unknown): AgentStatus["output"] | undefined {
  if (kind === "concept") {
    const concept = output as { hook?: string }
    return { previewType: "text", text: concept?.hook }
  }
  if (kind === "image") {
    const img = output as { base64?: string; mimeType?: string }
    if (img?.base64) return { previewType: "image", previewUrl: `data:${img.mimeType ?? "image/png"};base64,${img.base64}` }
  }
  return undefined
}
