import { appendHeartbeatAcknowledgment, buildHeartbeatSnapshot, type HeartbeatAuditEntry } from "@/lib/heartbeat-control"
import { createIllustrativeHeartbeatSources, heartbeatRules } from "@/lib/heartbeat-data"

// Fixed source timestamps let server-calculated staleness grow on every poll.
// This local prototype store resets when the Next.js process restarts.
const sources = createIllustrativeHeartbeatSources(new Date().toISOString())
let acknowledgments: HeartbeatAuditEntry[] = []

export function readHeartbeatSnapshot(computedAt = new Date().toISOString()) {
  const snapshot = buildHeartbeatSnapshot(sources, heartbeatRules, computedAt)
  return {
    ...snapshot,
    action_log: [...acknowledgments, ...snapshot.action_log]
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
  }
}

export function acknowledgeHeartbeat(heartbeatId: string, actorId: string, occurredAt = new Date().toISOString()) {
  const snapshot = readHeartbeatSnapshot(occurredAt)
  if (!snapshot.alerts.some((alert) => alert.id === heartbeatId)) throw new Error("The heartbeat alert is no longer active.")

  const next = appendHeartbeatAcknowledgment(snapshot.action_log, heartbeatId, actorId, occurredAt)
  const acknowledgment = next.find((entry) => entry.heartbeat_id === heartbeatId && entry.action_type === "alert_acknowledged")
  if (!acknowledgment) throw new Error("The acknowledgment could not be recorded.")
  if (!acknowledgments.some((entry) => entry.heartbeat_id === heartbeatId)) acknowledgments = [acknowledgment, ...acknowledgments]

  return { entry: acknowledgment, snapshot: readHeartbeatSnapshot(occurredAt) }
}
