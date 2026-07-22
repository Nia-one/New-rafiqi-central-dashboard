import type { SupplyModel } from "@/lib/operating-loop/contracts"
import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation, projectLoopHealth, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"

export const MEMBER_ENGAGEMENT_AT = "2026-07-17T12:00:00+05:30"
export const MEMBER_ENGAGEMENT_QUESTION = "Who is likely to leave, why, and has the cause actually recovered?"

export const MEMBER_ENGAGEMENT_POLICY_REGISTRY = Object.freeze([
  Object.freeze({ policyId: "POL-RETENTION-M6-FLOOR", value: 65, unit: "percent", version: 1, status: "Active", approvedBy: "Operating brief", effectiveFrom: "2026-07-17" }),
  Object.freeze({ policyId: "POL-MONTHLY-CHURN-CONTROL", value: 6, unit: "percent", version: 1, status: "Active", approvedBy: "Operating brief", effectiveFrom: "2026-07-17" }),
  Object.freeze({ policyId: "POL-WEEKLY-UNREAD-WEAK-SIGNAL", value: 3, unit: "weeks", version: 1, status: "Active", approvedBy: "Operating brief", effectiveFrom: "2026-07-17" }),
] as const)

export const MEMBER_ENGAGEMENT_BLOCKED_CAPABILITIES = Object.freeze({
  productionWrites: false,
  liveMemberContact: false,
  externalMessages: false,
  liveWeeklyMessage: false,
  autoPolicyChange: false,
  autoAdoption: false,
  employmentDecision: false,
  pricingOrCommercialChange: false,
})

export const LEARNING_CHAIN_FIELDS = Object.freeze([
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

export type MemberSignal =
  | "Service request past SLA"
  | "Recurring service request"
  | "Second incident"
  | "Usage decline"
  | "Payment or wage-cycle disruption"
  | "Migration boundary near"
  | "Verified savings decline"
  | "Membership end without reason"
  | "Unread weekly messages"

export type RecoverableCause = "Savings down" | "Friction up"
export type AttributionGrade = "Controlled" | "Compared" | "Observed"
export type ProductionConfidence = "Low"
export type HumanControlledCategory = "Pricing" | "Commercial terms" | "Templates" | "People decisions" | "Safety"

export type ServiceRequestInput = {
  requestId: string
  pastSla: boolean
  recurrenceCount: number
  resolved: boolean
  reopened: boolean
}

export type MemberEngagementContext = {
  eventId: string
  memberRef: string
  supplyModel: SupplyModel | null
  theatre: string
  studio: string
  tenureMonths: number
  ownerRole: string
  dueAt: string
  cohortName: string
  cohortM6RetentionPct: number
  essentialsUsageCurrent: number
  essentialsUsageBaseline: number
  curryUsageCurrent: number
  curryUsageBaseline: number
  verifiedSavingsCurrentInr: number | null
  verifiedSavingsBaselineInr: number | null
  serviceRequests: readonly ServiceRequestInput[]
  incidentCount: number
  paymentOrWageCycleDisruption: boolean
  nearMigrationBoundary: boolean
  membershipEnded: boolean
  verifiedExitReason: string | null
  unreadWeeklyMessages: number
  billingContinuityEvidenced: boolean
  repeatedFranchisePattern: boolean
  theatreWideDeterioration: boolean
  urgentMemberReply: boolean
  updatedAt: string
  rawPhone?: unknown
  rawConversation?: unknown
}

export type DetectedMemberEvent = {
  eventId: string
  disposition: "Action required" | "Monitor only" | "Quarantined" | "No trigger"
  signals: readonly MemberSignal[]
  strongSignals: readonly MemberSignal[]
  weakSignals: readonly MemberSignal[]
  reasons: readonly string[]
}

export type RetentionDecision = {
  decisionId: string
  cause: RecoverableCause
  rationale: string
  confidence: "Moderate" | "High"
}

export type RetentionAction = {
  actionId: string
  eventId: string
  memberRef: string
  actionType: "Retention recovery" | "Exit-reason capture"
  cause: RecoverableCause
  ownerRole: string
  dueAt: string
  expectedRecovery: string
  state: "Open" | "Reopened"
  priority: "Standard" | "High"
  idempotencyKey: string
  externalEffect: false
}

export type VerificationInput = {
  evidenceRef: string | null
  submittedBy: string
  verifierId: string | null
  evidenceFresh: boolean
  sourceSignalRecovered: boolean
  requestResolvedAndNotReopened: boolean
  billingContinuityEvidenced: boolean
  note: string
}

export type VerificationResult = {
  status: "Verified recovered" | "Awaiting evidence" | "Rejected" | "Reopened"
  canClose: boolean
  reasons: readonly string[]
}

export type RecoveryRoute = {
  state: "Open" | "Reopened" | "Routed"
  priority: "Standard" | "High"
  routeTo: string
  reason: string
}

export type MemberEscalation = { level: string; owner: string; reason: string }

export type WeeklyMessageInput = {
  templateApproved: boolean
  hasVerifiedSpendOrSavings: boolean
  approvedNonNumericalCheck: boolean
  languageConfirmed: boolean
  consentConfirmed: boolean
  optOutAvailable: boolean
  withinQuietHoursPolicy: boolean
  containsFreeFormText: boolean
  containsPromotionOrOffer: boolean
}

export type WeeklyMessageDecision = {
  eligibleForFutureLiveEnablement: boolean
  mode: "Shadow only"
  sent: false
  reasons: readonly string[]
}

export type LearningChain = {
  event_id: string
  action_id: string
  policy_version: string
  forecast: { retention_probability_pct: number; expected_recovery_days: number }
  context_snapshot: { member_ref: string; theatre: string; studio: string; supply_model: SupplyModel; freshness: "Fresh" | "Stale" }
  decision: RetentionDecision
  assigned_action: RetentionAction
  evidence: { reference: string; cycles: number }
  independent_verification: { verifier_ref: string; verified: boolean; self_verified: boolean }
  measured_outcome: { retained: boolean; source_metric_recovered: boolean; actual_recovery_days: number }
  variance_reason: string
}

export type MemberEngagementLearningInput = {
  domain: "Member Engagement"
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
  production_confidence: ProductionConfidence
  registry_thresholds_approved: false
  auto_adopt: false
  eligible_for_shared_learning_gate: boolean
  rejection_reasons: readonly string[]
}

export type MemberEngagementMeasure = {
  id: "m6-retention" | "monthly-churn" | "exit-reasons" | "at-risk-recovery"
  label: string
  value: string
  target: string
  detail: string
}

export type RetentionCurve = {
  cohort: string
  values: readonly (number | null)[]
  memberCount: number
}

export type MemberEngagementTask = {
  actionId: string
  memberLabel: string
  cause: RecoverableCause
  ownerRole: string
  dueAt: string
  progress: string
  verifiedResult: string
  state: "Open" | "Reopened" | "Awaiting verification" | "Routed" | "Verified recovered"
  priority: RetentionAction["priority"]
  recoveryRoute: string
}

export type MemberEngagementShadowOutcome = "Unresolved" | "Recurring request" | "Systemic pattern" | "Recovery evidence received"

export type MemberEngagementShadowTransition = {
  task: MemberEngagementTask
  verification: VerificationResult
  route: string
}

export type MemberEngagementPreview = {
  mode: "Shadow only"
  fixtureLabel: "Synthetic fixture"
  question: typeof MEMBER_ENGAGEMENT_QUESTION
  source: { name: string; asOf: string; lastRefreshAt: string; freshness: "Stale"; synthetic: true }
  headline: string
  summary: { target: string; current: string; gap: string; owner: string; progress: string; verifiedResult: string }
  measures: readonly MemberEngagementMeasure[]
  retentionCurves: readonly RetentionCurve[]
  tasks: readonly MemberEngagementTask[]
  despatchEscalations: readonly DespatchEscalationRecord[]
  loopHealth: LoopHealth
  exitReasonMovements: readonly { reason: string; current: number; baseline: number }[]
  npsDrilldown: { survey: { score: number; method: string; inputs: string }; behavioural: { score: number; method: string; inputs: string }; gap: number }
  learningInputs: readonly MemberEngagementLearningInput[]
  quarantinedCount: number
  policyRegistry: typeof MEMBER_ENGAGEMENT_POLICY_REGISTRY
  blockedCapabilities: typeof MEMBER_ENGAGEMENT_BLOCKED_CAPABILITIES
}

function protectedMemberReference(value: string) {
  return value.startsWith("protected://member/")
}

function stableId(prefix: string, value: string) {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `${prefix}-${(hash >>> 0).toString(36)}`
}

export function detectMemberEngagementEvent(context: MemberEngagementContext): DetectedMemberEvent {
  const reasons: string[] = []
  if (!protectedMemberReference(context.memberRef)) reasons.push("Member identity must remain behind a protected role-gated reference.")
  if (context.rawPhone !== undefined || context.rawConversation !== undefined) reasons.push("Raw phone or conversation data is prohibited in this domain input.")
  if (context.supplyModel !== "FONO" && context.supplyModel !== "SP") reasons.push("A governed supply_model is required; it is never inferred.")
  if (reasons.length > 0) return Object.freeze({ eventId: context.eventId, disposition: "Quarantined" as const, signals: Object.freeze([]), strongSignals: Object.freeze([]), weakSignals: Object.freeze([]), reasons: Object.freeze(reasons) })

  const strongSignals: MemberSignal[] = []
  if (context.serviceRequests.some((request) => request.pastSla)) strongSignals.push("Service request past SLA")
  if (context.serviceRequests.some((request) => request.recurrenceCount > 1)) strongSignals.push("Recurring service request")
  if (context.incidentCount >= 2) strongSignals.push("Second incident")
  if (context.essentialsUsageCurrent < context.essentialsUsageBaseline || context.curryUsageCurrent < context.curryUsageBaseline) strongSignals.push("Usage decline")
  if (context.paymentOrWageCycleDisruption) strongSignals.push("Payment or wage-cycle disruption")
  if (context.nearMigrationBoundary) strongSignals.push("Migration boundary near")
  if (context.verifiedSavingsCurrentInr !== null && context.verifiedSavingsBaselineInr !== null && context.verifiedSavingsCurrentInr < context.verifiedSavingsBaselineInr) strongSignals.push("Verified savings decline")
  if (context.membershipEnded && !context.verifiedExitReason) strongSignals.push("Membership end without reason")
  const weakSignals: MemberSignal[] = context.unreadWeeklyMessages >= 3 ? ["Unread weekly messages"] : []
  const signals = Object.freeze([...strongSignals, ...weakSignals])
  if (strongSignals.length === 0 && weakSignals.length > 0) return Object.freeze({ eventId: context.eventId, disposition: "Monitor only" as const, signals, strongSignals: Object.freeze([]), weakSignals: Object.freeze(weakSignals), reasons: Object.freeze(["Unread messages are weak evidence and cannot independently trigger an adverse action."]) })
  if (strongSignals.length === 0) return Object.freeze({ eventId: context.eventId, disposition: "No trigger" as const, signals, strongSignals: Object.freeze([]), weakSignals: Object.freeze(weakSignals), reasons: Object.freeze([]) })
  return Object.freeze({ eventId: context.eventId, disposition: "Action required" as const, signals, strongSignals: Object.freeze(strongSignals), weakSignals: Object.freeze(weakSignals), reasons: Object.freeze(["At least one governed recoverable signal requires action."]) })
}

export function decideRecoverableCause(context: MemberEngagementContext, detected = detectMemberEngagementEvent(context)): RetentionDecision | null {
  if (detected.disposition !== "Action required") return null
  const savingsEvidence = detected.strongSignals.filter((signal) => signal === "Verified savings decline" || signal === "Payment or wage-cycle disruption").length
  const frictionEvidence = detected.strongSignals.filter((signal) => ["Service request past SLA", "Recurring service request", "Second incident", "Usage decline", "Migration boundary near"].includes(signal)).length
  const cause: RecoverableCause = savingsEvidence > frictionEvidence ? "Savings down" : "Friction up"
  return Object.freeze({
    decisionId: stableId("decision", `${context.eventId}:${cause}`),
    cause,
    rationale: cause === "Savings down" ? "Verified savings or wage-cycle evidence is the strongest recoverable cause." : "Verified service, incident or own-baseline usage evidence is the strongest recoverable cause.",
    confidence: Math.max(savingsEvidence, frictionEvidence) > 1 ? "High" : "Moderate",
  })
}

export function assignRetentionAction(context: MemberEngagementContext, decision: RetentionDecision): RetentionAction {
  const recurringUnresolved = context.serviceRequests.some((request) => request.recurrenceCount > 1 && (!request.resolved || request.reopened))
  const actionType = context.membershipEnded && !context.verifiedExitReason ? "Exit-reason capture" : "Retention recovery"
  const idempotencyKey = `member-engagement:${context.eventId}:${actionType}`
  return Object.freeze({
    actionId: stableId("action", idempotencyKey),
    eventId: context.eventId,
    memberRef: context.memberRef,
    actionType,
    cause: decision.cause,
    ownerRole: context.ownerRole,
    dueAt: context.dueAt,
    expectedRecovery: decision.cause === "Savings down" ? "Verified savings trend or billing continuity recovers." : "Source signal recovers and any request resolves without reopening.",
    state: recurringUnresolved ? "Reopened" : "Open",
    priority: recurringUnresolved ? "High" : "Standard",
    idempotencyKey,
    externalEffect: false,
  })
}

function protectedEvidence(value: string | null) {
  return Boolean(value?.startsWith("protected://evidence/"))
}

export function verifyRetentionRecovery(input: VerificationInput): VerificationResult {
  const reasons: string[] = []
  if (!protectedEvidence(input.evidenceRef)) reasons.push("Protected evidence is required.")
  if (!input.verifierId) reasons.push("An independent verifier is required.")
  if (input.verifierId && input.verifierId === input.submittedBy) reasons.push("Self-verification cannot close a retention action.")
  if (!input.evidenceFresh) reasons.push("Stale evidence reopens the action.")
  const recovered = input.sourceSignalRecovered || input.requestResolvedAndNotReopened || input.billingContinuityEvidenced
  if (!recovered) reasons.push("The source signal, non-reopened request or billing continuity has not recovered.")
  if (/spoke to member/i.test(input.note) && !recovered) reasons.push("Speaking to a Member is not a verified outcome.")
  if (reasons.length === 0) return Object.freeze({ status: "Verified recovered" as const, canClose: true, reasons: Object.freeze([]) })
  if (!input.evidenceFresh) return Object.freeze({ status: "Reopened" as const, canClose: false, reasons: Object.freeze(reasons) })
  if (!protectedEvidence(input.evidenceRef) || !input.verifierId || input.verifierId === input.submittedBy) return Object.freeze({ status: "Rejected" as const, canClose: false, reasons: Object.freeze(reasons) })
  return Object.freeze({ status: "Awaiting evidence" as const, canClose: false, reasons: Object.freeze(reasons) })
}

export function recoverMemberEngagement(context: MemberEngagementContext): RecoveryRoute {
  const recurring = context.serviceRequests.some((request) => request.recurrenceCount > 1 && (!request.resolved || request.reopened))
  const systemic = context.theatreWideDeterioration || context.repeatedFranchisePattern
  if (systemic) return Object.freeze({ state: "Routed" as const, priority: "High" as const, routeTo: context.theatreWideDeterioration ? "Theatre performance loop" : "Franchise review loop", reason: "Systemic patterns route to the loop that owns the source metric." })
  if (recurring) return Object.freeze({ state: "Reopened" as const, priority: "High" as const, routeTo: context.ownerRole, reason: "A recurring unresolved request reopens at higher priority." })
  return Object.freeze({ state: "Open" as const, priority: "Standard" as const, routeTo: context.ownerRole, reason: "Unresolved evidence remains open with the Member's EAE." })
}

export function recoverMemberEngagementTask(task: MemberEngagementTask, outcome: MemberEngagementShadowOutcome): MemberEngagementShadowTransition {
  const verification = verifyRetentionRecovery(outcome === "Recovery evidence received" ? {
    evidenceRef: `protected://evidence/${task.actionId}`,
    submittedBy: task.ownerRole,
    verifierId: "Independent Retention Verifier",
    evidenceFresh: true,
    sourceSignalRecovered: true,
    requestResolvedAndNotReopened: true,
    billingContinuityEvidenced: false,
    note: "Synthetic source recovery evidence independently checked.",
  } : outcome === "Recurring request" ? {
    evidenceRef: `protected://evidence/${task.actionId}`,
    submittedBy: task.ownerRole,
    verifierId: "Independent Retention Verifier",
    evidenceFresh: true,
    sourceSignalRecovered: false,
    requestResolvedAndNotReopened: false,
    billingContinuityEvidenced: false,
    note: "Recurring request remains unresolved.",
  } : {
    evidenceRef: null,
    submittedBy: task.ownerRole,
    verifierId: null,
    evidenceFresh: true,
    sourceSignalRecovered: false,
    requestResolvedAndNotReopened: false,
    billingContinuityEvidenced: false,
    note: "No verified recovery evidence submitted.",
  })

  if (verification.canClose) {
    const route = "Independent recovery verified in local shadow state; no Production closure was written."
    return Object.freeze({ task: Object.freeze({ ...task, state: "Verified recovered" as const, progress: "Independent verification complete", verifiedResult: verification.status, recoveryRoute: route }), verification, route })
  }
  if (outcome === "Recurring request") {
    const route = "Reopened at higher priority with the assigned EAE."
    return Object.freeze({ task: Object.freeze({ ...task, state: "Reopened" as const, priority: "High" as const, progress: outcome, verifiedResult: verification.status, recoveryRoute: route }), verification, route })
  }
  if (outcome === "Systemic pattern") {
    const route = "Routed to the owning source-metric loop; this action remains open."
    return Object.freeze({ task: Object.freeze({ ...task, state: "Routed" as const, priority: "High" as const, progress: outcome, verifiedResult: verification.status, recoveryRoute: route }), verification, route })
  }
  const route = task.recoveryRoute
  return Object.freeze({ task: Object.freeze({ ...task, progress: outcome, verifiedResult: verification.status }), verification, route })
}

export function buildMemberEscalations(context: MemberEngagementContext): readonly MemberEscalation[] {
  const escalations: MemberEscalation[] = []
  if (context.cohortM6RetentionPct < 65) escalations.push({ level: "Studio", owner: "Theatre lead", reason: "Studio cohort is below the 65% M6 floor." })
  if (context.repeatedFranchisePattern) escalations.push({ level: "Franchise", owner: "Pushkar", reason: "Repeated franchise pattern requires review." })
  if (context.theatreWideDeterioration) escalations.push({ level: "Theatre", owner: "CEO/COO", reason: "Theatre-wide deterioration requires executive attention." })
  if (context.urgentMemberReply) escalations.push({ level: "Urgent", owner: "Human safety/service queue", reason: "Urgent Member reply always routes to a human." })
  return Object.freeze(escalations)
}

export function emitMemberEngagementDespatchEscalations(context: MemberEngagementContext, action: RetentionAction, at = MEMBER_ENGAGEMENT_AT): readonly DespatchEscalationRecord[] {
  return Object.freeze(buildMemberEscalations(context).map((row, index) => createDespatchEscalation({
    escalationId: `${stableId("esc", `${context.eventId}:${row.level}:${row.owner}`)}-${index + 1}`,
    domain: "Member Engagement",
    sourceActionId: action.actionId,
    sourceEventId: context.eventId,
    title: row.reason,
    reason: row.reason,
    ownerRole: row.owner,
    dueAt: context.dueAt,
    raisedAt: at,
    severity: row.level === "Urgent" ? "Critical" : Date.parse(context.dueAt) < Date.parse(at) ? "Breach" : "Attention",
    status: "Open",
    evidenceRefs: [`protected://member-engagement/escalation/${context.eventId}`],
    synthetic: true,
  })))
}

export function projectMemberEngagementLoopHealth(tasks: readonly MemberEngagementTask[], quarantinedRecords: number, asOf = MEMBER_ENGAGEMENT_AT): LoopHealth {
  const verified = tasks.filter((task) => task.state === "Verified recovered").length
  const awaiting = tasks.length - verified
  return projectLoopHealth({
    domain: "Member Engagement",
    asOf,
    feeds: [
      { feedId: "member-engagement-signals", label: "Member recovery signals", lastUpdatedAt: "2026-07-17T09:30:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["at-risk-recovery", "m6-retention"] },
      { feedId: "member-engagement-billing", label: "Billing continuity", lastUpdatedAt: "2026-07-17T11:45:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["monthly-churn", "m6-retention"] },
    ],
    clocks: tasks.map((task) => ({ clockId: `clock-${task.actionId}`, label: `${task.memberLabel} recovery`, ownerRole: task.ownerRole, dueAt: task.dueAt, state: task.state === "Verified recovered" ? "Recovered" : "Running" })),
    verification: { claimed: tasks.length, verified, awaiting, reopened: tasks.filter((task) => task.state === "Reopened").length, oldestAwaitingAt: awaiting > 0 ? "2026-07-17T09:00:00+05:30" : null },
    quarantinedRecords,
    dependentClaims: ["m6-retention", "monthly-churn", "exit-reasons", "at-risk-recovery"],
    synthetic: true,
  })
}

export function evaluateWeeklyMessage(input: WeeklyMessageInput): WeeklyMessageDecision {
  const reasons: string[] = []
  if (!input.templateApproved) reasons.push("Approved template required.")
  if (!input.hasVerifiedSpendOrSavings && !input.approvedNonNumericalCheck) reasons.push("Use verified numbers or an approved non-numerical check.")
  if (!input.languageConfirmed) reasons.push("Language confirmation required.")
  if (!input.consentConfirmed) reasons.push("Consent required.")
  if (!input.optOutAvailable) reasons.push("Opt-out must be available.")
  if (!input.withinQuietHoursPolicy) reasons.push("Quiet-hours policy blocks this preview.")
  if (input.containsFreeFormText) reasons.push("Free-form text is prohibited.")
  if (input.containsPromotionOrOffer) reasons.push("Promotions and offers are prohibited.")
  return Object.freeze({ eligibleForFutureLiveEnablement: reasons.length === 0, mode: "Shadow only" as const, sent: false as const, reasons: Object.freeze(reasons) })
}

export function buildMemberEngagementLearningInput(chain: LearningChain, options: {
  holdoutOrControl: boolean
  comparisonCohort: boolean
  confounders: readonly string[]
  sampleSize: number
  forecastErrorPct: number
  verificationRatePct: number
  affectedHumanControlledCategories?: readonly HumanControlledCategory[]
  insideApprovedBoundary?: boolean
  reversesHumanDecision?: boolean
}): MemberEngagementLearningInput {
  const attributionGrade: AttributionGrade = options.holdoutOrControl ? "Controlled" : options.comparisonCohort ? "Compared" : "Observed"
  const confounders = attributionGrade === "Observed" && options.confounders.length === 0 ? Object.freeze(["confounders not ruled out"]) : Object.freeze([...options.confounders])
  const rejectionReasons: string[] = []
  if (chain.context_snapshot.freshness !== "Fresh") rejectionReasons.push("Critical context is stale.")
  if (!chain.independent_verification.verified) rejectionReasons.push("Closure is unverified.")
  if (chain.independent_verification.self_verified) rejectionReasons.push("Self-verification is excluded from learning.")
  if (!protectedMemberReference(chain.context_snapshot.member_ref)) rejectionReasons.push("Member context is not protected.")
  const categories = Object.freeze([...(options.affectedHumanControlledCategories ?? [])])
  return Object.freeze({
    domain: "Member Engagement" as const,
    event_id: chain.event_id,
    action_id: chain.action_id,
    proposed_change: "Re-rank eligible retention interventions by verified recovery speed within current policy bounds.",
    expected_effect: "Improve verified recovery before the next cohort checkpoint without changing human-controlled policy.",
    evidence_cycles: chain.evidence.cycles,
    sample_size: options.sampleSize,
    forecast_error_pct: options.forecastErrorPct,
    attribution_grade: attributionGrade,
    confounders,
    critical_data_fresh: chain.context_snapshot.freshness === "Fresh",
    verification_rate_pct: options.verificationRatePct,
    reversible: true,
    rollback_trigger: "Rollback the proposed ranking if verified M6 retention worsens or verification rate falls.",
    inside_approved_boundary: options.insideApprovedBoundary ?? true,
    reverses_human_decision: options.reversesHumanDecision ?? false,
    affected_human_controlled_categories: categories,
    target_effect: "M6 retention recovery versus the approved 65% floor.",
    channel_effect: "No channel or message activation; intervention ranking only.",
    cm_effect: "Not quantified in this domain; no invented CM effect.",
    cash_effect: "No direct cash action or commitment.",
    production_confidence: "Low" as const,
    registry_thresholds_approved: false as const,
    auto_adopt: false as const,
    eligible_for_shared_learning_gate: rejectionReasons.length === 0,
    rejection_reasons: Object.freeze(rejectionReasons),
  })
}

function memberEngagementFixtureContext(overrides: Partial<MemberEngagementContext>): MemberEngagementContext {
  return {
    eventId: "evt-retention-fixture",
    memberRef: "protected://member/C-041",
    supplyModel: "FONO",
    theatre: "Chennai South",
    studio: "Coromandel Cluster",
    tenureMonths: 5,
    ownerRole: "Coromandel Retention EAE",
    dueAt: "2026-07-17T15:00:00+05:30",
    cohortName: "Jan 2026",
    cohortM6RetentionPct: 64,
    essentialsUsageCurrent: 8,
    essentialsUsageBaseline: 8,
    curryUsageCurrent: 5,
    curryUsageBaseline: 5,
    verifiedSavingsCurrentInr: 1700,
    verifiedSavingsBaselineInr: 1700,
    serviceRequests: Object.freeze([{ requestId: "protected-request-041", pastSla: true, recurrenceCount: 1, resolved: false, reopened: false }]),
    incidentCount: 0,
    paymentOrWageCycleDisruption: false,
    nearMigrationBoundary: false,
    membershipEnded: false,
    verifiedExitReason: null,
    unreadWeeklyMessages: 0,
    billingContinuityEvidenced: false,
    repeatedFranchisePattern: false,
    theatreWideDeterioration: false,
    urgentMemberReply: false,
    updatedAt: "2026-07-17T11:45:00+05:30",
    ...overrides,
  }
}

function projectMemberEngagementTask(context: MemberEngagementContext, action: RetentionAction, verification: VerificationResult): MemberEngagementTask {
  const recovery = recoverMemberEngagement(context)
  const state: MemberEngagementTask["state"] = verification.status === "Verified recovered" ? "Verified recovered"
    : verification.status === "Reopened" ? "Reopened"
      : verification.status === "Awaiting evidence" ? "Awaiting verification"
        : recovery.state
  const protectedLabel = context.memberRef.split("/").at(-1) ?? "Protected"
  return Object.freeze({
    actionId: action.actionId,
    memberLabel: `Protected Member · ${protectedLabel}`,
    cause: action.cause,
    ownerRole: action.ownerRole,
    dueAt: action.dueAt,
    progress: verification.status === "Awaiting evidence" ? "Source recovery evidence pending" : verification.status === "Reopened" ? recovery.reason : action.expectedRecovery,
    verifiedResult: verification.status,
    state,
    priority: recovery.priority,
    recoveryRoute: recovery.reason,
  })
}

function buildMemberEngagementFixtureWork() {
  const contexts = Object.freeze([
    memberEngagementFixtureContext({ eventId: "evt-retention-041", memberRef: "protected://member/C-041" }),
    memberEngagementFixtureContext({ eventId: "evt-retention-076", memberRef: "protected://member/C-076", dueAt: "2026-07-17T16:00:00+05:30", serviceRequests: Object.freeze([]), verifiedSavingsCurrentInr: 1200 }),
    memberEngagementFixtureContext({ eventId: "evt-retention-103", memberRef: "protected://member/C-103", dueAt: "2026-07-17T17:00:00+05:30", serviceRequests: Object.freeze([{ requestId: "protected-request-103", pastSla: true, recurrenceCount: 2, resolved: false, reopened: true }]) }),
  ])
  const work = contexts.map((context, index) => {
    const detected = detectMemberEngagementEvent(context)
    const decision = decideRecoverableCause(context, detected)
    if (!decision) throw new Error(`Synthetic Member Engagement fixture ${context.eventId} must create a decision.`)
    const action = assignRetentionAction(context, decision)
    const verification = verifyRetentionRecovery(index === 0 ? {
      evidenceRef: `protected://evidence/${context.eventId}`, submittedBy: context.ownerRole, verifierId: "Independent Retention Verifier", evidenceFresh: true,
      sourceSignalRecovered: false, requestResolvedAndNotReopened: false, billingContinuityEvidenced: false, note: "Source signal still open.",
    } : index === 2 ? {
      evidenceRef: `protected://evidence/${context.eventId}`, submittedBy: context.ownerRole, verifierId: "Independent Retention Verifier", evidenceFresh: false,
      sourceSignalRecovered: false, requestResolvedAndNotReopened: false, billingContinuityEvidenced: false, note: "Recurring request evidence is stale.",
    } : {
      evidenceRef: null, submittedBy: context.ownerRole, verifierId: null, evidenceFresh: true,
      sourceSignalRecovered: false, requestResolvedAndNotReopened: false, billingContinuityEvidenced: false, note: "Billing continuity evidence not yet submitted.",
    })
    return Object.freeze({ context, action, task: projectMemberEngagementTask(context, action, verification) })
  })
  const tasks = Object.freeze(work.map((row) => row.task))
  return Object.freeze({
    tasks,
    despatchEscalations: Object.freeze(work.flatMap((row) => emitMemberEngagementDespatchEscalations(row.context, row.action)).slice(0, 5)),
  })
}

export function buildMemberEngagementPreview(): MemberEngagementPreview {
  const fixtureWork = buildMemberEngagementFixtureWork()
  const chain = Object.freeze<LearningChain>({
    event_id: "evt-retention-004",
    action_id: "action-retention-004",
    policy_version: "member-engagement-v1",
    forecast: { retention_probability_pct: 72, expected_recovery_days: 5 },
    context_snapshot: { member_ref: "protected://member/cohort-token-004", theatre: "Chennai South", studio: "Coromandel Cluster", supply_model: "FONO" as const, freshness: "Fresh" as const },
    decision: { decisionId: "decision-retention-004", cause: "Friction up", rationale: "Recurring service evidence is strongest.", confidence: "High" },
    assigned_action: { actionId: "action-retention-004", eventId: "evt-retention-004", memberRef: "protected://member/cohort-token-004", actionType: "Retention recovery", cause: "Friction up", ownerRole: "Coromandel Retention EAE", dueAt: "2026-07-17T17:00:00+05:30", expectedRecovery: "Request resolved without reopening.", state: "Open", priority: "High", idempotencyKey: "member-engagement:evt-retention-004:Retention recovery", externalEffect: false },
    evidence: { reference: "protected://evidence/retention-cycle-004", cycles: 3 },
    independent_verification: { verifier_ref: "protected://verifier/qa-12", verified: true, self_verified: false },
    measured_outcome: { retained: true, source_metric_recovered: true, actual_recovery_days: 6 },
    variance_reason: "Recovery took one day longer after a reopened service request.",
  })
  const learningInput = buildMemberEngagementLearningInput(chain, { holdoutOrControl: false, comparisonCohort: false, confounders: [], sampleSize: 14, forecastErrorPct: 8, verificationRatePct: 83 })
  return Object.freeze({
    mode: "Shadow only" as const,
    fixtureLabel: "Synthetic fixture" as const,
    question: MEMBER_ENGAGEMENT_QUESTION,
    source: Object.freeze({ name: "Synthetic Member Engagement fixture", asOf: "2026-07-17T11:45:00+05:30", lastRefreshAt: "2026-07-17T11:45:00+05:30", freshness: "Stale" as const, synthetic: true as const }),
    headline: "Recover the verified friction cause for 4 Coromandel Members before the next M6 check.",
    summary: Object.freeze({ target: "65% M6", current: "64% M6", gap: "1 pp", owner: "Coromandel Retention EAE", progress: "14/18 assigned", verifiedResult: "7 recovered" }),
    measures: Object.freeze([
      Object.freeze({ id: "m6-retention" as const, label: "M6 retention", value: "64%", target: "65% floor", detail: "Jan 2026 · Coromandel cohort" }),
      Object.freeze({ id: "monthly-churn" as const, label: "Monthly churn", value: "6.8%", target: "6% control", detail: "0.8 pp above control" }),
      Object.freeze({ id: "exit-reasons" as const, label: "Verified exit reasons", value: "11/14", target: "3 awaiting", detail: "Service friction +2 vs baseline" }),
      Object.freeze({ id: "at-risk-recovery" as const, label: "At-risk recovery", value: "7/18", target: "14 interventions", detail: "4 awaiting independent verification" }),
    ]),
    retentionCurves: Object.freeze([
      Object.freeze({ cohort: "Jan 2026", values: Object.freeze([100, 91, 84, 78, 73, 69, 64]), memberCount: 52 }),
      Object.freeze({ cohort: "Feb 2026", values: Object.freeze([100, 92, 86, 81, 76, 72, 68]), memberCount: 48 }),
      Object.freeze({ cohort: "Mar 2026", values: Object.freeze([100, 93, 88, 83, 79, null, null]), memberCount: 57 }),
    ]),
    tasks: fixtureWork.tasks,
    despatchEscalations: fixtureWork.despatchEscalations,
    loopHealth: projectMemberEngagementLoopHealth(fixtureWork.tasks, 2),
    exitReasonMovements: Object.freeze([
      Object.freeze({ reason: "Service friction", current: 5, baseline: 3 }),
      Object.freeze({ reason: "Work migration", current: 3, baseline: 4 }),
      Object.freeze({ reason: "Savings pressure", current: 3, baseline: 2 }),
    ]),
    npsDrilldown: Object.freeze({
      survey: Object.freeze({ score: 41, method: "Approved survey responses only", inputs: "32 role-gated responses · no free-form conversation shown" }),
      behavioural: Object.freeze({ score: 34, method: "Composite of own-baseline usage and verified service recovery", inputs: "57 protected Member records · 6-week observation window" }),
      gap: 7,
    }),
    learningInputs: Object.freeze([learningInput]),
    quarantinedCount: 2,
    policyRegistry: MEMBER_ENGAGEMENT_POLICY_REGISTRY,
    blockedCapabilities: MEMBER_ENGAGEMENT_BLOCKED_CAPABILITIES,
  })
}
