import {
  FINANCIAL_APPROVAL_CATEGORIES,
  appendFinancialApprovalEvidence,
  buildGovernedStudioOptions,
  createFinancialApprovalRequest,
  decideFinancialApproval,
  evaluateFinancialGuardrails,
  financialControlPoliciesAt,
  type ExpansionAssumptions,
  type FinancialApprovalCategory,
  type FinancialApprovalRequest,
  type FinancialControlPolicies,
  type FinancialGuardrailEvaluation,
  type GovernedStudioOption,
} from "@/lib/operating-loop/finance-control"
import { SYNTHETIC_AS_OF, syntheticImportInput } from "@/lib/operating-loop/fixtures"
import { importOperatingRows } from "@/lib/operating-loop/ingestion"
import { rankStudiosForDemand } from "@/lib/operating-loop/matching"
import {
  appendWarRoomEvidence,
  assessStudioHealth,
  createWarRoomCase,
  projectVerifiedWarRoomOutcome,
  studioHealthPoliciesAt,
  transitionWarRoomCase,
  type FinanceControlProjection,
  type StudioHealthAssessment,
  type WarRoomCase,
  type WarRoomState,
} from "@/lib/operating-loop/studio-health"

const expansionAssumptions: Readonly<Record<string, ExpansionAssumptions>> = {
  "ST-SIP-02": { expectedOccupiedNests: 132, commercialAgreementDays: 0, complianceReadinessDays: 0, physicalReadinessDays: 1, unresolvedDependencyDays: 0, livingCm2PerOccupiedNestPerMonthInr: 300, projectionMonths: 3, contributionMarginScope: "Living CM2 only" },
  "ST-ORA-01": { expectedOccupiedNests: 240, commercialAgreementDays: 1, complianceReadinessDays: 1, physicalReadinessDays: 1, unresolvedDependencyDays: 0, livingCm2PerOccupiedNestPerMonthInr: 300, projectionMonths: 3, contributionMarginScope: "Living CM2 only" },
  "ST-MAM-01": { expectedOccupiedNests: 180, commercialAgreementDays: 2, complianceReadinessDays: 2, physicalReadinessDays: 1, unresolvedDependencyDays: 1, livingCm2PerOccupiedNestPerMonthInr: 300, projectionMonths: 3, contributionMarginScope: "Living CM2 only" },
}

export type FinanceExpansionPreview = {
  mode: "Shadow mode"
  writesEnabled: false
  source: { name: string; asOf: string; freshness: "Current"; synthetic: true }
  policies: FinancialControlPolicies
  options: readonly GovernedStudioOption[]
  selectedStudioId: string
  guardrails: FinancialGuardrailEvaluation
  approvals: readonly FinancialApprovalRequest[]
  studioHealth: readonly StudioHealthAssessment[]
  warRoomCases: readonly WarRoomCase[]
  projection: FinanceControlProjection
}

function approvalAmount(category: FinancialApprovalCategory, option: GovernedStudioOption, guardrails: FinancialGuardrailEvaluation) {
  const largestGuardrailVariance = Math.max(0, ...guardrails.breaches.map((breach) => breach.variance))
  const amounts: Record<FinancialApprovalCategory, number | null> = {
    "Pricing exception": 5_000,
    "Studio commercial terms": option.monthlyPartnerCostInr,
    Deposit: option.refundableDepositInr + option.nonrefundableDepositInr,
    "Nia-funded capex": option.niaFundedCapexInr,
    "Financial commitment": option.upfrontCapitalInr,
    "Payout exception": 25_000,
    "Studio release": null,
    "Forecast guardrail breach": largestGuardrailVariance,
  }
  return amounts[category]
}

function buildApprovalQueue(option: GovernedStudioOption, guardrails: FinancialGuardrailEvaluation, policies: FinancialControlPolicies) {
  const approvedCategories = new Set<FinancialApprovalCategory>(["Studio commercial terms", "Deposit", "Nia-funded capex"])
  return Object.freeze(FINANCIAL_APPROVAL_CATEGORIES.map((category, index) => {
    const requestId = `FIN-APP-${String(index + 1).padStart(3, "0")}`
    let request: FinancialApprovalRequest = createFinancialApprovalRequest({
      requestId,
      category,
      studioId: option.studioId,
      amountInr: approvalAmount(category, option, guardrails),
      requestedBy: "ACT-FINANCE",
      requestedAt: `2026-07-17T0${8 + Math.min(index, 1)}:${String(index * 5).padStart(2, "0")}:00+05:30`,
      reason: `Synthetic shadow-mode review for ${category.toLowerCase()}; no execution permission is granted.`,
      policyRefs: guardrails.policyVersions,
      synthetic: true,
    }, policies)
    request = appendFinancialApprovalEvidence(request, `protected://finance-approval/${requestId.toLowerCase()}`, "ACT-FINANCE", "2026-07-17T09:00:00+05:30", request.version)
    if (approvedCategories.has(category)) request = decideFinancialApproval(request, { decision: "Approved", actorId: "Pushkar", occurredAt: "2026-07-17T09:15:00+05:30", note: "Synthetic approval recorded for workflow verification only; no commercial or financial execution is authorised.", expectedVersion: request.version })
    return request
  }))
}

function moveWarRoom(warRoomCase: WarRoomCase, to: WarRoomState, actorId: string, occurredAt: string, note: string, verifierActorId?: string) {
  return transitionWarRoomCase(warRoomCase, { to, actorId, occurredAt, note, verifierActorId, expectedVersion: warRoomCase.version })
}

function buildHealthCases(assessments: readonly StudioHealthAssessment[], approvals: readonly FinancialApprovalRequest[]) {
  const red = assessments.find((assessment) => assessment.status === "Red")
  const amber = assessments.find((assessment) => assessment.status === "Amber")
  if (!red || !amber || !red.reviewDueAt || !red.decisionDueAt || !amber.reviewDueAt) throw new Error("Synthetic Studio-health fixtures are incomplete.")

  let redCase = createWarRoomCase({
    caseId: "WAR-STUDIO-RED-001",
    studioId: red.studioId,
    title: `${red.studioName} health recovery`,
    priority: "Critical",
    triggers: red.reasons,
    ownerActorId: red.ownerActorId,
    verifierActorId: "ACT-VERIFY",
    responseDueAt: red.reviewDueAt,
    decisionDueAt: red.decisionDueAt,
    requiredEvidence: ["CEO and COO review record", "Studio recovery decision", "Corrected occupancy and margin proof"],
    linkedApprovalRequestIds: [],
    sourceRowIdentity: red.sourceRowIdentity,
    synthetic: true,
    openedAt: red.asOf,
    openedBy: "ACT-ORCHESTRATOR",
  })
  redCase = moveWarRoom(redCase, "Assigned", "ACT-ORCHESTRATOR", "2026-07-17T08:05:00+05:30", "COO assigned as the single accountable owner; CEO remains a required decision role.")
  redCase = moveWarRoom(redCase, "In progress", red.ownerActorId, "2026-07-17T08:10:00+05:30", "Same-day review started in shadow mode.")
  redCase = appendWarRoomEvidence(redCase, { evidenceId: "WAR-EVIDENCE-RED-001", protectedRef: "protected://war-room/studio-red-001", description: "Synthetic CEO/COO review, recovery decision and corrected health evidence.", submittedBy: red.ownerActorId, submittedAt: "2026-07-17T12:00:00+05:30" }, redCase.version)
  redCase = moveWarRoom(redCase, "Evidence submitted", red.ownerActorId, "2026-07-17T12:01:00+05:30", "Protected recovery evidence submitted.")
  redCase = moveWarRoom(redCase, "Verified", "ACT-VERIFY", "2026-07-17T13:00:00+05:30", "Independent verifier confirmed the synthetic recovery evidence.", "ACT-VERIFY")
  redCase = moveWarRoom(redCase, "Closed", "ACT-VERIFY", "2026-07-17T13:05:00+05:30", "Closed only after independent verification.")

  let amberCase = createWarRoomCase({
    caseId: "WAR-STUDIO-AMBER-001",
    studioId: amber.studioId,
    title: `${amber.studioName} Theatre action plan`,
    priority: "Priority",
    triggers: amber.reasons,
    ownerActorId: amber.ownerActorId,
    verifierActorId: "ACT-VERIFY",
    responseDueAt: amber.reviewDueAt,
    decisionDueAt: amber.actionPlanDueAt,
    requiredEvidence: ["Theatre review", "48-hour action plan"],
    linkedApprovalRequestIds: [],
    sourceRowIdentity: amber.sourceRowIdentity,
    synthetic: true,
    openedAt: amber.asOf,
    openedBy: "ACT-ORCHESTRATOR",
  })
  amberCase = moveWarRoom(amberCase, "Assigned", "ACT-ORCHESTRATOR", "2026-07-17T08:06:00+05:30", "Theatre lead assigned with the locked 24-hour review deadline.")

  const guardrailApproval = approvals.find((approval) => approval.category === "Forecast guardrail breach")
  if (!guardrailApproval) throw new Error("Forecast guardrail approval fixture is missing.")
  let financeCase = createWarRoomCase({
    caseId: "WAR-FINANCE-GUARD-001",
    studioId: null,
    title: "Opex and cash forecast guardrail review",
    priority: "Maximum",
    triggers: ["Monthly opex forecast exceeds ₹60 lakh.", "Projected cash after commitment is below ₹150 lakh."],
    ownerActorId: "ACT-FINANCE",
    verifierActorId: "ACT-VERIFY",
    responseDueAt: SYNTHETIC_AS_OF,
    decisionDueAt: null,
    requiredEvidence: ["Reconciled finance forecast", "Pushkar decision", "Guardrail recovery plan"],
    linkedApprovalRequestIds: [guardrailApproval.requestId],
    sourceRowIdentity: "Finance_Daily:FIN-SYNTHETIC-2026-07-17",
    synthetic: true,
    openedAt: SYNTHETIC_AS_OF,
    openedBy: "ACT-ORCHESTRATOR",
  })
  financeCase = moveWarRoom(financeCase, "Assigned", "ACT-ORCHESTRATOR", "2026-07-17T08:07:00+05:30", "Finance owner assigned; Pushkar decision remains pending.")
  return Object.freeze([redCase, amberCase, financeCase])
}

export function buildFinanceExpansionPreview(): FinanceExpansionPreview {
  const ingestion = importOperatingRows(syntheticImportInput())
  const demand = ingestion.canonical.demands[0]
  if (!demand) throw new Error("The synthetic demand fixture is missing.")
  const matches = rankStudiosForDemand(demand, ingestion.canonical.studios, expansionAssumptions)
  const options = buildGovernedStudioOptions(ingestion.canonical.studios, matches, expansionAssumptions)
  const selected = options[0]
  if (!selected) throw new Error("No governed Studio option is available.")
  const policies = financialControlPoliciesAt(SYNTHETIC_AS_OF)
  const guardrails = evaluateFinancialGuardrails({
    period: "2026-07",
    currentMonthlyOpexInr: 4_800_000,
    forecastMonthlyOpexInr: 6_180_000,
    currentCashInr: 17_200_000,
    pendingCommitmentsInr: 500_000,
    proposedUpfrontCapitalInr: selected.upfrontCapitalInr,
    proposedNewHires: 0,
    sourceRowIdentity: "Finance_Daily:FIN-SYNTHETIC-2026-07-17",
    asOf: SYNTHETIC_AS_OF,
    synthetic: true,
  }, policies)
  const approvals = buildApprovalQueue(selected, guardrails, policies)
  const healthPolicies = studioHealthPoliciesAt(SYNTHETIC_AS_OF)
  const healthInputs = [
    { studio: ingestion.canonical.studios.find((studio) => studio.studioId === "ST-SIP-02"), occupiedNests: 82, grossMarginRatio: 0.07, contributionMarginInr: -120_000 },
    { studio: ingestion.canonical.studios.find((studio) => studio.studioId === "ST-ORA-01"), occupiedNests: 210, grossMarginRatio: 0.16, contributionMarginInr: 63_000 },
    { studio: ingestion.canonical.studios.find((studio) => studio.studioId === "ST-MAM-01"), occupiedNests: 220, grossMarginRatio: 0.22, contributionMarginInr: 150_000 },
  ]
  const studioHealth = Object.freeze(healthInputs.map(({ studio, occupiedNests, grossMarginRatio, contributionMarginInr }) => {
    if (!studio) throw new Error("A synthetic Studio-health fixture is missing.")
    return assessStudioHealth({
      studioId: studio.studioId,
      studioName: studio.name,
      theatreId: studio.theatreId,
      contractedNests: studio.contractedNests,
      occupiedNests,
      grossMarginRatio,
      contributionMarginInr,
      dataComplete: true,
      theatreOwnerActorId: "ACT-THEATRE",
      asOf: SYNTHETIC_AS_OF,
      sourceRowIdentity: studio.lineage.rowIdentity,
      synthetic: true,
    }, healthPolicies)
  }))
  const warRoomCases = buildHealthCases(studioHealth, approvals)
  const projection = projectVerifiedWarRoomOutcome(warRoomCases[0])

  return Object.freeze({
    mode: "Shadow mode",
    writesEnabled: false,
    source: Object.freeze({ name: "Finance and expansion Preview fixtures", asOf: SYNTHETIC_AS_OF, freshness: "Current", synthetic: true }),
    policies,
    options,
    selectedStudioId: selected.studioId,
    guardrails,
    approvals,
    studioHealth,
    warRoomCases,
    projection,
  })
}
