import type { SupplyModel } from "@/lib/operating-loop/contracts"
import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation, projectLoopHealth, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"

export const NEW_ADDS_AT = "2026-07-17T14:00:00+05:30"

export const NEW_ADDS_QUESTION = "Are vacant FONO Nests filling at the approved run rate, cost and billing standard?"
export const NEW_ADDS_SELF_LEARN_QUESTION = "Which eligible channel produces billing-live FONO fills fastest at the lowest actual CAC?"

export const NEW_ADDS_POLICY_REGISTRY = Object.freeze([
  Object.freeze({ policyId: "POL-NEW-ADDS-CAC-WARNING", value: 100, unit: "INR per billing-live fill", version: 1, effectiveAt: "2026-07-17", approver: "Pushkar / Finance", source: "Locked New Adds control" }),
  Object.freeze({ policyId: "POL-NEW-ADDS-PAYBACK", value: 15, unit: "days", version: 1, effectiveAt: "2026-07-17", approver: "Pushkar / Finance", source: "Locked New Adds control" }),
  Object.freeze({ policyId: "POL-NEW-ADDS-OCCUPANCY-FLOOR", value: 78, unit: "percent", version: 1, effectiveAt: "2026-07-17", approver: "Studio Health governance", source: "Locked New Adds control" }),
  Object.freeze({ policyId: "POL-NEW-ADDS-BILLING-LIVE", value: 1, unit: "billing-live outcome required", version: 1, effectiveAt: "2026-07-17", approver: "Finance and Operations", source: "Locked New Adds outcome definition" }),
] as const)

export const NEW_ADDS_BLOCKED_CAPABILITIES = Object.freeze({
  productionWrites: false,
  externalMessages: false,
  liveWhatsapp: false,
  automaticPolicyChanges: false,
  pricingChanges: false,
  commercialTermChanges: false,
  templateApproval: false,
  peopleDecisions: false,
})

type PolicyId = (typeof NEW_ADDS_POLICY_REGISTRY)[number]["policyId"]

export type NewAddsTrigger = "Membership ended" | "New FONO Studio with unfilled base" | "Arrived Member not billing in 48h" | "Missed fill run rate" | "Actual CAC above control"
export type NewAddsChannel = "Franchisee base" | "Nia digital" | "Nia field" | "Walk-in" | "Referral" | "Returning Member"
export type NewAddsSource = "Franchisee base" | "Nia fill" | "Returning Members"
export type FreshnessStatus = "Current" | "Stale"
export type VerificationStatus = "Awaiting verification" | "Verified" | "Rejected" | "Reopened"
export type RecoveryOutcome = "No answer" | "Failed evidence" | "Billing-live evidence received"

export type CriticalFeedSnapshot = {
  feedId: string
  label: string
  observedAt: string
  ageMinutes: number
  registeredCadenceMinutes: number
  critical: boolean
  freshness: FreshnessStatus
  businessImpact: string
}

export type ChannelEconomics = {
  channel: NewAddsChannel
  source: NewAddsSource
  actualLoadedCac: number
  forecastCac: number
  forecastConversionProbability: number
  forecastHoursToBilling: number
  verified: boolean
  freshness: FreshnessStatus
  niaEligible: boolean
}

export type NewAddsContextSnapshot = {
  studioId: string
  theatre: string
  daysVacant: number
  franchiseeBaseCommitment: number
  verifiedFranchiseeFills: number
  channelEconomics: readonly ChannelEconomics[]
  workDemandWithinCommute: number
  walkInFlow: number
  referralFlow: number
  occupancyPercent: number
  cmEffectInr: number
  priorAttempts: number
  consecutiveBelowBaseCycles: number
  criticalFeeds: readonly CriticalFeedSnapshot[]
}

export type NewAddsSignalInput = {
  eventId: string
  supplyModel: SupplyModel | null
  occurredAt: string
  ownerRole: string
  dueAt: string
  context: NewAddsContextSnapshot
  membershipEnded: boolean
  newStudio: boolean
  unfilledBaseNests: number
  arrivedAt: string | null
  billingLiveAt: string | null
  dailyFillTarget: number
  verifiedBillingLiveFillsToday: number
  actualLoadedCac: number
}

export type NewAddsEvent = NewAddsSignalInput & {
  supplyModel: "FONO"
  triggers: readonly NewAddsTrigger[]
  policyVersion: string
}

export type EventDecision =
  | { disposition: "Admitted"; event: NewAddsEvent; reasons: readonly string[] }
  | { disposition: "Ignored" | "Quarantined"; event: null; reasons: readonly string[] }

export type NewAddsDecision = {
  decisionId: string
  eventId: string
  decisionKind: "base-commitment shortfall" | "Nia channel fill"
  selectedChannel: NewAddsChannel
  ownerRole: string
  expectedConversionProbability: number
  expectedLoadedCac: number
  expectedHoursToBilling: number
  rationale: string
  policyVersion: string
  humanApprovalRequiredForPolicyChange: true
}

export type FillTask = {
  actionId: string
  idempotencyKey: string
  eventId: string
  supplyModel: "FONO"
  theatre: string
  studioId: string
  channel: NewAddsChannel
  ownerRole: string
  dueAt: string
  expectedOutcome: string
  state: "Detected" | "Proposed" | "Assigned" | "Retry scheduled" | "Evidence pending" | "Reopened" | "Verified"
  nextAction: string
  attempts: number
  whatsapp: {
    approvedTemplate: boolean
    memberConsent: boolean
    withinQuietHours: boolean
    liveEnabledIntegration: boolean
    execution: "Shadow only" | "Eligible after human approval"
  }
}

export type FillEvidenceInput = {
  closureId: string
  memberId: string
  activationValid: boolean
  billingLive: boolean
  arrivedAt: string
  billingLiveAt: string | null
  duplicateOfClosureId: string | null
  actualLoadedCac: number | null
  evidenceRef: string | null
  submittedBy: string
  verifierIdentity: string | null
  verifierReference: string | null
  dataFreshness: FreshnessStatus
  quarantined: boolean
}

export type VerifiedFillOutcome = {
  status: VerificationStatus
  closureId: string
  memberId: string
  actualLoadedCac: number | null
  hoursToBilling: number | null
  verifierIdentity: string | null
  verifierReference: string | null
  reasons: readonly string[]
}

export type NewAddsShadowTransition = {
  task: FillTask
  verification: VerifiedFillOutcome | null
  route: string
}

export type NewAddsEscalation = {
  escalationId: string
  eventId: string
  issue: string
  ownerRole: "Theatre lead" | "Franchise review" | "Pushkar / Finance" | "Studio Health"
  dueAt: string
}

export type NewAddsLearningChain = {
  event_id: string
  action_id: string
  supply_model: "FONO"
  theatre: string
  owner_role: string
  due_at: string
  data_freshness: FreshnessStatus
  policy_version: string
  forecast: { channel: NewAddsChannel; conversion_probability: number; loaded_cac: number; hours_to_billing: number }
  context_snapshot: NewAddsContextSnapshot
  decision: NewAddsDecision
  assigned_action: FillTask
  evidence: FillEvidenceInput
  independent_verification: { status: VerificationStatus; verifier_identity: string | null; verifier_reference: string | null }
  measured_outcome: { billing_live: boolean; actual_loaded_cac: number | null; hours_to_billing: number | null; recovered_source_metric: boolean }
  variance_reason: string
}

export type NewAddsLearningRow = {
  eventId: string
  actionId: string
  theatre: string
  channel: NewAddsChannel
  ownerRole: string
  dueAt: string
  expectedConversionProbability: number
  converted: boolean
  expectedLoadedCac: number
  actualLoadedCac: number
  expectedHoursToBilling: number
  actualHoursToBilling: number
  recoveredSourceMetric: boolean
  varianceReason: string
  verifierIdentity: string
  verifierReference: string
}

export type NewAddsLearningProjection = {
  question: typeof NEW_ADDS_SELF_LEARN_QUESTION
  accepted: readonly NewAddsLearningRow[]
  rejected: readonly { eventId: string; reasons: readonly string[] }[]
  proposedCalibration: readonly { channel: NewAddsChannel; proposal: string; autoApplied: false; requiresHumanApproval: true }[]
  protectedPolicyChanges: readonly string[]
}

export type NewAddsLoopHealthInputs = {
  domain: "New Adds"
  synthetic: true
  quarantinedRecords: number
  feeds: readonly (CriticalFeedSnapshot & { dependentMetricIds: readonly string[] })[]
  clocks: readonly { clockId: string; eventId: string; entity: string; startedAt: string; dueAt: string; status: "Active" | "Breached"; ownerRole: string }[]
  verification: { claimedClosures: number; verifiedClosures: number; awaitingVerification: number; reopenedActions: number; closureIds: readonly string[] }
  metricDependencies: readonly { metricId: string; sourceFeedIds: readonly string[]; dependentClosureIds: readonly string[] }[]
}

export type TheatreFillProjection = {
  theatre: string
  ownerRole: string
  vacantNests: number
  verifiedBillingLiveFills: number
  dailyTarget: number
  daysToFill: number
  averageFillTimeLabel?: string
}

export type NewAddsMeasureChart =
  | { kind: "progress"; value: number; max: number; unit?: string }
  | { kind: "segments"; parts: readonly { label: string; value: number }[] }
  | { kind: "threshold"; value: number; target: number; unit: string; goodWhenUnder: boolean }

export type NewAddsPreview = {
  mode: "Shadow only"
  fixtureLabel: "Synthetic fixture"
  question: string
  headline: string
  source: { name: string; asOf: string; lastRefreshAt: string; freshness: FreshnessStatus; synthetic: true }
  taskSummary: { target: number; current: number; gap: number; owner: string; progressPercent: number; verifiedResult: string }
  measures: readonly [
    { id: "verified-fills"; label: string; primary: string; secondary: string; chart: NewAddsMeasureChart },
    { id: "adds-by-source"; label: string; primary: string; secondary: string; chart: NewAddsMeasureChart },
    { id: "cac-payback"; label: string; primary: string; secondary: string; chart: NewAddsMeasureChart },
    { id: "arrival-billing"; label: string; primary: string; secondary: string; chart: NewAddsMeasureChart },
  ]
  theatres: readonly TheatreFillProjection[]
  actions: readonly FillTask[]
  escalations: readonly NewAddsEscalation[]
  despatchEscalations: readonly DespatchEscalationRecord[]
  quarantineCount: number
  policyRegistry: typeof NEW_ADDS_POLICY_REGISTRY
  blockedCapabilities: typeof NEW_ADDS_BLOCKED_CAPABILITIES
  loopHealthInputs: NewAddsLoopHealthInputs
  loopHealth: LoopHealth
  learningProjection: NewAddsLearningProjection
}

function protectedReference(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("protected://")
}

function policyNumber(id: PolicyId) {
  const policy = NEW_ADDS_POLICY_REGISTRY.find((candidate) => candidate.policyId === id)
  if (!policy) throw new Error(`Missing New Adds policy ${id}.`)
  return policy.value
}

function hoursBetween(start: string, end: string) {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 3_600_000)
}

function policyVersion() {
  return NEW_ADDS_POLICY_REGISTRY.map((policy) => `${policy.policyId}@v${policy.version}`).join("|")
}

export function detectNewAddsEvent(input: NewAddsSignalInput, at = NEW_ADDS_AT): EventDecision {
  if (input.supplyModel !== "FONO") {
    const reason = input.supplyModel === "SP" ? "SP context is quarantined from the FONO-only New Adds loop." : "Missing supply_model is quarantined; it is never inferred."
    return Object.freeze({ disposition: "Quarantined" as const, event: null, reasons: Object.freeze([reason]) })
  }

  const triggers: NewAddsTrigger[] = []
  if (input.membershipEnded) triggers.push("Membership ended")
  if (input.newStudio && input.unfilledBaseNests > 0) triggers.push("New FONO Studio with unfilled base")
  if (input.arrivedAt && !input.billingLiveAt && hoursBetween(input.arrivedAt, at) >= 48) triggers.push("Arrived Member not billing in 48h")
  if (input.verifiedBillingLiveFillsToday < input.dailyFillTarget) triggers.push("Missed fill run rate")
  if (input.actualLoadedCac > policyNumber("POL-NEW-ADDS-CAC-WARNING")) triggers.push("Actual CAC above control")
  if (triggers.length === 0) return Object.freeze({ disposition: "Ignored" as const, event: null, reasons: Object.freeze(["No governed New Adds trigger is active."]) })

  const event: NewAddsEvent = Object.freeze({ ...input, supplyModel: "FONO", triggers: Object.freeze(triggers), policyVersion: policyVersion() })
  return Object.freeze({ disposition: "Admitted" as const, event, reasons: Object.freeze(triggers.map((trigger) => `${trigger} detected.`)) })
}

function eligibleNiaChannels(event: NewAddsEvent) {
  return event.context.channelEconomics
    .filter((row) => row.niaEligible && row.verified && row.freshness === "Current")
    .map((row) => ({ row, score: row.forecastConversionProbability / Math.max(row.actualLoadedCac, 1) / Math.max(row.forecastHoursToBilling, 1) }))
    .sort((left, right) => right.score - left.score || left.row.actualLoadedCac - right.row.actualLoadedCac)
}

export function decideNewAdds(event: NewAddsEvent): NewAddsDecision {
  const belowBase = event.context.verifiedFranchiseeFills < event.context.franchiseeBaseCommitment
  if (belowBase) {
    const base = event.context.channelEconomics.find((row) => row.channel === "Franchisee base")
    if (!base || !base.verified || base.freshness !== "Current") throw new Error("Verified current franchisee-base economics are required for a base-commitment shortfall.")
    return Object.freeze({
      decisionId: `DEC-${event.eventId}`,
      eventId: event.eventId,
      decisionKind: "base-commitment shortfall" as const,
      selectedChannel: "Franchisee base" as const,
      ownerRole: "Franchisee Success Lead",
      expectedConversionProbability: base.forecastConversionProbability,
      expectedLoadedCac: base.forecastCac,
      expectedHoursToBilling: base.forecastHoursToBilling,
      rationale: `Verified franchisee fills ${event.context.verifiedFranchiseeFills}/${event.context.franchiseeBaseCommitment}; restore the base commitment before Nia channels.`,
      policyVersion: event.policyVersion,
      humanApprovalRequiredForPolicyChange: true as const,
    })
  }

  const selected = eligibleNiaChannels(event)[0]?.row
  if (!selected) throw new Error("No eligible Nia channel has verified current economics.")
  return Object.freeze({
    decisionId: `DEC-${event.eventId}`,
    eventId: event.eventId,
    decisionKind: "Nia channel fill" as const,
    selectedChannel: selected.channel,
    ownerRole: event.ownerRole,
    expectedConversionProbability: selected.forecastConversionProbability,
    expectedLoadedCac: selected.forecastCac,
    expectedHoursToBilling: selected.forecastHoursToBilling,
    rationale: `${selected.channel} ranks first on verified cost, conversion probability and time-to-billing within the current policy bounds.`,
    policyVersion: event.policyVersion,
    humanApprovalRequiredForPolicyChange: true as const,
  })
}

export function createFillTask(event: NewAddsEvent, decision: NewAddsDecision, gates = { approvedTemplate: false, memberConsent: false, withinQuietHours: false, liveEnabledIntegration: false }): FillTask {
  const execution = gates.approvedTemplate && gates.memberConsent && gates.withinQuietHours && gates.liveEnabledIntegration ? "Eligible after human approval" : "Shadow only"
  return Object.freeze({
    actionId: `ACT-${event.eventId}`,
    idempotencyKey: `new-adds:${event.eventId}:${decision.policyVersion}`,
    eventId: event.eventId,
    supplyModel: "FONO" as const,
    theatre: event.context.theatre,
    studioId: event.context.studioId,
    channel: decision.selectedChannel,
    ownerRole: decision.ownerRole,
    dueAt: event.dueAt,
    expectedOutcome: `${Math.max(1, event.dailyFillTarget - event.verifiedBillingLiveFillsToday)} unique FONO Member fills reach billing-live.`,
    state: "Assigned" as const,
    nextAction: decision.decisionKind === "base-commitment shortfall" ? "Restore the verified franchisee base commitment." : `Run the verified ${decision.selectedChannel} fill playbook.`,
    attempts: event.context.priorAttempts,
    whatsapp: Object.freeze({ ...gates, execution }),
  })
}

export function verifyBillingLiveOutcome(input: FillEvidenceInput): VerifiedFillOutcome {
  const reasons: string[] = []
  if (!input.memberId.trim()) reasons.push("A unique Member identifier is required.")
  if (!input.activationValid) reasons.push("Member activation is invalid.")
  if (!input.billingLive || !input.billingLiveAt) reasons.push("Billing-live evidence is required.")
  if (input.duplicateOfClosureId) reasons.push("The fill duplicates an existing closure.")
  if (input.actualLoadedCac === null || input.actualLoadedCac < 0) reasons.push("Actual loaded CAC is required.")
  if (!protectedReference(input.evidenceRef)) reasons.push("A protected evidence reference is required.")
  if (!input.verifierIdentity || !protectedReference(input.verifierReference)) reasons.push("Verifier identity and protected reference are required.")
  if (input.verifierIdentity === input.submittedBy) reasons.push("Self-verification is not independent.")
  if (input.dataFreshness === "Stale") reasons.push("Critical outcome inputs are stale.")
  if (input.quarantined) reasons.push("Quarantined evidence cannot close or learn.")
  const verified = reasons.length === 0
  return Object.freeze({
    status: verified ? "Verified" as const : "Rejected" as const,
    closureId: input.closureId,
    memberId: input.memberId,
    actualLoadedCac: verified ? input.actualLoadedCac : null,
    hoursToBilling: verified && input.billingLiveAt ? hoursBetween(input.arrivedAt, input.billingLiveAt) : null,
    verifierIdentity: input.verifierIdentity,
    verifierReference: input.verifierReference,
    reasons: Object.freeze(reasons),
  })
}

export function recoverFillTask(task: FillTask, outcome: RecoveryOutcome, occurredAt: string): FillTask {
  if (outcome === "No answer") return Object.freeze({ ...task, state: "Retry scheduled" as const, attempts: task.attempts + 1, dueAt: new Date(Date.parse(occurredAt) + 2 * 3_600_000).toISOString(), nextAction: "Retry the same idempotent fill task in two hours." })
  if (outcome === "Failed evidence") return Object.freeze({ ...task, state: "Reopened" as const, attempts: task.attempts + 1, nextAction: "Collect corrected evidence and resubmit for independent verification." })
  return Object.freeze({ ...task, state: "Evidence pending" as const, nextAction: "Independent billing-live verification queued." })
}

export function resolveNewAddsShadowOutcome(task: FillTask, outcome: RecoveryOutcome, occurredAt: string): NewAddsShadowTransition {
  const recoveredTask = recoverFillTask(task, outcome, occurredAt)
  if (outcome !== "Billing-live evidence received") {
    return Object.freeze({ task: recoveredTask, verification: null, route: recoveredTask.nextAction })
  }

  const verification = verifyBillingLiveOutcome({
    closureId: `SHADOW-CLOSURE-${task.actionId}`,
    memberId: `MEMBER-SYNTH-${task.actionId}`,
    activationValid: true,
    billingLive: true,
    arrivedAt: new Date(Date.parse(occurredAt) - 24 * 3_600_000).toISOString(),
    billingLiveAt: occurredAt,
    duplicateOfClosureId: null,
    actualLoadedCac: 82,
    evidenceRef: `protected://new-adds/evidence/${task.actionId}`,
    submittedBy: task.ownerRole,
    verifierIdentity: "Independent Billing Verifier",
    verifierReference: `protected://new-adds/verifier/${task.actionId}`,
    dataFreshness: "Current",
    quarantined: false,
  })
  const verifiedTask = verification.status === "Verified"
    ? Object.freeze({ ...recoveredTask, state: "Verified" as const, nextAction: "Local shadow closure independently verified; no Production state changed." })
    : recoveredTask
  return Object.freeze({ task: verifiedTask, verification, route: verifiedTask.nextAction })
}

export function remainingFillRunRate(dailyTarget: number, verifiedFills: number, missedFillsCarried: number, remainingHours: number) {
  if (remainingHours <= 0) throw new Error("Remaining operating hours must be positive.")
  const gap = Math.max(0, dailyTarget - verifiedFills)
  const remainingFills = gap + Math.max(0, missedFillsCarried)
  return Object.freeze({ gap, missedFillsCarried: Math.max(0, missedFillsCarried), remainingFills, requiredPerHour: Math.ceil(remainingFills / remainingHours) })
}

export function escalateNewAdds(event: NewAddsEvent, task: FillTask, at = NEW_ADDS_AT): readonly NewAddsEscalation[] {
  const rows: NewAddsEscalation[] = []
  if (Date.parse(task.dueAt) < Date.parse(at)) rows.push({ escalationId: `ESC-OVERDUE-${event.eventId}`, eventId: event.eventId, issue: "Fill task is overdue.", ownerRole: "Theatre lead", dueAt: at })
  if (event.context.consecutiveBelowBaseCycles >= 2) rows.push({ escalationId: `ESC-BASE-${event.eventId}`, eventId: event.eventId, issue: "Two cycles below the verified base commitment.", ownerRole: "Franchise review", dueAt: event.dueAt })
  if (event.actualLoadedCac > policyNumber("POL-NEW-ADDS-CAC-WARNING")) rows.push({ escalationId: `ESC-CAC-${event.eventId}`, eventId: event.eventId, issue: `Actual loaded CAC ₹${event.actualLoadedCac} is above ₹${policyNumber("POL-NEW-ADDS-CAC-WARNING")}.`, ownerRole: "Pushkar / Finance", dueAt: event.dueAt })
  if (event.context.occupancyPercent < policyNumber("POL-NEW-ADDS-OCCUPANCY-FLOOR")) rows.push({ escalationId: `ESC-OCC-${event.eventId}`, eventId: event.eventId, issue: `Studio occupancy ${event.context.occupancyPercent}% is below ${policyNumber("POL-NEW-ADDS-OCCUPANCY-FLOOR")}%.`, ownerRole: "Studio Health", dueAt: event.dueAt })
  return Object.freeze(rows)
}

export function emitNewAddsDespatchEscalations(event: NewAddsEvent, task: FillTask, at = NEW_ADDS_AT): readonly DespatchEscalationRecord[] {
  return Object.freeze(escalateNewAdds(event, task, at).map((row) => createDespatchEscalation({
    escalationId: row.escalationId,
    domain: "New Adds",
    sourceActionId: task.actionId,
    sourceEventId: event.eventId,
    title: row.issue,
    reason: row.issue,
    ownerRole: row.ownerRole,
    dueAt: row.dueAt,
    raisedAt: at,
    severity: Date.parse(row.dueAt) < Date.parse(at) || row.ownerRole === "Pushkar / Finance" ? "Breach" : "Attention",
    status: "Open",
    evidenceRefs: [`protected://new-adds/escalation/${row.escalationId}`],
    synthetic: true,
  })))
}

export function buildLearningChain(event: NewAddsEvent, decision: NewAddsDecision, action: FillTask, evidence: FillEvidenceInput, verification: VerifiedFillOutcome, varianceReason: string, recoveredSourceMetric: boolean): NewAddsLearningChain {
  return Object.freeze({
    event_id: event.eventId,
    action_id: action.actionId,
    supply_model: "FONO" as const,
    theatre: event.context.theatre,
    owner_role: action.ownerRole,
    due_at: action.dueAt,
    data_freshness: evidence.dataFreshness,
    policy_version: event.policyVersion,
    forecast: Object.freeze({ channel: decision.selectedChannel, conversion_probability: decision.expectedConversionProbability, loaded_cac: decision.expectedLoadedCac, hours_to_billing: decision.expectedHoursToBilling }),
    context_snapshot: event.context,
    decision,
    assigned_action: action,
    evidence,
    independent_verification: Object.freeze({ status: verification.status, verifier_identity: verification.verifierIdentity, verifier_reference: verification.verifierReference }),
    measured_outcome: Object.freeze({ billing_live: verification.status === "Verified", actual_loaded_cac: verification.actualLoadedCac, hours_to_billing: verification.hoursToBilling, recovered_source_metric: recoveredSourceMetric }),
    variance_reason: varianceReason,
  })
}

export function projectNewAddsLearning(chains: readonly NewAddsLearningChain[]): NewAddsLearningProjection {
  const accepted: NewAddsLearningRow[] = []
  const rejected: { eventId: string; reasons: readonly string[] }[] = []
  for (const chain of chains) {
    const reasons: string[] = []
    if (chain.supply_model !== "FONO") reasons.push("Learning accepts FONO only.")
    if (chain.data_freshness === "Stale" || chain.context_snapshot.criticalFeeds.some((feed) => feed.critical && feed.freshness === "Stale")) reasons.push("Critical learning inputs are stale.")
    if (chain.evidence.quarantined) reasons.push("Quarantined evidence cannot learn.")
    if (chain.independent_verification.status !== "Verified") reasons.push("Closure is not independently verified.")
    if (chain.independent_verification.verifier_identity === chain.evidence.submittedBy) reasons.push("Self-verification cannot learn.")
    if (!chain.independent_verification.verifier_identity || !protectedReference(chain.independent_verification.verifier_reference)) reasons.push("Protected verifier lineage is missing.")
    if (!chain.measured_outcome.billing_live || chain.measured_outcome.actual_loaded_cac === null || chain.measured_outcome.hours_to_billing === null) reasons.push("A measured billing-live outcome is incomplete.")
    if (reasons.length > 0) {
      rejected.push(Object.freeze({ eventId: chain.event_id, reasons: Object.freeze(reasons) }))
      continue
    }
    accepted.push(Object.freeze({
      eventId: chain.event_id,
      actionId: chain.action_id,
      theatre: chain.theatre,
      channel: chain.forecast.channel,
      ownerRole: chain.owner_role,
      dueAt: chain.due_at,
      expectedConversionProbability: chain.forecast.conversion_probability,
      converted: chain.measured_outcome.billing_live,
      expectedLoadedCac: chain.forecast.loaded_cac,
      actualLoadedCac: chain.measured_outcome.actual_loaded_cac!,
      expectedHoursToBilling: chain.forecast.hours_to_billing,
      actualHoursToBilling: chain.measured_outcome.hours_to_billing!,
      recoveredSourceMetric: chain.measured_outcome.recovered_source_metric,
      varianceReason: chain.variance_reason,
      verifierIdentity: chain.independent_verification.verifier_identity!,
      verifierReference: chain.independent_verification.verifier_reference!,
    }))
  }

  const channels = [...new Set(accepted.map((row) => row.channel))]
  const proposedCalibration = channels.map((channel) => Object.freeze({ channel, proposal: `Compare ${channel} forecast ranking with independently verified CAC, conversion and time-to-billing; calibration remains within current bounds.`, autoApplied: false as const, requiresHumanApproval: true as const }))
  return Object.freeze({
    question: NEW_ADDS_SELF_LEARN_QUESTION,
    accepted: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
    proposedCalibration: Object.freeze(proposedCalibration),
    protectedPolicyChanges: Object.freeze(["CAC controls", "pricing", "commercial terms", "message templates", "people decisions", "safety controls"]),
  })
}

export function buildNewAddsLoopHealthInputs(feeds: readonly CriticalFeedSnapshot[], events: readonly NewAddsEvent[], tasks: readonly FillTask[], outcomes: readonly VerifiedFillOutcome[], quarantinedRecords = 0): NewAddsLoopHealthInputs {
  const metricDependencies = Object.freeze([
    Object.freeze({ metricId: "new-adds.verified-fills", sourceFeedIds: Object.freeze(["FEED-FONO-MEMBERSHIP", "FEED-BILLING-LIVE"]), dependentClosureIds: Object.freeze(outcomes.map((row) => row.closureId)) }),
    Object.freeze({ metricId: "new-adds.cac-payback", sourceFeedIds: Object.freeze(["FEED-CHANNEL-COST", "FEED-BILLING-LIVE"]), dependentClosureIds: Object.freeze(outcomes.map((row) => row.closureId)) }),
    Object.freeze({ metricId: "new-adds.arrival-billing", sourceFeedIds: Object.freeze(["FEED-FONO-MEMBERSHIP", "FEED-BILLING-LIVE"]), dependentClosureIds: Object.freeze(outcomes.map((row) => row.closureId)) }),
  ])
  return Object.freeze({
    domain: "New Adds" as const,
    synthetic: true as const,
    quarantinedRecords,
    feeds: Object.freeze(feeds.map((feed) => Object.freeze({ ...feed, dependentMetricIds: Object.freeze(metricDependencies.filter((metric) => metric.sourceFeedIds.includes(feed.feedId)).map((metric) => metric.metricId)) }))),
    clocks: Object.freeze(tasks.map((task) => Object.freeze({ clockId: `CLOCK-${task.actionId}`, eventId: task.eventId, entity: task.studioId, startedAt: events.find((event) => event.eventId === task.eventId)?.occurredAt ?? NEW_ADDS_AT, dueAt: task.dueAt, status: Date.parse(task.dueAt) < Date.parse(NEW_ADDS_AT) ? "Breached" as const : "Active" as const, ownerRole: task.ownerRole }))),
    verification: Object.freeze({ claimedClosures: outcomes.length, verifiedClosures: outcomes.filter((row) => row.status === "Verified").length, awaitingVerification: outcomes.filter((row) => row.status === "Awaiting verification").length, reopenedActions: outcomes.filter((row) => row.status === "Reopened").length, closureIds: Object.freeze(outcomes.map((row) => row.closureId)) }),
    metricDependencies,
  })
}

export function projectNewAddsLoopHealth(input: NewAddsLoopHealthInputs, asOf = NEW_ADDS_AT): LoopHealth {
  return projectLoopHealth({
    domain: "New Adds",
    asOf,
    feeds: input.feeds.map((feed) => ({
      feedId: feed.feedId,
      label: feed.label,
      lastUpdatedAt: feed.observedAt,
      cadenceMinutes: feed.registeredCadenceMinutes,
      critical: feed.critical,
      affectedClaims: feed.dependentMetricIds,
    })),
    clocks: input.clocks.map((clock) => ({
      clockId: clock.clockId,
      label: `${clock.entity} fill recovery`,
      ownerRole: clock.ownerRole,
      dueAt: clock.dueAt,
      state: tasksStateForClock(input, clock.clockId),
    })),
    verification: {
      claimed: input.verification.claimedClosures,
      verified: input.verification.verifiedClosures,
      awaiting: input.verification.awaitingVerification,
      reopened: input.verification.reopenedActions,
      oldestAwaitingAt: input.verification.awaitingVerification > 0 ? input.clocks[0]?.startedAt ?? asOf : null,
    },
    quarantinedRecords: input.quarantinedRecords,
    dependentClaims: input.metricDependencies.map((metric) => metric.metricId),
    synthetic: true,
  })
}

function tasksStateForClock(input: NewAddsLoopHealthInputs, clockId: string): "Running" | "Recovered" {
  const clock = input.clocks.find((candidate) => candidate.clockId === clockId)
  return clock?.status === "Active" || clock?.status === "Breached" ? "Running" : "Recovered"
}

const CURRENT_FEEDS: readonly CriticalFeedSnapshot[] = Object.freeze([
  Object.freeze({ feedId: "FEED-FONO-MEMBERSHIP", label: "FONO membership and occupancy", observedAt: "2026-07-17T13:45:00+05:30", ageMinutes: 15, registeredCadenceMinutes: 60, critical: true, freshness: "Current", businessImpact: "Vacancy, arrivals and unique Member identity" }),
  Object.freeze({ feedId: "FEED-BILLING-LIVE", label: "Billing-live outcomes", observedAt: "2026-07-17T13:30:00+05:30", ageMinutes: 30, registeredCadenceMinutes: 60, critical: true, freshness: "Current", businessImpact: "Verified fills and arrival-to-billing time" }),
  Object.freeze({ feedId: "FEED-CHANNEL-COST", label: "Loaded channel cost", observedAt: "2026-07-17T12:00:00+05:30", ageMinutes: 120, registeredCadenceMinutes: 240, critical: true, freshness: "Current", businessImpact: "Actual CAC and payback" }),
])

const CHANNELS_ORAGADAM: readonly ChannelEconomics[] = Object.freeze([
  Object.freeze({ channel: "Franchisee base", source: "Franchisee base", actualLoadedCac: 38, forecastCac: 40, forecastConversionProbability: 0.72, forecastHoursToBilling: 26, verified: true, freshness: "Current", niaEligible: false }),
  Object.freeze({ channel: "Referral", source: "Nia fill", actualLoadedCac: 74, forecastCac: 78, forecastConversionProbability: 0.64, forecastHoursToBilling: 30, verified: true, freshness: "Current", niaEligible: true }),
  Object.freeze({ channel: "Nia field", source: "Nia fill", actualLoadedCac: 86, forecastCac: 84, forecastConversionProbability: 0.59, forecastHoursToBilling: 34, verified: true, freshness: "Current", niaEligible: true }),
])

const CHANNELS_SRIPERUMBUDUR: readonly ChannelEconomics[] = Object.freeze([
  Object.freeze({ channel: "Franchisee base", source: "Franchisee base", actualLoadedCac: 44, forecastCac: 45, forecastConversionProbability: 0.68, forecastHoursToBilling: 29, verified: true, freshness: "Current", niaEligible: false }),
  Object.freeze({ channel: "Referral", source: "Nia fill", actualLoadedCac: 104, forecastCac: 92, forecastConversionProbability: 0.67, forecastHoursToBilling: 32, verified: true, freshness: "Current", niaEligible: true }),
  Object.freeze({ channel: "Nia digital", source: "Nia fill", actualLoadedCac: 96, forecastCac: 88, forecastConversionProbability: 0.55, forecastHoursToBilling: 41, verified: true, freshness: "Current", niaEligible: true }),
  Object.freeze({ channel: "Returning Member", source: "Returning Members", actualLoadedCac: 42, forecastCac: 45, forecastConversionProbability: 0.74, forecastHoursToBilling: 20, verified: true, freshness: "Current", niaEligible: true }),
])

export const NEW_ADDS_SIGNAL_FIXTURES: readonly NewAddsSignalInput[] = Object.freeze([
  Object.freeze({ eventId: "EVT-NEW-ADDS-ORA-01", supplyModel: "FONO", occurredAt: "2026-07-17T09:00:00+05:30", ownerRole: "Oragadam Theatre JCO", dueAt: "2026-07-17T15:00:00+05:30", membershipEnded: true, newStudio: false, unfilledBaseNests: 5, arrivedAt: null, billingLiveAt: null, dailyFillTarget: 12, verifiedBillingLiveFillsToday: 8, actualLoadedCac: 86, context: Object.freeze({ studioId: "STUDIO-FONO-ORA-07", theatre: "Oragadam", daysVacant: 5, franchiseeBaseCommitment: 20, verifiedFranchiseeFills: 15, channelEconomics: CHANNELS_ORAGADAM, workDemandWithinCommute: 34, walkInFlow: 7, referralFlow: 11, occupancyPercent: 82, cmEffectInr: -11800, priorAttempts: 1, consecutiveBelowBaseCycles: 1, criticalFeeds: CURRENT_FEEDS }) }),
  Object.freeze({ eventId: "EVT-NEW-ADDS-SRI-02", supplyModel: "FONO", occurredAt: "2026-07-17T07:30:00+05:30", ownerRole: "Sriperumbudur Demand JCO", dueAt: "2026-07-17T12:30:00+05:30", membershipEnded: false, newStudio: true, unfilledBaseNests: 9, arrivedAt: "2026-07-15T07:00:00+05:30", billingLiveAt: null, dailyFillTarget: 8, verifiedBillingLiveFillsToday: 4, actualLoadedCac: 104, context: Object.freeze({ studioId: "STUDIO-FONO-SRI-04", theatre: "Sriperumbudur", daysVacant: 8, franchiseeBaseCommitment: 16, verifiedFranchiseeFills: 16, channelEconomics: CHANNELS_SRIPERUMBUDUR, workDemandWithinCommute: 21, walkInFlow: 4, referralFlow: 13, occupancyPercent: 74, cmEffectInr: -16400, priorAttempts: 2, consecutiveBelowBaseCycles: 2, criticalFeeds: CURRENT_FEEDS }) }),
  Object.freeze({ eventId: "EVT-NEW-ADDS-HOS-03", supplyModel: "FONO", occurredAt: "2026-07-17T10:00:00+05:30", ownerRole: "Hosur Theatre JCO", dueAt: "2026-07-17T16:00:00+05:30", membershipEnded: false, newStudio: false, unfilledBaseNests: 2, arrivedAt: null, billingLiveAt: null, dailyFillTarget: 4, verifiedBillingLiveFillsToday: 3, actualLoadedCac: 42, context: Object.freeze({ studioId: "STUDIO-FONO-HOS-02", theatre: "Hosur", daysVacant: 6, franchiseeBaseCommitment: 10, verifiedFranchiseeFills: 10, channelEconomics: CHANNELS_SRIPERUMBUDUR, workDemandWithinCommute: 18, walkInFlow: 3, referralFlow: 5, occupancyPercent: 80, cmEffectInr: -4200, priorAttempts: 0, consecutiveBelowBaseCycles: 0, criticalFeeds: CURRENT_FEEDS }) }),
  Object.freeze({ eventId: "EVT-NEW-ADDS-SP-QUARANTINE", supplyModel: "SP", occurredAt: "2026-07-17T10:00:00+05:30", ownerRole: "Supply JCO", dueAt: "2026-07-17T16:00:00+05:30", membershipEnded: true, newStudio: false, unfilledBaseNests: 10, arrivedAt: null, billingLiveAt: null, dailyFillTarget: 10, verifiedBillingLiveFillsToday: 0, actualLoadedCac: 80, context: Object.freeze({ studioId: "STUDIO-SP-01", theatre: "Oragadam", daysVacant: 4, franchiseeBaseCommitment: 0, verifiedFranchiseeFills: 0, channelEconomics: CHANNELS_ORAGADAM, workDemandWithinCommute: 10, walkInFlow: 0, referralFlow: 0, occupancyPercent: 70, cmEffectInr: -20000, priorAttempts: 0, consecutiveBelowBaseCycles: 0, criticalFeeds: CURRENT_FEEDS }) }),
  Object.freeze({ eventId: "EVT-NEW-ADDS-MISSING-QUARANTINE", supplyModel: null, occurredAt: "2026-07-17T10:00:00+05:30", ownerRole: "Supply JCO", dueAt: "2026-07-17T16:00:00+05:30", membershipEnded: true, newStudio: false, unfilledBaseNests: 4, arrivedAt: null, billingLiveAt: null, dailyFillTarget: 4, verifiedBillingLiveFillsToday: 0, actualLoadedCac: 70, context: Object.freeze({ studioId: "STUDIO-UNKNOWN-01", theatre: "Unknown", daysVacant: 2, franchiseeBaseCommitment: 0, verifiedFranchiseeFills: 0, channelEconomics: CHANNELS_ORAGADAM, workDemandWithinCommute: 0, walkInFlow: 0, referralFlow: 0, occupancyPercent: 0, cmEffectInr: 0, priorAttempts: 0, consecutiveBelowBaseCycles: 0, criticalFeeds: CURRENT_FEEDS }) }),
])

const VERIFIED_EVIDENCE: FillEvidenceInput = Object.freeze({ closureId: "CLOSURE-NEW-ADDS-ORA-01", memberId: "MEMBER-SYNTH-ORA-101", activationValid: true, billingLive: true, arrivedAt: "2026-07-16T08:00:00+05:30", billingLiveAt: "2026-07-17T13:00:00+05:30", duplicateOfClosureId: null, actualLoadedCac: 82, evidenceRef: "protected://new-adds/evidence/ora-01", submittedBy: "Oragadam Theatre JCO", verifierIdentity: "Independent Billing Verifier", verifierReference: "protected://new-adds/verifier/ora-01", dataFreshness: "Current", quarantined: false })

export function buildNewAddsPreview(): NewAddsPreview {
  const decisions = NEW_ADDS_SIGNAL_FIXTURES.map((fixture) => detectNewAddsEvent(fixture))
  const events = decisions.filter((decision): decision is Extract<EventDecision, { disposition: "Admitted" }> => decision.disposition === "Admitted").map((decision) => decision.event)
  const actions = events.map((event) => createFillTask(event, decideNewAdds(event)))
  const verification = verifyBillingLiveOutcome(VERIFIED_EVIDENCE)
  const goodEvent = events[0]
  const goodDecision = decideNewAdds(goodEvent)
  const goodAction = actions[0]
  const goodChain = buildLearningChain(goodEvent, goodDecision, goodAction, VERIFIED_EVIDENCE, verification, "Billing-live took five hours longer than forecast because the Member arrived after the first billing cut-off.", true)
  const rejectedChain = Object.freeze({ ...goodChain, event_id: "EVT-NEW-ADDS-LEARN-REJECT", data_freshness: "Stale" as const, evidence: Object.freeze({ ...VERIFIED_EVIDENCE, closureId: "CLOSURE-LEARN-REJECT", verifierIdentity: "Oragadam Theatre JCO", submittedBy: "Oragadam Theatre JCO", dataFreshness: "Stale" as const }), independent_verification: Object.freeze({ status: "Rejected" as const, verifier_identity: "Oragadam Theatre JCO", verifier_reference: "protected://new-adds/verifier/rejected" }) })
  const outcomes: readonly VerifiedFillOutcome[] = Object.freeze([verification, Object.freeze({ status: "Awaiting verification" as const, closureId: "CLOSURE-NEW-ADDS-SRI-02", memberId: "MEMBER-SYNTH-SRI-202", actualLoadedCac: null, hoursToBilling: null, verifierIdentity: null, verifierReference: null, reasons: Object.freeze(["Independent verification pending."]) })])
  const theatres: readonly TheatreFillProjection[] = Object.freeze([
    Object.freeze({ theatre: "Oragadam", ownerRole: "Oragadam Theatre JCO", vacantNests: 42, verifiedBillingLiveFills: 8, dailyTarget: 12, daysToFill: 5 }),
    Object.freeze({ theatre: "Sriperumbudur", ownerRole: "Sriperumbudur Demand JCO", vacantNests: 31, verifiedBillingLiveFills: 4, dailyTarget: 8, daysToFill: 8 }),
    Object.freeze({ theatre: "Hosur", ownerRole: "Hosur Theatre JCO", vacantNests: 18, verifiedBillingLiveFills: 3, dailyTarget: 4, daysToFill: 6 }),
  ])
  const escalations = Object.freeze(events.flatMap((event, index) => escalateNewAdds(event, actions[index])).slice(0, 5))
  const despatchEscalations = Object.freeze(events.flatMap((event, index) => emitNewAddsDespatchEscalations(event, actions[index])).slice(0, 5))
  const quarantineCount = decisions.filter((decision) => decision.disposition === "Quarantined").length
  const loopHealthInputs = buildNewAddsLoopHealthInputs(CURRENT_FEEDS, events, actions, outcomes, quarantineCount)
  const taskSummary = Object.freeze({ target: 24, current: 15, gap: 9, owner: "Theatre Growth Lead", progressPercent: 63, verifiedResult: "15/24 billing-live" })
  return Object.freeze({
    mode: "Shadow only" as const,
    fixtureLabel: "Synthetic fixture" as const,
    question: NEW_ADDS_QUESTION,
    headline: "Close 9 billing-live FONO fills today; Sriperumbudur is 4 behind its approved run rate.",
    source: Object.freeze({ name: "Synthetic New Adds fixture", asOf: NEW_ADDS_AT, lastRefreshAt: "2026-07-17T13:45:00+05:30", freshness: "Current" as const, synthetic: true as const }),
    taskSummary,
    measures: Object.freeze([
      Object.freeze({ id: "verified-fills" as const, label: "Verified fills", primary: "15 / 24 today", secondary: "274 / 320 MTD · billing-live only", chart: Object.freeze({ kind: "progress" as const, value: 15, max: 24 }) }),
      Object.freeze({ id: "adds-by-source" as const, label: "Adds by source", primary: "87 · 136 · 51", secondary: "Franchisee base · Nia fill · Returning", chart: Object.freeze({ kind: "segments" as const, parts: Object.freeze([Object.freeze({ label: "Franchisee base", value: 87 }), Object.freeze({ label: "Nia fill", value: 136 }), Object.freeze({ label: "Returning", value: 51 })]) }) }),
      Object.freeze({ id: "cac-payback" as const, label: "Actual CAC & payback", primary: "₹82 · 13 days", secondary: "Verified loaded CAC · against 15 days", chart: Object.freeze({ kind: "threshold" as const, value: 13, target: 15, unit: "d", goodWhenUnder: true }) }),
      Object.freeze({ id: "arrival-billing" as const, label: "Arrival to billing live", primary: "31 hours", secondary: "Median · 2 arrivals over 48h open", chart: Object.freeze({ kind: "threshold" as const, value: 31, target: 48, unit: "h", goodWhenUnder: true }) }),
    ] as const),
    theatres,
    actions: Object.freeze(actions),
    escalations,
    despatchEscalations,
    quarantineCount,
    policyRegistry: NEW_ADDS_POLICY_REGISTRY,
    blockedCapabilities: NEW_ADDS_BLOCKED_CAPABILITIES,
    loopHealthInputs,
    loopHealth: projectNewAddsLoopHealth(loopHealthInputs),
    learningProjection: projectNewAddsLearning([goodChain, rejectedChain]),
  })
}
