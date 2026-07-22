import { POLICY_REGISTRY, policyAt, type PolicyDefinition, type SupplyModel } from "@/lib/operating-loop/contracts"

export const SCOUT_FUNNEL_STAGES = ["Identified", "Contacted", "Qualified", "Negotiation", "Floor Signed"] as const
export const SCOUT_WEDGES = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"] as const
export const SCOUT_PROTECTED_PRIORITY = ["Safety / emergency", "Studio War Room", "Cash / financial guardrail", "Legal / compliance"] as const
export const SCOUT_BLOCKED_CAPABILITIES = Object.freeze({
  gpsTracking: false,
  ownerContact: false,
  photography: false,
  whatsapp: false,
  externalMessaging: false,
  leaseCommitment: false,
  payment: false,
  capitalCommitment: false,
  liveRouteAssignment: false,
  productionWrite: false,
})

export type ScoutFunnelStage = (typeof SCOUT_FUNNEL_STAGES)[number]
export type ScoutWedge = (typeof SCOUT_WEDGES)[number]
export type ScoutRing = "Ring 1" | "Ring 2" | "Beyond 5 km"
export type ShiftPattern = "Single" | "Two shift" | "Three shift" | "Continuous"
export type CandidateBuildingType = "PG-convertible" | "Standalone" | "Bare land"

export type ScoutRegistrySnapshot = {
  version: string
  effectiveAt: string
  triggerStage: ScoutFunnelStage
  ring1MaxKm: number
  ring2MaxKm: number
  wedgeCount: number
  sharedCatchmentMinimumGates: number
  wedgeMinutes: number
  targetRentPerNestInr: number
  targetCapacityNests: number
  billedArpuInr: number
  shuttleCeilingPerNestInr: number
  stallDays: number
  negotiationCertainty: number
  shiftFactors: Readonly<Record<ShiftPattern, number>>
  approvedHours: string
  requiredCheckIns: number
  policyRefs: readonly string[]
  provisionalPolicyRefs: readonly string[]
}

const scoutPolicyIds = [
  "POL-SP-SCOUT-TRIGGER-STAGE",
  "POL-SP-SCOUT-RING-1-MAX",
  "POL-SP-SCOUT-RING-2-MAX",
  "POL-SP-SCOUT-WEDGES",
  "POL-SP-SCOUT-SHARED-CATCHMENT-GATES",
  "POL-SP-SCOUT-WEDGE-MINUTES",
  "POL-SP-SCOUT-TARGET-RENT",
  "POL-SP-SCOUT-TARGET-CAPACITY",
  "POL-SP-SCOUT-BILLED-ARPU",
  "POL-SP-SCOUT-SHUTTLE-CEILING",
  "POL-SP-SCOUT-STALL-DAYS",
  "POL-SP-SCOUT-NEGOTIATION-CERTAINTY",
  "POL-SP-SCOUT-SHIFT-SINGLE",
  "POL-SP-SCOUT-SHIFT-TWO",
  "POL-SP-SCOUT-SHIFT-THREE",
  "POL-SP-SCOUT-SHIFT-CONTINUOUS",
  "POL-SP-SCOUT-APPROVED-HOURS",
  "POL-SP-SCOUT-CHECKINS",
] as const

function requiredPolicy(policyId: (typeof scoutPolicyIds)[number], at: string, registry: readonly PolicyDefinition[]) {
  const policy = policyAt(policyId, at, registry)
  if (!policy) throw new Error(`Active scout policy ${policyId} is required at ${at}.`)
  return policy
}

function finitePolicy(policyId: (typeof scoutPolicyIds)[number], at: string, registry: readonly PolicyDefinition[]) {
  const policy = requiredPolicy(policyId, at, registry)
  if (typeof policy.value !== "number" || !Number.isFinite(policy.value)) throw new Error(`${policyId} must contain a finite number.`)
  return policy
}

export function scoutRegistryAt(at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY): ScoutRegistrySnapshot {
  const policies = new Map(scoutPolicyIds.map((policyId) => [policyId, requiredPolicy(policyId, at, registry)]))
  const numeric = (policyId: (typeof scoutPolicyIds)[number]) => finitePolicy(policyId, at, registry).value as number
  const text = (policyId: (typeof scoutPolicyIds)[number]) => String(policies.get(policyId)?.value)
  const policyRefs = scoutPolicyIds.map((policyId) => `${policyId}@v${policies.get(policyId)?.version}`)
  const provisionalPolicyRefs = scoutPolicyIds
    .map((policyId) => policies.get(policyId)!)
    .filter((policy) => /provisional/i.test(policy.source))
    .map((policy) => `${policy.policyId}@v${policy.version}`)
  return Object.freeze({
    version: `SP-SCOUT-REGISTRY@v${Math.max(...scoutPolicyIds.map((policyId) => policies.get(policyId)?.version ?? 0))}`,
    effectiveAt: at,
    triggerStage: text("POL-SP-SCOUT-TRIGGER-STAGE") as ScoutFunnelStage,
    ring1MaxKm: numeric("POL-SP-SCOUT-RING-1-MAX"),
    ring2MaxKm: numeric("POL-SP-SCOUT-RING-2-MAX"),
    wedgeCount: numeric("POL-SP-SCOUT-WEDGES"),
    sharedCatchmentMinimumGates: numeric("POL-SP-SCOUT-SHARED-CATCHMENT-GATES"),
    wedgeMinutes: numeric("POL-SP-SCOUT-WEDGE-MINUTES"),
    targetRentPerNestInr: numeric("POL-SP-SCOUT-TARGET-RENT"),
    targetCapacityNests: numeric("POL-SP-SCOUT-TARGET-CAPACITY"),
    billedArpuInr: numeric("POL-SP-SCOUT-BILLED-ARPU"),
    shuttleCeilingPerNestInr: numeric("POL-SP-SCOUT-SHUTTLE-CEILING"),
    stallDays: numeric("POL-SP-SCOUT-STALL-DAYS"),
    negotiationCertainty: numeric("POL-SP-SCOUT-NEGOTIATION-CERTAINTY"),
    shiftFactors: Object.freeze({
      Single: numeric("POL-SP-SCOUT-SHIFT-SINGLE"),
      "Two shift": numeric("POL-SP-SCOUT-SHIFT-TWO"),
      "Three shift": numeric("POL-SP-SCOUT-SHIFT-THREE"),
      Continuous: numeric("POL-SP-SCOUT-SHIFT-CONTINUOUS"),
    }),
    approvedHours: text("POL-SP-SCOUT-APPROVED-HOURS"),
    requiredCheckIns: numeric("POL-SP-SCOUT-CHECKINS"),
    policyRefs: Object.freeze(policyRefs),
    provisionalPolicyRefs: Object.freeze(provisionalPolicyRefs),
  })
}

function policyReference(policies: ScoutRegistrySnapshot, policyId: string) {
  const reference = policies.policyRefs.find((item) => item.startsWith(`${policyId}@`))
  if (!reference) throw new Error(`Policy reference ${policyId} is missing from ${policies.version}.`)
  return reference
}

export function normaliseBearing(bearing: number) {
  if (!Number.isFinite(bearing)) throw new Error("A finite bearing is required.")
  return ((bearing % 360) + 360) % 360
}

export function wedgeForBearing(bearing: number): ScoutWedge {
  return SCOUT_WEDGES[Math.floor(normaliseBearing(bearing) / 45)]
}

export function classifyScoutRing(distanceKm: number, at = "2026-07-17T08:00:00+05:30", registry: readonly PolicyDefinition[] = POLICY_REGISTRY): ScoutRing {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error("Distance must be a non-negative finite number.")
  const policies = scoutRegistryAt(at, registry)
  if (distanceKm <= policies.ring1MaxKm) return "Ring 1"
  if (distanceKm <= policies.ring2MaxKm) return "Ring 2"
  return "Beyond 5 km"
}

function protectedReference(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("protected://") && value.length > "protected://".length
}

export type DemandGateInput = {
  gateId: string
  supplyModel: SupplyModel | null
  funnelStage: ScoutFunnelStage
  stageEnteredAt: string
  expectedCloseDate: string
  headcount: number
  migrantShare: number
  shiftPattern: ShiftPattern
  contractability: number
  enterpriseRef: string
  gateCoordinateRef: string
  workforceEvidenceRef: string
  triggerEvidenceRef: string | null
  sourceRowIdentity: string
  synthetic: boolean
  verificationState: "Verified" | "Pending" | "Failed"
  previouslyTriggeredAt?: string | null
}

export type ProtectedPriorityInput = {
  priorityId: string
  category: (typeof SCOUT_PROTECTED_PRIORITY)[number]
  active: boolean
  evidenceRef: string
}

export type GateQueueDecision = {
  gateId: string
  supplyModel: SupplyModel | null
  stage: ScoutFunnelStage
  disposition: "Live shadow trigger" | "Continuing" | "Blocked" | "Quarantined"
  rank: number | null
  potentialOccupiedNests: number | null
  queueValueInr: number | null
  reason: string
  triggeredAt: string | null
  policyRefs: readonly string[]
  sourceRowIdentity: string
}

function gateValidationReasons(gate: DemandGateInput) {
  const reasons: string[] = []
  if (gate.supplyModel !== "SP") reasons.push(gate.supplyModel === "FONO" ? "FONO rows cannot enter the SP scout playbook." : "Missing supply_model; SP must be explicit.")
  if (!gate.synthetic) reasons.push("Only synthetic fixture rows are admitted in shadow mode.")
  if (gate.verificationState !== "Verified") reasons.push("Gate evidence must be independently Verified.")
  if (!protectedReference(gate.enterpriseRef)) reasons.push("Enterprise details require a protected reference.")
  if (!protectedReference(gate.gateCoordinateRef)) reasons.push("The factory-gate centroid requires a protected coordinate reference.")
  if (!protectedReference(gate.workforceEvidenceRef)) reasons.push("Headcount and shift inputs require protected evidence.")
  if (!gate.sourceRowIdentity) reasons.push("Source row lineage is required.")
  if (![gate.headcount, gate.migrantShare, gate.contractability].every(Number.isFinite) || gate.headcount <= 0 || gate.migrantShare < 0 || gate.migrantShare > 1 || gate.contractability < 0 || gate.contractability > 1) reasons.push("Gate ranking inputs are invalid.")
  return reasons
}

export function buildScoutQueue(
  gates: readonly DemandGateInput[],
  protectedPriority: readonly ProtectedPriorityInput[],
  at: string,
  registry: readonly PolicyDefinition[] = POLICY_REGISTRY,
) {
  const policies = scoutRegistryAt(at, registry)
  const protectedQueue = protectedPriority
    .filter((item) => item.active)
    .map((item) => {
      if (!protectedReference(item.evidenceRef)) throw new Error(`Protected priority ${item.priorityId} requires evidence.`)
      return Object.freeze({ ...item, rank: SCOUT_PROTECTED_PRIORITY.indexOf(item.category) + 1 })
    })
    .toSorted((a, b) => a.rank - b.rank)
  const eligible: Array<GateQueueDecision & { closeTime: number; enteredTime: number }> = []
  const other: GateQueueDecision[] = []

  for (const gate of gates) {
    const invalid = gateValidationReasons(gate)
    if (invalid.length > 0) {
      other.push(Object.freeze({ gateId: gate.gateId, supplyModel: gate.supplyModel, stage: gate.funnelStage, disposition: "Quarantined", rank: null, potentialOccupiedNests: null, queueValueInr: null, reason: invalid.join(" "), triggeredAt: null, policyRefs: Object.freeze([]), sourceRowIdentity: gate.sourceRowIdentity }))
      continue
    }
    const isTrigger = gate.funnelStage === policies.triggerStage
    const isContinuing = gate.funnelStage === "Floor Signed" && Boolean(gate.previouslyTriggeredAt)
    if (!isTrigger && !isContinuing) {
      other.push(Object.freeze({ gateId: gate.gateId, supplyModel: gate.supplyModel, stage: gate.funnelStage, disposition: "Blocked", rank: null, potentialOccupiedNests: null, queueValueInr: null, reason: `Supply remains blocked until ${policies.triggerStage}; no speculative scouting.`, triggeredAt: null, policyRefs: Object.freeze([policyReference(policies, "POL-SP-SCOUT-TRIGGER-STAGE")]), sourceRowIdentity: gate.sourceRowIdentity }))
      continue
    }
    if (!protectedReference(gate.triggerEvidenceRef)) {
      other.push(Object.freeze({ gateId: gate.gateId, supplyModel: gate.supplyModel, stage: gate.funnelStage, disposition: "Quarantined", rank: null, potentialOccupiedNests: null, queueValueInr: null, reason: "A protected Negotiation trigger reference is required.", triggeredAt: null, policyRefs: Object.freeze([]), sourceRowIdentity: gate.sourceRowIdentity }))
      continue
    }
    const shiftFactor = policies.shiftFactors[gate.shiftPattern]
    const potentialOccupiedNests = gate.headcount * gate.migrantShare * shiftFactor * gate.contractability
    const queueValueInr = potentialOccupiedNests * policies.billedArpuInr * policies.negotiationCertainty
    eligible.push({
      gateId: gate.gateId,
      supplyModel: gate.supplyModel,
      stage: gate.funnelStage,
      disposition: isTrigger ? "Live shadow trigger" : "Continuing",
      rank: null,
      potentialOccupiedNests: Math.round(potentialOccupiedNests * 10) / 10,
      queueValueInr: Math.round(queueValueInr),
      reason: isTrigger ? "Entered Negotiation; same-day synthetic sweep recommendation." : "Previously triggered sweep remains open after floor signature.",
      triggeredAt: isTrigger ? gate.stageEnteredAt : gate.previouslyTriggeredAt ?? null,
      policyRefs: Object.freeze([
        policyReference(policies, "POL-SP-SCOUT-TRIGGER-STAGE"),
        policyReference(policies, "POL-SP-SCOUT-BILLED-ARPU"),
        policyReference(policies, "POL-SP-SCOUT-NEGOTIATION-CERTAINTY"),
        policyReference(policies, `POL-SP-SCOUT-SHIFT-${gate.shiftPattern === "Single" ? "SINGLE" : gate.shiftPattern === "Two shift" ? "TWO" : gate.shiftPattern === "Three shift" ? "THREE" : "CONTINUOUS"}`),
      ]),
      sourceRowIdentity: gate.sourceRowIdentity,
      closeTime: Date.parse(`${gate.expectedCloseDate}T00:00:00+05:30`),
      enteredTime: Date.parse(gate.stageEnteredAt),
    })
  }

  const ranked = eligible
    .toSorted((a, b) => (b.queueValueInr ?? 0) - (a.queueValueInr ?? 0) || a.closeTime - b.closeTime || a.enteredTime - b.enteredTime)
    .map(({ closeTime: _closeTime, enteredTime: _enteredTime, ...item }, index) => Object.freeze({ ...item, rank: index + 1 }))

  return Object.freeze({
    protectedQueue: Object.freeze(protectedQueue),
    gateQueue: Object.freeze([...ranked, ...other]),
    scoutWorkPreempted: protectedQueue.length > 0,
    policyVersion: policies.version,
  })
}

export type FieldSafetyInput = {
  localHour: number
  plannedCheckIns: number
  publicAccess: boolean
  ownerConsentRef: string | null
  noTrespass: boolean
  hazardStatus: "Cleared" | "PPE required" | "Buddy required" | "Stop work"
  ppeControlsRef: string | null
  unsafeSolo: boolean
  buddyRef: string | null
  emergencyRef: string | null
  stopWorkInstructionVisible: boolean
}

export function evaluateFieldSafety(input: FieldSafetyInput, at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY) {
  const policies = scoutRegistryAt(at, registry)
  const [start, end] = policies.approvedHours.split("–").map((value) => Number(value.split(":")[0]))
  const failures: string[] = []
  if (!Number.isFinite(input.localHour) || input.localHour < start || input.localHour >= end) failures.push(`Outside approved daylight window ${policies.approvedHours}.`)
  if (input.plannedCheckIns < policies.requiredCheckIns) failures.push(`${policies.requiredCheckIns} start/midpoint/end check-ins are required.`)
  if (!input.noTrespass) failures.push("Trespass is prohibited.")
  if (!input.publicAccess && !protectedReference(input.ownerConsentRef)) failures.push("Protected owner consent is required for non-public access.")
  if (input.hazardStatus === "Stop work") failures.push("Hazard review requires stop work.")
  if (input.hazardStatus === "PPE required" && !protectedReference(input.ppeControlsRef)) failures.push("Required PPE controls need protected evidence.")
  if ((input.hazardStatus === "Buddy required" || input.unsafeSolo) && !protectedReference(input.buddyRef)) failures.push("An unsafe solo visit requires an evidenced safety buddy.")
  if (!protectedReference(input.emergencyRef)) failures.push("A protected emergency escalation reference is required.")
  if (!input.stopWorkInstructionVisible) failures.push("The stop-work instruction must be visible.")
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    policyRefs: Object.freeze([policyReference(policies, "POL-SP-SCOUT-APPROVED-HOURS"), policyReference(policies, "POL-SP-SCOUT-CHECKINS")]),
  })
}

export type CandidateInput = {
  candidateId: string
  gateId: string
  supplyModel: SupplyModel | null
  sourceRowIdentity: string
  synthetic: boolean
  distanceKm: number
  bearing: number
  buildingType: CandidateBuildingType
  estimatedNestCapacity: number
  askingRentInrMonth: number
  shuttleCostPerNestInr: number
  coordinateRef: string
  photoRef: string
  ownerRef: string | null
  utilityEvidenceRef: string
  scoutActorId: string
  verifierActorId: string
  fieldSafety: FieldSafetyInput
  sharedCatchmentGateIds?: readonly string[]
  sharedCatchmentEvidenceRef?: string | null
  sharedCatchmentApprovalRef?: string | null
  rawCoordinates?: { lat: number; lng: number } | null
  rawPhoto?: string | null
  rawOwnerContact?: string | null
}

export type WedgeVerification = {
  eventId: string
  gateId: string
  supplyModel: SupplyModel
  ring: Exclude<ScoutRing, "Beyond 5 km">
  wedge: ScoutWedge
  result: "Candidate returned" | "No candidate at target-rent policy"
  evidenceRef: string
  scoutActorId: string
  verifierActorId: string
  verifiedAt: string
  targetRentPolicyRef: string
}

export function ringCoverage(events: readonly WedgeVerification[], gateId: string, ring: Exclude<ScoutRing, "Beyond 5 km">, at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY) {
  const policies = scoutRegistryAt(at, registry)
  const targetRentPolicyRef = policyReference(policies, "POL-SP-SCOUT-TARGET-RENT")
  const accepted = events.filter((event) => event.gateId === gateId && event.ring === ring && event.supplyModel === "SP" && event.scoutActorId !== event.verifierActorId && protectedReference(event.evidenceRef) && event.targetRentPolicyRef === targetRentPolicyRef)
  const verified = new Set(accepted.map((event) => event.wedge))
  return Object.freeze({
    gateId,
    ring,
    verifiedWedges: Object.freeze(SCOUT_WEDGES.filter((wedge) => verified.has(wedge))),
    awaitingWedges: Object.freeze(SCOUT_WEDGES.filter((wedge) => !verified.has(wedge))),
    complete: verified.size === policies.wedgeCount,
    policyRefs: Object.freeze([policyReference(policies, "POL-SP-SCOUT-WEDGES"), policyReference(policies, "POL-SP-SCOUT-TARGET-RENT")]),
  })
}

function fitScore(input: CandidateInput, policies: ScoutRegistrySnapshot, ring: ScoutRing) {
  const askingRentPerNest = input.askingRentInrMonth / input.estimatedNestCapacity
  if (![input.distanceKm, input.estimatedNestCapacity, input.askingRentInrMonth, input.shuttleCostPerNestInr].every(Number.isFinite) || input.estimatedNestCapacity <= 0 || askingRentPerNest <= 0) return null
  const capacity = Math.min(input.estimatedNestCapacity / policies.targetCapacityNests, 1)
  const proximity = Math.max(0, 1 - input.distanceKm / policies.ring2MaxKm)
  const convertibility = input.buildingType === "PG-convertible" ? 1 : input.buildingType === "Standalone" ? 0.75 : 0.45
  const rent = Math.min(policies.targetRentPerNestInr / askingRentPerNest, 1.25)
  const shuttle = ring === "Ring 1" ? 1 : Math.max(0, 1 - input.shuttleCostPerNestInr / policies.shuttleCeilingPerNestInr)
  return Object.freeze({
    score: Math.round(100 * capacity * proximity * convertibility * rent * shuttle * 10) / 10,
    factors: Object.freeze({ capacity, proximity, convertibility, rent, shuttle }),
    askingRentPerNestInr: Math.round(askingRentPerNest),
    policyRefs: Object.freeze([
      policyReference(policies, "POL-SP-SCOUT-TARGET-CAPACITY"),
      policyReference(policies, "POL-SP-SCOUT-RING-2-MAX"),
      policyReference(policies, "POL-SP-SCOUT-TARGET-RENT"),
      policyReference(policies, "POL-SP-SCOUT-SHUTTLE-CEILING"),
    ]),
  })
}

export function evaluateCandidate(
  input: CandidateInput,
  ring1Events: readonly WedgeVerification[],
  at: string,
  registry: readonly PolicyDefinition[] = POLICY_REGISTRY,
) {
  const policies = scoutRegistryAt(at, registry)
  const quarantineReasons: string[] = []
  if (input.supplyModel !== "SP") quarantineReasons.push(input.supplyModel === "FONO" ? "FONO candidate cannot use the SP scout playbook." : "Missing supply_model; SP must be explicit.")
  if (!input.synthetic) quarantineReasons.push("Only synthetic fixtures are admitted in shadow mode.")
  if (!input.sourceRowIdentity) quarantineReasons.push("Source row lineage is required.")
  if (!protectedReference(input.coordinateRef)) quarantineReasons.push("Coordinates require a protected reference.")
  if (!protectedReference(input.photoRef)) quarantineReasons.push("Photographs require a protected reference.")
  if (input.ownerRef && !protectedReference(input.ownerRef)) quarantineReasons.push("Owner details require a protected reference.")
  if (!protectedReference(input.utilityEvidenceRef)) quarantineReasons.push("Utilities require protected evidence.")
  if (input.rawCoordinates) quarantineReasons.push("Raw coordinates cannot enter the reporting projection.")
  if (input.rawPhoto) quarantineReasons.push("Raw photographs cannot enter the reporting projection.")
  if (input.rawOwnerContact) quarantineReasons.push("Raw owner contact data cannot enter the reporting projection.")
  if (!input.scoutActorId || !input.verifierActorId || input.scoutActorId === input.verifierActorId) quarantineReasons.push("An independent verifier is required.")
  if (quarantineReasons.length > 0) return Object.freeze({ candidateId: input.candidateId, supplyModel: input.supplyModel, disposition: "Quarantined" as const, ring: null, wedge: null, fitScore: null, humanApprovalRequired: false, reasons: Object.freeze(quarantineReasons), actionBoundary: "No execution authority" as const })

  const safety = evaluateFieldSafety(input.fieldSafety, at, registry)
  if (!safety.passed) return Object.freeze({ candidateId: input.candidateId, supplyModel: input.supplyModel, disposition: "Blocked" as const, ring: classifyScoutRing(input.distanceKm, at, registry), wedge: wedgeForBearing(input.bearing), fitScore: null, humanApprovalRequired: false, reasons: safety.failures, actionBoundary: "No execution authority" as const })

  const ring = classifyScoutRing(input.distanceKm, at, registry)
  const wedge = wedgeForBearing(input.bearing)
  if (ring === "Beyond 5 km") {
    const gates = new Set(input.sharedCatchmentGateIds ?? [])
    const hasEvidence = protectedReference(input.sharedCatchmentEvidenceRef)
    const hasApproval = protectedReference(input.sharedCatchmentApprovalRef)
    if (gates.size < policies.sharedCatchmentMinimumGates || !hasEvidence || !hasApproval) return Object.freeze({ candidateId: input.candidateId, supplyModel: input.supplyModel, disposition: "Rejected" as const, ring, wedge, fitScore: null, humanApprovalRequired: true, reasons: Object.freeze(["Beyond 5 km rejects unless two or more SP gates, protected shared-catchment evidence and named human approval are present."]), actionBoundary: "No execution authority" as const })
    return Object.freeze({ candidateId: input.candidateId, supplyModel: input.supplyModel, disposition: "Shared-catchment review" as const, ring, wedge, fitScore: null, humanApprovalRequired: true, reasons: Object.freeze(["Human-approved exception is recommendation-only; lease, spend and live assignment remain blocked."]), actionBoundary: "No execution authority" as const })
  }

  if (ring === "Ring 2" && !ringCoverage(ring1Events, input.gateId, "Ring 1", at, registry).complete) return Object.freeze({ candidateId: input.candidateId, supplyModel: input.supplyModel, disposition: "Blocked" as const, ring, wedge, fitScore: null, humanApprovalRequired: false, reasons: Object.freeze(["Ring 2 remains blocked until all eight Ring 1 wedges close independently at the active target-rent policy."]), actionBoundary: "No execution authority" as const })

  const score = fitScore(input, policies, ring)
  if (!score) return Object.freeze({ candidateId: input.candidateId, supplyModel: input.supplyModel, disposition: "Quarantined" as const, ring, wedge, fitScore: null, humanApprovalRequired: false, reasons: Object.freeze(["Fit-score inputs are incomplete or invalid."]), actionBoundary: "No execution authority" as const })
  return Object.freeze({ candidateId: input.candidateId, supplyModel: input.supplyModel, disposition: "Recommended for review" as const, ring, wedge, fitScore: score, humanApprovalRequired: true, reasons: Object.freeze(["Fit score ranks evidence only and never approves contact, lease, spend, capital or route assignment."]), actionBoundary: "No execution authority" as const })
}

export type ScoutAuditEvent = {
  eventId: string
  state: "Detected" | "Evidence submitted" | "Verified" | "Reopened" | "Blocked"
  occurredAt: string
  actorId: string
  evidenceRef: string
  supplyModel: "SP"
  version: number
}

export type ScoutRouteRecord = {
  routeId: string
  gateId: string
  supplyModel: "SP"
  ownerActorId: string
  verifierActorId: string
  version: number
  history: readonly ScoutAuditEvent[]
}

export function createScoutRouteRecord(input: Omit<ScoutRouteRecord, "supplyModel" | "version" | "history"> & { supplyModel: SupplyModel | null; at: string; evidenceRef: string }) {
  if (input.supplyModel !== "SP") throw new Error("Scout route records require explicit supply_model=SP.")
  if (!input.ownerActorId || !input.verifierActorId || input.ownerActorId === input.verifierActorId) throw new Error("Scout route records require an independent verifier.")
  if (!protectedReference(input.evidenceRef)) throw new Error("Scout route records require protected evidence.")
  return Object.freeze({
    routeId: input.routeId,
    gateId: input.gateId,
    supplyModel: "SP" as const,
    ownerActorId: input.ownerActorId,
    verifierActorId: input.verifierActorId,
    version: 1,
    history: Object.freeze([{ eventId: `${input.routeId}-v1`, state: "Detected" as const, occurredAt: input.at, actorId: input.ownerActorId, evidenceRef: input.evidenceRef, supplyModel: "SP" as const, version: 1 }]),
  })
}

export function appendScoutAuditEvent(record: ScoutRouteRecord, event: Omit<ScoutAuditEvent, "eventId" | "version" | "supplyModel"> & { expectedVersion: number }) {
  if (event.expectedVersion !== record.version) throw new Error(`Stale scout record version: expected ${record.version}, received ${event.expectedVersion}.`)
  if (!protectedReference(event.evidenceRef)) throw new Error("Scout audit events require protected evidence.")
  if (event.state === "Verified" && event.actorId !== record.verifierActorId) throw new Error("Only the independent verifier can verify a scout route record.")
  const version = record.version + 1
  const next = Object.freeze({ eventId: `${record.routeId}-v${version}`, state: event.state, occurredAt: event.occurredAt, actorId: event.actorId, evidenceRef: event.evidenceRef, supplyModel: "SP" as const, version })
  return Object.freeze({ ...record, version, history: Object.freeze([...record.history, next]) })
}
