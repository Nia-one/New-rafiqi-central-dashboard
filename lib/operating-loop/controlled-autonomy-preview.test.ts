import assert from "node:assert/strict"
import test from "node:test"
import { buildControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"

test("Phase 5 Preview remains synthetic, read-only and unable to execute", () => {
  const preview = buildControlledAutonomyPreview()
  assert.equal(preview.phase, "Phase 5 only")
  assert.equal(preview.mode, "Shadow only")
  assert.equal(preview.writesEnabled, false)
  assert.equal(preview.liveReadsEnabled, false)
  assert.equal(preview.externalMessagesEnabled, false)
  assert.equal(preview.executionAdapterAvailable, false)
  assert.equal(preview.source.synthetic, true)
  assert.ok(preview.routineLoop.records.every((record) => record.managementInterventionRequired === false && record.externalMessageSent === false))
  assert.ok(preview.peopleExceptions.surfaced.every((record) => record.automaticEmploymentDecisionPermitted === false && record.externalMessagePermitted === false))
})

test("every shadow recommendation is paired with its actual human decision and final disposition", () => {
  const { comparisons } = buildControlledAutonomyPreview().evaluation
  assert.equal(comparisons.length, 4)
  assert.ok(comparisons.every((item) => item.decision !== null && item.disposition !== null))
  assert.deepEqual(comparisons.map((item) => item.decision?.outcome), ["Accepted", "Rejected", "Overridden", "Accepted"])
  assert.deepEqual(comparisons.map((item) => item.riskClass), ["Low", "Low", "Low", "High"])
})

test("system effectiveness keeps absent business-value inputs explicit", () => {
  const preview = buildControlledAutonomyPreview()
  assert.equal(preview.systemScorecard.find((item) => item.label === "Hours saved")?.value, "No data")
  assert.equal(preview.systemScorecard.find((item) => item.label === "Cost per verified outcome")?.status, "No data")
  assert.equal(preview.systemScorecard.find((item) => item.label === "Audit completeness")?.value, "100.0%")
})
