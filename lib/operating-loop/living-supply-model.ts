import { createOperatingAction, type LivingPlaybook, type OperatingAction } from "@/lib/operating-loop/action-engine"
import { POLICY_REGISTRY, policyAt, type PolicyDefinition, type SupplyModel } from "@/lib/operating-loop/contracts"

export type GovernedMetricValue = Readonly<{
  value: number | null
  state: "Available" | "No data"
  definitionRef: string
  sourceCoverage: string
}>

export type LivingCapacityLineage = Readonly<{
  studioMasterRowIdentity: string
  livingRowIdentity: string
  sourceName: string
  asOf: string
  synthetic: boolean
}>

type LivingCapacityBase = {
  studioId: string
  studioName: string
  theatreId: string
  supplyModel: SupplyModel
  contractedNests: number
  activationReadyNests: number
  occupiedNests: number
  payingNests: number
  billedLivingRevenueInr: number
  verifiedCollectionsInr: number
  cm1Inr: number | null
  cm1DefinitionRef: string | null
  cm2Inr: number | null
  cm2DefinitionRef: string | null
  lineage: LivingCapacityLineage
}

export type FonoCapacityRow = LivingCapacityBase & {
  supplyModel: "FONO"
  franchiseeSourcedMembers: number
  niaFilledMembers: number
  vacantNestsAtCycleStart: number
}

export type SpReadinessStatus = "Ready" | "In progress" | "Blocked" | "No data"

export type SpCapacityRow = LivingCapacityBase & {
  supplyModel: "SP"
  enterpriseDemandNests: number
  enterpriseContractCoveredNests: number
  capexExposureInr: number
  blockingMilestone: string | null
  readiness: Readonly<{
    buildOut: SpReadinessStatus
    hardwareAmenities: SpReadinessStatus
    sukh: SpReadinessStatus
    ufd: SpReadinessStatus
  }>
}

export type LivingCapacityRow = FonoCapacityRow | SpCapacityRow

export type LivingChannelProjection = Readonly<{
  supplyModel: SupplyModel | "Combined"
  studioCount: number
  contractedNests: number
  activationReadyNests: number
  occupiedNests: number
  payingNests: number
  occupancy: GovernedMetricValue
  billedArpu: GovernedMetricValue
  collectionLeakage: GovernedMetricValue
  cm1: GovernedMetricValue
  cm2: GovernedMetricValue
  sourceLineage: readonly LivingCapacityLineage[]
}>

export type FonoChannelDetail = Readonly<{
  franchiseeSourcedMembers: number
  niaFilledMembers: number
  vacantNestsAtCycleStart: number
  niaFillRate: GovernedMetricValue
}>

export type SpParkDetail = Readonly<{
  studioId: string
  studioName: string
  activationReadyNests: number
  enterpriseDemandNests: number
  enterpriseContractCoveredNests: number
  contractCoverage: GovernedMetricValue
  capexExposureInr: number
  blockingMilestone: string | null
  readiness: SpCapacityRow["readiness"]
  lineage: LivingCapacityLineage
}>

export type LivingSupplyReport = Readonly<{
  mode: "Shadow mode"
  refreshedAt: string
  channelOrder: readonly ["FONO", "SP"]
  channels: readonly LivingChannelProjection[]
  combined: LivingChannelProjection | null
  combinedState: "Visible after FONO and SP" | "Blocked until FONO and SP are both visible"
  fono: FonoChannelDetail | null
  spParks: readonly SpParkDetail[]
}>

function finiteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number.`)
}

function availableMetric(value: number, definitionRef: string, sourceCoverage: string): GovernedMetricValue {
  return Object.freeze({ value, state: "Available", definitionRef, sourceCoverage })
}

function noDataMetric(definitionRef: string, sourceCoverage: string): GovernedMetricValue {
  return Object.freeze({ value: null, state: "No data", definitionRef, sourceCoverage })
}

function governedAggregate(
  rows: readonly LivingCapacityRow[],
  value: (row: LivingCapacityRow) => number | null,
  definition: (row: LivingCapacityRow) => string | null,
  metricId: string,
) {
  const values = rows.map(value)
  const definitions = new Set(rows.map(definition).filter((item): item is string => Boolean(item)))
  if (values.some((item) => item === null) || definitions.size !== 1) return noDataMetric(metricId, "Governed definition or source coverage is incomplete")
  return availableMetric(values.reduce<number>((sum, item) => sum + (item ?? 0), 0), [...definitions][0], "Complete governed Studio coverage")
}

function projectChannel(supplyModel: SupplyModel, rows: readonly LivingCapacityRow[]): LivingChannelProjection | null {
  const channelRows = rows.filter((row) => row.supplyModel === supplyModel)
  if (channelRows.length === 0) return null
  const contractedNests = channelRows.reduce((sum, row) => sum + row.contractedNests, 0)
  const activationReadyNests = channelRows.reduce((sum, row) => sum + row.activationReadyNests, 0)
  const occupiedNests = channelRows.reduce((sum, row) => sum + row.occupiedNests, 0)
  const payingNests = channelRows.reduce((sum, row) => sum + row.payingNests, 0)
  const billed = channelRows.reduce((sum, row) => sum + row.billedLivingRevenueInr, 0)
  const collected = channelRows.reduce((sum, row) => sum + row.verifiedCollectionsInr, 0)
  return Object.freeze({
    supplyModel,
    studioCount: channelRows.length,
    contractedNests,
    activationReadyNests,
    occupiedNests,
    payingNests,
    occupancy: contractedNests > 0 ? availableMetric(occupiedNests / contractedNests, "MET-LIVING-OCCUPANCY@v1", "Studio Master + Living hourly") : noDataMetric("MET-LIVING-OCCUPANCY@v1", "No contracted Nests"),
    billedArpu: occupiedNests > 0 ? availableMetric(billed / occupiedNests, "MET-LIVING-BILLED-ARPU@v1", "Billed Living revenue + occupied Nests") : noDataMetric("MET-LIVING-BILLED-ARPU@v1", "No occupied Nests"),
    collectionLeakage: availableMetric(billed - collected, "MET-LIVING-COLLECTION-LEAKAGE@v1", "Billed revenue + verified collections"),
    cm1: governedAggregate(channelRows, (row) => row.cm1Inr, (row) => row.cm1DefinitionRef, "MET-LIVING-CM1@v1"),
    cm2: governedAggregate(channelRows, (row) => row.cm2Inr, (row) => row.cm2DefinitionRef, "MET-LIVING-CM2@v1"),
    sourceLineage: Object.freeze(channelRows.map((row) => row.lineage)),
  })
}

function combineChannels(fono: LivingChannelProjection, sp: LivingChannelProjection): LivingChannelProjection {
  const contractedNests = fono.contractedNests + sp.contractedNests
  const occupiedNests = fono.occupiedNests + sp.occupiedNests
  const billedTotal = (fono.billedArpu.value ?? 0) * fono.occupiedNests + (sp.billedArpu.value ?? 0) * sp.occupiedNests
  const combinedMetric = (left: GovernedMetricValue, right: GovernedMetricValue, metricId: string) => left.value !== null && right.value !== null
    ? availableMetric(left.value + right.value, metricId, "FONO + SP governed coverage")
    : noDataMetric(metricId, "FONO or SP governed definition/source coverage is incomplete")
  return Object.freeze({
    supplyModel: "Combined",
    studioCount: fono.studioCount + sp.studioCount,
    contractedNests,
    activationReadyNests: fono.activationReadyNests + sp.activationReadyNests,
    occupiedNests,
    payingNests: fono.payingNests + sp.payingNests,
    occupancy: contractedNests > 0 ? availableMetric(occupiedNests / contractedNests, "MET-LIVING-OCCUPANCY@v1", "FONO + SP") : noDataMetric("MET-LIVING-OCCUPANCY@v1", "No contracted Nests"),
    billedArpu: occupiedNests > 0 ? availableMetric(billedTotal / occupiedNests, "MET-LIVING-BILLED-ARPU@v1", "FONO + SP weighted by occupied Nests") : noDataMetric("MET-LIVING-BILLED-ARPU@v1", "No occupied Nests"),
    collectionLeakage: combinedMetric(fono.collectionLeakage, sp.collectionLeakage, "MET-LIVING-COLLECTION-LEAKAGE@v1"),
    cm1: combinedMetric(fono.cm1, sp.cm1, "MET-LIVING-CM1@v1"),
    cm2: combinedMetric(fono.cm2, sp.cm2, "MET-LIVING-CM2@v1"),
    sourceLineage: Object.freeze([...fono.sourceLineage, ...sp.sourceLineage]),
  })
}

export function buildLivingSupplyReport(rows: readonly LivingCapacityRow[], refreshedAt: string): LivingSupplyReport {
  const studioIds = new Set<string>()
  for (const row of rows) {
    if (studioIds.has(row.studioId)) throw new Error(`Living capacity Studio ${row.studioId} appears more than once.`)
    studioIds.add(row.studioId)
    for (const [label, value] of Object.entries({ contractedNests: row.contractedNests, activationReadyNests: row.activationReadyNests, occupiedNests: row.occupiedNests, payingNests: row.payingNests, billedLivingRevenueInr: row.billedLivingRevenueInr, verifiedCollectionsInr: row.verifiedCollectionsInr })) finiteNonNegative(value, `${row.studioId} ${label}`)
    if (row.activationReadyNests > row.contractedNests || row.occupiedNests > row.activationReadyNests || row.payingNests > row.occupiedNests) throw new Error(`${row.studioId} Living capacity states are inconsistent.`)
    if (!row.lineage.studioMasterRowIdentity || !row.lineage.livingRowIdentity) throw new Error(`${row.studioId} requires visible Studio Master and Living lineage.`)
  }
  const fono = projectChannel("FONO", rows)
  const sp = projectChannel("SP", rows)
  const channels = Object.freeze([fono, sp].filter((item): item is LivingChannelProjection => item !== null))
  const fonoRows = rows.filter((row): row is FonoCapacityRow => row.supplyModel === "FONO")
  const franchiseeSourcedMembers = fonoRows.reduce((sum, row) => sum + row.franchiseeSourcedMembers, 0)
  const niaFilledMembers = fonoRows.reduce((sum, row) => sum + row.niaFilledMembers, 0)
  const vacantNestsAtCycleStart = fonoRows.reduce((sum, row) => sum + row.vacantNestsAtCycleStart, 0)
  const fonoDetail = fonoRows.length ? Object.freeze({
    franchiseeSourcedMembers,
    niaFilledMembers,
    vacantNestsAtCycleStart,
    niaFillRate: vacantNestsAtCycleStart > 0 ? availableMetric(niaFilledMembers / vacantNestsAtCycleStart, "MET-FONO-NIA-FILL@v1", "Living hourly by FONO Studio") : noDataMetric("MET-FONO-NIA-FILL@v1", "No vacant Nests at cycle start"),
  }) : null
  const spParks = Object.freeze(rows.filter((row): row is SpCapacityRow => row.supplyModel === "SP").map((row): SpParkDetail => Object.freeze({
    studioId: row.studioId,
    studioName: row.studioName,
    activationReadyNests: row.activationReadyNests,
    enterpriseDemandNests: row.enterpriseDemandNests,
    enterpriseContractCoveredNests: row.enterpriseContractCoveredNests,
    contractCoverage: row.activationReadyNests > 0 ? availableMetric(row.enterpriseContractCoveredNests / row.activationReadyNests, "MET-SP-CONTRACT-COVERAGE@v1", "Enterprise contracts + SP ready capacity") : noDataMetric("MET-SP-CONTRACT-COVERAGE@v1", "No activation-ready SP Nests"),
    capexExposureInr: row.capexExposureInr,
    blockingMilestone: row.blockingMilestone,
    readiness: row.readiness,
    lineage: row.lineage,
  })))
  return Object.freeze({
    mode: "Shadow mode",
    refreshedAt,
    channelOrder: Object.freeze(["FONO", "SP"] as const),
    channels,
    combined: fono && sp ? combineChannels(fono, sp) : null,
    combinedState: fono && sp ? "Visible after FONO and SP" : "Blocked until FONO and SP are both visible",
    fono: fonoDetail,
    spParks,
  })
}

export type LivingSupplyPolicies = Readonly<{
  asOf: string
  operatingCycleDefinition: string
  breakevenOccupancy: number
  amberOccupancyFloor: number
  fonoEscalationCycles: number
  spEscalationCycles: number
  policyVersions: readonly string[]
  provisional: true
  calibrationNote: "Calibrate after the first real SP"
}>

function requiredPolicy(policyId: string, at: string, registry: readonly PolicyDefinition[]) {
  const policy = policyAt(policyId, at, registry)
  if (!policy) throw new Error(`Active policy ${policyId} is required at ${at}.`)
  return policy
}

export function livingSupplyPoliciesAt(at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY): LivingSupplyPolicies {
  const cycle = requiredPolicy("POL-LIVING-OPERATING-CYCLE", at, registry)
  const breakeven = requiredPolicy("POL-BREAKEVEN-OCCUPANCY", at, registry)
  const amberOccupancy = requiredPolicy("POL-STUDIO-OCCUPANCY-AMBER", at, registry)
  const fono = requiredPolicy("POL-FONO-ESCALATION-CYCLES", at, registry)
  const sp = requiredPolicy("POL-SP-ESCALATION-CYCLES", at, registry)
  if (typeof cycle.value !== "string" || typeof breakeven.value !== "number" || typeof amberOccupancy.value !== "number" || typeof fono.value !== "number" || typeof sp.value !== "number") throw new Error("Living supply policies have invalid value types.")
  if (amberOccupancy.value >= breakeven.value) throw new Error("The Amber occupancy floor must remain below breakeven occupancy.")
  if (sp.value >= fono.value) throw new Error("SP escalation must remain faster than FONO escalation because Nia capital is exposed.")
  return Object.freeze({
    asOf: at,
    operatingCycleDefinition: cycle.value,
    breakevenOccupancy: breakeven.value,
    amberOccupancyFloor: amberOccupancy.value,
    fonoEscalationCycles: fono.value,
    spEscalationCycles: sp.value,
    policyVersions: Object.freeze([`${cycle.policyId}@v${cycle.version}`, `${breakeven.policyId}@v${breakeven.version}`, `${amberOccupancy.policyId}@v${amberOccupancy.version}`, `${fono.policyId}@v${fono.version}`, `${sp.policyId}@v${sp.version}`]),
    provisional: true,
    calibrationNote: "Calibrate after the first real SP",
  })
}

export type LivingOccupancyBand = "healthy" | "watch" | "low"

export function livingOccupancyBand(value: number, policies: Pick<LivingSupplyPolicies, "breakevenOccupancy" | "amberOccupancyFloor">): LivingOccupancyBand {
  if (value >= policies.breakevenOccupancy) return "healthy"
  if (value >= policies.amberOccupancyFloor) return "watch"
  return "low"
}

export type OperatingCycle = Readonly<{
  cycleId: string
  trigger: "Incident" | "Hourly heartbeat"
  triggerId: string
  occurredAt: string
}>

export type FonoGapContext = Readonly<{
  supplyModel: "FONO"
  studioId: string
  franchiseePipelineHealthy: boolean
  baseCommitmentMet: boolean
  niaDemandSupportActive: boolean
  occupancyRatio: number
  consecutiveBelowBreakevenCycles: number
  cycle: OperatingCycle
  lineage: LivingCapacityLineage
}>

export type SpGapContext = Readonly<{
  supplyModel: "SP"
  studioId: string
  enterpriseDemandNests: number
  enterpriseContractCoveredNests: number
  activationReadyNests: number
  blockingMilestone: string
  unresolvedCycles: number
  cycle: OperatingCycle
  lineage: LivingCapacityLineage
}>

export type LivingGapContext = FonoGapContext | SpGapContext

export type LivingGapRoute = Readonly<{
  supplyModel: SupplyModel
  playbook: LivingPlaybook
  primaryRoute: "Franchisee pipeline / base commitment" | "Nia demand channels" | "Franchise review" | "Enterprise contract coverage" | "SP readiness / capacity"
  gapKind: "Franchisee commitment" | "Vacant FONO Nests" | "Below breakeven despite Nia support" | "Uncontracted enterprise demand" | "Unactivated readiness / capacity"
  blockingMilestone: string
  escalationRequired: boolean
  escalationAfterCycles: number
  escalationOwner: "Theatre operations" | "Franchise review" | "Executive SP review"
  policyVersions: readonly string[]
}>

export function routeLivingGap(context: LivingGapContext, policies: LivingSupplyPolicies): LivingGapRoute {
  if (context.supplyModel === "FONO") {
    if (!context.franchiseePipelineHealthy || !context.baseCommitmentMet) return Object.freeze({ supplyModel: "FONO", playbook: "FONO gap", primaryRoute: "Franchisee pipeline / base commitment", gapKind: "Franchisee commitment", blockingMilestone: !context.franchiseePipelineHealthy ? "Franchisee Member pipeline" : "Franchisee base commitment", escalationRequired: false, escalationAfterCycles: policies.fonoEscalationCycles, escalationOwner: "Theatre operations", policyVersions: policies.policyVersions })
    const belowBreakevenAfterSupport = context.niaDemandSupportActive && context.occupancyRatio < policies.breakevenOccupancy && context.consecutiveBelowBreakevenCycles >= policies.fonoEscalationCycles
    if (belowBreakevenAfterSupport) return Object.freeze({ supplyModel: "FONO", playbook: "FONO gap", primaryRoute: "Franchise review", gapKind: "Below breakeven despite Nia support", blockingMilestone: "Two consecutive governed below-breakeven cycles", escalationRequired: true, escalationAfterCycles: policies.fonoEscalationCycles, escalationOwner: "Franchise review", policyVersions: policies.policyVersions })
    return Object.freeze({ supplyModel: "FONO", playbook: "FONO gap", primaryRoute: "Nia demand channels", gapKind: "Vacant FONO Nests", blockingMilestone: "Nia demand-channel fill", escalationRequired: false, escalationAfterCycles: policies.fonoEscalationCycles, escalationOwner: "Theatre operations", policyVersions: policies.policyVersions })
  }
  const uncontractedDemand = Math.max(0, context.enterpriseDemandNests - context.enterpriseContractCoveredNests)
  const escalationRequired = context.unresolvedCycles >= policies.spEscalationCycles
  return Object.freeze({
    supplyModel: "SP",
    playbook: "SP gap",
    primaryRoute: uncontractedDemand > 0 ? "Enterprise contract coverage" : "SP readiness / capacity",
    gapKind: uncontractedDemand > 0 ? "Uncontracted enterprise demand" : "Unactivated readiness / capacity",
    blockingMilestone: context.blockingMilestone,
    escalationRequired,
    escalationAfterCycles: policies.spEscalationCycles,
    escalationOwner: "Executive SP review",
    policyVersions: policies.policyVersions,
  })
}

export type LivingGapEvent = Readonly<{
  eventId: string
  type: "living.occupancy-activation-gap.detected"
  studioId: string
  supplyModel: SupplyModel
  playbook: LivingPlaybook
  cycle: OperatingCycle
  route: LivingGapRoute
  lineage: LivingCapacityLineage
  occurredAt: string
}>

export function createLivingGapEvent(context: LivingGapContext, policies: LivingSupplyPolicies): LivingGapEvent {
  const route = routeLivingGap(context, policies)
  return Object.freeze({ eventId: `GAP-${context.supplyModel}-${context.studioId}-${context.cycle.cycleId}`, type: "living.occupancy-activation-gap.detected", studioId: context.studioId, supplyModel: context.supplyModel, playbook: route.playbook, cycle: context.cycle, route, lineage: context.lineage, occurredAt: context.cycle.occurredAt })
}

export function createLivingSupplyAction(event: LivingGapEvent, input: { actionId: string; demandId: string; title: string; ownerActorId: string; verifierActorId: string; dueAt: string; expectedImpact: string; confidence: number }) {
  return createOperatingAction({ ...input, studioId: event.studioId, supplyModel: event.supplyModel, playbook: event.playbook, governedChanges: ["operational"], metricId: "MET-LIVING-OCCUPANCY", at: event.occurredAt, actorId: "ACT-LIVING-ORCHESTRATOR" })
}

export type LivingSupplyVerification = Readonly<{
  verificationId: string
  eventId: string
  actionId: string
  studioId: string
  supplyModel: SupplyModel
  playbook: LivingPlaybook
  verifierActorId: string
  verifiedAt: string
  result: "Verified"
  lineage: LivingCapacityLineage
}>

export function verifyLivingSupplyClosure(input: { event: LivingGapEvent; action: OperatingAction; supplyModel: SupplyModel | null | undefined; playbook: LivingPlaybook | null | undefined; verifierActorId: string; verifiedAt: string }): LivingSupplyVerification {
  const { event, action, supplyModel, playbook, verifierActorId, verifiedAt } = input
  if (action.state !== "Verified" && action.state !== "Closed") throw new Error("Living supply closure requires a verified or closed action.")
  if (!supplyModel) throw new Error("Verification requires the governed supply_model.")
  if (supplyModel !== event.supplyModel || supplyModel !== action.supplyModel || playbook !== event.playbook || playbook !== action.playbook) throw new Error("Verification supply_model and playbook must match the gap event and action.")
  if (verifierActorId === action.ownerActorId || verifierActorId !== action.verifierActorId) throw new Error("Living supply verification must be independent and use the assigned verifier.")
  if (action.evidence.length === 0) throw new Error("Living supply verification requires protected evidence.")
  return Object.freeze({ verificationId: `VERIFY-${event.eventId}`, eventId: event.eventId, actionId: action.actionId, studioId: event.studioId, supplyModel, playbook, verifierActorId, verifiedAt, result: "Verified", lineage: event.lineage })
}

const syntheticLineage = (studioId: string, row: number): LivingCapacityLineage => Object.freeze({ studioMasterRowIdentity: `SRC-SYNTHETIC-CLOSED-LOOP:Studio_Master:${row}:2026-07-17T02:08:00.000Z`, livingRowIdentity: `SRC-SYNTHETIC-LIVING:Living_Hourly:${studioId}:2026-07-17T08:00:00.000Z`, sourceName: "Synthetic Living supply fixture", asOf: "2026-07-17T08:00:00+05:30", synthetic: true })

export const LIVING_SUPPLY_FIXTURE: readonly LivingCapacityRow[] = Object.freeze([
  Object.freeze({ studioId: "ST-ORA-01", studioName: "Oragadam 01", theatreId: "TH-TONDAI", supplyModel: "FONO", contractedNests: 640, activationReadyNests: 610, occupiedNests: 530, payingNests: 512, billedLivingRevenueInr: 2_704_000, verifiedCollectionsInr: 2_584_000, cm1Inr: null, cm1DefinitionRef: null, cm2Inr: null, cm2DefinitionRef: null, franchiseeSourcedMembers: 322, niaFilledMembers: 208, vacantNestsAtCycleStart: 286, lineage: syntheticLineage("ST-ORA-01", 3) }),
  Object.freeze({ studioId: "ST-CHK-04", studioName: "Chakan 04", theatreId: "TH-DECCAN", supplyModel: "FONO", contractedNests: 480, activationReadyNests: 440, occupiedNests: 344, payingNests: 330, billedLivingRevenueInr: 1_720_000, verifiedCollectionsInr: 1_600_000, cm1Inr: null, cm1DefinitionRef: null, cm2Inr: null, cm2DefinitionRef: null, franchiseeSourcedMembers: 205, niaFilledMembers: 139, vacantNestsAtCycleStart: 234, lineage: syntheticLineage("ST-CHK-04", 5) }),
  Object.freeze({ studioId: "ST-SIP-02", studioName: "Sriperumbudur 02", theatreId: "TH-TONDAI", supplyModel: "SP", contractedNests: 780, activationReadyNests: 640, occupiedNests: 510, payingNests: 500, billedLivingRevenueInr: 2_550_000, verifiedCollectionsInr: 2_370_000, cm1Inr: null, cm1DefinitionRef: null, cm2Inr: null, cm2DefinitionRef: null, enterpriseDemandNests: 720, enterpriseContractCoveredNests: 580, capexExposureInr: 4_800_000, blockingMilestone: "Hardware and amenity readiness", readiness: Object.freeze({ buildOut: "Ready", hardwareAmenities: "Blocked", sukh: "In progress", ufd: "Ready" }), lineage: syntheticLineage("ST-SIP-02", 2) }),
  Object.freeze({ studioId: "ST-MAM-01", studioName: "Mambakkam 01", theatreId: "TH-TONDAI", supplyModel: "SP", contractedNests: 420, activationReadyNests: 360, occupiedNests: 280, payingNests: 265, billedLivingRevenueInr: 1_428_000, verifiedCollectionsInr: 1_328_000, cm1Inr: null, cm1DefinitionRef: null, cm2Inr: null, cm2DefinitionRef: null, enterpriseDemandNests: 340, enterpriseContractCoveredNests: 330, capexExposureInr: 3_100_000, blockingMilestone: "Sukh activation", readiness: Object.freeze({ buildOut: "Ready", hardwareAmenities: "Ready", sukh: "In progress", ufd: "Ready" }), lineage: syntheticLineage("ST-MAM-01", 4) }),
])

export function buildLivingSupplyPreview() {
  const refreshedAt = "2026-07-17T08:00:00+05:30"
  const policies = livingSupplyPoliciesAt(refreshedAt)
  const fonoContext: FonoGapContext = Object.freeze({ supplyModel: "FONO", studioId: "ST-CHK-04", franchiseePipelineHealthy: true, baseCommitmentMet: true, niaDemandSupportActive: true, occupancyRatio: 344 / 480, consecutiveBelowBreakevenCycles: 2, cycle: Object.freeze({ cycleId: "HB-20260717-0800-FONO", trigger: "Hourly heartbeat", triggerId: "HB-FONO-0800", occurredAt: refreshedAt }), lineage: syntheticLineage("ST-CHK-04", 5) })
  const spContext: SpGapContext = Object.freeze({ supplyModel: "SP", studioId: "ST-SIP-02", enterpriseDemandNests: 720, enterpriseContractCoveredNests: 580, activationReadyNests: 640, blockingMilestone: "Hardware and amenity readiness", unresolvedCycles: 1, cycle: Object.freeze({ cycleId: "INC-SP-001", trigger: "Incident", triggerId: "INC-SP-001", occurredAt: refreshedAt }), lineage: syntheticLineage("ST-SIP-02", 2) })
  return Object.freeze({ report: buildLivingSupplyReport(LIVING_SUPPLY_FIXTURE, refreshedAt), policies, routes: Object.freeze([createLivingGapEvent(fonoContext, policies), createLivingGapEvent(spContext, policies)]), writesEnabled: false, liveIntegrationsEnabled: false })
}
