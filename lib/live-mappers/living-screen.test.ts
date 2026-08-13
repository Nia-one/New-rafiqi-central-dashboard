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

test("Living shows latest studio CM with explicit positive and negative signs", () => {
  const result = buildLivingScreenData({
    living: [
      { "studio id": "ST-POS", "studio name": "Positive Studio", "theatre id": "North", "supply model": "EXISTING", "contracted nests": 10, "occupied nests": 9 },
      { "studio id": "ST-NEG", "studio name": "Negative Studio", "theatre id": "North", "supply model": "EXISTING", "contracted nests": 10, "occupied nests": 8 },
      { "studio id": "ST-MISSING", "studio name": "Missing Studio", "theatre id": "North", "supply model": "EXISTING", "contracted nests": 10, "occupied nests": 7 },
    ],
    finance: [
      { "studio id": "ST-POS", "cm2 inr": 100, "updated at": "2026-08-01" },
      { "studio id": "ST-POS", "living cm2 inr": 1250, "updated at": "2026-08-02" },
      { "studio id": "ST-NEG", "living cm2 inr": -450.5, "updated at": "2026-08-02" },
    ],
  })

  assert.equal(result.existingOccupancyRows.find((row) => row[0] === "Positive Studio")?.[6], "+₹1,250")
  assert.equal(result.existingOccupancyRows.find((row) => row[0] === "Negative Studio")?.[6], "−₹450.5")
  assert.equal(result.existingOccupancyRows.find((row) => row[0] === "Missing Studio")?.[6], "No data")
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
    ["Compaign", 0, 0], ["Lead", 1, 100], ["Interested", 0, 0], ["Proposal Sent", 0, 0], ["Contracting", 1, 80], ["Contracted", 1, 60],
  ])
  assert.deepEqual(result.spPipeline.stageCounts.map(({ stage, count }) => [stage, count]), [
    ["Compaign", 0], ["Lead", 1], ["Interested", 0], ["Proposal Sent", 0], ["Contracting", 1], ["Contracted", 0],
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

  assert.deepEqual(result.fonoRequirementStages.map(({ label, mtd }) => [label, mtd]), [["Compaign", 0], ["Lead", 4474], ["Interested", 0], ["Proposal Sent", 0], ["Contracting", 264], ["Contracted", 887]])
  assert.equal(result.fonoSupply[0].mtd, 887)
  assert.equal(result.fonoStudioCount, 1)
  assert.equal(result.occupancyRows[0][0], "Studio One")
})

test("FONO report groups canonical Theatre codes and shares cumulative stage totals", () => {
  const result = buildLivingScreenData({
    enterpriseDemand: [
      { "demand id": "FONO-TRACKER-R1", "theatre id": "TH-RJT", status: "Lead", "headcount required": 100 },
      { "demand id": "FONO-TRACKER-R2", "theatre id": "RN", status: "Contracting", "headcount required": 40 },
      { "demand id": "FONO-TRACKER-W1", "theatre id": "TH-WLG", status: "Contracted", "headcount required": 32 },
      { "demand id": "FONO-TRACKER-D1", "theatre id": "TH-DCN", status: "Dropped", "headcount required": 10 },
      { "demand id": "FONO-TRACKER-C1", "plant id": "TH-CORO-Sriperumbudur-Raju", status: "Send Proposal / Quote", "headcount required": 30 },
    ],
  })

  assert.deepEqual(result.fonoPipeline.report.totals, { Lead: 130, Contracting: 40, Contracted: 32 })
  assert.deepEqual(result.fonoPipeline.report.byTheatre, [
    { theatre: "Rajputana", Lead: 100, Contracting: 40, Contracted: 0, total: 140 },
    { theatre: "Wellington", Lead: 0, Contracting: 0, Contracted: 32, total: 32 },
    { theatre: "Coromandel", Lead: 30, Contracting: 0, Contracted: 0, total: 30 },
  ])
})

test("closed Shram Park demand is excluded from the approved stage funnel", () => {
  const result = buildLivingScreenData({
    enterpriseDemand: [
      { "demand id": "SP-BOT-CLOSED", status: "Closed", "headcount required": 1 },
      { "demand id": "SP-BOT-LEAD", status: "Lead", "headcount required": 1 },
    ],
  })

  assert.deepEqual(result.demandStages.map((item) => [item.label, item.today]), [
    ["Compaign", 0], ["Lead", 1], ["Interested", 0], ["Proposal Sent", 0], ["Contracting", 0], ["Contracted", 0],
  ])
})

test("Shram Park treats the Bot's Send Proposal / Quote action as Proposal Sent even with a stale Contracting status", () => {
  const result = buildLivingScreenData({
    enterpriseDemand: [
      { "demand id": "SP-BOT-PROPOSAL", status: "Contracting", certainty: "Send Proposal / Quote", "headcount required": 1 },
    ],
  })

  assert.deepEqual(result.demandStages.map((item) => [item.label, item.today]), [
    ["Compaign", 0], ["Lead", 0], ["Interested", 0], ["Proposal Sent", 1], ["Contracting", 0], ["Contracted", 0],
  ])
})

test("Collections roll up company-wide but only join a Living channel by governed Studio ID", () => {
  const result = buildLivingScreenData({
    living: [
      { "studio id": "FONO-1", "supply model": "FONO", "contracted nests": 10, "activation ready nests": 10, "occupied nests": 8 },
      { "studio id": "EXISTING-1", "supply model": "EXISTING", "contracted nests": 20, "occupied nests": 15 },
    ],
    finance: [
      { "finance daily id": "UI-COLL-1", "studio id": "FONO-1", "total billed inr": 1000, "total collected inr": 700, "current due inr": 300, "reconciliation status": "Partially Collected" },
      { "finance daily id": "UI-COLL-2", "studio id": "EXISTING-1", "total billed inr": 2000, "total collected inr": 2500, "current due inr": 0, "reconciliation status": "Collected" },
      { "finance daily id": "UI-FIN-1", "studio id": "FONO-1", "total billed inr": 9999, "current due inr": 9999 },
    ],
  })

  assert.deepEqual(result.collection, { rowCount: 2, billed: 3000, collected: 2700, rawCollected: 3200, advance: 500, due: 300, openCount: 1, overdueCount: 0 })
  assert.deepEqual(result.fonoCollection, { rowCount: 1, billed: 1000, collected: 700, rawCollected: 700, advance: 0, due: 300, openCount: 1, overdueCount: 0 })
  assert.equal(result.spCollection.rowCount, 0)
})
