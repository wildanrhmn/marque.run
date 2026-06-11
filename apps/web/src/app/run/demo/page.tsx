"use client"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAccount, useConnect } from "wagmi"
import type { AgentTimelineEvent, SpecialistKind } from "@marque/shared"
import type { Hex } from "viem"
import { Header } from "@/components/Header"
import { AgentTimeline } from "@/components/AgentTimeline"
import { GradientMesh } from "@/components/GradientMesh"
import { Dropdown } from "@/components/Dropdown"
import { cn } from "@/lib/cn"
import { shortTx } from "@/lib/format"
import {
  FORMATS,
  TONES,
  TEMPLATES,
  VIDEO_TIERS,
  VOICES,
  DEFAULT_VOICE,
  estimateJob,
  resolutionFor,
  type Format,
  type Resolution,
  type TemplateKey,
  type QualityTier,
} from "@/lib/venice-demo"
import { startGeneration, brokerStreamUrl } from "@/lib/generate"
import { sessionUsdcBalance, type SessionBudget } from "@/lib/smartaccount"
import { brokerCall } from "@/lib/broker"
import { generateBriefId } from "@/lib/briefId"
import { useStudio } from "@/lib/studio"
import { mintToCollection, urlToBase64 } from "@/lib/collect"

type Stage = "compose" | "generating" | "result"

const TEMPLATE_ORDER: TemplateKey[] = ["ad", "product", "explainer", "music", "voiceover", "images"]
const TIER_ORDER: QualityTier[] = ["draft", "standard", "cinematic"]

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
  const [template, setTemplate] = useState<TemplateKey>("ad")
  const [quality, setQuality] = useState<QualityTier>("draft")
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState(30)
  const [format, setFormat] = useState<Format>(FORMATS[0])
  const [resolution, setResolution] = useState<Resolution>("720p")
  const [tone, setTone] = useState<string | null>(null)
  const [voice, setVoice] = useState<string>(DEFAULT_VOICE)
  const [exactText, setExactText] = useState(false)
  const [speed, setSpeed] = useState(1)

  const tpl = TEMPLATES[template]
  const tierResolutions = VIDEO_TIERS[quality].resolutions
  useEffect(() => {
    setResolution((r) => resolutionFor(quality, r))
  }, [quality])
  const est = estimateJob({ template, tier: quality, resolution, durationSec: duration })

  const mediaStep: SpecialistKind = tpl.steps.image
    ? "image"
    : tpl.steps.voice
      ? "voice"
      : tpl.steps.music
        ? "music"
        : "image"
  const runStepKeys: SpecialistKind[] = ["concept", mediaStep]
  const shownSteps = STEPS.filter((s) => runStepKeys.includes(s.key))
  const liveEst = runStepKeys.length * 0.12

  const [stepIndex, setStepIndex] = useState(-1)
  const [statusLine, setStatusLine] = useState("Approving your budget")
  const [events, setEvents] = useState<AgentTimelineEvent[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tx, setTx] = useState<Hex | undefined>()
  const [live, setLive] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | undefined>()
  const [mediaType, setMediaType] = useState<string>("video/mp4")
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

  const account = useAccount()
  const { connectors, connect } = useConnect()
  const studio = useStudio()
  const [preparing, setPreparing] = useState(false)
  const [mandateError, setMandateError] = useState<string | null>(null)
  const settlementsRef = useRef<Hex[]>([])

  const handleConnect = () => {
    const mm = connectors.find((c) => c.id === "metaMask") ?? connectors[0]
    if (mm) connect({ connector: mm })
  }

  const resetForRun = () => {
    cancel.current = false
    briefId.current = randHex(32)
    setEvents([])
    setStepIndex(-1)
    setSaved(false)
    setTx(undefined)
    setVideoUrl(undefined)
    setMediaType("video/mp4")
    setActualSpent(undefined)
    settlementsRef.current = []
  }

  const generate = async () => {
    if (!prompt.trim()) return
    if (!live) {
      resetForRun()
      setStage("generating")
      await generateSimulated()
      return
    }
    if (!account.isConnected) {
      handleConnect()
      return
    }
    setMandateError(null)
    setPreparing(true)
    try {
      const s = await studio.ensureSession()
      const bal = await sessionUsdcBalance(s.address)
      const estAtoms = BigInt(Math.floor(liveEst * 1_000_000))
      if (bal <= estAtoms) {
        studio.openManage()
        return
      }
      const b = await studio.ensureBudget()
      resetForRun()
      setStage("generating")
      await generateChain(b, bal)
    } catch (err) {
      setMandateError((err as Error).message)
    } finally {
      setPreparing(false)
    }
  }

  const generateSimulated = async () => {
    setStatusLine("Approving your budget")
    push("operator.root.delegation.signed", { cap: "$5.00" })
    await sleep(1100)
    if (cancel.current) return
    push("director.plan.ready", { specialists: shownSteps.length })

    for (let i = 0; i < shownSteps.length; i++) {
      if (cancel.current) return
      setStepIndex(i)
      setStatusLine(shownSteps[i]!.label)
      const settle = randHex(32)
      push("specialist.venice.request", {}, shownSteps[i]!.key)
      push("broker.relay.submitted", { hash: settle }, shownSteps[i]!.key)
      await sleep(1300)
      push("broker.relay.confirmed", { hash: settle }, shownSteps[i]!.key)
      push("specialist.venice.response", { settlementHash: settle }, shownSteps[i]!.key)
    }
    if (cancel.current) return
    setStepIndex(shownSteps.length)
    setStatusLine("Done")
    push("composer.final.encoded", { durationMs: duration * 1000 })
    await sleep(700)
    setStage("result")
  }

  const generateChain = async (b: SessionBudget, balBefore: bigint) => {
    const id = generateBriefId({ operator: b.smartAccountAddress, prompt: prompt.trim() })
    briefId.current = id
    const amount = 100_000n // $0.10 per agent step
    let auth = b.authorization
    const call = async (kind: SpecialistKind, body: unknown): Promise<unknown> => {
      const idx = shownSteps.findIndex((s) => s.key === kind)
      if (idx >= 0) {
        setStepIndex(idx)
        setStatusLine(shownSteps[idx]!.label)
      }
      push("specialist.venice.request", {}, kind)
      const res = await brokerCall<unknown>({
        specialistKind: kind,
        body,
        amountAtoms: amount,
        briefId: id,
        delegations: b.delegations,
        authorization: auth,
      })
      auth = undefined
      if (res.brokerSettlementTxHash) {
        settlementsRef.current.push(res.brokerSettlementTxHash)
        push("broker.relay.confirmed", { hash: res.brokerSettlementTxHash }, kind)
      }
      push("specialist.venice.response", { settlementHash: res.brokerSettlementTxHash }, kind)
      return res.data
    }
    try {
      setStatusLine("Authorizing your budget")
      push("operator.root.delegation.signed", { cap: `$${studio.balanceUsd.toFixed(2)}` })
      await call("concept", { prompt: prompt.trim(), durationSeconds: duration })
      let url: string | undefined
      let type = "image/webp"
      if (tpl.steps.image) {
        const data = (await call("image", { prompt: prompt.trim() })) as { images?: string[] }
        const b64 = data?.images?.[0]
        if (b64) {
          url = b64.startsWith("data:") ? b64 : `data:image/webp;base64,${b64}`
          type = "image/webp"
        }
      } else if (tpl.steps.voice) {
        const d = (await call("voice", { prompt: prompt.trim(), voice })) as { mediaUrl?: string; mediaType?: string }
        if (d?.mediaUrl) {
          url = d.mediaUrl
          type = d.mediaType ?? "audio/mpeg"
        }
      } else if (tpl.steps.music) {
        const d = (await call("music", { prompt: prompt.trim() })) as { mediaUrl?: string; mediaType?: string }
        if (d?.mediaUrl) {
          url = d.mediaUrl
          type = d.mediaType ?? "audio/wav"
        }
      }
      if (cancel.current) return
      setStepIndex(shownSteps.length)
      setStatusLine("Done")
      if (url) {
        setVideoUrl(url)
        setMediaType(type)
      }
      const balAfter = await sessionUsdcBalance(b.smartAccountAddress)
      const spent = Number(balBefore - balAfter) / 1e6
      setActualSpent(Number((spent > 0 ? spent : 0).toFixed(2)))
      if (spent > 0) studio.recordActivity({ kind: "spend", usd: spent, label: `${title} · ${tpl.label}`, ts: Date.now() })
      await studio.refresh()
      setStage("result")
    } catch (err) {
      setStatusLine(`Failed: ${(err as Error).message}`)
    }
  }

  const generateLive = async () => {
    setStatusLine("Approving your budget")
    let started
    try {
      started = await startGeneration({
        prompt: prompt.trim(),
        template,
        quality,
        durationSec: duration,
        resolution,
        aspectRatio: format.key,
        tone: tone ?? undefined,
        voice: tpl.steps.voice ? voice : undefined,
        exactText: template === "voiceover" ? exactText : undefined,
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
          const ct = (ev.details["contentType"] as string | undefined) ?? "video/mp4"
          const spent = ev.details["spentUsd"] as number | undefined
          setStepIndex(STEPS.length)
          setStatusLine("Done")
          if (url) setVideoUrl(url)
          setMediaType(ct)
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
    if (!live) {
      await sleep(1100)
      const h = randHex(32)
      setTx(h)
      push("mint.tx.confirmed", { hash: h }, undefined)
      setSaved(true)
      setSaving(false)
      return
    }
    setMandateError(null)
    try {
      const recipient = studio.sessionAddress ?? account.address
      if (!videoUrl || !recipient) throw new Error("nothing to save yet")
      const { base64, contentType } = await urlToBase64(videoUrl)
      const result = await mintToCollection({
        recipient,
        contentType: contentType || mediaType,
        base64,
        name: `${title} · ${tpl.label}`,
        description: prompt.trim(),
        template,
        briefId: briefId.current,
        spentUsd: actualSpent,
        settlementHashes: settlementsRef.current,
      })
      setTx(result.txHash)
      push("mint.tx.confirmed", { hash: result.txHash }, undefined)
      setSaved(true)
    } catch (err) {
      setMandateError((err as Error).message)
    } finally {
      setSaving(false)
    }
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

  const download = async () => {
    if (!videoUrl) return
    const ext = mediaType.includes("image")
      ? "webp"
      : mediaType.includes("mpeg") || mediaType.includes("mp3")
        ? "mp3"
        : mediaType.includes("audio")
          ? "wav"
          : mediaType.includes("video")
            ? "mp4"
            : "bin"
    try {
      const res = await fetch(videoUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "marque"}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(videoUrl, "_blank", "noopener")
    }
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

      <AnimatePresence>
        {lightbox && videoUrl ? (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button aria-label="Close" className="absolute inset-0 bg-ink-950/85 backdrop-blur-xl" onClick={() => setLightbox(false)} />
            <motion.img
              src={videoUrl}
              alt={title}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="relative z-10 max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setLightbox(false)}
              className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-bone/15 bg-ink-950/60 text-bone/80 backdrop-blur transition hover:text-bone"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
                <span className="pill-brass">Every premium model · one budget</span>
                <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
                  What should we make?
                </h1>
                <p className="mx-auto mt-2 max-w-md text-bone/55">
                  Pick a type, describe it, set a budget. A crew of agents picks the best model for
                  each part and you only pay for what it makes. No subscription.
                </p>
              </div>

              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {TEMPLATE_ORDER.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTemplate(t)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                      template === t
                        ? "border-brass/50 bg-brass/10 text-brass"
                        : "border-bone/[0.08] text-slate hover:border-brass/30 hover:text-bone",
                    )}
                  >
                    {TEMPLATES[t].label}
                  </button>
                ))}
              </div>

              <div className="panel p-5">
                <textarea
                  autoFocus
                  className="field min-h-[110px] resize-none border-0 bg-transparent px-1 text-base focus:ring-0"
                  placeholder={
                    template === "voiceover" && exactText
                      ? "Paste the exact words you want narrated…"
                      : `e.g. ${tpl.placeholder}`
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="mt-1 text-[12px] text-slate-dim">{tpl.tagline}</div>

                <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-bone/[0.06] pt-4">
                  {tpl.steps.video ? (
                    <Field label="Length">
                      <Segmented
                        options={DURATIONS.map((d) => ({ key: String(d), label: `${d}s` }))}
                        value={String(duration)}
                        onChange={(v) => setDuration(Number(v))}
                      />
                    </Field>
                  ) : null}
                  {tpl.steps.video || tpl.steps.image ? (
                    <Field label="Format">
                      <Segmented
                        options={FORMATS.map((f) => ({ key: f.key, label: f.key }))}
                        value={format.key}
                        onChange={(v) => setFormat(FORMATS.find((f) => f.key === v) ?? FORMATS[0])}
                      />
                    </Field>
                  ) : null}
                  {tpl.steps.video ? (
                    <>
                      <Field label="Resolution">
                        <Segmented
                          options={tierResolutions.map((r) => ({ key: r, label: r }))}
                          value={resolution}
                          onChange={(v) => setResolution(v as Resolution)}
                        />
                      </Field>
                      <Field label="Quality">
                        <Segmented
                          options={TIER_ORDER.map((t) => ({ key: t, label: VIDEO_TIERS[t].label }))}
                          value={quality}
                          onChange={(v) => setQuality(v as QualityTier)}
                        />
                      </Field>
                    </>
                  ) : null}
                  {tpl.steps.voice ? (
                    <Field label="Voice">
                      <Dropdown
                        value={voice}
                        options={VOICES.map((vo) => ({ id: vo.id, label: vo.label }))}
                        onChange={setVoice}
                        width={140}
                      />
                    </Field>
                  ) : null}
                  {tpl.steps.image || tpl.steps.video ? (
                    <Field label="Tone">
                      <Segmented
                        options={[{ key: "", label: "Auto" }, ...TONES.map((t) => ({ key: t, label: t }))]}
                        value={tone ?? ""}
                        onChange={(v) => setTone(v === "" ? null : v)}
                      />
                    </Field>
                  ) : null}
                </div>

                {template === "voiceover" ? (
                  <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[12px] text-bone/70">
                    <button
                      type="button"
                      onClick={() => setExactText((v) => !v)}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition",
                        exactText ? "bg-brass" : "bg-bone/[0.12]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-ink-950 transition",
                          exactText ? "left-[18px]" : "left-0.5",
                        )}
                      />
                    </button>
                    Read my exact words (skip the AI script)
                  </label>
                ) : null}

                {tpl.steps.video ? (
                  <p className="mt-3 text-[11px] text-slate-dim">{VIDEO_TIERS[quality].blurb}</p>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col items-center gap-4">
                <button
                  className="btn-primary shine-host h-12 w-full max-w-sm px-7 text-base"
                  onClick={generate}
                  disabled={!prompt.trim() || preparing}
                >
                  {preparing
                    ? "preparing…"
                    : live && !account.isConnected
                      ? "Connect wallet to make it"
                      : `Make it · ~$${(live ? liveEst : est.total).toFixed(2)}`}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
                {mandateError ? (
                  <p className="max-w-sm rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-center text-[11px] text-red-300">
                    {mandateError}
                  </p>
                ) : null}
                <p className="max-w-md text-center text-[12px] text-slate-dim">
                  {live
                    ? "Each step settles on Base mainnet from your Marque balance. Pay only for what you make, and withdraw the rest anytime."
                    : `Estimated $${est.total.toFixed(2)} in USDC. Each step's exact price is quoted before it runs, and the total can never exceed the budget you approve. Pay only for what you make.`}
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
                  Creating your {tpl.label.toLowerCase()}
                </h1>
                <p className="mx-auto mt-2 max-w-md text-[13px] italic text-bone/50">“{prompt}”</p>
              </div>

              <div className="panel relative overflow-hidden p-5">
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/60 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                />
                <ol className="space-y-2">
                  {shownSteps.map((s, i) => {
                    const state = stepIndex > i || stepIndex >= shownSteps.length ? "done" : stepIndex === i ? "active" : "pending"
                    return (
                      <motion.li
                        key={s.key}
                        layout
                        className={cn(
                          "flex items-center gap-4 rounded-xl border px-3 py-3 transition-colors duration-300",
                          state === "active"
                            ? "border-live/30 bg-live/[0.06]"
                            : state === "done"
                              ? "border-brass/15 bg-brass/[0.04]"
                              : "border-transparent",
                        )}
                      >
                        <StepDot state={state} />
                        <div className="min-w-0 flex-1">
                          <div className={cn("text-[15px] font-medium transition-colors", state === "pending" ? "text-slate-dim" : "text-bone")}>
                            {s.label}
                          </div>
                          <div className="text-[12px] text-slate-dim">{s.sub}</div>
                        </div>
                        {state === "done" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-brass">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l4 4L19 6" /></svg>
                            Settled
                          </span>
                        ) : state === "active" ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-live">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live shadow-glow-live" />
                            Working
                          </span>
                        ) : null}
                      </motion.li>
                    )
                  })}
                </ol>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-bone/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-brass to-brass-bright"
                    animate={{ width: `${(Math.max(0, stepIndex) / shownSteps.length) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
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
                  Your {tpl.label.toLowerCase()} is ready.
                </h1>
              </div>

              <div className="panel overflow-hidden">
                <div
                  className={cn(
                    "relative mx-auto w-full overflow-hidden bg-black",
                    mediaType.startsWith("audio") ? "aspect-video" : format.ratio,
                    format.key === "16:9" || mediaType.startsWith("audio") ? "" : "max-w-sm",
                  )}
                >
                  {videoUrl && mediaType.startsWith("video") ? (
                    <video src={videoUrl} className="h-full w-full object-cover" autoPlay loop controls playsInline />
                  ) : videoUrl && mediaType.startsWith("image") ? (
                    <button onClick={() => setLightbox(true)} className="group block h-full w-full" aria-label="Expand">
                      <img src={videoUrl} alt={title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                      <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-ink-950/60 text-bone opacity-0 backdrop-blur transition group-hover:opacity-100">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                      </span>
                    </button>
                  ) : videoUrl && mediaType.startsWith("audio") ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
                      <img src={poster(title)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
                      <audio src={videoUrl} controls autoPlay className="relative z-10 w-full max-w-sm" />
                    </div>
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
                    {title} · {tpl.label}
                    {tpl.steps.video ? ` · ${est.realDurationSec}s · ${resolution}` : ""}
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
                <button className="btn-ghost h-11 px-6" onClick={download} disabled={!videoUrl}>
                  Download
                </button>
                <button className="btn-ghost h-11 px-6" onClick={startOver}>
                  New one
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
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-dim">{label}</span>
      {children}
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-bone/[0.07] bg-bone/[0.02] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-[6px] px-2.5 py-1 text-[11px] font-medium transition",
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
