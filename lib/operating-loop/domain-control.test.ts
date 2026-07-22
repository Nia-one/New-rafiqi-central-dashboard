import assert from "node:assert/strict"
import test from "node:test"
import {
  appendDomainEvidence,
  buildGovernedReportDrafts,
  createDomainAction,
  evaluateEssentialsRows,
  evaluateMemberContinuity,
  evaluatePeopleExecution,
  transitionDomainAction,
  type DomainAction,
  type EssentialsInput,
  type GovernedFact,
  type MemberContinuityInput,
  type PeopleExecutionInput,
} from "@/lib/operating-loop/domain-control"

const at = "2026-07-17T08:00:00+05:30"

const essentialsBase: EssentialsInput = {
  recordId: "ESS-1", service: "Curry", skuId: "SKU-1", skuName: "Rice", supplierName: "Supplier", purchaseTerms: "Consignment", inventoryOwnership: "Consignment",
  mrpInr: 100, memberPriceInr: 90, directSupplierCostInr: 80, availableUnits: 0, eligibleMembers: 20, purchasingMembers: 10, repeatMembers: 4, orders: 12, fulfilledOrders: 10,
  ownerActorId: "OWNER", sourceRowIdentity: "Essentials_Hourly:ESS-1", asOf: at, synthetic: true,
}

test("Essentials admits only records with positive Member savings and Nia margin", () => {
  const result = evaluateEssentialsRows([
    essentialsBase,
    { ...essentialsBase, recordId: "ESS-2", memberPriceInr: 105, directSupplierCostInr: 106, sourceRowIdentity: "Essentials_Hourly:ESS-2" },
  ], at)
  assert.equal(result.accepted.length, 1)
  assert.equal(result.accepted[0].memberSavingsInr, 10)
  assert.equal(result.accepted[0].niaMarginInr, 10)
  assert.equal(result.accepted[0].stockout, true)
  assert.deepEqual(result.accepted[0].policyRefs, ["POL-ESSENTIALS-SAVINGS-FLOOR@v1", "POL-ESSENTIALS-MARGIN-FLOOR@v1"])
  assert.equal(result.quarantined.length, 1)
  assert.match(result.quarantined[0].reasons.join(" "), /Member savings/)
  assert.match(result.quarantined[0].reasons.join(" "), /Nia margin/)
})

test("Essentials rejects inconsistent Member and fulfilment counts before projection", () => {
  const result = evaluateEssentialsRows([{ ...essentialsBase, purchasingMembers: 21, repeatMembers: 22, fulfilledOrders: 13 }], at)
  assert.equal(result.accepted.length, 0)
  assert.equal(result.quarantined[0].reasons.length, 3)
})

const peopleBase: PeopleExecutionInput = {
  actorId: "ACT-1", displayName: "Owner", role: "EAE", theatreId: "TH-1", studioId: "ST-1", assignedActions: 4, activityUpdates: 8, closedActions: 3, resolvedOutcomes: 0,
  lastReportedAt: "2026-07-17T06:30:00+05:30", payoutRecordedInr: 500, approvedOutcomePayoutInr: 0, sourceRowIdentity: "People_Roster:ACT-1", synthetic: true,
}

test("People control separates activity, closure and resolved outcomes and flags unmatched payout", () => {
  const result = evaluatePeopleExecution([peopleBase], at)
  assert.deepEqual(result.totals, { assigned: 4, activity: 8, closed: 3, resolved: 0, closureRate: 0.75, resolvedOutcomeRate: 0 })
  assert.deepEqual(result.people[0].flags, ["Missing reporting", "Activity without resolved outcome", "Payout exception"])
  assert.equal(result.people[0].incentiveEligibleInr, 0)
  assert.equal(result.people[0].cadencePolicyRef, "POL-HEARTBEAT-CADENCE@v1")
})

const continuityBase: MemberContinuityInput = {
  memberToken: "MEM-TOKEN-1", cohort: "2026-01", livingState: "Stable", workState: "Placed", essentialsState: "Active", activeAtM6: true, churnedThisMonth: false,
  verificationStatus: "Verified", sourceRefs: ["Member_Activation:A", "Living_Hourly:A", "Work_Hourly:A", "Essentials_Hourly:A"], asOf: at, synthetic: true,
}

test("continuity uses verified existing Member tokens and applies governed M6 warning", () => {
  const result = evaluateMemberContinuity([
    continuityBase,
    { ...continuityBase, memberToken: "MEM-TOKEN-2", activeAtM6: false, churnedThisMonth: true },
    { ...continuityBase, memberToken: "MEM-TOKEN-3", verificationStatus: "Pending" },
  ], at)
  assert.equal(result.verifiedCohortSize, 2)
  assert.equal(result.pendingSignals, 1)
  assert.equal(result.m6Retention, 0.5)
  assert.equal(result.monthlyChurn, 0.5)
  assert.equal(result.warning, true)
  assert.equal(result.memberMasterCreated, false)
  assert.equal(result.policyValues.reference, 0.69)
  assert.equal(result.policyValues.warning, 0.65)
})

function actionFixture() {
  return createDomainAction({ actionId: "DOM-1", domain: "Essentials", title: "Fix stockout", objective: "Restore fulfilment", context: "ST-1", metricId: "MET-ESSENTIALS-MEMBER-SAVINGS", ownerActorId: "OWNER", verifierActorId: "VERIFIER", dueAt: at, requiredEvidence: ["Stock proof"], detectedAt: at, detectedBy: "ORCHESTRATOR" })
}

function move(action: DomainAction, to: Parameters<typeof transitionDomainAction>[1]["to"], actorId: string) {
  return transitionDomainAction(action, { to, actorId, occurredAt: at, note: to, expectedVersion: action.version })
}

test("domain actions require evidence, optimistic versioning and independent verification", () => {
  let action = actionFixture()
  assert.throws(() => transitionDomainAction(action, { to: "Proposed", actorId: "ORCHESTRATOR", occurredAt: at, note: "stale", expectedVersion: 0 }), /Stale/)
  action = move(action, "Proposed", "ORCHESTRATOR")
  action = move(action, "Auto-approved", "ORCHESTRATOR")
  action = move(action, "Assigned", "ORCHESTRATOR")
  action = move(action, "In progress", "OWNER")
  assert.throws(() => move(action, "Proof submitted", "OWNER"), /without protected evidence/)
  action = appendDomainEvidence(action, { evidenceId: "EVID-1", protectedRef: "protected://phase4/evid-1", description: "Proof", submittedBy: "OWNER", submittedAt: at }, action.version)
  action = move(action, "Proof submitted", "OWNER")
  assert.throws(() => move(action, "Verified", "OWNER"), /independent verifier/)
  action = move(action, "Verified", "VERIFIER")
  action = move(action, "Closed", "VERIFIER")
  assert.equal(action.state, "Closed")
  assert.equal(action.history.at(-2)?.to, "Verified")
  assert.equal(Object.isFrozen(action.history), true)
})

test("report drafts admit verified allowlisted facts and exclude pending or restricted payroll facts", () => {
  const facts: GovernedFact[] = [
    { factId: "FACT-1", metricId: "MET-MEMBER-RETENTION-M6", value: "69%", verificationStatus: "Verified", analyticsAllowed: true, dataClassification: "Internal", sourceRowIdentity: "Member_Activation:1", asOf: at, verifiedBy: "VERIFIER", synthetic: true },
    { factId: "FACT-2", metricId: "MET-MEMBER-RETENTION-M6", value: "Pending", verificationStatus: "Pending", analyticsAllowed: true, dataClassification: "Internal", sourceRowIdentity: "Member_Activation:2", asOf: at, verifiedBy: null, synthetic: true },
    { factId: "FACT-3", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", value: "Restricted", verificationStatus: "Verified", analyticsAllowed: true, dataClassification: "Restricted payroll", sourceRowIdentity: "protected://payroll/3", asOf: at, verifiedBy: "VERIFIER", synthetic: true },
  ]
  const reports = buildGovernedReportDrafts(facts, at)
  assert.deepEqual(reports.map((report) => report.reportType), ["Monthly MIS", "Board draft", "Investor draft"])
  assert.ok(reports.every((report) => report.verifiedFacts.length === 1 && report.excludedFacts.length === 2))
  assert.ok(reports.every((report) => report.externalReleasePermitted === false && report.reportMutationPermitted === false && report.requiredExternalApprover === "CEO"))
  assert.equal(reports[0].verifiedFacts[0].metric.metricId, "MET-MEMBER-RETENTION-M6")
  assert.equal(Object.isFrozen(reports[0].appendOnlyHistory), true)
})
