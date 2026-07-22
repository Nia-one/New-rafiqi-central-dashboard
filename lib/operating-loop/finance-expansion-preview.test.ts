import assert from "node:assert/strict"
import test from "node:test"
import { FINANCIAL_APPROVAL_CATEGORIES } from "@/lib/operating-loop/finance-control"
import { buildFinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"

test("Phase 3 Preview exposes governed comparisons, locked controls, and no execution permission", () => {
  const preview = buildFinanceExpansionPreview()
  assert.equal(preview.mode, "Shadow mode")
  assert.equal(preview.writesEnabled, false)
  assert.equal(preview.policies.monthlyOpexCap.value, 6_000_000)
  assert.equal(preview.policies.minimumCash.value, 15_000_000)
  assert.equal(preview.policies.hiringState.value, "Frozen")
  assert.equal(preview.selectedStudioId, "ST-ORA-01")
  assert.equal(preview.options[0].upfrontCapitalInr, 1_870_000)
  assert.equal(preview.options[0].projected90DayContributionMarginInr, 216_000)
  assert.deepEqual(preview.guardrails.breaches.map((breach) => breach.kind), ["Opex forecast breach", "Cash guardrail breach"])
  assert.equal(preview.guardrails.executionPermitted, false)
})

test("Phase 3 Preview covers every Pushkar approval category and governed War Room route", () => {
  const preview = buildFinanceExpansionPreview()
  assert.deepEqual(preview.approvals.map((approval) => approval.category), [...FINANCIAL_APPROVAL_CATEGORIES])
  assert.ok(preview.approvals.every((approval) => approval.approver === "Pushkar" && approval.protectedEvidenceRefs.length === 1))
  assert.deepEqual(preview.studioHealth.map((assessment) => assessment.status), ["Red", "Amber", "Green"])
  assert.deepEqual(preview.warRoomCases.map((warRoomCase) => warRoomCase.state), ["Closed", "Assigned", "Assigned"])
  assert.equal(preview.projection.eventType, "finance.war-room-closure.verified")
  assert.equal(preview.projection.result, "Verified closure")
  assert.equal(Object.isFrozen(preview.projection), true)
})
