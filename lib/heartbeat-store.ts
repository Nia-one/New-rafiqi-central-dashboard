import { appendHeartbeatAcknowledgment, buildHeartbeatSnapshot, type HeartbeatAuditEntry } from "@/lib/heartbeat-control"
import { createIllustrativeHeartbeatSources, heartbeatRules } from "@/lib/heartbeat-data"

let acknowledgments: HeartbeatAuditEntry[] = []

export function readHeartbeatSnapshot(computedAt = new Date().toISOString()) {
  // The illustrative fixture must describe the same state in long-running local
  // development and short-lived serverless instances. Re-anchor its relative
  // timestamps for every snapshot instead of tying results to process uptime.
  const sources = createIllustrativeHeartbeatSources(computedAt)
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
