import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  CASH_CONTROL_BLOCKED_CAPABILITIES,
  CASH_CONTROL_LEARNING_CHAIN_FIELDS,
  CASH_CONTROL_POLICY_REGISTRY,
  assignCashControlAction,
  assessCashFeasibility,
  buildCashControlLearningInput,
  buildCashControlPreview,
  buildMonthCloseVariance,
  calculateMonthlyGap,
  decideCashControl,
  deriveVerifiedBaseline,
  detectCashControlEvent,
  emitCashControlDespatchEscalations,
  previewCascade,
  rankChannelMix,
  recoverCashControlAction,
  reslotMissedHourlyWork,
  verifyCashControlClosure,
  type CashControlContext,
  type CashControlEvent,
  type CashControlLearningChain,
  type CashControlSignalInput,
} from "./cash-control-loop"

const engineSource = readFileSync(new URL("./cash-control-loop.ts", import.meta.url), "utf8")

function context(overrides: Partial<CashControlContext> = {}): CashControlContext {
  return {
    destinationRef: "protected://destination/test-month",
    baselineRef: "protected://baseline/test-month",
    evidenceRef: "protected://evidence/test-snapshot",
    approvedMonthlyCmGoalInr: null,
    verifiedBaselineCmInr: 3_000_000,
    churnImpactCmInr: -100_000,
    churnEvidenceRef: "protected://evidence/churn",
    churnSubmittedBy: "protected://actor/finance-ops",
    churnVerifierRef: "protected://verifier/finance-review",
    churnFreshness: "Current",
    observedRamps: [{ channelId: "verified-channel", expectedCmInr: 400_000, observedCmInr: 350_000, evidenceRef: "protected://evidence/ramp", submittedBy: "protected://actor/growth", verifierRef: "protected://verifier/finance-review", dataFreshness: "Current", quarantined: false }],
    opexForecastInr: 5_500_000,
    collectedCashInr: 16_000_000,
    approvedCashTargetInr: null,
    collectionLeakageInr: 100_000,
    claimedClosures: 8,
    verifiedClosures: 6,
    awaitingVerification: 1,
    reopenedClosures: 1,
    missedHourlyCmInr: 50_000,
    remainingHours: 40,
    criticalDataFreshness: "Current",
    submittedBy: "protected://actor/finance-ops",
    verifierRef: "protected://verifier/finance-review",
    quarantined: false,
    ...overrides,
  }
}

function signal(contextOverrides: Partial<CashControlContext> = {}, inputOverrides: Partial<CashControlSignalInput> = {}): CashControlSignalInput {
  return { eventId: "evt-cash-test", occurredAt: "2026-07-18T09:30:00+05:30", ownerRole: "Pushkar / Finance", dueAt: "2026-07-18T14:00:00+05:30", context: context(contextOverrides), ...inputOverrides }
}

function admitted(input: CashControlSignalInput = signal()): CashControlEvent {
  const result = detectCashControlEvent(input)
  if (result.disposition === "Admitted") return result.event
  throw new Error(result.reasons.join(" "))
}

function actionFor(event = admitted()) {
  return assignCashControlAction(event, decideCashControl(event))
}

function learningChain(overrides: Partial<CashControlLearningChain> = {}): CashControlLearningChain {
  const event = admitted(signal({ approvedMonthlyCmGoalInr: 4_000_000 }))
  const decision = decideCashControl(event)
  const action = assignCashControlAction(event, decision)
  return {
    event_id: event.eventId,
    action_id: action.actionId,
    policy_version: event.policyVersion,
    forecast: { expected_cm_inr: 400_000, expected_cash_inr: 600_000, expected_opex_inr: 80_000, expected_hours: 48 },
    context_snapshot: { destination_ref: event.context.destinationRef, data_freshness: "Current", quarantined: false, approved_goal_present: true },
    decision,
    assigned_action: action,
    evidence: { reference: "protected://evidence/learning", cycles: 3 },
    independent_verification: { verified: true, verifier_ref: "protected://verifier/finance-review", self_verified: false },
    measured_outcome: { actual_cm_inr: 360_000, actual_cash_inr: 540_000, actual_opex_inr: 90_000, intervention_recovered_source_metric: true },
    variance_reason: "Synthetic comparison variance",
    ...overrides,
  }
}

const learningOptions = {
  holdoutOrControl: false,
  comparisonGroup: true,
  confounders: ["synthetic channel mix"],
  sampleSize: 10,
  forecastErrorPct: 10,
  verificationRatePct: 90,
  reversible: true,
  rollbackTrigger: "Cash headroom narrows.",
  insideApprovedBoundary: true,
  reversesHumanDecision: false,
  affectedHumanControlledCategories: ["Targets", "Finance", "Cash"] as const,
}

test("only locked financial controls have numeric policy values", () => {
  const numeric = CASH_CONTROL_POLICY_REGISTRY.filter((row) => typeof row.value === "number")
  assert.deepEqual(numeric.map((row) => [row.policyId, row.value]), [["POL-CASH-OPEX-CAP", 6_000_000], ["POL-CASH-MIN-CASH", 15_000_000]])
  assert.ok(CASH_CONTROL_POLICY_REGISTRY.filter((row) => row.value === null).every((row) => row.status === "Pending human approval"))
})

test("legacy anchors and defunct terminology never enter the domain", () => {
  assert.doesNotMatch(engineSource, /\bFloat\b|₹500|\b500 month|₹612|50\s*\/\s*50/i)
})

test("verified baseline includes churn and only independently verified observed ramps", () => {
  const result = deriveVerifiedBaseline(context().observedRamps.length ? context() : context())
  assert.equal(result.verifiedProjectionCmInr, 3_250_000)
  assert.deepEqual(result.acceptedRampIds, ["verified-channel"])
  assert.deepEqual(result.rejectedRampIds, [])
})

test("stale, self-verified, missing-evidence and quarantined ramps are excluded", () => {
  const base = context()
  const invalid = [
    { ...base.observedRamps[0], channelId: "stale", dataFreshness: "Stale" as const },
    { ...base.observedRamps[0], channelId: "self", submittedBy: "protected://verifier/finance-review" },
    { ...base.observedRamps[0], channelId: "missing", evidenceRef: null },
    { ...base.observedRamps[0], channelId: "quarantine", quarantined: true },
  ]
  const result = deriveVerifiedBaseline({ ...base, observedRamps: invalid })
  assert.equal(result.verifiedProjectionCmInr, 2_900_000)
  assert.deepEqual(result.rejectedRampIds, ["stale", "self", "missing", "quarantine"])
})

test("missing or stale baseline inputs make projection unavailable", () => {
  assert.equal(deriveVerifiedBaseline(context({ verifiedBaselineCmInr: null })).verifiedProjectionCmInr, null)
  assert.equal(deriveVerifiedBaseline(context({ churnFreshness: "Stale" })).verifiedProjectionCmInr, null)
  assert.equal(deriveVerifiedBaseline(context({ churnVerifierRef: "protected://actor/finance-ops" })).verifiedProjectionCmInr, null)
})

test("CM gap is never invented before destination approval", () => {
  const pending = calculateMonthlyGap(null, 3_250_000)
  assert.equal(pending.status, "Pending human approval")
  assert.equal(pending.remainingGapInr, null)
  const approved = calculateMonthlyGap(4_000_000, 3_250_000)
  assert.equal(approved.status, "Available")
  assert.equal(approved.remainingGapInr, 750_000)
})

test("cash feasibility applies the ₹60L cap and ₹150L guardrail", () => {
  const protectedState = assessCashFeasibility(5_400_000, 16_200_000, null)
  assert.equal(protectedState.status, "Protected")
  assert.equal(protectedState.opexHeadroomInr, 600_000)
  assert.equal(protectedState.cashHeadroomInr, 1_200_000)
  assert.match(protectedState.reasons.join(" "), /cash target is pending/i)
  assert.equal(assessCashFeasibility(6_100_000, 16_200_000, null).status, "At risk")
  assert.equal(assessCashFeasibility(5_400_000, 14_900_000, null).status, "At risk")
})

test("channel mix is evidence-ranked without a fixed allocation", () => {
  const ranked = rankChannelMix([
    { candidateId: "slow", channel: "Verified slow", expectedVerifiedCmInr: 300_000, requiredCashInr: 100_000, expectedHoursToOutcome: 72, evidenceRef: "protected://evidence/slow", dataFreshness: "Current", independentlyVerified: true, quarantined: false },
    { candidateId: "fast", channel: "Verified fast", expectedVerifiedCmInr: 500_000, requiredCashInr: 80_000, expectedHoursToOutcome: 24, evidenceRef: "protected://evidence/fast", dataFreshness: "Current", independentlyVerified: true, quarantined: false },
  ])
  assert.deepEqual(ranked.map((row) => row.candidateId), ["fast", "slow"])
  assert.ok(ranked.every((row) => row.allocationPct === null && row.recommendationOnly))
})

test("stale, unverified and quarantined channel evidence is not ranked", () => {
  const base = { candidateId: "candidate", channel: "Candidate", expectedVerifiedCmInr: 200_000, requiredCashInr: 50_000, expectedHoursToOutcome: 24, evidenceRef: "protected://evidence/candidate", dataFreshness: "Current" as const, independentlyVerified: true, quarantined: false }
  assert.deepEqual(rankChannelMix([{ ...base, dataFreshness: "Stale" }]), [])
  assert.deepEqual(rankChannelMix([{ ...base, independentlyVerified: false }]), [])
  assert.deepEqual(rankChannelMix([{ ...base, quarantined: true }]), [])
})

test("cascade cannot execute and requires verified human approval", () => {
  const blocked = previewCascade({ approved: false, independentlyVerified: false, insideApprovedBoundary: true })
  assert.equal(blocked.eligibleAfterApproval, false)
  assert.equal(blocked.executed, false)
  const previewOnly = previewCascade({ approved: true, independentlyVerified: true, insideApprovedBoundary: true })
  assert.equal(previewOnly.eligibleAfterApproval, true)
  assert.equal(previewOnly.executed, false)
  assert.equal(previewOnly.externalEffect, false)
})

test("hourly recovery re-slots misses without lowering the approved monthly target", () => {
  const result = reslotMissedHourlyWork(4_000_000, 2_000_000, 1_900_000, 100_000, 20)
  assert.equal(result.targetAfterRecoveryInr, 4_000_000)
  assert.equal(result.targetLowered, false)
  assert.ok(result.revisedHourlyRunRateInr > result.previousHourlyRunRateInr)
})

test("protected lineage is mandatory and raw financial identity is quarantined", () => {
  assert.equal(detectCashControlEvent(signal({ destinationRef: "plain-id" })).disposition, "Quarantined")
  assert.equal(detectCashControlEvent(signal({ rawBankAccount: "123" })).disposition, "Quarantined")
  assert.equal(detectCashControlEvent(signal({ rawCustomerIdentity: "name" })).disposition, "Quarantined")
})

test("machine detects pending destination, guardrail, cap, leakage and verification triggers", () => {
  const result = detectCashControlEvent(signal({ opexForecastInr: 6_100_000, collectedCashInr: 14_000_000 }))
  assert.equal(result.disposition, "Admitted")
  if (result.disposition === "Admitted") assert.deepEqual(result.event.triggers, ["CM destination pending", "Opex cap risk", "Cash guardrail risk", "Collection leakage", "Closure awaiting verification", "Closure reopened"])
})

test("machine ignores a fully controlled snapshot without open work", () => {
  const result = detectCashControlEvent(signal({ approvedMonthlyCmGoalInr: 4_000_000, collectionLeakageInr: 0, claimedClosures: 6, verifiedClosures: 6, awaitingVerification: 0, reopenedClosures: 0 }))
  assert.equal(result.disposition, "Ignored")
})

test("decision routing keeps financial authority human-owned", () => {
  const destination = decideCashControl(admitted())
  assert.equal(destination.kind, "Destination approval")
  assert.equal(destination.ownerRole, "Pushkar")
  assert.equal(destination.humanApprovalRequired, true)
  assert.equal(destination.executable, false)
  const guardrailEvent = admitted(signal({ approvedMonthlyCmGoalInr: 4_000_000, collectedCashInr: 14_000_000, opexForecastInr: 5_000_000, collectionLeakageInr: 0, claimedClosures: 6, verifiedClosures: 6, awaitingVerification: 0, reopenedClosures: 0 }))
  assert.equal(decideCashControl(guardrailEvent).kind, "Cash protection")
})

test("assignment is stable, idempotent and side-effect free", () => {
  const event = admitted()
  const decision = decideCashControl(event)
  const first = assignCashControlAction(event, decision)
  const second = assignCashControlAction(event, decision)
  assert.equal(first.actionId, second.actionId)
  assert.equal(first.idempotencyKey, second.idempotencyKey)
  assert.equal(first.externalEffect, false)
  assert.equal(first.recommendationOnly, true)
})

test("recovery keeps evidence, failed, approval and missed-hour work open", () => {
  const action = actionFor()
  assert.equal(recoverCashControlAction(action, "Evidence received").state, "Evidence pending")
  assert.equal(recoverCashControlAction(action, "Failed evidence").state, "Reopened")
  assert.equal(recoverCashControlAction(action, "Human approval required").state, "Awaiting approval")
  const missed = recoverCashControlAction(action, "Missed hour")
  assert.equal(missed.state, "Reopened")
  assert.match(missed.nextAction, /without lowering the monthly target/i)
})

test("independent verified source recovery is required for closure", () => {
  const valid = { evidenceRef: "protected://evidence/outcome", submittedBy: "protected://actor/finance-ops", verifierRef: "protected://verifier/finance-review", dataFreshness: "Current" as const, measuredOutcomeVerified: true, sourceMetricRecovered: true, claimedActivityOnly: false, quarantined: false }
  assert.equal(verifyCashControlClosure(valid).canClose, true)
  assert.equal(verifyCashControlClosure({ ...valid, measuredOutcomeVerified: false }).canClose, false)
  assert.equal(verifyCashControlClosure({ ...valid, sourceMetricRecovered: false }).canClose, false)
  assert.equal(verifyCashControlClosure({ ...valid, claimedActivityOnly: true }).canClose, false)
})

test("stale evidence reopens and self-verification is rejected", () => {
  const valid = { evidenceRef: "protected://evidence/outcome", submittedBy: "protected://actor/finance-ops", verifierRef: "protected://verifier/finance-review", dataFreshness: "Current" as const, measuredOutcomeVerified: true, sourceMetricRecovered: true, claimedActivityOnly: false, quarantined: false }
  assert.equal(verifyCashControlClosure({ ...valid, dataFreshness: "Stale" }).status, "Reopened")
  assert.equal(verifyCashControlClosure({ ...valid, verifierRef: valid.submittedBy }).status, "Rejected")
})

test("month-close variance requires both approved goal and independently verified actual", () => {
  assert.equal(buildMonthCloseVariance(null, 4_100_000, true).varianceInr, null)
  assert.equal(buildMonthCloseVariance(4_000_000, 4_100_000, false).varianceInr, null)
  const result = buildMonthCloseVariance(4_000_000, 4_100_000, true)
  assert.equal(result.status, "Verified")
  assert.equal(result.varianceInr, 100_000)
})

test("learning chain preserves exact governed field order", () => {
  assert.deepEqual(CASH_CONTROL_LEARNING_CHAIN_FIELDS, ["policy_version", "forecast", "context_snapshot", "decision", "assigned_action", "evidence", "independent_verification", "measured_outcome", "variance_reason"])
  const chain = learningChain()
  for (const field of CASH_CONTROL_LEARNING_CHAIN_FIELDS) assert.ok(field in chain)
})

test("learning export contains materiality, confidence, attribution and human-control inputs", () => {
  const input = buildCashControlLearningInput(learningChain(), learningOptions)
  for (const field of ["proposed_change", "expected_effect", "evidence_cycles", "sample_size", "forecast_error_pct", "attribution_grade", "confounders", "critical_data_fresh", "verification_rate_pct", "reversible", "rollback_trigger", "inside_approved_boundary", "reverses_human_decision", "affected_human_controlled_categories", "target_effect", "channel_effect", "cm_effect", "cash_effect", "materiality_status"]) assert.ok(field in input, field)
  assert.equal(input.production_confidence, "Low")
  assert.equal(input.registry_thresholds_approved, false)
  assert.equal(input.auto_adopt, false)
})

test("Observed learning visibly states confounders not ruled out", () => {
  const input = buildCashControlLearningInput(learningChain(), { ...learningOptions, comparisonGroup: false, confounders: [] })
  assert.equal(input.attribution_grade, "Observed")
  assert.deepEqual(input.confounders, ["confounders not ruled out"])
})

test("learning rejects stale, quarantined, unverified, self-verified and unapproved destinations", () => {
  const rows = [
    learningChain({ context_snapshot: { destination_ref: "protected://destination/test", data_freshness: "Stale", quarantined: false, approved_goal_present: true } }),
    learningChain({ context_snapshot: { destination_ref: "protected://destination/test", data_freshness: "Current", quarantined: true, approved_goal_present: true } }),
    learningChain({ independent_verification: { verified: false, verifier_ref: "protected://verifier/finance", self_verified: false } }),
    learningChain({ independent_verification: { verified: true, verifier_ref: "protected://verifier/self", self_verified: true } }),
    learningChain({ context_snapshot: { destination_ref: "protected://destination/test", data_freshness: "Current", quarantined: false, approved_goal_present: false } }),
  ]
  for (const row of rows) assert.equal(buildCashControlLearningInput(row, learningOptions).eligible_for_shared_learning_gate, false)
})

test("preview has exactly four face measures and no live capability", () => {
  const preview = buildCashControlPreview()
  assert.equal(preview.measures.length, 4)
  assert.deepEqual(preview.measures.map((measure) => measure.id), ["cm-destination", "opex-control", "cash-protection", "closure-integrity"])
  assert.match(preview.measures[0].value, /Pending approval/)
  assert.equal(preview.learningInputs[0].production_confidence, "Low")
  assert.equal(preview.learningInputs[0].auto_adopt, false)
  assert.deepEqual(CASH_CONTROL_BLOCKED_CAPABILITIES, preview.blockedCapabilities)
  assert.ok(Object.values(preview.blockedCapabilities).every((enabled) => enabled === false))
})

test("Cash & Control sends overdue execution work to Despatch but keeps approvals in sign-off", () => {
  const preview = buildCashControlPreview()
  const queue = emitCashControlDespatchEscalations(preview.tasks, "2026-07-18T15:00:00+05:30")
  assert.ok(queue.length > 0)
  assert.ok(queue.every((entry) => entry.domain === "Cash & Control" && entry.ownerRole !== "Pushkar"))
  assert.ok(queue.every((entry) => entry.evidenceRefs.every((reference) => reference.startsWith("protected://"))))
})
