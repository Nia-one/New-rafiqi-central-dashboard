import assert from "node:assert/strict"
import test from "node:test"
import { buildLiveHeartbeatSnapshot } from "@/lib/live-mappers/heartbeat"

const policy = (kind: string, suffix: string, value: string) => ({
  "policy id": `DISPATCH-${kind}-${suffix}`,
  "policy value": value,
  status: "Approved",
})

const dispatchPolicies = ["SUPPLY-JCO", "DEMAND-JCO", "ESSENTIALS-CATEGORY", "OTHER"].flatMap((kind) => [
  policy(kind, "THRESHOLD", "45"),
  policy(kind, "ESCALATION", "2"),
  policy(kind, "LABEL", `${kind} heartbeat`),
  policy(kind, "DESCRIPTION", `${kind} heartbeat is overdue`),
  policy(kind, "ACTION", "Check safety, then confirm"),
  policy(kind, "DUE", "Now"),
  policy(kind, "CHECKLIST", "Check current shift|Contact the owner|Record the qualifying signal"),
])

test("live heartbeat mapper uses governed owner events and active roster state", () => {
  const snapshot = buildLiveHeartbeatSnapshot({
    computedAt: "2026-08-04T12:00:00.000Z",
    policies: dispatchPolicies,
    people: [
      { "actor id": "ACT-1", "display name": "Demand owner", role: "Demand JCO", "active shift": "Active", "theatre id": "T1", "studio id": "S1" },
      { "actor id": "ACT-2", "display name": "Supply owner", role: "Supply JCO", "active shift": "Approved break", "last heartbeat at": "2026-08-04T10:00:00.000Z" },
    ],
    actionLog: [{ "action id": "A1", "owner actor id": "ACT-1", "updated at": "2026-08-04T10:00:00.000Z", "theatre id": "T1", "studio id": "S1" }],
  })

  assert.ok(snapshot)
  assert.equal(snapshot.persistence, "governed-live")
  assert.equal(snapshot.streams.length, 2)
  assert.equal(snapshot.streams.find((stream) => stream.id === "live-person-ACT-1")?.status, "escalated")
  assert.equal(snapshot.streams.find((stream) => stream.id === "live-person-ACT-2")?.status, "not_monitored")
  assert.equal(snapshot.summary.active_breaches, 1)
  assert.equal(snapshot.summary.outside_active_shift, 1)
})

test("live heartbeat mapper does not treat a roster update as a qualifying signal", () => {
  const snapshot = buildLiveHeartbeatSnapshot({
    computedAt: "2026-08-04T12:00:00.000Z",
    people: [{ "actor id": "ACT-1", "display name": "Owner", role: "Demand JCO", "active shift": "Active", "updated at": "2026-08-04T11:59:00.000Z" }],
    actionLog: [],
  })
  assert.equal(snapshot, null)
})
