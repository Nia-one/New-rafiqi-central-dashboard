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
import { SYNTHETIC_AS_OF } from "@/lib/operating-loop/fixtures"
import type { ActionState } from "@/lib/operating-loop/action-engine"

const ESSENTIALS_FIXTURE: readonly EssentialsInput[] = [
  {
    recordId: "ESS-CURRY-001", service: "Curry", skuId: "SKU-RICE-5KG", skuName: "Fortified rice · 5 kg", supplierName: "Synthetic staples supplier", purchaseTerms: "Consignment · 14-day settlement", inventoryOwnership: "Consignment",
    mrpInr: 360, memberPriceInr: 330, directSupplierCostInr: 308, availableUnits: 0, eligibleMembers: 160, purchasingMembers: 72, repeatMembers: 41, orders: 78, fulfilledOrders: 64, ownerActorId: "ACT-EAE", sourceRowIdentity: "Essentials_Hourly:ESS-CURRY-001", asOf: SYNTHETIC_AS_OF, synthetic: true,
  },
  {
    recordId: "ESS-SAVE-001", service: "Save", skuId: "SKU-WORK-SHOE", skuName: "Work footwear", supplierName: "Synthetic safety supplier", purchaseTerms: "Nia-owned · 30-day terms", inventoryOwnership: "Nia-owned",
    mrpInr: 650, memberPriceInr: 585, directSupplierCostInr: 520, availableUnits: 18, eligibleMembers: 120, purchasingMembers: 36, repeatMembers: 14, orders: 38, fulfilledOrders: 35, ownerActorId: "ACT-EAE", sourceRowIdentity: "Essentials_Hourly:ESS-SAVE-001", asOf: SYNTHETIC_AS_OF, synthetic: true,
  },
  {
    recordId: "ESS-REMIT-001", service: "Remit", skuId: "SKU-REMIT-DIGITAL", skuName: "Home remittance service", supplierName: "Synthetic regulated provider", purchaseTerms: "Digital fulfilment · per transaction", inventoryOwnership: "Digital",
    mrpInr: 40, memberPriceInr: 25, directSupplierCostInr: 18, availableUnits: 9999, eligibleMembers: 140, purchasingMembers: 49, repeatMembers: 32, orders: 52, fulfilledOrders: 52, ownerActorId: "ACT-ESSENTIALS", sourceRowIdentity: "Essentials_Hourly:ESS-REMIT-001", asOf: SYNTHETIC_AS_OF, synthetic: true,
  },
  {
    recordId: "ESS-INVALID-001", service: "Curry", skuId: "SKU-OIL-1L", skuName: "Cooking oil · 1 litre", supplierName: "Synthetic terms exception", purchaseTerms: "Unapproved terms", inventoryOwnership: "Supplier-owned",
    mrpInr: 150, memberPriceInr: 156, directSupplierCostInr: 158, availableUnits: 24, eligibleMembers: 80, purchasingMembers: 22, repeatMembers: 8, orders: 24, fulfilledOrders: 20, ownerActorId: "ACT-ESSENTIALS", sourceRowIdentity: "Essentials_Hourly:ESS-INVALID-001", asOf: SYNTHETIC_AS_OF, synthetic: true,
  },
]

const PEOPLE_FIXTURE: readonly PeopleExecutionInput[] = [
  { actorId: "ACT-JCO", displayName: "Demand JCO", role: "JCO", theatreId: "TH-COROMANDEL", studioId: "ST-ORA-01", assignedActions: 7, activityUpdates: 9, closedActions: 5, resolvedOutcomes: 4, lastReportedAt: "2026-07-17T07:45:00+05:30", payoutRecordedInr: 800, approvedOutcomePayoutInr: 800, sourceRowIdentity: "People_Roster:ACT-JCO", synthetic: true },
  { actorId: "ACT-EAE", displayName: "Studio EAE", role: "EAE", theatreId: "TH-COROMANDEL", studioId: "ST-SIP-02", assignedActions: 6, activityUpdates: 12, closedActions: 4, resolvedOutcomes: 0, lastReportedAt: "2026-07-17T06:30:00+05:30", payoutRecordedInr: 500, approvedOutcomePayoutInr: 0, sourceRowIdentity: "People_Roster:ACT-EAE", synthetic: true },
  { actorId: "ACT-THEATRE", displayName: "Coromandel Theatre lead", role: "Theatre lead", theatreId: "TH-COROMANDEL", studioId: null, assignedActions: 4, activityUpdates: 5, closedActions: 3, resolvedOutcomes: 3, lastReportedAt: "2026-07-17T07:40:00+05:30", payoutRecordedInr: 0, approvedOutcomePayoutInr: 0, sourceRowIdentity: "People_Roster:ACT-THEATRE", synthetic: true },
  { actorId: "ACT-ESSENTIALS", displayName: "Essentials functional owner", role: "Functional owner", theatreId: "TH-COROMANDEL", studioId: null, assignedActions: 3, activityUpdates: 4, closedActions: 2, resolvedOutcomes: 2, lastReportedAt: "2026-07-17T07:35:00+05:30", payoutRecordedInr: 300, approvedOutcomePayoutInr: 300, sourceRowIdentity: "People_Roster:ACT-ESSENTIALS", synthetic: true },
]

const CONTINUITY_FIXTURE: readonly MemberContinuityInput[] = [
  { memberToken: "MEM-TOKEN-A41", cohort: "2026-01", livingState: "Stable", workState: "Placed", essentialsState: "Active", activeAtM6: true, churnedThisMonth: false, verificationStatus: "Verified", sourceRefs: ["Member_Activation:ACT-A41", "Living_Hourly:LIV-A41", "Work_Hourly:WORK-A41", "Essentials_Hourly:ESS-A41"], asOf: SYNTHETIC_AS_OF, synthetic: true },
  { memberToken: "MEM-TOKEN-B72", cohort: "2026-01", livingState: "At risk", workState: "Interrupted", essentialsState: "Lapsed", activeAtM6: true, churnedThisMonth: false, verificationStatus: "Verified", sourceRefs: ["Member_Activation:ACT-B72", "Living_Hourly:LIV-B72", "Work_Hourly:WORK-B72", "Essentials_Hourly:ESS-B72"], asOf: SYNTHETIC_AS_OF, synthetic: true },
  { memberToken: "MEM-TOKEN-C09", cohort: "2026-01", livingState: "Exited", workState: "Exited", essentialsState: "Lapsed", activeAtM6: false, churnedThisMonth: true, verificationStatus: "Verified", sourceRefs: ["Member_Activation:ACT-C09", "Living_Hourly:LIV-C09", "Work_Hourly:WORK-C09", "Essentials_Hourly:ESS-C09"], asOf: SYNTHETIC_AS_OF, synthetic: true },
  { memberToken: "MEM-TOKEN-D18", cohort: "2026-01", livingState: "At risk", workState: "Interrupted", essentialsState: "Not used", activeAtM6: false, churnedThisMonth: false, verificationStatus: "Verified", sourceRefs: ["Member_Activation:ACT-D18", "Living_Hourly:LIV-D18", "Work_Hourly:WORK-D18", "Essentials_Hourly:ESS-D18"], asOf: SYNTHETIC_AS_OF, synthetic: true },
  { memberToken: "MEM-TOKEN-E33", cohort: "2026-01", livingState: "Stable", workState: "Placed", essentialsState: "Active", activeAtM6: true, churnedThisMonth: false, verificationStatus: "Pending", sourceRefs: ["Member_Activation:ACT-E33", "Living_Hourly:LIV-E33", "Work_Hourly:WORK-E33", "Essentials_Hourly:ESS-E33"], asOf: SYNTHETIC_AS_OF, synthetic: true },
]

function move(action: DomainAction, to: ActionState, actorId: string, note: string) {
  return transitionDomainAction(action, { to, actorId, note, occurredAt: SYNTHETIC_AS_OF, expectedVersion: action.version })
}

function completedEssentialsAction(): DomainAction {
  let action = createDomainAction({ actionId: "DOM-ESS-STOCKOUT-001", domain: "Essentials", title: "Restore Curry stock availability", objective: "Restore fulfilled Member orders without weakening savings or Nia margin.", context: "ESS-CURRY-001 · ST-SIP-02", metricId: "MET-ESSENTIALS-MEMBER-SAVINGS", ownerActorId: "ACT-EAE", verifierActorId: "ACT-VERIFY", dueAt: "2026-07-17T12:00:00+05:30", requiredEvidence: ["Supplier confirmation", "Stock receipt", "Independent fulfilled-order check"], detectedAt: SYNTHETIC_AS_OF, detectedBy: "ACT-ORCHESTRATOR" })
  action = move(action, "Proposed", "ACT-ORCHESTRATOR", "Stockout route proposed from the validated Essentials record.")
  action = move(action, "Auto-approved", "ACT-ORCHESTRATOR", "Low-risk internal replenishment task auto-approved; no purchase or payment executed.")
  action = move(action, "Assigned", "ACT-ORCHESTRATOR", "EAE assigned as the single owner.")
  action = move(action, "In progress", "ACT-EAE", "Synthetic replenishment check started.")
  action = appendDomainEvidence(action, { evidenceId: "EVID-ESS-001", protectedRef: "protected://phase4/essentials/stock-receipt", description: "Synthetic supplier confirmation, stock receipt and fulfilled-order sample.", submittedBy: "ACT-EAE", submittedAt: SYNTHETIC_AS_OF }, action.version)
  action = move(action, "Proof submitted", "ACT-EAE", "Protected proof submitted for independent review.")
  action = move(action, "Verified", "ACT-VERIFY", "Independent verifier confirmed the synthetic stock and fulfilled-order evidence.")
  return move(action, "Closed", "ACT-VERIFY", "Closed after verified operating outcome; no external transaction occurred.")
}

function assignedExceptionAction(input: { actionId: string; domain: "People and Execution" | "Member Continuity"; title: string; objective: string; context: string; metricId: string; ownerActorId: string; dueAt: string; evidence: readonly string[] }) {
  let action = createDomainAction({ ...input, verifierActorId: "ACT-VERIFY", requiredEvidence: input.evidence, detectedAt: SYNTHETIC_AS_OF, detectedBy: "ACT-ORCHESTRATOR" })
  action = move(action, "Proposed", "ACT-ORCHESTRATOR", "Governed exception route proposed.")
  action = move(action, "Auto-approved", "ACT-ORCHESTRATOR", "Low-risk internal investigation auto-approved in shadow mode.")
  return move(action, "Assigned", "ACT-ORCHESTRATOR", "One owner and an independent verifier are recorded.")
}

function governanceFacts(essentialsSavingsInr: number, resolvedOutcomeRate: number | null, m6Retention: number | null): readonly GovernedFact[] {
  return Object.freeze([
    { factId: "FACT-ESS-SAVINGS", metricId: "MET-ESSENTIALS-MEMBER-SAVINGS", value: `INR ${essentialsSavingsInr}`, verificationStatus: "Verified", analyticsAllowed: true, dataClassification: "Internal", sourceRowIdentity: "Essentials_Hourly:ESS-CURRY-001", asOf: SYNTHETIC_AS_OF, verifiedBy: "ACT-VERIFY", synthetic: true },
    { factId: "FACT-PEOPLE-RESOLVED", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", value: resolvedOutcomeRate === null ? "No data" : `${(resolvedOutcomeRate * 100).toFixed(1)}%`, verificationStatus: "Verified", analyticsAllowed: true, dataClassification: "Internal", sourceRowIdentity: "Action_Log:PHASE4-PEOPLE", asOf: SYNTHETIC_AS_OF, verifiedBy: "ACT-VERIFY", synthetic: true },
    { factId: "FACT-CONTINUITY-M6", metricId: "MET-MEMBER-RETENTION-M6", value: m6Retention === null ? "No data" : `${(m6Retention * 100).toFixed(1)}%`, verificationStatus: "Verified", analyticsAllowed: true, dataClassification: "Internal", sourceRowIdentity: "Member_Activation:PHASE4-M6", asOf: SYNTHETIC_AS_OF, verifiedBy: "ACT-VERIFY", synthetic: true },
    { factId: "FACT-PAYOUT-RESTRICTED", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", value: "Restricted", verificationStatus: "Verified", analyticsAllowed: true, dataClassification: "Restricted payroll", sourceRowIdentity: "protected://payroll/phase4", asOf: SYNTHETIC_AS_OF, verifiedBy: "ACT-VERIFY", synthetic: true },
    { factId: "FACT-ESS-PENDING", metricId: "MET-ESSENTIALS-NIA-MARGIN", value: "Pending", verificationStatus: "Pending", analyticsAllowed: true, dataClassification: "Internal", sourceRowIdentity: "Essentials_Hourly:ESS-PENDING", asOf: SYNTHETIC_AS_OF, verifiedBy: null, synthetic: true },
  ])
}

export function buildRemainingDomainPreview() {
  const essentials = evaluateEssentialsRows(ESSENTIALS_FIXTURE, SYNTHETIC_AS_OF)
  const people = evaluatePeopleExecution(PEOPLE_FIXTURE, SYNTHETIC_AS_OF)
  const continuity = evaluateMemberContinuity(CONTINUITY_FIXTURE, SYNTHETIC_AS_OF)
  const actions = Object.freeze([
    completedEssentialsAction(),
    assignedExceptionAction({ actionId: "DOM-PEOPLE-001", domain: "People and Execution", title: "Reconcile reporting and payout exception", objective: "Restore reporting, test the resolved outcome and hold the unmatched payout for human review.", context: "ACT-EAE · ST-SIP-02", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", ownerActorId: "ACT-THEATRE", dueAt: "2026-07-17T10:00:00+05:30", evidence: ["Reporting reconciliation", "Resolved-outcome proof", "Payout exception decision"] }),
    assignedExceptionAction({ actionId: "DOM-CONTINUITY-001", domain: "Member Continuity", title: "Recover the M6 continuity cohort", objective: "Resolve Living, Work and Essentials interruptions without creating a duplicate Member record.", context: "Cohort 2026-01 · TH-COROMANDEL", metricId: "MET-MEMBER-RETENTION-M6", ownerActorId: "ACT-THEATRE", dueAt: "2026-07-18T08:00:00+05:30", evidence: ["Cross-pillar Member continuity review", "Verified Member outcome", "Independent M6 cohort check"] }),
  ])
  const facts = governanceFacts(essentials.accepted[0]?.memberSavingsInr ?? 0, people.totals.resolvedOutcomeRate, continuity.m6Retention)
  const reports = buildGovernedReportDrafts(facts, SYNTHETIC_AS_OF)

  return Object.freeze({
    mode: "Shadow mode" as const,
    phase: "Phase 4 only" as const,
    writesEnabled: false as const,
    liveReadsEnabled: false as const,
    externalMessagesEnabled: false as const,
    source: Object.freeze({ name: "Phase 4 synthetic governed fixtures", asOf: SYNTHETIC_AS_OF, freshness: "Current" as const, synthetic: true as const }),
    essentials,
    people,
    continuity,
    actions,
    governance: Object.freeze({
      facts,
      reports,
      sourceCoverage: Object.freeze([
        Object.freeze({ source: "Essentials_Hourly", status: "Current" as const, lineage: "Synthetic fixture · row identities visible" }),
        Object.freeze({ source: "People_Roster + Action_Log", status: "Current" as const, lineage: "No raw payroll in analytics" }),
        Object.freeze({ source: "Member_Activation + pillar hourly tabs", status: "Current" as const, lineage: "Existing anonymised Member tokens only" }),
        Object.freeze({ source: "Evidence_Log + Approval_Log", status: "Current" as const, lineage: "Protected references · append-only" }),
      ]),
    }),
  })
}

export type RemainingDomainPreview = ReturnType<typeof buildRemainingDomainPreview>
