import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation, projectLoopHealth, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"

export const MEMBER_SAVINGS_AT = "2026-07-17T15:00:00+05:30"
export const MEMBER_SAVINGS_QUESTION = "Are Members saving money on services that also make Nia margin?"

export const MEMBER_SAVINGS_POLICY_REGISTRY = Object.freeze([
  Object.freeze({ policyId: "POL-MEMBER-SAVINGS-GATE", name: "Minimum verified Member savings", value: 0, unit: "INR; must be greater than", version: 1, effectiveAt: "2026-07-17", status: "Active", approver: "Sachin", source: "Locked Member Savings dual gate" }),
  Object.freeze({ policyId: "POL-NIA-MARGIN-GATE", name: "Minimum verified Nia unit margin", value: 0, unit: "INR; must be greater than", version: 1, effectiveAt: "2026-07-17", status: "Active", approver: "Sachin", source: "Locked Member Savings dual gate" }),
  Object.freeze({ policyId: "POL-SAVINGS-PEER-BAND-METHOD", name: "Studio peer-band methodology", value: null, unit: "method", version: 1, effectiveAt: "2026-07-17", status: "Pending human approval", approver: "Pending", source: "No governed method supplied; shadow comparison only" }),
  Object.freeze({ policyId: "POL-SAVINGS-REPEAT-MATERIALITY", name: "Repeat-decline materiality", value: null, unit: "percentage points", version: 1, effectiveAt: "2026-07-17", status: "Pending human approval", approver: "Pending", source: "No governed materiality threshold supplied" }),
  Object.freeze({ policyId: "POL-SAVINGS-LEARNING-CONFIDENCE", name: "Production learning confidence thresholds", value: null, unit: "registry", version: 1, effectiveAt: "2026-07-17", status: "Pending human approval", approver: "Pending", source: "Shared learning gate owns approval" }),
] as const)

export const MEMBER_SAVINGS_BLOCKED_CAPABILITIES = Object.freeze({
  productionWrites: false,
  liveMemberMessages: false,
  priceChanges: false,
  supplierActions: false,
  supplierContracts: false,
  moneyMovement: false,
  externalCalls: false,
  serviceDelisting: false,
  autoAdoption: false,
})

export const MEMBER_SAVINGS_LEARNING_CHAIN_FIELDS = Object.freeze([
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
export type PeerBandStatus = "Approved" | "Pending human approval"
export type SavingsTrigger = "Low attach versus peer band" | "Repeat decline versus own baseline" | "Verified savings erosion" | "Stockout or fulfilment failure" | "Dual-gate failure"
export type SavingsDecisionKind = "EAE/JOGO activation" | "Replenishment" | "Repricing proposal" | "Supplier/service review"
export type AttributionGrade = "Controlled" | "Compared" | "Observed"
export type HumanControlledCategory = "Pricing" | "Supplier contracts" | "Member messaging" | "Cash" | "Commercial terms" | "People decisions" | "Safety"

export type StudioPeerBand = {
  floorPct: number | null
  ceilingPct: number | null
  status: PeerBandStatus
  version: number
  source: string
}

export type SavingsServiceContext = {
  theatre: string
  studio: string
  serviceName: string
  serviceRef: string
  supplierRef: string
  marketReferenceRef: string
  evidenceRef: string
  memberPriceInr: number
  marketReferenceInr: number
  priorVerifiedSavingsInr: number
  actualNiaUnitMarginInr: number
  attachPct: number
  peerBand: StudioPeerBand
  repeatPct: number
  repeatBaselinePct: number
  stockout: boolean
  fulfilmentFailure: boolean
  jogoCoverage: string
  eaeCoverage: string
  supplierStatus: "Healthy" | "At risk" | "Review required"
  structuralCurryContext: string | null
  marketReferenceVerified: boolean
  marginVerified: boolean
  submittedBy: string
  verifierId: string | null
  dataFreshness: Freshness
  rawSupplierContact?: unknown
  rawMemberIdentity?: unknown
}

export type SavingsSignalInput = {
  eventId: string
  ownerRole: string
  dueAt: string
  occurredAt: string
  repeatedDualGateCycles: number
  categoryWideRepeatDrop: boolean
  context: SavingsServiceContext
}

export type DualGateResult = {
  memberSavingsInr: number
  niaMarginInr: number
  memberSavingsPass: boolean
  niaMarginPass: boolean
  independentlyVerified: boolean
  status: "Pass" | "Exception" | "Unverified"
  reasons: readonly string[]
}

export type SavingsEvent = SavingsSignalInput & {
  triggers: readonly SavingsTrigger[]
  gate: DualGateResult
  policyVersion: string
  pendingPolicyReasons: readonly string[]
}

export type SavingsEventDecision =
  | { disposition: "Admitted"; event: SavingsEvent; reasons: readonly string[] }
  | { disposition: "Monitor pending approval" | "Ignored" | "Quarantined"; event: null; reasons: readonly string[] }

export type SavingsDecision = {
  decisionId: string
  eventId: string
  kind: SavingsDecisionKind
  ownerRole: string
  rationale: string
  expectedMetric: "Attach" | "Repeat" | "Fulfilment" | "Dual gate"
  targetValue: number | null
  targetUnit: "percent" | "pass"
  humanApprovalRequired: boolean
  executable: false
}

export type SavingsAction = {
  actionId: string
  eventId: string
  idempotencyKey: string
  serviceRef: string
  theatre: string
  studio: string
  serviceName: string
  ownerRole: string
  dueAt: string
  kind: SavingsDecisionKind
  expectedMetric: SavingsDecision["expectedMetric"]
  targetValue: number | null
  expectedOutcome: string
  state: "Assigned" | "Evidence pending" | "Reopened" | "Routed"
  nextAction: string
  externalEffect: false
}

export type SavingsVerificationInput = {
  evidenceRef: string | null
  marketReferenceRef: string | null
  submittedBy: string
  verifierId: string | null
  dataFreshness: Freshness
  marketReferenceLive: boolean
  actualAttachPct: number
  actualRepeatPct: number
  actualMemberSavingsInr: number
  actualNiaMarginInr: number
  fulfilmentRecovered: boolean
  activityVisitOnly: boolean
  quarantined: boolean
}

export type SavingsVerification = {
  status: "Verified recovered" | "Awaiting evidence" | "Rejected" | "Reopened"
  canClose: boolean
  sourceMetricRecovered: boolean
  reasons: readonly string[]
}

export type SavingsEscalation = { escalationId: string; ownerRole: "Pushkar" | "CEO/COO"; issue: string; dueAt: string }

export type WeeklySavingsMessageInput = {
  mode: "Shadow only"
  sent: false
  serviceRef: string
  verifiedSavingsInr: number | null
  marketReferenceRef: string | null
  dataFreshness: Freshness
  eligibleVerifiedInput: boolean
  reasons: readonly string[]
}

export type SavingsLearningChain = {
  event_id: string
  action_id: string
  policy_version: string
  forecast: { recovery_probability_pct: number; expected_recovery_days: number; expected_member_savings_inr: number; expected_nia_margin_inr: number }
  context_snapshot: { service_ref: string; theatre: string; studio: string; service: string; data_freshness: Freshness; quarantined: boolean }
  decision: SavingsDecision
  assigned_action: SavingsAction
  evidence: { reference: string; cycles: number }
  independent_verification: { verified: boolean; verifier_ref: string; self_verified: boolean }
  measured_outcome: { member_savings_inr: number; nia_margin_inr: number; attach_pct: number; repeat_pct: number; recovered_source_metric: boolean }
  variance_reason: string
}

export type MemberSavingsLearningInput = {
  domain: "Member Savings"
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
  production_confidence: "Low"
  registry_thresholds_approved: false
  auto_adopt: false
  eligible_for_shared_learning_gate: boolean
  rejection_reasons: readonly string[]
}

export type ServiceGateProjection = {
  serviceId: string
  serviceName: string
  studio: string
  studioId?: string
  theatre?: string
  buyingMembers?: number
  ordersPlaced?: number
  ordersFulfilled?: number
  billedInr?: number
  memberSavingsInr: number
  niaMarginInr: number
  status: "Pass" | "Exception"
  statusReason: string
  attachPct: number
  repeatPct: number
  peerBandLabel: string
  repeatBaselinePct: number
}

export type SavingsTaskPreview = {
  actionId: string
  issue: string
  service: string
  owner: string
  dueAt: string
  expectedMetric: string
  progress: string
  verifiedResult: string
  state: SavingsAction["state"] | "Awaiting verification" | "Verified recovered"
  engineAction: SavingsAction
}

export type MemberSavingsShadowOutcome = "Unresolved" | "Evidence received" | "Failed evidence" | "Systemic pattern"

export type MemberSavingsShadowTransition = {
  task: SavingsTaskPreview
  verification: SavingsVerification
  route: string
}

export type MemberSavingsPreview = {
  fixtureLabel: "Synthetic fixture"
  mode: "Shadow only"
  question: typeof MEMBER_SAVINGS_QUESTION
  source: { name: string; asOf: string; lastRefreshAt: string; freshness: "Stale"; synthetic: true }
  headline: string
  summary: { target: string; current: string; gap: string; owner: string; progress: string; verifiedResult: string }
  measures: readonly [
    { id: "verified-savings"; label: string; value: string; target: string; detail: string },
    { id: "attach-repeat"; label: string; value: string; target: string; detail: string },
    { id: "dual-gate"; label: string; value: string; target: string; detail: string },
    { id: "exceptions"; label: string; value: string; target: string; detail: string },
  ]
  services: readonly ServiceGateProjection[]
  tasks: readonly SavingsTaskPreview[]
  despatchEscalations: readonly DespatchEscalationRecord[]
  loopHealth: LoopHealth
  learningInputs: readonly MemberSavingsLearningInput[]
  weeklyMessageInputs: readonly WeeklySavingsMessageInput[]
  quarantineCount: number
  policyRegistry: typeof MEMBER_SAVINGS_POLICY_REGISTRY
  blockedCapabilities: typeof MEMBER_SAVINGS_BLOCKED_CAPABILITIES
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
  return MEMBER_SAVINGS_POLICY_REGISTRY.map((policy) => `${policy.policyId}@v${policy.version}:${policy.status}`).join("|")
}

export function evaluateSavingsDualGate(context: SavingsServiceContext): DualGateResult {
  const memberSavingsInr = context.marketReferenceInr - context.memberPriceInr
  const reasons: string[] = []
  const independentlyVerified = context.marketReferenceVerified
    && context.marginVerified
    && protectedReference(context.marketReferenceRef, "market")
    && protectedReference(context.evidenceRef, "evidence")
    && Boolean(context.verifierId)
    && context.verifierId !== context.submittedBy
    && context.dataFreshness === "Current"
  if (!independentlyVerified) reasons.push("Fresh, protected and independently verified market and margin evidence is required.")
  if (memberSavingsInr <= 0) reasons.push("Verified Member savings must be positive versus the live market reference.")
  if (context.actualNiaUnitMarginInr <= 0) reasons.push("Verified Nia unit margin must be positive.")
  const memberSavingsPass = independentlyVerified && memberSavingsInr > 0
  const niaMarginPass = independentlyVerified && context.actualNiaUnitMarginInr > 0
  return Object.freeze({
    memberSavingsInr,
    niaMarginInr: context.actualNiaUnitMarginInr,
    memberSavingsPass,
    niaMarginPass,
    independentlyVerified,
    status: !independentlyVerified ? "Unverified" as const : memberSavingsPass && niaMarginPass ? "Pass" as const : "Exception" as const,
    reasons: Object.freeze(reasons),
  })
}

export function detectMemberSavingsEvent(input: SavingsSignalInput): SavingsEventDecision {
  const quarantineReasons: string[] = []
  if (!protectedReference(input.context.serviceRef, "service")) quarantineReasons.push("Service identity must use a protected reference.")
  if (!protectedReference(input.context.supplierRef, "supplier")) quarantineReasons.push("Supplier identity must use a protected reference.")
  if (!protectedReference(input.context.marketReferenceRef, "market")) quarantineReasons.push("Market lineage must use a protected reference.")
  if (input.context.rawSupplierContact !== undefined || input.context.rawMemberIdentity !== undefined) quarantineReasons.push("Raw supplier contacts and Member identity are prohibited.")
  if (quarantineReasons.length > 0) return Object.freeze({ disposition: "Quarantined" as const, event: null, reasons: Object.freeze(quarantineReasons) })

  const gate = evaluateSavingsDualGate(input.context)
  const triggers: SavingsTrigger[] = []
  const pendingPolicyReasons: string[] = []
  if (input.context.peerBand.status === "Approved" && input.context.peerBand.floorPct !== null) {
    if (input.context.attachPct < input.context.peerBand.floorPct) triggers.push("Low attach versus peer band")
  } else {
    pendingPolicyReasons.push("Peer-band trigger remains disabled pending human approval of its governed method.")
  }
  if (input.context.repeatPct < input.context.repeatBaselinePct) triggers.push("Repeat decline versus own baseline")
  if (gate.memberSavingsInr < input.context.priorVerifiedSavingsInr) triggers.push("Verified savings erosion")
  if (input.context.stockout || input.context.fulfilmentFailure) triggers.push("Stockout or fulfilment failure")
  if (gate.status !== "Pass") triggers.push("Dual-gate failure")
  if (triggers.length === 0 && pendingPolicyReasons.length > 0) return Object.freeze({ disposition: "Monitor pending approval" as const, event: null, reasons: Object.freeze(pendingPolicyReasons) })
  if (triggers.length === 0) return Object.freeze({ disposition: "Ignored" as const, event: null, reasons: Object.freeze(["No governed Member Savings trigger is active."]) })
  const event = Object.freeze({ ...input, triggers: Object.freeze(triggers), gate, policyVersion: policyVersion(), pendingPolicyReasons: Object.freeze(pendingPolicyReasons) })
  return Object.freeze({ disposition: "Admitted" as const, event, reasons: Object.freeze(triggers.map((trigger) => `${trigger} detected.`)) })
}

export function decideMemberSavings(event: SavingsEvent): SavingsDecision {
  let kind: SavingsDecisionKind
  let ownerRole: string
  let expectedMetric: SavingsDecision["expectedMetric"]
  let targetValue: number | null
  let rationale: string
  if (event.triggers.includes("Dual-gate failure")) {
    kind = "Supplier/service review"
    ownerRole = "Essentials category lead + Pushkar"
    expectedMetric = "Dual gate"
    targetValue = null
    rationale = "A service failing either verified Member savings or verified Nia margin requires human supplier/service review."
  } else if (event.triggers.includes("Verified savings erosion")) {
    kind = "Repricing proposal"
    ownerRole = "Pushkar"
    expectedMetric = "Dual gate"
    targetValue = null
    rationale = "Verified savings eroded versus the current market reference; prepare evidence for a human pricing decision."
  } else if (event.triggers.includes("Stockout or fulfilment failure")) {
    kind = "Replenishment"
    ownerRole = "Essentials replenishment owner"
    expectedMetric = "Fulfilment"
    targetValue = null
    rationale = "Stock or fulfilment failed while the service economics remain governed."
  } else {
    kind = "EAE/JOGO activation"
    ownerRole = `${event.context.eaeCoverage} / ${event.context.jogoCoverage}`
    const lowAttach = event.triggers.includes("Low attach versus peer band")
    expectedMetric = lowAttach ? "Attach" : "Repeat"
    targetValue = lowAttach ? event.context.peerBand.floorPct : event.context.repeatBaselinePct
    rationale = lowAttach ? "Attach is below the approved Studio peer band." : "Repeat declined against the Studio's own verified baseline."
  }
  return Object.freeze({ decisionId: stableId("decision", `${event.eventId}:${kind}`), eventId: event.eventId, kind, ownerRole, rationale, expectedMetric, targetValue, targetUnit: expectedMetric === "Dual gate" ? "pass" as const : "percent" as const, humanApprovalRequired: kind === "Repricing proposal" || kind === "Supplier/service review", executable: false as const })
}

export function assignMemberSavingsAction(event: SavingsEvent, decision: SavingsDecision): SavingsAction {
  const idempotencyKey = `member-savings:${event.eventId}:${event.context.serviceRef}:${decision.kind}:${event.policyVersion}`
  const expectedOutcome = decision.expectedMetric === "Attach" ? `Verified attach recovers to the approved ${decision.targetValue}% peer-band floor.`
    : decision.expectedMetric === "Repeat" ? `Verified repeat recovers to the Studio's ${decision.targetValue}% own baseline.`
      : decision.expectedMetric === "Fulfilment" ? "Verified fulfilment recovers without weakening either economic gate."
        : "Fresh independent evidence confirms positive Member savings and positive Nia margin after human approval."
  return Object.freeze({
    actionId: stableId("action", idempotencyKey), eventId: event.eventId, idempotencyKey,
    serviceRef: event.context.serviceRef, theatre: event.context.theatre, studio: event.context.studio, serviceName: event.context.serviceName,
    ownerRole: decision.ownerRole, dueAt: event.dueAt, kind: decision.kind, expectedMetric: decision.expectedMetric, targetValue: decision.targetValue,
    expectedOutcome, state: "Assigned" as const,
    nextAction: decision.kind === "Repricing proposal" ? "Prepare a protected repricing proposal for Pushkar; do not change price."
      : decision.kind === "Supplier/service review" ? "Prepare protected supplier/service evidence for human review; do not contract or delist."
        : decision.kind === "Replenishment" ? "Prepare a replenishment task; do not contact or commit a supplier."
          : "Assign one shadow activation task to the covered EAE/JOGO role; do not message a Member.",
    externalEffect: false as const,
  })
}

export function verifyMemberSavingsRecovery(action: SavingsAction, input: SavingsVerificationInput): SavingsVerification {
  const reasons: string[] = []
  if (!protectedReference(input.evidenceRef, "evidence") || !protectedReference(input.marketReferenceRef, "market")) reasons.push("Protected outcome and market references are required.")
  if (!input.verifierId) reasons.push("An independent verifier is required.")
  if (input.verifierId && input.verifierId === input.submittedBy) reasons.push("Self-verification cannot close the action.")
  if (input.dataFreshness === "Stale" || !input.marketReferenceLive) reasons.push("A current live market reference is required; stale evidence reopens.")
  if (input.quarantined) reasons.push("Quarantined evidence cannot close or learn.")
  if (input.activityVisitOnly) reasons.push("An activity visit is not a verified recovery outcome.")
  let sourceMetricRecovered = false
  if (action.expectedMetric === "Attach") sourceMetricRecovered = action.targetValue !== null && input.actualAttachPct >= action.targetValue
  if (action.expectedMetric === "Repeat") sourceMetricRecovered = action.targetValue !== null && input.actualRepeatPct >= action.targetValue
  if (action.expectedMetric === "Fulfilment") sourceMetricRecovered = input.fulfilmentRecovered && input.actualMemberSavingsInr > 0 && input.actualNiaMarginInr > 0
  if (action.expectedMetric === "Dual gate") sourceMetricRecovered = input.actualMemberSavingsInr > 0 && input.actualNiaMarginInr > 0
  if (!sourceMetricRecovered) reasons.push("The assigned source metric has not recovered against governed evidence.")
  if (reasons.length === 0) return Object.freeze({ status: "Verified recovered" as const, canClose: true, sourceMetricRecovered: true, reasons: Object.freeze([]) })
  if (input.dataFreshness === "Stale" || !input.marketReferenceLive) return Object.freeze({ status: "Reopened" as const, canClose: false, sourceMetricRecovered, reasons: Object.freeze(reasons) })
  if (!input.verifierId || input.verifierId === input.submittedBy || input.quarantined) return Object.freeze({ status: "Rejected" as const, canClose: false, sourceMetricRecovered, reasons: Object.freeze(reasons) })
  return Object.freeze({ status: "Awaiting evidence" as const, canClose: false, sourceMetricRecovered, reasons: Object.freeze(reasons) })
}

export function recoverMemberSavingsAction(action: SavingsAction, outcome: "Evidence received" | "Failed evidence" | "Systemic pattern"): SavingsAction {
  if (outcome === "Evidence received") return Object.freeze({ ...action, state: "Evidence pending" as const, nextAction: "Queue independent outcome and live-market verification." })
  if (outcome === "Failed evidence") return Object.freeze({ ...action, state: "Reopened" as const, nextAction: "Collect corrected protected evidence; the action remains open." })
  return Object.freeze({ ...action, state: "Routed" as const, nextAction: "Route the systemic pattern to the owning category loop; keep this action open." })
}

export function recoverMemberSavingsTask(task: SavingsTaskPreview, outcome: MemberSavingsShadowOutcome): MemberSavingsShadowTransition {
  const action = outcome === "Unresolved" ? task.engineAction : recoverMemberSavingsAction(task.engineAction, outcome)
  const validEvidence = outcome === "Evidence received"
  const staleEvidence = outcome === "Failed evidence"
  const verification = verifyMemberSavingsRecovery(action, {
    evidenceRef: validEvidence || staleEvidence ? `protected://evidence/${action.actionId}` : null,
    marketReferenceRef: validEvidence || staleEvidence ? `protected://market/${action.actionId}` : null,
    submittedBy: action.ownerRole,
    verifierId: validEvidence || staleEvidence ? "Independent Savings Verifier" : null,
    dataFreshness: staleEvidence ? "Stale" : "Current",
    marketReferenceLive: !staleEvidence,
    actualAttachPct: action.expectedMetric === "Attach" && action.targetValue !== null && validEvidence ? action.targetValue : 0,
    actualRepeatPct: action.expectedMetric === "Repeat" && action.targetValue !== null && validEvidence ? action.targetValue : 0,
    actualMemberSavingsInr: validEvidence ? 12 : 0,
    actualNiaMarginInr: validEvidence ? 7 : 0,
    fulfilmentRecovered: validEvidence,
    activityVisitOnly: false,
    quarantined: false,
  })
  const route = verification.canClose ? "Independent dual-gate/source-metric recovery verified in local shadow state; no Production closure was written." : action.nextAction
  const state: SavingsTaskPreview["state"] = verification.canClose ? "Verified recovered" : action.state
  return Object.freeze({
    task: Object.freeze({ ...task, engineAction: action, progress: outcome, verifiedResult: verification.status, state }),
    verification,
    route,
  })
}

export function buildMemberSavingsEscalations(event: SavingsEvent): readonly SavingsEscalation[] {
  const rows: SavingsEscalation[] = []
  if (event.repeatedDualGateCycles >= 2) rows.push({ escalationId: `ESC-DUAL-${event.eventId}`, ownerRole: "Pushkar", issue: "Repeated dual-gate failure requires supplier/service review.", dueAt: event.dueAt })
  if (event.categoryWideRepeatDrop) rows.push({ escalationId: `ESC-REPEAT-${event.eventId}`, ownerRole: "CEO/COO", issue: "Category-wide verified repeat deterioration requires visibility.", dueAt: event.dueAt })
  return Object.freeze(rows)
}

export function emitMemberSavingsDespatchEscalations(event: SavingsEvent, action: SavingsAction, at = MEMBER_SAVINGS_AT): readonly DespatchEscalationRecord[] {
  return Object.freeze(buildMemberSavingsEscalations(event).map((row) => createDespatchEscalation({
    escalationId: row.escalationId,
    domain: "Member Savings",
    sourceActionId: action.actionId,
    sourceEventId: event.eventId,
    title: row.issue,
    reason: row.issue,
    ownerRole: row.ownerRole,
    dueAt: row.dueAt,
    raisedAt: at,
    severity: Date.parse(row.dueAt) < Date.parse(at) ? "Breach" : "Attention",
    status: "Open",
    evidenceRefs: [`protected://member-savings/escalation/${row.escalationId}`],
    synthetic: true,
  })))
}

export function projectMemberSavingsLoopHealth(tasks: readonly SavingsTaskPreview[], quarantinedRecords: number, asOf = MEMBER_SAVINGS_AT): LoopHealth {
  const verified = tasks.filter((task) => task.state === "Verified recovered").length
  const awaiting = tasks.length - verified
  return projectLoopHealth({
    domain: "Member Savings",
    asOf,
    feeds: [
      { feedId: "member-savings-market", label: "Market references", lastUpdatedAt: "2026-07-17T12:30:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["verified-savings", "dual-gate"] },
      { feedId: "member-savings-margin", label: "Verified service margin", lastUpdatedAt: "2026-07-17T14:30:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["dual-gate"] },
    ],
    clocks: tasks.map((task) => ({ clockId: `clock-${task.actionId}`, label: `${task.service} recovery`, ownerRole: task.owner, dueAt: task.dueAt, state: task.state === "Verified recovered" ? "Recovered" : "Running" })),
    verification: { claimed: tasks.length, verified, awaiting, reopened: tasks.filter((task) => task.state === "Reopened").length, oldestAwaitingAt: awaiting > 0 ? "2026-07-17T11:00:00+05:30" : null },
    quarantinedRecords,
    dependentClaims: ["verified-savings", "attach-repeat", "dual-gate", "exceptions"],
    synthetic: true,
  })
}

export function buildWeeklySavingsMessageInput(context: SavingsServiceContext): WeeklySavingsMessageInput {
  const gate = evaluateSavingsDualGate(context)
  const reasons: string[] = []
  if (!gate.independentlyVerified || !gate.memberSavingsPass) reasons.push("Only fresh, independently verified positive savings may enter the weekly message input.")
  if (!protectedReference(context.serviceRef, "service") || !protectedReference(context.marketReferenceRef, "market")) reasons.push("Protected service and market references are required.")
  return Object.freeze({ mode: "Shadow only" as const, sent: false as const, serviceRef: context.serviceRef, verifiedSavingsInr: reasons.length === 0 ? gate.memberSavingsInr : null, marketReferenceRef: reasons.length === 0 ? context.marketReferenceRef : null, dataFreshness: context.dataFreshness, eligibleVerifiedInput: reasons.length === 0, reasons: Object.freeze(reasons) })
}

export function buildMemberSavingsLearningInput(chain: SavingsLearningChain, options: {
  holdoutOrControl: boolean
  comparisonGroup: boolean
  confounders: readonly string[]
  sampleSize: number
  forecastErrorPct: number
  verificationRatePct: number
  affectedHumanControlledCategories?: readonly HumanControlledCategory[]
  insideApprovedBoundary?: boolean
  reversesHumanDecision?: boolean
}): MemberSavingsLearningInput {
  const attributionGrade: AttributionGrade = options.holdoutOrControl ? "Controlled" : options.comparisonGroup ? "Compared" : "Observed"
  const confounders = attributionGrade === "Observed" && options.confounders.length === 0 ? Object.freeze(["confounders not ruled out"]) : Object.freeze([...options.confounders])
  const rejectionReasons: string[] = []
  if (chain.context_snapshot.data_freshness !== "Current") rejectionReasons.push("Critical context is stale.")
  if (chain.context_snapshot.quarantined) rejectionReasons.push("Quarantined context is excluded.")
  if (!chain.independent_verification.verified) rejectionReasons.push("Outcome is unverified.")
  if (chain.independent_verification.self_verified) rejectionReasons.push("Self-verification is excluded.")
  return Object.freeze({
    domain: "Member Savings" as const, event_id: chain.event_id, action_id: chain.action_id,
    proposed_change: "Re-rank eligible shadow interventions by verified dual-gate recovery within current approved boundaries.",
    expected_effect: "Recover Member savings, Nia margin, attach or repeat without changing price or supplier policy automatically.",
    evidence_cycles: chain.evidence.cycles, sample_size: options.sampleSize, forecast_error_pct: options.forecastErrorPct,
    attribution_grade: attributionGrade, confounders, critical_data_fresh: chain.context_snapshot.data_freshness === "Current",
    verification_rate_pct: options.verificationRatePct, reversible: true,
    rollback_trigger: "Withdraw the proposed ranking if verified dual-gate pass rate or Member savings deteriorates.",
    inside_approved_boundary: options.insideApprovedBoundary ?? true, reverses_human_decision: options.reversesHumanDecision ?? false,
    affected_human_controlled_categories: Object.freeze([...(options.affectedHumanControlledCategories ?? [])]),
    target_effect: "Increase services independently verified through both economic gates.",
    channel_effect: "No channel or Member-message activation; shadow task ordering only.",
    cm_effect: "Positive verified Nia unit margin protected; no ungoverned CM formula invented.",
    cash_effect: "No money movement, purchase commitment or supplier settlement.",
    production_confidence: "Low" as const, registry_thresholds_approved: false as const, auto_adopt: false as const,
    eligible_for_shared_learning_gate: rejectionReasons.length === 0, rejection_reasons: Object.freeze(rejectionReasons),
  })
}

function fixtureContext(overrides: Partial<SavingsServiceContext> = {}): SavingsServiceContext {
  return {
    theatre: "Chennai South", studio: "Oragadam 01", serviceName: "Curry weekly basket",
    serviceRef: "protected://service/curry-weekly", supplierRef: "protected://supplier/synthetic-01", marketReferenceRef: "protected://market/curry-2026-07-17", evidenceRef: "protected://evidence/curry-2026-07-17",
    memberPriceInr: 108, marketReferenceInr: 120, priorVerifiedSavingsInr: 20, actualNiaUnitMarginInr: 7,
    attachPct: 34, peerBand: { floorPct: 38, ceilingPct: 44, status: "Approved", version: 1, source: "Synthetic shadow peer cohort; not a live policy" }, repeatPct: 58, repeatBaselinePct: 63,
    stockout: false, fulfilmentFailure: false, jogoCoverage: "JOGO · Oragadam", eaeCoverage: "EAE · Oragadam", supplierStatus: "Healthy", structuralCurryContext: "Shared Curry kitchen capacity available",
    marketReferenceVerified: true, marginVerified: true, submittedBy: "ACT-EAE-SYNTH", verifierId: "ACT-QA-SYNTH", dataFreshness: "Current", ...overrides,
  }
}

function projectSavingsTask(event: SavingsEvent, action: SavingsAction): SavingsTaskPreview {
  const issue = action.kind === "Supplier/service review" ? "Nia margin gate fails"
    : action.kind === "Repricing proposal" ? `Verified savings eroded by ₹${Math.max(0, event.context.priorVerifiedSavingsInr - event.gate.memberSavingsInr)}`
      : action.expectedMetric === "Repeat" ? "Repeat below own baseline"
        : event.triggers[0]
  return Object.freeze({
    actionId: action.actionId,
    issue,
    service: `${action.serviceName} · ${action.studio}`,
    owner: action.ownerRole,
    dueAt: action.dueAt,
    expectedMetric: action.expectedOutcome,
    progress: action.nextAction,
    verifiedResult: "Not yet independently verified",
    state: action.state,
    engineAction: action,
  })
}

function buildMemberSavingsFixtureWork() {
  const pendingPeerBand: StudioPeerBand = Object.freeze({ floorPct: null, ceilingPct: null, status: "Pending human approval", version: 1, source: "No governed method supplied" })
  const fixtures: readonly SavingsSignalInput[] = Object.freeze([
    Object.freeze({ eventId: "evt-savings-laundry-margin", ownerRole: "Essentials category lead", dueAt: "2026-07-17T18:00:00+05:30", occurredAt: MEMBER_SAVINGS_AT, repeatedDualGateCycles: 2, categoryWideRepeatDrop: false, context: fixtureContext({ studio: "Sriperumbudur 02", serviceName: "Laundry bundle", serviceRef: "protected://service/laundry-margin", marketReferenceRef: "protected://market/laundry-margin", evidenceRef: "protected://evidence/laundry-margin", memberPriceInr: 102, marketReferenceInr: 120, priorVerifiedSavingsInr: 18, actualNiaUnitMarginInr: -2, attachPct: 29, peerBand: pendingPeerBand, repeatPct: 51, repeatBaselinePct: 51 }) }),
    Object.freeze({ eventId: "evt-savings-curry-erosion", ownerRole: "Essentials category lead", dueAt: "2026-07-17T18:30:00+05:30", occurredAt: MEMBER_SAVINGS_AT, repeatedDualGateCycles: 0, categoryWideRepeatDrop: false, context: fixtureContext({ memberPriceInr: 108, marketReferenceInr: 120, priorVerifiedSavingsInr: 20, actualNiaUnitMarginInr: 7, attachPct: 40, repeatPct: 63, repeatBaselinePct: 63 }) }),
    Object.freeze({ eventId: "evt-savings-laundry-repeat", ownerRole: "Essentials category lead", dueAt: "2026-07-17T19:00:00+05:30", occurredAt: MEMBER_SAVINGS_AT, repeatedDualGateCycles: 0, categoryWideRepeatDrop: false, context: fixtureContext({ studio: "Sriperumbudur 02", serviceName: "Laundry bundle", serviceRef: "protected://service/laundry-repeat", marketReferenceRef: "protected://market/laundry-repeat", evidenceRef: "protected://evidence/laundry-repeat", memberPriceInr: 102, marketReferenceInr: 120, priorVerifiedSavingsInr: 18, actualNiaUnitMarginInr: 8, attachPct: 29, peerBand: pendingPeerBand, repeatPct: 51, repeatBaselinePct: 56, eaeCoverage: "EAE · Sriperumbudur", jogoCoverage: "JOGO · Sriperumbudur" }) }),
  ])
  const work = fixtures.map((fixture) => {
    const admitted = detectMemberSavingsEvent(fixture)
    if (admitted.disposition !== "Admitted") throw new Error(`Synthetic Member Savings fixture ${fixture.eventId} must admit.`)
    const action = assignMemberSavingsAction(admitted.event, decideMemberSavings(admitted.event))
    return Object.freeze({ event: admitted.event, action, task: projectSavingsTask(admitted.event, action) })
  })
  return Object.freeze({
    tasks: Object.freeze(work.map((row) => row.task)),
    despatchEscalations: Object.freeze(work.flatMap((row) => emitMemberSavingsDespatchEscalations(row.event, row.action)).slice(0, 5)),
  })
}

export function buildMemberSavingsPreview(): MemberSavingsPreview {
  const fixtureWork = buildMemberSavingsFixtureWork()
  const serviceRows: ServiceGateProjection[] = [
    { serviceId: "SVC-CURRY", serviceName: "Curry weekly basket", studio: "Oragadam 01", memberSavingsInr: 12, niaMarginInr: 7, status: "Pass", statusReason: "Both independently verified gates pass", attachPct: 34, repeatPct: 58, peerBandLabel: "38–44% synthetic shadow band", repeatBaselinePct: 63 },
    { serviceId: "SVC-LAUNDRY", serviceName: "Laundry bundle", studio: "Sriperumbudur 02", memberSavingsInr: 18, niaMarginInr: -2, status: "Exception", statusReason: "Nia margin gate fails", attachPct: 29, repeatPct: 51, peerBandLabel: "Method pending human approval", repeatBaselinePct: 56 },
    { serviceId: "SVC-ESSENTIALS", serviceName: "Essentials basket", studio: "Oragadam 01", memberSavingsInr: 46, niaMarginInr: 15, status: "Pass", statusReason: "Both independently verified gates pass", attachPct: 42, repeatPct: 66, peerBandLabel: "40–46% synthetic shadow band", repeatBaselinePct: 64 },
    { serviceId: "SVC-REMIT", serviceName: "Remit assisted transfer", studio: "Guindy 01", memberSavingsInr: 31, niaMarginInr: 9, status: "Pass", statusReason: "Both independently verified gates pass", attachPct: 37, repeatPct: 61, peerBandLabel: "35–41% synthetic shadow band", repeatBaselinePct: 60 },
  ]
  const eventInput: SavingsSignalInput = { eventId: "evt-savings-curry-001", ownerRole: "Essentials category lead", dueAt: "2026-07-17T18:00:00+05:30", occurredAt: MEMBER_SAVINGS_AT, repeatedDualGateCycles: 1, categoryWideRepeatDrop: false, context: fixtureContext() }
  const admitted = detectMemberSavingsEvent(eventInput)
  if (admitted.disposition !== "Admitted") throw new Error("Synthetic Member Savings fixture must admit.")
  const decision = decideMemberSavings(admitted.event)
  const action = assignMemberSavingsAction(admitted.event, decision)
  const chain: SavingsLearningChain = {
    event_id: admitted.event.eventId, action_id: action.actionId, policy_version: admitted.event.policyVersion,
    forecast: { recovery_probability_pct: 72, expected_recovery_days: 4, expected_member_savings_inr: 18, expected_nia_margin_inr: 8 },
    context_snapshot: { service_ref: admitted.event.context.serviceRef, theatre: admitted.event.context.theatre, studio: admitted.event.context.studio, service: admitted.event.context.serviceName, data_freshness: "Current", quarantined: false },
    decision, assigned_action: action, evidence: { reference: admitted.event.context.evidenceRef, cycles: 3 },
    independent_verification: { verified: true, verifier_ref: "protected://verifier/qa-synth", self_verified: false },
    measured_outcome: { member_savings_inr: 14, nia_margin_inr: 8, attach_pct: 38, repeat_pct: 63, recovered_source_metric: true },
    variance_reason: "Recovery required one extra evidence cycle; synthetic seasonality remains unruled out.",
  }
  const learningInput = buildMemberSavingsLearningInput(chain, { holdoutOrControl: false, comparisonGroup: false, confounders: [], sampleSize: 18, forecastErrorPct: 9, verificationRatePct: 86 })
  return Object.freeze({
    fixtureLabel: "Synthetic fixture" as const, mode: "Shadow only" as const, question: MEMBER_SAVINGS_QUESTION,
    source: Object.freeze({ name: "Synthetic Member Savings fixture", asOf: "2026-07-17T14:45:00+05:30", lastRefreshAt: "2026-07-17T14:45:00+05:30", freshness: "Stale" as const, synthetic: true as const }),
    headline: "Restore the Laundry bundle's Nia margin while keeping verified Member savings positive.",
    summary: Object.freeze({ target: "Both gates > ₹0", current: "3/4 services pass", gap: "1 service", owner: "Essentials category lead", progress: "Evidence requested", verifiedResult: "2 recoveries verified" }),
    measures: Object.freeze([
      Object.freeze({ id: "verified-savings" as const, label: "Verified Member savings", value: "₹27 avg", target: "Positive vs market", detail: "By service and Studio · fresh references only" }),
      Object.freeze({ id: "attach-repeat" as const, label: "Attach and repeat", value: "36% / 59%", target: "Peer band / own baseline", detail: "Peer methods remain visibly governed" }),
      Object.freeze({ id: "dual-gate" as const, label: "Services passing both gates", value: "3/4", target: "Savings + margin", detail: "One Nia-margin exception" }),
      Object.freeze({ id: "exceptions" as const, label: "At-risk recovery", value: "2 open", target: "2 verified", detail: "Owner and evidence retained" }),
    ] as const),
    services: Object.freeze(serviceRows.map((row) => Object.freeze(row))),
    tasks: fixtureWork.tasks,
    despatchEscalations: fixtureWork.despatchEscalations,
    loopHealth: projectMemberSavingsLoopHealth(fixtureWork.tasks, 2),
    learningInputs: Object.freeze([learningInput]), weeklyMessageInputs: Object.freeze([buildWeeklySavingsMessageInput(fixtureContext())]), quarantineCount: 2,
    policyRegistry: MEMBER_SAVINGS_POLICY_REGISTRY, blockedCapabilities: MEMBER_SAVINGS_BLOCKED_CAPABILITIES,
  })
}
