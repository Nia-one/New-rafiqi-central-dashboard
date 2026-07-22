import assert from "node:assert/strict"
import test from "node:test"
import { buildSyntheticPlatformLearningQueue, PLATFORM_LEARNING_POLICY } from "@/lib/operating-loop/platform-learning"

test("one evaluated queue covers the seven Self Drive learning domains", () => {
  const queue = buildSyntheticPlatformLearningQueue()
  assert.deepEqual(queue.map((entry) => entry.domain), ["Enterprise Demand", "New Adds", "Member Engagement", "Member Savings", "Nia Margins", "Nia Growth", "Cash & Control"])
  assert.ok(queue.every((entry) => entry.evaluation.recommendationId === entry.recommendationId))
  assert.ok(queue.every((entry) => entry.evaluation.autoAdoptPermitted === false))
})

test("pending thresholds stay pending and material proposals require human sign-off", () => {
  const queue = buildSyntheticPlatformLearningQueue()
  assert.equal(PLATFORM_LEARNING_POLICY.thresholdsApproved, false)
  assert.deepEqual(Object.values(PLATFORM_LEARNING_POLICY.thresholds), [null, null, null, null])
  assert.ok(queue.filter((entry) => entry.evaluation.material).every((entry) => entry.evaluation.requiredDisposition === "Human sign-off" && entry.authority !== "Monitor only"))
})

test("role-safe learning omits Cash & Control when finance data is unavailable", () => {
  const queue = buildSyntheticPlatformLearningQueue({ includeCashControl: false })
  assert.deepEqual(queue.map((entry) => entry.domain), ["Enterprise Demand", "New Adds", "Member Engagement", "Member Savings", "Nia Margins", "Nia Growth"])
  assert.equal(queue.some((entry) => entry.domain === "Cash & Control"), false)
})

test("domain Observed attribution crosses the shared contract without adapter drift", () => {
  const queue = buildSyntheticPlatformLearningQueue()
  const observed = queue.filter((entry) => entry.evaluation.attributionLabel.startsWith("Observed only"))
  assert.ok(observed.length > 0)
  assert.ok(observed.every((entry) => entry.evaluation.confidence === "Low" && entry.evaluation.autoAdoptPermitted === false))
  assert.ok(observed.every((entry) => entry.evaluation.attributionLabel === "Observed only · confounders not ruled out"))
})
