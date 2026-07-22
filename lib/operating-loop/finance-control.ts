import type { CanonicalStudio, PolicyDefinition } from "@/lib/operating-loop/contracts"
import { POLICY_REGISTRY, policyAt } from "@/lib/operating-loop/contracts"
import type { CapacityContext, StudioMatch } from "@/lib/operating-loop/matching"

export const FINANCIAL_APPROVAL_CATEGORIES = [
  "Pricing exception",
  "Studio commercial terms",
  "Deposit",
  "Nia-funded capex",
  "Financial commitment",
  "Payout exception",
  "Studio release",
  "Forecast guardrail breach",
] as const

export type FinancialApprovalCategory = (typeof FINANCIAL_APPROVAL_CATEGORIES)[number]

type VersionedControl<T> = {
  policyId: string
  value: T
  unit: string
  version: number
  effectiveFrom: string
}

export type FinancialControlPolicies = {
  asOf: string
  monthlyOpexCap: VersionedControl<number>
  minimumCash: VersionedControl<number>
  financialApprover: VersionedControl<"Pushkar">
  hiringState: VersionedControl<"Frozen">
}

function requiredPolicy(policyId: string, at: string, registry: readonly PolicyDefinition[]) {
  const policy = policyAt(policyId, at, registry)
  if (!policy) throw new Error(`Active policy ${policyId} is required at ${at}.`)
  return policy
}

function numericControl(policyId: string, at: string, registry: readonly PolicyDefinition[]): VersionedControl<number> {
  const policy = requiredPolicy(policyId, at, registry)
  if (typeof policy.value !== "number" || !Number.isFinite(policy.value)) throw new Error(`Policy ${policyId} must contain a finite number.`)
  return Object.freeze({ policyId, value: policy.value, unit: policy.unit, version: policy.version, effectiveFrom: policy.effectiveFrom })
}

function lockedStringControl<T extends string>(policyId: string, expected: T, at: string, registry: readonly PolicyDefinition[]): VersionedControl<T> {
  const policy = requiredPolicy(policyId, at, registry)
  if (policy.value !== expected) throw new Error(`Policy ${policyId} must remain ${expected}.`)
  return Object.freeze({ policyId, value: expected, unit: policy.unit, version: policy.version, effectiveFrom: policy.effectiveFrom })
}

export function financialControlPoliciesAt(at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY): FinancialControlPolicies {
  return Object.freeze({
    asOf: at,
    monthlyOpexCap: numericControl("POL-OPEX-CAP", at, registry),
    minimumCash: numericControl("POL-CASH-GUARD", at, registry),
    financialApprover: lockedStringControl("POL-FIN-APPROVER", "Pushkar", at, registry),
    hiringState: lockedStringControl("POL-HIRING", "Frozen", at, registry),
  })
}

export type ExpansionAssumptions = CapacityContext & {
  livingCm2PerOccupiedNestPerMonthInr: number
  projectionMonths: 3
  contributionMarginScope: "Living CM2 only"
}

export type GovernedStudioOption = {
  rank: number
  studioId: string
  studioName: string
  theatreId: string
  canMeetDemand: boolean
  distanceKm: number
  activationReadyNests: number
  contractedNests: number
  expectedOccupiedNests: number
  refundableDepositInr: number
  nonrefundableDepositInr: number
  niaFundedCapexInr: number
  launchWorkingCapitalInr: number
  upfrontCapitalInr: number
  capitalPerReadyNestInr: number
  monthlyPartnerCostInr: number
  recurringCostPerContractedNestInr: number
  recurringCostPerExpectedOccupiedNestInr: number
  activationFriction: {
    commercialAgreementDays: number
    complianceReadinessDays: number
    physicalReadinessDays: number
    unresolvedDependencyDays: number
    totalDays: number
  }
  projected90DayContributionMarginInr: number
  contributionMarginAssumption: {
    scope: "Living CM2 only"
    perOccupiedNestPerMonthInr: number
    expectedOccupiedNests: number
    months: 3
    formula: string
    exclusions: string
  }
  source: StudioMatch["source"]
}

export function buildGovernedStudioOptions(
  studios: readonly CanonicalStudio[],
  matches: readonly StudioMatch[],
  assumptionsByStudio: Readonly<Record<string, ExpansionAssumptions>>,
) {
  const studiosById = new Map(studios.map((studio) => [studio.studioId, studio]))
  return Object.freeze(matches.map((match): GovernedStudioOption => {
    const studio = studiosById.get(match.studioId)
    const assumptions = assumptionsByStudio[match.studioId]
    if (!studio || !assumptions) throw new Error(`Governed assumptions are missing for Studio ${match.studioId}.`)
    if (assumptions.expectedOccupiedNests <= 0 || assumptions.livingCm2PerOccupiedNestPerMonthInr < 0) throw new Error(`Studio ${match.studioId} has invalid contribution-margin assumptions.`)
    const totalFrictionDays = assumptions.commercialAgreementDays + assumptions.complianceReadinessDays + assumptions.physicalReadinessDays + assumptions.unresolvedDependencyDays
    const upfrontCapitalInr = studio.refundableDepositInr + studio.nonrefundableDepositInr + studio.niaCapexInr + studio.launchWorkingCapitalInr
    const projected90DayContributionMarginInr = assumptions.expectedOccupiedNests * assumptions.livingCm2PerOccupiedNestPerMonthInr * assumptions.projectionMonths
    return Object.freeze({
      rank: match.rank,
      studioId: studio.studioId,
      studioName: studio.name,
      theatreId: studio.theatreId,
      canMeetDemand: match.canMeetHeadcount && match.canMeetActivationDate,
      distanceKm: match.distanceKm,
      activationReadyNests: studio.activationReadyNests,
      contractedNests: studio.contractedNests,
      expectedOccupiedNests: assumptions.expectedOccupiedNests,
      refundableDepositInr: studio.refundableDepositInr,
      nonrefundableDepositInr: studio.nonrefundableDepositInr,
      niaFundedCapexInr: studio.niaCapexInr,
      launchWorkingCapitalInr: studio.launchWorkingCapitalInr,
      upfrontCapitalInr,
      capitalPerReadyNestInr: match.capitalPerReadyNestInr,
      monthlyPartnerCostInr: studio.monthlyPartnerCostInr,
      recurringCostPerContractedNestInr: match.recurringCostPerContractedNestInr,
      recurringCostPerExpectedOccupiedNestInr: match.recurringCostPerExpectedOccupiedNestInr,
      activationFriction: Object.freeze({
        commercialAgreementDays: assumptions.commercialAgreementDays,
        complianceReadinessDays: assumptions.complianceReadinessDays,
        physicalReadinessDays: assumptions.physicalReadinessDays,
        unresolvedDependencyDays: assumptions.unresolvedDependencyDays,
        totalDays: totalFrictionDays,
      }),
      projected90DayContributionMarginInr,
      contributionMarginAssumption: Object.freeze({
        scope: assumptions.contributionMarginScope,
        perOccupiedNestPerMonthInr: assumptions.livingCm2PerOccupiedNestPerMonthInr,
        expectedOccupiedNests: assumptions.expectedOccupiedNests,
        months: assumptions.projectionMonths,
        formula: `${assumptions.expectedOccupiedNests} expected occupied Nests × ₹${assumptions.livingCm2PerOccupiedNestPerMonthInr} Living CM2 × ${assumptions.projectionMonths} months`,
        exclusions: "Refundable and non-refundable deposits, capex and launch working capital remain visible capital components and are not amortised into CM.",
      }),
      source: match.source,
    })
  }))
}

export type FinancialForecast = {
  period: string
  currentMonthlyOpexInr: number
  forecastMonthlyOpexInr: number
  currentCashInr: number
  pendingCommitmentsInr: number
  proposedUpfrontCapitalInr: number
  proposedNewHires: number
  sourceRowIdentity: string
  asOf: string
  synthetic: boolean
}

export type FinancialGuardrailBreach = {
  kind: "Opex forecast breach" | "Cash guardrail breach" | "Hiring freeze breach"
  policyId: string
  observed: number
  threshold: number
  variance: number
  response: "Escalate before month close" | "Immediate escalation" | "Blocked until policy changes"
}

export type FinancialGuardrailEvaluation = {
  evaluationId: string
  forecast: Readonly<FinancialForecast>
  projectedCashAfterCommitmentInr: number
  breaches: readonly FinancialGuardrailBreach[]
  approvalRequired: boolean
  approver: "Pushkar"
  executionPermitted: false
  mode: "Shadow mode"
  policyVersions: readonly string[]
}

function finiteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number.`)
}

export function evaluateFinancialGuardrails(forecast: FinancialForecast, policies: FinancialControlPolicies): FinancialGuardrailEvaluation {
  finiteNonNegative(forecast.currentMonthlyOpexInr, "Current monthly opex")
  finiteNonNegative(forecast.forecastMonthlyOpexInr, "Forecast monthly opex")
  finiteNonNegative(forecast.currentCashInr, "Current cash")
  finiteNonNegative(forecast.pendingCommitmentsInr, "Pending commitments")
  finiteNonNegative(forecast.proposedUpfrontCapitalInr, "Proposed upfront capital")
  finiteNonNegative(forecast.proposedNewHires, "Proposed new hires")
  const projectedCashAfterCommitmentInr = forecast.currentCashInr - forecast.pendingCommitmentsInr - forecast.proposedUpfrontCapitalInr
  const breaches: FinancialGuardrailBreach[] = []
  if (forecast.forecastMonthlyOpexInr > policies.monthlyOpexCap.value) breaches.push(Object.freeze({
    kind: "Opex forecast breach",
    policyId: policies.monthlyOpexCap.policyId,
    observed: forecast.forecastMonthlyOpexInr,
    threshold: policies.monthlyOpexCap.value,
    variance: forecast.forecastMonthlyOpexInr - policies.monthlyOpexCap.value,
    response: "Escalate before month close",
  }))
  if (projectedCashAfterCommitmentInr < policies.minimumCash.value) breaches.push(Object.freeze({
    kind: "Cash guardrail breach",
    policyId: policies.minimumCash.policyId,
    observed: projectedCashAfterCommitmentInr,
    threshold: policies.minimumCash.value,
    variance: policies.minimumCash.value - projectedCashAfterCommitmentInr,
    response: "Immediate escalation",
  }))
  if (policies.hiringState.value === "Frozen" && forecast.proposedNewHires > 0) breaches.push(Object.freeze({
    kind: "Hiring freeze breach",
    policyId: policies.hiringState.policyId,
    observed: forecast.proposedNewHires,
    threshold: 0,
    variance: forecast.proposedNewHires,
    response: "Blocked until policy changes",
  }))
  return Object.freeze({
    evaluationId: `FIN-EVAL-${forecast.period}-${forecast.sourceRowIdentity}`,
    forecast: Object.freeze({ ...forecast }),
    projectedCashAfterCommitmentInr,
    breaches: Object.freeze(breaches),
    approvalRequired: breaches.length > 0,
    approver: policies.financialApprover.value,
    executionPermitted: false,
    mode: "Shadow mode",
    policyVersions: Object.freeze([
      `${policies.monthlyOpexCap.policyId}@v${policies.monthlyOpexCap.version}`,
      `${policies.minimumCash.policyId}@v${policies.minimumCash.version}`,
      `${policies.financialApprover.policyId}@v${policies.financialApprover.version}`,
      `${policies.hiringState.policyId}@v${policies.hiringState.version}`,
    ]),
  })
}

export type FinancialApprovalStatus = "Requested" | "Approved" | "Rejected"

export type FinancialApprovalAuditEvent = {
  eventId: string
  kind: "Requested" | "Evidence added" | "Decision"
  from: FinancialApprovalStatus | null
  to: FinancialApprovalStatus
  actorId: string
  occurredAt: string
  note: string
  version: number
}

export type FinancialApprovalRequest = {
  requestId: string
  category: FinancialApprovalCategory
  studioId: string | null
  amountInr: number | null
  requestedBy: string
  requestedAt: string
  approver: "Pushkar"
  status: FinancialApprovalStatus
  reason: string
  policyRefs: readonly string[]
  protectedEvidenceRefs: readonly string[]
  decisionBy: string | null
  decidedAt: string | null
  version: number
  synthetic: boolean
  history: readonly FinancialApprovalAuditEvent[]
}

type CreateFinancialApprovalInput = Omit<FinancialApprovalRequest, "approver" | "status" | "protectedEvidenceRefs" | "decisionBy" | "decidedAt" | "version" | "history">

export function createFinancialApprovalRequest(input: CreateFinancialApprovalInput, policies: FinancialControlPolicies): FinancialApprovalRequest {
  if (input.amountInr !== null) finiteNonNegative(input.amountInr, "Approval amount")
  if (!input.reason.trim()) throw new Error("A financial approval reason is required.")
  const event = Object.freeze({
    eventId: `${input.requestId}-v1`,
    kind: "Requested" as const,
    from: null,
    to: "Requested" as const,
    actorId: input.requestedBy,
    occurredAt: input.requestedAt,
    note: input.reason,
    version: 1,
  })
  return Object.freeze({
    ...input,
    policyRefs: Object.freeze([...input.policyRefs]),
    approver: policies.financialApprover.value,
    status: "Requested",
    protectedEvidenceRefs: Object.freeze([]),
    decisionBy: null,
    decidedAt: null,
    version: 1,
    history: Object.freeze([event]),
  })
}

export function appendFinancialApprovalEvidence(request: FinancialApprovalRequest, protectedRef: string, actorId: string, occurredAt: string, expectedVersion: number) {
  if (expectedVersion !== request.version) throw new Error(`Stale financial approval version: expected ${request.version}, received ${expectedVersion}.`)
  if (request.status !== "Requested") throw new Error("Evidence can only be added while approval is requested.")
  if (!protectedRef.startsWith("protected://")) throw new Error("Financial approval evidence must use a protected reference.")
  if (request.protectedEvidenceRefs.includes(protectedRef)) throw new Error("Financial approval evidence is append-only and unique.")
  const version = request.version + 1
  const event = Object.freeze({ eventId: `${request.requestId}-v${version}`, kind: "Evidence added" as const, from: request.status, to: request.status, actorId, occurredAt, note: `Protected approval evidence ${protectedRef} added.`, version })
  return Object.freeze({ ...request, version, protectedEvidenceRefs: Object.freeze([...request.protectedEvidenceRefs, protectedRef]), history: Object.freeze([...request.history, event]) })
}

export function decideFinancialApproval(
  request: FinancialApprovalRequest,
  input: { decision: "Approved" | "Rejected"; actorId: string; occurredAt: string; note: string; expectedVersion: number },
) {
  if (input.expectedVersion !== request.version) throw new Error(`Stale financial approval version: expected ${request.version}, received ${input.expectedVersion}.`)
  if (request.status !== "Requested") throw new Error("A financial approval request can be decided only once.")
  if (input.actorId !== request.approver || request.approver !== "Pushkar") throw new Error("Pushkar is required to decide financial approvals while the CFO role is vacant.")
  if (request.protectedEvidenceRefs.length === 0) throw new Error("Financial approval requires protected evidence.")
  if (!input.note.trim()) throw new Error("A financial approval decision note is required.")
  const version = request.version + 1
  const event = Object.freeze({ eventId: `${request.requestId}-v${version}`, kind: "Decision" as const, from: request.status, to: input.decision, actorId: input.actorId, occurredAt: input.occurredAt, note: input.note, version })
  return Object.freeze({ ...request, status: input.decision, decisionBy: input.actorId, decidedAt: input.occurredAt, version, history: Object.freeze([...request.history, event]) })
}
