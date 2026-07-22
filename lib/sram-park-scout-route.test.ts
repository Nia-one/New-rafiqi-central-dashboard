import assert from "node:assert/strict"
import test from "node:test"
import { POLICY_REGISTRY, type PolicyDefinition } from "@/lib/operating-loop/contracts"
import {
  SCOUT_BLOCKED_CAPABILITIES,
  SCOUT_WEDGES,
  appendScoutAuditEvent,
  buildScoutQueue,
  classifyScoutRing,
  createScoutRouteRecord,
  evaluateCandidate,
  evaluateFieldSafety,
  normaliseBearing,
  ringCoverage,
  scoutRegistryAt,
  wedgeForBearing,
  type CandidateInput,
  type DemandGateInput,
  type FieldSafetyInput,
  type WedgeVerification,
} from "@/lib/sram-park-scout-route"
import { SCOUT_CANDIDATE_FIXTURES, SCOUT_DEMAND_FIXTURES, SCOUT_PREVIEW_AT, SCOUT_WEDGE_FIXTURES, SRAM_PARK_SCOUT_PREVIEW, scoutFixtureCsv } from "@/lib/sram-park-scout-preview"

const safeFieldSession: FieldSafetyInput = {
  localHour: 9,
  plannedCheckIns: 3,
  publicAccess: true,
  ownerConsentRef: null,
  noTrespass: true,
  hazardStatus: "Cleared",
  ppeControlsRef: null,
  unsafeSolo: false,
  buddyRef: null,
  emergencyRef: "protected://safety/emergency",
  stopWorkInstructionVisible: true,
}

function candidate(overrides: Partial<CandidateInput> = {}): CandidateInput {
  return {
    candidateId: "CAND-TEST",
    gateId: "GATE-TEST",
    supplyModel: "SP",
    sourceRowIdentity: "synthetic-row-test",
    synthetic: true,
    distanceKm: 1.2,
    bearing: 0,
    buildingType: "PG-convertible",
    estimatedNestCapacity: 220,
    askingRentInrMonth: 484000,
    shuttleCostPerNestInr: 0,
    coordinateRef: "protected://coordinates/test",
    photoRef: "protected://photos/test",
    ownerRef: "protected://commercial/test",
    utilityEvidenceRef: "protected://utilities/test",
    scoutActorId: "scout-test",
    verifierActorId: "verifier-test",
    fieldSafety: safeFieldSession,
    ...overrides,
  }
}

function verifiedRing(gateId = "GATE-TEST"): WedgeVerification[] {
  return SCOUT_WEDGES.map((wedge, index) => ({
    eventId: `${gateId}-${wedge}`,
    gateId,
    supplyModel: "SP",
    ring: "Ring 1",
    wedge,
    result: "No candidate at target-rent policy",
    evidenceRef: `protected://evidence/${wedge}`,
    scoutActorId: "scout-test",
    verifierActorId: "verifier-test",
    verifiedAt: `2026-07-17T09:${String(index).padStart(2, "0")}:00+05:30`,
    targetRentPolicyRef: "POL-SP-SCOUT-TARGET-RENT@v1",
  }))
}

test("Negotiation fires a same-day shadow trigger while pre-Negotiation gates remain blocked", () => {
  const result = buildScoutQueue(SCOUT_DEMAND_FIXTURES.slice(0, 4), [], SCOUT_PREVIEW_AT)
  assert.deepEqual(result.gateQueue.slice(0, 3).map((item) => item.gateId), ["GATE-SP-A", "GATE-SP-B", "GATE-SP-C"])
  assert.equal(result.gateQueue[0].disposition, "Live shadow trigger")
  assert.equal(result.gateQueue[0].triggeredAt, "2026-07-17T08:40:00+05:30")
  assert.equal(result.gateQueue[0].potentialOccupiedNests, 1008)
  assert.equal(result.gateQueue[0].queueValueInr, 2_721_600)
  assert.equal(result.gateQueue.find((item) => item.gateId === "GATE-SP-D")?.disposition, "Blocked")
})

test("safety, War Room, financial and legal work pre-empt the scout queue in locked order", () => {
  const result = buildScoutQueue(SCOUT_DEMAND_FIXTURES.slice(0, 1), [
    { priorityId: "legal", category: "Legal / compliance", active: true, evidenceRef: "protected://priority/legal" },
    { priorityId: "war-room", category: "Studio War Room", active: true, evidenceRef: "protected://priority/war-room" },
    { priorityId: "cash", category: "Cash / financial guardrail", active: true, evidenceRef: "protected://priority/cash" },
    { priorityId: "safety", category: "Safety / emergency", active: true, evidenceRef: "protected://priority/safety" },
  ], SCOUT_PREVIEW_AT)
  assert.equal(result.scoutWorkPreempted, true)
  assert.deepEqual(result.protectedQueue.map((item) => item.category), ["Safety / emergency", "Studio War Room", "Cash / financial guardrail", "Legal / compliance"])
})

test("missing and FONO supply context quarantine and can never borrow the SP playbook", () => {
  const result = buildScoutQueue(SCOUT_DEMAND_FIXTURES, [], SCOUT_PREVIEW_AT)
  assert.equal(result.gateQueue.find((item) => item.gateId === "GATE-FONO-Q")?.disposition, "Quarantined")
  assert.equal(result.gateQueue.find((item) => item.gateId === "GATE-MISSING-Q")?.disposition, "Quarantined")
  assert.match(result.gateQueue.find((item) => item.gateId === "GATE-FONO-Q")?.reason ?? "", /FONO/)
})

test("ring boundaries and half-open wedges have complete, non-overlapping coverage", () => {
  assert.equal(classifyScoutRing(0), "Ring 1")
  assert.equal(classifyScoutRing(2), "Ring 1")
  assert.equal(classifyScoutRing(2.0001), "Ring 2")
  assert.equal(classifyScoutRing(5), "Ring 2")
  assert.equal(classifyScoutRing(5.0001), "Beyond 5 km")
  assert.equal(normaliseBearing(-1), 359)
  assert.deepEqual([0, 44.999, 45, 89.999, 90, 134.999, 135, 179.999, 180, 224.999, 225, 269.999, 270, 314.999, 315, 359.999].map(wedgeForBearing), ["W1", "W1", "W2", "W2", "W3", "W3", "W4", "W4", "W5", "W5", "W6", "W6", "W7", "W7", "W8", "W8"])
  assert.deepEqual(new Set(Array.from({ length: 360 }, (_, degree) => wedgeForBearing(degree))), new Set(SCOUT_WEDGES))
})

test("Ring 2 is gated on eight independently verified Ring 1 wedges", () => {
  const ring2 = candidate({ distanceKm: 3.4, shuttleCostPerNestInr: 350 })
  assert.equal(evaluateCandidate(ring2, verifiedRing().slice(0, 7), SCOUT_PREVIEW_AT).disposition, "Blocked")
  assert.equal(evaluateCandidate(ring2, verifiedRing(), SCOUT_PREVIEW_AT).disposition, "Recommended for review")
  const notIndependent = verifiedRing().map((event) => ({ ...event, verifierActorId: event.scoutActorId }))
  assert.equal(ringCoverage(notIndependent, "GATE-TEST", "Ring 1", SCOUT_PREVIEW_AT).complete, false)
})

test("beyond 5 km rejects by default and an evidenced shared catchment remains human review only", () => {
  const beyond = candidate({ distanceKm: 5.4 })
  const rejected = evaluateCandidate(beyond, verifiedRing(), SCOUT_PREVIEW_AT)
  assert.equal(rejected.disposition, "Rejected")
  assert.equal(rejected.humanApprovalRequired, true)
  const exception = evaluateCandidate(candidate({
    distanceKm: 5.4,
    sharedCatchmentGateIds: ["GATE-SP-A", "GATE-SP-B"],
    sharedCatchmentEvidenceRef: "protected://catchment/a-b",
    sharedCatchmentApprovalRef: "protected://approval/human-a-b",
  }), verifiedRing(), SCOUT_PREVIEW_AT)
  assert.equal(exception.disposition, "Shared-catchment review")
  assert.equal(exception.fitScore, null)
  assert.equal(exception.actionBoundary, "No execution authority")
})

test("fit score is reproducible and consumes the effective registry version", () => {
  const current = evaluateCandidate(candidate(), [], SCOUT_PREVIEW_AT)
  assert.equal(current.fitScore?.score, 76)
  assert.ok(current.fitScore?.policyRefs.includes("POL-SP-SCOUT-TARGET-RENT@v1"))
  const currentRent = POLICY_REGISTRY.find((policy) => policy.policyId === "POL-SP-SCOUT-TARGET-RENT")!
  const nextRegistry: readonly PolicyDefinition[] = [...POLICY_REGISTRY, { ...currentRent, value: 3000, effectiveFrom: "2026-07-18", version: 2 }]
  const next = evaluateCandidate(candidate(), [], "2026-07-18T09:15:00+05:30", nextRegistry)
  assert.equal(next.fitScore?.score, 83.6)
  assert.ok(next.fitScore?.policyRefs.includes("POL-SP-SCOUT-TARGET-RENT@v2"))
  assert.equal(scoutRegistryAt("2026-07-18T09:15:00+05:30", nextRegistry).version, "SP-SCOUT-REGISTRY@v2")
})

test("raw coordinates, photos or owner details quarantine before projection", () => {
  assert.equal(evaluateCandidate(candidate({ rawCoordinates: { lat: 12.3, lng: 77.4 } }), [], SCOUT_PREVIEW_AT).disposition, "Quarantined")
  assert.equal(evaluateCandidate(candidate({ rawPhoto: "data:image/png;base64,fixture" }), [], SCOUT_PREVIEW_AT).disposition, "Quarantined")
  assert.equal(evaluateCandidate(candidate({ rawOwnerContact: "raw fixture" }), [], SCOUT_PREVIEW_AT).disposition, "Quarantined")
  assert.equal(evaluateCandidate(candidate({ coordinateRef: "12.3,77.4" }), [], SCOUT_PREVIEW_AT).disposition, "Quarantined")
})

test("field-person safety blocks unsafe time, trespass, consent gaps, hazards and unsafe solo visits", () => {
  assert.equal(evaluateFieldSafety(safeFieldSession, SCOUT_PREVIEW_AT).passed, true)
  const unsafe = evaluateFieldSafety({
    ...safeFieldSession,
    localHour: 20,
    plannedCheckIns: 1,
    publicAccess: false,
    noTrespass: false,
    hazardStatus: "Stop work",
    unsafeSolo: true,
    buddyRef: null,
    emergencyRef: null,
    stopWorkInstructionVisible: false,
  }, SCOUT_PREVIEW_AT)
  assert.equal(unsafe.passed, false)
  assert.equal(unsafe.failures.length, 8)
})

test("external, financial, live-field and Production capabilities are structurally unavailable", () => {
  assert.deepEqual(Object.values(SCOUT_BLOCKED_CAPABILITIES), Array(Object.keys(SCOUT_BLOCKED_CAPABILITIES).length).fill(false))
  assert.equal(SRAM_PARK_SCOUT_PREVIEW.mode, "Shadow only")
  assert.equal(SRAM_PARK_SCOUT_PREVIEW.fixtureLabel, "Synthetic fixtures")
  assert.match(scoutFixtureCsv(), /fixture_only/)
  assert.doesNotMatch(scoutFixtureCsv(), /protected:\/\//)
})

test("SP audit records are append-only, independently verified and version checked", () => {
  const record = createScoutRouteRecord({ routeId: "ROUTE-SP-TEST", gateId: "GATE-TEST", supplyModel: "SP", ownerActorId: "scout-test", verifierActorId: "verifier-test", at: SCOUT_PREVIEW_AT, evidenceRef: "protected://route/detected" })
  const submitted = appendScoutAuditEvent(record, { state: "Evidence submitted", occurredAt: "2026-07-17T10:00:00+05:30", actorId: "scout-test", evidenceRef: "protected://route/evidence", expectedVersion: 1 })
  const verified = appendScoutAuditEvent(submitted, { state: "Verified", occurredAt: "2026-07-17T10:15:00+05:30", actorId: "verifier-test", evidenceRef: "protected://route/verification", expectedVersion: 2 })
  assert.equal(record.history.length, 1)
  assert.equal(verified.history.length, 3)
  assert.equal(verified.version, 3)
  assert.throws(() => appendScoutAuditEvent(verified, { state: "Reopened", occurredAt: "2026-07-17T10:30:00+05:30", actorId: "scout-test", evidenceRef: "protected://route/reopen", expectedVersion: 2 }), /Stale/)
  assert.throws(() => createScoutRouteRecord({ routeId: "BAD", gateId: "GATE-TEST", supplyModel: "FONO", ownerActorId: "scout-test", verifierActorId: "verifier-test", at: SCOUT_PREVIEW_AT, evidenceRef: "protected://route/bad" }), /supply_model=SP/)
})

test("preview fixtures exercise review, rejection, privacy, channel and safety outcomes", () => {
  const outcomes = SRAM_PARK_SCOUT_PREVIEW.candidates.map((item) => item.disposition)
  assert.ok(outcomes.includes("Recommended for review"))
  assert.ok(outcomes.includes("Rejected"))
  assert.ok(outcomes.includes("Shared-catchment review"))
  assert.ok(outcomes.includes("Quarantined"))
  assert.ok(outcomes.includes("Blocked"))
  assert.equal(SCOUT_CANDIDATE_FIXTURES.length, outcomes.length)
  assert.equal(SCOUT_WEDGE_FIXTURES.length, 11)
})
