import assert from "node:assert/strict"
import test from "node:test"
import { buildLoopHealth, loopHealthAnswer } from "@/lib/operating-loop/loop-health"

const asOf = "2026-07-17T10:00:00+05:30"

function health(overrides: Partial<Parameters<typeof buildLoopHealth>[0]> = {}) {
  return buildLoopHealth({
    asOf,
    feeds: [{ feedId: "contracts", label: "Contracts", lastUpdatedAt: "2026-07-17T09:30:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["signed target"] }],
    clocks: [],
    verification: { claimed: 14, verified: 12, awaiting: 2, reopened: 1, oldestAwaitingAt: "2026-07-17T09:00:00+05:30" },
    ...overrides,
  })
}

test("current feeds preserve a qualified answer while verification work stays visible", () => {
  const result = health()
  assert.equal(result.state, "Attention")
  assert.equal(result.overviewAnswerAllowed, true)
  assert.equal(loopHealthAnswer(result, "All contracted arrivals covered."), "All contracted arrivals covered.")
})

test("a critical feed beyond twice cadence blocks a healthy Overview answer", () => {
  const result = health({ feeds: [{ feedId: "contracts", label: "Contracts", lastUpdatedAt: "2026-07-17T07:59:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["signed target", "gap"] }] })
  assert.equal(result.state, "Cannot confirm")
  assert.equal(result.overviewAnswerAllowed, false)
  assert.match(loopHealthAnswer(result, "All ready."), /^Cannot confirm: Contracts is beyond 2× cadence\.$/)
  assert.equal(result.feeds[0].ageLabel, "2h 1m old")
})

test("a breached clock names the responsible role and never exposes a person", () => {
  const result = health({ clocks: [{ clockId: "readiness", label: "Readiness fix", ownerRole: "Theatre lead", dueAt: "2026-07-17T09:00:00+05:30", state: "Running" }] })
  assert.equal(result.overviewAnswerAllowed, false)
  assert.deepEqual(result.reasons, ["Readiness fix is waiting on Theatre lead"])
  assert.equal(result.clocks[0].agePastDueMinutes, 60)
})

test("verification backlog blocks only after forty-eight hours", () => {
  assert.equal(health({ verification: { claimed: 4, verified: 2, awaiting: 2, reopened: 0, oldestAwaitingAt: "2026-07-15T10:00:00+05:30" } }).overviewAnswerAllowed, true)
  const blocked = health({ verification: { claimed: 4, verified: 2, awaiting: 2, reopened: 0, oldestAwaitingAt: "2026-07-15T09:59:00+05:30" } })
  assert.equal(blocked.overviewAnswerAllowed, false)
  assert.equal(blocked.verification.backlogAgeHours, 48)
  assert.match(blocked.reasons[0], /48 hours old/)
})

test("stale but not critical data remains visible and qualifies the answer", () => {
  const result = health({ feeds: [{ feedId: "contracts", label: "Contracts", lastUpdatedAt: "2026-07-17T08:30:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["gap"] }] })
  assert.equal(result.overviewAnswerAllowed, true)
  assert.equal(loopHealthAnswer(result, "40 Nests short."), "40 Nests short. (Contracts 1h 30m old)")
})

test("invalid verification accounting and duplicate IDs fail closed", () => {
  assert.throws(() => health({ verification: { claimed: 5, verified: 1, awaiting: 1, reopened: 0, oldestAwaitingAt: "2026-07-17T09:00:00+05:30" } }), /resolve to verified, awaiting, or reopened/)
  assert.throws(() => health({ feeds: [
    { feedId: "same", label: "One", lastUpdatedAt: asOf, cadenceMinutes: 60, critical: true, affectedClaims: [] },
    { feedId: "same", label: "Two", lastUpdatedAt: asOf, cadenceMinutes: 60, critical: true, affectedClaims: [] },
  ] }), /feed IDs must be unique/)
})
