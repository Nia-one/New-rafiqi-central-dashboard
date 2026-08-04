export type HeartbeatKind = "supply_jco" | "demand_jco" | "essentials_category" | "other"
export type RosterState = "active_shift" | "approved_break" | "off_shift" | "rest_day"
export type HeartbeatStatus = "healthy" | "breached" | "escalated" | "not_monitored"

export type HeartbeatRule = {
  kind: HeartbeatKind
  label: string
  event_type: "visit_logged" | "gate_visit_confirmed" | "order_placed" | "signal_logged"
  signal: string
  definition: string
  threshold_minutes: number
  escalation_multiplier: number
  source_system: "action_log" | "commerce_orders"
}

export type HeartbeatSource = {
  id: string
  name: string
  role: string
  theatre: string
  location: string
  kind: HeartbeatKind
  roster_state: RosterState
  last_heartbeat_at: string
  checklist?: string[]
}

export type EvaluatedHeartbeat = HeartbeatSource & {
  rule: HeartbeatRule
  minutes_since_heartbeat: number
  status: HeartbeatStatus
  rule_text: string
  priority_ratio: number
}

export type HeartbeatAuditAction = "alert_raised" | "alert_escalated" | "alert_acknowledged"

export type HeartbeatAuditEntry = {
  id: string
  heartbeat_id: string
  actor_id: string
  action_type: HeartbeatAuditAction
  occurred_at: string
  note: string
}

export type HeartbeatSnapshot = {
  computed_at: string
  poll_interval_seconds: number
  persistence: "illustrative-local-server" | "governed-live"
  streams: EvaluatedHeartbeat[]
  alerts: EvaluatedHeartbeat[]
  action_log: HeartbeatAuditEntry[]
  summary: {
    active_streams: number
    signals_current: number
    active_breaches: number
    escalated: number
    outside_active_shift: number
  }
}

export const HEARTBEAT_POLL_INTERVAL_SECONDS = 45

function minutesBetween(earlier: string, later: string) {
  return Math.max(0, Math.floor((new Date(later).getTime() - new Date(earlier).getTime()) / 60_000))
}

function addMinutes(timestamp: string, minutes: number) {
  return new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString()
}

export function evaluateHeartbeat(source: HeartbeatSource, rule: HeartbeatRule, computedAt: string): EvaluatedHeartbeat {
  const minutesSinceHeartbeat = minutesBetween(source.last_heartbeat_at, computedAt)
  const priorityRatio = minutesSinceHeartbeat / rule.threshold_minutes
  let status: HeartbeatStatus = "healthy"

  if (source.roster_state !== "active_shift") status = "not_monitored"
  else if (priorityRatio > rule.escalation_multiplier) status = "escalated"
  else if (minutesSinceHeartbeat > rule.threshold_minutes) status = "breached"

  return {
    ...source,
    rule,
    minutes_since_heartbeat: minutesSinceHeartbeat,
    status,
    rule_text: `No ${rule.signal} in ${rule.threshold_minutes} min`,
    priority_ratio: priorityRatio,
  }
}

function alertAuditRows(stream: EvaluatedHeartbeat): HeartbeatAuditEntry[] {
  if (stream.status !== "breached" && stream.status !== "escalated") return []

  const rows: HeartbeatAuditEntry[] = [{
    id: `${stream.id}-raised`,
    heartbeat_id: stream.id,
    actor_id: "system",
    action_type: "alert_raised",
    occurred_at: addMinutes(stream.last_heartbeat_at, stream.rule.threshold_minutes),
    note: stream.rule_text,
  }]

  if (stream.status === "escalated") rows.push({
    id: `${stream.id}-escalated`,
    heartbeat_id: stream.id,
    actor_id: "system",
    action_type: "alert_escalated",
    occurred_at: addMinutes(stream.last_heartbeat_at, stream.rule.threshold_minutes * stream.rule.escalation_multiplier),
    note: `Unacknowledged past ${stream.rule.escalation_multiplier}× threshold. Escalated to manager / Theatre Head.`,
  })

  return rows
}

export function buildHeartbeatSnapshot(sources: HeartbeatSource[], rules: HeartbeatRule[], computedAt: string): HeartbeatSnapshot {
  const ruleByKind = new Map(rules.map((rule) => [rule.kind, rule]))
  const streams = sources.map((source) => {
    const rule = ruleByKind.get(source.kind)
    if (!rule) throw new Error(`No heartbeat rule is configured for ${source.kind}.`)
    return evaluateHeartbeat(source, rule, computedAt)
  })
  const alerts = streams
    .filter((stream) => stream.status === "breached" || stream.status === "escalated")
    .sort((a, b) => b.priority_ratio - a.priority_ratio)
  const activeStreams = streams.filter((stream) => stream.roster_state === "active_shift")

  return {
    computed_at: computedAt,
    poll_interval_seconds: HEARTBEAT_POLL_INTERVAL_SECONDS,
    persistence: "illustrative-local-server",
    streams,
    alerts,
    action_log: alerts.flatMap(alertAuditRows).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    summary: {
      active_streams: activeStreams.length,
      signals_current: activeStreams.filter((stream) => stream.status === "healthy").length,
      active_breaches: alerts.length,
      escalated: alerts.filter((stream) => stream.status === "escalated").length,
      outside_active_shift: streams.length - activeStreams.length,
    },
  }
}

export function appendHeartbeatAcknowledgment(
  entries: HeartbeatAuditEntry[],
  heartbeatId: string,
  actorId: string,
  occurredAt: string,
): HeartbeatAuditEntry[] {
  if (!actorId.trim()) throw new Error("An acknowledgment needs an actor.")
  if (!entries.some((entry) => entry.heartbeat_id === heartbeatId && entry.action_type === "alert_raised")) {
    throw new Error("Only a raised alert can be acknowledged.")
  }
  if (entries.some((entry) => entry.heartbeat_id === heartbeatId && entry.action_type === "alert_acknowledged")) return entries

  return [{
    id: `${heartbeatId}-ack-${occurredAt}`,
    heartbeat_id: heartbeatId,
    actor_id: actorId.trim(),
    action_type: "alert_acknowledged",
    occurred_at: occurredAt,
    note: "Alert acknowledged. The heartbeat rule remains active until a new qualifying signal arrives.",
  }, ...entries]
}
