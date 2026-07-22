import assert from "node:assert/strict"
import test from "node:test"
import {
  NIA_GROWTH_BLOCKED_CAPABILITIES,
  NIA_GROWTH_LEARNING_CHAIN_FIELDS,
  NIA_GROWTH_POLICY_REGISTRY,
  assignNiaGrowthAction,
  buildNiaGrowthLearningInput,
  buildNiaGrowthPreview,
  decideNiaGrowth,
  detectNiaGrowthEvent,
  emitNiaGrowthDespatchEscalations,
  recoverNiaGrowthAction,
  validateGrowthActionContext,
  verifyNiaGrowthReadiness,
  type GrowthContext,
  type GrowthEvent,
  type GrowthLearningChain,
  type GrowthSignalInput,
} from "./nia-growth-loop"

function context(overrides: Partial<GrowthContext> = {}): GrowthContext {
  return {
    opportunityRef: "protected://opportunity/fono-test", locationRef: "protected://location/fono-test", evidenceRef: "protected://evidence/fono-test",
    supplyModel: "FONO", theatre: "Test Theatre", displayLocation: "Protected cluster", proposedCapacityNests: 100, activationReadyNests: 70, opportunityToReadyDays: 10,
    activationReadinessDelayed: true, readinessBlocker: "franchise base evidence", dataFreshness: "Current", submittedBy: "protected://actor/growth", verifierRef: "protected://verifier/qa",
    franchiseBaseCommitmentNests: 80, franchiseBaseReadyNests: 60, niaFillSupportReadyNests: 10, niaFillSupportProvided: true, consecutiveBelowBreakevenCycles: 1,
    contractRef: null, signedEnterpriseCoverageNests: null, underwritingAssessment: null, underwritingAssessmentRef: null, capexExposureInr: null, buildOut: null, hardware: null, contractedServices: null,
    ...overrides,
  }
}

function spContext(overrides: Partial<GrowthContext> = {}): GrowthContext {
  return context({
    opportunityRef: "protected://opportunity/sp-test", locationRef: "protected://location/sp-test", evidenceRef: "protected://evidence/sp-test", supplyModel: "SP",
    franchiseBaseCommitmentNests: null, franchiseBaseReadyNests: null, niaFillSupportReadyNests: null, niaFillSupportProvided: null, consecutiveBelowBreakevenCycles: null,
    contractRef: "protected://contract/sp-test", signedEnterpriseCoverageNests: 80, underwritingAssessment: "Below approved underwriting", underwritingAssessmentRef: "protected://underwriting/sp-test",
    capexExposureInr: 1_000_000, buildOut: "Ready", hardware: "Blocked", contractedServices: "Pending evidence", readinessBlocker: "hardware evidence", ...overrides,
  })
}

function signal(contextOverrides: Partial<GrowthContext> = {}, inputOverrides: Partial<GrowthSignalInput> = {}): GrowthSignalInput {
  return { eventId: "evt-growth-test", ownerRole: "Growth lead", dueAt: "2026-07-18T12:00:00+05:30", occurredAt: "2026-07-17T15:30:00+05:30", context: context(contextOverrides), ...inputOverrides }
}

function admitted(input: GrowthSignalInput = signal()): GrowthEvent {
  const result = detectNiaGrowthEvent(input)
  if (result.disposition === "Admitted") return result.event
  throw new Error(result.reasons.join(" "))
}

function actionFor(event = admitted()) {
  return assignNiaGrowthAction(event, decideNiaGrowth(event))
}

function learningChain(overrides: Partial<GrowthLearningChain> = {}): GrowthLearningChain {
  const event = admitted()
  const action = actionFor(event)
  return {
    event_id: event.eventId, action_id: action.actionId, policy_version: event.policyVersion,
    forecast: { activation_ready_probability_pct: 70, expected_ready_days: 10, expected_ready_nests: 100, expected_contract_coverage_nests: 0 },
    context_snapshot: { opportunity_ref: event.context.opportunityRef, supply_model: "FONO", theatre: event.context.theatre, data_freshness: "Current", quarantined: false },
    decision: decideNiaGrowth(event), assigned_action: action, evidence: { reference: event.context.evidenceRef, cycles: 2 },
    independent_verification: { verified: true, verifier_ref: "protected://verifier/qa", self_verified: false },
    measured_outcome: { activation_ready_nests: 84, ready_days: 9, signed_contract_coverage_nests: 0, intervention_recovered_source_metric: true },
    variance_reason: "Test fixture variance", ...overrides,
  }
}

test("missing supply_model is quarantined and never inferred", () => {
  const result = detectNiaGrowthEvent(signal({ supplyModel: null }))
  assert.equal(result.disposition, "Quarantined")
  assert.match(result.reasons.join(" "), /supply_model/i)
})

test("raw property identity or coordinates are quarantined", () => {
  for (const row of [{ rawPropertyOwner: "name" }, { rawCoordinates: "12,80" }]) {
    assert.equal(detectNiaGrowthEvent(signal(row)).disposition, "Quarantined")
  }
})

test("FONO and SP reject the other channel's context", () => {
  assert.equal(detectNiaGrowthEvent(signal({ contractRef: "protected://contract/wrong", capexExposureInr: 1 })).disposition, "Quarantined")
  assert.equal(detectNiaGrowthEvent({ ...signal(), context: spContext({ franchiseBaseCommitmentNests: 10 }) }).disposition, "Quarantined")
})

test("activation readiness delay is a governed trigger", () => {
  const result = detectNiaGrowthEvent(signal())
  assert.equal(result.disposition, "Admitted")
  if (result.disposition === "Admitted") assert.ok(result.event.triggers.includes("Activation readiness delay"))
})

test("FONO franchise review requires two cycles despite Nia-fill support", () => {
  const one = detectNiaGrowthEvent(signal({ activationReadinessDelayed: false, consecutiveBelowBreakevenCycles: 1 }))
  const two = detectNiaGrowthEvent(signal({ activationReadinessDelayed: false, consecutiveBelowBreakevenCycles: 2 }))
  assert.notEqual(one.disposition, "Admitted")
  assert.equal(two.disposition, "Admitted")
  if (two.disposition === "Admitted") assert.ok(two.event.triggers.includes("FONO below breakeven after Nia-fill support"))
})

test("SP underwriting and named readiness blockers trigger without inventing a numeric threshold", () => {
  const result = detectNiaGrowthEvent({ ...signal(), context: spContext() })
  assert.equal(result.disposition, "Admitted")
  if (result.disposition === "Admitted") assert.deepEqual(result.event.triggers, ["Activation readiness delay", "SP coverage below approved underwriting", "SP readiness blocker"])
  assert.equal(NIA_GROWTH_POLICY_REGISTRY.find((row) => row.policyId === "POL-GROWTH-SP-UNDERWRITING")?.value, null)
})

test("unapproved SP underwriting threshold monitors instead of inventing policy", () => {
  const result = detectNiaGrowthEvent({ ...signal(), context: spContext({ activationReadinessDelayed: false, readinessBlocker: null, hardware: "Ready", contractedServices: "Ready", underwritingAssessment: "Pending human approval" }) })
  assert.equal(result.disposition, "Monitor pending approval")
  assert.match(result.reasons.join(" "), /pending human approval/i)
})

test("channel-correct decisions route FONO base, Nia fill and franchise review separately", () => {
  const base = decideNiaGrowth(admitted())
  assert.equal(base.kind, "Franchise performance")
  const niaFill = decideNiaGrowth(admitted(signal({ franchiseBaseReadyNests: 80, activationReadinessDelayed: true })))
  assert.equal(niaFill.kind, "Nia-fill support")
  const review = decideNiaGrowth(admitted(signal({ consecutiveBelowBreakevenCycles: 2 })))
  assert.equal(review.kind, "Franchise review")
  assert.equal(review.humanSignOffRequired, true)
})

test("SP coverage slip escalates immediately while FONO waits for its locked second cycle", () => {
  const spEvent = admitted({ ...signal(), context: spContext({ activationReadinessDelayed: false, readinessBlocker: null, hardware: "Ready", contractedServices: "Ready" }) })
  assert.equal(decideNiaGrowth(spEvent).kind, "CEO/COO escalation")
  assert.notEqual(detectNiaGrowthEvent(signal({ activationReadinessDelayed: false, consecutiveBelowBreakevenCycles: 1 })).disposition, "Admitted")
  assert.equal(NIA_GROWTH_POLICY_REGISTRY.find((row) => row.policyId === "POL-GROWTH-ESCALATION-CLOCKS")?.status, "Pending human approval")
})

test("SP blocker names the blocking milestone", () => {
  const event = admitted({ ...signal(), context: spContext({ underwritingAssessment: "Covered", readinessBlocker: "contracted hardware evidence" }) })
  const decision = decideNiaGrowth(event)
  assert.equal(decision.kind, "Named build-out blocker")
  assert.match(decision.rationale, /contracted hardware evidence/i)
})

test("the orchestrator rejects a playbook mismatch", () => {
  assert.equal(validateGrowthActionContext({ supplyModel: "FONO", kind: "Named build-out blocker" }).valid, false)
  assert.equal(validateGrowthActionContext({ supplyModel: "SP", kind: "Franchise review" }).valid, false)
  assert.equal(validateGrowthActionContext({ supplyModel: "SP", kind: "CEO/COO escalation" }).valid, true)
})

test("assignment is stable, idempotent and has no external effect", () => {
  const event = admitted()
  const decision = decideNiaGrowth(event)
  const first = assignNiaGrowthAction(event, decision)
  const second = assignNiaGrowthAction(event, decision)
  assert.equal(first.actionId, second.actionId)
  assert.equal(first.idempotencyKey, second.idempotencyKey)
  assert.equal(first.externalEffect, false)
})

test("property, finance and expansion paths remain recommendation only", () => {
  const event = admitted({ ...signal(), context: spContext() })
  const action = actionFor(event)
  assert.equal(action.recommendationOnly, true)
  assert.equal(action.state, "Awaiting sign-off")
  assert.match(action.nextAction, /do not commit capex, property or contract/i)
})

test("FONO verification requires ready-to-spec capacity and independent supply context", () => {
  const action = actionFor()
  const valid = { supplyModel: "FONO" as const, evidenceRef: "protected://evidence/outcome", submittedBy: "protected://actor/growth", verifierRef: "protected://verifier/qa", dataFreshness: "Current" as const, capacityReadyToSpec: true, activationReadyNests: 20, signedContractCoverageVerified: false, buildOutReady: false, hardwareReadyWhereContracted: false, contractedServicesReady: false, supplyModelContextVerified: true, activityClaimOnly: false, quarantined: false }
  assert.equal(verifyNiaGrowthReadiness(action, valid).canClose, true)
  assert.equal(verifyNiaGrowthReadiness(action, { ...valid, capacityReadyToSpec: false }).canClose, false)
  assert.equal(verifyNiaGrowthReadiness(action, { ...valid, supplyModelContextVerified: false }).canClose, false)
})

test("SP verification requires signed coverage, build, hardware and services", () => {
  const event = admitted({ ...signal(), context: spContext() })
  const action = actionFor(event)
  const valid = { supplyModel: "SP" as const, evidenceRef: "protected://evidence/outcome", submittedBy: "protected://actor/sp", verifierRef: "protected://verifier/qa", dataFreshness: "Current" as const, capacityReadyToSpec: true, activationReadyNests: 40, signedContractCoverageVerified: true, buildOutReady: true, hardwareReadyWhereContracted: true, contractedServicesReady: true, supplyModelContextVerified: true, activityClaimOnly: false, quarantined: false }
  assert.equal(verifyNiaGrowthReadiness(action, valid).canClose, true)
  assert.equal(verifyNiaGrowthReadiness(action, { ...valid, signedContractCoverageVerified: false }).canClose, false)
  assert.equal(verifyNiaGrowthReadiness(action, { ...valid, hardwareReadyWhereContracted: false }).canClose, false)
})

test("activity, self-verification, mismatched supply and stale evidence never close", () => {
  const action = actionFor()
  const base = { supplyModel: "FONO" as const, evidenceRef: "protected://evidence/outcome", submittedBy: "protected://actor/growth", verifierRef: "protected://verifier/qa", dataFreshness: "Current" as const, capacityReadyToSpec: true, activationReadyNests: 20, signedContractCoverageVerified: false, buildOutReady: false, hardwareReadyWhereContracted: false, contractedServicesReady: false, supplyModelContextVerified: true, activityClaimOnly: false, quarantined: false }
  assert.equal(verifyNiaGrowthReadiness(action, { ...base, activityClaimOnly: true }).canClose, false)
  assert.equal(verifyNiaGrowthReadiness(action, { ...base, verifierRef: base.submittedBy }).status, "Rejected")
  assert.equal(verifyNiaGrowthReadiness(action, { ...base, supplyModel: "SP" }).status, "Rejected")
  assert.equal(verifyNiaGrowthReadiness(action, { ...base, dataFreshness: "Stale" }).status, "Reopened")
})

test("recovery keeps evidence, failure and sign-off work open", () => {
  const action = actionFor()
  assert.equal(recoverNiaGrowthAction(action, "Evidence received").state, "Evidence pending")
  assert.equal(recoverNiaGrowthAction(action, "Failed evidence").state, "Reopened")
  assert.equal(recoverNiaGrowthAction(action, "Human sign-off required").state, "Awaiting sign-off")
})

test("learning chain preserves the exact governed field order", () => {
  assert.deepEqual(NIA_GROWTH_LEARNING_CHAIN_FIELDS, ["policy_version", "forecast", "context_snapshot", "decision", "assigned_action", "evidence", "independent_verification", "measured_outcome", "variance_reason"])
  const chain = learningChain()
  for (const field of NIA_GROWTH_LEARNING_CHAIN_FIELDS) assert.ok(field in chain)
})

test("learning export contains the complete shared input and no auto-adoption", () => {
  const input = buildNiaGrowthLearningInput(learningChain(), { holdoutOrControl: true, comparisonGroup: false, confounders: [], sampleSize: 12, forecastErrorPct: 8, verificationRatePct: 90, affectedHumanControlledCategories: ["Property", "Capex", "Cash"], insideApprovedBoundary: false, reversesHumanDecision: true })
  for (const field of ["proposed_change", "expected_effect", "evidence_cycles", "sample_size", "forecast_error_pct", "attribution_grade", "confounders", "critical_data_fresh", "verification_rate_pct", "reversible", "rollback_trigger", "inside_approved_boundary", "reverses_human_decision", "affected_human_controlled_categories", "target_effect", "channel_effect", "cm_effect", "cash_effect"]) assert.ok(field in input, field)
  assert.equal(input.production_confidence, "Low")
  assert.equal(input.registry_thresholds_approved, false)
  assert.equal(input.auto_adopt, false)
})

test("Observed learning states confounders not ruled out", () => {
  const input = buildNiaGrowthLearningInput(learningChain(), { holdoutOrControl: false, comparisonGroup: false, confounders: [], sampleSize: 6, forecastErrorPct: 12, verificationRatePct: 82 })
  assert.equal(input.attribution_grade, "Observed")
  assert.deepEqual(input.confounders, ["confounders not ruled out"])
})

test("stale, quarantined, unverified and self-verified learning is rejected", () => {
  const options = { holdoutOrControl: false, comparisonGroup: true, confounders: ["synthetic mix"], sampleSize: 8, forecastErrorPct: 9, verificationRatePct: 70 }
  const rows = [
    learningChain({ context_snapshot: { opportunity_ref: "protected://opportunity/test", supply_model: "FONO", theatre: "Test", data_freshness: "Stale", quarantined: false } }),
    learningChain({ context_snapshot: { opportunity_ref: "protected://opportunity/test", supply_model: "SP", theatre: "Test", data_freshness: "Current", quarantined: true } }),
    learningChain({ independent_verification: { verified: false, verifier_ref: "protected://verifier/qa", self_verified: false } }),
    learningChain({ independent_verification: { verified: true, verifier_ref: "protected://verifier/self", self_verified: true } }),
  ]
  for (const row of rows) assert.equal(buildNiaGrowthLearningInput(row, options).eligible_for_shared_learning_gate, false)
})

test("preview renders FONO first, SP second, exactly four measures and no live capability", () => {
  const preview = buildNiaGrowthPreview()
  assert.equal(preview.measures.length, 4)
  assert.deepEqual(preview.lanes.map((lane) => lane.supplyModel), ["FONO", "SP"])
  assert.deepEqual(preview.measures.map((measure) => measure.id), ["ready-capacity", "time-to-ready", "fono-health", "sp-exposure"])
  assert.equal(preview.blockedCapabilities.capexCommitments, false)
  assert.equal(preview.blockedCapabilities.contractsOrLeases, false)
  assert.equal(preview.blockedCapabilities.studioOrParkRelease, false)
  assert.equal(preview.blockedCapabilities.moneyMovement, false)
  assert.equal(preview.blockedCapabilities.autoAdoption, false)
  assert.deepEqual(NIA_GROWTH_BLOCKED_CAPABILITIES, preview.blockedCapabilities)
})

test("Nia Growth emits overdue executable recovery but never sends sign-off work to Despatch", () => {
  const preview = buildNiaGrowthPreview()
  const executable = { ...preview.tasks[0], state: "Assigned" as const, recommendationOnly: false, dueAt: "2026-07-17T14:00:00+05:30" }
  const queue = emitNiaGrowthDespatchEscalations([executable, preview.tasks[1]], "2026-07-17T15:30:00+05:30")
  assert.equal(queue.length, 1)
  assert.equal(queue[0].domain, "Nia Growth")
  assert.equal(queue.some((entry) => entry.ownerRole === "CEO/COO"), false)
})
