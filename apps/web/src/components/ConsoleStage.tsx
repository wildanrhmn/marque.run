"use client"
import { motion } from "framer-motion"
import type { SpecialistKind } from "@marque/shared"
import type { AgentStatus } from "./AgentRoster"

const GLYPH: Record<SpecialistKind, string> = {
  concept: "✎",
  image: "◫",
  voice: "◉",
  music: "♪",
  video: "▶",
}

const LABEL: Record<SpecialistKind, string> = {
  concept: "Concept",
  image: "Image",
  voice: "Voice",
  music: "Music",
  video: "Video",
}

const ORDER: SpecialistKind[] = ["concept", "image", "voice", "music", "video"]

const DIRECTOR = { x: 400, y: 96 }
const NODES_Y = 300
const NODE_X = [120, 260, 400, 540, 680]
const FINAL = { x: 400, y: 476 }

const C = {
  slate: "rgba(139,141,152,0.5)",
  slateFill: "rgba(139,141,152,0.05)",
  brass: "#c9a45c",
  brassBright: "#e2bd74",
  live: "#5fd4c4",
}

function edgePath(sx: number): string {
  return `M ${DIRECTOR.x} ${DIRECTOR.y + 42} C ${DIRECTOR.x} ${NODES_Y - 110}, ${sx} ${NODES_Y - 120}, ${sx} ${NODES_Y - 40}`
}
function finalPath(sx: number): string {
  return `M ${sx} ${NODES_Y + 40} C ${sx} ${FINAL.y - 90}, ${FINAL.x} ${FINAL.y - 90}, ${FINAL.x} ${FINAL.y - 42}`
}

function ringColor(state: AgentStatus["state"]): string {
  if (state === "done") return C.brassBright
  if (state === "calling" || state === "settled") return C.live
  if (state === "redelegating") return C.brass
  return C.slate
}
function fillColor(state: AgentStatus["state"]): string {
  if (state === "done") return "rgba(226,189,116,0.14)"
  if (state === "calling" || state === "settled") return "rgba(95,212,196,0.12)"
  if (state === "redelegating") return "rgba(201,164,92,0.10)"
  return C.slateFill
}

function SpecialistNode({ kind, x, state }: { kind: SpecialistKind; x: number; state: AgentStatus["state"] }) {
  const y = NODES_Y
  const active = state === "calling" || state === "redelegating"
  const done = state === "done"
  const ring = ringColor(state)

  return (
    <g>
      <motion.circle
        cx={x}
        cy={y}
        fill={ring}
        initial={false}
        animate={{ r: active ? 50 : done ? 44 : 38, opacity: active ? 0.16 : done ? 0.1 : 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.circle
        cx={x}
        cy={y}
        r={32}
        initial={false}
        animate={{ fill: fillColor(state), stroke: ring }}
        transition={{ duration: 0.4 }}
        strokeWidth={1.5}
      />
      {state === "calling" ? (
        <motion.circle
          cx={x}
          cy={y}
          r={40}
          fill="none"
          stroke={C.live}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="34 200"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.3, ease: "linear" }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ) : null}
      {done ? (
        <motion.path
          d={`M ${x - 9} ${y} l 6 7 l 12 -14`}
          fill="none"
          stroke={C.brassBright}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      ) : (
        <text x={x} y={y + 6} textAnchor="middle" fontSize="16" fill={ring} fontFamily="monospace">
          {GLYPH[kind]}
        </text>
      )}
      <text
        x={x}
        y={y + 56}
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fill={done ? C.brassBright : active ? ring : "#ece6d8"}
        fontFamily="var(--font-sans)"
      >
        {LABEL[kind]}
      </text>
      <text x={x} y={y + 74} textAnchor="middle" fontSize="10.5" fill="#5b5d68" fontFamily="monospace">
        {active ? "working" : done ? "done" : "queued"}
      </text>
    </g>
  )
}

export function ConsoleStage({
  statuses,
  composed = false,
  minted = false,
}: {
  statuses: AgentStatus[]
  composed?: boolean
  minted?: boolean
}) {
  const byKind = new Map(statuses.map((s) => [s.kind, s]))
  const anyActive = statuses.some((s) => s.state === "calling" || s.state === "redelegating")
  const directorOn = anyActive || statuses.some((s) => s.state === "done")

  return (
    <svg viewBox="0 0 800 540" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="stageGlow" cx="50%" cy="20%" r="70%">
          <stop offset="0%" stopColor="rgba(201,164,92,0.10)" />
          <stop offset="100%" stopColor="rgba(201,164,92,0)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="800" height="540" fill="url(#stageGlow)" />

      {/* concentric rings under director */}
      {[70, 130, 200].map((r, i) => (
        <motion.circle
          key={r}
          cx={DIRECTOR.x}
          cy={DIRECTOR.y}
          r={r}
          fill="none"
          stroke="rgba(236,230,216,0.05)"
          strokeWidth="1"
          animate={{ opacity: directorOn ? [0.06, 0.14, 0.06] : 0.05 }}
          transition={{ repeat: Infinity, duration: 3, delay: i * 0.4, ease: "easeInOut" }}
        />
      ))}

      {/* director -> specialist edges */}
      {ORDER.map((kind, i) => {
        const st = byKind.get(kind)?.state ?? "idle"
        const active = st === "calling" || st === "redelegating"
        const done = st === "done"
        const d = edgePath(NODE_X[i]!)
        const lit = active || done
        return (
          <g key={`edge-${kind}`}>
            <motion.path
              d={d}
              fill="none"
              stroke={done ? "rgba(226,189,116,0.55)" : active ? C.live : "rgba(236,230,216,0.12)"}
              strokeWidth={lit ? 2 : 1}
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: lit ? 1 : 0.001, opacity: lit ? 1 : 0.5 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
            {st === "calling" ? (
              <circle r="3.6" fill={C.live}>
                <animateMotion dur="1.15s" repeatCount="indefinite" path={d} />
              </circle>
            ) : null}
          </g>
        )
      })}

      {/* specialist -> final edges */}
      {composed
        ? ORDER.map((_, i) => {
            const d = finalPath(NODE_X[i]!)
            return (
              <motion.path
                key={`final-edge-${i}`}
                d={d}
                fill="none"
                stroke="rgba(226,189,116,0.5)"
                strokeWidth={1.5}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: "easeInOut" }}
              />
            )
          })
        : null}

      {/* director */}
      <g>
        <motion.circle
          cx={DIRECTOR.x}
          cy={DIRECTOR.y}
          fill={C.brass}
          initial={false}
          animate={{ r: directorOn ? 58 : 50, opacity: directorOn ? 0.16 : 0.08 }}
          transition={{ duration: 0.6 }}
        />
        <motion.circle
          cx={DIRECTOR.x}
          cy={DIRECTOR.y}
          r={42}
          fill="none"
          stroke="rgba(201,164,92,0.4)"
          strokeWidth={1.5}
          strokeDasharray="6 8"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
        <circle cx={DIRECTOR.x} cy={DIRECTOR.y} r={32} fill="rgba(201,164,92,0.12)" stroke={C.brass} strokeWidth={1.5} />
        <text x={DIRECTOR.x} y={DIRECTOR.y + 6} textAnchor="middle" fontSize="18" fill={C.brassBright} fontFamily="monospace">
          ⌘
        </text>
        <text x={DIRECTOR.x} y={DIRECTOR.y - 52} textAnchor="middle" fontSize="12" fontWeight="600" fill="#ece6d8" fontFamily="var(--font-sans)" letterSpacing="1">
          Director
        </text>
      </g>

      {/* specialist nodes */}
      {ORDER.map((kind, i) => (
        <SpecialistNode key={kind} kind={kind} x={NODE_X[i]!} state={byKind.get(kind)?.state ?? "idle"} />
      ))}

      {/* final asset node */}
      {composed ? (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <motion.circle
            cx={FINAL.x}
            cy={FINAL.y}
            fill={minted ? C.brassBright : C.brass}
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: 56, opacity: 0.16 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          />
          <motion.circle
            cx={FINAL.x}
            cy={FINAL.y}
            initial={{ r: 0 }}
            animate={{ r: 36 }}
            transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.35 }}
            fill="rgba(226,189,116,0.16)"
            stroke={C.brassBright}
            strokeWidth={2}
          />
          <text x={FINAL.x} y={FINAL.y + 6} textAnchor="middle" fontSize="18" fill={C.brassBright} fontFamily="monospace">
            {minted ? "★" : "✓"}
          </text>
          <text x={FINAL.x} y={FINAL.y + 60} textAnchor="middle" fontSize="12" fontWeight="600" fill={C.brassBright} fontFamily="var(--font-sans)">
            {minted ? "Minted to wallet" : "Final asset"}
          </text>
        </motion.g>
      ) : null}
    </svg>
  )
}
