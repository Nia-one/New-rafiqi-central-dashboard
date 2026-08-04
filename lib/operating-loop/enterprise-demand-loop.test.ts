import assert from "node:assert/strict"
import test from "node:test"
import {
  ENTERPRISE_DEMAND_BLOCKED_CAPABILITIES,
  ENTERPRISE_DEMAND_CONTRACT_FIXTURES,
  ENTERPRISE_DEMAND_JOURNEY_FIXTURES,
  buildEnterpriseDemandLoopPreview,
  buildLiveEnterpriseDemandLoopPreview,
  buildJourneyPlan,
  createOrUpdateDemandNode,
  dailyRunRate,
  emitEnterpriseDemandDespatchEscalations,
  evaluateLoopClosure,
  rankDemandNodes,
  recordJourneyDisposition,
  verifyJourneyEvidence,
  type JourneyCandidateInput,
} from "@/lib/operating-loop/enterprise-demand-loop"

function admitted(index = 0) {
  const decision = createOrUpdateDemandNode(ENTERPRISE_DEMAND_CONTRACT_FIXTURES[index])
  assert.equal(decision.disposition, "Admitted")
  return decision.node
}

test("a signed demand creates or reopens a node when arrival, commitment, shortfall, spec or terms change", () => {
  const node = admitted()
  assert.equal(node.state, "Reopened")
  assert.ok(node.reopenReasons.includes("Enterprise arrival date changed."))
  assert.ok(node.reopenReasons.includes("Verified-ready capacity is below commitment inside 14 days."))

  const changedCommitment = createOrUpdateDemandNode({
    ...ENTERPRISE_DEMAND_CONTRACT_FIXTURES[1],
    committedNests: 130,
    previousSnapshot: { committedNests: 120, arrivalAt: ENTERPRISE_DEMAND_CONTRACT_FIXTURES[1].arrivalAt },
  })
  assert.equal(changedCommitment.disposition, "Admitted")
  assert.ok(changedCommitment.node.reopenReasons.includes("Signed commitment changed."))

  const draft = createOrUpdateDemandNode({ ...ENTERPRISE_DEMAND_CONTRACT_FIXTURES[1], contractStatus: "Draft" })
  assert.equal(draft.disposition, "Ignored")
  assert.equal(draft.node, null)
})

test("daily priority uses arrival risk and missed work rolls into the remaining hourly run rate", () => {
  const queue = rankDemandNodes([admitted(2), admitted(1), admitted(0)])
  assert.equal(queue[0].enterpriseName, "Vikram Solar")
  const rate = dailyRunRate(queue[0], 6)
  assert.equal(rate.rolledForward, 2)
  assert.equal(rate.remainingStops, 6)
  assert.equal(rate.requiredStopsPerHour, 1)
  const withoutRollover = dailyRunRate({ ...queue[0], dailyPlan: { ...queue[0].dailyPlan, missedStopsCarried: 0 } }, 6)
  assert.ok(rate.remainingStops > withoutRollover.remainingStops)
})

test("Ring 1 is ordered before Ring 2 and Ring 2 stays gated while Ring 1 can cover the gap", () => {
  const plan = buildJourneyPlan(admitted(), ENTERPRISE_DEMAND_JOURNEY_FIXTURES)
  assert.deepEqual(plan.steps.map((step) => step.ring), ["Ring 1", "Ring 1", "Ring 2", "Ring 2"])
  assert.equal(plan.ring1PotentialNests, 40)
  assert.equal(plan.ring2Unlocked, false)
  assert.ok(plan.steps.filter((step) => step.ring === "Ring 2").every((step) => step.state === "Ring 2 gated"))
})

test("Ring 2 unlocks only when Ring 1 cannot cover the verified shortfall", () => {
  const candidates = ENTERPRISE_DEMAND_JOURNEY_FIXTURES.map((candidate) => candidate.stepId === "STEP-FONO-01" ? { ...candidate, capacityNests: 5 } : candidate)
  const plan = buildJourneyPlan(admitted(), candidates)
  assert.equal(plan.ring1PotentialNests, 21)
  assert.equal(plan.ring2Unlocked, true)
  assert.ok(plan.steps.find((step) => step.ring === "Ring 2")?.state !== "Ring 2 gated")
})

test("beyond five kilometres blocks by default and an evidenced human exception remains explicit", () => {
  const node = admitted()
  const blocked = buildJourneyPlan(node, ENTERPRISE_DEMAND_JOURNEY_FIXTURES)
  assert.match(blocked.blocked.find((item) => item.stepId === "STEP-BEYOND-BLOCK")?.reason ?? "", /Beyond 5 km is blocked/)
  const approved: JourneyCandidateInput = {
    ...ENTERPRISE_DEMAND_JOURNEY_FIXTURES.find((item) => item.stepId === "STEP-BEYOND-BLOCK")!,
    stepId: "STEP-BEYOND-APPROVED",
    sharedCatchmentEvidenceRef: "protected://shared-catchment/evidence",
    sharedCatchmentApprovalRef: "protected://shared-catchment/human-approval",
  }
  const approvedPlan = buildJourneyPlan(node, [approved])
  assert.equal(approvedPlan.steps[0].state, "Human-approved exception")
  assert.equal(approvedPlan.steps[0].humanApprovalRequired, true)
})

test("every call or stop requires a complete disposition and no answer schedules another attempt", () => {
  const step = buildJourneyPlan(admitted(), ENTERPRISE_DEMAND_JOURNEY_FIXTURES).steps[0]
  assert.throws(() => recordJourneyDisposition(step, {
    outcome: null,
    evidenceRef: "protected://disposition/missing",
    nextAction: "Retry",
    ownerActorId: step.ownerActorId,
    dueAt: "2026-07-17T12:00:00+05:30",
    capacityAffected: step.capacityNests,
    readinessProbability: 0.3,
    occurredAt: "2026-07-17T10:00:00+05:30",
  }), /disposition is required/)
  const retried = recordJourneyDisposition(step, {
    outcome: "No answer",
    evidenceRef: "protected://disposition/no-answer",
    nextAction: "Retry scheduled in two hours",
    ownerActorId: step.ownerActorId,
    dueAt: "2026-07-17T12:00:00+05:30",
    capacityAffected: step.capacityNests,
    readinessProbability: 0.3,
    occurredAt: "2026-07-17T10:00:00+05:30",
  })
  assert.equal(retried.state, "Retry scheduled")
  assert.equal(retried.history.at(-1)?.nextAction, "Retry scheduled in two hours")
  assert.throws(() => recordJourneyDisposition(step, {
    outcome: "No answer",
    evidenceRef: "protected://disposition/no-answer",
    nextAction: "Retry",
    ownerActorId: step.ownerActorId,
    dueAt: "2026-07-17T09:59:00+05:30",
    capacityAffected: 1,
    readinessProbability: 0.2,
    occurredAt: "2026-07-17T10:00:00+05:30",
  }), /future attempt/)
})

test("readiness never counts until independent verification and stale or failed evidence reopens", () => {
  const step = buildJourneyPlan(admitted(), ENTERPRISE_DEMAND_JOURNEY_FIXTURES).steps[0]
  const submitted = recordJourneyDisposition(step, {
    outcome: "Verified ready",
    evidenceRef: "protected://disposition/ready",
    nextAction: "Independent verification queued",
    ownerActorId: step.ownerActorId,
    dueAt: "2026-07-17T12:00:00+05:30",
    capacityAffected: 20,
    readinessProbability: 0.9,
    occurredAt: "2026-07-17T10:00:00+05:30",
  })
  assert.equal(submitted.state, "Evidence pending")
  assert.equal(submitted.independentlyVerifiedNests, 0)
  assert.throws(() => verifyJourneyEvidence(submitted, { status: "Verified", verifierActorId: step.ownerActorId, verifiedAt: "2026-07-17T10:30:00+05:30", evidenceRef: "protected://verification/same-owner" }), /independent verifier/)
  const verified = verifyJourneyEvidence(submitted, { status: "Verified", verifierActorId: "Independent verifier", verifiedAt: "2026-07-17T10:30:00+05:30", evidenceRef: "protected://verification/ready" })
  assert.equal(verified.state, "Verified ready")
  assert.equal(verified.independentlyVerifiedNests, 20)
  const reopened = verifyJourneyEvidence(verified, { status: "Stale", verifierActorId: "Independent verifier", verifiedAt: "2026-07-17T11:00:00+05:30", evidenceRef: "protected://verification/stale" })
  assert.equal(reopened.state, "Reopened")
  assert.equal(reopened.independentlyVerifiedNests, 0)
  assert.equal(reopened.history.at(-1)?.type, "Evidence reopened")
})

test("FONO and SP remain separated while missing or mismatched supply context quarantines", () => {
  const preview = buildEnterpriseDemandLoopPreview()
  assert.deepEqual(preview.supplyLanes.map((lane) => lane.supplyModel), ["FONO", "SP"])
  assert.deepEqual(preview.activeNode.verifiedReadyBySupply, { FONO: 60, SP: 80 })
  assert.equal(preview.activeNode.verifiedReadyNests, 140)
  assert.equal(preview.journeyPlan.quarantined.some((item) => item.stepId === "STEP-QUARANTINE"), true)

  const wrongPlaybook: JourneyCandidateInput = { ...ENTERPRISE_DEMAND_JOURNEY_FIXTURES[0], stepId: "WRONG", supplyModel: "FONO", playbook: "SP" }
  const wrong = buildJourneyPlan(preview.activeNode, [wrongPlaybook])
  assert.match(wrong.quarantined[0].reasons.join(" "), /playbook must match supply_model/)
})

test("reported or self-verified readiness never contributes to the ready count", () => {
  const fixture = ENTERPRISE_DEMAND_CONTRACT_FIXTURES[0]
  const decision = createOrUpdateDemandNode({
    ...fixture,
    readiness: [
      { capacityId: "reported", supplyModel: "FONO", nests: 100, evidenceStatus: "Reported", evidenceRef: "protected://reported", submittedBy: "owner", verifierActorId: null },
      { capacityId: "self", supplyModel: "SP", nests: 100, evidenceStatus: "Verified", evidenceRef: "protected://self", submittedBy: "same actor", verifierActorId: "same actor" },
    ],
  })
  assert.equal(decision.disposition, "Admitted")
  assert.equal(decision.node.verifiedReadyNests, 0)
})

test("loop closes only through covered, matched, arrived and billing-live evidence or human exception", () => {
  const incomplete = evaluateLoopClosure({ committedNests: 180, verifiedReadyNests: 180, specStatus: "Match", termsStatus: "Match", arrivalEvidenceRef: null, billingEvidenceRef: null })
  assert.equal(incomplete.closed, false)
  assert.deepEqual(incomplete.missing, ["Member-arrival evidence is missing.", "Billing-live evidence is missing."])
  const completed = evaluateLoopClosure({ committedNests: 180, verifiedReadyNests: 180, specStatus: "Match", termsStatus: "Match", arrivalEvidenceRef: "protected://arrival/proof", billingEvidenceRef: "protected://billing/proof" })
  assert.equal(completed.closed, true)
  assert.equal(completed.closureType, "Verified completion")
  const exception = evaluateLoopClosure({ committedNests: 180, verifiedReadyNests: 0, specStatus: "Deviation", termsStatus: "Deviation", arrivalEvidenceRef: null, billingEvidenceRef: null, humanException: { approvedBy: "Pushkar", approvalRef: "protected://approval/exception" } })
  assert.equal(exception.closed, true)
  assert.equal(exception.closureType, "Human exception")
})

test("preview headline, exceptions and all effect boundaries are derived and constrained", () => {
  const preview = buildEnterpriseDemandLoopPreview()
  assert.equal(preview.headline, "Close 40 verified-ready Nests around Vikram Solar before the 26 July arrival. (Contracts 2h old)")
  assert.equal(preview.loopHealth.state, "Attention")
  assert.equal(preview.loopHealth.overviewAnswerAllowed, true)
  assert.ok(preview.exceptions.length <= 5)
  assert.ok(preview.exceptions.some((item) => item.owner === "Pushkar"))
  assert.deepEqual(Object.values(ENTERPRISE_DEMAND_BLOCKED_CAPABILITIES), Array(Object.keys(ENTERPRISE_DEMAND_BLOCKED_CAPABILITIES).length).fill(false))
  assert.equal(preview.mode, "Shadow only")
  assert.equal(preview.fixtureLabel, "Synthetic fixture")
})

test("Enterprise Demand emits due operating exceptions but keeps commercial approvals out of Despatch", () => {
  const preview = buildEnterpriseDemandLoopPreview()
  const queue = emitEnterpriseDemandDespatchEscalations(preview.exceptions)
  assert.equal(queue.length, 1)
  assert.equal(queue[0].domain, "Enterprise Demand")
  assert.match(queue[0].title, /arrival moved/i)
  assert.equal(queue.some((entry) => entry.ownerRole === "Pushkar"), false)
})

test("live Enterprise Demand never promotes matched headcount to independently verified readiness", () => {
  const preview = buildLiveEnterpriseDemandLoopPreview([{
    "demand id": "SP-BOT-LIVE-1", "enterprise name": "Live Enterprise", "plant name": "Live Plant",
    "activation required at": "2026-08-10T09:00:00+05:30", "headcount required": 100,
    "headcount matched": 70, status: "Contracted", "owner actor id": "ACT-OWNER", "updated at": "2026-08-04T09:00:00+05:30",
  }], "2026-08-04T10:00:00+05:30")
  assert.ok(preview)
  assert.equal(preview.mode, "Live read-only")
  assert.equal(preview.source.synthetic, false)
  assert.equal(preview.activeNode.verifiedReadyNests, 0)
  assert.equal(preview.activeNode.readinessGap, 100)
  assert.equal(preview.supplyLanes.find((lane) => lane.supplyModel === "SP")?.stages[1].count, 70)
  assert.equal(preview.despatchEscalations.every((item) => item.synthetic === false), true)
})
