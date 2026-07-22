import assert from "node:assert/strict"
import test from "node:test"
import {
  MEMBER_SAVINGS_LEARNING_CHAIN_FIELDS,
  MEMBER_SAVINGS_POLICY_REGISTRY,
  assignMemberSavingsAction,
  buildMemberSavingsEscalations,
  buildMemberSavingsLearningInput,
  buildMemberSavingsPreview,
  buildWeeklySavingsMessageInput,
  decideMemberSavings,
  detectMemberSavingsEvent,
  emitMemberSavingsDespatchEscalations,
  evaluateSavingsDualGate,
  recoverMemberSavingsAction,
  recoverMemberSavingsTask,
  projectMemberSavingsLoopHealth,
  verifyMemberSavingsRecovery,
  type SavingsLearningChain,
  type SavingsServiceContext,
  type SavingsSignalInput,
} from "@/lib/operating-loop/member-savings-loop"

function context(overrides: Partial<SavingsServiceContext> = {}): SavingsServiceContext {
  return {
    theatre: "Chennai South", studio: "Oragadam 01", serviceName: "Curry weekly basket",
    serviceRef: "protected://service/curry", supplierRef: "protected://supplier/synthetic-01", marketReferenceRef: "protected://market/curry-current", evidenceRef: "protected://evidence/curry-current",
    memberPriceInr: 100, marketReferenceInr: 120, priorVerifiedSavingsInr: 20, actualNiaUnitMarginInr: 8,
    attachPct: 40, peerBand: { floorPct: 38, ceilingPct: 44, status: "Approved", version: 1, source: "Approved test registry" }, repeatPct: 62, repeatBaselinePct: 60,
    stockout: false, fulfilmentFailure: false, jogoCoverage: "JOGO · Oragadam", eaeCoverage: "EAE · Oragadam", supplierStatus: "Healthy", structuralCurryContext: "Shared kitchen capacity available",
    marketReferenceVerified: true, marginVerified: true, submittedBy: "eae-synth", verifierId: "qa-synth", dataFreshness: "Current",
    ...overrides,
  }
}

function signal(contextOverrides: Partial<SavingsServiceContext> = {}, overrides: Partial<SavingsSignalInput> = {}): SavingsSignalInput {
  return { eventId: "evt-save-001", ownerRole: "Essentials category lead", dueAt: "2026-07-17T18:00:00+05:30", occurredAt: "2026-07-17T15:00:00+05:30", repeatedDualGateCycles: 0, categoryWideRepeatDrop: false, context: context(contextOverrides), ...overrides }
}

function admitted(input = signal({ repeatPct: 55 })) {
  const result = detectMemberSavingsEvent(input)
  assert.equal(result.disposition, "Admitted")
  if (result.disposition !== "Admitted") throw new Error("Expected admitted fixture")
  return result.event
}

function learningChain(overrides: Partial<SavingsLearningChain> = {}): SavingsLearningChain {
  const event = admitted()
  const decision = decideMemberSavings(event)
  const action = assignMemberSavingsAction(event, decision)
  return {
    event_id: event.eventId, action_id: action.actionId, policy_version: event.policyVersion,
    forecast: { recovery_probability_pct: 70, expected_recovery_days: 4, expected_member_savings_inr: 22, expected_nia_margin_inr: 9 },
    context_snapshot: { service_ref: event.context.serviceRef, theatre: event.context.theatre, studio: event.context.studio, service: event.context.serviceName, data_freshness: "Current", quarantined: false },
    decision, assigned_action: action, evidence: { reference: "protected://evidence/learn", cycles: 3 },
    independent_verification: { verified: true, verifier_ref: "protected://verifier/qa", self_verified: false },
    measured_outcome: { member_savings_inr: 22, nia_margin_inr: 9, attach_pct: 40, repeat_pct: 61, recovered_source_metric: true }, variance_reason: "Synthetic recovery matched forecast.",
    ...overrides,
  }
}

test("dual gate passes only with positive savings, positive margin and independent verification", () => {
  const pass = evaluateSavingsDualGate(context())
  const savingFail = evaluateSavingsDualGate(context({ memberPriceInr: 120 }))
  const marginFail = evaluateSavingsDualGate(context({ actualNiaUnitMarginInr: 0 }))
  const unverified = evaluateSavingsDualGate(context({ verifierId: "eae-synth" }))
  assert.equal(pass.status, "Pass")
  assert.equal(pass.memberSavingsInr, 20)
  assert.equal(savingFail.status, "Exception")
  assert.equal(marginFail.status, "Exception")
  assert.equal(unverified.status, "Unverified")
})

test("every service failing either economic side is an exception", () => {
  for (const overrides of [{ memberPriceInr: 121 }, { actualNiaUnitMarginInr: -1 }]) {
    const result = detectMemberSavingsEvent(signal(overrides))
    assert.equal(result.disposition, "Admitted")
    if (result.disposition === "Admitted") assert.ok(result.event.triggers.includes("Dual-gate failure"))
  }
})

test("detects each locked operating trigger", () => {
  const cases: readonly [Partial<SavingsServiceContext>, string][] = [
    [{ attachPct: 30 }, "Low attach versus peer band"],
    [{ repeatPct: 55 }, "Repeat decline versus own baseline"],
    [{ memberPriceInr: 105 }, "Verified savings erosion"],
    [{ stockout: true }, "Stockout or fulfilment failure"],
    [{ actualNiaUnitMarginInr: -1 }, "Dual-gate failure"],
  ]
  for (const [overrides, trigger] of cases) {
    const result = detectMemberSavingsEvent(signal(overrides))
    assert.equal(result.disposition, "Admitted")
    if (result.disposition === "Admitted") assert.ok(result.event.triggers.includes(trigger as never), trigger)
  }
})

test("pending peer-band policy does not invent a value or block other signals", () => {
  const pendingBand = { floorPct: null, ceilingPct: null, status: "Pending human approval" as const, version: 1, source: "No value approved" }
  const onlyPending = detectMemberSavingsEvent(signal({ peerBand: pendingBand, priorVerifiedSavingsInr: 20, repeatPct: 60 }))
  const repeatStillRuns = detectMemberSavingsEvent(signal({ peerBand: pendingBand, repeatPct: 55 }))
  assert.equal(onlyPending.disposition, "Monitor pending approval")
  assert.match(onlyPending.reasons.join(" "), /disabled pending human approval/i)
  assert.equal(repeatStillRuns.disposition, "Admitted")
  if (repeatStillRuns.disposition === "Admitted") assert.ok(repeatStillRuns.event.triggers.includes("Repeat decline versus own baseline"))
})

test("unresolved thresholds are versioned and explicitly pending human approval", () => {
  const pending = MEMBER_SAVINGS_POLICY_REGISTRY.filter((policy) => policy.status === "Pending human approval")
  assert.equal(pending.length, 3)
  for (const policy of pending) {
    assert.equal(policy.value, null)
    assert.equal(policy.version, 1)
    assert.equal(policy.approver, "Pending")
  }
})

test("raw identities and unprotected lineage quarantine before action", () => {
  for (const input of [signal({ serviceRef: "service-1" }), signal({ supplierRef: "supplier-1" }), signal({ marketReferenceRef: "market-1" }), signal({ rawSupplierContact: "private" }), signal({ rawMemberIdentity: "private" })]) {
    assert.equal(detectMemberSavingsEvent(input).disposition, "Quarantined")
  }
})

test("decision maps each trigger to the locked action type and human owner", () => {
  const activation = decideMemberSavings(admitted(signal({ attachPct: 30 })))
  const replenishment = decideMemberSavings(admitted(signal({ stockout: true })))
  const repricing = decideMemberSavings(admitted(signal({ memberPriceInr: 105 })))
  const review = decideMemberSavings(admitted(signal({ actualNiaUnitMarginInr: -1 })))
  assert.equal(activation.kind, "EAE/JOGO activation")
  assert.equal(replenishment.kind, "Replenishment")
  assert.equal(repricing.kind, "Repricing proposal")
  assert.equal(repricing.ownerRole, "Pushkar")
  assert.equal(review.kind, "Supplier/service review")
  assert.equal(review.humanApprovalRequired, true)
})

test("assignment is deterministic, idempotent and has no external effect", () => {
  const event = admitted()
  const decision = decideMemberSavings(event)
  const first = assignMemberSavingsAction(event, decision)
  const second = assignMemberSavingsAction(event, decision)
  assert.equal(first.actionId, second.actionId)
  assert.equal(first.idempotencyKey, second.idempotencyKey)
  assert.equal(first.externalEffect, false)
})

test("repricing and supplier review remain proposals with disabled execution", () => {
  const repricingEvent = admitted(signal({ memberPriceInr: 105 }))
  const repricing = assignMemberSavingsAction(repricingEvent, decideMemberSavings(repricingEvent))
  const reviewEvent = admitted(signal({ actualNiaUnitMarginInr: -1 }))
  const review = assignMemberSavingsAction(reviewEvent, decideMemberSavings(reviewEvent))
  assert.match(repricing.nextAction, /do not change price/i)
  assert.match(review.nextAction, /do not contract or delist/i)
  assert.equal(repricing.externalEffect || review.externalEffect, false)
})

test("verification requires source-metric recovery and a current live market reference", () => {
  const event = admitted(signal({ repeatPct: 55 }))
  const action = assignMemberSavingsAction(event, decideMemberSavings(event))
  const base = { evidenceRef: "protected://evidence/outcome", marketReferenceRef: "protected://market/current", submittedBy: "eae", verifierId: "qa", dataFreshness: "Current" as const, marketReferenceLive: true, actualAttachPct: 40, actualRepeatPct: 60, actualMemberSavingsInr: 20, actualNiaMarginInr: 8, fulfilmentRecovered: false, activityVisitOnly: false, quarantined: false }
  assert.equal(verifyMemberSavingsRecovery(action, base).canClose, true)
  assert.equal(verifyMemberSavingsRecovery(action, { ...base, actualRepeatPct: 55 }).canClose, false)
  assert.equal(verifyMemberSavingsRecovery(action, { ...base, dataFreshness: "Stale" }).status, "Reopened")
})

test("an activity visit and self-verification never close", () => {
  const event = admitted()
  const action = assignMemberSavingsAction(event, decideMemberSavings(event))
  const base = { evidenceRef: "protected://evidence/outcome", marketReferenceRef: "protected://market/current", submittedBy: "eae", verifierId: "qa", dataFreshness: "Current" as const, marketReferenceLive: true, actualAttachPct: 40, actualRepeatPct: 60, actualMemberSavingsInr: 20, actualNiaMarginInr: 8, fulfilmentRecovered: true, activityVisitOnly: false, quarantined: false }
  const visit = verifyMemberSavingsRecovery(action, { ...base, activityVisitOnly: true })
  const self = verifyMemberSavingsRecovery(action, { ...base, verifierId: "eae" })
  assert.equal(visit.canClose, false)
  assert.match(visit.reasons.join(" "), /activity visit/i)
  assert.equal(self.status, "Rejected")
})

test("evidence and recovery states keep unresolved work open", () => {
  const event = admitted()
  const action = assignMemberSavingsAction(event, decideMemberSavings(event))
  assert.equal(recoverMemberSavingsAction(action, "Evidence received").state, "Evidence pending")
  assert.equal(recoverMemberSavingsAction(action, "Failed evidence").state, "Reopened")
  assert.equal(recoverMemberSavingsAction(action, "Systemic pattern").state, "Routed")
})

test("workspace transitions use the recovery and source-metric verification engines", () => {
  const task = buildMemberSavingsPreview().tasks[2]
  const verified = recoverMemberSavingsTask(task, "Evidence received")
  const failed = recoverMemberSavingsTask(task, "Failed evidence")
  const systemic = recoverMemberSavingsTask(task, "Systemic pattern")
  assert.equal(verified.verification.status, "Verified recovered")
  assert.equal(verified.task.state, "Verified recovered")
  assert.equal(failed.verification.status, "Reopened")
  assert.equal(failed.task.state, "Reopened")
  assert.equal(systemic.verification.canClose, false)
  assert.equal(systemic.task.state, "Routed")
})

test("repeated dual-gate and category-wide repeat decline use named escalations", () => {
  const event = admitted(signal({ actualNiaUnitMarginInr: -1 }, { repeatedDualGateCycles: 2, categoryWideRepeatDrop: true }))
  assert.deepEqual(buildMemberSavingsEscalations(event).map((row) => row.ownerRole), ["Pushkar", "CEO/COO"])
})

test("Member Savings emits governed Despatch records and shared Loop Health", () => {
  const event = admitted(signal({ actualNiaUnitMarginInr: -1 }, { repeatedDualGateCycles: 2 }))
  const action = assignMemberSavingsAction(event, decideMemberSavings(event))
  const records = emitMemberSavingsDespatchEscalations(event, action)
  assert.equal(records[0].domain, "Member Savings")
  assert.equal(records[0].sourceActionId, action.actionId)
  assert.match(records[0].evidenceRefs[0], /^protected:\/\//)
  const preview = buildMemberSavingsPreview()
  assert.equal(projectMemberSavingsLoopHealth(preview.tasks, preview.quarantineCount).state, "Cannot confirm")
  assert.equal(preview.loopHealth.overviewAnswerAllowed, false)
})

test("weekly savings message emits only shadow verified inputs and never sends", () => {
  const eligible = buildWeeklySavingsMessageInput(context())
  const stale = buildWeeklySavingsMessageInput(context({ dataFreshness: "Stale" }))
  assert.equal(eligible.mode, "Shadow only")
  assert.equal(eligible.sent, false)
  assert.equal(eligible.eligibleVerifiedInput, true)
  assert.equal(stale.eligibleVerifiedInput, false)
  assert.equal(stale.verifiedSavingsInr, null)
})

test("learning chain preserves the exact governed field order", () => {
  assert.deepEqual(MEMBER_SAVINGS_LEARNING_CHAIN_FIELDS, ["policy_version", "forecast", "context_snapshot", "decision", "assigned_action", "evidence", "independent_verification", "measured_outcome", "variance_reason"])
  const chain = learningChain()
  for (const field of MEMBER_SAVINGS_LEARNING_CHAIN_FIELDS) assert.ok(field in chain)
})

test("learning export contains the complete shared control input and no auto-adoption", () => {
  const input = buildMemberSavingsLearningInput(learningChain(), { holdoutOrControl: true, comparisonGroup: false, confounders: [], sampleSize: 44, forecastErrorPct: 7, verificationRatePct: 91, affectedHumanControlledCategories: ["Pricing", "Supplier contracts", "Cash"], insideApprovedBoundary: false, reversesHumanDecision: true })
  for (const field of ["proposed_change", "expected_effect", "evidence_cycles", "sample_size", "forecast_error_pct", "attribution_grade", "confounders", "critical_data_fresh", "verification_rate_pct", "reversible", "rollback_trigger", "inside_approved_boundary", "reverses_human_decision", "affected_human_controlled_categories", "target_effect", "channel_effect", "cm_effect", "cash_effect"]) assert.ok(field in input, field)
  assert.equal(input.attribution_grade, "Controlled")
  assert.deepEqual(input.affected_human_controlled_categories, ["Pricing", "Supplier contracts", "Cash"])
  assert.equal(input.production_confidence, "Low")
  assert.equal(input.registry_thresholds_approved, false)
  assert.equal(input.auto_adopt, false)
})

test("Observed learning visibly states confounders not ruled out", () => {
  const input = buildMemberSavingsLearningInput(learningChain(), { holdoutOrControl: false, comparisonGroup: false, confounders: [], sampleSize: 18, forecastErrorPct: 9, verificationRatePct: 86 })
  assert.equal(input.attribution_grade, "Observed")
  assert.deepEqual(input.confounders, ["confounders not ruled out"])
})

test("stale, quarantined, unverified and self-verified learning is rejected", () => {
  const options = { holdoutOrControl: false, comparisonGroup: true, confounders: ["seasonality"], sampleSize: 18, forecastErrorPct: 9, verificationRatePct: 60 }
  const rows = [
    learningChain({ context_snapshot: { service_ref: "protected://service/curry", theatre: "Chennai South", studio: "Oragadam 01", service: "Curry", data_freshness: "Stale", quarantined: false } }),
    learningChain({ context_snapshot: { service_ref: "protected://service/curry", theatre: "Chennai South", studio: "Oragadam 01", service: "Curry", data_freshness: "Current", quarantined: true } }),
    learningChain({ independent_verification: { verified: false, verifier_ref: "protected://verifier/qa", self_verified: false } }),
    learningChain({ independent_verification: { verified: true, verifier_ref: "protected://verifier/eae", self_verified: true } }),
  ]
  for (const row of rows) assert.equal(buildMemberSavingsLearningInput(row, options).eligible_for_shared_learning_gate, false)
})

test("preview exposes exactly four measures, paired gate data and blocked capabilities", () => {
  const preview = buildMemberSavingsPreview()
  assert.equal(preview.measures.length, 4)
  assert.deepEqual(preview.measures.map((measure) => measure.id), ["verified-savings", "attach-repeat", "dual-gate", "exceptions"])
  assert.equal(preview.services.filter((service) => service.status === "Exception").length, 1)
  assert.equal(preview.blockedCapabilities.priceChanges, false)
  assert.equal(preview.blockedCapabilities.supplierContracts, false)
  assert.equal(preview.blockedCapabilities.moneyMovement, false)
  assert.equal(preview.blockedCapabilities.autoAdoption, false)
  assert.ok(preview.tasks.every((task) => task.actionId === task.engineAction.actionId))
  assert.deepEqual(preview.tasks.map((task) => task.engineAction.kind), ["Supplier/service review", "Repricing proposal", "EAE/JOGO activation"])
})
