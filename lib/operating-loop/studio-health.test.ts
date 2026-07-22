import assert from "node:assert/strict"
import test from "node:test"
import {
  appendWarRoomEvidence,
  assessStudioHealth,
  createWarRoomCase,
  projectVerifiedWarRoomOutcome,
  studioHealthPoliciesAt,
  transitionWarRoomCase,
  type StudioHealthInput,
} from "@/lib/operating-loop/studio-health"

const asOf = "2026-07-17T08:00:00+05:30"
const policies = studioHealthPoliciesAt(asOf)

function health(overrides: Partial<StudioHealthInput> = {}) {
  return assessStudioHealth({
    studioId: "ST-1",
    studioName: "Synthetic Studio",
    theatreId: "TH-1",
    contractedNests: 100,
    occupiedNests: 78,
    grossMarginRatio: 0.2,
    contributionMarginInr: 1,
    dataComplete: true,
    theatreOwnerActorId: "ACT-THEATRE",
    asOf,
    sourceRowIdentity: "Studio_Master:ST-1",
    synthetic: true,
    ...overrides,
  }, policies)
}

test("Studio-health thresholds and required responses match the locked brief", () => {
  assert.equal(health().status, "Green")
  const amber = health({ occupiedNests: 60, grossMarginRatio: 0.1 })
  assert.equal(amber.status, "Amber")
  assert.equal(amber.reviewDueAt, "2026-07-18T02:30:00.000Z")
  assert.equal(amber.actionPlanDueAt, "2026-07-19T02:30:00.000Z")
  assert.match(amber.requiredResponse, /24 hours.+48 hours/)

  for (const overrides of [{ occupiedNests: 59 }, { grossMarginRatio: 0.09 }, { contributionMarginInr: -1 }]) {
    const red = health(overrides)
    assert.equal(red.status, "Red")
    assert.equal(red.reviewDueAt, "2026-07-17T23:59:59+05:30")
    assert.equal(red.decisionDueAt, "2026-07-24T02:30:00.000Z")
    assert.deepEqual(red.decisionRoles, ["CEO", "COO"])
  }

  const noData = health({ dataComplete: false, grossMarginRatio: null })
  assert.equal(noData.status, "No data")
  assert.equal(noData.priority, "Maximum")
  assert.equal(noData.reviewDueAt, asOf)
  assert.equal(noData.requiresWarRoom, true)
})

test("War Room closure requires evidence, valid versions, and an independent verifier", () => {
  let warRoomCase = createWarRoomCase({
    caseId: "WAR-1",
    studioId: "ST-1",
    title: "Studio recovery",
    priority: "Critical",
    triggers: ["Occupancy below 60%."],
    ownerActorId: "OWNER",
    verifierActorId: "VERIFY",
    responseDueAt: asOf,
    decisionDueAt: "2026-07-24T02:30:00.000Z",
    requiredEvidence: ["Recovery proof"],
    linkedApprovalRequestIds: [],
    sourceRowIdentity: "Studio_Master:ST-1",
    synthetic: true,
    openedAt: asOf,
    openedBy: "ORCHESTRATOR",
  })
  assert.throws(() => transitionWarRoomCase(warRoomCase, { to: "In progress", actorId: "OWNER", occurredAt: asOf, note: "skip", expectedVersion: warRoomCase.version }), /Invalid/)
  warRoomCase = transitionWarRoomCase(warRoomCase, { to: "Assigned", actorId: "ORCHESTRATOR", occurredAt: asOf, note: "assigned", expectedVersion: warRoomCase.version })
  warRoomCase = transitionWarRoomCase(warRoomCase, { to: "In progress", actorId: "OWNER", occurredAt: asOf, note: "started", expectedVersion: warRoomCase.version })
  assert.throws(() => transitionWarRoomCase(warRoomCase, { to: "Evidence submitted", actorId: "OWNER", occurredAt: asOf, note: "proof", expectedVersion: warRoomCase.version }), /without protected evidence/)
  assert.throws(() => appendWarRoomEvidence(warRoomCase, { evidenceId: "E-1", protectedRef: "https://public", description: "bad", submittedBy: "OWNER", submittedAt: asOf }, warRoomCase.version), /protected reference/)
  warRoomCase = appendWarRoomEvidence(warRoomCase, { evidenceId: "E-1", protectedRef: "protected://war-room/1", description: "Recovery proof", submittedBy: "OWNER", submittedAt: asOf }, warRoomCase.version)
  warRoomCase = transitionWarRoomCase(warRoomCase, { to: "Evidence submitted", actorId: "OWNER", occurredAt: asOf, note: "proof", expectedVersion: warRoomCase.version })
  assert.throws(() => transitionWarRoomCase(warRoomCase, { to: "Verified", actorId: "OWNER", verifierActorId: "VERIFY", occurredAt: asOf, note: "owner names another verifier", expectedVersion: warRoomCase.version }), /Only the named War Room verifier/)
  assert.throws(() => transitionWarRoomCase(warRoomCase, { to: "Verified", actorId: "UNRELATED", occurredAt: asOf, note: "unrelated actor", expectedVersion: warRoomCase.version }), /Only the named War Room verifier/)
  assert.throws(() => transitionWarRoomCase(warRoomCase, { to: "Verified", actorId: "SUBSTITUTE", verifierActorId: "SUBSTITUTE", occurredAt: asOf, note: "substitute verifier", expectedVersion: warRoomCase.version }), /cannot be substituted/)
  warRoomCase = transitionWarRoomCase(warRoomCase, { to: "Verified", actorId: "VERIFY", verifierActorId: "VERIFY", occurredAt: "2026-07-17T09:00:00+05:30", note: "verified", expectedVersion: warRoomCase.version })
  assert.equal(warRoomCase.history.at(-1)?.actorId, "VERIFY")
  warRoomCase = transitionWarRoomCase(warRoomCase, { to: "Closed", actorId: "VERIFY", occurredAt: "2026-07-17T09:05:00+05:30", note: "closed", expectedVersion: warRoomCase.version })
  assert.equal(warRoomCase.state, "Closed")
  assert.notEqual(warRoomCase.ownerActorId, warRoomCase.verifierActorId)

  const projection = projectVerifiedWarRoomOutcome(warRoomCase)
  assert.equal(Object.isFrozen(projection), true)
  assert.equal(projection.verifiedBy, "VERIFY")
  assert.deepEqual(Object.keys(projection).toSorted(), ["caseId", "eventType", "result", "sourceRowIdentity", "studioId", "synthetic", "verifiedAt", "verifiedBy"].toSorted())
  assert.equal("evidence" in projection, false)

  const mismatchedHistory = Object.freeze(warRoomCase.history.map((event) => event.to === "Verified" ? Object.freeze({ ...event, actorId: "UNRELATED" }) : event))
  assert.throws(() => projectVerifiedWarRoomOutcome(Object.freeze({ ...warRoomCase, history: mismatchedHistory })), /actor must match the named War Room verifier/)
})
