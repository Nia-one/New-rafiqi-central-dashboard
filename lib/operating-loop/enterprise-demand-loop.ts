import type { SupplyModel } from "@/lib/operating-loop/contracts"
import { buildLoopHealth, loopHealthAnswer, type LoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"
import { evaluateFieldSafety, SCOUT_PROTECTED_PRIORITY, type FieldSafetyInput } from "@/lib/sram-park-scout-route"

export const ENTERPRISE_DEMAND_LOOP_AT = "2026-07-17T10:00:00+05:30"

export const ENTERPRISE_DEMAND_DISPOSITIONS = [
  "Reached",
  "No answer",
  "Follow-up booked",
  "Unsuitable",
  "Spec mismatch",
  "Commercial exception",
  "Evidence pending",
  "Verified ready",
] as const

export const ENTERPRISE_DEMAND_LOOP_STAGES = [
  "Triggered",
  "Plan built",
  "Calls underway",
  "Evidence received",
  "Independently verified",
  "Capacity covered",
  "Members arrived",
  "Billing live",
] as const

export const ENTERPRISE_DEMAND_BLOCKED_CAPABILITIES = Object.freeze({
  productionWrites: false,
  externalMessages: false,
  liveCalls: false,
  liveRouteAssignments: false,
  gpsTracking: false,
  contractChanges: false,
  payments: false,
  capitalCommitments: false,
})

export const ENTERPRISE_DEMAND_POLICY_REGISTRY = Object.freeze([
  Object.freeze({ policyId: "POL-ENT-DEMAND-RING-1-MAX", value: 2, unit: "km inclusive", version: 1, status: "Active", source: "Enterprise Demand Self-Drive locked product decision" }),
  Object.freeze({ policyId: "POL-ENT-DEMAND-RING-2-MAX", value: 5, unit: "km inclusive", version: 1, status: "Active", source: "Enterprise Demand Self-Drive locked product decision" }),
  Object.freeze({ policyId: "POL-ENT-DEMAND-SHORTFALL-HORIZON", value: 14, unit: "days to arrival", version: 1, status: "Active", source: "Enterprise Demand Self-Drive locked product decision" }),
  Object.freeze({ policyId: "POL-ENT-DEMAND-EXCEPTION-LIMIT", value: 5, unit: "rows", version: 1, status: "Active", source: "Enterprise Demand Self-Drive locked product decision" }),
] as const)

type EnterpriseDemandPolicy = (typeof ENTERPRISE_DEMAND_POLICY_REGISTRY)[number]
export type EnterpriseDisposition = (typeof ENTERPRISE_DEMAND_DISPOSITIONS)[number]
export type EnterpriseLoopStage = (typeof ENTERPRISE_DEMAND_LOOP_STAGES)[number]
export type SupplyPlaybook = "FONO" | "SP"
export type EvidenceStatus = "Reported" | "Verified" | "Stale" | "Failed"
export type MatchStatus = "Match" | "Deviation"

export type ReadinessCapacityInput = {
  capacityId: string
  supplyModel: SupplyModel | null
  nests: number
  evidenceStatus: EvidenceStatus
  evidenceRef: string | null
  submittedBy: string
  verifierActorId: string | null
}

export type EnterpriseContractInput = {
  nodeId: string
  contractId: string | null
  contractStatus: "Signed" | "Draft"
  enterpriseName: string
  plantName: string
  plantReference: string
  committedNests: number
  eligibleSupplyModels: readonly (SupplyModel | null)[]
  contractedServices: readonly ("Curry" | "Sukh" | "UFD")[]
  specStatus: MatchStatus
  termsStatus: MatchStatus
  arrivalAt: string
  ownerActorId: string
  priorMissedFollowUps: number
  dailyPlan: { plannedStops: number; completedStops: number; missedStopsCarried: number }
  readiness: readonly ReadinessCapacityInput[]
  previousSnapshot?: { committedNests: number; arrivalAt: string }
  updatedAt: string
  demandStatus?: string
}

export type ReadinessBySupply = Readonly<Record<SupplyModel, number>>

export type EnterpriseDemandNode = {
  nodeId: string
  contractId: string
  enterpriseName: string
  plantName: string
  plantReference: string
  committedNests: number
  eligibleSupplyModels: readonly SupplyModel[]
  contractedServices: readonly ("Curry" | "Sukh" | "UFD")[]
  specStatus: MatchStatus
  termsStatus: MatchStatus
  arrivalAt: string
  daysToArrival: number
  ownerActorId: string
  priorMissedFollowUps: number
  dailyPlan: EnterpriseContractInput["dailyPlan"]
  verifiedReadyBySupply: ReadinessBySupply
  verifiedReadyNests: number
  readinessGap: number
  state: "Open" | "Reopened"
  reopenReasons: readonly string[]
  updatedAt: string
  demandStatus: string
}

export type DemandNodeDecision =
  | { disposition: "Admitted"; node: EnterpriseDemandNode; reasons: readonly string[] }
  | { disposition: "Ignored" | "Quarantined"; node: null; reasons: readonly string[] }

export type JourneyCandidateInput = {
  stepId: string
  nodeId: string
  candidateName: string
  actionKind: "Call" | "Visit"
  supplyModel: SupplyModel | null
  playbook: SupplyPlaybook | null
  distanceKm: number
  bearing: number
  capacityNests: number
  ownerActorId: string
  dueAt: string
  protectedLocationRef: string | null
  sourceRowIdentity: string
  synthetic: boolean
  fieldSafety?: FieldSafetyInput
  sharedCatchmentEvidenceRef?: string | null
  sharedCatchmentApprovalRef?: string | null
  rawCoordinates?: unknown
  rawOwnerContact?: unknown
}

export type JourneyRing = "Ring 1" | "Ring 2" | "Beyond 5 km"
export type JourneyStepState = "Open" | "Next" | "Queued" | "Ring 2 gated" | "Human-approved exception" | "Retry scheduled" | "Evidence pending" | "Verified ready" | "Reopened" | "Closed"

export type JourneyAuditEvent = {
  eventId: string
  version: number
  type: "Disposition recorded" | "Evidence verified" | "Evidence reopened"
  outcome: EnterpriseDisposition | null
  occurredAt: string
  actorId: string
  evidenceRef: string
  nextAction: string
  dueAt: string
  capacityAffected: number
  readinessProbability: number
  note: string
}

export type JourneyStep = {
  stepId: string
  nodeId: string
  candidateName: string
  actionKind: "Call" | "Visit"
  supplyModel: SupplyModel
  playbook: SupplyPlaybook
  ring: JourneyRing
  distanceKm: number
  bearing: number
  capacityNests: number
  ownerActorId: string
  dueAt: string
  state: JourneyStepState
  humanApprovalRequired: boolean
  independentlyVerifiedNests: number
  history: readonly JourneyAuditEvent[]
  version: number
}

export type JourneyQuarantine = { stepId: string; reasons: readonly string[] }
export type JourneyBlock = { stepId: string; reason: string; humanApprovalRequired: boolean }

export type JourneyPlan = {
  nodeId: string
  steps: readonly JourneyStep[]
  quarantined: readonly JourneyQuarantine[]
  blocked: readonly JourneyBlock[]
  ring1PotentialNests: number
  ring2Unlocked: boolean
  nextStepId: string | null
}

export type DemandException = {
  exceptionId: string
  issue: string
  owner: string
  progress: string
  dueAt: string
}

export type LoopProgress = {
  stage: EnterpriseLoopStage
  count: number
  target: number
  complete: boolean
}

export type SupplyLane = {
  supplyModel: SupplyModel
  stages: readonly { label: string; count: number }[]
}

export type EnterpriseDemandLoopPreview = {
  mode: "Shadow only" | "Live read-only"
  fixtureLabel: "Synthetic fixture" | "Normalized backend"
  source: { name: string; asOf: string; lastRefreshAt: string; freshness: "Fresh" | "Stale"; synthetic: boolean }
  loopHealth: LoopHealth
  headline: string
  activeNode: EnterpriseDemandNode
  priorityQueue: readonly EnterpriseDemandNode[]
  journeyPlan: JourneyPlan
  progress: readonly LoopProgress[]
  progressPercent: number
  supplyLanes: readonly SupplyLane[]
  exceptions: readonly DemandException[]
  despatchEscalations: readonly DespatchEscalationRecord[]
  quarantinedContractCount: number
  protectedPriorities: readonly string[]
  policyRegistry: typeof ENTERPRISE_DEMAND_POLICY_REGISTRY
  blockedCapabilities: typeof ENTERPRISE_DEMAND_BLOCKED_CAPABILITIES
}

export function emitEnterpriseDemandDespatchEscalations(exceptions: readonly DemandException[], at = ENTERPRISE_DEMAND_LOOP_AT): readonly DespatchEscalationRecord[] {
  return Object.freeze(exceptions.flatMap((exception) => {
    if (exception.progress.includes("Human approval required") || Date.parse(exception.dueAt) > Date.parse(at)) return []
    const overdue = Date.parse(exception.dueAt) < Date.parse(at)
    return [createDespatchEscalation({
      escalationId: `DESPATCH-${exception.exceptionId}`,
      domain: "Enterprise Demand",
      sourceActionId: exception.exceptionId,
      sourceEventId: exception.exceptionId.replace(/-(shortfall|spec|terms|arrival)$/, ""),
      title: exception.issue,
      reason: exception.progress,
      ownerRole: exception.owner,
      dueAt: exception.dueAt,
      raisedAt: at,
      severity: overdue ? "Breach" : "Attention",
      status: "Open",
      evidenceRefs: Object.freeze([`protected://enterprise-demand/${exception.exceptionId}`]),
      synthetic: true,
    })]
  }).slice(0, 5))
}

function protectedReference(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("protected://")
}

function policyNumber(policyId: EnterpriseDemandPolicy["policyId"]) {
  const policy = ENTERPRISE_DEMAND_POLICY_REGISTRY.find((candidate) => candidate.policyId === policyId && candidate.status === "Active")
  if (!policy || typeof policy.value !== "number") throw new Error(`Missing active numeric policy ${policyId}.`)
  return policy.value
}

function daysUntil(arrivalAt: string, at: string) {
  return Math.max(0, Math.ceil((Date.parse(arrivalAt) - Date.parse(at)) / 86_400_000))
}

function validSupplyModel(value: SupplyModel | null): value is SupplyModel {
  return value === "FONO" || value === "SP"
}

function countVerifiedReadiness(rows: readonly ReadinessCapacityInput[], eligibleSupplyModels: readonly SupplyModel[]) {
  const bySupply: Record<SupplyModel, number> = { FONO: 0, SP: 0 }
  for (const row of rows) {
    if (!validSupplyModel(row.supplyModel) || !eligibleSupplyModels.includes(row.supplyModel)) continue
    const independentlyVerified = row.evidenceStatus === "Verified"
      && protectedReference(row.evidenceRef)
      && Boolean(row.verifierActorId)
      && row.verifierActorId !== row.submittedBy
    if (independentlyVerified) bySupply[row.supplyModel] += Math.max(0, row.nests)
  }
  return Object.freeze(bySupply)
}

export function createOrUpdateDemandNode(input: EnterpriseContractInput, at = ENTERPRISE_DEMAND_LOOP_AT): DemandNodeDecision {
  if (input.contractStatus !== "Signed") return Object.freeze({ disposition: "Ignored" as const, node: null, reasons: Object.freeze(["Only signed enterprise contracts create demand nodes."]) })

  const quarantineReasons: string[] = []
  if (!input.contractId?.trim()) quarantineReasons.push("A governed contract identifier is required.")
  if (!protectedReference(input.plantReference)) quarantineReasons.push("Plant coordinates must remain behind a protected reference.")
  if (input.committedNests <= 0) quarantineReasons.push("Signed commitment must be greater than zero.")
  if (input.eligibleSupplyModels.length === 0 || input.eligibleSupplyModels.some((model) => !validSupplyModel(model))) quarantineReasons.push("Every demand node requires explicit FONO or SP eligibility; supply_model is never inferred.")
  if (input.readiness.some((row) => !validSupplyModel(row.supplyModel))) quarantineReasons.push("Readiness rows with missing or invalid supply_model are quarantined, not blended.")
  if (quarantineReasons.length > 0) return Object.freeze({ disposition: "Quarantined" as const, node: null, reasons: Object.freeze(quarantineReasons) })

  const eligibleSupplyModels = Object.freeze([...new Set(input.eligibleSupplyModels as readonly SupplyModel[])])
  const verifiedReadyBySupply = countVerifiedReadiness(input.readiness, eligibleSupplyModels)
  const verifiedReadyNests = verifiedReadyBySupply.FONO + verifiedReadyBySupply.SP
  const readinessGap = Math.max(0, input.committedNests - verifiedReadyNests)
  const daysToArrival = daysUntil(input.arrivalAt, at)
  const reopenReasons: string[] = []
  if (input.previousSnapshot?.arrivalAt && input.previousSnapshot.arrivalAt !== input.arrivalAt) reopenReasons.push("Enterprise arrival date changed.")
  if (input.previousSnapshot && input.previousSnapshot.committedNests !== input.committedNests) reopenReasons.push("Signed commitment changed.")
  if (daysToArrival <= policyNumber("POL-ENT-DEMAND-SHORTFALL-HORIZON") && readinessGap > 0) reopenReasons.push("Verified-ready capacity is below commitment inside 14 days.")
  if (input.specStatus === "Deviation") reopenReasons.push("Contracted spec deviation requires closure.")
  if (input.termsStatus === "Deviation") reopenReasons.push("Commercial terms deviation requires Pushkar approval.")

  const node = Object.freeze({
    nodeId: input.nodeId,
    contractId: input.contractId!,
    enterpriseName: input.enterpriseName,
    plantName: input.plantName,
    plantReference: input.plantReference,
    committedNests: input.committedNests,
    eligibleSupplyModels,
    contractedServices: Object.freeze([...input.contractedServices]),
    specStatus: input.specStatus,
    termsStatus: input.termsStatus,
    arrivalAt: input.arrivalAt,
    daysToArrival,
    ownerActorId: input.ownerActorId,
    priorMissedFollowUps: input.priorMissedFollowUps,
    dailyPlan: Object.freeze({ ...input.dailyPlan }),
    verifiedReadyBySupply,
    verifiedReadyNests,
    readinessGap,
    state: input.previousSnapshot && reopenReasons.length > 0 ? "Reopened" as const : "Open" as const,
    reopenReasons: Object.freeze(reopenReasons),
    updatedAt: input.updatedAt,
    demandStatus: input.demandStatus || "Signed",
  })
  return Object.freeze({ disposition: "Admitted" as const, node, reasons: Object.freeze([]) })
}

export function rankDemandNodes(nodes: readonly EnterpriseDemandNode[]) {
  return Object.freeze([...nodes].toSorted((a, b) => {
    const priority = (node: EnterpriseDemandNode) => ((30 - Math.min(30, node.daysToArrival)) * 10_000)
      + (node.readinessGap * 100)
      + ((node.specStatus === "Deviation" ? 1 : 0) + (node.termsStatus === "Deviation" ? 1 : 0)) * 5_000
      + node.priorMissedFollowUps * 2_500
    return priority(b) - priority(a) || a.arrivalAt.localeCompare(b.arrivalAt) || a.nodeId.localeCompare(b.nodeId)
  }))
}

export function dailyRunRate(node: EnterpriseDemandNode, remainingOperatingHours: number) {
  const remainingStops = Math.max(0, node.dailyPlan.plannedStops + node.dailyPlan.missedStopsCarried - node.dailyPlan.completedStops)
  return Object.freeze({
    remainingStops,
    remainingOperatingHours: Math.max(1, remainingOperatingHours),
    requiredStopsPerHour: Math.ceil(remainingStops / Math.max(1, remainingOperatingHours)),
    rolledForward: node.dailyPlan.missedStopsCarried,
  })
}

export function classifyEnterpriseRing(distanceKm: number): JourneyRing {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error("Distance must be a non-negative number.")
  if (distanceKm <= policyNumber("POL-ENT-DEMAND-RING-1-MAX")) return "Ring 1"
  if (distanceKm <= policyNumber("POL-ENT-DEMAND-RING-2-MAX")) return "Ring 2"
  return "Beyond 5 km"
}

function createStep(input: JourneyCandidateInput, ring: JourneyRing, state: JourneyStepState, humanApprovalRequired = false): JourneyStep {
  return Object.freeze({
    stepId: input.stepId,
    nodeId: input.nodeId,
    candidateName: input.candidateName,
    actionKind: input.actionKind,
    supplyModel: input.supplyModel!,
    playbook: input.playbook!,
    ring,
    distanceKm: input.distanceKm,
    bearing: input.bearing,
    capacityNests: input.capacityNests,
    ownerActorId: input.ownerActorId,
    dueAt: input.dueAt,
    state,
    humanApprovalRequired,
    independentlyVerifiedNests: 0,
    history: Object.freeze([]),
    version: 0,
  })
}

export function buildJourneyPlan(node: EnterpriseDemandNode, candidates: readonly JourneyCandidateInput[], at = ENTERPRISE_DEMAND_LOOP_AT): JourneyPlan {
  const admitted: JourneyStep[] = []
  const quarantined: JourneyQuarantine[] = []
  const blocked: JourneyBlock[] = []

  for (const candidate of candidates.filter((item) => item.nodeId === node.nodeId)) {
    const reasons: string[] = []
    if (!validSupplyModel(candidate.supplyModel)) reasons.push("Missing or invalid supply_model.")
    if (!candidate.playbook || candidate.playbook !== candidate.supplyModel) reasons.push("The FONO/SP playbook must match supply_model.")
    if (!node.eligibleSupplyModels.includes(candidate.supplyModel as SupplyModel)) reasons.push("The signed contract does not allow this supply model.")
    if (!protectedReference(candidate.protectedLocationRef)) reasons.push("Location must remain behind a protected reference.")
    if (!candidate.sourceRowIdentity) reasons.push("Source lineage is required.")
    if (!candidate.synthetic) reasons.push("Only synthetic fixtures are admitted in this shadow preview.")
    if (candidate.rawCoordinates || candidate.rawOwnerContact) reasons.push("Raw coordinates and owner details cannot enter the preview.")
    if (reasons.length > 0) {
      quarantined.push(Object.freeze({ stepId: candidate.stepId, reasons: Object.freeze(reasons) }))
      continue
    }

    if (candidate.actionKind === "Visit") {
      if (!candidate.fieldSafety) {
        blocked.push(Object.freeze({ stepId: candidate.stepId, reason: "A field-safety check is required before any visit.", humanApprovalRequired: false }))
        continue
      }
      const safety = evaluateFieldSafety(candidate.fieldSafety, at)
      if (!safety.passed) {
        blocked.push(Object.freeze({ stepId: candidate.stepId, reason: safety.failures.join(" "), humanApprovalRequired: false }))
        continue
      }
    }

    const ring = classifyEnterpriseRing(candidate.distanceKm)
    if (ring === "Beyond 5 km") {
      const approved = protectedReference(candidate.sharedCatchmentEvidenceRef) && protectedReference(candidate.sharedCatchmentApprovalRef)
      if (!approved) {
        blocked.push(Object.freeze({ stepId: candidate.stepId, reason: "Beyond 5 km is blocked without evidenced shared-catchment need and named human approval.", humanApprovalRequired: true }))
        continue
      }
      admitted.push(createStep(candidate, ring, "Human-approved exception", true))
      continue
    }
    admitted.push(createStep(candidate, ring, "Queued"))
  }

  const ringOrder: Record<JourneyRing, number> = { "Ring 1": 0, "Ring 2": 1, "Beyond 5 km": 2 }
  const ordered = admitted.toSorted((a, b) => ringOrder[a.ring] - ringOrder[b.ring] || a.distanceKm - b.distanceKm || a.stepId.localeCompare(b.stepId))
  const ring1PotentialNests = ordered.filter((step) => step.ring === "Ring 1").reduce((total, step) => total + step.capacityNests, 0)
  const ring2Unlocked = ring1PotentialNests < node.readinessGap
  let nextAssigned = false
  const steps = ordered.map((step) => {
    let state = step.state
    if (step.ring === "Ring 2" && !ring2Unlocked) state = "Ring 2 gated"
    else if (step.ring !== "Beyond 5 km" && !nextAssigned) {
      state = "Next"
      nextAssigned = true
    }
    return Object.freeze({ ...step, state })
  })

  return Object.freeze({
    nodeId: node.nodeId,
    steps: Object.freeze(steps),
    quarantined: Object.freeze(quarantined),
    blocked: Object.freeze(blocked),
    ring1PotentialNests,
    ring2Unlocked,
    nextStepId: steps.find((step) => step.state === "Next")?.stepId ?? null,
  })
}

export type DispositionInput = {
  outcome: EnterpriseDisposition | null
  evidenceRef: string
  nextAction: string
  ownerActorId: string
  dueAt: string
  capacityAffected: number
  readinessProbability: number
  occurredAt: string
}

export function recordJourneyDisposition(step: JourneyStep, input: DispositionInput): JourneyStep {
  if (!input.outcome) throw new Error("A disposition is required after every call or stop.")
  if (!protectedReference(input.evidenceRef)) throw new Error("Disposition evidence must use a protected reference.")
  if (!input.nextAction.trim() || !input.ownerActorId.trim() || !input.dueAt || !input.occurredAt) throw new Error("Next action, owner, due time and timestamp are required.")
  if (input.capacityAffected < 0 || input.readinessProbability < 0 || input.readinessProbability > 1) throw new Error("Capacity and readiness probability must be valid.")
  if (input.outcome === "No answer" && Date.parse(input.dueAt) <= Date.parse(input.occurredAt)) throw new Error("No answer must schedule a future attempt.")

  const state: JourneyStepState = input.outcome === "No answer" ? "Retry scheduled"
    : input.outcome === "Verified ready" || input.outcome === "Evidence pending" ? "Evidence pending"
      : input.outcome === "Unsuitable" ? "Closed"
        : "Open"
  const version = step.version + 1
  const event = Object.freeze({
    eventId: `${step.stepId}-audit-${version}`,
    version,
    type: "Disposition recorded" as const,
    outcome: input.outcome,
    occurredAt: input.occurredAt,
    actorId: input.ownerActorId,
    evidenceRef: input.evidenceRef,
    nextAction: input.nextAction,
    dueAt: input.dueAt,
    capacityAffected: input.capacityAffected,
    readinessProbability: input.readinessProbability,
    note: input.outcome === "No answer" ? "No answer recorded; the next attempt remains open." : `${input.outcome} recorded in shadow mode.`,
  })
  return Object.freeze({ ...step, ownerActorId: input.ownerActorId, dueAt: input.dueAt, state, history: Object.freeze([...step.history, event]), version })
}

export function verifyJourneyEvidence(step: JourneyStep, input: { status: "Verified" | "Stale" | "Failed"; verifierActorId: string; verifiedAt: string; evidenceRef: string }): JourneyStep {
  if (!protectedReference(input.evidenceRef)) throw new Error("Verification requires protected evidence.")
  if (!input.verifierActorId || input.verifierActorId === step.ownerActorId) throw new Error("Readiness requires an independent verifier.")
  const latest = step.history.at(-1)
  const version = step.version + 1
  const verifiedReady = input.status === "Verified" && latest?.outcome === "Verified ready"
  const reopened = input.status === "Stale" || input.status === "Failed"
  const event = Object.freeze({
    eventId: `${step.stepId}-audit-${version}`,
    version,
    type: reopened ? "Evidence reopened" as const : "Evidence verified" as const,
    outcome: latest?.outcome ?? null,
    occurredAt: input.verifiedAt,
    actorId: input.verifierActorId,
    evidenceRef: input.evidenceRef,
    nextAction: reopened ? "Recollect evidence and resubmit for independent verification." : latest?.nextAction ?? "Continue the governed loop.",
    dueAt: latest?.dueAt ?? step.dueAt,
    capacityAffected: latest?.capacityAffected ?? 0,
    readinessProbability: verifiedReady ? 1 : latest?.readinessProbability ?? 0,
    note: reopened ? `${input.status} evidence reopened the step.` : "Independent verification recorded.",
  })
  return Object.freeze({
    ...step,
    state: reopened ? "Reopened" as const : verifiedReady ? "Verified ready" as const : step.state,
    independentlyVerifiedNests: verifiedReady ? Math.min(step.capacityNests, latest?.capacityAffected ?? 0) : 0,
    history: Object.freeze([...step.history, event]),
    version,
  })
}

export function evaluateLoopClosure(input: {
  committedNests: number
  verifiedReadyNests: number
  specStatus: MatchStatus
  termsStatus: MatchStatus
  arrivalEvidenceRef: string | null
  billingEvidenceRef: string | null
  humanException?: { approvedBy: string; approvalRef: string } | null
}) {
  if (input.humanException && input.humanException.approvedBy !== "RafiQi" && protectedReference(input.humanException.approvalRef)) {
    return Object.freeze({ closed: true, closureType: "Human exception" as const, missing: Object.freeze([]) })
  }
  const missing: string[] = []
  if (input.verifiedReadyNests < input.committedNests) missing.push("Verified-ready capacity does not cover the signed batch.")
  if (input.specStatus !== "Match") missing.push("Contracted spec does not match.")
  if (input.termsStatus !== "Match") missing.push("Contracted terms do not match.")
  if (!protectedReference(input.arrivalEvidenceRef)) missing.push("Member-arrival evidence is missing.")
  if (!protectedReference(input.billingEvidenceRef)) missing.push("Billing-live evidence is missing.")
  return Object.freeze({ closed: missing.length === 0, closureType: missing.length === 0 ? "Verified completion" as const : null, missing: Object.freeze(missing) })
}

function admittedNode(input: EnterpriseContractInput) {
  const decision = createOrUpdateDemandNode(input)
  if (decision.disposition !== "Admitted") throw new Error(`${input.nodeId} must be admitted by the synthetic fixture.`)
  return decision.node
}

const safeFieldSession: FieldSafetyInput = Object.freeze({
  localHour: 10,
  plannedCheckIns: 3,
  publicAccess: true,
  ownerConsentRef: null,
  noTrespass: true,
  hazardStatus: "Cleared",
  ppeControlsRef: null,
  unsafeSolo: false,
  buddyRef: null,
  emergencyRef: "protected://safety/enterprise-demand-preview",
  stopWorkInstructionVisible: true,
})

export const ENTERPRISE_DEMAND_CONTRACT_FIXTURES: readonly EnterpriseContractInput[] = Object.freeze([
  Object.freeze({
    nodeId: "NODE-VIKRAM-ORA-2607", contractId: "CONTRACT-VIKRAM-2026-07", contractStatus: "Signed", enterpriseName: "Vikram Solar", plantName: "Oragadam plant", plantReference: "protected://enterprise-plant/vikram-oragadam", committedNests: 180,
    eligibleSupplyModels: Object.freeze(["FONO", "SP"] as const), contractedServices: Object.freeze(["Curry", "Sukh"] as const), specStatus: "Match", termsStatus: "Match", arrivalAt: "2026-07-26T09:00:00+05:30", ownerActorId: "Coromandel Demand JCO", priorMissedFollowUps: 1,
    dailyPlan: Object.freeze({ plannedStops: 5, completedStops: 1, missedStopsCarried: 2 }),
    readiness: Object.freeze([
      Object.freeze({ capacityId: "READY-VIKRAM-FONO", supplyModel: "FONO", nests: 60, evidenceStatus: "Verified", evidenceRef: "protected://readiness/vikram-fono", submittedBy: "FONO Supply JCO", verifierActorId: "Coromandel verifier" }),
      Object.freeze({ capacityId: "READY-VIKRAM-SP", supplyModel: "SP", nests: 80, evidenceStatus: "Verified", evidenceRef: "protected://readiness/vikram-sp", submittedBy: "SP Supply JCO", verifierActorId: "Coromandel verifier" }),
      Object.freeze({ capacityId: "READY-VIKRAM-REPORTED", supplyModel: "SP", nests: 20, evidenceStatus: "Reported", evidenceRef: "protected://readiness/vikram-reported", submittedBy: "SP Supply JCO", verifierActorId: null }),
    ]),
    previousSnapshot: Object.freeze({ committedNests: 180, arrivalAt: "2026-07-28T09:00:00+05:30" }), updatedAt: "2026-07-17T09:42:00+05:30",
  }),
  Object.freeze({
    nodeId: "NODE-HYUNDAI-SIP-3007", contractId: "CONTRACT-HYUNDAI-2026-07", contractStatus: "Signed", enterpriseName: "Hyundai Mobis", plantName: "Sriperumbudur plant", plantReference: "protected://enterprise-plant/hyundai-sip", committedNests: 120,
    eligibleSupplyModels: Object.freeze(["SP"] as const), contractedServices: Object.freeze(["UFD"] as const), specStatus: "Deviation", termsStatus: "Match", arrivalAt: "2026-07-30T09:00:00+05:30", ownerActorId: "Coromandel Supply JCO", priorMissedFollowUps: 0,
    dailyPlan: Object.freeze({ plannedStops: 3, completedStops: 1, missedStopsCarried: 0 }),
    readiness: Object.freeze([Object.freeze({ capacityId: "READY-HYUNDAI-SP", supplyModel: "SP", nests: 120, evidenceStatus: "Verified", evidenceRef: "protected://readiness/hyundai-sp", submittedBy: "SP Supply JCO", verifierActorId: "Coromandel verifier" })]),
    updatedAt: "2026-07-17T09:35:00+05:30",
  }),
  Object.freeze({
    nodeId: "NODE-SUNDARAM-0108", contractId: "CONTRACT-SUNDARAM-2026-08", contractStatus: "Signed", enterpriseName: "Sundaram Fasteners", plantName: "Chennai plant", plantReference: "protected://enterprise-plant/sundaram-chennai", committedNests: 90,
    eligibleSupplyModels: Object.freeze(["FONO"] as const), contractedServices: Object.freeze([]), specStatus: "Match", termsStatus: "Deviation", arrivalAt: "2026-08-01T09:00:00+05:30", ownerActorId: "Commercial lead", priorMissedFollowUps: 0,
    dailyPlan: Object.freeze({ plannedStops: 2, completedStops: 0, missedStopsCarried: 0 }),
    readiness: Object.freeze([Object.freeze({ capacityId: "READY-SUNDARAM-FONO", supplyModel: "FONO", nests: 90, evidenceStatus: "Verified", evidenceRef: "protected://readiness/sundaram-fono", submittedBy: "FONO Supply JCO", verifierActorId: "Coromandel verifier" })]),
    updatedAt: "2026-07-17T09:20:00+05:30",
  }),
  Object.freeze({
    nodeId: "NODE-QUARANTINE", contractId: null, contractStatus: "Signed", enterpriseName: "Synthetic invalid enterprise", plantName: "Protected plant", plantReference: "protected://enterprise-plant/quarantine", committedNests: 50,
    eligibleSupplyModels: Object.freeze([null]), contractedServices: Object.freeze([]), specStatus: "Match", termsStatus: "Match", arrivalAt: "2026-07-25T09:00:00+05:30", ownerActorId: "Fixture owner", priorMissedFollowUps: 0,
    dailyPlan: Object.freeze({ plannedStops: 0, completedStops: 0, missedStopsCarried: 0 }), readiness: Object.freeze([]), updatedAt: "2026-07-17T09:15:00+05:30",
  }),
])

export const ENTERPRISE_DEMAND_JOURNEY_FIXTURES: readonly JourneyCandidateInput[] = Object.freeze([
  Object.freeze({ stepId: "STEP-FONO-01", nodeId: "NODE-VIKRAM-ORA-2607", candidateName: "Oragadam FONO reserve A", actionKind: "Call", supplyModel: "FONO", playbook: "FONO", distanceKm: 1.1, bearing: 35, capacityNests: 24, ownerActorId: "FONO Supply JCO", dueAt: "2026-07-17T10:30:00+05:30", protectedLocationRef: "protected://candidate/fono-a", sourceRowIdentity: "synthetic:fono-a", synthetic: true }),
  Object.freeze({ stepId: "STEP-SP-01", nodeId: "NODE-VIKRAM-ORA-2607", candidateName: "Oragadam SP build A", actionKind: "Visit", supplyModel: "SP", playbook: "SP", distanceKm: 1.8, bearing: 132, capacityNests: 16, ownerActorId: "SP Supply JCO", dueAt: "2026-07-17T11:15:00+05:30", protectedLocationRef: "protected://candidate/sp-a", sourceRowIdentity: "synthetic:sp-a", synthetic: true, fieldSafety: safeFieldSession }),
  Object.freeze({ stepId: "STEP-FONO-02", nodeId: "NODE-VIKRAM-ORA-2607", candidateName: "Oragadam FONO reserve B", actionKind: "Call", supplyModel: "FONO", playbook: "FONO", distanceKm: 3.2, bearing: 228, capacityNests: 30, ownerActorId: "FONO Supply JCO", dueAt: "2026-07-17T13:00:00+05:30", protectedLocationRef: "protected://candidate/fono-b", sourceRowIdentity: "synthetic:fono-b", synthetic: true }),
  Object.freeze({ stepId: "STEP-SP-02", nodeId: "NODE-VIKRAM-ORA-2607", candidateName: "Oragadam SP build B", actionKind: "Visit", supplyModel: "SP", playbook: "SP", distanceKm: 4.4, bearing: 305, capacityNests: 50, ownerActorId: "SP Supply JCO", dueAt: "2026-07-17T14:00:00+05:30", protectedLocationRef: "protected://candidate/sp-b", sourceRowIdentity: "synthetic:sp-b", synthetic: true, fieldSafety: safeFieldSession }),
  Object.freeze({ stepId: "STEP-BEYOND-BLOCK", nodeId: "NODE-VIKRAM-ORA-2607", candidateName: "Shared corridor option", actionKind: "Call", supplyModel: "FONO", playbook: "FONO", distanceKm: 5.8, bearing: 178, capacityNests: 40, ownerActorId: "FONO Supply JCO", dueAt: "2026-07-17T15:00:00+05:30", protectedLocationRef: "protected://candidate/beyond", sourceRowIdentity: "synthetic:beyond", synthetic: true }),
  Object.freeze({ stepId: "STEP-QUARANTINE", nodeId: "NODE-VIKRAM-ORA-2607", candidateName: "Missing supply context", actionKind: "Call", supplyModel: null, playbook: null, distanceKm: 1.4, bearing: 260, capacityNests: 20, ownerActorId: "Fixture owner", dueAt: "2026-07-17T15:30:00+05:30", protectedLocationRef: "protected://candidate/quarantine", sourceRowIdentity: "synthetic:quarantine", synthetic: true }),
])

function buildProgress(node: EnterpriseDemandNode): readonly LoopProgress[] {
  return Object.freeze([
    Object.freeze({ stage: "Triggered" as const, count: 1, target: 1, complete: true }),
    Object.freeze({ stage: "Plan built" as const, count: 1, target: 1, complete: true }),
    Object.freeze({ stage: "Calls underway" as const, count: 1, target: node.dailyPlan.plannedStops + node.dailyPlan.missedStopsCarried, complete: false }),
    Object.freeze({ stage: "Evidence received" as const, count: 2, target: 3, complete: false }),
    Object.freeze({ stage: "Independently verified" as const, count: node.verifiedReadyNests, target: node.committedNests, complete: node.readinessGap === 0 }),
    Object.freeze({ stage: "Capacity covered" as const, count: node.verifiedReadyNests, target: node.committedNests, complete: node.readinessGap === 0 }),
    Object.freeze({ stage: "Members arrived" as const, count: 0, target: node.committedNests, complete: false }),
    Object.freeze({ stage: "Billing live" as const, count: 0, target: node.committedNests, complete: false }),
  ])
}

function buildExceptions(nodes: readonly EnterpriseDemandNode[], at = ENTERPRISE_DEMAND_LOOP_AT) {
  const exceptions: DemandException[] = []
  for (const node of nodes) {
    if (node.readinessGap > 0 && node.daysToArrival <= policyNumber("POL-ENT-DEMAND-SHORTFALL-HORIZON")) exceptions.push({ exceptionId: `${node.nodeId}-shortfall`, issue: `${node.readinessGap} verified-ready Nests short · ${node.enterpriseName}`, owner: node.ownerActorId, progress: `${node.verifiedReadyNests}/${node.committedNests} independently verified`, dueAt: node.arrivalAt })
    if (node.specStatus === "Deviation") exceptions.push({ exceptionId: `${node.nodeId}-spec`, issue: `Contracted spec deviation · ${node.enterpriseName}`, owner: node.ownerActorId, progress: "Evidence and corrective plan pending", dueAt: node.arrivalAt })
    if (node.termsStatus === "Deviation") exceptions.push({ exceptionId: `${node.nodeId}-terms`, issue: `Commercial terms deviation · ${node.enterpriseName}`, owner: "Pushkar", progress: "Human approval required · never auto-resolved", dueAt: node.arrivalAt })
    if (node.reopenReasons.includes("Enterprise arrival date changed.")) exceptions.push({ exceptionId: `${node.nodeId}-arrival`, issue: `Enterprise arrival moved · ${node.enterpriseName}`, owner: node.ownerActorId, progress: "Journey plan reprioritised", dueAt: at })
  }
  return Object.freeze(exceptions.slice(0, policyNumber("POL-ENT-DEMAND-EXCEPTION-LIMIT")).map((exception) => Object.freeze(exception)))
}

export function buildEnterpriseDemandLoopPreview(): EnterpriseDemandLoopPreview {
  const decisions = ENTERPRISE_DEMAND_CONTRACT_FIXTURES.map((input) => createOrUpdateDemandNode(input))
  const priorityQueue = rankDemandNodes(decisions.flatMap((decision) => decision.disposition === "Admitted" ? [decision.node] : []))
  const activeNode = priorityQueue[0]
  if (!activeNode) throw new Error("The synthetic Enterprise Demand fixture has no admitted signed node.")
  const journeyPlan = buildJourneyPlan(activeNode, ENTERPRISE_DEMAND_JOURNEY_FIXTURES)
  const progress = buildProgress(activeNode)
  const completeStages = progress.filter((stage) => stage.complete).length
  const progressPercent = Math.round((completeStages / progress.length) * 100)
  const loopHealth = buildLoopHealth({
    asOf: ENTERPRISE_DEMAND_LOOP_AT,
    feeds: Object.freeze([
      Object.freeze({ feedId: "enterprise-contracts", label: "Contracts", lastUpdatedAt: "2026-07-17T08:00:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: Object.freeze(["signed target", "readiness gap"]) }),
      Object.freeze({ feedId: "readiness-evidence", label: "Readiness evidence", lastUpdatedAt: "2026-07-17T09:30:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: Object.freeze(["verified ready"]) }),
    ]),
    clocks: Object.freeze([
      Object.freeze({ clockId: `${activeNode.nodeId}-arrival`, label: "Arrival readiness", ownerRole: "Theatre lead", dueAt: activeNode.arrivalAt, state: "Running" as const }),
    ]),
    verification: Object.freeze({ claimed: 14, verified: 11, awaiting: 3, reopened: 1, oldestAwaitingAt: "2026-07-17T09:00:00+05:30" }),
    quarantinedRecords: decisions.filter((decision) => decision.disposition === "Quarantined").length,
  })
  const taskAnswer = `Close ${activeNode.readinessGap} verified-ready Nests around ${activeNode.enterpriseName} before the ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date(activeNode.arrivalAt))} arrival.`
  const headline = loopHealthAnswer(loopHealth, taskAnswer)
  const exceptions = buildExceptions(priorityQueue)

  return Object.freeze({
    mode: "Shadow only",
    fixtureLabel: "Synthetic fixture",
    source: Object.freeze({ name: "Typed Enterprise Demand Self-Drive fixture", asOf: ENTERPRISE_DEMAND_LOOP_AT, lastRefreshAt: "2026-07-17T08:00:00+05:30", freshness: "Stale", synthetic: true }),
    loopHealth,
    headline,
    activeNode,
    priorityQueue,
    journeyPlan,
    progress,
    progressPercent,
    supplyLanes: Object.freeze([
      Object.freeze({ supplyModel: "FONO" as const, stages: Object.freeze([Object.freeze({ label: "Vacant Nests reserved", count: 64 }), Object.freeze({ label: "Readiness verified", count: 60 }), Object.freeze({ label: "Members arrived", count: 0 }), Object.freeze({ label: "Billing", count: 0 })]) }),
      Object.freeze({ supplyModel: "SP" as const, stages: Object.freeze([Object.freeze({ label: "Park contracted", count: 96 }), Object.freeze({ label: "Build / hardware done", count: 84 }), Object.freeze({ label: "Services live", count: 80 }), Object.freeze({ label: "Spec verified", count: 80 }), Object.freeze({ label: "Members arrived", count: 0 }), Object.freeze({ label: "Billing", count: 0 })]) }),
    ]),
    exceptions,
    despatchEscalations: emitEnterpriseDemandDespatchEscalations(exceptions),
    quarantinedContractCount: decisions.filter((decision) => decision.disposition === "Quarantined").length,
    protectedPriorities: Object.freeze([...SCOUT_PROTECTED_PRIORITY]),
    policyRegistry: ENTERPRISE_DEMAND_POLICY_REGISTRY,
    blockedCapabilities: ENTERPRISE_DEMAND_BLOCKED_CAPABILITIES,
  })
}

type EnterpriseSheetRow = Record<string, unknown>
const enterpriseKey = (value: string) => value.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
const enterpriseValue = (row: EnterpriseSheetRow, key: string) => {
  const wanted = enterpriseKey(key)
  const found = Object.entries(row).find(([candidate]) => enterpriseKey(candidate) === wanted)
  return String(found?.[1] ?? "").trim()
}
const enterpriseNumber = (row: EnterpriseSheetRow, key: string) => {
  const value = Number(enterpriseValue(row, key).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(value) ? value : 0
}

/** Maps governed Enterprise_Demand rows without promoting matched capacity to independently verified readiness. */
export function buildLiveEnterpriseDemandLoopPreview(rows: readonly EnterpriseSheetRow[], asOf: string): EnterpriseDemandLoopPreview | null {
  const inputs: EnterpriseContractInput[] = rows.flatMap((row) => {
    const demandId = enterpriseValue(row, "demand id")
    const enterpriseName = enterpriseValue(row, "enterprise name")
    const plantName = enterpriseValue(row, "plant name")
    const arrivalAt = enterpriseValue(row, "activation required at")
    const required = enterpriseNumber(row, "headcount required")
    const status = enterpriseValue(row, "status")
    const demandStatus = enterpriseValue(row, "certainty") || status
    if (!demandId || !enterpriseName || !plantName || !arrivalAt || !Number.isFinite(Date.parse(arrivalAt)) || required <= 0 || !/under discussion|confirmed|open|contract|signed|won|onboard|live/i.test(`${status} ${demandStatus}`)) return []
    const recordedSupplyModel = enterpriseValue(row, "supply model").toUpperCase()
    const supplyModel: SupplyModel = recordedSupplyModel === "SP" ? "SP" : "FONO"
    return [{
      nodeId: demandId, contractId: demandId, contractStatus: "Signed" as const, enterpriseName, plantName,
      plantReference: `protected://enterprise-plant/${demandId}`, committedNests: required,
      eligibleSupplyModels: [supplyModel], contractedServices: [], specStatus: "Match" as const, termsStatus: "Match" as const,
      arrivalAt, ownerActorId: enterpriseValue(row, "owner actor id") || "Unassigned", priorMissedFollowUps: 0,
      dailyPlan: { plannedStops: 0, completedStops: 0, missedStopsCarried: 0 }, readiness: [],
      updatedAt: enterpriseValue(row, "updated at") || enterpriseValue(row, "opened at") || asOf,
      demandStatus,
    }]
  })
  const decisions = inputs.map((input) => createOrUpdateDemandNode(input, asOf))
  const priorityQueue = rankDemandNodes(decisions.flatMap((decision) => decision.disposition === "Admitted" ? [decision.node] : []))
  const activeNode = priorityQueue[0]
  if (!activeNode) return null
  const progress = buildProgress(activeNode)
  const exceptions = buildExceptions(priorityQueue, asOf)
  const lastRefreshAt = inputs.map((input) => input.updatedAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || asOf
  const ageMinutes = Math.max(0, (Date.parse(asOf) - Date.parse(lastRefreshAt)) / 60_000)
  const loopHealth = buildLoopHealth({
    asOf,
    feeds: [{ feedId: "enterprise-demand", label: "Enterprise Demand", lastUpdatedAt: lastRefreshAt, cadenceMinutes: 300, critical: true, affectedClaims: ["contracted demand", "readiness gap"] }],
    clocks: [{ clockId: `${activeNode.nodeId}-arrival`, label: "Arrival readiness", ownerRole: activeNode.ownerActorId, dueAt: activeNode.arrivalAt, state: "Running" }],
    verification: { claimed: rows.reduce((sum, row) => sum + enterpriseNumber(row, "headcount matched"), 0), verified: 0, awaiting: rows.reduce((sum, row) => sum + enterpriseNumber(row, "headcount matched"), 0), reopened: 0, oldestAwaitingAt: rows.some((row) => enterpriseNumber(row, "headcount matched") > 0) ? lastRefreshAt : null },
    quarantinedRecords: rows.length - inputs.length,
  })
  const supplyLanes = (["FONO", "SP"] as const).map((supplyModel) => {
    const laneRows = rows.filter((row) => {
      const explicit = enterpriseValue(row, "supply model").toUpperCase()
      const status = enterpriseValue(row, "status")
      const classified = explicit === "FONO" || explicit === "SP"
        ? explicit
        : /under discussion|confirmed|open/i.test(status)
          ? ""
          : enterpriseValue(row, "demand id").toUpperCase().startsWith("SP-BOT") ? "SP" : "FONO"
      return classified === supplyModel
    })
    return Object.freeze({ supplyModel, stages: Object.freeze([
      Object.freeze({ label: "Contracted demand", count: laneRows.reduce((sum, row) => sum + enterpriseNumber(row, "headcount required"), 0) }),
      Object.freeze({ label: "Operationally matched", count: laneRows.reduce((sum, row) => sum + enterpriseNumber(row, "headcount matched"), 0) }),
      Object.freeze({ label: "Independently verified", count: 0 }),
      Object.freeze({ label: "Billing", count: 0 }),
    ]) })
  })
  return Object.freeze({
    mode: "Live read-only", fixtureLabel: "Normalized backend",
    source: Object.freeze({ name: "Enterprise_Demand", asOf, lastRefreshAt, freshness: ageMinutes <= 300 ? "Fresh" : "Stale", synthetic: false }),
    loopHealth, headline: loopHealthAnswer(loopHealth, `Close ${activeNode.readinessGap} independently verified Nests before ${activeNode.enterpriseName} arrives.`),
    activeNode, priorityQueue, journeyPlan: buildJourneyPlan(activeNode, []), progress,
    progressPercent: Math.round(progress.filter((stage) => stage.complete).length / progress.length * 100),
    supplyLanes: Object.freeze(supplyLanes), exceptions,
    despatchEscalations: Object.freeze(emitEnterpriseDemandDespatchEscalations(exceptions, asOf).map((record) => Object.freeze({ ...record, synthetic: false }))),
    quarantinedContractCount: rows.length - inputs.length, protectedPriorities: Object.freeze([...SCOUT_PROTECTED_PRIORITY]),
    policyRegistry: ENTERPRISE_DEMAND_POLICY_REGISTRY, blockedCapabilities: ENTERPRISE_DEMAND_BLOCKED_CAPABILITIES,
  })
}
