import assert from "node:assert/strict"
import test from "node:test"
import { aggregateDespatchEscalations, aggregateLoopHealth, buildDespatchQueue, createDespatchEscalation, projectLoopHealth } from "@/lib/operating-loop/runtime-contracts"

test("Despatch escalation records require governed identity, time, and protected evidence", () => {
  const escalation = createDespatchEscalation({
    escalationId: "ESC-1",
    domain: "Member Savings",
    sourceActionId: "ACT-1",
    sourceEventId: "EVT-1",
    title: "Supplier recovery missed",
    reason: "Verified attach recovery failed for a second cycle.",
    ownerRole: "Pushkar",
    dueAt: "2026-07-18T12:00:00.000Z",
    raisedAt: "2026-07-18T10:00:00.000Z",
    severity: "Breach",
    status: "Open",
    evidenceRefs: ["protected://savings/ACT-1"],
    synthetic: true,
  })
  assert.equal(escalation.domain, "Member Savings")
  assert.throws(() => createDespatchEscalation({ ...escalation, evidenceRefs: ["https://public.example/evidence"] }), /protected references/)
})

test("platform Despatch ranks open critical work first and caps the visible queue", () => {
  const base = createDespatchEscalation({ escalationId: "ESC-ATTN", domain: "New Adds", sourceActionId: "ACT-1", sourceEventId: "EVT-1", title: "Fill overdue", reason: "Verified billing is overdue.", ownerRole: "Theatre lead", dueAt: "2026-07-18T12:00:00.000Z", raisedAt: "2026-07-18T10:00:00.000Z", severity: "Attention", status: "Open", evidenceRefs: ["protected://new-adds/ACT-1"], synthetic: true })
  const queue = aggregateDespatchEscalations([
    base,
    createDespatchEscalation({ ...base, escalationId: "ESC-CRIT", domain: "Member Engagement", severity: "Critical", dueAt: "2026-07-18T11:00:00.000Z" }),
    createDespatchEscalation({ ...base, escalationId: "ESC-RECOVERED", domain: "Member Savings", severity: "Breach", status: "Recovered" }),
  ], 2)
  assert.deepEqual(queue.map((entry) => entry.escalationId), ["ESC-CRIT", "ESC-ATTN"])
  assert.throws(() => aggregateDespatchEscalations([base, base]), /IDs must be unique/)
})

test("platform Despatch preserves the open total before limiting the visible queue", () => {
  const base = createDespatchEscalation({ escalationId: "ESC-1", domain: "New Adds", sourceActionId: "ACT-1", sourceEventId: "EVT-1", title: "Fill overdue", reason: "Verified billing is overdue.", ownerRole: "Theatre lead", dueAt: "2026-07-18T12:00:00.000Z", raisedAt: "2026-07-18T10:00:00.000Z", severity: "Breach", status: "Open", evidenceRefs: ["protected://new-adds/ACT-1"], synthetic: true })
  const queue = buildDespatchQueue(Array.from({ length: 7 }, (_, index) => createDespatchEscalation({ ...base, escalationId: `ESC-${index + 1}`, sourceActionId: `ACT-${index + 1}` })), 5)
  assert.equal(queue.visible.length, 5)
  assert.equal(queue.totalOpen, 7)
})

test("the shared loop-health projection delegates the cannot-confirm gate", () => {
  const health = projectLoopHealth({
    domain: "Nia Growth",
    asOf: "2026-07-18T12:00:00.000Z",
    feeds: [{ feedId: "growth", label: "Growth ledger", lastUpdatedAt: "2026-07-18T08:00:00.000Z", cadenceMinutes: 60, critical: true, affectedClaims: ["capacity"] }],
    clocks: [],
    verification: { claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null },
    quarantinedRecords: 0,
    dependentClaims: ["capacity"],
    synthetic: true,
  })
  assert.equal(health.state, "Cannot confirm")
  assert.equal(health.overviewAnswerAllowed, false)
})

test("platform health inherits doubt from any domain and prefixes its reasons", () => {
  const healthy = projectLoopHealth({ domain: "Enterprise Demand", asOf: "2026-07-18T12:00:00.000Z", feeds: [{ feedId: "demand", label: "Demand", lastUpdatedAt: "2026-07-18T12:00:00.000Z", cadenceMinutes: 60, critical: true, affectedClaims: ["readiness"] }], clocks: [], verification: { claimed: 1, verified: 1, awaiting: 0, reopened: 0, oldestAwaitingAt: null }, quarantinedRecords: 0, dependentClaims: ["readiness"], synthetic: true })
  const stale = projectLoopHealth({ domain: "Nia Growth", asOf: "2026-07-18T12:00:00.000Z", feeds: [{ feedId: "growth", label: "Growth", lastUpdatedAt: "2026-07-18T08:00:00.000Z", cadenceMinutes: 60, critical: true, affectedClaims: ["capacity"] }], clocks: [], verification: { claimed: 1, verified: 0, awaiting: 1, reopened: 0, oldestAwaitingAt: "2026-07-18T11:00:00.000Z" }, quarantinedRecords: 1, dependentClaims: ["capacity"], synthetic: true })
  const aggregate = aggregateLoopHealth([{ domain: "Enterprise Demand", health: healthy }, { domain: "Nia Growth", health: stale }])
  assert.equal(aggregate.overviewAnswerAllowed, false)
  assert.match(aggregate.reasons[0], /^Nia Growth:/)
  assert.deepEqual(aggregate.verification, { claimed: 2, verified: 1, awaiting: 1, reopened: 0, oldestAwaitingAt: "2026-07-18T11:00:00.000Z", backlogAgeHours: 1, backlogBeyondLimit: false })
})
