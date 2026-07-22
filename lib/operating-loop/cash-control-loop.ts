import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation, projectLoopHealth, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"

export const CASH_CONTROL_AT = "2026-07-18T09:30:00+05:30"
export const CASH_CONTROL_QUESTION = "What must Nia deliver this month, is cash protected, and is system work verified?"

export const CASH_CONTROL_POLICY_REGISTRY = Object.freeze([
  Object.freeze({ policyId: "POL-CASH-CM-GOAL", name: "Approved monthly CM goal", value: null, unit: "INR", version: 1, status: "Pending human approval", approver: "Pending", source: "No approved destination supplied" }),
  Object.freeze({ policyId: "POL-CASH-OPEX-CAP", name: "Monthly opex cap", value: 6_000_000, unit: "INR", version: 1, status: "Active", approver: "Sachin", source: "Locked Cash & Control scope" }),
  Object.freeze({ policyId: "POL-CASH-MIN-CASH", name: "Minimum collected-cash guardrail", value: 15_000_000, unit: "INR", version: 1, status: "Active", approver: "Sachin", source: "Locked Cash & Control scope" }),
  Object.freeze({ policyId: "POL-CASH-TARGET", name: "Approved collected-cash target", value: null, unit: "INR", version: 1, status: "Pending human approval", approver: "Pending", source: "No approved cash target supplied" }),
  Object.freeze({ policyId: "POL-CASH-CHANNEL-MIX", name: "Channel-mix decision boundary", value: null, unit: "evidence-ranked policy", version: 1, status: "Pending human approval", approver: "Pending", source: "No fixed split is approved" }),
  Object.freeze({ policyId: "POL-CASH-MATERIALITY", name: "Financial learning materiality thresholds", value: null, unit: "registry", version: 1, status: "Pending human approval", approver: "Pending", source: "Shared learning control owns approval" }),
  Object.freeze({ policyId: "POL-CASH-LEARNING-CONFIDENCE", name: "Production learning-confidence thresholds", value: null, unit: "registry", version: 1, status: "Pending human approval", approver: "Pending", source: "Shared learning control owns approval" }),
] as const)

export const CASH_CONTROL_BLOCKED_CAPABILITIES = Object.freeze({
  productionWrites: false,
  targetChanges: false,
  pricingChanges: false,
  guardrailExceptions: false,
  financeApprovals: false,
  cashMovement: false,
  liveChannelCascade: false,
  contracts: false,
  externalMessages: false,
  autoAdoption: false,
})

export const CASH_CONTROL_LEARNING_CHAIN_FIELDS = Object.freeze([
  "policy_version",
  "forecast",
  "context_snapshot",
  "decision",
  "assigned_action",
  "evidence",
  "independent_verification",
  "measured_outcome",
  "variance_reason",
] as const)

export type Freshness = "Current" | "Stale"
export type AttributionGrade = "Controlled" | "Compared" | "Observed"
export type HumanControlledCategory = "Targets" | "Pricing" | "Finance" | "Cash" | "Contracts" | "External communication" | "People decisions" | "Safety"
export type CashControlTrigger = "CM destination pending" | "Opex cap risk" | "Cash guardrail risk" | "Collection leakage" | "Closure awaiting verification" | "Closure reopened"
export type CashControlActionKind = "Destination approval" | "Opex recovery" | "Cash protection" | "Leakage recovery" | "Independent verification"

export type RampObservation = {
  channelId: string
  expectedCmInr: number
  observedCmInr: number | null
  evidenceRef: string | null
  submittedBy: string
  verifierRef: string | null
  dataFreshness: Freshness
  quarantined: boolean
}

export type CashControlContext = {
  destinationRef: string
  baselineRef: string
  evidenceRef: string
  approvedMonthlyCmGoalInr: number | null
  verifiedBaselineCmInr: number | null
  churnImpactCmInr: number | null
  churnEvidenceRef: string | null
  churnSubmittedBy: string
  churnVerifierRef: string | null
  churnFreshness: Freshness
  observedRamps: readonly RampObservation[]
  opexForecastInr: number | null
  collectedCashInr: number | null
  approvedCashTargetInr: number | null
  collectionLeakageInr: number | null
  claimedClosures: number
  verifiedClosures: number
  awaitingVerification: number
  reopenedClosures: number
  missedHourlyCmInr: number
  remainingHours: number
  criticalDataFreshness: Freshness
  submittedBy: string
  verifierRef: string | null
  quarantined: boolean
  rawBankAccount?: unknown
  rawCustomerIdentity?: unknown
}

export type CashControlSignalInput = {
  eventId: string
  occurredAt: string
  ownerRole: string
  dueAt: string
  context: CashControlContext
}

export type CashControlEvent = CashControlSignalInput & {
  triggers: readonly CashControlTrigger[]
  policyVersion: string
}

export type CashControlEventDecision =
  | { disposition: "Admitted"; event: CashControlEvent; reasons: readonly string[] }
  | { disposition: "Ignored" | "Quarantined"; event: null; reasons: readonly string[] }

export type CashControlDecision = {
  decisionId: string
  eventId: string
  kind: CashControlActionKind
  ownerRole: string
  rationale: string
  expectedVerifiedResult: string
  humanApprovalRequired: boolean
  recommendationOnly: boolean
  executable: false
}

export type CashControlAction = {
  actionId: string
  eventId: string
  idempotencyKey: string
  kind: CashControlActionKind
  ownerRole: string
  dueAt: string
  expectedVerifiedResult: string
  nextAction: string
  state: "Assigned" | "Evidence pending" | "Awaiting approval" | "Reopened"
  externalEffect: false
  recommendationOnly: boolean
}

export type VerifiedBaselineResult = {
  verifiedProjectionCmInr: number | null
  acceptedRampIds: readonly string[]
  rejectedRampIds: readonly string[]
  reasons: readonly string[]
}

export type MonthlyGapResult = {
  approvedGoalInr: number | null
  verifiedProjectionCmInr: number | null
  remainingGapInr: number | null
  status: "Available" | "Pending human approval" | "Unavailable"
  reasons: readonly string[]
}

export type CashFeasibility = {
  status: "Protected" | "At risk" | "Unavailable"
  opexHeadroomInr: number | null
  cashHeadroomInr: number | null
  targetHeadroomInr: number | null
  reasons: readonly string[]
}

export type ChannelCandidate = {
  candidateId: string
  channel: string
  expectedVerifiedCmInr: number
  requiredCashInr: number
  expectedHoursToOutcome: number
  evidenceRef: string | null
  dataFreshness: Freshness
  independentlyVerified: boolean
  quarantined: boolean
}

export type RankedChannelCandidate = ChannelCandidate & {
  rank: number
  efficiencyScore: number
  recommendationOnly: true
  allocationPct: null
}

export type CascadePreview = {
  approvalVerified: boolean
  eligibleAfterApproval: boolean
  executed: false
  externalEffect: false
  reason: string
}

export type RecoveryProjection = {
  approvedMonthlyTargetInr: number
  targetAfterRecoveryInr: number
  missedCmInr: number
  remainingHours: number
  previousHourlyRunRateInr: number
  revisedHourlyRunRateInr: number
  targetLowered: false
}

export type CashControlVerificationInput = {
  evidenceRef: string | null
  submittedBy: string
  verifierRef: string | null
  dataFreshness: Freshness
  measuredOutcomeVerified: boolean
  sourceMetricRecovered: boolean
  claimedActivityOnly: boolean
  quarantined: boolean
}

export type CashControlVerification = {
  status: "Verified" | "Awaiting evidence" | "Rejected" | "Reopened"
  canClose: boolean
  reasons: readonly string[]
}

export type MonthCloseVariance = {
  status: "Verified" | "Pending human approval" | "Awaiting independent verification"
  approvedGoalInr: number | null
  verifiedActualCmInr: number | null
  varianceInr: number | null
  reason: string
}

export type CashControlLearningChain = {
  event_id: string
  action_id: string
  policy_version: string
  forecast: { expected_cm_inr: number; expected_cash_inr: number; expected_opex_inr: number; expected_hours: number }
  context_snapshot: { destination_ref: string; data_freshness: Freshness; quarantined: boolean; approved_goal_present: boolean }
  decision: CashControlDecision
  assigned_action: CashControlAction
  evidence: { reference: string; cycles: number }
  independent_verification: { verified: boolean; verifier_ref: string; self_verified: boolean }
  measured_outcome: { actual_cm_inr: number; actual_cash_inr: number; actual_opex_inr: number; intervention_recovered_source_metric: boolean }
  variance_reason: string
}

export type CashControlLearningInput = {
  domain: "Cash & Control"
  event_id: string
  action_id: string
  proposed_change: string
  expected_effect: string
  evidence_cycles: number
  sample_size: number
  forecast_error_pct: number
  attribution_grade: AttributionGrade
  confounders: readonly string[]
  critical_data_fresh: boolean
  verification_rate_pct: number
  reversible: boolean
  rollback_trigger: string
  inside_approved_boundary: boolean
  reverses_human_decision: boolean
  affected_human_controlled_categories: readonly HumanControlledCategory[]
  target_effect: string
  channel_effect: string
  cm_effect: string
  cash_effect: string
  materiality_status: "Pending human approval"
  production_confidence: "Low"
  registry_thresholds_approved: false
  auto_adopt: false
  eligible_for_shared_learning_gate: boolean
  rejection_reasons: readonly string[]
}

export type CashControlTaskPreview = {
  actionId: string
  issue: string
  owner: string
  dueAt: string
  progress: string
  expectedVerifiedResult: string
  verifiedResult: string
  state: CashControlAction["state"] | "Awaiting verification"
  recommendationOnly: boolean
  engineAction: CashControlAction
  verificationInput: CashControlVerificationInput
}

export type CashControlPreview = {
  fixtureLabel: "Synthetic fixture"
  mode: "Shadow only"
  question: typeof CASH_CONTROL_QUESTION
  source: { name: string; asOf: string; lastRefreshAt: string; freshness: "Stale"; synthetic: true }
  headline: string
  summary: { target: string; current: string; gap: string; owner: string; progress: string; verifiedResult: string }
  measures: readonly [
    { id: "cm-destination"; label: string; value: string; target: string; detail: string },
    { id: "opex-control"; label: string; value: string; target: string; detail: string },
    { id: "cash-protection"; label: string; value: string; target: string; detail: string },
    { id: "closure-integrity"; label: string; value: string; target: string; detail: string },
  ]
  controlPath: readonly { id: string; label: string; value: string; state: "Complete" | "Pending" | "Blocked" }[]
  financialRails: readonly { id: "opex" | "cash"; label: string; value: string; threshold: string; progressPct: number; state: "Within control" | "Protected" }[]
  closureCounts: { claimed: number; verified: number; awaitingVerification: number; reopened: number }
  channelRecommendations: readonly RankedChannelCandidate[]
  tasks: readonly CashControlTaskPreview[]
  despatchEscalations: readonly DespatchEscalationRecord[]
  approvals: readonly { id: string; decision: string; owner: string; impact: string; status: "Pending human approval" }[]
  learningInputs: readonly CashControlLearningInput[]
  policyRegistry: typeof CASH_CONTROL_POLICY_REGISTRY
  blockedCapabilities: typeof CASH_CONTROL_BLOCKED_CAPABILITIES
  loopHealth: LoopHealth
}

export function emitCashControlDespatchEscalations(tasks: readonly CashControlTaskPreview[], at = CASH_CONTROL_AT): readonly DespatchEscalationRecord[] {
  return Object.freeze(tasks.flatMap((task) => {
    const overdue = Date.parse(task.dueAt) < Date.parse(at)
    if (task.state === "Awaiting approval" || (!overdue && task.state !== "Reopened")) return []
    return [createDespatchEscalation({
      escalationId: `DESPATCH-${task.actionId}`,
      domain: "Cash & Control",
      sourceActionId: task.actionId,
      sourceEventId: task.engineAction.eventId,
      title: task.issue,
      reason: task.state === "Reopened" ? "Independent verification failed and the control action reopened." : "The Cash & Control action passed its due time without verified recovery.",
      ownerRole: task.owner,
      dueAt: task.dueAt,
      raisedAt: at,
      severity: task.state === "Reopened" ? "Critical" : "Breach",
      status: "Open",
      evidenceRefs: Object.freeze([`protected://cash-control/${task.actionId}`]),
      synthetic: true,
    })]
  }).slice(0, 5))
}

function protectedReference(value: string | null | undefined, namespace?: string) {
  if (typeof value !== "string" || !value.startsWith("protected://")) return false
  return namespace ? value.startsWith(`protected://${namespace}/`) : true
}

function stableId(prefix: string, value: string) {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `${prefix}-${(hash >>> 0).toString(36)}`
}

function policyVersion() {
  return CASH_CONTROL_POLICY_REGISTRY.map((policy) => `${policy.policyId}@v${policy.version}:${policy.status}`).join("|")
}

export function deriveVerifiedBaseline(context: Pick<CashControlContext, "verifiedBaselineCmInr" | "churnImpactCmInr" | "churnEvidenceRef" | "churnSubmittedBy" | "churnVerifierRef" | "churnFreshness" | "observedRamps">): VerifiedBaselineResult {
  const reasons: string[] = []
  const rejectedRampIds: string[] = []
  const acceptedRampIds: string[] = []
  if (context.verifiedBaselineCmInr === null) reasons.push("Verified CM baseline is unavailable.")
  if (context.churnImpactCmInr === null) reasons.push("Verified churn impact is unavailable.")
  if (!protectedReference(context.churnEvidenceRef, "evidence")) reasons.push("Churn evidence must use a protected reference.")
  if (!protectedReference(context.churnVerifierRef, "verifier") || context.churnVerifierRef === context.churnSubmittedBy) reasons.push("Churn impact requires an independent verifier.")
  if (context.churnFreshness !== "Current") reasons.push("Churn evidence is stale.")

  let rampTotal = 0
  for (const ramp of context.observedRamps) {
    const accepted = ramp.observedCmInr !== null
      && protectedReference(ramp.evidenceRef, "evidence")
      && protectedReference(ramp.verifierRef, "verifier")
      && ramp.verifierRef !== ramp.submittedBy
      && ramp.dataFreshness === "Current"
      && !ramp.quarantined
    if (accepted) {
      rampTotal += ramp.observedCmInr as number
      acceptedRampIds.push(ramp.channelId)
    } else {
      rejectedRampIds.push(ramp.channelId)
    }
  }
  if (rejectedRampIds.length > 0) reasons.push("Unverified, stale, self-verified or quarantined ramps were excluded.")
  const requiredInputsValid = context.verifiedBaselineCmInr !== null && context.churnImpactCmInr !== null && reasons.filter((reason) => !reason.startsWith("Unverified")).length === 0
  const verifiedProjectionCmInr = requiredInputsValid
    ? (context.verifiedBaselineCmInr as number) + (context.churnImpactCmInr as number) + rampTotal
    : null
  return Object.freeze({
    verifiedProjectionCmInr,
    acceptedRampIds: Object.freeze(acceptedRampIds),
    rejectedRampIds: Object.freeze(rejectedRampIds),
    reasons: Object.freeze(reasons),
  })
}

export function calculateMonthlyGap(approvedGoalInr: number | null, verifiedProjectionCmInr: number | null): MonthlyGapResult {
  if (approvedGoalInr === null) return Object.freeze({ approvedGoalInr, verifiedProjectionCmInr, remainingGapInr: null, status: "Pending human approval" as const, reasons: Object.freeze(["Monthly CM goal is pending human approval."]) })
  if (verifiedProjectionCmInr === null) return Object.freeze({ approvedGoalInr, verifiedProjectionCmInr, remainingGapInr: null, status: "Unavailable" as const, reasons: Object.freeze(["Verified CM projection is unavailable."]) })
  return Object.freeze({ approvedGoalInr, verifiedProjectionCmInr, remainingGapInr: Math.max(0, approvedGoalInr - verifiedProjectionCmInr), status: "Available" as const, reasons: Object.freeze([]) })
}

export function assessCashFeasibility(opexForecastInr: number | null, collectedCashInr: number | null, approvedCashTargetInr: number | null): CashFeasibility {
  const reasons: string[] = []
  if (opexForecastInr === null || collectedCashInr === null) reasons.push("A current opex forecast and collected-cash balance are required.")
  if (reasons.length > 0) return Object.freeze({ status: "Unavailable" as const, opexHeadroomInr: null, cashHeadroomInr: null, targetHeadroomInr: null, reasons: Object.freeze(reasons) })
  const opexHeadroomInr = 6_000_000 - (opexForecastInr as number)
  const cashHeadroomInr = (collectedCashInr as number) - 15_000_000
  const targetHeadroomInr = approvedCashTargetInr === null ? null : (collectedCashInr as number) - approvedCashTargetInr
  if (opexHeadroomInr < 0) reasons.push("Opex forecast is above the ₹60L monthly cap.")
  if (cashHeadroomInr < 0) reasons.push("Collected cash is below the ₹150L minimum guardrail.")
  if (approvedCashTargetInr === null) reasons.push("Approved cash target is pending human approval.")
  else if (targetHeadroomInr !== null && targetHeadroomInr < 0) reasons.push("Collected cash is below the approved cash target.")
  const hardControlBroken = opexHeadroomInr < 0 || cashHeadroomInr < 0 || (targetHeadroomInr !== null && targetHeadroomInr < 0)
  return Object.freeze({ status: hardControlBroken ? "At risk" as const : "Protected" as const, opexHeadroomInr, cashHeadroomInr, targetHeadroomInr, reasons: Object.freeze(reasons) })
}

export function rankChannelMix(candidates: readonly ChannelCandidate[]): readonly RankedChannelCandidate[] {
  const eligible = candidates.filter((candidate) => candidate.expectedVerifiedCmInr > 0
    && candidate.requiredCashInr >= 0
    && candidate.expectedHoursToOutcome > 0
    && protectedReference(candidate.evidenceRef, "evidence")
    && candidate.dataFreshness === "Current"
    && candidate.independentlyVerified
    && !candidate.quarantined)
  return Object.freeze(eligible
    .map((candidate) => ({ ...candidate, efficiencyScore: candidate.expectedVerifiedCmInr / Math.max(1, candidate.requiredCashInr + candidate.expectedHoursToOutcome * 1_000) }))
    .sort((left, right) => right.efficiencyScore - left.efficiencyScore)
    .map((candidate, index) => Object.freeze({ ...candidate, rank: index + 1, recommendationOnly: true as const, allocationPct: null })))
}

export function previewCascade(approval: { approved: boolean; independentlyVerified: boolean; insideApprovedBoundary: boolean }): CascadePreview {
  const eligibleAfterApproval = approval.approved && approval.independentlyVerified && approval.insideApprovedBoundary
  return Object.freeze({
    approvalVerified: approval.approved && approval.independentlyVerified,
    eligibleAfterApproval,
    executed: false,
    externalEffect: false,
    reason: eligibleAfterApproval
      ? "Approved cascade is represented as a local preview only; live execution remains disabled."
      : "Cascade remains blocked until the approved destination and decision are independently verified inside the approved boundary.",
  })
}

export function reslotMissedHourlyWork(approvedMonthlyTargetInr: number, achievedCmInr: number, previouslyPlannedRemainingCmInr: number, missedCmInr: number, remainingHours: number): RecoveryProjection {
  const hours = Math.max(1, remainingHours)
  const remainingBeforeMiss = Math.max(0, approvedMonthlyTargetInr - achievedCmInr - missedCmInr)
  const remainingAfterMiss = Math.max(previouslyPlannedRemainingCmInr, approvedMonthlyTargetInr - achievedCmInr)
  return Object.freeze({
    approvedMonthlyTargetInr,
    targetAfterRecoveryInr: approvedMonthlyTargetInr,
    missedCmInr,
    remainingHours: hours,
    previousHourlyRunRateInr: remainingBeforeMiss / hours,
    revisedHourlyRunRateInr: remainingAfterMiss / hours,
    targetLowered: false,
  })
}

export function detectCashControlEvent(input: CashControlSignalInput): CashControlEventDecision {
  const { context } = input
  const quarantineReasons: string[] = []
  if (!protectedReference(context.destinationRef, "destination")) quarantineReasons.push("Monthly destination must use a protected reference.")
  if (!protectedReference(context.baselineRef, "baseline")) quarantineReasons.push("Verified baseline must use a protected reference.")
  if (!protectedReference(context.evidenceRef, "evidence")) quarantineReasons.push("Evidence lineage must use a protected reference.")
  if (context.quarantined) quarantineReasons.push("Quarantined financial context cannot enter the command loop.")
  if (context.rawBankAccount !== undefined || context.rawCustomerIdentity !== undefined) quarantineReasons.push("Raw bank and customer identity data are prohibited.")
  if (quarantineReasons.length > 0) return Object.freeze({ disposition: "Quarantined" as const, event: null, reasons: Object.freeze(quarantineReasons) })

  const triggers: CashControlTrigger[] = []
  if (context.approvedMonthlyCmGoalInr === null) triggers.push("CM destination pending")
  if (context.opexForecastInr !== null && context.opexForecastInr > 6_000_000) triggers.push("Opex cap risk")
  if (context.collectedCashInr !== null && context.collectedCashInr < 15_000_000) triggers.push("Cash guardrail risk")
  if ((context.collectionLeakageInr ?? 0) > 0) triggers.push("Collection leakage")
  if (context.awaitingVerification > 0 || context.claimedClosures > context.verifiedClosures) triggers.push("Closure awaiting verification")
  if (context.reopenedClosures > 0) triggers.push("Closure reopened")
  if (triggers.length === 0) return Object.freeze({ disposition: "Ignored" as const, event: null, reasons: Object.freeze(["No Cash & Control trigger is active."]) })
  const event = Object.freeze({ ...input, triggers: Object.freeze(triggers), policyVersion: policyVersion() })
  return Object.freeze({ disposition: "Admitted" as const, event, reasons: Object.freeze(triggers.map((trigger) => `${trigger} detected.`)) })
}

export function decideCashControl(event: CashControlEvent): CashControlDecision {
  let kind: CashControlActionKind
  let ownerRole: string
  let rationale: string
  let expectedVerifiedResult: string
  if (event.triggers.includes("Cash guardrail risk")) {
    kind = "Cash protection"
    ownerRole = "Pushkar / Finance"
    rationale = "Collected cash is below the locked minimum guardrail."
    expectedVerifiedResult = "Collected cash is independently verified at or above the guardrail, or a named human exception is recorded."
  } else if (event.triggers.includes("Opex cap risk")) {
    kind = "Opex recovery"
    ownerRole = "Pushkar / Finance"
    rationale = "Forecast opex exceeds the locked monthly cap."
    expectedVerifiedResult = "Verified forecast returns within the cap, or a named human exception is recorded."
  } else if (event.triggers.includes("CM destination pending")) {
    kind = "Destination approval"
    ownerRole = "Pushkar"
    rationale = "The monthly CM destination has no approved value."
    expectedVerifiedResult = "Named human approval records the destination and an independent verifier records the policy version."
  } else if (event.triggers.includes("Collection leakage")) {
    kind = "Leakage recovery"
    ownerRole = "Finance operations"
    rationale = "Collected cash remains below billed cash in the synthetic shadow snapshot."
    expectedVerifiedResult = "Bank-confirmed collection evidence recovers the source metric without moving money automatically."
  } else {
    kind = "Independent verification"
    ownerRole = "Independent verifier"
    rationale = "Claimed or reopened work has not passed independent verification."
    expectedVerifiedResult = "Each claimed closure is independently verified or reopened with a named owner and due time."
  }
  const humanApprovalRequired = kind === "Destination approval" || kind === "Cash protection" || kind === "Opex recovery"
  return Object.freeze({ decisionId: stableId("dec", `${event.eventId}:${kind}`), eventId: event.eventId, kind, ownerRole, rationale, expectedVerifiedResult, humanApprovalRequired, recommendationOnly: true, executable: false })
}

export function assignCashControlAction(event: CashControlEvent, decision: CashControlDecision): CashControlAction {
  const idempotencyKey = `${event.eventId}:${decision.kind}:${event.context.destinationRef}`
  return Object.freeze({
    actionId: stableId("act", idempotencyKey),
    eventId: event.eventId,
    idempotencyKey,
    kind: decision.kind,
    ownerRole: decision.ownerRole,
    dueAt: event.dueAt,
    expectedVerifiedResult: decision.expectedVerifiedResult,
    nextAction: decision.humanApprovalRequired ? "Prepare evidence for named human approval; do not execute a financial action." : "Collect protected evidence and queue independent verification.",
    state: decision.humanApprovalRequired ? "Awaiting approval" : "Assigned",
    externalEffect: false,
    recommendationOnly: true,
  })
}

export function recoverCashControlAction(action: CashControlAction, outcome: "Evidence received" | "Failed evidence" | "Human approval required" | "Missed hour"): CashControlAction {
  const state = outcome === "Evidence received" ? "Evidence pending" : outcome === "Failed evidence" || outcome === "Missed hour" ? "Reopened" : "Awaiting approval"
  const nextAction = outcome === "Missed hour"
    ? "Re-slot the miss into the remaining hourly run rate without lowering the monthly target."
    : outcome === "Failed evidence"
      ? "Reopen with corrected protected evidence and a new due time."
      : outcome === "Evidence received"
        ? "Queue a different named verifier; evidence receipt does not close."
        : "Retain the recommendation for named human approval; no financial action executes."
  return Object.freeze({ ...action, state, nextAction })
}

export function verifyCashControlClosure(input: CashControlVerificationInput): CashControlVerification {
  const reasons: string[] = []
  if (input.quarantined) reasons.push("Quarantined work cannot close.")
  if (!protectedReference(input.evidenceRef, "evidence")) reasons.push("Protected outcome evidence is required.")
  if (!protectedReference(input.verifierRef, "verifier")) reasons.push("A named protected verifier reference is required.")
  if (input.verifierRef === input.submittedBy) reasons.push("Self-verification is prohibited.")
  if (!input.measuredOutcomeVerified) reasons.push("Measured outcome is not independently verified.")
  if (!input.sourceMetricRecovered) reasons.push("The source metric has not recovered.")
  if (input.claimedActivityOnly) reasons.push("An activity claim cannot close financial work.")
  if (input.dataFreshness === "Stale") reasons.push("Stale evidence reopens the action.")
  const canClose = reasons.length === 0
  const status = canClose ? "Verified" as const : input.dataFreshness === "Stale" ? "Reopened" as const : reasons.some((reason) => /Self-verification|Quarantined/.test(reason)) ? "Rejected" as const : "Awaiting evidence" as const
  return Object.freeze({ status, canClose, reasons: Object.freeze(reasons) })
}

export function buildMonthCloseVariance(approvedGoalInr: number | null, verifiedActualCmInr: number | null, independentlyVerified: boolean): MonthCloseVariance {
  if (approvedGoalInr === null) return Object.freeze({ status: "Pending human approval" as const, approvedGoalInr, verifiedActualCmInr, varianceInr: null, reason: "Month-close variance cannot be calculated until the monthly CM goal is approved." })
  if (verifiedActualCmInr === null || !independentlyVerified) return Object.freeze({ status: "Awaiting independent verification" as const, approvedGoalInr, verifiedActualCmInr, varianceInr: null, reason: "Verified month-close CM evidence is required." })
  return Object.freeze({ status: "Verified" as const, approvedGoalInr, verifiedActualCmInr, varianceInr: verifiedActualCmInr - approvedGoalInr, reason: "Variance uses the approved destination and independently verified month-close CM." })
}

export function buildCashControlLearningInput(chain: CashControlLearningChain, options: {
  holdoutOrControl: boolean
  comparisonGroup: boolean
  confounders: readonly string[]
  sampleSize: number
  forecastErrorPct: number
  verificationRatePct: number
  reversible: boolean
  rollbackTrigger: string
  insideApprovedBoundary: boolean
  reversesHumanDecision: boolean
  affectedHumanControlledCategories: readonly HumanControlledCategory[]
}): CashControlLearningInput {
  const attributionGrade: AttributionGrade = options.holdoutOrControl ? "Controlled" : options.comparisonGroup ? "Compared" : "Observed"
  const confounders = attributionGrade === "Observed" && options.confounders.length === 0 ? ["confounders not ruled out"] : [...options.confounders]
  const criticalDataFresh = chain.context_snapshot.data_freshness === "Current"
  const rejectionReasons: string[] = []
  if (!criticalDataFresh) rejectionReasons.push("Critical financial inputs are stale.")
  if (chain.context_snapshot.quarantined) rejectionReasons.push("Quarantined context is excluded from learning.")
  if (!chain.independent_verification.verified) rejectionReasons.push("Outcome is not independently verified.")
  if (chain.independent_verification.self_verified) rejectionReasons.push("Self-verified outcome is excluded from learning.")
  if (!protectedReference(chain.evidence.reference, "evidence")) rejectionReasons.push("Protected evidence lineage is missing.")
  if (!chain.measured_outcome.intervention_recovered_source_metric) rejectionReasons.push("Intervention did not recover the source metric.")
  if (!chain.context_snapshot.approved_goal_present) rejectionReasons.push("The monthly destination is not approved.")
  return Object.freeze({
    domain: "Cash & Control",
    event_id: chain.event_id,
    action_id: chain.action_id,
    proposed_change: "Re-rank the evidence-eligible channel recommendation inside the currently approved boundary.",
    expected_effect: `Improve verified CM and cash delivery without changing the approved destination; forecast ${chain.forecast.expected_cm_inr} INR CM.`,
    evidence_cycles: chain.evidence.cycles,
    sample_size: options.sampleSize,
    forecast_error_pct: options.forecastErrorPct,
    attribution_grade: attributionGrade,
    confounders: Object.freeze(confounders),
    critical_data_fresh: criticalDataFresh,
    verification_rate_pct: options.verificationRatePct,
    reversible: options.reversible,
    rollback_trigger: options.rollbackTrigger,
    inside_approved_boundary: options.insideApprovedBoundary,
    reverses_human_decision: options.reversesHumanDecision,
    affected_human_controlled_categories: Object.freeze([...options.affectedHumanControlledCategories]),
    target_effect: "No target change; the approved monthly destination remains fixed.",
    channel_effect: "Recommendation order only; no fixed split and no live cascade.",
    cm_effect: `Forecast ${chain.forecast.expected_cm_inr} INR; measured ${chain.measured_outcome.actual_cm_inr} INR in synthetic shadow evidence.`,
    cash_effect: `Forecast ${chain.forecast.expected_cash_inr} INR; measured ${chain.measured_outcome.actual_cash_inr} INR in synthetic shadow evidence.`,
    materiality_status: "Pending human approval",
    production_confidence: "Low",
    registry_thresholds_approved: false,
    auto_adopt: false,
    eligible_for_shared_learning_gate: rejectionReasons.length === 0,
    rejection_reasons: Object.freeze(rejectionReasons),
  })
}

const syntheticContext: CashControlContext = Object.freeze({
  destinationRef: "protected://destination/jul-2026",
  baselineRef: "protected://baseline/jul-2026",
  evidenceRef: "protected://evidence/cash-control-snapshot",
  approvedMonthlyCmGoalInr: null,
  verifiedBaselineCmInr: 3_600_000,
  churnImpactCmInr: -180_000,
  churnEvidenceRef: "protected://evidence/churn-jul-2026",
  churnSubmittedBy: "protected://actor/finance-ops",
  churnVerifierRef: "protected://verifier/finance-review",
  churnFreshness: "Current",
  observedRamps: Object.freeze([
    Object.freeze({ channelId: "channel-enterprise", expectedCmInr: 600_000, observedCmInr: 520_000, evidenceRef: "protected://evidence/enterprise-ramp", submittedBy: "protected://actor/growth-ops", verifierRef: "protected://verifier/finance-review", dataFreshness: "Current", quarantined: false }),
    Object.freeze({ channelId: "channel-fono", expectedCmInr: 320_000, observedCmInr: 280_000, evidenceRef: "protected://evidence/fono-ramp", submittedBy: "protected://actor/new-adds", verifierRef: "protected://verifier/finance-review", dataFreshness: "Current", quarantined: false }),
  ]),
  opexForecastInr: 5_400_000,
  collectedCashInr: 16_200_000,
  approvedCashTargetInr: null,
  collectionLeakageInr: 800_000,
  claimedClosures: 24,
  verifiedClosures: 18,
  awaitingVerification: 4,
  reopenedClosures: 2,
  missedHourlyCmInr: 90_000,
  remainingHours: 76,
  criticalDataFreshness: "Current",
  submittedBy: "protected://actor/finance-ops",
  verifierRef: "protected://verifier/finance-review",
  quarantined: false,
})

function syntheticLearningInput(): CashControlLearningInput {
  const eventResult = detectCashControlEvent({ eventId: "evt-cash-control-synthetic", occurredAt: CASH_CONTROL_AT, ownerRole: "Pushkar / Finance", dueAt: "2026-07-18T14:00:00+05:30", context: syntheticContext })
  if (eventResult.disposition !== "Admitted") throw new Error(eventResult.reasons.join(" "))
  const decision = decideCashControl(eventResult.event)
  const action = assignCashControlAction(eventResult.event, decision)
  return buildCashControlLearningInput({
    event_id: eventResult.event.eventId,
    action_id: action.actionId,
    policy_version: eventResult.event.policyVersion,
    forecast: { expected_cm_inr: 600_000, expected_cash_inr: 900_000, expected_opex_inr: 120_000, expected_hours: 72 },
    context_snapshot: { destination_ref: syntheticContext.destinationRef, data_freshness: "Current", quarantined: false, approved_goal_present: false },
    decision,
    assigned_action: action,
    evidence: { reference: syntheticContext.evidenceRef, cycles: 3 },
    independent_verification: { verified: true, verifier_ref: "protected://verifier/finance-review", self_verified: false },
    measured_outcome: { actual_cm_inr: 520_000, actual_cash_inr: 840_000, actual_opex_inr: 130_000, intervention_recovered_source_metric: true },
    variance_reason: "Synthetic observed ramp remained below forecast.",
  }, { holdoutOrControl: false, comparisonGroup: false, confounders: [], sampleSize: 8, forecastErrorPct: 13.3, verificationRatePct: 75, reversible: true, rollbackTrigger: "Cash headroom narrows or verified CM underperforms for the next evidence cycle.", insideApprovedBoundary: true, reversesHumanDecision: false, affectedHumanControlledCategories: ["Targets", "Finance", "Cash"] })
}

function inrLakh(value: number) {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value / 100_000)}L`
}

function admittedCashControlEvent(eventId: string, dueAt: string, context: CashControlContext) {
  const result = detectCashControlEvent({ eventId, occurredAt: CASH_CONTROL_AT, ownerRole: "Pushkar / Finance", dueAt, context })
  if (result.disposition !== "Admitted") throw new Error(result.reasons.join(" "))
  return result.event
}

function cashControlTask(event: CashControlEvent, progress: string, verificationInput: CashControlVerificationInput): CashControlTaskPreview {
  const decision = decideCashControl(event)
  const action = assignCashControlAction(event, decision)
  const verification = verifyCashControlClosure(verificationInput)
  return Object.freeze({
    actionId: action.actionId,
    issue: decision.rationale,
    owner: action.ownerRole,
    dueAt: action.dueAt,
    progress,
    expectedVerifiedResult: action.expectedVerifiedResult,
    verifiedResult: verification.canClose ? "Independently verified" : verification.status,
    state: verification.canClose ? "Awaiting verification" : action.state,
    recommendationOnly: action.recommendationOnly,
    engineAction: action,
    verificationInput: Object.freeze({ ...verificationInput }),
  })
}

export function buildCashControlPreview(): CashControlPreview {
  const baseline = deriveVerifiedBaseline(syntheticContext)
  const feasibility = assessCashFeasibility(syntheticContext.opexForecastInr, syntheticContext.collectedCashInr, syntheticContext.approvedCashTargetInr)
  const channels = rankChannelMix([
    { candidateId: "mix-enterprise", channel: "Enterprise readiness", expectedVerifiedCmInr: 600_000, requiredCashInr: 120_000, expectedHoursToOutcome: 72, evidenceRef: "protected://evidence/enterprise-ramp", dataFreshness: "Current", independentlyVerified: true, quarantined: false },
    { candidateId: "mix-fono", channel: "FONO verified fills", expectedVerifiedCmInr: 320_000, requiredCashInr: 80_000, expectedHoursToOutcome: 48, evidenceRef: "protected://evidence/fono-ramp", dataFreshness: "Current", independentlyVerified: true, quarantined: false },
    { candidateId: "mix-stale", channel: "Stale campaign estimate", expectedVerifiedCmInr: 900_000, requiredCashInr: 30_000, expectedHoursToOutcome: 24, evidenceRef: "protected://evidence/stale-campaign", dataFreshness: "Stale", independentlyVerified: false, quarantined: false },
  ])
  const projectionLabel = baseline.verifiedProjectionCmInr === null ? "Unavailable" : inrLakh(baseline.verifiedProjectionCmInr)
  const opexHeadroom = feasibility.opexHeadroomInr === null ? "Unavailable" : inrLakh(feasibility.opexHeadroomInr)
  const cashHeadroom = feasibility.cashHeadroomInr === null ? "Unavailable" : inrLakh(feasibility.cashHeadroomInr)
  const measures: CashControlPreview["measures"] = [
    Object.freeze({ id: "cm-destination" as const, label: "CM destination", value: "Pending approval", target: `Verified projection ${projectionLabel}`, detail: "Gap remains unavailable; no monthly target was invented." }),
    Object.freeze({ id: "opex-control" as const, label: "Opex control", value: "₹54L forecast", target: "₹60L cap", detail: `${opexHeadroom} synthetic headroom.` }),
    Object.freeze({ id: "cash-protection" as const, label: "Cash protection", value: "₹162L collected", target: "₹150L guardrail", detail: `${cashHeadroom} headroom · approved cash target pending.` }),
    Object.freeze({ id: "closure-integrity" as const, label: "Leakage & closure", value: "₹8L leakage", target: "18 verified · 24 claimed", detail: "4 awaiting verification · 2 reopened." }),
  ]
  const pendingVerification: CashControlVerificationInput = Object.freeze({ evidenceRef: null, submittedBy: "protected://actor/finance-ops", verifierRef: "protected://verifier/finance-review", dataFreshness: "Current", measuredOutcomeVerified: false, sourceMetricRecovered: false, claimedActivityOnly: false, quarantined: false })
  const destinationEvent = admittedCashControlEvent("evt-cash-destination", "2026-07-18T14:00:00+05:30", syntheticContext)
  const leakageEvent = admittedCashControlEvent("evt-cash-leakage", "2026-07-18T13:00:00+05:30", Object.freeze({ ...syntheticContext, approvedMonthlyCmGoalInr: 4_800_000, claimedClosures: 18, verifiedClosures: 18, awaitingVerification: 0, reopenedClosures: 0 }))
  const verificationEvent = admittedCashControlEvent("evt-cash-verification", "2026-07-18T12:00:00+05:30", Object.freeze({ ...syntheticContext, approvedMonthlyCmGoalInr: 4_800_000, collectionLeakageInr: 0, claimedClosures: 24, verifiedClosures: 18, awaitingVerification: 4, reopenedClosures: 0 }))
  const recoveryEvent = admittedCashControlEvent("evt-cash-recovery", "2026-07-18T11:00:00+05:30", Object.freeze({ ...syntheticContext, approvedMonthlyCmGoalInr: 4_800_000, collectionLeakageInr: 0, claimedClosures: 18, verifiedClosures: 18, awaitingVerification: 0, reopenedClosures: 2 }))
  const loopHealth = projectLoopHealth({
    domain: "Cash & Control",
    asOf: CASH_CONTROL_AT,
    feeds: [{ feedId: "cash-control-ledger", label: "Cash & Control ledger", lastUpdatedAt: "2026-07-18T09:10:00+05:30", cadenceMinutes: 15, critical: true, affectedClaims: ["CM destination", "cash protection", "closure integrity"] }],
    clocks: [
      { clockId: "cash-destination-clock", label: "Monthly destination approval", ownerRole: "Pushkar", dueAt: destinationEvent.dueAt, state: "Running" },
      { clockId: "cash-verification-clock", label: "Closure verification", ownerRole: "Independent verifier", dueAt: verificationEvent.dueAt, state: "Running" },
    ],
    verification: { claimed: syntheticContext.claimedClosures, verified: syntheticContext.verifiedClosures, awaiting: syntheticContext.awaitingVerification, reopened: syntheticContext.reopenedClosures, oldestAwaitingAt: "2026-07-18T08:00:00+05:30" },
    quarantinedRecords: 0,
    dependentClaims: ["CM destination", "cash protection", "closure integrity"],
    synthetic: true,
  })
  const tasks = Object.freeze([
    cashControlTask(destinationEvent, "Destination evidence pack ready", pendingVerification),
    cashControlTask(leakageEvent, `${inrLakh(syntheticContext.collectionLeakageInr ?? 0)} collection leakage`, pendingVerification),
    cashControlTask(verificationEvent, `${verificationEvent.context.awaitingVerification} closure claims awaiting verification`, pendingVerification),
    cashControlTask(recoveryEvent, `${inrLakh(recoveryEvent.context.missedHourlyCmInr)} missed work requires re-slotting`, pendingVerification),
  ])

  return Object.freeze({
    fixtureLabel: "Synthetic fixture",
    mode: "Shadow only",
    question: CASH_CONTROL_QUESTION,
    source: Object.freeze({ name: "Typed Cash & Control shadow fixture", asOf: CASH_CONTROL_AT, lastRefreshAt: "2026-07-18T09:10:00+05:30", freshness: "Stale" as const, synthetic: true as const }),
    headline: "Protect the ₹150L cash floor while the monthly CM destination awaits approval.",
    summary: Object.freeze({ target: "CM goal pending · cash ≥ ₹150L", current: `${projectionLabel} projected · ₹162L cash`, gap: `CM unavailable · ${cashHeadroom} cash headroom`, owner: "Pushkar / Finance", progress: "24 claimed · 18 verified", verifiedResult: "4 awaiting · 2 reopened" }),
    measures: Object.freeze(measures),
    controlPath: Object.freeze([
      Object.freeze({ id: "destination", label: "Monthly destination", value: "Pending human approval", state: "Pending" as const }),
      Object.freeze({ id: "baseline", label: "Verified baseline", value: `${projectionLabel} after churn and observed ramps`, state: "Complete" as const }),
      Object.freeze({ id: "gap", label: "Remaining gap", value: "Unavailable until destination approval", state: "Pending" as const }),
      Object.freeze({ id: "mix", label: "Channel recommendation", value: `${channels.length} evidence-eligible options ranked`, state: "Complete" as const }),
      Object.freeze({ id: "feasibility", label: "Cash feasibility", value: `${feasibility.status} in synthetic snapshot`, state: "Complete" as const }),
      Object.freeze({ id: "cascade", label: "Cascade", value: "Blocked until approval", state: "Blocked" as const }),
      Object.freeze({ id: "recovery", label: "Hourly recovery", value: "Misses re-slotted; target unchanged", state: "Complete" as const }),
      Object.freeze({ id: "month-close", label: "Month close", value: "Variance pending goal and evidence", state: "Pending" as const }),
    ]),
    financialRails: Object.freeze([
      Object.freeze({ id: "opex" as const, label: "Opex forecast", value: "₹54L", threshold: "₹60L cap", progressPct: 90, state: "Within control" as const }),
      Object.freeze({ id: "cash" as const, label: "Collected cash", value: "₹162L", threshold: "₹150L guardrail", progressPct: 100, state: "Protected" as const }),
    ]),
    closureCounts: Object.freeze({ claimed: 24, verified: 18, awaitingVerification: 4, reopened: 2 }),
    channelRecommendations: channels,
    tasks,
    despatchEscalations: emitCashControlDespatchEscalations(tasks),
    approvals: Object.freeze([
      Object.freeze({ id: "approval-cm-goal", decision: "Approve the monthly CM destination", owner: "Pushkar", impact: "Unlocks the governed remaining-gap and cascade calculation.", status: "Pending human approval" as const }),
      Object.freeze({ id: "approval-cash-target", decision: "Approve the monthly collected-cash target", owner: "Pushkar", impact: "Adds the target above the locked ₹150L minimum guardrail.", status: "Pending human approval" as const }),
    ]),
    learningInputs: Object.freeze([syntheticLearningInput()]),
    policyRegistry: CASH_CONTROL_POLICY_REGISTRY,
    blockedCapabilities: CASH_CONTROL_BLOCKED_CAPABILITIES,
    loopHealth,
  })
}
