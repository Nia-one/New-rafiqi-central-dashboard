import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  NEW_ADDS_BLOCKED_CAPABILITIES,
  NEW_ADDS_POLICY_REGISTRY,
  NEW_ADDS_SELF_LEARN_QUESTION,
  NEW_ADDS_SIGNAL_FIXTURES,
  buildLearningChain,
  buildNewAddsPreview,
  createFillTask,
  decideNewAdds,
  detectNewAddsEvent,
  emitNewAddsDespatchEscalations,
  escalateNewAdds,
  projectNewAddsLearning,
  recoverFillTask,
  resolveNewAddsShadowOutcome,
  remainingFillRunRate,
  verifyBillingLiveOutcome,
  type FillEvidenceInput,
  type NewAddsEvent,
  type NewAddsLearningChain,
} from "@/lib/operating-loop/new-adds-loop"

const source = readFileSync(new URL("./new-adds-loop.ts", import.meta.url), "utf8")

function admitted(index = 0): NewAddsEvent {
  const result = detectNewAddsEvent(NEW_ADDS_SIGNAL_FIXTURES[index])
  assert.equal(result.disposition, "Admitted")
  return result.event
}

function verifiedEvidence(overrides: Partial<FillEvidenceInput> = {}): FillEvidenceInput {
  return {
    closureId: "CLOSURE-TEST-01",
    memberId: "MEMBER-SYNTH-TEST-01",
    activationValid: true,
    billingLive: true,
    arrivedAt: "2026-07-16T08:00:00+05:30",
    billingLiveAt: "2026-07-17T08:00:00+05:30",
    duplicateOfClosureId: null,
    actualLoadedCac: 84,
    evidenceRef: "protected://new-adds/evidence/test",
    submittedBy: "Theatre JCO",
    verifierIdentity: "Independent Billing Verifier",
    verifierReference: "protected://new-adds/verifier/test",
    dataFreshness: "Current",
    quarantined: false,
    ...overrides,
  }
}

test("the detector admits all five governed trigger kinds", () => {
  const event = admitted(1)
  assert.deepEqual(event.triggers, ["New FONO Studio with unfilled base", "Arrived Member not billing in 48h", "Missed fill run rate", "Actual CAC above control"])
  const membership = admitted(0)
  assert.ok(membership.triggers.includes("Membership ended"))
})

test("New Adds is FONO only and quarantines missing or SP context without inference", () => {
  const sp = detectNewAddsEvent(NEW_ADDS_SIGNAL_FIXTURES[3])
  const missing = detectNewAddsEvent(NEW_ADDS_SIGNAL_FIXTURES[4])
  assert.equal(sp.disposition, "Quarantined")
  assert.match(sp.reasons.join(" "), /SP context is quarantined/)
  assert.equal(missing.disposition, "Quarantined")
  assert.match(missing.reasons.join(" "), /never inferred/)
  assert.equal(buildNewAddsPreview().quarantineCount, 2)
})

test("decision restores franchisee base commitment first, then ranks eligible Nia channels", () => {
  const base = decideNewAdds(admitted(0))
  assert.equal(base.decisionKind, "base-commitment shortfall")
  assert.equal(base.selectedChannel, "Franchisee base")
  assert.match(base.rationale, /restore the base commitment/i)
  const nia = decideNewAdds(admitted(1))
  assert.equal(nia.decisionKind, "Nia channel fill")
  assert.equal(nia.selectedChannel, "Returning Member")
  assert.equal(nia.humanApprovalRequiredForPolicyChange, true)
  assert.doesNotMatch(source, /franchisee debt/i)
})

test("one deterministic idempotent fill task is created per event and WhatsApp stays shadow", () => {
  const event = admitted(0)
  const decision = decideNewAdds(event)
  const first = createFillTask(event, decision)
  const second = createFillTask(event, decision)
  assert.equal(first.actionId, second.actionId)
  assert.equal(first.idempotencyKey, second.idempotencyKey)
  assert.equal(first.supplyModel, "FONO")
  assert.equal(first.whatsapp.execution, "Shadow only")
  const eligible = createFillTask(event, decision, { approvedTemplate: true, memberConsent: true, withinQuietHours: true, liveEnabledIntegration: true })
  assert.equal(eligible.whatsapp.execution, "Eligible after human approval")
  assert.equal(NEW_ADDS_BLOCKED_CAPABILITIES.externalMessages, false)
})

test("only unique independently verified billing-live outcomes count with actual loaded CAC", () => {
  const verified = verifyBillingLiveOutcome(verifiedEvidence())
  assert.equal(verified.status, "Verified")
  assert.equal(verified.actualLoadedCac, 84)
  assert.equal(verified.hoursToBilling, 24)
  const self = verifyBillingLiveOutcome(verifiedEvidence({ verifierIdentity: "Theatre JCO" }))
  assert.equal(self.status, "Rejected")
  assert.match(self.reasons.join(" "), /Self-verification/)
  const duplicate = verifyBillingLiveOutcome(verifiedEvidence({ duplicateOfClosureId: "CLOSURE-EXISTING" }))
  assert.equal(duplicate.status, "Rejected")
  const notBilling = verifyBillingLiveOutcome(verifiedEvidence({ billingLive: false, billingLiveAt: null }))
  assert.equal(notBilling.status, "Rejected")
})

test("no answer and failed evidence recover the same task while missed fills roll forward", () => {
  const event = admitted(0)
  const task = createFillTask(event, decideNewAdds(event))
  const retry = recoverFillTask(task, "No answer", "2026-07-17T14:00:00+05:30")
  assert.equal(retry.actionId, task.actionId)
  assert.equal(retry.state, "Retry scheduled")
  assert.equal(retry.attempts, task.attempts + 1)
  const reopened = recoverFillTask(task, "Failed evidence", "2026-07-17T14:00:00+05:30")
  assert.equal(reopened.state, "Reopened")
  const runRate = remainingFillRunRate(24, 15, 3, 6)
  assert.deepEqual(runRate, { gap: 9, missedFillsCarried: 3, remainingFills: 12, requiredPerHour: 2 })
})

test("workspace shadow outcomes run through recovery and independent verification engines", () => {
  const task = buildNewAddsPreview().actions[0]
  const retry = resolveNewAddsShadowOutcome(task, "No answer", "2026-07-17T14:00:00+05:30")
  const verified = resolveNewAddsShadowOutcome(task, "Billing-live evidence received", "2026-07-17T14:00:00+05:30")
  assert.equal(retry.task.state, "Retry scheduled")
  assert.equal(retry.verification, null)
  assert.equal(verified.verification?.status, "Verified")
  assert.equal(verified.task.state, "Verified")
  assert.match(verified.route, /local shadow closure independently verified/i)
})

test("locked escalation boundaries route to the named human roles", () => {
  const event = admitted(1)
  const task = createFillTask(event, decideNewAdds(event))
  const escalations = escalateNewAdds(event, task)
  assert.deepEqual(escalations.map((row) => row.ownerRole), ["Theatre lead", "Franchise review", "Pushkar / Finance", "Studio Health"])
  assert.match(escalations.find((row) => row.ownerRole === "Pushkar / Finance")?.issue ?? "", /₹104 is above ₹100/)
  assert.match(escalations.find((row) => row.ownerRole === "Studio Health")?.issue ?? "", /74% is below 78%/)
})

test("the preview exposes exactly four locked measures and the primary Theatre visual", () => {
  const preview = buildNewAddsPreview()
  assert.equal(preview.measures.length, 4)
  assert.deepEqual(preview.measures.map((row) => row.id), ["verified-fills", "adds-by-source", "cac-payback", "arrival-billing"])
  assert.deepEqual(preview.theatres.map((row) => row.theatre), ["Oragadam", "Sriperumbudur", "Hosur"])
  assert.equal(preview.taskSummary.target, 24)
  assert.equal(preview.taskSummary.current, 15)
  assert.equal(preview.taskSummary.gap, 9)
  assert.ok(preview.escalations.length <= 5)
  assert.doesNotMatch(source, /\bFloat\b|₹500|₹612|50\/50|month-one CM/i)
})

test("the domain Loop Health projection is structural, dependency-aware and mapper-ready", () => {
  const preview = buildNewAddsPreview()
  const projection = preview.loopHealthInputs
  assert.equal(projection.domain, "New Adds")
  assert.equal(projection.synthetic, true)
  assert.ok(projection.feeds.every((feed) => feed.registeredCadenceMinutes > 0 && feed.dependentMetricIds.length > 0))
  assert.ok(projection.clocks.every((clock) => clock.eventId && clock.ownerRole && clock.dueAt))
  assert.ok(projection.metricDependencies.every((metric) => metric.sourceFeedIds.length > 0))
  assert.equal(preview.loopHealth.state, "Cannot confirm")
  assert.ok(preview.loopHealth.clocks.some((clock) => clock.breached))
  assert.equal(preview.loopHealth.quarantinedRecords, preview.quarantineCount)
})

test("governed New Adds breaches emit protected R-0 Despatch records", () => {
  const event = admitted(1)
  const task = createFillTask(event, decideNewAdds(event))
  const records = emitNewAddsDespatchEscalations(event, task)
  assert.ok(records.length > 0)
  assert.ok(records.every((record) => record.domain === "New Adds" && record.sourceActionId === task.actionId && record.synthetic))
  assert.ok(records.flatMap((record) => record.evidenceRefs).every((reference) => reference.startsWith("protected://")))
})

test("the exact typed learning chain projects verified actuals against forecast", () => {
  const event = admitted(0)
  const decision = decideNewAdds(event)
  const task = createFillTask(event, decision)
  const evidence = verifiedEvidence()
  const verification = verifyBillingLiveOutcome(evidence)
  const chain = buildLearningChain(event, decision, task, evidence, verification, "Arrival missed the first billing cut-off.", true)
  assert.deepEqual(Object.keys(chain), ["event_id", "action_id", "supply_model", "theatre", "owner_role", "due_at", "data_freshness", "policy_version", "forecast", "context_snapshot", "decision", "assigned_action", "evidence", "independent_verification", "measured_outcome", "variance_reason"])
  const projection = projectNewAddsLearning([chain])
  assert.equal(projection.question, NEW_ADDS_SELF_LEARN_QUESTION)
  assert.equal(projection.accepted.length, 1)
  assert.equal(projection.accepted[0].expectedLoadedCac, decision.expectedLoadedCac)
  assert.equal(projection.accepted[0].actualLoadedCac, 84)
  assert.equal(projection.accepted[0].recoveredSourceMetric, true)
  assert.equal(projection.proposedCalibration[0].autoApplied, false)
  assert.equal(projection.proposedCalibration[0].requiresHumanApproval, true)
})

test("stale, quarantined, unverified and self-verified chains are rejected from learning", () => {
  const event = admitted(0)
  const decision = decideNewAdds(event)
  const task = createFillTask(event, decision)
  const evidence = verifiedEvidence()
  const verified = verifyBillingLiveOutcome(evidence)
  const good = buildLearningChain(event, decision, task, evidence, verified, "On forecast.", true)
  const variants: NewAddsLearningChain[] = [
    { ...good, event_id: "STALE", data_freshness: "Stale" },
    { ...good, event_id: "QUARANTINED", evidence: { ...good.evidence, quarantined: true } },
    { ...good, event_id: "UNVERIFIED", independent_verification: { ...good.independent_verification, status: "Awaiting verification" } },
    { ...good, event_id: "SELF", independent_verification: { ...good.independent_verification, verifier_identity: good.evidence.submittedBy } },
  ]
  const projection = projectNewAddsLearning(variants)
  assert.equal(projection.accepted.length, 0)
  assert.equal(projection.rejected.length, 4)
  for (const protectedChange of ["CAC controls", "pricing", "commercial terms", "message templates", "people decisions", "safety controls"]) assert.ok(projection.protectedPolicyChanges.includes(protectedChange))
})

test("all locked values live in the versioned registry and effects remain structurally blocked", () => {
  assert.deepEqual(NEW_ADDS_POLICY_REGISTRY.map((row) => [row.policyId, row.value]), [["POL-NEW-ADDS-CAC-WARNING", 100], ["POL-NEW-ADDS-PAYBACK", 15], ["POL-NEW-ADDS-OCCUPANCY-FLOOR", 78], ["POL-NEW-ADDS-BILLING-LIVE", 1]])
  assert.ok(NEW_ADDS_POLICY_REGISTRY.every((row) => row.version === 1 && row.effectiveAt && row.approver && row.source))
  assert.deepEqual(Object.values(NEW_ADDS_BLOCKED_CAPABILITIES), Array(Object.keys(NEW_ADDS_BLOCKED_CAPABILITIES).length).fill(false))
})
