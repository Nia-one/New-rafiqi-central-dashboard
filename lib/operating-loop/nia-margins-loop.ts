import { evaluateLearningRecommendation, type LearningPolicy, type LearningRecommendationEvaluation } from "@/lib/operating-loop/learning-control"
import { buildLoopHealth, type LoopHealth } from "@/lib/operating-loop/loop-health"
import type { SupplyModel } from "@/lib/operating-loop/contracts"
import { createDespatchEscalation, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"

export const NIA_MARGIN_TARGETS = Object.freeze({ living: 300, work: 1_000, essentials: 200, fullUse: 1_500, occupancyPct: 78 })

export type MarginStudioInput = Readonly<{
  studioId: string
  studioName: string
  theatreId: string
  supplyModel: SupplyModel
  contractedNests: number
  occupiedNests: number
  rampDay: number
  billedLivingArpuInr: number
  livingPartnerCostInr: number
  livingUtilitiesInr: number
  billedWorkArpuInr: number
  workDirectDeliveryCostInr: number
  billedEssentialsArpuInr: number
  essentialsDirectDeliveryCostInr: number
  studioGrossMarginPct: number
  previousVerifiedFullUseCm2Inr: number
  ownerActorId: string
  sourceUpdatedAt: string
  sourceRowIdentity: string
  synthetic: boolean
}>

export type MarginDiagnosis = Readonly<{
  studioId: string
  studioName: string
  theatreId: string
  supplyModel: SupplyModel
  ramp: boolean
  occupancyPct: number
  occupiedNests: number
  targetOccupiedNests: number
  livingUnitCm2Inr: number
  workUnitCm2Inr: number
  essentialsUnitCm2Inr: number
  fullUseUnitCm2Inr: number
  occupancyVolumeEffectInr: number
  livingUnitVarianceInr: number
  workUnitVarianceInr: number
  essentialsUnitVarianceInr: number
  studioTotalCm2GapInr: number
  primaryCause: "Occupancy" | "Living partner cost" | "Living utilities" | "Work delivery cost" | "Essentials delivery cost" | "On target"
  routeTo: "New Adds" | "Enterprise Demand" | "Living Operations" | "Member Savings" | "Pushkar" | "No action"
  ownerRole: string
  expectedRecovery: string
  actionId: string | null
  actionState: MarginActionState | "No action"
  independentlyVerified: boolean
  reopened: boolean
}>

export type MarginActionState = "Assigned" | "Proof submitted" | "Verified" | "Reopened" | "Escalated"

export type MarginAction = Readonly<{
  actionId: string
  studioId: string
  studioName: string
  supplyModel: SupplyModel
  routeTo: Exclude<MarginDiagnosis["routeTo"], "No action">
  ownerActorId: string
  ownerRole: string
  objective: string
  expectedMetric: string
  baselineValue: number
  targetValue: number
  unit: "pct" | "INR/occupied Nest/month"
  requiredEvidence: readonly string[]
  dueAt: string
  state: MarginActionState
  attempts: number
  evidenceRefs: readonly string[]
  verifierActorId: string | null
  verifiedAt: string | null
  actualValue: number | null
  closureRef: string | null
  reasons: readonly string[]
}>

export type MarginProofInput = Readonly<{
  actionId: string
  submittedBy: string
  submittedAt: string
  billedRevenueRef: string
  directCostRef: string
  sourceRowIdentity: string
  sourceFreshness: "Current" | "Stale"
  actualMetricValue: number
}>

export type MarginVerificationInput = Readonly<{
  actionId: string
  verifierActorId: string
  verifiedAt: string
  decision: "Verified" | "Reopen" | "Escalate"
  actualMetricValue: number
  closureRef: string
  reason: string
}>

export type MarginClosureInput = Readonly<{
  proof: MarginProofInput
  verification: MarginVerificationInput
}>

export type NiaMarginsPreview = Readonly<{
  mode: "Shadow only"
  question: "Which operating cause is moving contribution, who owns it, and did contribution recover?"
  answer: string
  measures: Readonly<{
    fullUseCm2Inr: number
    fullUseTargetInr: 1500
    pillarCm2Inr: Readonly<{ living: number; work: number; essentials: number }>
    occupancyPct: number
    occupancyTargetPct: 78
    negativeContributionStudios: number
    studioGrossMarginPct: number
  }>
  diagnoses: readonly MarginDiagnosis[]
  actions: readonly MarginAction[]
  despatchEscalations: readonly DespatchEscalationRecord[]
  loopHealth: LoopHealth
  learning: LearningRecommendationEvaluation
  writesEnabled: false
  collectionLeakageIncludedInCm2: false
}>

function nonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`)
}

function protectedReference(value: string) {
  return value.startsWith("protected://") && value.length > "protected://".length
}

function metricForDiagnosis(diagnosis: MarginDiagnosis) {
  if (diagnosis.primaryCause === "Occupancy") return { expectedMetric: "Occupied Nests as a share of contracted Nests", baselineValue: diagnosis.occupancyPct, targetValue: NIA_MARGIN_TARGETS.occupancyPct, unit: "pct" as const }
  if (diagnosis.primaryCause === "Living partner cost" || diagnosis.primaryCause === "Living utilities") return { expectedMetric: "Living CM2", baselineValue: diagnosis.livingUnitCm2Inr, targetValue: NIA_MARGIN_TARGETS.living, unit: "INR/occupied Nest/month" as const }
  if (diagnosis.primaryCause === "Work delivery cost") return { expectedMetric: "Work CM2", baselineValue: diagnosis.workUnitCm2Inr, targetValue: NIA_MARGIN_TARGETS.work, unit: "INR/occupied Nest/month" as const }
  return { expectedMetric: "Essentials CM2", baselineValue: diagnosis.essentialsUnitCm2Inr, targetValue: NIA_MARGIN_TARGETS.essentials, unit: "INR/occupied Nest/month" as const }
}

function actionIdFor(diagnosis: MarginDiagnosis) {
  return `MARGIN-${diagnosis.studioId}-${diagnosis.primaryCause.toUpperCase().replaceAll(" ", "-")}`
}

export function createMarginAction(diagnosis: MarginDiagnosis, input: MarginStudioInput, dueAt: string): MarginAction | null {
  if (diagnosis.primaryCause === "On target" || diagnosis.routeTo === "No action") return null
  if (!input.ownerActorId.trim()) throw new Error("A named action owner is required for every margin exception.")
  const metric = metricForDiagnosis(diagnosis)
  return Object.freeze({
    actionId: actionIdFor(diagnosis),
    studioId: diagnosis.studioId,
    studioName: diagnosis.studioName,
    supplyModel: diagnosis.supplyModel,
    routeTo: diagnosis.routeTo,
    ownerActorId: input.ownerActorId,
    ownerRole: diagnosis.ownerRole,
    objective: diagnosis.expectedRecovery,
    ...metric,
    requiredEvidence: Object.freeze(["Protected billed-revenue reference", "Protected direct-cost reference", `A later ${metric.expectedMetric} observation`]),
    dueAt,
    state: "Assigned",
    attempts: 0,
    evidenceRefs: Object.freeze([]),
    verifierActorId: null,
    verifiedAt: null,
    actualValue: null,
    closureRef: null,
    reasons: Object.freeze([]),
  })
}

export function submitMarginProof(action: MarginAction, proof: MarginProofInput): MarginAction {
  if (proof.actionId !== action.actionId) throw new Error("Margin proof must match its action.")
  nonNegative(proof.actualMetricValue, "Actual margin recovery metric")
  const evidenceRefs = [proof.billedRevenueRef, proof.directCostRef, proof.sourceRowIdentity]
  const reasons = [
    ...(!protectedReference(proof.billedRevenueRef) ? ["Billed-revenue evidence is not protected."] : []),
    ...(!protectedReference(proof.directCostRef) ? ["Direct-cost evidence is not protected."] : []),
    ...(!proof.sourceRowIdentity.trim() ? ["A stable source-row identity is required."] : []),
    ...(proof.sourceFreshness !== "Current" ? ["Margin evidence is stale."] : []),
  ]
  return Object.freeze({
    ...action,
    state: reasons.length === 0 ? "Proof submitted" : "Reopened",
    attempts: action.attempts + (reasons.length === 0 ? 0 : 1),
    evidenceRefs: Object.freeze(evidenceRefs.filter(protectedReference)),
    actualValue: proof.actualMetricValue,
    reasons: Object.freeze(reasons),
  })
}

export function verifyMarginAction(action: MarginAction, proof: MarginProofInput, verification: MarginVerificationInput): MarginAction {
  if (verification.actionId !== action.actionId || proof.actionId !== action.actionId) throw new Error("Margin verification must match its action and proof.")
  nonNegative(verification.actualMetricValue, "Verified margin recovery metric")
  const reasons = [
    ...action.reasons,
    ...(action.state !== "Proof submitted" ? ["Complete protected proof is required before verification."] : []),
    ...(verification.verifierActorId === action.ownerActorId || verification.verifierActorId === proof.submittedBy ? ["The verifier must be independent of the owner and proof submitter."] : []),
    ...(!protectedReference(verification.closureRef) ? ["A protected closure reference is required."] : []),
    ...(verification.actualMetricValue !== proof.actualMetricValue ? ["The verified result does not reconcile to the submitted proof."] : []),
    ...(verification.actualMetricValue < action.targetValue ? [`${action.expectedMetric} has not recovered to target.`] : []),
  ]
  const canVerify = verification.decision === "Verified" && reasons.length === 0
  const attempts = action.attempts + (canVerify ? 0 : 1)
  const state: MarginActionState = canVerify ? "Verified" : verification.decision === "Escalate" || attempts >= 2 ? "Escalated" : "Reopened"
  return Object.freeze({
    ...action,
    state,
    attempts,
    verifierActorId: verification.verifierActorId,
    verifiedAt: verification.verifiedAt,
    actualValue: verification.actualMetricValue,
    closureRef: protectedReference(verification.closureRef) ? verification.closureRef : null,
    reasons: Object.freeze(canVerify ? [] : [...reasons, verification.reason].filter(Boolean)),
  })
}

export function buildMarginDespatchEscalation(action: MarginAction): DespatchEscalationRecord | null {
  if (action.state !== "Escalated") return null
  return createDespatchEscalation({
    escalationId: `DESPATCH-${action.actionId}`,
    domain: "Nia Margins",
    sourceActionId: action.actionId,
    sourceEventId: `MARGIN-${action.studioId}`,
    title: `${action.studioName} margin recovery failed twice`,
    reason: action.reasons.join(" ") || "Repeated margin recovery failure requires review.",
    ownerRole: action.ownerRole,
    dueAt: action.dueAt,
    raisedAt: action.verifiedAt ?? action.dueAt,
    severity: action.attempts >= 2 ? "Critical" : "Breach",
    status: "Open",
    evidenceRefs: Object.freeze([...action.evidenceRefs, ...(action.closureRef ? [action.closureRef] : [])]),
    synthetic: true,
  })
}

function primaryCause(input: MarginStudioInput, occupancyPct: number, living: number, work: number, essentials: number): Pick<MarginDiagnosis, "primaryCause" | "routeTo" | "ownerRole" | "expectedRecovery"> {
  if (input.rampDay > 30 && occupancyPct < NIA_MARGIN_TARGETS.occupancyPct) return {
    primaryCause: "Occupancy",
    routeTo: input.supplyModel === "FONO" ? "New Adds" : "Enterprise Demand",
    ownerRole: input.supplyModel === "FONO" ? "New Adds JCO" : "Enterprise Demand JCO",
    expectedRecovery: `Occupancy returns to at least ${NIA_MARGIN_TARGETS.occupancyPct}% and billed CM2 recovers in the next verified cycle.`,
  }
  const gaps = [
    { gap: NIA_MARGIN_TARGETS.living - living, result: { primaryCause: "Living partner cost", routeTo: "Pushkar", ownerRole: "Finance JCO", expectedRecovery: "Partner-cost variance is reconciled and Living CM2 recovers in the next verified cycle." } },
    { gap: Math.max(0, input.livingUtilitiesInr - 450), result: { primaryCause: "Living utilities", routeTo: "Living Operations", ownerRole: "Living Operations JCO", expectedRecovery: "Utilities return to the approved band and Living CM2 recovers in the next verified cycle." } },
    { gap: NIA_MARGIN_TARGETS.work - work, result: { primaryCause: "Work delivery cost", routeTo: "Member Savings", ownerRole: "Work JCO", expectedRecovery: "Work delivery cost returns to band and Work CM2 recovers in the next verified cycle." } },
    { gap: NIA_MARGIN_TARGETS.essentials - essentials, result: { primaryCause: "Essentials delivery cost", routeTo: "Member Savings", ownerRole: "Essentials JCO", expectedRecovery: "Essentials delivery cost returns to band and Essentials CM2 recovers in the next verified cycle." } },
  ].sort((a, b) => b.gap - a.gap)[0]
  if (!gaps || gaps.gap <= 0) return { primaryCause: "On target", routeTo: "No action", ownerRole: "Finance JCO", expectedRecovery: "Maintain verified component contribution." }
  return gaps.result as Pick<MarginDiagnosis, "primaryCause" | "routeTo" | "ownerRole" | "expectedRecovery">
}

export function diagnoseMarginStudio(input: MarginStudioInput): MarginDiagnosis {
  for (const [label, value] of Object.entries({ contractedNests: input.contractedNests, occupiedNests: input.occupiedNests, rampDay: input.rampDay, billedLivingArpuInr: input.billedLivingArpuInr, livingPartnerCostInr: input.livingPartnerCostInr, livingUtilitiesInr: input.livingUtilitiesInr, billedWorkArpuInr: input.billedWorkArpuInr, workDirectDeliveryCostInr: input.workDirectDeliveryCostInr, billedEssentialsArpuInr: input.billedEssentialsArpuInr, essentialsDirectDeliveryCostInr: input.essentialsDirectDeliveryCostInr, studioGrossMarginPct: input.studioGrossMarginPct })) nonNegative(value, label)
  if (!input.studioId.trim() || !input.sourceRowIdentity.trim()) throw new Error("Margin Studio requires stable Studio and source identity.")
  if (input.occupiedNests > input.contractedNests || input.contractedNests === 0) throw new Error("Occupied Nests must fit inside positive contracted capacity.")
  const occupancyPct = Math.round((input.occupiedNests / input.contractedNests) * 1_000) / 10
  const targetOccupiedNests = Math.ceil(input.contractedNests * NIA_MARGIN_TARGETS.occupancyPct / 100)
  const livingUnitCm2Inr = input.billedLivingArpuInr - input.livingPartnerCostInr - input.livingUtilitiesInr
  const workUnitCm2Inr = input.billedWorkArpuInr - input.workDirectDeliveryCostInr
  const essentialsUnitCm2Inr = input.billedEssentialsArpuInr - input.essentialsDirectDeliveryCostInr
  const fullUseUnitCm2Inr = livingUnitCm2Inr + workUnitCm2Inr + essentialsUnitCm2Inr
  const occupancyVolumeEffectInr = (input.occupiedNests - targetOccupiedNests) * NIA_MARGIN_TARGETS.fullUse
  const livingUnitVarianceInr = input.occupiedNests * (livingUnitCm2Inr - NIA_MARGIN_TARGETS.living)
  const workUnitVarianceInr = input.occupiedNests * (workUnitCm2Inr - NIA_MARGIN_TARGETS.work)
  const essentialsUnitVarianceInr = input.occupiedNests * (essentialsUnitCm2Inr - NIA_MARGIN_TARGETS.essentials)
  const studioTotalCm2GapInr = occupancyVolumeEffectInr + livingUnitVarianceInr + workUnitVarianceInr + essentialsUnitVarianceInr
  const cause = primaryCause(input, occupancyPct, livingUnitCm2Inr, workUnitCm2Inr, essentialsUnitCm2Inr)
  return Object.freeze({
    studioId: input.studioId,
    studioName: input.studioName,
    theatreId: input.theatreId,
    supplyModel: input.supplyModel,
    ramp: input.rampDay <= 30,
    occupancyPct,
    occupiedNests: input.occupiedNests,
    targetOccupiedNests,
    livingUnitCm2Inr,
    workUnitCm2Inr,
    essentialsUnitCm2Inr,
    fullUseUnitCm2Inr,
    occupancyVolumeEffectInr,
    livingUnitVarianceInr,
    workUnitVarianceInr,
    essentialsUnitVarianceInr,
    studioTotalCm2GapInr,
    ...cause,
    actionId: cause.primaryCause === "On target" ? null : `MARGIN-${input.studioId}-${cause.primaryCause.toUpperCase().replaceAll(" ", "-")}`,
    actionState: cause.primaryCause === "On target" ? "No action" : "Assigned",
    independentlyVerified: false,
    reopened: input.previousVerifiedFullUseCm2Inr >= NIA_MARGIN_TARGETS.fullUse && fullUseUnitCm2Inr < NIA_MARGIN_TARGETS.fullUse,
  })
}

const learningPolicy: LearningPolicy = {
  policyId: "POL-LEARNING-CONTROL",
  version: 1,
  effectiveFrom: "2026-07-17T00:00:00+05:30",
  production: false,
  thresholdsApproved: false,
  thresholds: { targetChangePct: null, channelMixChangePp: null, monthlyCmEffectInr: null, cashEffectInr: null },
  confidenceRequirements: { approved: false, minimumEvidenceCycles: 3, minimumSampleSize: 30, maximumForecastErrorPct: 10, minimumVerificationRatePct: 95 },
}

export function buildNiaMarginsPreview(inputs: readonly MarginStudioInput[], asOf = "2026-07-17T14:00:00+05:30", closureInputs: readonly MarginClosureInput[] = NIA_MARGINS_SYNTHETIC_CLOSURES): NiaMarginsPreview {
  if (inputs.length === 0) {
    const loopHealth = buildLoopHealth({
      asOf,
      feeds: Object.freeze([]),
      clocks: Object.freeze([]),
      verification: Object.freeze({ claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null }),
    })
    const learning = evaluateLearningRecommendation({
      recommendationId: "LEARN-NIA-MARGINS-NO-DATA",
      domain: "Nia Margins",
      policyVersion: "POL-MARGIN-DEFINITION@v1",
      proposedChange: "No change proposed until a governed Studio margin input is recorded.",
      expectedEffect: "Keep margin conclusions withheld when the governed source has no Studio rows.",
      state: "Candidate",
      evidenceCycles: 0,
      sampleSize: 0,
      forecastErrorPct: 100,
      attributionGrade: "Observed",
      confounders: Object.freeze(["No governed Studio margin input"]),
      criticalDataFresh: false,
      verificationRatePct: 0,
      reversible: true,
      rollbackTrigger: "Not applicable until a governed input is recorded.",
      insideApprovedBoundary: true,
      reversesHumanDecision: false,
      categories: Object.freeze([]),
      targetChangePct: 0,
      channelMixChangePp: 0,
      monthlyCmEffectInr: 0,
      cashEffectInr: 0,
      synthetic: false,
    }, learningPolicy)
    return Object.freeze({
      mode: "Shadow only",
      question: "Which operating cause is moving contribution, who owns it, and did contribution recover?",
      answer: "Full-use CM2 cannot be calculated until a governed Studio input is recorded.",
      measures: Object.freeze({
        fullUseCm2Inr: 0,
        fullUseTargetInr: 1_500,
        pillarCm2Inr: Object.freeze({ living: 0, work: 0, essentials: 0 }),
        occupancyPct: 0,
        occupancyTargetPct: 78,
        negativeContributionStudios: 0,
        studioGrossMarginPct: 0,
      }),
      diagnoses: Object.freeze([]),
      actions: Object.freeze([]),
      despatchEscalations: Object.freeze([]),
      loopHealth,
      learning,
      writesEnabled: false,
      collectionLeakageIncludedInCm2: false,
    })
  }
  const baseDiagnoses = inputs.map(diagnoseMarginStudio)
  const createdActions = baseDiagnoses.map((diagnosis, index) => createMarginAction(diagnosis, inputs[index]!, "2026-07-18T14:00:00+05:30")).filter((action): action is MarginAction => action !== null)
  const closuresByAction = new Map<string, MarginClosureInput[]>()
  for (const input of closureInputs) closuresByAction.set(input.proof.actionId, [...(closuresByAction.get(input.proof.actionId) ?? []), input])
  const actions = Object.freeze(createdActions.map((action) => {
    const closures = closuresByAction.get(action.actionId) ?? []
    return closures.reduce<MarginAction>((current, closure) => verifyMarginAction(submitMarginProof(current, closure.proof), closure.proof, closure.verification), action)
  }))
  const actionById = new Map(actions.map((action) => [action.actionId, action]))
  const diagnoses = Object.freeze(baseDiagnoses.map((diagnosis) => {
    const action = diagnosis.actionId ? actionById.get(diagnosis.actionId) : null
    return Object.freeze({ ...diagnosis, actionState: action?.state ?? diagnosis.actionState, independentlyVerified: action?.state === "Verified", reopened: diagnosis.reopened || action?.state === "Reopened" || action?.state === "Escalated" })
  }))
  const despatchEscalations = Object.freeze(actions.map(buildMarginDespatchEscalation).filter((row): row is DespatchEscalationRecord => row !== null))
  const occupied = inputs.reduce((sum, input) => sum + input.occupiedNests, 0)
  const contracted = inputs.reduce((sum, input) => sum + input.contractedNests, 0)
  const weighted = (selector: (diagnosis: MarginDiagnosis) => number) => Math.round(diagnoses.reduce((sum, diagnosis) => sum + selector(diagnosis) * diagnosis.occupiedNests, 0) / Math.max(1, occupied))
  const fullUseCm2Inr = weighted((item) => item.fullUseUnitCm2Inr)
  const primary = [...diagnoses].sort((a, b) => a.studioTotalCm2GapInr - b.studioTotalCm2GapInr)[0]
  if (!primary) throw new Error("Nia Margins could not identify a diagnosis.")
  const loopHealth = buildLoopHealth({
    asOf,
    feeds: Object.freeze([
      Object.freeze({ feedId: "billed-revenue", label: "Billed revenue", lastUpdatedAt: "2026-07-17T13:00:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: Object.freeze(["CM2 waterfall"]) }),
      Object.freeze({ feedId: "direct-costs", label: "Direct costs", lastUpdatedAt: "2026-07-17T13:30:00+05:30", cadenceMinutes: 60, critical: true, affectedClaims: Object.freeze(["pillar CM2"]) }),
    ]),
    clocks: actions.filter((item) => item.state !== "Verified").slice(0, 3).map((item) => Object.freeze({ clockId: item.actionId, label: `${item.studioName} margin recovery`, ownerRole: item.ownerRole, dueAt: item.state === "Escalated" ? "2026-07-17T12:00:00+05:30" : item.dueAt, state: "Running" as const })),
    verification: Object.freeze({ claimed: closureInputs.length, verified: actions.filter((item) => item.state === "Verified").length, awaiting: closureInputs.length - actions.filter((item) => item.state === "Verified").length, reopened: actions.filter((item) => item.state === "Reopened" || item.state === "Escalated").length, oldestAwaitingAt: closureInputs.length > actions.filter((item) => item.state === "Verified").length ? "2026-07-17T13:00:00+05:30" : null }),
  })
  const learning = evaluateLearningRecommendation({
    recommendationId: "LEARN-NIA-MARGINS-001",
    domain: "Nia Margins",
    policyVersion: "POL-MARGIN-DEFINITION@v1",
    proposedChange: `Prioritise ${primary.primaryCause.toLowerCase()} diagnosis for ${primary.studioName}.`,
    expectedEffect: "Improve diagnosis accuracy and restore billed CM2 faster.",
    state: "Candidate",
    evidenceCycles: 1,
    sampleSize: inputs.length,
    forecastErrorPct: 18,
    attributionGrade: "Observed",
    confounders: Object.freeze(["Pillar mix", "Overlapping occupancy movement"]),
    criticalDataFresh: true,
    verificationRatePct: Math.round((loopHealth.verification.verified / Math.max(1, loopHealth.verification.claimed)) * 100),
    reversible: true,
    rollbackTrigger: "Diagnosis accuracy worsens for two verified cycles.",
    insideApprovedBoundary: true,
    reversesHumanDecision: false,
    categories: Object.freeze([]),
    targetChangePct: 0,
    channelMixChangePp: 0,
    monthlyCmEffectInr: Math.abs(primary.studioTotalCm2GapInr),
    cashEffectInr: 0,
    synthetic: true,
  }, learningPolicy)
  const answer = fullUseCm2Inr >= NIA_MARGIN_TARGETS.fullUse
    ? `Full-use CM2 is ₹${fullUseCm2Inr}, at or above the ₹1,500 control.`
    : `Full-use CM2 is ₹${fullUseCm2Inr}, ₹${NIA_MARGIN_TARGETS.fullUse - fullUseCm2Inr} below control; ${primary.primaryCause.toLowerCase()} is the largest measured operating cause.`
  return Object.freeze({
    mode: "Shadow only",
    question: "Which operating cause is moving contribution, who owns it, and did contribution recover?",
    answer,
    measures: Object.freeze({
      fullUseCm2Inr,
      fullUseTargetInr: 1_500,
      pillarCm2Inr: Object.freeze({ living: weighted((item) => item.livingUnitCm2Inr), work: weighted((item) => item.workUnitCm2Inr), essentials: weighted((item) => item.essentialsUnitCm2Inr) }),
      occupancyPct: Math.round((occupied / contracted) * 1_000) / 10,
      occupancyTargetPct: 78,
      negativeContributionStudios: diagnoses.filter((item) => item.fullUseUnitCm2Inr < 0).length,
      studioGrossMarginPct: Math.round(inputs.reduce((sum, input) => sum + input.studioGrossMarginPct * input.occupiedNests, 0) / Math.max(1, occupied) * 10) / 10,
    }),
    diagnoses,
    actions,
    despatchEscalations,
    loopHealth,
    learning,
    writesEnabled: false,
    collectionLeakageIncludedInCm2: false,
  })
}

export const NIA_MARGINS_SYNTHETIC_INPUTS: readonly MarginStudioInput[] = Object.freeze([
  Object.freeze({ studioId: "ST-ORA-01", studioName: "Oragadam 01", theatreId: "Coromandel", supplyModel: "FONO", contractedNests: 100, occupiedNests: 74, rampDay: 64, billedLivingArpuInr: 5_000, livingPartnerCostInr: 4_250, livingUtilitiesInr: 500, billedWorkArpuInr: 1_000, workDirectDeliveryCostInr: 80, billedEssentialsArpuInr: 1_000, essentialsDirectDeliveryCostInr: 850, studioGrossMarginPct: 16, previousVerifiedFullUseCm2Inr: 1_510, ownerActorId: "actor-new-adds-ora", sourceUpdatedAt: "2026-07-17T13:30:00+05:30", sourceRowIdentity: "Margin_Daily:ST-ORA-01:2026-07-17", synthetic: true }),
  Object.freeze({ studioId: "ST-SIP-02", studioName: "Sriperumbudur 02", theatreId: "Coromandel", supplyModel: "SP", contractedNests: 120, occupiedNests: 80, rampDay: 48, billedLivingArpuInr: 5_000, livingPartnerCostInr: 4_200, livingUtilitiesInr: 450, billedWorkArpuInr: 1_000, workDirectDeliveryCostInr: 40, billedEssentialsArpuInr: 1_000, essentialsDirectDeliveryCostInr: 780, studioGrossMarginPct: 21, previousVerifiedFullUseCm2Inr: 1_520, ownerActorId: "actor-enterprise-sip", sourceUpdatedAt: "2026-07-17T13:30:00+05:30", sourceRowIdentity: "Margin_Daily:ST-SIP-02:2026-07-17", synthetic: true }),
  Object.freeze({ studioId: "ST-CHA-04", studioName: "Chakan 04", theatreId: "Deccan", supplyModel: "FONO", contractedNests: 80, occupiedNests: 57, rampDay: 18, billedLivingArpuInr: 5_000, livingPartnerCostInr: 4_240, livingUtilitiesInr: 460, billedWorkArpuInr: 1_000, workDirectDeliveryCostInr: 50, billedEssentialsArpuInr: 1_000, essentialsDirectDeliveryCostInr: 800, studioGrossMarginPct: 18, previousVerifiedFullUseCm2Inr: 1_500, ownerActorId: "actor-work-cha", sourceUpdatedAt: "2026-07-17T13:30:00+05:30", sourceRowIdentity: "Margin_Daily:ST-CHA-04:2026-07-17", synthetic: true }),
])

export const NIA_MARGINS_SYNTHETIC_CLOSURES: readonly MarginClosureInput[] = Object.freeze([
  Object.freeze({
    proof: Object.freeze({ actionId: "MARGIN-ST-ORA-01-OCCUPANCY", submittedBy: "actor-new-adds-ora", submittedAt: "2026-07-17T13:35:00+05:30", billedRevenueRef: "protected://margin/oragadam/billed", directCostRef: "protected://margin/oragadam/cost", sourceRowIdentity: "protected://margin/oragadam/recovery-row", sourceFreshness: "Current", actualMetricValue: 79 }),
    verification: Object.freeze({ actionId: "MARGIN-ST-ORA-01-OCCUPANCY", verifierActorId: "actor-finance-verifier-01", verifiedAt: "2026-07-17T13:50:00+05:30", decision: "Verified", actualMetricValue: 79, closureRef: "protected://margin/oragadam/closure", reason: "Occupancy recovery independently reconciled." }),
  }),
  Object.freeze({
    proof: Object.freeze({ actionId: "MARGIN-ST-SIP-02-OCCUPANCY", submittedBy: "actor-enterprise-sip", submittedAt: "2026-07-17T13:35:00+05:30", billedRevenueRef: "protected://margin/sip/billed", directCostRef: "protected://margin/sip/cost", sourceRowIdentity: "protected://margin/sip/recovery-row", sourceFreshness: "Current", actualMetricValue: 70 }),
    verification: Object.freeze({ actionId: "MARGIN-ST-SIP-02-OCCUPANCY", verifierActorId: "actor-finance-verifier-02", verifiedAt: "2026-07-17T13:50:00+05:30", decision: "Reopen", actualMetricValue: 70, closureRef: "protected://margin/sip/reopen", reason: "SP occupancy remains below the verified target." }),
  }),
  Object.freeze({
    proof: Object.freeze({ actionId: "MARGIN-ST-SIP-02-OCCUPANCY", submittedBy: "actor-enterprise-sip", submittedAt: "2026-07-17T14:05:00+05:30", billedRevenueRef: "protected://margin/sip/billed-retry", directCostRef: "protected://margin/sip/cost-retry", sourceRowIdentity: "protected://margin/sip/recovery-row-retry", sourceFreshness: "Current", actualMetricValue: 72 }),
    verification: Object.freeze({ actionId: "MARGIN-ST-SIP-02-OCCUPANCY", verifierActorId: "actor-finance-verifier-02", verifiedAt: "2026-07-17T14:20:00+05:30", decision: "Reopen", actualMetricValue: 72, closureRef: "protected://margin/sip/reopen-retry", reason: "SP occupancy missed the target for a second verified cycle." }),
  }),
])
