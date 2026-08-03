import assert from "node:assert/strict"
import test from "node:test"
import { buildMarginDespatchEscalation, buildNiaMarginsPreview, createMarginAction, diagnoseMarginStudio, NIA_MARGINS_SYNTHETIC_INPUTS, NIA_MARGIN_TARGETS, submitMarginProof, verifyMarginAction } from "@/lib/operating-loop/nia-margins-loop"

test("Nia Margins keeps billed CM2 separate from collection leakage", () => {
  const preview = buildNiaMarginsPreview(NIA_MARGINS_SYNTHETIC_INPUTS)
  assert.equal(preview.collectionLeakageIncludedInCm2, false)
  assert.equal(preview.measures.fullUseTargetInr, 1_500)
  assert.equal(preview.measures.occupancyTargetPct, 78)
  assert.match(preview.answer, /Full-use CM2/)
})

test("Studio diagnosis reconciles volume and pillar unit variances exactly", () => {
  const diagnosis = diagnoseMarginStudio(NIA_MARGINS_SYNTHETIC_INPUTS[0]!)
  assert.equal(diagnosis.studioTotalCm2GapInr, diagnosis.occupancyVolumeEffectInr + diagnosis.livingUnitVarianceInr + diagnosis.workUnitVarianceInr + diagnosis.essentialsUnitVarianceInr)
  assert.equal(diagnosis.fullUseUnitCm2Inr, diagnosis.livingUnitCm2Inr + diagnosis.workUnitCm2Inr + diagnosis.essentialsUnitCm2Inr)
})

test("occupancy routes to the channel-correct FONO or SP loop", () => {
  const fono = diagnoseMarginStudio({ ...NIA_MARGINS_SYNTHETIC_INPUTS[0]!, rampDay: 64, occupiedNests: 50 })
  const sp = diagnoseMarginStudio({ ...NIA_MARGINS_SYNTHETIC_INPUTS[1]!, rampDay: 64, occupiedNests: 50 })
  assert.equal(fono.routeTo, "New Adds")
  assert.equal(sp.routeTo, "Enterprise Demand")
})

test("ramp Studios remain separate from post-ramp occupancy exceptions", () => {
  const diagnosis = diagnoseMarginStudio(NIA_MARGINS_SYNTHETIC_INPUTS[2]!)
  assert.equal(diagnosis.ramp, true)
  assert.notEqual(diagnosis.primaryCause, "Occupancy")
})

test("a previously verified contribution that falls below control reopens", () => {
  const diagnosis = diagnoseMarginStudio(NIA_MARGINS_SYNTHETIC_INPUTS[0]!)
  assert.equal(diagnosis.reopened, true)
})

test("a metric row can diagnose a margin gap but can never verify itself", () => {
  const diagnosis = diagnoseMarginStudio({ ...NIA_MARGINS_SYNTHETIC_INPUTS[0]!, occupiedNests: 100, billedLivingArpuInr: 5_500 })
  assert.equal(diagnosis.independentlyVerified, false)
  assert.notEqual(diagnosis.actionState, "Verified")
})

test("margin recovery closes only after protected proof and a separate verifier", () => {
  const input = NIA_MARGINS_SYNTHETIC_INPUTS[0]!
  const diagnosis = diagnoseMarginStudio(input)
  const created = createMarginAction(diagnosis, input, "2026-07-18T14:00:00+05:30")
  assert.ok(created)
  const proof = { actionId: created.actionId, submittedBy: input.ownerActorId, submittedAt: "2026-07-17T13:35:00+05:30", billedRevenueRef: "protected://test/billed", directCostRef: "protected://test/cost", sourceRowIdentity: "protected://test/source-row", sourceFreshness: "Current" as const, actualMetricValue: 79 }
  const submitted = submitMarginProof(created, proof)
  assert.equal(submitted.state, "Proof submitted")
  const verified = verifyMarginAction(submitted, proof, { actionId: created.actionId, verifierActorId: "actor-independent-verifier", verifiedAt: "2026-07-17T13:50:00+05:30", decision: "Verified", actualMetricValue: 79, closureRef: "protected://test/closure", reason: "Reconciled." })
  assert.equal(verified.state, "Verified")
  assert.equal(verified.verifierActorId, "actor-independent-verifier")
})

test("self-verification fails closed and repeated misses emit a Despatch escalation", () => {
  const input = NIA_MARGINS_SYNTHETIC_INPUTS[1]!
  const diagnosis = diagnoseMarginStudio(input)
  const created = createMarginAction(diagnosis, input, "2026-07-18T14:00:00+05:30")
  assert.ok(created)
  const proof = { actionId: created.actionId, submittedBy: input.ownerActorId, submittedAt: "2026-07-17T13:35:00+05:30", billedRevenueRef: "protected://test-sp/billed", directCostRef: "protected://test-sp/cost", sourceRowIdentity: "protected://test-sp/source-row", sourceFreshness: "Current" as const, actualMetricValue: 70 }
  const first = verifyMarginAction(submitMarginProof(created, proof), proof, { actionId: created.actionId, verifierActorId: input.ownerActorId, verifiedAt: "2026-07-17T13:50:00+05:30", decision: "Verified", actualMetricValue: 70, closureRef: "protected://test-sp/reopen-1", reason: "Owner attempted self-verification." })
  assert.equal(first.state, "Reopened")
  const second = verifyMarginAction(submitMarginProof(first, proof), proof, { actionId: created.actionId, verifierActorId: "actor-independent-verifier", verifiedAt: "2026-07-17T14:10:00+05:30", decision: "Reopen", actualMetricValue: 70, closureRef: "protected://test-sp/reopen-2", reason: "Target still missed." })
  assert.equal(second.state, "Escalated")
  assert.equal(buildMarginDespatchEscalation(second)?.domain, "Nia Margins")
  assert.equal(buildMarginDespatchEscalation(second)?.severity, "Critical")
})

test("the preview counts only explicit independent closure inputs", () => {
  const preview = buildNiaMarginsPreview(NIA_MARGINS_SYNTHETIC_INPUTS)
  assert.equal(preview.loopHealth.verification.claimed, 3)
  assert.equal(preview.loopHealth.verification.verified, 1)
  assert.equal(preview.actions.filter((action) => action.state === "Verified").length, 1)
  assert.equal(preview.diagnoses.filter((diagnosis) => diagnosis.independentlyVerified).length, 1)
  assert.equal(preview.despatchEscalations.length, 1)
})

test("learning remains observed-only, low-confidence and unable to auto-adopt", () => {
  const preview = buildNiaMarginsPreview(NIA_MARGINS_SYNTHETIC_INPUTS)
  assert.equal(preview.learning.confidence, "Low")
  assert.equal(preview.learning.autoAdoptPermitted, false)
  assert.match(preview.learning.attributionLabel, /confounders not ruled out/)
})

test("locked pillar targets reconcile to full-use CM2", () => {
  assert.equal(NIA_MARGIN_TARGETS.living + NIA_MARGIN_TARGETS.work + NIA_MARGIN_TARGETS.essentials, NIA_MARGIN_TARGETS.fullUse)
})
