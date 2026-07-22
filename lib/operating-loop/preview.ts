import { appendApproval, appendEvidence, createOperatingAction, transitionAction, type OperatingAction } from "@/lib/operating-loop/action-engine"
import { SYNTHETIC_AS_OF, syntheticImportInput } from "@/lib/operating-loop/fixtures"
import { importOperatingRows } from "@/lib/operating-loop/ingestion"
import { rankStudiosForDemand, type CapacityContext, type StudioMatch } from "@/lib/operating-loop/matching"
import { projectVerifiedActivationForInsights, verifyActivationBatch, type ActivationBatch, type InsightsActivationProjection } from "@/lib/operating-loop/reporting"
import type { SupplyModel } from "@/lib/operating-loop/contracts"

export type ClosedLoopPreview = {
  mode: "Shadow mode"
  source: { name: string; asOf: string; freshness: "Current"; synthetic: true; rowIdentity: string }
  dataQuality: { submitted: number; imported: number; quarantined: number; duplicatesIgnored: number }
  demand: {
    demandId: string
    enterpriseName: string
    plantName: string
    roleRequired: string
    remainingHeadcount: number
    activationRequiredAt: string
    certainty: string
  }
  ranking: readonly StudioMatch[]
  selectedStudioId: string
  action: OperatingAction
  activation: { batchId: string; verifiedCount: number; sampleMemberTokens: readonly string[]; sampleNestIds: readonly string[]; verifiedBy: string; evidenceRef: string }
  projection: InsightsActivationProjection
}

const capacityContext: Readonly<Record<string, CapacityContext>> = {
  "ST-SIP-02": { expectedOccupiedNests: 132, commercialAgreementDays: 0, complianceReadinessDays: 0, physicalReadinessDays: 1, unresolvedDependencyDays: 0 },
  "ST-ORA-01": { expectedOccupiedNests: 240, commercialAgreementDays: 1, complianceReadinessDays: 1, physicalReadinessDays: 1, unresolvedDependencyDays: 0 },
  "ST-MAM-01": { expectedOccupiedNests: 180, commercialAgreementDays: 2, complianceReadinessDays: 2, physicalReadinessDays: 1, unresolvedDependencyDays: 1 },
}

function move(action: OperatingAction, to: Parameters<typeof transitionAction>[1]["to"], actorId: string, occurredAt: string, note: string, verifierActorId?: string) {
  return transitionAction(action, { to, actorId, occurredAt, note, verifierActorId, expectedVersion: action.version })
}

function createActivationBatch(demandId: string, enterpriseId: string, theatreId: string, studioId: string, supplyModel: SupplyModel, sourceRowIdentity: string): ActivationBatch {
  const activations = Array.from({ length: 240 }, (_, index) => {
    const sequence = String(index + 1).padStart(3, "0")
    return Object.freeze({
      activationId: `ACTIVATION-SHADOW-${sequence}`,
      memberToken: `MEM-TOKEN-${sequence}`,
      nestId: `NEST-ORA-${sequence}`,
      demandId,
      enterpriseId,
      theatreId,
      studioId,
      supplyModel,
      activatedAt: "2026-07-22T15:30:00+05:30",
      evidenceRef: `protected://evidence/activation-shadow-${sequence}`,
    })
  })
  return Object.freeze({
    batchId: "BATCH-ACTIVATION-SHADOW-240",
    demandId,
    studioId,
    supplyModel,
    ownerActorId: "ACT-SUPPLY",
    evidenceRef: "protected://evidence/activation-batch-shadow-240",
    activations: Object.freeze(activations),
    sourceRowIdentity,
    submittedAt: "2026-07-22T15:35:00+05:30",
  })
}

export function buildClosedLoopPreview(): ClosedLoopPreview {
  const ingestion = importOperatingRows(syntheticImportInput())
  const demand = ingestion.canonical.demands[0]
  if (!demand) throw new Error("The synthetic Preview demand fixture is missing.")
  const ranking = rankStudiosForDemand(demand, ingestion.canonical.studios, capacityContext)
  const selected = ranking[0]
  const studio = ingestion.canonical.studios.find((candidate) => candidate.studioId === selected?.studioId)
  if (!selected || !studio) throw new Error("No eligible Studio was ranked for the Preview demand.")

  let action = createOperatingAction({
    actionId: "ACTION-DEM-SIP-240-ST-ORA-01",
    demandId: demand.demandId,
    studioId: studio.studioId,
    supplyModel: studio.supplyModel,
    playbook: studio.supplyModel === "FONO" ? "FONO gap" : "SP gap",
    title: "Activate Oragadam 01 for SIP Industrial demand",
    ownerActorId: "ACT-SUPPLY",
    verifierActorId: "ACT-VERIFY",
    dueAt: demand.activationRequiredAt,
    governedChanges: ["deposit", "capex", "commercial"],
    metricId: "MET-ACTIVATIONS-VERIFIED",
    expectedImpact: "240 independently verified Member activations",
    confidence: 0.86,
    at: SYNTHETIC_AS_OF,
    actorId: "ACT-DEMAND",
  })
  action = move(action, "Proposed", "ACT-DEMAND", "2026-07-17T08:05:00+05:30", "Ranked Studio option proposed with visible commercial and readiness factors.")
  action = appendApproval(action, { approvalId: "APPROVAL-PUSHKAR-001", tier: "Pushkar", approvedBy: "Pushkar", approvedAt: "2026-07-17T08:10:00+05:30", decision: "Approved", note: "Shadow-mode approval of deposit, capex, and commercial assumptions only." }, action.version)
  action = move(action, "Approved", "Pushkar", "2026-07-17T08:12:00+05:30", "Pushkar approval recorded before any governed change.")
  action = move(action, "Assigned", "ACT-THEATRE", "2026-07-17T08:15:00+05:30", "One owner and due date assigned.")
  action = move(action, "In progress", "ACT-SUPPLY", "2026-07-17T08:25:00+05:30", "Readiness work started in shadow mode.")
  action = appendEvidence(action, { evidenceId: "EVIDENCE-READINESS-001", protectedRef: "protected://evidence/oragadam-readiness", submittedBy: "ACT-SUPPLY", submittedAt: "2026-07-22T14:45:00+05:30", description: "Studio readiness and Nest count proof." }, action.version)
  action = appendEvidence(action, { evidenceId: "EVIDENCE-DEMAND-001", protectedRef: "protected://evidence/sip-demand-confirmation", submittedBy: "ACT-DEMAND", submittedAt: "2026-07-22T14:50:00+05:30", description: "Enterprise demand confirmation and activation roster count." }, action.version)
  action = move(action, "Proof submitted", "ACT-SUPPLY", "2026-07-22T15:00:00+05:30", "Protected readiness and demand evidence submitted.")
  action = move(action, "Verified", "ACT-VERIFY", "2026-07-22T16:00:00+05:30", "Independent verifier confirmed proof and capacity.", "ACT-VERIFY")
  action = move(action, "Closed", "ACT-VERIFY", "2026-07-22T16:05:00+05:30", "Action closed only after independent verification.")

  const batch = createActivationBatch(demand.demandId, demand.enterpriseId, studio.theatreId, studio.studioId, studio.supplyModel, demand.lineage.rowIdentity)
  const verifiedEvent = verifyActivationBatch({ batch, demand, studio, action, verifierActorId: "ACT-VERIFY", verifiedAt: "2026-07-22T16:10:00+05:30" })
  const projection = projectVerifiedActivationForInsights(verifiedEvent)

  return Object.freeze({
    mode: "Shadow mode",
    source: Object.freeze({ name: "Closed-loop branch Preview fixture", asOf: SYNTHETIC_AS_OF, freshness: "Current", synthetic: true, rowIdentity: demand.lineage.rowIdentity }),
    dataQuality: Object.freeze({ submitted: ingestion.stats.submitted, imported: ingestion.stats.imported, quarantined: ingestion.stats.quarantined, duplicatesIgnored: ingestion.stats.duplicatesIgnored }),
    demand: Object.freeze({ demandId: demand.demandId, enterpriseName: demand.enterpriseName, plantName: demand.plantName, roleRequired: demand.roleRequired, remainingHeadcount: demand.headcountRequired - demand.headcountMatched, activationRequiredAt: demand.activationRequiredAt, certainty: demand.certainty }),
    ranking,
    selectedStudioId: selected.studioId,
    action,
    activation: Object.freeze({ batchId: batch.batchId, verifiedCount: batch.activations.length, sampleMemberTokens: Object.freeze(batch.activations.slice(0, 3).map((item) => item.memberToken)), sampleNestIds: Object.freeze(batch.activations.slice(0, 3).map((item) => item.nestId)), verifiedBy: verifiedEvent.verifiedBy, evidenceRef: verifiedEvent.evidenceRef }),
    projection,
  })
}
