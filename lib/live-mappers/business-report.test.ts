import assert from "node:assert/strict"
import test from "node:test"
import { buildBusinessReportData } from "./business-report"

test("Business Report projects the governed Shram Park lane as Enterprise Demand and never labels it BD", () => {
  const report = buildBusinessReportData({
    living: [{ "studio id": "A", "theatre id": "RN", "supply model": "EXISTING", "contracted nests": 100, "occupied nests": 90 }],
    enterpriseDemand: [
      { "demand id": "SP-BOT-1", status: "Lead", "theatre id": "DCN", "headcount required": 1 },
      { "demand id": "SP-BOT-2", status: "Interested", "theatre id": "DCN", "headcount required": 1 },
      { "demand id": "SP-BOT-3", status: "Closed", "theatre id": "WLG", "headcount required": 1 },
      { "demand id": "FONO-1", status: "Contracted", "theatre id": "RJT", "headcount required": 32 },
    ],
    enterpriseWorkspaceDemand: [
      { "demand id": "UI-ENTERPRISE-DEMAND-1", status: "Lead", "theatre id": "DCN", "headcount required": 1 },
      { "demand id": "UI-ENTERPRISE-DEMAND-2", status: "Interested", "theatre id": "DCN", "headcount required": 1 },
      { "demand id": "UI-ENTERPRISE-DEMAND-3", status: "Closed", "theatre id": "WLG", "headcount required": 1 },
    ],
    essentials: [{ "theatre id": "TH-RJT", "eligible members": 10, "buying members": 4, "essentials billed inr": 1000, "studio revenue inr": 20000, "nia margin inr": 100, "member savings inr": 50, "curry unique members": 2, "curry buying value inr": 300, "internet equipment unique members": 1, "internet equipment buying value inr": 200 }],
  })
  assert.equal(report.occupancy.percent, 90)
  assert.deepEqual(report.enterprise.stages, { Lead: 1, Interested: 1, "Proposal Sent": 0, Contracting: 0, Contracted: 0 })
  assert.equal(report.enterprise.records, 3)
  assert.deepEqual(report.fono.stages, { Lead: 0, Contracting: 0, Contracted: 32 })
  assert.deepEqual(report.fono.byTheatre, [{ theatre: "Rajputana", Lead: 0, Contracting: 0, Contracted: 32, total: 32 }])
  assert.equal(report.essentials.attachPct, 70)
  assert.equal(report.essentials.byTheatre[0]?.theatre, "Rajputana")
  assert.equal(report.essentials.byTheatre[0]?.attachRevenuePct, 7.5)
  assert.equal(report.essentials.revenue, 1500)
  assert.equal(report.essentials.curryBuyingValue, 300)
  assert.equal(report.essentials.internetEquipmentUniqueMembers, 1)
  assert.equal(JSON.stringify(report).includes('"BD"'), false)
})

test("Business Report keeps missing pipeline CM unavailable instead of inventing a value", () => {
  const report = buildBusinessReportData({ work: [{ "work billed inr": 5000 }], essentials: [] })
  assert.equal(report.contribution.pipelineRecorded, false)
  assert.equal(report.contribution.pipeline, 0)
  assert.equal(report.projectedRevenue, 5000)
})

test("Business Report combines automated Living CM with governed CM Actions actuals and pipeline", () => {
  const report = buildBusinessReportData({
    finance: [{ "theatre id": "RJT", "total billed inr": 8_779_050, "living cm2 inr": 1_433_400 }],
    actionLog: [
      { "action id": "OPS-RPT-CM-COMP-LIVING", "operating objective": "Living", "expected metric": "CM Actual", "baseline value": 1_433_400, "target value": 8_779_050 },
      { "action id": "OPS-RPT-CM-COMP-WORK", "operating objective": "Work", "expected metric": "CM Actual", "baseline value": 500_000, "target value": 500_000 },
      { "action id": "OPS-RPT-CM-COMP-B2B", "operating objective": "B2B", "expected metric": "CM Actual", "baseline value": 0, "target value": 0 },
      { "action id": "OPS-RPT-CM-COMP-ITC", "operating objective": "ITC", "expected metric": "CM Pipeline", "baseline value": 600_000, "target value": 2_000_000 },
    ],
  })
  assert.equal(report.contribution.actual, 1_933_400)
  assert.equal(report.contribution.pipeline, 600_000)
  assert.equal(report.contribution.pipelineRecorded, true)
  assert.equal(report.projectedRevenue, 11_279_050)
})

test("Business Report counts a governed FONO demand ID once across case-variant live payloads", () => {
  const report = buildBusinessReportData({
    enterpriseDemand: [
      { "demand id": "FONO-TRACKER-ABC", status: "Contracted", "headcount required": 32 },
      { "demand id": "fono-tracker-abc", status: "Contracted", "headcount required": 32 },
      { "demand id": "FONO-TRACKER-DEF", status: "Contracting", "headcount required": 240 },
      { "demand id": "fono-tracker-def", status: "Contracting", "headcount required": 240 },
      { "demand id": "FONO-TRACKER-GHI", status: "Lead", "headcount required": 1110 },
      { "demand id": "fono-tracker-ghi", status: "Lead", "headcount required": 1110 },
    ],
  })
  assert.deepEqual(report.fono.stages, { Lead: 1110, Contracting: 240, Contracted: 32 })
})

test("Business Report places recorded Living CM beside occupancy by Theatre", () => {
  const report = buildBusinessReportData({
    living: [
      { "studio id": "ST-RJT", "theatre id": "RJT", "contracted nests": 10, "occupied nests": 9 },
      { "studio id": "ST-WLG", "theatre id": "WLG", "contracted nests": 10, "occupied nests": 8 },
    ],
    finance: [
      { "studio id": "ST-RJT", "living cm2 inr": 680000, "cm2 inr": 999999 },
      { "studio id": "ST-WLG", "living cm2 inr": 392000, "cm2 inr": 999999 },
    ],
  })
  assert.equal(report.contribution.living, 1_072_000)
  assert.deepEqual(report.contribution.livingByTheatre, [
    { theatre: "Rajputana", cmInr: 680000 },
    { theatre: "Wellington", cmInr: 392000 },
  ])
})

test("Business Report uses raw Proposal / Quote as Proposal Sent over a stale normalized status", () => {
  const report = buildBusinessReportData({
    enterpriseDemand: [
      { "demand id": "SP-BOT-PROPOSAL", status: "Contracting", certainty: "Send Proposal / Quote", "headcount required": 1 },
    ],
  })
  assert.deepEqual(report.enterprise.stages, { Lead: 0, Interested: 0, "Proposal Sent": 1, Contracting: 0, Contracted: 0 })
})

test("Business Report breaks Enterprise Demand stages down by Theatre", () => {
  const report = buildBusinessReportData({
    enterpriseDemand: [
      { "demand id": "SP-BOT-DCN-1", "theatre id": "DCN", certainty: "Lead" },
      { "demand id": "SP-BOT-DCN-2", "theatre id": "DCN", certainty: "Propsal Sent" },
      { "demand id": "SP-BOT-WLG-1", "theatre id": "WLG", certainty: "Contracted" },
    ],
  })

  assert.deepEqual(report.enterprise.byTheatre, [
    { theatre: "Deccan", Lead: 1, Interested: 0, "Proposal Sent": 1, Contracting: 0, Contracted: 0, records: 2 },
    { theatre: "Wellington", Lead: 0, Interested: 0, "Proposal Sent": 0, Contracting: 0, Contracted: 1, records: 1 },
  ])
})

test("Business Report maps Enterprise Supply in the approved stage order and excludes Drop", () => {
  const report = buildBusinessReportData({
    enterpriseDemand: [
      { "demand id": "MEMBER-ADDS-UI-ENTERPRISE-SUPPLY-1", "source submission id": "UI-ENTERPRISE-SUPPLY-1", certainty: "Lead" },
      { "demand id": "MEMBER-ADDS-UI-ENTERPRISE-SUPPLY-2", "source submission id": "UI-ENTERPRISE-SUPPLY-2", certainty: "Interested" },
      { "demand id": "MEMBER-ADDS-UI-ENTERPRISE-SUPPLY-3", "source submission id": "UI-ENTERPRISE-SUPPLY-3", certainty: "Propsal Sent" },
      { "demand id": "MEMBER-ADDS-UI-ENTERPRISE-SUPPLY-4", "source submission id": "UI-ENTERPRISE-SUPPLY-4", certainty: "Contracting" },
      { "demand id": "MEMBER-ADDS-UI-ENTERPRISE-SUPPLY-5", "source submission id": "UI-ENTERPRISE-SUPPLY-5", certainty: "Contracted" },
      { "demand id": "MEMBER-ADDS-UI-ENTERPRISE-SUPPLY-6", "source submission id": "UI-ENTERPRISE-SUPPLY-6", certainty: "Drop" },
    ],
  })

  assert.equal(report.enterprise.supplyRecords, 6)
  assert.deepEqual(report.enterprise.supplyStages, { Lead: 1, Interested: 1, "Proposal Sent": 1, Contracting: 1, Contracted: 1 })
})
