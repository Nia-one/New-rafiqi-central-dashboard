import assert from "node:assert/strict"
import test from "node:test"
import { attachSlope, cmBridge, EDITORIAL_CHART_COPY, livingComparison, networkAverage, peopleInterventions, studioArpu } from "./editorial-charts"

test("Living contains all approved rows, values and gaps", () => assert.deepEqual(livingComparison, [
  { label: "Demand contracted", actual: 862, plan: 1050, gap: 188 },
  { label: "Capacity live", actual: 920, plan: 950, gap: 30 },
  { label: "Members active", actual: 2314, plan: 2500, gap: 186 },
]))
test("Essentials preserves exact title and progression", () => { assert.equal(EDITORIAL_CHART_COPY.essentials.title, "Attach rose by 2 percentage points this block. It is still 4 percentage points below plan."); assert.deepEqual(attachSlope, [{ label: "Previous block", value: 39 }, { label: "Current", value: 41 }, { label: "Plan", value: 45 }]) })
test("CM bridge contains only approved categories", () => { assert.deepEqual(cmBridge, [{ label: "CM1", value: 1610000 }, { label: "Utilities", value: -250000 }, { label: "CM2", value: 1360000 }]); assert.doesNotMatch(JSON.stringify(cmBridge), /Landed|Revenue quality|Attach lift|Operating gap|Current CM/) })
test("Theatre ARPU has three canonical rows and a typed network reference", () => { assert.deepEqual(studioArpu, [
  { theatre: "Rajputana", value: 1806, kind: "theatre" },
  { theatre: "Coromandel", value: 1721, kind: "theatre" },
  { theatre: "Wellington", value: 1688, kind: "theatre" },
]); assert.deepEqual(networkAverage, { label: "Network average", value: 1742, kind: "reference" }); assert.equal(studioArpu.some(row => String(row.theatre) === networkAverage.label), false) })
test("People totals ten with exact composition", () => { assert.deepEqual(peopleInterventions, [{ label: "Current", value: 5, percent: 50 }, { label: "Stalled", value: 3, percent: 30 }, { label: "Stale", value: 2, percent: 20 }]); assert.equal(peopleInterventions.reduce((sum, row) => sum + row.value, 0), 10); assert.doesNotMatch(JSON.stringify({ peopleInterventions, copy: EDITORIAL_CHART_COPY.people }), /Critical|Behind/) })
test("approved correction titles and takeaways are exact", () => { assert.equal(EDITORIAL_CHART_COPY.living.title, "Demand is the largest gap to plan."); assert.equal(EDITORIAL_CHART_COPY.cmBridge.title, "Utilities reduce CM by ₹2.5L between CM1 and CM2."); assert.equal(EDITORIAL_CHART_COPY.arpu.title, "Rajputana has the highest ARPU. Wellington is ₹54 below the network average."); assert.equal(EDITORIAL_CHART_COPY.people.title, "5 of 10 named people need attention."); assert.equal(EDITORIAL_CHART_COPY.people.takeaway, "Vikram Singh is the stalled RM shown here.") })
test("every editorial chart explains what the reader should see", () => {
  for (const copy of Object.values(EDITORIAL_CHART_COPY)) {
    assert.ok(copy.title.length > 0)
    assert.ok(copy.reads.length > 40)
    assert.ok(copy.takeaway.length > 0)
  }
})
