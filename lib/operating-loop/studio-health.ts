import type { PolicyDefinition } from "@/lib/operating-loop/contracts"
import { POLICY_REGISTRY, policyAt } from "@/lib/operating-loop/contracts"

type VersionedThreshold = {
  policyId: string
  value: number
  unit: string
  version: number
  effectiveFrom: string
}

export type StudioHealthPolicies = {
  asOf: string
  greenOccupancy: VersionedThreshold
  greenGrossMargin: VersionedThreshold
  amberOccupancyFloor: VersionedThreshold
  amberGrossMarginFloor: VersionedThreshold
  amberReviewHours: VersionedThreshold
  amberActionPlanHours: VersionedThreshold
  redDecisionDays: VersionedThreshold
}

function thresholdAt(policyId: string, at: string, registry: readonly PolicyDefinition[]): VersionedThreshold {
  const policy = policyAt(policyId, at, registry)
  if (!policy || typeof policy.value !== "number" || !Number.isFinite(policy.value)) throw new Error(`A numeric ${policyId} policy is required at ${at}.`)
  return Object.freeze({ policyId, value: policy.value, unit: policy.unit, version: policy.version, effectiveFrom: policy.effectiveFrom })
}

export function studioHealthPoliciesAt(at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY): StudioHealthPolicies {
  return Object.freeze({
    asOf: at,
    greenOccupancy: thresholdAt("POL-BREAKEVEN-OCCUPANCY", at, registry),
    greenGrossMargin: thresholdAt("POL-STUDIO-GM", at, registry),
    amberOccupancyFloor: thresholdAt("POL-STUDIO-OCCUPANCY-AMBER", at, registry),
    amberGrossMarginFloor: thresholdAt("POL-STUDIO-GM-AMBER", at, registry),
    amberReviewHours: thresholdAt("POL-STUDIO-AMBER-REVIEW", at, registry),
    amberActionPlanHours: thresholdAt("POL-STUDIO-AMBER-ACTION", at, registry),
    redDecisionDays: thresholdAt("POL-STUDIO-RED-DECISION", at, registry),
  })
}

export type StudioHealthInput = {
  studioId: string
  studioName: string
  theatreId: string
  contractedNests: number | null
  occupiedNests: number | null
  grossMarginRatio: number | null
  contributionMarginInr: number | null
  dataComplete: boolean
  theatreOwnerActorId: string
  asOf: string
  sourceRowIdentity: string
  synthetic: boolean
}

export type StudioHealthStatus = "Green" | "Amber" | "Red" | "No data"

export type StudioHealthAssessment = {
  assessmentId: string
  studioId: string
  studioName: string
  theatreId: string
  status: StudioHealthStatus
  occupancyRatio: number | null
  grossMarginRatio: number | null
  contributionMarginInr: number | null
  reasons: readonly string[]
  requiredResponse: string
  ownerActorId: string
  reviewDueAt: string | null
  actionPlanDueAt: string | null
  decisionDueAt: string | null
  decisionRoles: readonly string[]
  requiresWarRoom: boolean
  priority: "Routine" | "Priority" | "Critical" | "Maximum"
  policyVersions: readonly string[]
  asOf: string
  sourceRowIdentity: string
  synthetic: boolean
}

function addHours(value: string, hours: number) {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1000).toISOString()
}

function addDays(value: string, days: number) {
  return addHours(value, days * 24)
}

function endOfIstDay(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part("year")}-${part("month")}-${part("day")}T23:59:59+05:30`
}

export function assessStudioHealth(input: StudioHealthInput, policies: StudioHealthPolicies): StudioHealthAssessment {
  const occupancyRatio = input.contractedNests !== null && input.occupiedNests !== null && input.contractedNests > 0
    ? input.occupiedNests / input.contractedNests
    : null
  const hasRequiredData = input.dataComplete && occupancyRatio !== null && input.grossMarginRatio !== null && input.contributionMarginInr !== null
  let status: StudioHealthStatus
  let reasons: string[]
  let requiredResponse: string
  let ownerActorId: string
  let reviewDueAt: string | null = null
  let actionPlanDueAt: string | null = null
  let decisionDueAt: string | null = null
  let decisionRoles: readonly string[] = Object.freeze([])
  let priority: StudioHealthAssessment["priority"]

  if (!hasRequiredData) {
    status = "No data"
    reasons = ["Required operating or financial data is missing."]
    requiredResponse = "Correct the missing data at maximum priority and keep the exception open until independently verified."
    ownerActorId = input.theatreOwnerActorId
    reviewDueAt = input.asOf
    priority = "Maximum"
  } else if (occupancyRatio < policies.amberOccupancyFloor.value || input.grossMarginRatio! < policies.amberGrossMarginFloor.value || input.contributionMarginInr! < 0) {
    status = "Red"
    reasons = [
      ...(occupancyRatio < policies.amberOccupancyFloor.value ? [`Occupancy ${(occupancyRatio * 100).toFixed(1)}% is below 60%.`] : []),
      ...(input.grossMarginRatio! < policies.amberGrossMarginFloor.value ? [`Gross margin ${(input.grossMarginRatio! * 100).toFixed(1)}% is below 10%.`] : []),
      ...(input.contributionMarginInr! < 0 ? [`Contribution margin is negative at ₹${Math.abs(input.contributionMarginInr!).toLocaleString("en-IN")}.`] : []),
    ]
    requiredResponse = "CEO and COO review the same day; record a governed decision within seven days."
    ownerActorId = "ACT-COO"
    reviewDueAt = endOfIstDay(input.asOf)
    decisionDueAt = addDays(input.asOf, policies.redDecisionDays.value)
    decisionRoles = Object.freeze(["CEO", "COO"])
    priority = "Critical"
  } else if (occupancyRatio < policies.greenOccupancy.value || input.grossMarginRatio! < policies.greenGrossMargin.value) {
    status = "Amber"
    reasons = [
      ...(occupancyRatio < policies.greenOccupancy.value ? [`Occupancy ${(occupancyRatio * 100).toFixed(1)}% is below 78%.`] : []),
      ...(input.grossMarginRatio! < policies.greenGrossMargin.value ? [`Gross margin ${(input.grossMarginRatio! * 100).toFixed(1)}% is below 20%.`] : []),
    ]
    requiredResponse = "Theatre review within 24 hours and an action plan within 48 hours."
    ownerActorId = input.theatreOwnerActorId
    reviewDueAt = addHours(input.asOf, policies.amberReviewHours.value)
    actionPlanDueAt = addHours(input.asOf, policies.amberActionPlanHours.value)
    priority = "Priority"
  } else {
    status = "Green"
    reasons = [`Occupancy ${(occupancyRatio * 100).toFixed(1)}% and gross margin ${(input.grossMarginRatio! * 100).toFixed(1)}% meet the locked thresholds.`]
    requiredResponse = "Hold and replicate."
    ownerActorId = input.theatreOwnerActorId
    priority = "Routine"
  }

  return Object.freeze({
    assessmentId: `HEALTH-${input.studioId}-${input.asOf}`,
    studioId: input.studioId,
    studioName: input.studioName,
    theatreId: input.theatreId,
    status,
    occupancyRatio,
    grossMarginRatio: input.grossMarginRatio,
    contributionMarginInr: input.contributionMarginInr,
    reasons: Object.freeze(reasons),
    requiredResponse,
    ownerActorId,
    reviewDueAt,
    actionPlanDueAt,
    decisionDueAt,
    decisionRoles,
    requiresWarRoom: status !== "Green",
    priority,
    policyVersions: Object.freeze([
      `${policies.greenOccupancy.policyId}@v${policies.greenOccupancy.version}`,
      `${policies.greenGrossMargin.policyId}@v${policies.greenGrossMargin.version}`,
      `${policies.amberOccupancyFloor.policyId}@v${policies.amberOccupancyFloor.version}`,
      `${policies.amberGrossMarginFloor.policyId}@v${policies.amberGrossMarginFloor.version}`,
      `${policies.amberReviewHours.policyId}@v${policies.amberReviewHours.version}`,
      `${policies.amberActionPlanHours.policyId}@v${policies.amberActionPlanHours.version}`,
      `${policies.redDecisionDays.policyId}@v${policies.redDecisionDays.version}`,
    ]),
    asOf: input.asOf,
    sourceRowIdentity: input.sourceRowIdentity,
    synthetic: input.synthetic,
  })
}

export const WAR_ROOM_STATES = ["Open", "Assigned", "In progress", "Evidence submitted", "Verified", "Closed", "Reopened", "Escalated"] as const
export type WarRoomState = (typeof WAR_ROOM_STATES)[number]

export type WarRoomEvidence = {
  evidenceId: string
  protectedRef: string
  description: string
  submittedBy: string
  submittedAt: string
}

export type WarRoomEvent = {
  eventId: string
  from: WarRoomState | null
  to: WarRoomState
  actorId: string
  occurredAt: string
  note: string
  version: number
}

export type WarRoomCase = {
  caseId: string
  studioId: string | null
  title: string
  priority: "Priority" | "Critical" | "Maximum"
  triggers: readonly string[]
  ownerActorId: string
  verifierActorId: string | null
  responseDueAt: string
  decisionDueAt: string | null
  requiredEvidence: readonly string[]
  linkedApprovalRequestIds: readonly string[]
  sourceRowIdentity: string
  synthetic: boolean
  state: WarRoomState
  version: number
  evidence: readonly WarRoomEvidence[]
  history: readonly WarRoomEvent[]
}

const warRoomTransitions: Readonly<Record<WarRoomState, readonly WarRoomState[]>> = {
  Open: ["Assigned", "Escalated"],
  Assigned: ["In progress", "Escalated"],
  "In progress": ["Evidence submitted", "Escalated"],
  "Evidence submitted": ["Verified", "Reopened", "Escalated"],
  Verified: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Reopened: ["Assigned", "Escalated"],
  Escalated: ["Assigned"],
}

type CreateWarRoomInput = Omit<WarRoomCase, "state" | "version" | "evidence" | "history"> & { openedAt: string; openedBy: string }

export function createWarRoomCase(input: CreateWarRoomInput): WarRoomCase {
  if (!input.ownerActorId) throw new Error("A War Room case requires one named owner.")
  if (input.verifierActorId === input.ownerActorId) throw new Error("The War Room verifier must be independent of the owner.")
  if (input.triggers.length === 0 || input.requiredEvidence.length === 0) throw new Error("A War Room case requires triggers and expected evidence.")
  const event = Object.freeze({ eventId: `${input.caseId}-v1`, from: null, to: "Open" as const, actorId: input.openedBy, occurredAt: input.openedAt, note: input.triggers.join(" · "), version: 1 })
  return Object.freeze({
    caseId: input.caseId,
    studioId: input.studioId,
    title: input.title,
    priority: input.priority,
    triggers: Object.freeze([...input.triggers]),
    ownerActorId: input.ownerActorId,
    verifierActorId: input.verifierActorId,
    responseDueAt: input.responseDueAt,
    decisionDueAt: input.decisionDueAt,
    requiredEvidence: Object.freeze([...input.requiredEvidence]),
    linkedApprovalRequestIds: Object.freeze([...input.linkedApprovalRequestIds]),
    sourceRowIdentity: input.sourceRowIdentity,
    synthetic: input.synthetic,
    state: "Open",
    version: 1,
    evidence: Object.freeze([]),
    history: Object.freeze([event]),
  })
}

export function appendWarRoomEvidence(warRoomCase: WarRoomCase, evidence: WarRoomEvidence, expectedVersion: number) {
  if (expectedVersion !== warRoomCase.version) throw new Error(`Stale War Room version: expected ${warRoomCase.version}, received ${expectedVersion}.`)
  if (!evidence.protectedRef.startsWith("protected://")) throw new Error("War Room evidence must use a protected reference.")
  if (warRoomCase.evidence.some((item) => item.evidenceId === evidence.evidenceId || item.protectedRef === evidence.protectedRef)) throw new Error("War Room evidence is append-only and unique.")
  return Object.freeze({ ...warRoomCase, version: warRoomCase.version + 1, evidence: Object.freeze([...warRoomCase.evidence, Object.freeze({ ...evidence })]) })
}

export function transitionWarRoomCase(warRoomCase: WarRoomCase, input: { to: WarRoomState; actorId: string; occurredAt: string; note: string; expectedVersion: number; verifierActorId?: string }) {
  if (input.expectedVersion !== warRoomCase.version) throw new Error(`Stale War Room version: expected ${warRoomCase.version}, received ${input.expectedVersion}.`)
  if (!warRoomTransitions[warRoomCase.state].includes(input.to)) throw new Error(`Invalid War Room transition: ${warRoomCase.state} → ${input.to}.`)
  const verifierActorId = input.verifierActorId ?? warRoomCase.verifierActorId
  if (input.to === "Evidence submitted" && warRoomCase.evidence.length === 0) throw new Error("War Room proof cannot be submitted without protected evidence.")
  if (input.to === "Verified") {
    if (!warRoomCase.verifierActorId) throw new Error("War Room verification requires a previously named verifier.")
    if (input.verifierActorId !== undefined && input.verifierActorId !== warRoomCase.verifierActorId) throw new Error("The named War Room verifier cannot be substituted during verification.")
    if (warRoomCase.verifierActorId === warRoomCase.ownerActorId) throw new Error("The War Room verifier must be independent of the owner.")
    if (input.actorId !== warRoomCase.verifierActorId) throw new Error("Only the named War Room verifier can verify the case.")
    if (warRoomCase.evidence.length === 0) throw new Error("War Room verification requires evidence.")
  }
  const version = warRoomCase.version + 1
  const event = Object.freeze({ eventId: `${warRoomCase.caseId}-v${version}`, from: warRoomCase.state, to: input.to, actorId: input.actorId, occurredAt: input.occurredAt, note: input.note, version })
  return Object.freeze({ ...warRoomCase, state: input.to, verifierActorId, version, history: Object.freeze([...warRoomCase.history, event]) })
}

export type FinanceControlProjection = {
  eventType: "finance.war-room-closure.verified"
  caseId: string
  studioId: string | null
  result: "Verified closure"
  verifiedBy: string
  verifiedAt: string
  sourceRowIdentity: string
  synthetic: boolean
}

export function projectVerifiedWarRoomOutcome(warRoomCase: WarRoomCase): FinanceControlProjection {
  if (warRoomCase.state !== "Closed") throw new Error("Only a closed War Room case can enter reporting.")
  if (!warRoomCase.verifierActorId || warRoomCase.verifierActorId === warRoomCase.ownerActorId) throw new Error("Reporting requires independent War Room verification.")
  const verifiedEvent = warRoomCase.history.findLast((event) => event.to === "Verified")
  if (!verifiedEvent) throw new Error("A verified War Room event is required for reporting.")
  if (verifiedEvent.actorId !== warRoomCase.verifierActorId) throw new Error("The verified event actor must match the named War Room verifier.")
  return Object.freeze({
    eventType: "finance.war-room-closure.verified",
    caseId: warRoomCase.caseId,
    studioId: warRoomCase.studioId,
    result: "Verified closure",
    verifiedBy: warRoomCase.verifierActorId,
    verifiedAt: verifiedEvent.occurredAt,
    sourceRowIdentity: warRoomCase.sourceRowIdentity,
    synthetic: warRoomCase.synthetic,
  })
}
