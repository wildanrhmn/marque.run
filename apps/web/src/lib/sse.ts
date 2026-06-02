"use client"
import { useEffect, useState } from "react"
import type { Hex } from "viem"
import type { AgentTimelineEvent } from "@marque/shared"
import { publicEnv } from "./env"

export function useBriefStream(briefId: Hex | null): {
  events: AgentTimelineEvent[]
  connected: boolean
} {
  const [events, setEvents] = useState<AgentTimelineEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!briefId || !publicEnv.NEXT_PUBLIC_BROKER_URL) return
    const url = `${publicEnv.NEXT_PUBLIC_BROKER_URL.replace(/\/+$/, "")}/stream/brief/${briefId}`
    const source = new EventSource(url, { withCredentials: false })

    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)

    const onEvent = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as AgentTimelineEvent
        setEvents((prev) => [...prev, data])
      } catch {
        // swallow malformed
      }
    }

    const kinds: AgentTimelineEvent["kind"][] = [
      "operator.brief.submitted",
      "operator.upgrade.7702.signed",
      "operator.root.delegation.signed",
      "director.plan.ready",
      "specialist.redelegation.signed",
      "specialist.venice.request",
      "broker.relay.submitted",
      "broker.relay.confirmed",
      "specialist.venice.response",
      "composer.scene.rendered",
      "composer.final.encoded",
      "mint.tx.submitted",
      "mint.tx.confirmed",
      "error",
    ]
    for (const k of kinds) source.addEventListener(k, onEvent)

    return () => {
      for (const k of kinds) source.removeEventListener(k, onEvent)
      source.close()
    }
  }, [briefId])

  return { events, connected }
}
