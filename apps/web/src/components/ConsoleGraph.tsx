"use client"
import type { SpecialistKind } from "@marque/shared"
import type { AgentStatus } from "./AgentRoster"

const GLYPH: Record<SpecialistKind, string> = {
  concept: "✎",
  image: "◫",
  voice: "◉",
  music: "♪",
  video: "▶",
}

interface NodeVisual {
  stroke: string
  fill: string
  text: string
  active: boolean
  done: boolean
}

function visualFor(state: AgentStatus["state"]): NodeVisual {
  switch (state) {
    case "redelegating":
      return { stroke: "#c9a45c", fill: "rgba(201,164,92,0.10)", text: "#c9a45c", active: true, done: false }
    case "calling":
      return { stroke: "#5fd4c4", fill: "rgba(95,212,196,0.12)", text: "#5fd4c4", active: true, done: false }
    case "settled":
      return { stroke: "#5fd4c4", fill: "rgba(95,212,196,0.10)", text: "#5fd4c4", active: false, done: false }
    case "done":
      return { stroke: "#e2bd74", fill: "rgba(226,189,116,0.14)", text: "#e2bd74", active: false, done: true }
    case "error":
      return { stroke: "#f87171", fill: "rgba(248,113,113,0.10)", text: "#f87171", active: false, done: false }
    default:
      return { stroke: "rgba(139,141,152,0.5)", fill: "rgba(139,141,152,0.06)", text: "#8b8d98", active: false, done: false }
  }
}

const POSITIONS: { kind: SpecialistKind; x: number }[] = [
  { kind: "concept", x: 70 },
  { kind: "image", x: 185 },
  { kind: "voice", x: 300 },
  { kind: "music", x: 415 },
  { kind: "video", x: 530 },
]

const DIRECTOR = { x: 300, y: 70 }
const NODE_Y = 330

function edgePath(sx: number): string {
  return `M${DIRECTOR.x},${DIRECTOR.y + 30} C${DIRECTOR.x},200 ${sx},200 ${sx},${NODE_Y - 30}`
}

export function ConsoleGraph({ statuses }: { statuses: AgentStatus[] }) {
  const byKind = new Map(statuses.map((s) => [s.kind, s]))
  const anyActive = statuses.some((s) => s.state === "calling" || s.state === "redelegating")
  const allDone = statuses.length > 0 && statuses.every((s) => s.state === "done")

  return (
    <svg viewBox="0 0 600 400" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="dirGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(201,164,92,0.35)" />
          <stop offset="100%" stopColor="rgba(201,164,92,0)" />
        </radialGradient>
      </defs>

      {POSITIONS.map(({ kind, x }) => {
        const st = byKind.get(kind)
        const v = visualFor(st?.state ?? "idle")
        const d = edgePath(x)
        return (
          <g key={`edge-${kind}`}>
            <path
              d={d}
              fill="none"
              stroke={v.done ? "rgba(226,189,116,0.5)" : v.active ? v.stroke : "rgba(236,230,216,0.10)"}
              strokeWidth={v.active || v.done ? 1.5 : 1}
              strokeDasharray={v.done ? "0" : "4 5"}
            />
            {v.active ? (
              <circle r="3.2" fill={v.stroke}>
                <animateMotion dur="1.25s" repeatCount="indefinite" path={d} />
              </circle>
            ) : null}
          </g>
        )
      })}

      {/* director hub */}
      <g>
        <circle cx={DIRECTOR.x} cy={DIRECTOR.y} r="46" fill="url(#dirGlow)" opacity={anyActive ? 1 : 0.5} />
        <circle
          cx={DIRECTOR.x}
          cy={DIRECTOR.y}
          r="30"
          fill="rgba(201,164,92,0.10)"
          stroke="#c9a45c"
          strokeWidth="1.5"
        />
        <text x={DIRECTOR.x} y={DIRECTOR.y + 5} textAnchor="middle" fontSize="15" fill="#e2bd74" fontFamily="monospace">
          ⌘
        </text>
        <text
          x={DIRECTOR.x}
          y={DIRECTOR.y - 44}
          textAnchor="middle"
          fontSize="11"
          fill="#ece6d8"
          fontFamily="var(--font-sans)"
          letterSpacing="1"
        >
          DIRECTOR
        </text>
      </g>

      {/* specialist nodes */}
      {POSITIONS.map(({ kind, x }) => {
        const st = byKind.get(kind)
        const v = visualFor(st?.state ?? "idle")
        return (
          <g key={`node-${kind}`}>
            {v.active || v.done ? (
              <circle cx={x} cy={NODE_Y} r="34" fill={v.fill} opacity="0.6">
                {v.active ? (
                  <animate attributeName="r" values="26;36;26" dur="1.6s" repeatCount="indefinite" />
                ) : null}
              </circle>
            ) : null}
            <circle cx={x} cy={NODE_Y} r="24" fill={v.fill} stroke={v.stroke} strokeWidth="1.5" />
            <text x={x} y={NODE_Y + 5} textAnchor="middle" fontSize="14" fill={v.text} fontFamily="monospace">
              {GLYPH[kind]}
            </text>
            <text
              x={x}
              y={NODE_Y + 44}
              textAnchor="middle"
              fontSize="10"
              fill={v.done ? "#e2bd74" : v.active ? v.text : "#8b8d98"}
              fontFamily="var(--font-sans)"
              letterSpacing="0.5"
              className="uppercase"
            >
              {kind}
            </text>
            <text
              x={x}
              y={NODE_Y + 58}
              textAnchor="middle"
              fontSize="8"
              fill="#5b5d68"
              fontFamily="monospace"
            >
              {st?.budgetUsdc ?? "—"}
            </text>
          </g>
        )
      })}

      {allDone ? (
        <text x="300" y="392" textAnchor="middle" fontSize="11" fill="#5fd4c4" fontFamily="monospace">
          crew complete · settling final asset
        </text>
      ) : null}
    </svg>
  )
}
