import type { CanonicalDemand, CanonicalStudio, SupplyModel } from "@/lib/operating-loop/contracts"
import { assertChannelCorrectPlaybook, type OperatingAction } from "@/lib/operating-loop/action-engine"

export type ActivationRecord = {
  activationId: string
  memberToken: string
  nestId: string
  demandId: string
  enterpriseId: string
  theatreId: string
  studioId: string
  supplyModel: SupplyModel
  activatedAt: string
  evidenceRef: string
}

export type ActivationBatch = {
  batchId: string
  demandId: string
  studioId: string
  supplyModel: SupplyModel
  ownerActorId: string
  evidenceRef: string
  activations: readonly ActivationRecord[]
  sourceRowIdentity: string
  submittedAt: string
}

export type VerifiedActivationEvent = {
  eventId: string
  type: "member.activation.verified"
  occurredAt: string
  demandId: string
  enterpriseId: string
  theatreId: string
  studioId: string
  supplyModel: SupplyModel
  actionId: string
  activationBatchId: string
  verifiedActivationCount: number
  verifiedBy: string
  actionOwnerActorId: string
  evidenceRef: string
  sourceRowIdentity: string
  studioSourceRowIdentity: string
  synthetic: boolean
  verificationStatus: "Verified"
  analyticsAllowed: true
  dataClassification: "Internal" | "Restricted payroll"
}

function assertProtected(reference: string) {
  if (!reference.startsWith("protected://")) throw new Error("Activation evidence must use a protected reference.")
}

export function verifyActivationBatch(input: {
  batch: ActivationBatch
  demand: CanonicalDemand
  studio: CanonicalStudio
  action: OperatingAction
  verifierActorId: string
  verifiedAt: string
}): VerifiedActivationEvent {
  const { batch, demand, studio, action, verifierActorId, verifiedAt } = input
  const remaining = demand.headcountRequired - demand.headcountMatched
  assertProtected(batch.evidenceRef)
  if (action.state !== "Closed" && action.state !== "Verified") throw new Error("The activation batch requires a verified or closed action.")
  assertChannelCorrectPlaybook(action.supplyModel, action.playbook)
  if (verifierActorId === batch.ownerActorId || verifierActorId === action.ownerActorId) throw new Error("The activation verifier must be independent of the action owner.")
  if (batch.demandId !== demand.demandId || batch.studioId !== studio.studioId) throw new Error("The activation batch does not match the selected demand and Studio.")
  if (batch.supplyModel !== studio.supplyModel || action.supplyModel !== studio.supplyModel) throw new Error("The activation batch and action must carry the Studio Master supply_model.")
  if (batch.activations.length < remaining) throw new Error(`The activation batch has ${batch.activations.length} records for ${remaining} remaining Members.`)
  if (batch.activations.length > studio.activationReadyNests) throw new Error("The activation batch exceeds activation-ready Nest capacity.")
  const memberTokens = new Set<string>()
  const nestIds = new Set<string>()
  for (const activation of batch.activations) {
    assertProtected(activation.evidenceRef)
    if (activation.demandId !== demand.demandId || activation.studioId !== studio.studioId || activation.enterpriseId !== demand.enterpriseId || activation.theatreId !== studio.theatreId || activation.supplyModel !== studio.supplyModel) throw new Error("Every activation must match the verified demand, Enterprise, Theatre, Studio, and governed supply_model.")
    if (memberTokens.has(activation.memberToken) || nestIds.has(activation.nestId)) throw new Error("Member tokens and Nest identifiers must be unique within a batch.")
    memberTokens.add(activation.memberToken)
    nestIds.add(activation.nestId)
  }

  return Object.freeze({
    eventId: `EVT-ACTIVATION-${batch.batchId}`,
    type: "member.activation.verified",
    occurredAt: verifiedAt,
    demandId: demand.demandId,
    enterpriseId: demand.enterpriseId,
    theatreId: studio.theatreId,
    studioId: studio.studioId,
    supplyModel: studio.supplyModel,
    actionId: action.actionId,
    activationBatchId: batch.batchId,
    verifiedActivationCount: batch.activations.length,
    verifiedBy: verifierActorId,
    actionOwnerActorId: action.ownerActorId!,
    evidenceRef: batch.evidenceRef,
    sourceRowIdentity: batch.sourceRowIdentity,
    studioSourceRowIdentity: studio.lineage.rowIdentity,
    synthetic: demand.lineage.synthetic || studio.lineage.synthetic,
    verificationStatus: "Verified",
    analyticsAllowed: true,
    dataClassification: "Internal",
  })
}

export type InsightsActivationProjection = Readonly<{
  eventType: "member.activation.verified"
  occurredAt: string
  demandId: string
  enterpriseId: string
  theatreId: string
  studioId: string
  supplyModel: SupplyModel
  verifiedActivationCount: number
  verificationStatus: "Verified"
  sourceRowIdentity: string
  studioSourceRowIdentity: string
  synthetic: boolean
}>

export function projectVerifiedActivationForInsights(event: VerifiedActivationEvent): InsightsActivationProjection {
  if (event.verificationStatus !== "Verified" || !event.analyticsAllowed || event.dataClassification === "Restricted payroll") throw new Error("Only verified, analytics-allowed, non-payroll events can enter Rafiqi Insights.")
  return Object.freeze({
    eventType: event.type,
    occurredAt: event.occurredAt,
    demandId: event.demandId,
    enterpriseId: event.enterpriseId,
    theatreId: event.theatreId,
    studioId: event.studioId,
    supplyModel: event.supplyModel,
    verifiedActivationCount: event.verifiedActivationCount,
    verificationStatus: event.verificationStatus,
    sourceRowIdentity: event.sourceRowIdentity,
    studioSourceRowIdentity: event.studioSourceRowIdentity,
    synthetic: event.synthetic,
  })
}
