import assert from "node:assert/strict"
import test from "node:test"
import { buildLiveHeartbeatSnapshot } from "@/lib/live-mappers/heartbeat"

test("live heartbeat mapper uses governed owner events and active roster state", () => {
  const snapshot = buildLiveHeartbeatSnapshot({
    computedAt: "2026-08-04T12:00:00.000Z",
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
