import assert from "node:assert/strict"
import test from "node:test"
import { autonomyPoliciesAt, buildShadowAutonomyEvaluation, evaluateAutonomyReadiness } from "@/lib/operating-loop/autonomy-control"
import { POLICY_REGISTRY, type PolicyDefinition } from "@/lib/operating-loop/contracts"
import { buildControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"

test("shadow evaluation records every required feedback label and metric basis", () => {
  const { evaluation } = buildControlledAutonomyPreview()
  assert.deepEqual(evaluation.feedback.map((item) => item.label).toSorted(), ["Failed verification", "Human override", "Missed alert", "Rejected action"])
  assert.equal(evaluation.metrics.detectionPrecision, 0.75)
  assert.equal(evaluation.metrics.falsePositiveRate, 0.25)
  assert.equal(evaluation.metrics.missedEventRate, 0.25)
  assert.equal(evaluation.metrics.acceptanceRate, 0.5)
  assert.equal(evaluation.metrics.rejectionRate, 0.25)
  assert.equal(evaluation.metrics.overrideRate, 0.25)
  assert.equal(evaluation.metrics.reversalRate, 1 / 3)
  assert.equal(evaluation.metrics.auditCompleteness, 1)
  assert.equal(evaluation.metrics.verificationFailureRate, 1 / 3)
  assert.equal(evaluation.metrics.medianDecisionMinutes, 11)
  assert.equal(evaluation.metrics.medianVerificationMinutes, 28)
})

test("current governed policies block all automatic execution", () => {
  const preview = buildControlledAutonomyPreview()
  assert.equal(preview.readiness.lowRisk.thresholdsAgreed, false)
  assert.equal(preview.readiness.lowRisk.automaticExecutionPermitted, false)
  assert.equal(preview.readiness.highRisk.automaticExecutionPermitted, false)
  assert.equal(preview.policies.minimumPrecision.value, "Not agreed")
  assert.equal(preview.policies.killSwitch.value, "Engaged")
})

test("agreed and met thresholds can permit only controlled low-risk policy eligibility", () => {
  const replacements: Record<string, string | number> = {
    "POL-AUTONOMY-MODE": "Controlled low risk",
    "POL-AUTONOMY-PRECISION-GATE": 0.7,
    "POL-AUTONOMY-REVERSAL-GATE": 0.4,
    "POL-AUTONOMY-AUDIT-GATE": 0.95,
    "POL-AUTONOMY-KILL-SWITCH": "Disengaged",
  }
  const registry: readonly PolicyDefinition[] = POLICY_REGISTRY.map((policy) => replacements[policy.policyId] === undefined ? policy : { ...policy, value: replacements[policy.policyId] })
  const policies = autonomyPoliciesAt("2026-07-17T08:00:00+05:30", registry)
  const metrics = buildControlledAutonomyPreview().evaluation.metrics
  assert.equal(evaluateAutonomyReadiness(metrics, ["operational"], policies).automaticExecutionPermitted, true)
  const highRisk = evaluateAutonomyReadiness(metrics, ["money"], policies)
  assert.equal(highRisk.automaticExecutionPermitted, false)
  assert.equal(highRisk.requiredHumanApprover, "Pushkar")
  assert.match(highRisk.reasons.join(" "), /human-approved permanently/i)
})

test("shadow evaluation rejects missing lineage and broken audit links", () => {
  assert.throws(() => buildShadowAutonomyEvaluation({
    expectedSignals: [],
    recommendations: [{ recommendationId: "REC-BROKEN", expectedSignalId: "SIG-UNKNOWN", domain: "Test", title: "Broken", rationale: "Broken link", agentVersion: "test", recommendedAt: "2026-07-17T07:00:00+05:30", governedChanges: ["operational"], sourceRefs: ["protected://test/recommendation"] }],
    decisions: [],
    dispositions: [],
    recordedAt: "2026-07-17T08:00:00+05:30",
  }), /unknown expected signal/)
  assert.throws(() => buildShadowAutonomyEvaluation({
    expectedSignals: [],
    recommendations: [{ recommendationId: "REC-NO-SOURCE", expectedSignalId: null, domain: "Test", title: "No source", rationale: "Missing lineage", agentVersion: "test", recommendedAt: "2026-07-17T07:00:00+05:30", governedChanges: ["operational"], sourceRefs: [] }],
    decisions: [],
    dispositions: [],
    recordedAt: "2026-07-17T08:00:00+05:30",
  }), /requires source lineage/)
})

test("evaluation records and audit collections are immutable snapshots", () => {
  const preview = buildControlledAutonomyPreview()
  assert.equal(Object.isFrozen(preview.evaluation), true)
  assert.equal(Object.isFrozen(preview.evaluation.feedback), true)
  assert.equal(Object.isFrozen(preview.evaluation.comparisons), true)
  assert.equal(Object.isFrozen(preview.evaluation.comparisons[0]?.recommendation.sourceRefs), true)
  assert.throws(() => (preview.evaluation.feedback as unknown as Array<unknown>).push({}), TypeError)
})
