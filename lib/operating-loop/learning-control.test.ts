import assert from "node:assert/strict"
import test from "node:test"
import { evaluateLearningRecommendation, parkMonitoredSignal, type LearningPolicy, type LearningRecommendationInput } from "@/lib/operating-loop/learning-control"

const approvedPolicy: LearningPolicy = {
  policyId: "POL-LEARNING-CONTROL",
  version: 1,
  effectiveFrom: "2026-07-17T00:00:00+05:30",
  production: false,
  thresholdsApproved: true,
  thresholds: { targetChangePct: 5, channelMixChangePp: 5, monthlyCmEffectInr: 100_000, cashEffectInr: 100_000 },
  confidenceRequirements: { approved: true, minimumEvidenceCycles: 3, minimumSampleSize: 30, maximumForecastErrorPct: 10, minimumVerificationRatePct: 95 },
}

function recommendation(overrides: Partial<LearningRecommendationInput> = {}): LearningRecommendationInput {
  return {
    recommendationId: "LEARN-NEW-ADDS-001",
    domain: "New Adds",
    policyVersion: "POL-NEW-ADDS@v1",
    proposedChange: "Rank verified referrals ahead of walk-ins in this Theatre.",
    expectedEffect: "Reduce median time to billing by one day.",
    state: "Shadow-tested",
    evidenceCycles: 4,
    sampleSize: 42,
    forecastErrorPct: 7,
    attributionGrade: "Compared",
    confounders: [],
    criticalDataFresh: true,
    verificationRatePct: 98,
    reversible: true,
    rollbackTrigger: "Median time to billing worsens for two cycles.",
    insideApprovedBoundary: true,
    reversesHumanDecision: false,
    categories: [],
    targetChangePct: 0,
    channelMixChangePp: 2,
    monthlyCmEffectInr: 20_000,
    cashEffectInr: 0,
    synthetic: true,
    ...overrides,
  }
}

test("high-confidence non-material reversible learning can auto-adopt inside approved bounds", () => {
  const result = evaluateLearningRecommendation(recommendation(), approvedPolicy)
  assert.equal(result.material, false)
  assert.equal(result.confidence, "High")
  assert.equal(result.autoAdoptPermitted, true)
  assert.equal(result.requiredDisposition, "Auto-adopt and log")
})

test("human-controlled categories are always material", () => {
  const result = evaluateLearningRecommendation(recommendation({ categories: ["Pricing"] }), approvedPolicy)
  assert.equal(result.material, true)
  assert.equal(result.autoAdoptPermitted, false)
  assert.equal(result.requiredDisposition, "Human sign-off")
  assert.match(result.materialityReasons[0], /Pricing/)
})

test("unapproved numeric thresholds make target and financial changes material", () => {
  const policy: LearningPolicy = { ...approvedPolicy, production: true, thresholdsApproved: false, thresholds: { targetChangePct: null, channelMixChangePp: null, monthlyCmEffectInr: null, cashEffectInr: null } }
  const result = evaluateLearningRecommendation(recommendation({ targetChangePct: 1 }), policy)
  assert.equal(result.material, true)
  assert.match(result.materialityReasons.join(" "), /not approved/)
})

test("observed-only attribution remains low confidence and monitor only", () => {
  const result = evaluateLearningRecommendation(recommendation({ attributionGrade: "Observed", confounders: ["Seasonality", "Overlapping enterprise arrival"] }), approvedPolicy)
  assert.equal(result.confidence, "Low")
  assert.equal(result.autoAdoptPermitted, false)
  assert.equal(result.requiredDisposition, "Monitor only")
  assert.equal(result.attributionLabel, "Observed only · confounders not ruled out")
})

test("medium-confidence evidence requires human sign-off", () => {
  const result = evaluateLearningRecommendation(recommendation({ evidenceCycles: 2 }), approvedPolicy)
  assert.equal(result.confidence, "Medium")
  assert.equal(result.requiredDisposition, "Human sign-off")
})

test("a recommendation cannot auto-adopt without a rollback trigger", () => {
  const result = evaluateLearningRecommendation(recommendation({ rollbackTrigger: null }), approvedPolicy)
  assert.equal(result.confidence, "High")
  assert.equal(result.autoAdoptPermitted, false)
  assert.equal(result.requiredDisposition, "Monitor only")
})

test("leading indicators must be wired or retired inside one planning cycle", () => {
  const input = { signalId: "SIGNAL-NPS-READ-001", domain: "Member NPS", ownerRole: "Member Engagement JCO", intendedActionConnection: "Validate whether message disengagement predicts a verified service failure.", reviewAt: "2026-07-24T10:00:00+05:30", retireAt: "2026-07-31T18:00:00+05:30", planningCycleEndsAt: "2026-07-31T23:59:59+05:30" }
  const signal = parkMonitoredSignal(input)
  assert.equal(signal.state, "Monitored signal")
  assert.throws(() => parkMonitoredSignal({ ...input, retireAt: "2026-08-01T00:00:00+05:30" }), /within one governed planning cycle/)
})
