import assert from "node:assert/strict"
import test from "node:test"
import { appendHeartbeatAcknowledgment, buildHeartbeatSnapshot, type HeartbeatSource } from "./heartbeat-control"
import { createIllustrativeHeartbeatSnapshot, createIllustrativeHeartbeatSources, heartbeatRules } from "./heartbeat-data"
import { acknowledgeHeartbeat } from "./heartbeat-store"

const computedAt = "2026-07-15T08:30:00.000Z"

function source(overrides: Partial<HeartbeatSource> = {}): HeartbeatSource {
  return {
    id: "test-source",
    name: "Test person",
    role: "Supply JCO",
    theatre: "Rajputana (NCR)",
    location: "Noida 01",
    kind: "supply_jco",
    roster_state: "active_shift",
    last_heartbeat_at: "2026-07-15T07:45:00.000Z",
    ...overrides,
  }
}

test("heartbeat thresholds are exact and escalate only after 2x", () => {
  const atThreshold = buildHeartbeatSnapshot([source()], heartbeatRules, computedAt).streams[0]
  assert.equal(atThreshold.minutes_since_heartbeat, 45)
  assert.equal(atThreshold.status, "healthy")

  const breached = buildHeartbeatSnapshot([source({ last_heartbeat_at: "2026-07-15T07:44:00.000Z" })], heartbeatRules, computedAt).streams[0]
  assert.equal(breached.status, "breached")

  const atEscalationBoundary = buildHeartbeatSnapshot([source({ last_heartbeat_at: "2026-07-15T07:00:00.000Z" })], heartbeatRules, computedAt).streams[0]
  assert.equal(atEscalationBoundary.status, "breached")

  const escalated = buildHeartbeatSnapshot([source({ last_heartbeat_at: "2026-07-15T06:59:00.000Z" })], heartbeatRules, computedAt).streams[0]
  assert.equal(escalated.status, "escalated")
})

test("approved breaks, off shifts and rest days are never flagged", () => {
  for (const rosterState of ["approved_break", "off_shift", "rest_day"] as const) {
    const stream = buildHeartbeatSnapshot([source({ roster_state: rosterState, last_heartbeat_at: "2026-07-15T00:00:00.000Z" })], heartbeatRules, computedAt).streams[0]
    assert.equal(stream.status, "not_monitored")
  }
})

test("every breach creates an alert log and Essentials includes its checklist", () => {
  const snapshot = createIllustrativeHeartbeatSnapshot(computedAt)
  for (const alert of snapshot.alerts) {
    assert.ok(snapshot.action_log.some((entry) => entry.heartbeat_id === alert.id && entry.action_type === "alert_raised"))
  }
  const essentials = snapshot.alerts.find((alert) => alert.kind === "essentials_category")
  assert.deepEqual(essentials?.checklist, ["Check stockout or order-feed failure", "Check Member pricing", "Check Studio capacity"])
  assert.equal(essentials?.rule.source_system, "commerce_orders")
  assert.equal(essentials?.rule.event_type, "order_placed")
  assert.equal(heartbeatRules.find((rule) => rule.kind === "supply_jco")?.event_type, "visit_logged")
  assert.equal(heartbeatRules.find((rule) => rule.kind === "demand_jco")?.event_type, "gate_visit_confirmed")
})

test("acknowledgments append actor and time without replacing alert history", () => {
  const snapshot = createIllustrativeHeartbeatSnapshot(computedAt)
  const alert = snapshot.alerts[0]
  const acknowledgmentAt = "2026-07-15T08:31:00.000Z"
  const next = appendHeartbeatAcknowledgment(snapshot.action_log, alert.id, "Control Tower operator", acknowledgmentAt)

  assert.equal(next.length, snapshot.action_log.length + 1)
  assert.equal(next[0].action_type, "alert_acknowledged")
  assert.equal(next[0].actor_id, "Control Tower operator")
  assert.equal(next[0].occurred_at, acknowledgmentAt)
  assert.ok(next.some((entry) => entry.heartbeat_id === alert.id && entry.action_type === "alert_raised"))
})

test("the screen polls inside one minute and separates active from suppressed streams", () => {
  const snapshot = createIllustrativeHeartbeatSnapshot(computedAt)
  assert.equal(snapshot.poll_interval_seconds, 45)
  assert.ok(snapshot.poll_interval_seconds <= 60)
  assert.equal(snapshot.summary.active_streams, 6)
  assert.equal(snapshot.summary.outside_active_shift, 2)
})

test("server-calculated staleness grows from fixed source timestamps", () => {
  const sources = createIllustrativeHeartbeatSources(computedAt)
  const first = buildHeartbeatSnapshot(sources, heartbeatRules, computedAt)
  const twoMinutesLater = buildHeartbeatSnapshot(sources, heartbeatRules, "2026-07-15T08:32:00.000Z")
  assert.equal(twoMinutesLater.streams[0].minutes_since_heartbeat, first.streams[0].minutes_since_heartbeat + 2)
})

test("the local server store preserves the acknowledgment actor and timestamp", () => {
  const occurredAt = new Date().toISOString()
  const result = acknowledgeHeartbeat("demand-vikram", "Control Tower operator", occurredAt)
  assert.equal(result.entry.actor_id, "Control Tower operator")
  assert.equal(result.entry.occurred_at, occurredAt)
  assert.ok(result.snapshot.action_log.some((entry) => entry.heartbeat_id === "demand-vikram" && entry.action_type === "alert_acknowledged"))
  assert.equal(result.snapshot.persistence, "illustrative-local-server")
})
