import assert from "node:assert/strict"
import test from "node:test"
import { APPROVED_SPINE_LABELS, blockChanges, formatBlockChange, formatSpineValue, opsData, trajectory } from "./ops-data"

test("operating spine has the approved labels, units and illustrative fallback values", () => {
  assert.deepEqual(opsData.spine.map((metric) => metric.label), [...APPROVED_SPINE_LABELS])
  assert.deepEqual(opsData.spine.map((metric) => metric.actual), [862, 920, 2314, 41, 1742, 1360000])
  const attach = opsData.spine.find((metric) => metric.id === "attach")
  assert.equal(attach?.unit, "percent")
  assert.equal(attach?.plan, 45)
  const arpu = opsData.spine.find((metric) => metric.id === "arpu")!
  const cm = opsData.spine.find((metric) => metric.id === "cm")!
  assert.equal(formatSpineValue(arpu), "₹1,742")
  assert.equal(formatSpineValue(cm), "₹13.6L")
})

test("previous-block deltas retain member and percentage-point semantics", () => {
  assert.equal(opsData.previousBlock.membersActive, 2305)
  assert.equal(opsData.previousBlock.attach, 39)
  const changes = blockChanges()
  const members = changes.find((change) => change.label === "Members active")!
  const attach = changes.find((change) => change.label === "Attach")!
  assert.equal(members.value, 9)
  assert.equal(formatBlockChange(members), "9")
  assert.equal(attach.value, 2)
  assert.equal(formatBlockChange(attach), "2pp")
})

test("monthly target path is monotonic and lands on the full-month target", () => {
  const run = trajectory()
  run.points.slice(1).forEach((point, index) => assert.ok(point.target >= run.points[index].target))
  assert.equal(run.points.at(-1)?.target, opsData.monthlyCMTarget)
})

test("projection starts at latest actual and remains monotonic", () => {
  const run = trajectory()
  const projected = run.points.filter((point) => point.projection !== null)
  assert.equal(projected[0].projection, run.current)
  projected.slice(1).forEach((point, index) => assert.ok(point.projection! >= projected[index].projection!))
  assert.equal(projected.at(-1)?.projection, opsData.monthEndProjection)
  assert.equal(run.current, 1360000)
  assert.equal(run.projection, 3240000)
  assert.equal(opsData.monthlyCMTarget, 4000000)
  assert.equal(Math.round(run.askRate / 10000) * 10000, 150000)
  assert.equal(run.askRateMultiple, 1.4)
  assert.equal(run.points.find((point) => point.day === 13)?.actual, 1360000)
  assert.equal(run.points.at(-1)?.day, 31)
})
