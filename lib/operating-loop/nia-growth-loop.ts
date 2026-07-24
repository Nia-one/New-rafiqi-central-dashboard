import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation, projectLoopHealth, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"

export const NIA_GROWTH_AT = "2026-07-17T15:30:00+05:30"
export const NIA_GROWTH_QUESTION = "Where should Nia add capacity next, through FONO or Shram Park, without creating unapproved capital risk?"

export const NIA_GROWTH_POLICY_REGISTRY = Object.freeze([
  Object.freeze({ policyId: "POL-GROWTH-SUPPLY-MODEL", name: "Mandatory supply-model context", value: "FONO | SP", unit: "enum", version: 1, status: "Active", approver: "Sachin", source: "Locked Nia Growth scope" }),
  Object.freeze({ policyId: "POL-GROWTH-FONO-REVIEW", name: "FONO franchise-review trigger", value: 2, unit: "consecutive below-breakeven cycles despite Nia-fill support", version: 1, status: "Active", approver: "Sachin", source: "Locked Nia Growth scope" }),
  Object.freeze({ policyId: "POL-GROWTH-SP-UNDERWRITING", name: "SP signed-contract underwriting threshold", value: null, unit: "coverage policy", version: 1, status: "Pending human approval", approver: "Pending", source: "No approved numeric threshold supplied" }),
  Object.freeze({ policyId: "POL-GROWTH-READINESS-SLA", name: "Opportunity-to-activation-ready SLA", value: null, unit: "days by supply model", version: 1, status: "Pending human approval", approver: "Pending", source: "No approved duration supplied" }),
  Object.freeze({ policyId: "POL-GROWTH-ESCALATION-CLOCKS", name: "SP and FONO escalation clocks", value: null, unit: "clock registry; SP must be faster than FONO", version: 1, status: "Pending human approval", approver: "Pending", source: "Relative ordering is locked; numeric clocks are not approved" }),
  Object.freeze({ policyId: "POL-GROWTH-LEARNING-CONFIDENCE", name: "Production learning-confidence thresholds", value: null, unit: "registry", version: 1, status: "Pending human approval", approver: "Pending", source: "Shared learning gate owns approval" }),
] as const)

export const NIA_GROWTH_BLOCKED_CAPABILITIES = Object.freeze({
  productionWrites: false,
  liveOutreach: false,
  propertyCommitments: false,
  contractsOrLeases: false,
  capexCommitments: false,
  studioOrParkRelease: false,
  moneyMovement: false,
  externalActions: false,
  autoAdoption: false,
})

export const NIA_GROWTH_LEARNING_CHAIN_FIELDS = Object.freeze([
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

export type SupplyModel = "FONO" | "SP"
export type Freshness = "Current" | "Stale"
export type MilestoneState = "Ready" | "Blocked" | "Not contracted" | "Pending evidence"
export type GrowthTrigger = "Activation readiness delay" | "FONO below breakeven after Nia-fill support" | "SP coverage below approved underwriting" | "SP readiness blocker"
export type GrowthDecisionKind = "Franchise performance" | "Nia-fill support" | "Franchise review" | "Enterprise contract coverage" | "Named build-out blocker" | "CEO/COO escalation"
export type AttributionGrade = "Controlled" | "Compared" | "Observed"
export type HumanControlledCategory = "Property" | "Finance" | "Expansion" | "Contracts" | "Capex" | "Pricing" | "Cash" | "People decisions" | "Safety"

export type GrowthContext = {
  opportunityRef: string
  locationRef: string
  evidenceRef: string
  supplyModel: SupplyModel | null
  theatre: string
  displayLocation: string
  proposedCapacityNests: number
  activationReadyNests: number
  opportunityToReadyDays: number | null
  activationReadinessDelayed: boolean
  readinessBlocker: string | null
  dataFreshness: Freshness
  submittedBy: string
  verifierRef: string | null
  franchiseBaseCommitmentNests: number | null
  franchiseBaseReadyNests: number | null
  niaFillSupportReadyNests: number | null
  niaFillSupportProvided: boolean | null
  consecutiveBelowBreakevenCycles: number | null
  contractRef: string | null
  signedEnterpriseCoverageNests: number | null
  underwritingAssessment: "Covered" | "Below approved underwriting" | "Pending human approval" | null
  underwritingAssessmentRef: string | null
  capexExposureInr: number | null
  buildOut: MilestoneState | null
  hardware: MilestoneState | null
  contractedServices: MilestoneState | null
  rawPropertyOwner?: unknown
  rawCoordinates?: unknown
}

export type GrowthSignalInput = {
  eventId: string
  ownerRole: string
  dueAt: string
  occurredAt: string
  context: GrowthContext
}

export type GrowthEvent = GrowthSignalInput & {
  supplyModel: SupplyModel
  triggers: readonly GrowthTrigger[]
  policyVersion: string
  pendingPolicyReasons: readonly string[]
}

export type GrowthEventDecision =
  | { disposition: "Admitted"; event: GrowthEvent; reasons: readonly string[] }
  | { disposition: "Ignored" | "Monitor pending approval" | "Quarantined"; event: null; reasons: readonly string[] }

export type GrowthDecision = {
  decisionId: string
  eventId: string
  supplyModel: SupplyModel
  kind: GrowthDecisionKind
  ownerRole: string
  rationale: string
  expectedVerifiedResult: string
  recommendationOnly: boolean
  humanSignOffRequired: boolean
  executable: false
}

export type GrowthAction = {
  actionId: string
  eventId: string
  idempotencyKey: string
  opportunityRef: string
  supplyModel: SupplyModel
  theatre: string
  displayLocation: string
  kind: GrowthDecisionKind
  ownerRole: string
  dueAt: string
  expectedVerifiedResult: string
  nextAction: string
  state: "Assigned" | "Evidence pending" | "Reopened" | "Awaiting sign-off" | "Escalated"
  recommendationOnly: boolean
  externalEffect: false
}

export type GrowthVerificationInput = {
  supplyModel: SupplyModel | null
  evidenceRef: string | null
  submittedBy: string
  verifierRef: string | null
  dataFreshness: Freshness
  capacityReadyToSpec: boolean
  activationReadyNests: number
  signedContractCoverageVerified: boolean
  buildOutReady: boolean
  hardwareReadyWhereContracted: boolean
  contractedServicesReady: boolean
  supplyModelContextVerified: boolean
  activityClaimOnly: boolean
  quarantined: boolean
}

export type GrowthVerification = {
  status: "Verified ready" | "Awaiting evidence" | "Rejected" | "Reopened"
  canClose: boolean
  reasons: readonly string[]
}

export type GrowthLearningChain = {
  event_id: string
  action_id: string
  policy_version: string
  forecast: { activation_ready_probability_pct: number; expected_ready_days: number; expected_ready_nests: number; expected_contract_coverage_nests: number }
  context_snapshot: { opportunity_ref: string; supply_model: SupplyModel; theatre: string; data_freshness: Freshness; quarantined: boolean }
  decision: GrowthDecision
  assigned_action: GrowthAction
  evidence: { reference: string; cycles: number }
  independent_verification: { verified: boolean; verifier_ref: string; self_verified: boolean }
  measured_outcome: { activation_ready_nests: number; ready_days: number; signed_contract_coverage_nests: number; intervention_recovered_source_metric: boolean }
  variance_reason: string
}

export type NiaGrowthLearningInput = {
  domain: "Nia Growth"
  event_id: string
  action_id: string
  supply_model: SupplyModel
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

export type GrowthLaneProjection = {
  supplyModel: SupplyModel
  capacityLabel: string
  plannedNests: number
  activationReadyNests: number
  gapNests: number
  timeToReadyLabel: string
  coverageLabel: string
  coverageDetail: string
  progressPct: number
  stages: readonly { label: string; value: string; state: "Complete" | "Open" | "Blocked" }[]
}

export type GrowthTaskPreview = {
  actionId: string
  supplyModel: SupplyModel
  issue: string
  location: string
  owner: string
  dueAt: string
  expectedVerifiedResult: string
  progress: string
  verifiedResult: string
  state: GrowthAction["state"] | "Awaiting verification" | "Verified ready"
  recommendationOnly: boolean
  engineAction: GrowthAction
  verificationInput: GrowthVerificationInput
}

export type NiaGrowthPreview = {
  fixtureLabel: "Synthetic fixture"
  mode: "Shadow only"
  question: typeof NIA_GROWTH_QUESTION
  source: { name: string; asOf: string; lastRefreshAt: string; freshness: "Stale"; synthetic: true }
  headline: string
  summary: { target: string; current: string; gap: string; owner: string; progress: string; verifiedResult: string }
  measures: readonly [
    { id: "ready-capacity"; label: string; value: string; target: string; detail: string },
    { id: "time-to-ready"; label: string; value: string; target: string; detail: string },
    { id: "fono-health"; label: string; value: string; target: string; detail: string },
    { id: "sp-exposure"; label: string; value: string; target: string; detail: string },
  ]
  lanes: readonly [GrowthLaneProjection, GrowthLaneProjection]
  tasks: readonly GrowthTaskPreview[]
  despatchEscalations: readonly DespatchEscalationRecord[]
  signOffs: readonly { id: string; supplyModel: SupplyModel; decision: string; owner: string; impact: string; status: "Pending human approval" }[]
  learningInputs: readonly NiaGrowthLearningInput[]
  quarantineCount: number
  policyRegistry: typeof NIA_GROWTH_POLICY_REGISTRY
  blockedCapabilities: typeof NIA_GROWTH_BLOCKED_CAPABILITIES
  loopHealth: LoopHealth
}

export function emitNiaGrowthDespatchEscalations(tasks: readonly GrowthTaskPreview[], at = NIA_GROWTH_AT): readonly DespatchEscalationRecord[] {
  return Object.freeze(tasks.flatMap((task) => {
    const overdue = Date.parse(task.dueAt) < Date.parse(at)
    if (task.recommendationOnly || task.state === "Awaiting sign-off" || task.state === "Verified ready" || (!overdue && task.state !== "Reopened" && task.state !== "Escalated")) return []
    const evidenceRef = task.verificationInput.evidenceRef
    return [createDespatchEscalation({
      escalationId: `DESPATCH-${task.actionId}`,
      domain: "Nia Growth",
      sourceActionId: task.actionId,
      sourceEventId: task.engineAction.eventId,
      title: `${task.supplyModel} readiness recovery · ${task.location}`,
      reason: task.issue,
      ownerRole: task.owner,
      dueAt: task.dueAt,
      raisedAt: at,
      severity: task.state === "Escalated" ? "Critical" : "Breach",
      status: "Open",
      evidenceRefs: Object.freeze(evidenceRef?.startsWith("protected://") ? [evidenceRef] : [`protected://growth/${task.actionId}`]),
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
  return NIA_GROWTH_POLICY_REGISTRY.map((policy) => `${policy.policyId}@v${policy.version}:${policy.status}`).join("|")
}

const FONO_ACTIONS = new Set<GrowthDecisionKind>(["Franchise performance", "Nia-fill support", "Franchise review"])
const SP_ACTIONS = new Set<GrowthDecisionKind>(["Enterprise contract coverage", "Named build-out blocker", "CEO/COO escalation"])

export function validateGrowthActionContext(action: Pick<GrowthAction, "supplyModel" | "kind">): { valid: boolean; reasons: readonly string[] } {
  const valid = action.supplyModel === "FONO" ? FONO_ACTIONS.has(action.kind) : SP_ACTIONS.has(action.kind)
  return Object.freeze({ valid, reasons: Object.freeze(valid ? [] : [`${action.kind} is not valid for the ${action.supplyModel} playbook.`]) })
}

export function detectNiaGrowthEvent(input: GrowthSignalInput): GrowthEventDecision {
  const quarantineReasons: string[] = []
  const { context } = input
  if (context.supplyModel !== "FONO" && context.supplyModel !== "SP") quarantineReasons.push("A valid supply_model of FONO or SP is mandatory.")
  if (!protectedReference(context.opportunityRef, "opportunity")) quarantineReasons.push("Opportunity identity must use a protected reference.")
  if (!protectedReference(context.locationRef, "location")) quarantineReasons.push("Location identity must use a protected reference.")
  if (!protectedReference(context.evidenceRef, "evidence")) quarantineReasons.push("Evidence lineage must use a protected reference.")
  if (context.rawPropertyOwner !== undefined || context.rawCoordinates !== undefined) quarantineReasons.push("Raw property-owner and coordinate data are prohibited.")
  if (context.supplyModel === "FONO" && (context.contractRef !== null || context.capexExposureInr !== null || context.buildOut !== null || context.hardware !== null)) quarantineReasons.push("SP property/capex context cannot be applied to FONO.")
  if (context.supplyModel === "SP" && (context.franchiseBaseCommitmentNests !== null || context.franchiseBaseReadyNests !== null || context.niaFillSupportReadyNests !== null || context.consecutiveBelowBreakevenCycles !== null)) quarantineReasons.push("FONO franchise context cannot be applied to SP.")
  if (quarantineReasons.length > 0) return Object.freeze({ disposition: "Quarantined" as const, event: null, reasons: Object.freeze(quarantineReasons) })

  const triggers: GrowthTrigger[] = []
  const pendingPolicyReasons: string[] = []
  if (context.activationReadinessDelayed) triggers.push("Activation readiness delay")
  if (context.supplyModel === "FONO" && (context.consecutiveBelowBreakevenCycles ?? 0) >= 2 && context.niaFillSupportProvided) triggers.push("FONO below breakeven after Nia-fill support")
  if (context.supplyModel === "SP" && context.underwritingAssessment === "Below approved underwriting") triggers.push("SP coverage below approved underwriting")
  if (context.supplyModel === "SP" && (context.readinessBlocker || [context.buildOut, context.hardware, context.contractedServices].includes("Blocked"))) triggers.push("SP readiness blocker")
  if (context.supplyModel === "SP" && context.underwritingAssessment === "Pending human approval") pendingPolicyReasons.push("SP numeric underwriting threshold remains disabled pending human approval.")
  if (!context.activationReadinessDelayed && context.opportunityToReadyDays !== null) pendingPolicyReasons.push("Opportunity-to-ready SLA comparison remains disabled pending human approval.")
  if (triggers.length === 0 && pendingPolicyReasons.length > 0) return Object.freeze({ disposition: "Monitor pending approval" as const, event: null, reasons: Object.freeze(pendingPolicyReasons) })
  if (triggers.length === 0) return Object.freeze({ disposition: "Ignored" as const, event: null, reasons: Object.freeze(["No governed Nia Growth trigger is active."]) })
  const event = Object.freeze({ ...input, supplyModel: context.supplyModel as SupplyModel, triggers: Object.freeze(triggers), policyVersion: policyVersion(), pendingPolicyReasons: Object.freeze(pendingPolicyReasons) })
  return Object.freeze({ disposition: "Admitted" as const, event, reasons: Object.freeze(triggers.map((trigger) => `${trigger} detected.`)) })
}

export function decideNiaGrowth(event: GrowthEvent): GrowthDecision {
  let kind: GrowthDecisionKind
  let ownerRole: string
  let rationale: string
  let expectedVerifiedResult: string
  if (event.supplyModel === "FONO") {
    const context = event.context
    if (event.triggers.includes("FONO below breakeven after Nia-fill support")) {
      kind = "Franchise review"
      ownerRole = "Pushkar"
      rationale = "Two consecutive below-breakeven cycles persisted despite evidenced Nia-fill support."
      expectedVerifiedResult = "Human franchise review records the governed next step; no people or contract decision is automatic."
    } else if ((context.franchiseBaseReadyNests ?? 0) < (context.franchiseBaseCommitmentNests ?? 0)) {
      kind = "Franchise performance"
      ownerRole = "Theatre lead"
      rationale = "The franchise base commitment is not independently verified ready."
      expectedVerifiedResult = "Verified franchise-base readiness recovers against the existing commitment."
    } else {
      kind = "Nia-fill support"
      ownerRole = "Nia demand lead"
      rationale = "The franchise base is covered and the remaining activation-ready gap belongs to Nia-fill support."
      expectedVerifiedResult = "Verified Nia-filled capacity closes the remaining FONO readiness gap."
    }
  } else if (event.triggers.includes("SP coverage below approved underwriting")) {
    kind = "CEO/COO escalation"
    ownerRole = "CEO/COO"
    rationale = "Signed enterprise coverage is assessed below approved underwriting while Nia capital is exposed."
    expectedVerifiedResult = "A named human decision records coverage remediation or a stop; no capital action occurs automatically."
  } else {
    kind = "Named build-out blocker"
    ownerRole = "SP delivery lead"
    rationale = `The activation-ready path is blocked by ${event.context.readinessBlocker ?? "a named contracted readiness milestone"}.`
    expectedVerifiedResult = "Independent evidence confirms the named SP milestone and contracted readiness are complete."
  }
  const recommendationOnly = kind !== "Franchise performance" && kind !== "Nia-fill support" && kind !== "Named build-out blocker"
  return Object.freeze({
    decisionId: stableId("decision", `${event.eventId}:${event.supplyModel}:${kind}`), eventId: event.eventId, supplyModel: event.supplyModel,
    kind, ownerRole, rationale, expectedVerifiedResult, recommendationOnly, humanSignOffRequired: recommendationOnly, executable: false as const,
  })
}

export function assignNiaGrowthAction(event: GrowthEvent, decision: GrowthDecision): GrowthAction {
  const contextCheck = validateGrowthActionContext({ supplyModel: event.supplyModel, kind: decision.kind })
  if (!contextCheck.valid || decision.supplyModel !== event.supplyModel) throw new Error("Supply-model playbook mismatch: action quarantined.")
  const idempotencyKey = `nia-growth:${event.eventId}:${event.context.opportunityRef}:${event.supplyModel}:${decision.kind}:${event.policyVersion}`
  const nextAction = decision.kind === "Franchise performance" ? "Assign a shadow franchise-base evidence task; do not alter a franchise agreement."
    : decision.kind === "Nia-fill support" ? "Assign a shadow Nia-fill readiness task; do not contact Members or create live demand work."
      : decision.kind === "Franchise review" ? "Prepare an evidence-backed franchise-review recommendation for Pushkar."
        : decision.kind === "Named build-out blocker" ? `Assign the named ${event.context.readinessBlocker ?? "readiness"} evidence task; do not release the park.`
          : "Prepare the protected coverage/capital evidence for CEO/COO sign-off; do not commit capex, property or contract terms."
  return Object.freeze({
    actionId: stableId("action", idempotencyKey), eventId: event.eventId, idempotencyKey,
    opportunityRef: event.context.opportunityRef, supplyModel: event.supplyModel, theatre: event.context.theatre, displayLocation: event.context.displayLocation,
    kind: decision.kind, ownerRole: decision.ownerRole, dueAt: event.dueAt, expectedVerifiedResult: decision.expectedVerifiedResult, nextAction,
    state: decision.humanSignOffRequired ? "Awaiting sign-off" as const : "Assigned" as const,
    recommendationOnly: decision.recommendationOnly, externalEffect: false as const,
  })
}

export function verifyNiaGrowthReadiness(action: GrowthAction, input: GrowthVerificationInput): GrowthVerification {
  const reasons: string[] = []
  if (input.supplyModel !== action.supplyModel) reasons.push("Verification supply_model must match the assigned action.")
  if (!input.supplyModelContextVerified) reasons.push("Supply-model context must be independently verified.")
  if (!protectedReference(input.evidenceRef, "evidence")) reasons.push("A protected readiness evidence reference is required.")
  if (!protectedReference(input.verifierRef, "verifier")) reasons.push("A protected independent verifier reference is required.")
  if (input.verifierRef && input.verifierRef === input.submittedBy) reasons.push("Self-verification cannot close the action.")
  if (input.dataFreshness === "Stale") reasons.push("Stale readiness evidence reopens the action.")
  if (input.quarantined) reasons.push("Quarantined evidence cannot close or learn.")
  if (input.activityClaimOnly) reasons.push("An activity claim is not an independently verified readiness outcome.")
  if (!input.capacityReadyToSpec || input.activationReadyNests <= 0) reasons.push("Capacity must be independently verified ready to the assigned spec.")
  if (action.supplyModel === "SP") {
    if (!input.signedContractCoverageVerified) reasons.push("SP closure requires verified signed enterprise-contract coverage.")
    if (!input.buildOutReady || !input.hardwareReadyWhereContracted || !input.contractedServicesReady) reasons.push("SP build-out, contracted hardware and services must be independently verified ready.")
  }
  if (reasons.length === 0) return Object.freeze({ status: "Verified ready" as const, canClose: true, reasons: Object.freeze([]) })
  if (input.dataFreshness === "Stale") return Object.freeze({ status: "Reopened" as const, canClose: false, reasons: Object.freeze(reasons) })
  if (input.quarantined || input.supplyModel !== action.supplyModel || input.verifierRef === input.submittedBy) return Object.freeze({ status: "Rejected" as const, canClose: false, reasons: Object.freeze(reasons) })
  return Object.freeze({ status: "Awaiting evidence" as const, canClose: false, reasons: Object.freeze(reasons) })
}

export function recoverNiaGrowthAction(action: GrowthAction, outcome: "Evidence received" | "Failed evidence" | "Human sign-off required"): GrowthAction {
  if (outcome === "Evidence received") return Object.freeze({ ...action, state: "Evidence pending" as const, nextAction: "Queue independent readiness and supply-model verification." })
  if (outcome === "Failed evidence") return Object.freeze({ ...action, state: "Reopened" as const, nextAction: "Collect corrected protected evidence; the action remains open." })
  return Object.freeze({ ...action, state: "Awaiting sign-off" as const, recommendationOnly: true, nextAction: "Present a recommendation-only card to the named human authority." })
}

export function buildNiaGrowthLearningInput(chain: GrowthLearningChain, options: {
  holdoutOrControl: boolean
  comparisonGroup: boolean
  confounders: readonly string[]
  sampleSize: number
  forecastErrorPct: number
  verificationRatePct: number
  affectedHumanControlledCategories?: readonly HumanControlledCategory[]
  insideApprovedBoundary?: boolean
  reversesHumanDecision?: boolean
}): NiaGrowthLearningInput {
  const attributionGrade: AttributionGrade = options.holdoutOrControl ? "Controlled" : options.comparisonGroup ? "Compared" : "Observed"
  const confounders = attributionGrade === "Observed" && options.confounders.length === 0 ? Object.freeze(["confounders not ruled out"]) : Object.freeze([...options.confounders])
  const rejectionReasons: string[] = []
  if (chain.context_snapshot.data_freshness !== "Current") rejectionReasons.push("Critical context is stale.")
  if (chain.context_snapshot.quarantined) rejectionReasons.push("Quarantined context is excluded.")
  if (!chain.independent_verification.verified) rejectionReasons.push("Outcome is unverified.")
  if (chain.independent_verification.self_verified) rejectionReasons.push("Self-verification is excluded.")
  return Object.freeze({
    domain: "Nia Growth" as const, event_id: chain.event_id, action_id: chain.action_id, supply_model: chain.context_snapshot.supply_model,
    proposed_change: `Re-rank eligible ${chain.context_snapshot.supply_model} shadow readiness interventions within the same approved channel.`,
    expected_effect: "Reduce independently verified opportunity-to-activation-ready time without crossing capital or contract boundaries.",
    evidence_cycles: chain.evidence.cycles, sample_size: options.sampleSize, forecast_error_pct: options.forecastErrorPct,
    attribution_grade: attributionGrade, confounders, critical_data_fresh: chain.context_snapshot.data_freshness === "Current",
    verification_rate_pct: options.verificationRatePct, reversible: true,
    rollback_trigger: "Withdraw the proposed ordering if verified ready capacity, coverage quality or activation time deteriorates.",
    inside_approved_boundary: options.insideApprovedBoundary ?? true, reverses_human_decision: options.reversesHumanDecision ?? false,
    affected_human_controlled_categories: Object.freeze([...(options.affectedHumanControlledCategories ?? [])]),
    target_effect: "Increase independently verified activation-ready capacity in the selected supply channel.",
    channel_effect: `Keep ${chain.context_snapshot.supply_model} ranking inside its own playbook; never blend FONO and SP actions.`,
    cm_effect: "No CM formula or value is invented; consume governed projections when available.",
    cash_effect: "No property, lease, capex or cash commitment; recommendation-only outside approved policy.",
    production_confidence: "Low" as const, registry_thresholds_approved: false as const, auto_adopt: false as const,
    eligible_for_shared_learning_gate: rejectionReasons.length === 0, rejection_reasons: Object.freeze(rejectionReasons),
  })
}

function fonoContext(overrides: Partial<GrowthContext> = {}): GrowthContext {
  return {
    opportunityRef: "protected://opportunity/fono-synthetic-01", locationRef: "protected://location/fono-synthetic-01", evidenceRef: "protected://evidence/fono-synthetic-01",
    supplyModel: "FONO", theatre: "Chennai West", displayLocation: "Sriperumbudur cluster", proposedCapacityNests: 160, activationReadyNests: 126, opportunityToReadyDays: 12,
    activationReadinessDelayed: true, readinessBlocker: "franchise base evidence", dataFreshness: "Current", submittedBy: "protected://actor/growth-lead", verifierRef: "protected://verifier/readiness-qa",
    franchiseBaseCommitmentNests: 112, franchiseBaseReadyNests: 92, niaFillSupportReadyNests: 34, niaFillSupportProvided: true, consecutiveBelowBreakevenCycles: 1,
    contractRef: null, signedEnterpriseCoverageNests: null, underwritingAssessment: null, underwritingAssessmentRef: null, capexExposureInr: null, buildOut: null, hardware: null, contractedServices: null,
    ...overrides,
  }
}

function spContext(overrides: Partial<GrowthContext> = {}): GrowthContext {
  return {
    opportunityRef: "protected://opportunity/sp-synthetic-01", locationRef: "protected://location/sp-synthetic-01", evidenceRef: "protected://evidence/sp-synthetic-01",
    supplyModel: "SP", theatre: "Chennai South", displayLocation: "Oragadam park", proposedCapacityNests: 360, activationReadyNests: 240, opportunityToReadyDays: 38,
    activationReadinessDelayed: true, readinessBlocker: "contracted hardware verification", dataFreshness: "Current", submittedBy: "protected://actor/sp-delivery", verifierRef: "protected://verifier/readiness-qa",
    franchiseBaseCommitmentNests: null, franchiseBaseReadyNests: null, niaFillSupportReadyNests: null, niaFillSupportProvided: null, consecutiveBelowBreakevenCycles: null,
    contractRef: "protected://contract/sp-synthetic-01", signedEnterpriseCoverageNests: 260, underwritingAssessment: "Below approved underwriting", underwritingAssessmentRef: "protected://underwriting/sp-synthetic-01",
    capexExposureInr: 24_000_000, buildOut: "Ready", hardware: "Blocked", contractedServices: "Pending evidence", ...overrides,
  }
}

function chainFor(event: GrowthEvent, action: GrowthAction): GrowthLearningChain {
  return {
    event_id: event.eventId, action_id: action.actionId, policy_version: event.policyVersion,
    forecast: { activation_ready_probability_pct: 72, expected_ready_days: event.supplyModel === "FONO" ? 11 : 34, expected_ready_nests: event.context.proposedCapacityNests, expected_contract_coverage_nests: event.context.signedEnterpriseCoverageNests ?? 0 },
    context_snapshot: { opportunity_ref: event.context.opportunityRef, supply_model: event.supplyModel, theatre: event.context.theatre, data_freshness: event.context.dataFreshness, quarantined: false },
    decision: decideNiaGrowth(event), assigned_action: action, evidence: { reference: event.context.evidenceRef, cycles: 2 },
    independent_verification: { verified: true, verifier_ref: event.context.verifierRef ?? "protected://verifier/unavailable", self_verified: false },
    measured_outcome: { activation_ready_nests: event.context.activationReadyNests, ready_days: event.context.opportunityToReadyDays ?? 0, signed_contract_coverage_nests: event.context.signedEnterpriseCoverageNests ?? 0, intervention_recovered_source_metric: false },
    variance_reason: "Synthetic readiness evidence remains incomplete; causal confounders are retained.",
  }
}

function admitted(input: GrowthSignalInput) {
  const result = detectNiaGrowthEvent(input)
  if (result.disposition !== "Admitted") throw new Error(`Synthetic Nia Growth fixture must admit: ${result.reasons.join(" ")}`)
  return result.event
}

export function buildNiaGrowthPreview(): NiaGrowthPreview {
  const fonoEvent = admitted({ eventId: "evt-growth-fono-001", ownerRole: "Theatre lead", dueAt: "2026-07-18T12:00:00+05:30", occurredAt: NIA_GROWTH_AT, context: fonoContext() })
  const spEvent = admitted({ eventId: "evt-growth-sp-001", ownerRole: "SP delivery lead", dueAt: "2026-07-17T18:00:00+05:30", occurredAt: NIA_GROWTH_AT, context: spContext() })
  const fonoAction = assignNiaGrowthAction(fonoEvent, decideNiaGrowth(fonoEvent))
  const spAction = assignNiaGrowthAction(spEvent, decideNiaGrowth(spEvent))
  const fonoVerificationInput: GrowthVerificationInput = Object.freeze({ supplyModel: "FONO", evidenceRef: "protected://evidence/fono-growth-ready", submittedBy: "protected://actor/theatre-lead", verifierRef: "protected://verifier/readiness-qa", dataFreshness: "Current", capacityReadyToSpec: true, activationReadyNests: 126, signedContractCoverageVerified: false, buildOutReady: true, hardwareReadyWhereContracted: true, contractedServicesReady: true, supplyModelContextVerified: true, activityClaimOnly: false, quarantined: false })
  const spVerificationInput: GrowthVerificationInput = Object.freeze({ supplyModel: "SP", evidenceRef: "protected://evidence/sp-growth-partial", submittedBy: "protected://actor/sp-delivery", verifierRef: "protected://verifier/readiness-qa", dataFreshness: "Current", capacityReadyToSpec: false, activationReadyNests: 240, signedContractCoverageVerified: true, buildOutReady: true, hardwareReadyWhereContracted: false, contractedServicesReady: false, supplyModelContextVerified: true, activityClaimOnly: false, quarantined: false })
  const fonoVerification = verifyNiaGrowthReadiness(fonoAction, fonoVerificationInput)
  const spVerification = verifyNiaGrowthReadiness(spAction, spVerificationInput)
  const loopHealth = projectLoopHealth({
    domain: "Nia Growth",
    asOf: NIA_GROWTH_AT,
    feeds: [{ feedId: "growth-readiness", label: "Growth readiness ledger", lastUpdatedAt: "2026-07-17T11:45:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: ["activation-ready capacity", "SP contract coverage"] }],
    clocks: [
      { clockId: "growth-fono-clock", label: "FONO readiness action", ownerRole: fonoAction.ownerRole, dueAt: fonoAction.dueAt, state: fonoVerification.canClose ? "Recovered" : "Running" },
      { clockId: "growth-sp-clock", label: "SP readiness action", ownerRole: spAction.ownerRole, dueAt: spAction.dueAt, state: spVerification.canClose ? "Recovered" : "Running" },
    ],
    verification: { claimed: 2, verified: fonoVerification.canClose ? 1 : 0, awaiting: spVerification.canClose ? 0 : 1, reopened: 0, oldestAwaitingAt: spVerification.canClose ? null : "2026-07-17T18:00:00+05:30" },
    quarantinedRecords: 2,
    dependentClaims: ["activation-ready capacity", "SP contract coverage"],
    synthetic: true,
  })
  const lanes: [GrowthLaneProjection, GrowthLaneProjection] = [
    {
      supplyModel: "FONO", capacityLabel: "Franchise-operated, Nia-supported", plannedNests: 160, activationReadyNests: 126, gapNests: 34, timeToReadyLabel: "12 days · synthetic",
      coverageLabel: "Base 92 · Nia fill 34", coverageDetail: "Franchise base and Nia-fill support stay separate", progressPct: 79,
      stages: Object.freeze([{ label: "Base commitment", value: "92 ready", state: "Open" }, { label: "Nia-fill support", value: "34 ready", state: "Complete" }, { label: "Spec verified", value: "126", state: "Complete" }]),
    },
    {
      supplyModel: "SP", capacityLabel: "Nia-capital park", plannedNests: 360, activationReadyNests: 240, gapNests: 120, timeToReadyLabel: "38 days · synthetic",
      coverageLabel: "260 signed / 360 planned", coverageDetail: "₹2.4 Cr synthetic capex exposure; threshold pending", progressPct: 67,
      stages: Object.freeze([{ label: "Enterprise coverage", value: "260 signed", state: "Open" }, { label: "Build-out", value: "Ready", state: "Complete" }, { label: "Hardware / services", value: "Evidence blocked", state: "Blocked" }]),
    },
  ]
  const tasks: GrowthTaskPreview[] = [
    { actionId: fonoAction.actionId, supplyModel: "FONO", issue: decideNiaGrowth(fonoEvent).rationale, location: fonoAction.displayLocation, owner: fonoAction.ownerRole, dueAt: fonoAction.dueAt, expectedVerifiedResult: fonoAction.expectedVerifiedResult, progress: fonoAction.nextAction, verifiedResult: fonoVerification.status, state: fonoVerification.canClose ? "Verified ready" : fonoAction.state, recommendationOnly: fonoAction.recommendationOnly, engineAction: fonoAction, verificationInput: fonoVerificationInput },
    { actionId: spAction.actionId, supplyModel: "SP", issue: decideNiaGrowth(spEvent).rationale, location: spAction.displayLocation, owner: spAction.ownerRole, dueAt: spAction.dueAt, expectedVerifiedResult: spAction.expectedVerifiedResult, progress: spAction.nextAction, verifiedResult: spVerification.status, state: spVerification.canClose ? "Verified ready" : spAction.state, recommendationOnly: spAction.recommendationOnly, engineAction: spAction, verificationInput: spVerificationInput },
  ]
  const measures: NiaGrowthPreview["measures"] = [
    { id: "ready-capacity", label: "Activation-ready capacity", value: "FONO 126 · SP 240", target: "Plans: 160 · 360", detail: "Independently verified Nests only" },
    { id: "time-to-ready", label: "Opportunity to ready", value: "FONO 12d · SP 38d", target: "SLA pending approval", detail: "No invented time threshold" },
    { id: "fono-health", label: "FONO conversion health", value: "Base 92 · Nia fill 34", target: "Kept separate", detail: "One below-breakeven cycle; review trigger is two" },
    { id: "sp-exposure", label: "SP capital coverage", value: "₹2.4 Cr · 260 signed", target: "Threshold pending", detail: "360 planned Nests · recommendation only" },
  ]
  return Object.freeze({
    fixtureLabel: "Synthetic fixture" as const, mode: "Shadow only" as const, question: NIA_GROWTH_QUESTION,
    source: Object.freeze({ name: "Synthetic Nia Growth readiness projection", asOf: NIA_GROWTH_AT, lastRefreshAt: "2026-07-17T11:45:00+05:30", freshness: "Stale" as const, synthetic: true as const }),
    headline: "Resolve SP coverage and hardware evidence before considering more capital.",
    summary: Object.freeze({ target: "FONO 160 · SP 360", current: "FONO 126 · SP 240", gap: "FONO 34 · SP 120", owner: "CEO/COO + Theatre lead", progress: "FONO 79% · SP 67%", verifiedResult: "Channels verified separately" }),
    measures: Object.freeze(measures),
    lanes: Object.freeze(lanes), tasks: Object.freeze(tasks), despatchEscalations: emitNiaGrowthDespatchEscalations(tasks),
    signOffs: Object.freeze([
      Object.freeze({ id: "SIGN-SP-COVERAGE", supplyModel: "SP" as const, decision: "Underwriting coverage response", owner: "CEO/COO", impact: "Capital remains exposed; no park release", status: "Pending human approval" as const }),
      Object.freeze({ id: "SIGN-FONO-REVIEW", supplyModel: "FONO" as const, decision: "Franchise review only if two governed cycles fail", owner: "Pushkar", impact: "No contract or people decision is automatic", status: "Pending human approval" as const }),
    ]),
    learningInputs: Object.freeze([
      buildNiaGrowthLearningInput(chainFor(fonoEvent, fonoAction), { holdoutOrControl: false, comparisonGroup: true, confounders: ["synthetic theatre mix"], sampleSize: 18, forecastErrorPct: 9, verificationRatePct: 88 }),
      buildNiaGrowthLearningInput(chainFor(spEvent, spAction), { holdoutOrControl: false, comparisonGroup: false, confounders: [], sampleSize: 6, forecastErrorPct: 14, verificationRatePct: 82, affectedHumanControlledCategories: ["Property", "Expansion", "Capex", "Contracts", "Cash"], insideApprovedBoundary: false }),
    ]),
    quarantineCount: 2, policyRegistry: NIA_GROWTH_POLICY_REGISTRY, blockedCapabilities: NIA_GROWTH_BLOCKED_CAPABILITIES, loopHealth,
  })
}
