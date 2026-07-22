import { test } from "node:test"
import assert from "node:assert/strict"
import { measureViz } from "./measure-viz"

test("ratio values render as a fraction bar using only the value", () => {
  const viz = measureViz("11/14", "3 awaiting")
  assert.deepEqual(viz, { kind: "fraction", fillPct: (11 / 14) * 100, caption: "3 awaiting" })
})

test("fraction bar caption falls back to N of M when target is empty", () => {
  const viz = measureViz("7/18", "")
  assert.equal(viz?.kind, "fraction")
  assert.equal(viz?.caption, "7 of 18")
})

test("percent value and percent reference render a comparison with a marker", () => {
  const viz = measureViz("64%", "65% floor")
  assert.equal(viz?.kind, "compare")
  if (viz?.kind !== "compare") return
  // scale = max(64,65)*1.25 = 81.25
  assert.ok(Math.abs(viz.fillPct - (64 / 81.25) * 100) < 1e-9)
  assert.ok(Math.abs(viz.markerPct - (65 / 81.25) * 100) < 1e-9)
  assert.equal(viz.caption, "65% floor")
})

test("currency value and currency cap render a comparison", () => {
  const viz = measureViz("₹54L forecast", "₹60L cap")
  assert.equal(viz?.kind, "compare")
})

test("thousands separators parse correctly", () => {
  const viz = measureViz("₹1,435", "₹1,500 control")
  assert.equal(viz?.kind, "compare")
})

test("non-numeric value cannot be charted", () => {
  assert.equal(measureViz("Pending approval", "Verified projection Jan 2026"), null)
})

test("non-numeric target with numeric value cannot be compared", () => {
  assert.equal(measureViz("64%", "Coromandel cohort"), null)
})

test("bare counts with different nouns do not chart as a comparison", () => {
  // "2 open" vs "2 verified" share no unit, so comparing them is meaningless.
  assert.equal(measureViz("2 open", "2 verified"), null)
  assert.equal(measureViz("14 interventions", "7 recovered"), null)
})
