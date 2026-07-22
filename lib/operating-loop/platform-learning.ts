import { buildCashControlPreview, type CashControlPreview } from "@/lib/operating-loop/cash-control-loop"
import { buildEnterpriseDemandLoopPreview, type EnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { evaluateLearningRecommendation, type AttributionGrade, type HumanControlledLearningCategory, type LearningPolicy, type LearningRecommendationEvaluation, type LearningRecommendationInput } from "@/lib/operating-loop/learning-control"
import { buildMemberEngagementPreview, type MemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import { buildMemberSavingsPreview, type MemberSavingsPreview } from "@/lib/operating-loop/member-savings-loop"
import { buildNewAddsPreview, type NewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import { buildNiaGrowthPreview, type NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import { buildNiaMarginsPreview, NIA_MARGINS_SYNTHETIC_INPUTS, type NiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"

export const PLATFORM_LEARNING_POLICY: LearningPolicy = Object.freeze({
  policyId: "POL-PLATFORM-LEARNING-GATE",
  version: 1,
  effectiveFrom: "2026-07-18T00:00:00.000Z",
  production: false,
  thresholdsApproved: false,
  thresholds: Object.freeze({ targetChangePct: null, channelMixChangePp: null, monthlyCmEffectInr: null, cashEffectInr: null }),
  confidenceRequirements: Object.freeze({ approved: false, minimumEvidenceCycles: 0, minimumSampleSize: 0, maximumForecastErrorPct: 0, minimumVerificationRatePct: 0 }),
})

export type PlatformLearningQueueEntry = Readonly<{
  recommendationId: string
  domain: string
  observed: string
  proposedChange: string
  expectedEffect: string
  evidenceSummary: string
  authority: "Pushkar" | "Sachin" | "Monitor only"
  evaluation: LearningRecommendationEvaluation
}>

type PlatformPreviews = {
  enterpriseDemand: EnterpriseDemandLoopPreview
  newAdds: NewAddsPreview
  memberEngagement: MemberEngagementPreview
  memberSavings: MemberSavingsPreview
  niaMargins: NiaMarginsPreview
  niaGrowth: NiaGrowthPreview
  cashControl: CashControlPreview | null
}

type CommonDomainLearning = {
  event_id: string
  proposed_change: string
  expected_effect: string
  evidence_cycles: number
  sample_size: number
  forecast_error_pct: number
  attribution_grade: AttributionGrade
  confounders: readonly string[]
  critical_data_fresh: boolean
  verification_rate_pct: number
  reversible: boolean
  rollback_trigger: string
  inside_approved_boundary: boolean
  reverses_human_decision: boolean
}

function input(args: {
  id: string
  domain: string
  proposedChange: string
  expectedEffect: string
  categories?: readonly HumanControlledLearningCategory[]
  evidenceCycles?: number
  sampleSize?: number
  forecastErrorPct?: number
  attributionGrade?: LearningRecommendationInput["attributionGrade"]
  confounders?: readonly string[]
  criticalDataFresh?: boolean
  verificationRatePct?: number
  reversible?: boolean
  rollbackTrigger?: string | null
  insideApprovedBoundary?: boolean
  reversesHumanDecision?: boolean
}): LearningRecommendationInput {
  return Object.freeze({
    recommendationId: args.id,
    domain: args.domain,
    policyVersion: `${PLATFORM_LEARNING_POLICY.policyId}@v${PLATFORM_LEARNING_POLICY.version}`,
    proposedChange: args.proposedChange,
    expectedEffect: args.expectedEffect,
    state: "Candidate",
    evidenceCycles: args.evidenceCycles ?? 0,
    sampleSize: args.sampleSize ?? 0,
    forecastErrorPct: args.forecastErrorPct ?? 0,
    attributionGrade: args.attributionGrade ?? "Observed",
    confounders: Object.freeze([...(args.confounders ?? ["confounders not ruled out"])]),
    criticalDataFresh: args.criticalDataFresh ?? false,
    verificationRatePct: args.verificationRatePct ?? 0,
    reversible: args.reversible ?? true,
    rollbackTrigger: args.rollbackTrigger ?? null,
    insideApprovedBoundary: args.insideApprovedBoundary ?? false,
    reversesHumanDecision: args.reversesHumanDecision ?? false,
    categories: Object.freeze([...(args.categories ?? [])]),
    targetChangePct: 0,
    channelMixChangePp: 0,
    monthlyCmEffectInr: 0,
    cashEffectInr: 0,
    synthetic: true,
  })
}

function fromDomainLearning(domain: string, learning: CommonDomainLearning, categories: readonly HumanControlledLearningCategory[]) {
  return input({
    id: `LEARN-${domain.toUpperCase().replaceAll(" ", "-")}-${learning.event_id}`,
    domain,
    proposedChange: learning.proposed_change,
    expectedEffect: learning.expected_effect,
    categories,
    evidenceCycles: learning.evidence_cycles,
    sampleSize: learning.sample_size,
    forecastErrorPct: learning.forecast_error_pct,
    attributionGrade: learning.attribution_grade,
    confounders: learning.confounders,
    criticalDataFresh: learning.critical_data_fresh,
    verificationRatePct: learning.verification_rate_pct,
    reversible: learning.reversible,
    rollbackTrigger: learning.rollback_trigger,
    insideApprovedBoundary: learning.inside_approved_boundary,
    reversesHumanDecision: learning.reverses_human_decision,
  })
}

function authorityFor(categories: readonly HumanControlledLearningCategory[]): PlatformLearningQueueEntry["authority"] {
  if (categories.some((category) => category === "Member-facing template" || category === "Safety" || category === "Employment action")) return "Sachin"
  return categories.length > 0 ? "Pushkar" : "Monitor only"
}

export function buildPlatformLearningQueue(previews: PlatformPreviews): readonly PlatformLearningQueueEntry[] {
  const engagement = previews.memberEngagement.learningInputs[0]
  const savings = previews.memberSavings.learningInputs[0]
  const growth = previews.niaGrowth.learningInputs[0]
  const cash = previews.cashControl?.learningInputs[0]
  const newAdds = previews.newAdds.learningProjection.accepted[0]
  const newAddsProposal = previews.newAdds.learningProjection.proposedCalibration[0]
  const candidates: readonly { input: LearningRecommendationInput; observed: string; evidenceSummary: string; existingEvaluation?: LearningRecommendationEvaluation }[] = [
    { input: input({ id: "LEARN-ENTERPRISE-DEMAND", domain: "Enterprise Demand", proposedChange: "Keep the 2 km-first readiness rule under observation until verified arrival cycles accumulate.", expectedEffect: "Improve contract readiness without widening the route prematurely.", rollbackTrigger: "Readiness deteriorates after the route rule changes." }), observed: previews.enterpriseDemand.headline, evidenceSummary: `${previews.enterpriseDemand.progressPercent}% current readiness journey` },
    { input: input({ id: `LEARN-NEW-ADDS-${newAdds?.eventId ?? "PENDING"}`, domain: "New Adds", proposedChange: newAddsProposal?.proposal ?? "Wait for verified FONO fill cycles.", expectedEffect: "Improve FONO channel choice using actual conversion and CAC.", categories: ["Supply-model rule"], evidenceCycles: newAdds ? 1 : 0, sampleSize: newAdds ? 1 : 0, forecastErrorPct: 0, criticalDataFresh: Boolean(newAdds), verificationRatePct: newAdds ? 100 : 0, rollbackTrigger: "Verified fill conversion or CAC worsens.", insideApprovedBoundary: false }), observed: previews.newAdds.learningProjection.question, evidenceSummary: `${previews.newAdds.learningProjection.accepted.length} accepted · ${previews.newAdds.learningProjection.rejected.length} rejected chains` },
    { input: fromDomainLearning("Member Engagement", engagement, []), observed: engagement.rejection_reasons[0] ?? engagement.expected_effect, evidenceSummary: `${engagement.evidence_cycles} cycles · n=${engagement.sample_size} · ${engagement.verification_rate_pct}% verified` },
    { input: fromDomainLearning("Member Savings", savings, ["Pricing"]), observed: savings.rejection_reasons[0] ?? savings.expected_effect, evidenceSummary: `${savings.evidence_cycles} cycles · n=${savings.sample_size} · ${savings.verification_rate_pct}% verified` },
    { input: input({ id: previews.niaMargins.learning.recommendationId, domain: "Nia Margins", proposedChange: "Calibrate only after verified margin recovery.", expectedEffect: "Improve the next target without moving the governed CM definition.", categories: ["Monthly CM goal"], rollbackTrigger: "Verified CM2 deteriorates.", criticalDataFresh: previews.niaMargins.loopHealth.overviewAnswerAllowed, verificationRatePct: previews.niaMargins.loopHealth.verification.claimed === 0 ? 0 : Math.round((previews.niaMargins.loopHealth.verification.verified / previews.niaMargins.loopHealth.verification.claimed) * 100) }), observed: previews.niaMargins.answer, evidenceSummary: previews.niaMargins.learning.attributionLabel, existingEvaluation: previews.niaMargins.learning },
    { input: fromDomainLearning("Nia Growth", growth, ["Capex", "Contract", "Supply-model rule"]), observed: growth.rejection_reasons[0] ?? growth.expected_effect, evidenceSummary: `${growth.evidence_cycles} cycles · n=${growth.sample_size} · ${growth.verification_rate_pct}% verified` },
    ...(cash ? [{ input: fromDomainLearning("Cash & Control", cash, ["Monthly CM goal", "Month-end cash target", "Financial guardrail"]), observed: cash.rejection_reasons[0] ?? cash.expected_effect, evidenceSummary: `${cash.evidence_cycles} cycles · n=${cash.sample_size} · ${cash.verification_rate_pct}% verified` }] : []),
  ]

  return Object.freeze(candidates.map((candidate) => {
    const evaluation = candidate.existingEvaluation ?? evaluateLearningRecommendation(candidate.input, PLATFORM_LEARNING_POLICY)
    return Object.freeze({
      recommendationId: candidate.input.recommendationId,
      domain: candidate.input.domain,
      observed: candidate.observed,
      proposedChange: candidate.input.proposedChange,
      expectedEffect: candidate.input.expectedEffect,
      evidenceSummary: candidate.evidenceSummary,
      authority: authorityFor(candidate.input.categories),
      evaluation,
    })
  }))
}

export function buildSyntheticPlatformLearningQueue(options: { includeCashControl?: boolean } = {}) {
  return buildPlatformLearningQueue({
    enterpriseDemand: buildEnterpriseDemandLoopPreview(),
    newAdds: buildNewAddsPreview(),
    memberEngagement: buildMemberEngagementPreview(),
    memberSavings: buildMemberSavingsPreview(),
    niaMargins: buildNiaMarginsPreview(NIA_MARGINS_SYNTHETIC_INPUTS),
    niaGrowth: buildNiaGrowthPreview(),
    cashControl: options.includeCashControl === false ? null : buildCashControlPreview(),
  })
}
