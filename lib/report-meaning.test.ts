import assert from "node:assert/strict"
import test from "node:test"
import {
  buildReport,
  isActionTitle,
  describeTitleIssue,
  assertSoWhat,
  readThrough,
  REPORT_ACTION_VERBS,
  type ReportConfig,
} from "@/lib/report-meaning"

const ISO = "2026-07-18T12:00:00.000Z"

function validReport(): ReportConfig {
  return {
    peak: {
      objective: "Hold blended CM2 above the 22% floor across all Theatres this quarter.",
      situation: "CM2 is tracking at 21.3% blended, 0.7pp under the quarter floor.",
      complication: "South and West slipped below 78% occupancy for two cycles, dragging contribution.",
      recommendation: "Approve the 2-week occupancy recovery playbook for South and West Theatres.",
      ask: "Approve ₹4.2L of recovery spend for South and West before 18:00 today.",
      owner: "Priya · Ops Lead",
      dueDate: "Today 18:00",
      asOf: ISO,
      tone: "breach",
    },
    accordions: [
      {
        id: "restore-occupancy",
        actionTitle: "Restore South Theatre occupancy to the 78% floor within 2 weeks",
        soWhat: "South has been below floor for two cycles, the largest single drag on CM2.",
        tone: "critical",
        owner: "Ops · South",
        dueDate: "Fri",
        evidence: [
          {
            id: "occupancy-metrics",
            chartType: "metric",
            dataSource: "static",
            soWhat: "Occupancy fell 6 points while the target held, so the gap is demand-side.",
            sourceLabel: "Ops occupancy ledger",
            pulledAt: ISO,
            metrics: [
              { label: "Occupancy", value: "71%", delta: "-6 pts", tone: "critical" },
              { label: "CM2 at risk", value: "₹4.2L" },
            ],
          },
          {
            id: "occupancy-by-nest",
            chartType: "bar",
            dataSource: "static",
            soWhat: "Three nests carry the entire South shortfall.",
            sourceLabel: "Nest occupancy feed",
            pulledAt: ISO,
            tone: "critical",
            series: { unit: "%", points: [ { label: "Nest 12", value: 62 }, { label: "Nest 19", value: 58 } ] },
          },
        ],
      },
      {
        id: "chase-fill",
        actionTitle: "Chase the 3 overdue fill tasks in West Theatre by Friday",
        soWhat: "The fill deadline passed with no owner response, blocking recovery.",
        evidence: [
          {
            id: "fill-table",
            chartType: "table",
            dataSource: "live",
            soWhat: "Three nests account for the entire West shortfall.",
            sourceLabel: "Fill tracker",
            pulledAt: ISO,
            endpoint: "/report-kit-preview/api/pulse?exhibit=fill",
            refreshInterval: 15000,
            table: {
              caption: "West shortfall by nest",
              columns: ["NEST", "TARGET", "ACTUAL"],
              rows: [ ["Nest 12", "40", "22"], ["Nest 19", "35", "18"] ],
            },
          },
        ],
      },
      {
        id: "cut-spend",
        actionTitle: "Cut controllable spend by ₹1.8L to protect the CM2 floor",
        soWhat: "Controllable spend can absorb most of the CM2 gap without touching supply.",
        evidence: [
          {
            id: "cm2-trend",
            chartType: "line",
            dataSource: "static",
            soWhat: "CM2 has fallen four weeks running and is now under the floor.",
            sourceLabel: "Finance CM2 model",
            pulledAt: ISO,
            series: { unit: "%", points: [ { label: "W1", value: 23.1 }, { label: "W2", value: 22.6 }, { label: "W3", value: 21.9 }, { label: "W4", value: 21.3 } ] },
          },
        ],
      },
    ],
  }
}

test("action titles: accepts complete, quantified imperatives", () => {
  assert.ok(isActionTitle("Restore South Theatre occupancy to the 78% floor"))
  assert.ok(isActionTitle("Cut controllable spend by ₹1.8L this week"))
  assert.ok(isActionTitle("Chase the 3 overdue fill tasks by Friday"))
  assert.ok(isActionTitle("Recover 4 pts of occupancy in South Theatre"))
  assert.ok(REPORT_ACTION_VERBS.has("restore"))
})

test("action titles: rejects topics, fragments and unquantified instructions", () => {
  // topic / noun phrase — no imperative verb
  assert.equal(isActionTitle("Occupancy trends"), false)
  assert.equal(describeTitleIssue("Q3 revenue summary"), "is a topic, not an action; lead with an imperative verb")
  // too short to name an object
  assert.equal(describeTitleIssue("Reduce costs"), "is not a complete action sentence; name what to act on")
  // complete and imperative, but not measurable
  assert.equal(describeTitleIssue("Restore occupancy across the southern Theatres"), "is not quantified; state the magnitude, target or count")
  assert.equal(describeTitleIssue("Review the occupancy dashboard regularly"), "is not quantified; state the magnitude, target or count")
  // empty
  assert.equal(describeTitleIssue(""), "requires an action title")
  assert.equal(isActionTitle(""), false)
})

test("the So What gate throws on missing meaning", () => {
  assert.throws(() => assertSoWhat("", "metric"), /must state a "So What"/)
  assert.throws(() => assertSoWhat("   ", "metric"), /must state a "So What"/)
  assert.equal(assertSoWhat(" Recoverable margin ", "metric"), "Recoverable margin")
})

test("buildReport accepts a well-formed report and deep-freezes it", () => {
  const report = buildReport(validReport())
  assert.equal(report.accordions.length, 3)
  assert.ok(Object.isFrozen(report))
  assert.ok(Object.isFrozen(report.accordions))
  assert.ok(Object.isFrozen(report.accordions[0]))
  assert.ok(Object.isFrozen(report.accordions[0].evidence[0]))
  assert.ok(Object.isFrozen(report.accordions[0].evidence[0].metrics))
  assert.ok(Object.isFrozen(report.accordions[2].evidence[0].series))
})

test("buildReport rejects a topic title", () => {
  const bad = validReport()
  bad.accordions[0].actionTitle = "Occupancy overview across Theatres"
  assert.throws(() => buildReport(bad), /is a topic, not an action/)
})

test("buildReport rejects an unquantified title", () => {
  const bad = validReport()
  bad.accordions[0].actionTitle = "Restore occupancy across the southern Theatres"
  assert.throws(() => buildReport(bad), /is not quantified/)
})

test("buildReport rejects an incomplete title", () => {
  const bad = validReport()
  bad.accordions[0].actionTitle = "Cut ₹1.8L"
  assert.throws(() => buildReport(bad), /is not a complete action sentence/)
})

test("buildReport rejects an accordion with no So What", () => {
  const bad = validReport()
  bad.accordions[0].soWhat = ""
  assert.throws(() => buildReport(bad), /must state a "So What"/)
})

test("the Peak requires the full SCR narrative, Ask, owner and due date", () => {
  for (const field of ["objective", "situation", "complication", "recommendation", "ask", "owner", "dueDate"] as const) {
    const bad = validReport()
    bad.peak[field] = ""
    assert.throws(() => buildReport(bad), new RegExp(`Report peak requires`), `expected peak.${field} to be required`)
  }
  const badAsOf = validReport()
  badAsOf.peak.asOf = "not-a-date"
  assert.throws(() => buildReport(badAsOf), /valid as-of timestamp/)
})

test("evidence provenance is mandatory: sourceLabel and a valid pulledAt", () => {
  const noSource = validReport()
  noSource.accordions[0].evidence[0].sourceLabel = ""
  assert.throws(() => buildReport(noSource), /requires a sourceLabel/)

  const badPulled = validReport()
  badPulled.accordions[0].evidence[0].pulledAt = "nope"
  assert.throws(() => buildReport(badPulled), /valid pulledAt/)
})

test("evidence data-source wiring is enforced", () => {
  // static must not declare live wiring
  const staticWithEndpoint = validReport()
  staticWithEndpoint.accordions[0].evidence[0].endpoint = "/x"
  assert.throws(() => buildReport(staticWithEndpoint), /must not declare a live endpoint/)

  // live must declare an endpoint
  const liveNoEndpoint = validReport()
  liveNoEndpoint.accordions[1].evidence[0].endpoint = ""
  assert.throws(() => buildReport(liveNoEndpoint), /must declare an endpoint/)

  // live must declare a positive refreshInterval
  const liveNoInterval = validReport()
  delete liveNoInterval.accordions[1].evidence[0].refreshInterval
  assert.throws(() => buildReport(liveNoInterval), /positive refreshInterval/)
})

test("evidence payload must match its chartType and stay well-formed", () => {
  const metricNoData = validReport()
  metricNoData.accordions[0].evidence[0].metrics = []
  assert.throws(() => buildReport(metricNoData), /requires at least one metric/)

  const barNoSeries = validReport()
  delete barNoSeries.accordions[0].evidence[1].series
  assert.throws(() => buildReport(barNoSeries), /requires a series/)

  const raggedTable = validReport()
  raggedTable.accordions[1].evidence[0].table!.rows = [["Nest 12", "40"]]
  assert.throws(() => buildReport(raggedTable), /row width must match/)
})

test("buildReport requires unique accordion ids", () => {
  const dupe = validReport()
  dupe.accordions[1].id = dupe.accordions[0].id
  assert.throws(() => buildReport(dupe), /ids must be unique/)
})

test("readThrough returns the recommendation followed by every quantified action title", () => {
  const report = buildReport(validReport())
  const lines = readThrough(report)
  assert.equal(lines.length, 4)
  assert.equal(lines[0], report.peak.recommendation)
  for (const line of lines.slice(1)) assert.ok(isActionTitle(line), `read-through line is not an action: "${line}"`)
})
