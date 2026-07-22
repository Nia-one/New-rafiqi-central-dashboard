import {
  SCOUT_BLOCKED_CAPABILITIES,
  SCOUT_WEDGES,
  buildScoutQueue,
  evaluateCandidate,
  ringCoverage,
  scoutRegistryAt,
  type CandidateInput,
  type DemandGateInput,
  type FieldSafetyInput,
  type WedgeVerification,
} from "@/lib/sram-park-scout-route"

export const SCOUT_PREVIEW_AT = "2026-07-17T09:15:00+05:30"

const safeFieldSession: FieldSafetyInput = Object.freeze({
  localHour: 9,
  plannedCheckIns: 3,
  publicAccess: true,
  ownerConsentRef: null,
  noTrespass: true,
  hazardStatus: "Cleared",
  ppeControlsRef: null,
  unsafeSolo: false,
  buddyRef: null,
  emergencyRef: "protected://safety/emergency-fixture-v1",
  stopWorkInstructionVisible: true,
})

export const SCOUT_DEMAND_FIXTURES: readonly DemandGateInput[] = Object.freeze([
  {
    gateId: "GATE-SP-A",
    supplyModel: "SP",
    funnelStage: "Negotiation",
    stageEnteredAt: "2026-07-17T08:40:00+05:30",
    expectedCloseDate: "2026-07-18",
    headcount: 1800,
    migrantShare: 0.7,
    shiftPattern: "Single",
    contractability: 0.8,
    enterpriseRef: "protected://enterprise/synthetic-a",
    gateCoordinateRef: "protected://coordinates/synthetic-gate-a",
    workforceEvidenceRef: "protected://workforce/synthetic-gate-a",
    triggerEvidenceRef: "protected://funnel/synthetic-negotiation-a",
    sourceRowIdentity: "synthetic-demand-row-a",
    synthetic: true,
    verificationState: "Verified",
  },
  {
    gateId: "GATE-SP-B",
    supplyModel: "SP",
    funnelStage: "Negotiation",
    stageEnteredAt: "2026-07-17T08:10:00+05:30",
    expectedCloseDate: "2026-07-19",
    headcount: 1200,
    migrantShare: 0.85,
    shiftPattern: "Two shift",
    contractability: 0.75,
    enterpriseRef: "protected://enterprise/synthetic-b",
    gateCoordinateRef: "protected://coordinates/synthetic-gate-b",
    workforceEvidenceRef: "protected://workforce/synthetic-gate-b",
    triggerEvidenceRef: "protected://funnel/synthetic-negotiation-b",
    sourceRowIdentity: "synthetic-demand-row-b",
    synthetic: true,
    verificationState: "Verified",
  },
  {
    gateId: "GATE-SP-C",
    supplyModel: "SP",
    funnelStage: "Negotiation",
    stageEnteredAt: "2026-07-16T16:05:00+05:30",
    expectedCloseDate: "2026-07-22",
    headcount: 2400,
    migrantShare: 0.55,
    shiftPattern: "Three shift",
    contractability: 0.65,
    enterpriseRef: "protected://enterprise/synthetic-c",
    gateCoordinateRef: "protected://coordinates/synthetic-gate-c",
    workforceEvidenceRef: "protected://workforce/synthetic-gate-c",
    triggerEvidenceRef: "protected://funnel/synthetic-negotiation-c",
    sourceRowIdentity: "synthetic-demand-row-c",
    synthetic: true,
    verificationState: "Verified",
  },
  {
    gateId: "GATE-SP-D",
    supplyModel: "SP",
    funnelStage: "Qualified",
    stageEnteredAt: "2026-07-17T07:45:00+05:30",
    expectedCloseDate: "2026-07-20",
    headcount: 2200,
    migrantShare: 0.75,
    shiftPattern: "Single",
    contractability: 0.8,
    enterpriseRef: "protected://enterprise/synthetic-d",
    gateCoordinateRef: "protected://coordinates/synthetic-gate-d",
    workforceEvidenceRef: "protected://workforce/synthetic-gate-d",
    triggerEvidenceRef: null,
    sourceRowIdentity: "synthetic-demand-row-d",
    synthetic: true,
    verificationState: "Verified",
  },
  {
    gateId: "GATE-FONO-Q",
    supplyModel: "FONO",
    funnelStage: "Negotiation",
    stageEnteredAt: "2026-07-17T08:00:00+05:30",
    expectedCloseDate: "2026-07-18",
    headcount: 3000,
    migrantShare: 0.9,
    shiftPattern: "Single",
    contractability: 0.9,
    enterpriseRef: "protected://enterprise/synthetic-fono",
    gateCoordinateRef: "protected://coordinates/synthetic-fono",
    workforceEvidenceRef: "protected://workforce/synthetic-fono",
    triggerEvidenceRef: "protected://funnel/synthetic-fono",
    sourceRowIdentity: "synthetic-demand-row-fono",
    synthetic: true,
    verificationState: "Verified",
  },
  {
    gateId: "GATE-MISSING-Q",
    supplyModel: null,
    funnelStage: "Negotiation",
    stageEnteredAt: "2026-07-17T08:05:00+05:30",
    expectedCloseDate: "2026-07-18",
    headcount: 1600,
    migrantShare: 0.8,
    shiftPattern: "Single",
    contractability: 0.8,
    enterpriseRef: "protected://enterprise/synthetic-missing",
    gateCoordinateRef: "protected://coordinates/synthetic-missing",
    workforceEvidenceRef: "protected://workforce/synthetic-missing",
    triggerEvidenceRef: "protected://funnel/synthetic-missing",
    sourceRowIdentity: "synthetic-demand-row-missing",
    synthetic: true,
    verificationState: "Verified",
  },
])

function verifiedWedge(gateId: string, wedge: (typeof SCOUT_WEDGES)[number], index: number): WedgeVerification {
  return Object.freeze({
    eventId: `${gateId}-ring-1-${wedge}`,
    gateId,
    supplyModel: "SP",
    ring: "Ring 1",
    wedge,
    result: "No candidate at target-rent policy",
    evidenceRef: `protected://scout-evidence/${gateId.toLowerCase()}-${wedge.toLowerCase()}`,
    scoutActorId: "synthetic-scout-01",
    verifierActorId: "synthetic-verifier-01",
    verifiedAt: `2026-07-17T08:${47 + index * 5}:00+05:30`,
    targetRentPolicyRef: "POL-SP-SCOUT-TARGET-RENT@v1",
  })
}

export const SCOUT_WEDGE_FIXTURES: readonly WedgeVerification[] = Object.freeze([
  ...SCOUT_WEDGES.slice(0, 3).map((wedge, index) => verifiedWedge("GATE-SP-A", wedge, index)),
  ...SCOUT_WEDGES.map((wedge, index) => verifiedWedge("GATE-SP-B", wedge, index)),
])

const candidateBase: Omit<CandidateInput, "candidateId" | "gateId" | "distanceKm" | "bearing" | "buildingType" | "estimatedNestCapacity" | "askingRentInrMonth" | "shuttleCostPerNestInr"> = {
  supplyModel: "SP",
  sourceRowIdentity: "synthetic-candidate-row",
  synthetic: true,
  coordinateRef: "protected://coordinates/synthetic-candidate",
  photoRef: "protected://photos/synthetic-candidate",
  ownerRef: "protected://commercial/synthetic-owner",
  utilityEvidenceRef: "protected://utilities/synthetic-candidate",
  scoutActorId: "synthetic-scout-01",
  verifierActorId: "synthetic-verifier-01",
  fieldSafety: safeFieldSession,
}

export const SCOUT_CANDIDATE_FIXTURES: readonly CandidateInput[] = Object.freeze([
  { ...candidateBase, candidateId: "CAND-SP-01", gateId: "GATE-SP-A", distanceKm: 1.2, bearing: 38, buildingType: "PG-convertible", estimatedNestCapacity: 220, askingRentInrMonth: 484000, shuttleCostPerNestInr: 0 },
  { ...candidateBase, candidateId: "CAND-SP-02", gateId: "GATE-SP-B", distanceKm: 3.4, bearing: 105, buildingType: "Standalone", estimatedNestCapacity: 300, askingRentInrMonth: 630000, shuttleCostPerNestInr: 350 },
  { ...candidateBase, candidateId: "CAND-SP-03", gateId: "GATE-SP-A", distanceKm: 5.6, bearing: 220, buildingType: "Bare land", estimatedNestCapacity: 350, askingRentInrMonth: 700000, shuttleCostPerNestInr: 500 },
  { ...candidateBase, candidateId: "CAND-SP-04", gateId: "GATE-SP-A", distanceKm: 5.4, bearing: 315, buildingType: "Standalone", estimatedNestCapacity: 280, askingRentInrMonth: 616000, shuttleCostPerNestInr: 400, sharedCatchmentGateIds: ["GATE-SP-A", "GATE-SP-B"], sharedCatchmentEvidenceRef: "protected://catchment/synthetic-a-b", sharedCatchmentApprovalRef: "protected://approval/synthetic-human-review" },
  { ...candidateBase, candidateId: "CAND-SP-PRIVACY-Q", gateId: "GATE-SP-A", distanceKm: 1.5, bearing: 170, buildingType: "Standalone", estimatedNestCapacity: 180, askingRentInrMonth: 450000, shuttleCostPerNestInr: 0, rawOwnerContact: "synthetic raw owner value must quarantine" },
  { ...candidateBase, candidateId: "CAND-FONO-Q", gateId: "GATE-SP-A", supplyModel: "FONO", distanceKm: 1.8, bearing: 270, buildingType: "PG-convertible", estimatedNestCapacity: 160, askingRentInrMonth: 352000, shuttleCostPerNestInr: 0 },
  { ...candidateBase, candidateId: "CAND-SP-SAFETY-B", gateId: "GATE-SP-A", distanceKm: 1.7, bearing: 90, buildingType: "Standalone", estimatedNestCapacity: 200, askingRentInrMonth: 480000, shuttleCostPerNestInr: 0, fieldSafety: { ...safeFieldSession, unsafeSolo: true, buddyRef: null } },
])

const queue = buildScoutQueue(SCOUT_DEMAND_FIXTURES, [], SCOUT_PREVIEW_AT)
const candidates = SCOUT_CANDIDATE_FIXTURES.map((candidate) => evaluateCandidate(candidate, SCOUT_WEDGE_FIXTURES, SCOUT_PREVIEW_AT))
const coverage = ringCoverage(SCOUT_WEDGE_FIXTURES, "GATE-SP-A", "Ring 1", SCOUT_PREVIEW_AT)
const registry = scoutRegistryAt(SCOUT_PREVIEW_AT)

export const SRAM_PARK_SCOUT_PREVIEW = Object.freeze({
  mode: "Shadow only" as const,
  fixtureLabel: "Synthetic fixtures" as const,
  supplyModel: "SP" as const,
  trigger: Object.freeze({
    gateId: "GATE-SP-A",
    stage: "Negotiation" as const,
    triggeredAt: "2026-07-17T08:40:00+05:30",
    verificationState: "Verified" as const,
    sourceRef: "protected://funnel/synthetic-negotiation-a",
  }),
  registry,
  queue: queue.gateQueue,
  coverage,
  candidates: Object.freeze(candidates),
  quarantinedGateCount: queue.gateQueue.filter((item) => item.disposition === "Quarantined").length,
  blockedCapabilities: SCOUT_BLOCKED_CAPABILITIES,
  protectedPriority: Object.freeze([
    Object.freeze({ rank: 1, label: "Safety / emergency", note: "Always highest" }),
    Object.freeze({ rank: 2, label: "Studio War Room", note: "Active overrides scout sweep" }),
    Object.freeze({ rank: 3, label: "Cash / financial guardrail", note: "Budget and liquidity" }),
    Object.freeze({ rank: 4, label: "Legal / compliance", note: "Policy and regulatory" }),
    Object.freeze({ rank: 5, label: "SP scout sweep", note: "Shadow recommendation" }),
  ]),
  returnPackage: Object.freeze([
    "Candidate facts",
    "Protected coordinate and photo references",
    "Rent, utilities and access evidence",
    "Policy versions and fit-score basis",
    "Field-person safety result",
    "Independent verifier",
  ]),
  evidenceBlocks: Object.freeze([
    `Ring 2 blocked · ${coverage.verifiedWedges.length}/${SCOUT_WEDGES.length} verified`,
    "Owner consent missing",
    "Shared-catchment exception needs human review",
    "Unsafe solo visit blocked",
  ]),
  mapPlot: Object.freeze([
    Object.freeze({ id: "CAND-SP-01", label: "Candidate 01", x: 58, y: 35, ring: "Ring 1", state: "Recommended" }),
    Object.freeze({ id: "CAND-SP-02", label: "Candidate 02", x: 74, y: 62, ring: "Ring 2", state: "Recommended" }),
    Object.freeze({ id: "CAND-SP-03", label: "Candidate 03", x: 14, y: 70, ring: "Beyond 5 km", state: "Rejected" }),
    Object.freeze({ id: "CAND-SP-04", label: "Candidate 04", x: 20, y: 18, ring: "Beyond 5 km", state: "Human review" }),
  ]),
})

export function scoutFixtureCsv() {
  const headers = ["candidate_id", "gate_id", "supply_model", "ring", "wedge", "disposition", "fit_score", "policy_version", "fixture_only"]
  const rows = candidates.map((candidate, index) => [
    SCOUT_CANDIDATE_FIXTURES[index].candidateId,
    SCOUT_CANDIDATE_FIXTURES[index].gateId,
    candidate.supplyModel ?? "QUARANTINED",
    candidate.ring ?? "QUARANTINED",
    candidate.wedge ?? "QUARANTINED",
    candidate.disposition,
    candidate.fitScore?.score ?? "No data",
    registry.version,
    "true",
  ])
  return [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")
}
