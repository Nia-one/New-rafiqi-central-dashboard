import { METRIC_REGISTRY, policyAt, type MetricDefinition, type PolicyDefinition } from "@/lib/operating-loop/contracts"
import type { ActionState } from "@/lib/operating-loop/action-engine"

export const PHASE_FOUR_DOMAINS = ["Essentials", "People and Execution", "Member Continuity", "Governance and IR"] as const
export type PhaseFourDomain = (typeof PHASE_FOUR_DOMAINS)[number]

export type DomainEvidence = Readonly<{
  evidenceId: string
  protectedRef: string
  description: string
  submittedBy: string
  submittedAt: string
}>

export type DomainActionEvent = Readonly<{
  eventId: string
  from: ActionState | null
  to: ActionState
  actorId: string
  occurredAt: string
  note: string
  version: number
}>

export type DomainAction = Readonly<{
  actionId: string
  domain: Exclude<PhaseFourDomain, "Governance and IR">
  title: string
  objective: string
  context: string
  metricId: string
  ownerActorId: string
  verifierActorId: string
  dueAt: string
  requiredEvidence: readonly string[]
  state: ActionState
  version: number
  evidence: readonly DomainEvidence[]
  history: readonly DomainActionEvent[]
  synthetic: true
}>

const domainTransitions: Readonly<Record<ActionState, readonly ActionState[]>> = {
  Detected: ["Proposed"],
  Proposed: ["Auto-approved", "Escalated"],
  Approved: ["Assigned"],
  "Auto-approved": ["Assigned"],
  Assigned: ["In progress", "Escalated"],
  "In progress": ["Proof submitted", "Escalated"],
  "Proof submitted": ["Verified", "Reopened", "Escalated"],
  Verified: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Reopened: ["Assigned", "Escalated"],
  Escalated: ["Proposed", "Assigned"],
}

export function createDomainAction(input: Omit<DomainAction, "state" | "version" | "evidence" | "history" | "synthetic"> & { detectedAt: string; detectedBy: string }): DomainAction {
  if (!input.ownerActorId) throw new Error("Every domain action requires one named owner.")
  if (!input.verifierActorId || input.verifierActorId === input.ownerActorId) throw new Error("Every domain action requires an independent verifier.")
  if (input.requiredEvidence.length === 0) throw new Error("Every domain action requires evidence before closure.")
  if (!METRIC_REGISTRY.some((metric) => metric.metricId === input.metricId)) throw new Error(`Unknown governed metric ${input.metricId}.`)
  const event = Object.freeze({ eventId: `${input.actionId}-v1`, from: null, to: "Detected" as const, actorId: input.detectedBy, occurredAt: input.detectedAt, note: "Governed signal detected in shadow mode.", version: 1 })
  return Object.freeze({
    actionId: input.actionId,
    domain: input.domain,
    title: input.title,
    objective: input.objective,
    context: input.context,
    metricId: input.metricId,
    ownerActorId: input.ownerActorId,
    verifierActorId: input.verifierActorId,
    dueAt: input.dueAt,
    requiredEvidence: Object.freeze([...input.requiredEvidence]),
    state: "Detected",
    version: 1,
    evidence: Object.freeze([]),
    history: Object.freeze([event]),
    synthetic: true,
  })
}

export function appendDomainEvidence(action: DomainAction, evidence: DomainEvidence, expectedVersion: number): DomainAction {
  if (expectedVersion !== action.version) throw new Error(`Stale action version: expected ${action.version}, received ${expectedVersion}.`)
  if (!evidence.protectedRef.startsWith("protected://")) throw new Error("Evidence must use a protected reference.")
  if (action.evidence.some((item) => item.evidenceId === evidence.evidenceId)) throw new Error("Evidence identifiers are append-only and unique.")
  return Object.freeze({ ...action, version: action.version + 1, evidence: Object.freeze([...action.evidence, Object.freeze({ ...evidence })]) })
}

export function transitionDomainAction(action: DomainAction, input: { to: ActionState; actorId: string; occurredAt: string; note: string; expectedVersion: number }): DomainAction {
  if (input.expectedVersion !== action.version) throw new Error(`Stale action version: expected ${action.version}, received ${input.expectedVersion}.`)
  if (!domainTransitions[action.state].includes(input.to)) throw new Error(`Invalid domain-action transition: ${action.state} → ${input.to}.`)
  if (input.to === "Assigned" && !action.ownerActorId) throw new Error("An action owner is required before assignment.")
  if (input.to === "Proof submitted" && action.evidence.length === 0) throw new Error("Proof cannot be submitted without protected evidence.")
  if (input.to === "Verified") {
    if (input.actorId !== action.verifierActorId) throw new Error("Only the named independent verifier may verify the action.")
    if (input.actorId === action.ownerActorId) throw new Error("The verifier must be independent of the action owner.")
    if (action.evidence.length === 0) throw new Error("Verification requires protected evidence.")
  }
  if (input.to === "Closed" && action.state !== "Verified") throw new Error("A domain action can close only after independent verification.")
  const version = action.version + 1
  const event = Object.freeze({ eventId: `${action.actionId}-v${version}`, from: action.state, to: input.to, actorId: input.actorId, occurredAt: input.occurredAt, note: input.note, version })
  return Object.freeze({ ...action, state: input.to, version, history: Object.freeze([...action.history, event]) })
}

export type EssentialsService = "Curry" | "Save" | "Remit"
export type InventoryOwnership = "Consignment" | "Nia-owned" | "Supplier-owned" | "Digital"

export type EssentialsInput = Readonly<{
  recordId: string
  service: EssentialsService
  skuId: string
  skuName: string
  supplierName: string
  purchaseTerms: string
  inventoryOwnership: InventoryOwnership
  mrpInr: number
  memberPriceInr: number
  directSupplierCostInr: number
  availableUnits: number
  eligibleMembers: number
  purchasingMembers: number
  repeatMembers: number
  orders: number
  fulfilledOrders: number
  ownerActorId: string
  sourceRowIdentity: string
  asOf: string
  synthetic: true
}>

export type EssentialsRecord = EssentialsInput & Readonly<{
  memberSavingsInr: number
  niaMarginInr: number
  attachRate: number | null
  repeatRate: number | null
  fillRate: number | null
  stockout: boolean
  policyRefs: readonly string[]
}>

export type EssentialsQuarantine = Readonly<{
  recordId: string
  sourceRowIdentity: string
  reasons: readonly string[]
}>

function numericPolicy(policyId: string, at: string): PolicyDefinition & { value: number } {
  const policy = policyAt(policyId, at)
  if (!policy || typeof policy.value !== "number") throw new Error(`Missing numeric policy ${policyId}.`)
  return policy as PolicyDefinition & { value: number }
}

export function evaluateEssentialsRows(rows: readonly EssentialsInput[], at: string) {
  const savingsPolicy = numericPolicy("POL-ESSENTIALS-SAVINGS-FLOOR", at)
  const marginPolicy = numericPolicy("POL-ESSENTIALS-MARGIN-FLOOR", at)
  const accepted: EssentialsRecord[] = []
  const quarantined: EssentialsQuarantine[] = []

  for (const row of rows) {
    const memberSavingsInr = row.mrpInr - row.memberPriceInr
    const niaMarginInr = row.memberPriceInr - row.directSupplierCostInr
    const reasons: string[] = []
    if (memberSavingsInr <= savingsPolicy.value) reasons.push(`Member savings must be greater than ${savingsPolicy.value} INR.`)
    if (niaMarginInr <= marginPolicy.value) reasons.push(`Nia margin must be greater than ${marginPolicy.value} INR.`)
    if (row.purchasingMembers > row.eligibleMembers) reasons.push("Purchasing Members cannot exceed eligible Members.")
    if (row.repeatMembers > row.purchasingMembers) reasons.push("Repeat Members cannot exceed purchasing Members.")
    if (row.fulfilledOrders > row.orders) reasons.push("Fulfilled orders cannot exceed orders.")
    if (reasons.length) {
      quarantined.push(Object.freeze({ recordId: row.recordId, sourceRowIdentity: row.sourceRowIdentity, reasons: Object.freeze(reasons) }))
      continue
    }
    accepted.push(Object.freeze({
      ...row,
      memberSavingsInr,
      niaMarginInr,
      attachRate: row.eligibleMembers === 0 ? null : row.purchasingMembers / row.eligibleMembers,
      repeatRate: row.purchasingMembers === 0 ? null : row.repeatMembers / row.purchasingMembers,
      fillRate: row.orders === 0 ? null : row.fulfilledOrders / row.orders,
      stockout: row.availableUnits === 0,
      policyRefs: Object.freeze([`${savingsPolicy.policyId}@v${savingsPolicy.version}`, `${marginPolicy.policyId}@v${marginPolicy.version}`]),
    }))
  }

  return Object.freeze({ accepted: Object.freeze(accepted), quarantined: Object.freeze(quarantined) })
}

export type PeopleExecutionInput = Readonly<{
  actorId: string
  displayName: string
  role: "JCO" | "EAE" | "Theatre lead" | "Functional owner"
  theatreId: string
  studioId: string | null
  assignedActions: number
  activityUpdates: number
  closedActions: number
  resolvedOutcomes: number
  lastReportedAt: string
  payoutRecordedInr: number
  approvedOutcomePayoutInr: number
  sourceRowIdentity: string
  synthetic: true
}>

export type PeopleExecutionResult = PeopleExecutionInput & Readonly<{
  closureRate: number | null
  resolvedOutcomeRate: number | null
  incentiveEligibleInr: number
  flags: readonly ("Missing reporting" | "Activity without resolved outcome" | "Payout exception")[]
  cadencePolicyRef: string
}>

export function evaluatePeopleExecution(rows: readonly PeopleExecutionInput[], at: string) {
  const cadence = numericPolicy("POL-HEARTBEAT-CADENCE", at)
  const atMs = Date.parse(at)
  const people = rows.map((row): PeopleExecutionResult => {
    const flags: PeopleExecutionResult["flags"][number][] = []
    if (atMs - Date.parse(row.lastReportedAt) > cadence.value * 60_000) flags.push("Missing reporting")
    if (row.activityUpdates > 0 && row.closedActions > 0 && row.resolvedOutcomes === 0) flags.push("Activity without resolved outcome")
    if (row.payoutRecordedInr > row.approvedOutcomePayoutInr || (row.payoutRecordedInr > 0 && row.resolvedOutcomes === 0)) flags.push("Payout exception")
    const incentiveEligibleInr = row.resolvedOutcomes > 0 ? row.approvedOutcomePayoutInr : 0
    return Object.freeze({
      ...row,
      closureRate: row.assignedActions === 0 ? null : row.closedActions / row.assignedActions,
      resolvedOutcomeRate: row.assignedActions === 0 ? null : row.resolvedOutcomes / row.assignedActions,
      incentiveEligibleInr,
      flags: Object.freeze(flags),
      cadencePolicyRef: `${cadence.policyId}@v${cadence.version}`,
    })
  })
  const assigned = people.reduce((sum, row) => sum + row.assignedActions, 0)
  const activity = people.reduce((sum, row) => sum + row.activityUpdates, 0)
  const closed = people.reduce((sum, row) => sum + row.closedActions, 0)
  const resolved = people.reduce((sum, row) => sum + row.resolvedOutcomes, 0)
  return Object.freeze({
    people: Object.freeze(people),
    totals: Object.freeze({ assigned, activity, closed, resolved, closureRate: assigned ? closed / assigned : null, resolvedOutcomeRate: assigned ? resolved / assigned : null }),
  })
}

export type MemberContinuityInput = Readonly<{
  memberToken: string
  cohort: string
  livingState: "Stable" | "At risk" | "Exited"
  workState: "Placed" | "Interrupted" | "Exited"
  essentialsState: "Active" | "Lapsed" | "Not used"
  activeAtM6: boolean
  churnedThisMonth: boolean
  verificationStatus: "Verified" | "Pending"
  sourceRefs: readonly string[]
  asOf: string
  synthetic: true
}>

export function evaluateMemberContinuity(rows: readonly MemberContinuityInput[], at: string) {
  const reference = numericPolicy("POL-RETENTION-M6-REFERENCE", at)
  const warning = numericPolicy("POL-RETENTION-M6-WARNING", at)
  const churn = numericPolicy("POL-MONTHLY-CHURN-REFERENCE", at)
  const verified = rows.filter((row) => row.verificationStatus === "Verified")
  const retained = verified.filter((row) => row.activeAtM6).length
  const churned = verified.filter((row) => row.churnedThisMonth).length
  const m6Retention = verified.length ? retained / verified.length : null
  const monthlyChurn = verified.length ? churned / verified.length : null
  return Object.freeze({
    records: Object.freeze(rows.map((row) => Object.freeze({ ...row, sourceRefs: Object.freeze([...row.sourceRefs]) }))),
    verifiedCohortSize: verified.length,
    pendingSignals: rows.length - verified.length,
    retainedAtM6: retained,
    m6Retention,
    monthlyChurn,
    warning: m6Retention !== null && m6Retention < warning.value,
    policyRefs: Object.freeze({ reference: `${reference.policyId}@v${reference.version}`, warning: `${warning.policyId}@v${warning.version}`, churn: `${churn.policyId}@v${churn.version}` }),
    policyValues: Object.freeze({ reference: reference.value, warning: warning.value, churn: churn.value }),
    memberMasterCreated: false as const,
  })
}

export type GovernedFact = Readonly<{
  factId: string
  metricId: string
  value: string
  verificationStatus: "Verified" | "Pending"
  analyticsAllowed: boolean
  dataClassification: "Internal" | "Restricted payroll"
  sourceRowIdentity: string
  asOf: string
  verifiedBy: string | null
  synthetic: true
}>

export type GovernedReportDraft = Readonly<{
  reportId: string
  reportType: "Monthly MIS" | "Board draft" | "Investor draft"
  audience: "Internal management" | "Board" | "Investors"
  status: "Draft · external release blocked"
  verifiedFacts: readonly (GovernedFact & { metric: MetricDefinition })[]
  excludedFacts: readonly { factId: string; reason: string }[]
  requiredExternalApprover: "CEO"
  externalReleasePermitted: false
  reportMutationPermitted: false
  appendOnlyHistory: readonly { eventId: string; state: "Drafted"; actorId: string; occurredAt: string; note: string }[]
  asOf: string
}>

export function buildGovernedReportDrafts(facts: readonly GovernedFact[], at: string): readonly GovernedReportDraft[] {
  const approval = policyAt("POL-EXTERNAL-REPORT-APPROVER", at)
  if (!approval || approval.value !== "CEO") throw new Error("The governed external-report approver must be CEO.")
  const admitted = facts.flatMap((fact) => {
    if (fact.verificationStatus !== "Verified" || !fact.analyticsAllowed || fact.dataClassification === "Restricted payroll") return []
    const metric = METRIC_REGISTRY.find((candidate) => candidate.metricId === fact.metricId)
    if (!metric) throw new Error(`A verified fact cannot enter reporting without metric lineage: ${fact.metricId}.`)
    return [Object.freeze({ ...fact, metric })]
  })
  const excluded = facts.flatMap((fact) => {
    if (admitted.some((item) => item.factId === fact.factId)) return []
    const reason = fact.dataClassification === "Restricted payroll" ? "Restricted payroll is excluded from general analytics." : fact.verificationStatus !== "Verified" ? "Fact is not independently verified." : "Fact is not allowlisted for analytics."
    return [Object.freeze({ factId: fact.factId, reason })]
  })
  const specs = [
    ["GOV-MIS-2026-07", "Monthly MIS", "Internal management"],
    ["GOV-BOARD-2026-07", "Board draft", "Board"],
    ["GOV-IR-2026-07", "Investor draft", "Investors"],
  ] as const
  return Object.freeze(specs.map(([reportId, reportType, audience]) => Object.freeze({
    reportId,
    reportType,
    audience,
    status: "Draft · external release blocked" as const,
    verifiedFacts: Object.freeze([...admitted]),
    excludedFacts: Object.freeze([...excluded]),
    requiredExternalApprover: "CEO" as const,
    externalReleasePermitted: false as const,
    reportMutationPermitted: false as const,
    appendOnlyHistory: Object.freeze([Object.freeze({ eventId: `${reportId}-v1`, state: "Drafted" as const, actorId: "ACT-GOVERNANCE", occurredAt: at, note: "Created from verified, allowlisted, non-payroll facts; no release action was executed." })]),
    asOf: at,
  })))
}
