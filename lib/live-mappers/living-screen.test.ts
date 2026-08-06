import assert from "node:assert/strict"
import test from "node:test"
import { buildLivingScreenData } from "./living-screen"

test("Living channel occupancy excludes the independent EXISTING snapshot", () => {
  const result = buildLivingScreenData({
    living: [
      { "studio id": "Existing A", "theatre id": "North", "supply model": "EXISTING", "contracted nests": 100, "occupied nests": 80 },
      { "studio id": "FONO A", "theatre id": "North", "supply model": "FONO", "contracted nests": 50, "occupied nests": 20 },
    ],
  })

  assert.equal(result.occupancyContracted, 50)
  assert.equal(result.occupancyOccupied, 20)
  assert.equal(result.occupancyPercent, 40)
  assert.equal(result.existingContracted, 100)
  assert.equal(result.existingOccupied, 80)
  assert.deepEqual(result.occupancyRows[0].slice(0, 6), ["FONO A", "North", "50", "20", "40%", "30"])
  assert.deepEqual(result.existingOccupancyRows[0].slice(0, 6), ["Existing A", "North", "100", "80", "20", "80%"])
})

test("Living keeps SP demand separate from supply when hourly has no governed SP capacity", () => {
  const result = buildLivingScreenData({
    living: [{ "studio id": "Existing A", "supply model": "EXISTING", "contracted nests": 100, "occupied nests": 80 }],
    enterpriseDemand: [
      { "demand id": "FONO-TRACKER-1", "headcount required": 200, "headcount matched": 75 },
      { "demand id": "SP-BOT-1", "headcount required": 20, "headcount matched": 5 },
    ],
  })

  assert.equal(result.fonoSupply[0].mtd, 200)
  assert.equal(result.fonoReady, 75)
  assert.equal(result.demandRequired, 20)
  assert.equal(result.demandMatched, 5)
  assert.equal(result.spContracted, 0)
  assert.equal(result.spReady, 0)
  assert.equal(result.spOccupied, 0)
  assert.equal(result.occupancyContracted, 200)
  assert.equal(result.occupancyOccupied, 75)
  assert.equal(result.existingContracted, 100)
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

test("FONO Stage After uses Nests Potential and treats takeover-pending as contracted supply", () => {
  const result = buildLivingScreenData({
    living: [{ "living hourly id": "FONO-TRACKER-LIVING-1", "studio id": "ST-1", "studio name": "Studio One", "supply model": "FONO", "contracted nests": 887, "activation ready nests": 887, "occupied nests": 52, "owner actor id": "Srinivas" }],
    enterpriseDemand: [
      { "demand id": "FONO-TRACKER-1", status: "Onboarded (Takeover Pending)", "headcount required": 887, "headcount matched": 887 },
      { "demand id": "FONO-TRACKER-2", status: "Lead", "headcount required": 4474, "headcount matched": 0 },
      { "demand id": "FONO-TRACKER-3", status: "Contracting", "headcount required": 264, "headcount matched": 0 },
    ],
  })

  assert.deepEqual(result.fonoRequirementStages.map(({ label, mtd }) => [label, mtd]), [["Lead", 4474], ["Contracting", 264], ["Contracted", 887], ["Dropped", 0]])
  assert.equal(result.fonoSupply[0].mtd, 887)
  assert.equal(result.fonoStudioCount, 1)
  assert.equal(result.occupancyRows[0][0], "Studio One")
})

test("Collections roll up company-wide but only join a Living channel by governed Studio ID", () => {
  const result = buildLivingScreenData({
    living: [
      { "studio id": "FONO-1", "supply model": "FONO", "contracted nests": 10, "activation ready nests": 10, "occupied nests": 8 },
      { "studio id": "EXISTING-1", "supply model": "EXISTING", "contracted nests": 20, "occupied nests": 15 },
    ],
    finance: [
      { "finance daily id": "UI-COLL-1", "studio id": "FONO-1", "total billed inr": 1000, "total collected inr": 700, "current due inr": 300, "reconciliation status": "Partially Collected" },
      { "finance daily id": "UI-COLL-2", "studio id": "EXISTING-1", "total billed inr": 2000, "total collected inr": 500, "current due inr": 1500, "reconciliation status": "Overdue" },
      { "finance daily id": "UI-FIN-1", "studio id": "FONO-1", "total billed inr": 9999, "current due inr": 9999 },
    ],
  })

  assert.deepEqual(result.collection, { rowCount: 2, billed: 3000, collected: 1200, due: 1800, openCount: 2, overdueCount: 1 })
  assert.deepEqual(result.fonoCollection, { rowCount: 1, billed: 1000, collected: 700, due: 300, openCount: 1, overdueCount: 0 })
  assert.equal(result.spCollection.rowCount, 0)
})
