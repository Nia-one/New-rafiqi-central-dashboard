import assert from "node:assert/strict"
import test from "node:test"
import {
  LEARNING_CHAIN_FIELDS,
  assignRetentionAction,
  buildMemberEngagementLearningInput,
  buildMemberEngagementPreview,
  buildMemberEscalations,
  decideRecoverableCause,
  detectMemberEngagementEvent,
  emitMemberEngagementDespatchEscalations,
  evaluateWeeklyMessage,
  recoverMemberEngagement,
  recoverMemberEngagementTask,
  projectMemberEngagementLoopHealth,
  verifyRetentionRecovery,
  type LearningChain,
  type MemberEngagementContext,
} from "@/lib/operating-loop/member-engagement-loop"

function context(overrides: Partial<MemberEngagementContext> = {}): MemberEngagementContext {
  return {
    eventId: "evt-001",
    memberRef: "protected://member/token-001",
    supplyModel: "FONO",
    theatre: "Chennai South",
    studio: "Coromandel",
    tenureMonths: 5,
    ownerRole: "Coromandel Retention EAE",
    dueAt: "2026-07-17T17:00:00+05:30",
    cohortName: "Jan 2026",
    cohortM6RetentionPct: 64,
    essentialsUsageCurrent: 8,
    essentialsUsageBaseline: 8,
    curryUsageCurrent: 5,
    curryUsageBaseline: 5,
    verifiedSavingsCurrentInr: 1700,
    verifiedSavingsBaselineInr: 1700,
    serviceRequests: [],
    incidentCount: 0,
    paymentOrWageCycleDisruption: false,
    nearMigrationBoundary: false,
    membershipEnded: false,
    verifiedExitReason: null,
    unreadWeeklyMessages: 0,
    billingContinuityEvidenced: false,
    repeatedFranchisePattern: false,
    theatreWideDeterioration: false,
    urgentMemberReply: false,
    updatedAt: "2026-07-17T11:45:00+05:30",
    ...overrides,
  }
}

function chain(overrides: Partial<LearningChain> = {}): LearningChain {
  const decision = decideRecoverableCause(context({ incidentCount: 2 }))!
  const action = assignRetentionAction(context({ incidentCount: 2 }), decision)
  return {
    event_id: "evt-001",
    action_id: action.actionId,
    policy_version: "member-engagement-v1",
    forecast: { retention_probability_pct: 72, expected_recovery_days: 5 },
    context_snapshot: { member_ref: "protected://member/token-001", theatre: "Chennai South", studio: "Coromandel", supply_model: "FONO", freshness: "Fresh" },
    decision,
    assigned_action: action,
    evidence: { reference: "protected://evidence/evt-001", cycles: 3 },
    independent_verification: { verifier_ref: "protected://verifier/qa-01", verified: true, self_verified: false },
    measured_outcome: { retained: true, source_metric_recovered: true, actual_recovery_days: 6 },
    variance_reason: "One-day delay after a reopened service request.",
    ...overrides,
  }
}

test("detects every locked strong Member Engagement trigger", () => {
  const cases: readonly [Partial<MemberEngagementContext>, string][] = [
    [{ serviceRequests: [{ requestId: "r1", pastSla: true, recurrenceCount: 1, resolved: false, reopened: false }] }, "Service request past SLA"],
    [{ serviceRequests: [{ requestId: "r1", pastSla: false, recurrenceCount: 2, resolved: false, reopened: true }] }, "Recurring service request"],
    [{ incidentCount: 2 }, "Second incident"],
    [{ essentialsUsageCurrent: 4 }, "Usage decline"],
    [{ paymentOrWageCycleDisruption: true }, "Payment or wage-cycle disruption"],
    [{ nearMigrationBoundary: true }, "Migration boundary near"],
    [{ verifiedSavingsCurrentInr: 1200 }, "Verified savings decline"],
    [{ membershipEnded: true }, "Membership end without reason"],
  ]
  for (const [overrides, signal] of cases) {
    const result = detectMemberEngagementEvent(context(overrides))
    assert.equal(result.disposition, "Action required")
    assert.ok(result.strongSignals.includes(signal as never), signal)
  }
})

test("three weeks of unread messages is weak evidence only", () => {
  const result = detectMemberEngagementEvent(context({ unreadWeeklyMessages: 3 }))
  assert.equal(result.disposition, "Monitor only")
  assert.deepEqual(result.strongSignals, [])
  assert.deepEqual(result.weakSignals, ["Unread weekly messages"])
  assert.match(result.reasons.join(" "), /cannot independently trigger an adverse action/i)
  assert.equal(decideRecoverableCause(context({ unreadWeeklyMessages: 3 }), result), null)
})

test("quarantines raw identity, conversation and missing supply model", () => {
  for (const input of [context({ memberRef: "member-001" }), context({ rawPhone: "+91..." }), context({ rawConversation: "private" }), context({ supplyModel: null })]) {
    assert.equal(detectMemberEngagementEvent(input).disposition, "Quarantined")
  }
})

test("decides the most evidenced recoverable cause without inferring intent from silence", () => {
  const savings = decideRecoverableCause(context({ verifiedSavingsCurrentInr: 1200, paymentOrWageCycleDisruption: true, unreadWeeklyMessages: 4 }))
  const friction = decideRecoverableCause(context({ incidentCount: 2, serviceRequests: [{ requestId: "r1", pastSla: true, recurrenceCount: 1, resolved: false, reopened: false }] }))
  assert.equal(savings?.cause, "Savings down")
  assert.equal(friction?.cause, "Friction up")
  assert.doesNotMatch(`${savings?.rationale} ${friction?.rationale}`, /silence|intent/i)
})

test("assigns one deterministic idempotent action to the Member's EAE", () => {
  const input = context({ incidentCount: 2 })
  const decision = decideRecoverableCause(input)!
  const first = assignRetentionAction(input, decision)
  const repeated = assignRetentionAction(input, decision)
  assert.equal(first.actionId, repeated.actionId)
  assert.equal(first.idempotencyKey, repeated.idempotencyKey)
  assert.equal(first.ownerRole, "Coromandel Retention EAE")
  assert.equal(first.externalEffect, false)
})

test("recurring unresolved requests reopen at higher priority", () => {
  const input = context({ serviceRequests: [{ requestId: "r1", pastSla: true, recurrenceCount: 2, resolved: false, reopened: true }] })
  const action = assignRetentionAction(input, decideRecoverableCause(input)!)
  assert.equal(action.state, "Reopened")
  assert.equal(action.priority, "High")
  assert.equal(recoverMemberEngagement(input).state, "Reopened")
})

test("workspace transitions use engine verification and recovery rather than local string mutation", () => {
  const task = buildMemberEngagementPreview().tasks[1]
  const recovered = recoverMemberEngagementTask(task, "Recovery evidence received")
  const recurring = recoverMemberEngagementTask(task, "Recurring request")
  const systemic = recoverMemberEngagementTask(task, "Systemic pattern")
  assert.equal(recovered.verification.status, "Verified recovered")
  assert.equal(recovered.task.state, "Verified recovered")
  assert.equal(recurring.verification.canClose, false)
  assert.equal(recurring.task.state, "Reopened")
  assert.equal(recurring.task.priority, "High")
  assert.equal(systemic.task.state, "Routed")
})

test("every unexplained membership end creates governed exit-reason capture", () => {
  const input = context({ membershipEnded: true })
  const action = assignRetentionAction(input, decideRecoverableCause(input)!)
  assert.equal(action.actionType, "Exit-reason capture")
})

test("independent source recovery can close while conversation alone cannot", () => {
  const verified = verifyRetentionRecovery({ evidenceRef: "protected://evidence/recovery", submittedBy: "eae-1", verifierId: "qa-1", evidenceFresh: true, sourceSignalRecovered: true, requestResolvedAndNotReopened: false, billingContinuityEvidenced: false, note: "Usage returned to own baseline." })
  const conversation = verifyRetentionRecovery({ evidenceRef: "protected://evidence/call", submittedBy: "eae-1", verifierId: "qa-1", evidenceFresh: true, sourceSignalRecovered: false, requestResolvedAndNotReopened: false, billingContinuityEvidenced: false, note: "Spoke to Member." })
  assert.equal(verified.canClose, true)
  assert.equal(conversation.canClose, false)
  assert.match(conversation.reasons.join(" "), /not a verified outcome/i)
})

test("stale evidence and self-verification fail closure", () => {
  const stale = verifyRetentionRecovery({ evidenceRef: "protected://evidence/recovery", submittedBy: "eae-1", verifierId: "qa-1", evidenceFresh: false, sourceSignalRecovered: true, requestResolvedAndNotReopened: false, billingContinuityEvidenced: false, note: "Recovered." })
  const self = verifyRetentionRecovery({ evidenceRef: "protected://evidence/recovery", submittedBy: "eae-1", verifierId: "eae-1", evidenceFresh: true, sourceSignalRecovered: true, requestResolvedAndNotReopened: false, billingContinuityEvidenced: false, note: "Recovered." })
  assert.equal(stale.status, "Reopened")
  assert.equal(self.status, "Rejected")
  assert.equal(stale.canClose || self.canClose, false)
})

test("systemic patterns route to the owning loop", () => {
  assert.equal(recoverMemberEngagement(context({ repeatedFranchisePattern: true })).routeTo, "Franchise review loop")
  assert.equal(recoverMemberEngagement(context({ theatreWideDeterioration: true })).routeTo, "Theatre performance loop")
})

test("escalation routing retains each named human owner", () => {
  const escalations = buildMemberEscalations(context({ cohortM6RetentionPct: 64, repeatedFranchisePattern: true, theatreWideDeterioration: true, urgentMemberReply: true }))
  assert.deepEqual(escalations.map((item) => item.owner), ["Theatre lead", "Pushkar", "CEO/COO", "Human safety/service queue"])
})

test("Member Engagement emits governed Despatch records and shared Loop Health", () => {
  const input = context({ cohortM6RetentionPct: 64, urgentMemberReply: true, incidentCount: 2 })
  const decision = decideRecoverableCause(input, detectMemberEngagementEvent(input))!
  const action = assignRetentionAction(input, decision)
  const records = emitMemberEngagementDespatchEscalations(input, action)
  assert.deepEqual(records.map((record) => record.ownerRole), ["Theatre lead", "Human safety/service queue"])
  assert.ok(records.every((record) => record.sourceActionId === action.actionId && record.evidenceRefs[0].startsWith("protected://")))
  const preview = buildMemberEngagementPreview()
  assert.equal(projectMemberEngagementLoopHealth(preview.tasks, preview.quarantinedCount).state, "Cannot confirm")
  assert.equal(preview.loopHealth.overviewAnswerAllowed, false)
})

test("weekly message remains an approved-template shadow contract and never sends", () => {
  const eligible = evaluateWeeklyMessage({ templateApproved: true, hasVerifiedSpendOrSavings: true, approvedNonNumericalCheck: false, languageConfirmed: true, consentConfirmed: true, optOutAvailable: true, withinQuietHoursPolicy: true, containsFreeFormText: false, containsPromotionOrOffer: false })
  const blocked = evaluateWeeklyMessage({ templateApproved: false, hasVerifiedSpendOrSavings: false, approvedNonNumericalCheck: false, languageConfirmed: false, consentConfirmed: false, optOutAvailable: false, withinQuietHoursPolicy: false, containsFreeFormText: true, containsPromotionOrOffer: true })
  assert.equal(eligible.eligibleForFutureLiveEnablement, true)
  assert.equal(eligible.mode, "Shadow only")
  assert.equal(eligible.sent, false)
  assert.equal(blocked.eligibleForFutureLiveEnablement, false)
  assert.match(blocked.reasons.join(" "), /Free-form|Promotions|Consent|Quiet-hours/)
})

test("learning chain preserves the exact governed field order", () => {
  assert.deepEqual(LEARNING_CHAIN_FIELDS, ["policy_version", "forecast", "context_snapshot", "decision", "assigned_action", "evidence", "independent_verification", "measured_outcome", "variance_reason"])
  const record = chain()
  for (const field of LEARNING_CHAIN_FIELDS) assert.ok(field in record)
})

test("learning input exports the shared gate contract without a domain-side engine", () => {
  const input = buildMemberEngagementLearningInput(chain(), { holdoutOrControl: true, comparisonCohort: false, confounders: [], sampleSize: 40, forecastErrorPct: 6, verificationRatePct: 92, affectedHumanControlledCategories: ["Templates", "People decisions"], insideApprovedBoundary: false, reversesHumanDecision: true })
  for (const key of ["proposed_change", "expected_effect", "evidence_cycles", "sample_size", "forecast_error_pct", "attribution_grade", "confounders", "critical_data_fresh", "verification_rate_pct", "reversible", "rollback_trigger", "inside_approved_boundary", "reverses_human_decision", "affected_human_controlled_categories", "target_effect", "channel_effect", "cm_effect", "cash_effect"]) assert.ok(key in input, key)
  assert.equal(input.attribution_grade, "Controlled")
  assert.deepEqual(input.affected_human_controlled_categories, ["Templates", "People decisions"])
  assert.equal(input.production_confidence, "Low")
  assert.equal(input.registry_thresholds_approved, false)
  assert.equal(input.auto_adopt, false)
})

test("Observed learning always states that confounders are not ruled out", () => {
  const input = buildMemberEngagementLearningInput(chain(), { holdoutOrControl: false, comparisonCohort: false, confounders: [], sampleSize: 14, forecastErrorPct: 8, verificationRatePct: 83 })
  assert.equal(input.attribution_grade, "Observed")
  assert.deepEqual(input.confounders, ["confounders not ruled out"])
})

test("learning excludes stale, unverified and self-verified outcomes", () => {
  const stale = buildMemberEngagementLearningInput(chain({ context_snapshot: { member_ref: "protected://member/token-001", theatre: "Chennai South", studio: "Coromandel", supply_model: "FONO", freshness: "Stale" } }), { holdoutOrControl: false, comparisonCohort: true, confounders: ["seasonality"], sampleSize: 20, forecastErrorPct: 9, verificationRatePct: 60 })
  const self = buildMemberEngagementLearningInput(chain({ independent_verification: { verifier_ref: "protected://verifier/eae", verified: true, self_verified: true } }), { holdoutOrControl: false, comparisonCohort: true, confounders: [], sampleSize: 20, forecastErrorPct: 9, verificationRatePct: 60 })
  const unverified = buildMemberEngagementLearningInput(chain({ independent_verification: { verifier_ref: "protected://verifier/qa", verified: false, self_verified: false } }), { holdoutOrControl: false, comparisonCohort: true, confounders: [], sampleSize: 20, forecastErrorPct: 9, verificationRatePct: 60 })
  assert.equal(stale.eligible_for_shared_learning_gate, false)
  assert.equal(self.eligible_for_shared_learning_gate, false)
  assert.equal(unverified.eligible_for_shared_learning_gate, false)
})

test("synthetic preview exposes exactly four locked measures and named curves", () => {
  const preview = buildMemberEngagementPreview()
  assert.equal(preview.measures.length, 4)
  assert.deepEqual(preview.measures.map((measure) => measure.id), ["m6-retention", "monthly-churn", "exit-reasons", "at-risk-recovery"])
  assert.deepEqual(preview.retentionCurves.map((curve) => curve.cohort), ["Jan 2026", "Feb 2026", "Mar 2026"])
  assert.equal(preview.mode, "Shadow only")
  assert.equal(preview.blockedCapabilities.productionWrites, false)
  assert.equal(preview.blockedCapabilities.externalMessages, false)
  assert.ok(preview.tasks.every((task) => task.actionId.startsWith("action-")))
  assert.deepEqual(preview.tasks.map((task) => task.state), ["Awaiting verification", "Open", "Reopened"])
})
