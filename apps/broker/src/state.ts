import { EventEmitter } from "events"
import type { Hex } from "viem"
import type { AgentTimelineEvent } from "@marque/shared"
import type { OneShotStatus } from "./oneshot"

export interface RelayTask {
  taskId: Hex
  briefId: Hex | null
  specialistKind: string | null
  status: "Pending" | "Submitted" | "Confirmed" | "Rejected" | "Reverted"
  hash?: Hex
  createdAt: number
  updatedAt: number
  meta: Record<string, unknown>
}

class BrokerState {
  private readonly tasks = new Map<Hex, RelayTask>()
  private readonly bus = new EventEmitter()
  private readonly history = new Map<Hex, AgentTimelineEvent[]>()

  constructor() {
    this.bus.setMaxListeners(0)
  }

  recordTask(task: RelayTask): void {
    this.tasks.set(task.taskId, task)
  }

  updateTask(taskId: Hex, patch: Partial<RelayTask>): RelayTask | undefined {
    const existing = this.tasks.get(taskId)
    if (!existing) return undefined
    const next: RelayTask = { ...existing, ...patch, updatedAt: Date.now() }
    this.tasks.set(taskId, next)
    return next
  }

  getTask(taskId: Hex): RelayTask | undefined {
    return this.tasks.get(taskId)
  }

  emit(event: AgentTimelineEvent): void {
    const events = this.history.get(event.briefId) ?? []
    events.push(event)
    this.history.set(event.briefId, events)
    this.bus.emit("event", event)
    this.bus.emit(`brief:${event.briefId}`, event)
  }

  getHistory(briefId: Hex): AgentTimelineEvent[] {
    return this.history.get(briefId) ?? []
  }

  subscribe(briefId: Hex, listener: (event: AgentTimelineEvent) => void): () => void {
    const channel = `brief:${briefId}`
    this.bus.on(channel, listener)
    return () => this.bus.off(channel, listener)
  }

  subscribeAll(listener: (event: AgentTimelineEvent) => void): () => void {
    this.bus.on("event", listener)
    return () => this.bus.off("event", listener)
  }
}

export const state = new BrokerState()
