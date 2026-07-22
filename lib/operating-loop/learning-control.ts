export const HUMAN_CONTROLLED_LEARNING_CATEGORIES = [
  "Monthly CM goal",
  "Month-end cash target",
  "Financial guardrail",
  "Pricing",
  "Commercial terms",
  "Deposit",
  "Capex",
  "Contract",
  "Hiring",
  "Safety",
  "Employment action",
  "Member-facing template",
  "Supply-model rule",
] as const

export type HumanControlledLearningCategory = (typeof HUMAN_CONTROLLED_LEARNING_CATEGORIES)[number]
export type AttributionGrade = "Controlled" | "Compared" | "Observed"
export type RecommendationConfidence = "High" | "Medium" | "Low"
export type RecommendationState = "Candidate" | "Backtested" | "Shadow-tested" | "Awaiting sign-off" | "Approved" | "Monitored" | "Retained" | "Rolled back"

export type MaterialityThresholds = {
  targetChangePct: number | null
  channelMixChangePp: number | null
  monthlyCmEffectInr: number | null
  cashEffectInr: number | null
}

export type LearningPolicy = {
  policyId: string
  version: number
  effectiveFrom: string
  production: boolean
  thresholdsApproved: boolean
  thresholds: MaterialityThresholds
  confidenceRequirements: {
    approved: boolean
    minimumEvidenceCycles: number
    minimumSampleSize: number
    maximumForecastErrorPct: number
    minimumVerificationRatePct: number
  }
}

export type LearningRecommendationInput = {
  recommendationId: string
  domain: string
  policyVersion: string
  proposedChange: string
  expectedEffect: string
  state: RecommendationState
  evidenceCycles: number
  sampleSize: number
  forecastErrorPct: number
  attributionGrade: AttributionGrade
  confounders: readonly string[]
  criticalDataFresh: boolean
  verificationRatePct: number
  reversible: boolean
  rollbackTrigger: string | null
  insideApprovedBoundary: boolean
  reversesHumanDecision: boolean
  categories: readonly HumanControlledLearningCategory[]
  targetChangePct: number
  channelMixChangePp: number
  monthlyCmEffectInr: number
  cashEffectInr: number
  synthetic: boolean
}

export type LearningRecommendationEvaluation = Readonly<{
  recommendationId: string
  material: boolean
  materialityReasons: readonly string[]
  confidence: RecommendationConfidence
  confidenceReasons: readonly string[]
  attributionLabel: string
  autoAdoptPermitted: boolean
  requiredDisposition: "Auto-adopt and log" | "Human sign-off" | "Monitor only"
  approverRequired: boolean
  policyRef: string
}>

function finiteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`)
}

function validatePolicy(policy: LearningPolicy) {
  if (!policy.policyId.trim() || !Number.isInteger(policy.version) || policy.version < 1) throw new Error("Learning policy requires a stable ID and positive version.")
  if (!Number.isFinite(Date.parse(policy.effectiveFrom))) throw new Error("Learning policy requires a valid effective date.")
  for (const [label, value] of Object.entries(policy.thresholds)) {
    if (value !== null) finiteNonNegative(value, `Materiality threshold ${label}`)
  }
  finiteNonNegative(policy.confidenceRequirements.minimumEvidenceCycles, "Minimum evidence cycles")
  finiteNonNegative(policy.confidenceRequirements.minimumSampleSize, "Minimum sample size")
  finiteNonNegative(policy.confidenceRequirements.maximumForecastErrorPct, "Maximum forecast error")
  finiteNonNegative(policy.confidenceRequirements.minimumVerificationRatePct, "Minimum verification rate")
}

function thresholdReason(label: string, observed: number, threshold: number | null, thresholdsApproved: boolean) {
  if (observed === 0) return null
  if (!thresholdsApproved || threshold === null) return `${label} threshold is not approved`
  return observed >= threshold ? `${label} ${observed} reaches material threshold ${threshold}` : null
}

export function evaluateLearningRecommendation(input: LearningRecommendationInput, policy: LearningPolicy): LearningRecommendationEvaluation {
  validatePolicy(policy)
  if (!input.recommendationId.trim() || !input.domain.trim() || !input.policyVersion.trim()) throw new Error("Learning recommendation requires stable identity, domain and policy version.")
  finiteNonNegative(input.evidenceCycles, "Evidence cycles")
  finiteNonNegative(input.sampleSize, "Sample size")
  finiteNonNegative(input.forecastErrorPct, "Forecast error")
  finiteNonNegative(input.verificationRatePct, "Verification rate")
  finiteNonNegative(input.targetChangePct, "Target change")
  finiteNonNegative(input.channelMixChangePp, "Channel-mix change")
  finiteNonNegative(input.monthlyCmEffectInr, "Monthly CM effect")
  finiteNonNegative(input.cashEffectInr, "Cash effect")
  if (input.verificationRatePct > 100) throw new Error("Verification rate cannot exceed 100%.")
  if (new Set(input.categories).size !== input.categories.length) throw new Error("Learning recommendation categories must be unique.")

  const materialityReasons = [
    ...input.categories.map((category) => `Touches human-controlled category: ${category}`),
    ...(input.reversesHumanDecision ? ["Reverses a prior human decision"] : []),
    ...(!input.reversible ? ["Change is not completely reversible"] : []),
    thresholdReason("Target change %", input.targetChangePct, policy.thresholds.targetChangePct, policy.thresholdsApproved),
    thresholdReason("Channel-mix change pp", input.channelMixChangePp, policy.thresholds.channelMixChangePp, policy.thresholdsApproved),
    thresholdReason("Monthly CM effect INR", input.monthlyCmEffectInr, policy.thresholds.monthlyCmEffectInr, policy.thresholdsApproved),
    thresholdReason("Cash effect INR", input.cashEffectInr, policy.thresholds.cashEffectInr, policy.thresholdsApproved),
  ].filter((reason): reason is string => Boolean(reason))

  const requirements = policy.confidenceRequirements
  const highConfidenceReasons = [
    ...(!requirements.approved ? ["Confidence thresholds are not approved"] : []),
    ...(!input.criticalDataFresh ? ["Critical data is stale"] : []),
    ...(input.attributionGrade === "Observed" ? ["Confounders are not ruled out"] : []),
    ...(input.evidenceCycles < requirements.minimumEvidenceCycles ? [`Only ${input.evidenceCycles} evidence cycles`] : []),
    ...(input.sampleSize < requirements.minimumSampleSize ? [`Sample size is ${input.sampleSize}`] : []),
    ...(input.forecastErrorPct > requirements.maximumForecastErrorPct ? [`Forecast error is ${input.forecastErrorPct}%`] : []),
    ...(input.verificationRatePct < requirements.minimumVerificationRatePct ? [`Verification rate is ${input.verificationRatePct}%`] : []),
  ]
  const confidence: RecommendationConfidence = highConfidenceReasons.length === 0
    ? "High"
    : input.criticalDataFresh && input.verificationRatePct > 0 && input.attributionGrade !== "Observed" && requirements.approved
      ? "Medium"
      : "Low"

  const material = materialityReasons.length > 0
  const autoAdoptPermitted = !material
    && confidence === "High"
    && input.reversible
    && Boolean(input.rollbackTrigger?.trim())
    && input.insideApprovedBoundary
    && input.criticalDataFresh
    && input.categories.length === 0
    && !input.reversesHumanDecision

  const requiredDisposition = autoAdoptPermitted
    ? "Auto-adopt and log"
    : material || confidence === "Medium"
      ? "Human sign-off"
      : "Monitor only"

  return Object.freeze({
    recommendationId: input.recommendationId,
    material,
    materialityReasons: Object.freeze(materialityReasons),
    confidence,
    confidenceReasons: Object.freeze(highConfidenceReasons),
    attributionLabel: input.attributionGrade === "Observed" ? "Observed only · confounders not ruled out" : input.attributionGrade,
    autoAdoptPermitted,
    requiredDisposition,
    approverRequired: requiredDisposition === "Human sign-off",
    policyRef: `${policy.policyId}@v${policy.version}`,
  })
}

export type MonitoredSignal = Readonly<{
  signalId: string
  domain: string
  ownerRole: string
  intendedActionConnection: string
  reviewAt: string
  retireAt: string
  planningCycleEndsAt: string
  state: "Monitored signal"
}>

export function parkMonitoredSignal(input: Omit<MonitoredSignal, "state">): MonitoredSignal {
  for (const [label, value] of Object.entries({ reviewAt: input.reviewAt, retireAt: input.retireAt, planningCycleEndsAt: input.planningCycleEndsAt })) {
    if (!Number.isFinite(Date.parse(value))) throw new Error(`Monitored signal ${label} must be a valid date.`)
  }
  if (Date.parse(input.retireAt) > Date.parse(input.planningCycleEndsAt)) throw new Error("A monitored signal must be wired or retired within one governed planning cycle.")
  if (Date.parse(input.reviewAt) > Date.parse(input.retireAt)) throw new Error("A monitored signal review must occur before retirement.")
  if (!input.signalId.trim() || !input.domain.trim() || !input.ownerRole.trim() || !input.intendedActionConnection.trim()) throw new Error("A monitored signal requires identity, domain, owner and intended action connection.")
  return Object.freeze({ ...input, state: "Monitored signal" })
}
