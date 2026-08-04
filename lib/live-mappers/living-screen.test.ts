import assert from "node:assert/strict"
import test from "node:test"
import { buildLivingScreenData } from "./living-screen"

test("Living occupancy is sourced from EXISTING Studios and excludes FONO/SP", () => {
  const result = buildLivingScreenData({
    living: [
      { "studio id": "Existing A", "theatre id": "North", "supply model": "EXISTING", "contracted nests": 100, "occupied nests": 80 },
      { "studio id": "FONO A", "theatre id": "North", "supply model": "FONO", "contracted nests": 50, "occupied nests": 20 },
    ],
  })

  assert.equal(result.occupancyContracted, 100)
  assert.equal(result.occupancyOccupied, 80)
  assert.equal(result.occupancyPercent, 80)
  assert.deepEqual(result.occupancyRows[0].slice(0, 6), ["Existing A", "North", "100", "80", "80%", "20"])
})

test("FONO and Śram Park demand pipelines remain independent", () => {
  const result = buildLivingScreenData({
    people: [
      { "actor id": "FONO-JCO", "display name": "FONO Acquirer" },
      { "actor id": "SP-JCO", "display name": "SP JCO" },
    ],
    enterpriseDemand: [
      { "demand id": "OPS-RPT-FONO-1", status: "Lead", "headcount required": 100, "owner actor id": "FONO-JCO" },
      { "demand id": "OPS-RPT-FONO-2", status: "Contracting", "headcount required": 80, "owner actor id": "FONO-JCO" },
      { "demand id": "OPS-RPT-FONO-3", status: "Contracted", "headcount required": 60, "owner actor id": "FONO-JCO" },
      { "demand id": "OPS-RPT-FONO-4", status: "Dropped", "headcount required": 40, "owner actor id": "FONO-JCO" },
      { "demand id": "SP-BOT-1", status: "Lead", "headcount required": 500, "owner actor id": "SP-JCO", "plant name": "Plant A" },
      { "demand id": "SP-BOT-2", status: "Contracting", "headcount required": 600, "owner actor id": "SP-JCO", "plant name": "Plant B" },
      { "demand id": "MANUAL-OTHER", status: "Lead", "headcount required": 999 },
    ],
  })

  assert.deepEqual(result.fonoPipeline.stageCounts.map(({ stage, count, requirement }) => [stage, count, requirement]), [
    ["Lead", 1, 100], ["Contracting", 1, 80], ["Contracted", 1, 60], ["Dropped", 1, 40],
  ])
  assert.deepEqual(result.spPipeline.stageCounts.map(({ stage, count }) => [stage, count]), [
    ["Lead", 1], ["Contracting", 1], ["Contracted", 0], ["Dropped", 0],
  ])
  assert.equal(result.demandRows.length, 2)
  assert.equal(result.demandRequired, 1100)
  assert.equal(result.fonoPipeline.byOwner[0].owner, "FONO Acquirer")
  assert.equal(result.spPipeline.byOwner[0].owner, "SP JCO")
})
