import type { GovernedChange } from "@/lib/operating-loop/action-engine"
import { POLICY_REGISTRY, policyAt, type PolicyDefinition } from "@/lib/operating-loop/contracts"

export const AUTONOMY_FEEDBACK_LABELS = ["Rejected action", "Human override", "Missed alert", "Failed verification"] as const
export type AutonomyFeedbackLabel = (typeof AUTONOMY_FEEDBACK_LABELS)[number]
export type AutonomyRiskClass = "Low" | "High"
export type HumanDecisionOutcome = "Accepted" | "Rejected" | "Overridden"
export type VerificationOutcome = "Verified" | "Failed" | "Not required"

export type ExpectedSignal = {
  signalId: string
  domain: string
  label: string
  occurredAt: string
  independentLabelRef: string
}

export type ShadowRecommendation = {
  recommendationId: string
  expectedSignalId: string | null
  domain: string
  title: string
  rationale: string
  agentVersion: string
  recommendedAt: string
  governedChanges: readonly GovernedChange[]
  sourceRefs: readonly string[]
}

export type HumanDecision = {
  decisionId: string
  recommendationId: string
  outcome: HumanDecisionOutcome
  decidedBy: string
  decidedAt: string
  actualDecision: string
  evidenceRef: string
}

export type FinalDisposition = {
  dispositionId: string
  recommendationId: string
  outcome: VerificationOutcome
  independentlyVerified: boolean
  verifiedBy: string | null
  completedAt: string
  actualOutcome: string
  evidenceRef: string
  reversed: boolean
  reopened: boolean
}

export type AutonomyFeedback = {
  feedbackId: string
  label: AutonomyFeedbackLabel
  recommendationId: string | null
  signalId: string | null
  domain: string
  summary: string
  evidenceRef: string
  recordedAt: string
}

export type AutonomyMetrics = {
  recommendationCount: number
  expectedSignalCount: number
  reviewedCount: number
  detectionPrecision: number | null
  falsePositiveRate: number | null
  missedEventRate: number | null
  acceptanceRate: number | null
  rejectionRate: number | null
  overrideRate: number | null
  reversalRate: number | null
  auditCompleteness: number | null
  verificationFailureRate: number | null
  medianDecisionMinutes: number | null
  medianVerificationMinutes: number | null
}

export type AutonomyPolicySet = {
  mode: PolicyDefinition
  minimumPrecision: PolicyDefinition
  maximumReversal: PolicyDefinition
  minimumAuditCompleteness: PolicyDefinition
  highRiskRule: PolicyDefinition
  killSwitch: PolicyDefinition
}

export type AutonomyReadiness = {
  riskClass: AutonomyRiskClass
  requiredHumanApprover: "None" | "Sachin" | "Pushkar"
  precisionThresholdMet: boolean
  reversalThresholdMet: boolean
  auditThresholdMet: boolean
  thresholdsAgreed: boolean
  controlledModeEnabled: boolean
  killSwitchDisengaged: boolean
  automaticExecutionPermitted: boolean
  reasons: readonly string[]
}

const AUTONOMY_POLICY_IDS = {
  mode: "POL-AUTONOMY-MODE",
  minimumPrecision: "POL-AUTONOMY-PRECISION-GATE",
  maximumReversal: "POL-AUTONOMY-REVERSAL-GATE",
  minimumAuditCompleteness: "POL-AUTONOMY-AUDIT-GATE",
  highRiskRule: "POL-AUTONOMY-HIGH-RISK",
  killSwitch: "POL-AUTONOMY-KILL-SWITCH",
} as const

const pushkarChanges = new Set<GovernedChange>(["pricing", "money", "deposit", "capex", "commercial"])
const sachinChanges = new Set<GovernedChange>(["external-communication", "configuration", "irreversible-write"])

function requiredPolicy(policyId: string, at: string, registry: readonly PolicyDefinition[]) {
  const policy = policyAt(policyId, at, registry)
  if (!policy) throw new Error(`Missing active autonomy policy ${policyId} at ${at}.`)
  return policy
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator
}

function median(values: readonly number[]) {
  if (values.length === 0) return null
  const sorted = [...values].toSorted((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function elapsedMinutes(from: string, to: string) {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / 60_000)
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label} identifiers must be append-only and unique.`)
}

function assertProtectedRef(value: string, label: string) {
  if (!value.startsWith("protected://")) throw new Error(`${label} must use a protected evidence reference.`)
}

function numericPolicyValue(policy: PolicyDefinition) {
  return typeof policy.value === "number" && Number.isFinite(policy.value) ? policy.value : null
}

export function autonomyPoliciesAt(at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY): AutonomyPolicySet {
  return Object.freeze({
    mode: requiredPolicy(AUTONOMY_POLICY_IDS.mode, at, registry),
    minimumPrecision: requiredPolicy(AUTONOMY_POLICY_IDS.minimumPrecision, at, registry),
    maximumReversal: requiredPolicy(AUTONOMY_POLICY_IDS.maximumReversal, at, registry),
    minimumAuditCompleteness: requiredPolicy(AUTONOMY_POLICY_IDS.minimumAuditCompleteness, at, registry),
    highRiskRule: requiredPolicy(AUTONOMY_POLICY_IDS.highRiskRule, at, registry),
    killSwitch: requiredPolicy(AUTONOMY_POLICY_IDS.killSwitch, at, registry),
  })
}

export function classifyAutonomyRisk(changes: readonly GovernedChange[]): AutonomyRiskClass {
  return changes.length > 0 && changes.every((change) => change === "operational") ? "Low" : "High"
}

export function requiredAutonomyApprover(changes: readonly GovernedChange[]) {
  if (changes.some((change) => pushkarChanges.has(change))) return "Pushkar" as const
  if (changes.some((change) => sachinChanges.has(change))) return "Sachin" as const
  return classifyAutonomyRisk(changes) === "High" ? "Sachin" as const : "None" as const
}

export function evaluateAutonomyReadiness(metrics: AutonomyMetrics, changes: readonly GovernedChange[], policies: AutonomyPolicySet): AutonomyReadiness {
  const riskClass = classifyAutonomyRisk(changes)
  const requiredHumanApprover = requiredAutonomyApprover(changes)
  const precisionThreshold = numericPolicyValue(policies.minimumPrecision)
  const reversalThreshold = numericPolicyValue(policies.maximumReversal)
  const auditThreshold = numericPolicyValue(policies.minimumAuditCompleteness)
  const thresholdsAgreed = precisionThreshold !== null && reversalThreshold !== null && auditThreshold !== null
  const precisionThresholdMet = precisionThreshold !== null && metrics.detectionPrecision !== null && metrics.detectionPrecision >= precisionThreshold
  const reversalThresholdMet = reversalThreshold !== null && metrics.reversalRate !== null && metrics.reversalRate <= reversalThreshold
  const auditThresholdMet = auditThreshold !== null && metrics.auditCompleteness !== null && metrics.auditCompleteness >= auditThreshold
  const controlledModeEnabled = policies.mode.value === "Controlled low risk"
  const killSwitchDisengaged = policies.killSwitch.value === "Disengaged"
  const reasons: string[] = []
  if (riskClass === "High") reasons.push("High-risk actions remain human-approved permanently.")
  if (!thresholdsAgreed) reasons.push("Accuracy, reversal and audit-completeness thresholds are not agreed in the governed registry.")
  if (thresholdsAgreed && !(precisionThresholdMet && reversalThresholdMet && auditThresholdMet)) reasons.push("One or more governed performance thresholds are not met.")
  if (!controlledModeEnabled) reasons.push("The governed operating mode remains Shadow only.")
  if (!killSwitchDisengaged) reasons.push("The automatic-execution kill switch is engaged.")
  const automaticExecutionPermitted = riskClass === "Low" && thresholdsAgreed && precisionThresholdMet && reversalThresholdMet && auditThresholdMet && controlledModeEnabled && killSwitchDisengaged
  return Object.freeze({ riskClass, requiredHumanApprover, precisionThresholdMet, reversalThresholdMet, auditThresholdMet, thresholdsAgreed, controlledModeEnabled, killSwitchDisengaged, automaticExecutionPermitted, reasons: Object.freeze(reasons) })
}

export function buildShadowAutonomyEvaluation(input: {
  expectedSignals: readonly ExpectedSignal[]
  recommendations: readonly ShadowRecommendation[]
  decisions: readonly HumanDecision[]
  dispositions: readonly FinalDisposition[]
  recordedAt: string
}) {
  assertUnique(input.expectedSignals.map((item) => item.signalId), "Expected signal")
  assertUnique(input.recommendations.map((item) => item.recommendationId), "Recommendation")
  assertUnique(input.decisions.map((item) => item.decisionId), "Human decision")
  assertUnique(input.dispositions.map((item) => item.dispositionId), "Final disposition")
  const signals = new Map(input.expectedSignals.map((item) => [item.signalId, item]))
  const recommendations = new Map(input.recommendations.map((item) => [item.recommendationId, item]))
  for (const signal of input.expectedSignals) assertProtectedRef(signal.independentLabelRef, "Independent signal label")
  for (const recommendation of input.recommendations) {
    if (recommendation.expectedSignalId && !signals.has(recommendation.expectedSignalId)) throw new Error(`Recommendation ${recommendation.recommendationId} references an unknown expected signal.`)
    if (recommendation.sourceRefs.length === 0) throw new Error(`Recommendation ${recommendation.recommendationId} requires source lineage.`)
    recommendation.sourceRefs.forEach((ref) => assertProtectedRef(ref, "Recommendation source"))
  }
  for (const decision of input.decisions) {
    if (!recommendations.has(decision.recommendationId)) throw new Error(`Decision ${decision.decisionId} references an unknown recommendation.`)
    assertProtectedRef(decision.evidenceRef, "Human decision evidence")
  }
  for (const disposition of input.dispositions) {
    if (!recommendations.has(disposition.recommendationId)) throw new Error(`Disposition ${disposition.dispositionId} references an unknown recommendation.`)
    assertProtectedRef(disposition.evidenceRef, "Final disposition evidence")
    if (disposition.independentlyVerified && !disposition.verifiedBy) throw new Error(`Disposition ${disposition.dispositionId} requires an independent verifier.`)
  }
  const decisionByRecommendation = new Map(input.decisions.map((item) => [item.recommendationId, item]))
  const dispositionByRecommendation = new Map(input.dispositions.map((item) => [item.recommendationId, item]))
  if (decisionByRecommendation.size !== input.decisions.length) throw new Error("Each recommendation can have only one current human decision in this append-only evaluation snapshot.")
  if (dispositionByRecommendation.size !== input.dispositions.length) throw new Error("Each recommendation can have only one final disposition in this append-only evaluation snapshot.")

  const feedback: AutonomyFeedback[] = []
  for (const decision of input.decisions) {
    const recommendation = recommendations.get(decision.recommendationId)!
    if (decision.outcome === "Rejected" || decision.outcome === "Overridden") {
      const label = decision.outcome === "Rejected" ? "Rejected action" : "Human override"
      feedback.push(Object.freeze({ feedbackId: `FDB-${decision.decisionId}`, label, recommendationId: recommendation.recommendationId, signalId: recommendation.expectedSignalId, domain: recommendation.domain, summary: decision.actualDecision, evidenceRef: decision.evidenceRef, recordedAt: decision.decidedAt }))
    }
  }
  const coveredSignalIds = new Set(input.recommendations.flatMap((item) => item.expectedSignalId ? [item.expectedSignalId] : []))
  for (const signal of input.expectedSignals) if (!coveredSignalIds.has(signal.signalId)) {
    feedback.push(Object.freeze({ feedbackId: `FDB-MISSED-${signal.signalId}`, label: "Missed alert", recommendationId: null, signalId: signal.signalId, domain: signal.domain, summary: signal.label, evidenceRef: signal.independentLabelRef, recordedAt: input.recordedAt }))
  }
  for (const disposition of input.dispositions) if (disposition.outcome === "Failed") {
    const recommendation = recommendations.get(disposition.recommendationId)!
    feedback.push(Object.freeze({ feedbackId: `FDB-FAILED-${disposition.dispositionId}`, label: "Failed verification", recommendationId: recommendation.recommendationId, signalId: recommendation.expectedSignalId, domain: recommendation.domain, summary: disposition.actualOutcome, evidenceRef: disposition.evidenceRef, recordedAt: disposition.completedAt }))
  }

  const matchedRecommendations = input.recommendations.filter((item) => item.expectedSignalId !== null).length
  const reviewed = input.recommendations.filter((item) => decisionByRecommendation.has(item.recommendationId))
  const actioned = reviewed.filter((item) => decisionByRecommendation.get(item.recommendationId)?.outcome !== "Rejected")
  const verifiedActioned = actioned.filter((item) => dispositionByRecommendation.get(item.recommendationId)?.independentlyVerified)
  const completeAudit = reviewed.filter((item) => item.sourceRefs.length > 0 && decisionByRecommendation.has(item.recommendationId) && dispositionByRecommendation.has(item.recommendationId))
  const decisionMinutes = reviewed.map((item) => elapsedMinutes(item.recommendedAt, decisionByRecommendation.get(item.recommendationId)!.decidedAt))
  const verificationMinutes = verifiedActioned.map((item) => elapsedMinutes(decisionByRecommendation.get(item.recommendationId)!.decidedAt, dispositionByRecommendation.get(item.recommendationId)!.completedAt))
  const metrics: AutonomyMetrics = Object.freeze({
    recommendationCount: input.recommendations.length,
    expectedSignalCount: input.expectedSignals.length,
    reviewedCount: reviewed.length,
    detectionPrecision: ratio(matchedRecommendations, input.recommendations.length),
    falsePositiveRate: ratio(input.recommendations.length - matchedRecommendations, input.recommendations.length),
    missedEventRate: ratio(input.expectedSignals.length - coveredSignalIds.size, input.expectedSignals.length),
    acceptanceRate: ratio(reviewed.filter((item) => decisionByRecommendation.get(item.recommendationId)?.outcome === "Accepted").length, reviewed.length),
    rejectionRate: ratio(reviewed.filter((item) => decisionByRecommendation.get(item.recommendationId)?.outcome === "Rejected").length, reviewed.length),
    overrideRate: ratio(reviewed.filter((item) => decisionByRecommendation.get(item.recommendationId)?.outcome === "Overridden").length, reviewed.length),
    reversalRate: ratio(actioned.filter((item) => dispositionByRecommendation.get(item.recommendationId)?.reversed).length, actioned.length),
    auditCompleteness: ratio(completeAudit.length, reviewed.length),
    verificationFailureRate: ratio(verifiedActioned.filter((item) => dispositionByRecommendation.get(item.recommendationId)?.outcome === "Failed").length, verifiedActioned.length),
    medianDecisionMinutes: median(decisionMinutes),
    medianVerificationMinutes: median(verificationMinutes),
  })
  const comparisons = Object.freeze(input.recommendations.map((recommendation) => Object.freeze({
    recommendation: Object.freeze({ ...recommendation, governedChanges: Object.freeze([...recommendation.governedChanges]), sourceRefs: Object.freeze([...recommendation.sourceRefs]) }),
    decision: decisionByRecommendation.get(recommendation.recommendationId) ? Object.freeze({ ...decisionByRecommendation.get(recommendation.recommendationId)! }) : null,
    disposition: dispositionByRecommendation.get(recommendation.recommendationId) ? Object.freeze({ ...dispositionByRecommendation.get(recommendation.recommendationId)! }) : null,
    riskClass: classifyAutonomyRisk(recommendation.governedChanges),
    requiredHumanApprover: requiredAutonomyApprover(recommendation.governedChanges),
  })))
  return Object.freeze({
    expectedSignals: Object.freeze(input.expectedSignals.map((item) => Object.freeze({ ...item }))),
    comparisons,
    feedback: Object.freeze(feedback),
    metrics,
    recordedAt: input.recordedAt,
  })
}
