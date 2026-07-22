import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ReportHeader } from "@/components/report/report-header"
import { ActionAccordion, ActionAccordionStack } from "@/components/report/action-accordion"
import { EvidenceBlock } from "@/components/report/evidence-block"
import type { ReportAccordion, ReportEvidence, ReportPeak } from "@/lib/report-meaning"

const ISO = "2026-07-18T12:00:00.000Z"

const peak: ReportPeak = {
  objective: "Hold blended CM2 above the 22% floor this quarter.",
  situation: "CM2 is tracking at 21.3% blended, 0.7pp under the floor.",
  complication: "South and West slipped below the 78% occupancy floor for two cycles.",
  recommendation: "Approve the 2-week occupancy recovery playbook for South and West.",
  ask: "Approve ₹4.2L of recovery spend before 18:00 today.",
  owner: "Priya · Ops Lead",
  dueDate: "Today 18:00",
  asOf: ISO,
  tone: "breach",
}

const SOWHAT = "South has been below floor for two cycles."

const accordion: ReportAccordion = {
  id: "restore-occupancy",
  actionTitle: "Restore South Theatre occupancy to the 78% floor within 2 weeks",
  soWhat: SOWHAT,
  tone: "critical",
  owner: "Ops · South",
  dueDate: "Fri",
  evidence: [
    {
      id: "occupancy-metrics",
      chartType: "metric",
      dataSource: "static",
      soWhat: "Occupancy fell 6 points while the target held.",
      sourceLabel: "Ops occupancy ledger",
      pulledAt: ISO,
      metrics: [{ label: "Occupancy", value: "71%", delta: "-6 pts", tone: "critical" }],
    },
  ],
}

function evidence(overrides: Partial<ReportEvidence>): ReportEvidence {
  return {
    id: "ev",
    chartType: "metric",
    dataSource: "static",
    soWhat: "Meaning first.",
    sourceLabel: "Test source",
    pulledAt: ISO,
    metrics: [{ label: "Occupancy", value: "71%" }],
    ...overrides,
  }
}

test("the Peak is uncollapsible and shows the full SCR, Ask, owner and due date", () => {
  const html = renderToStaticMarkup(createElement(ReportHeader, { peak }))
  assert.match(html, /class="report-peak"/)
  assert.doesNotMatch(html, /<details/, "the peak must never be collapsible")
  assert.match(html, /Objective:/)
  assert.match(html, /Situation/)
  assert.match(html, /Complication/)
  assert.match(html, /Approve the 2-week occupancy recovery playbook/) // recommendation headline
  assert.match(html, /Ask:/)
  assert.match(html, /Approve ₹4.2L of recovery spend/)
  assert.match(html, /Owner: Priya · Ops Lead/)
  assert.match(html, /Due: Today 18:00/)
  assert.match(html, /data-tone="breach"/)
})

test("a CLOSED accordion summary contains ONLY the action title", () => {
  const html = renderToStaticMarkup(createElement(ActionAccordionStack, { accordions: [accordion], label: "Actions" }))
  // Closed by default: no `open` attribute anywhere.
  assert.doesNotMatch(html, /<details[^>]*\sopen/)
  const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"))
  assert.match(summary, /Restore South Theatre occupancy to the 78% floor within 2 weeks/, "title must be in the closed summary")
  // Nothing else may leak into the closed summary.
  assert.doesNotMatch(summary, new RegExp(SOWHAT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "So What must not be in the closed summary")
  assert.doesNotMatch(summary, /Owner:/, "owner must not be in the closed summary")
  assert.doesNotMatch(summary, /Due:/, "due date must not be in the closed summary")
  // …but they are present in the (collapsed) body, revealed on expand.
  const body = html.slice(html.indexOf("report-action-body"))
  assert.match(body, new RegExp(SOWHAT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(body, /Owner: Ops · South/)
  assert.match(body, /Due: Fri/)
})

test("an action accordion refuses to render a topic or unquantified title", () => {
  const topic = { ...accordion, actionTitle: "Occupancy overview across Theatres" }
  assert.throws(() => renderToStaticMarkup(createElement(ActionAccordion, { accordion: topic })), /is a topic, not an action/)
  const vague = { ...accordion, actionTitle: "Restore occupancy across the southern Theatres" }
  assert.throws(() => renderToStaticMarkup(createElement(ActionAccordion, { accordion: vague })), /is not quantified/)
})

test("the So What gate blocks a naked evidence block at render time", () => {
  assert.throws(() => renderToStaticMarkup(createElement(EvidenceBlock, { evidence: evidence({ soWhat: "" }) })), /must state a "So What"/)
})

test("evidence renders a metric grid with a Source · Pulled footer", () => {
  const html = renderToStaticMarkup(createElement(EvidenceBlock, { evidence: evidence({}) }))
  assert.match(html, /report-metric-grid/)
  assert.match(html, /report-evidence-footer/)
  assert.match(html, /data-source="static"/)
  assert.match(html, /Source: Test source/)
  assert.match(html, /Pulled/)
})

test("evidence renders a bar exhibit", () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceBlock, { evidence: evidence({ id: "bar", chartType: "bar", metrics: undefined, series: { unit: "%", points: [{ label: "Nest 12", value: 62 }, { label: "Nest 19", value: 58 }] } }) }),
  )
  assert.match(html, /report-bars/)
  assert.match(html, /report-bar-fill/)
})

test("evidence renders a line exhibit", () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceBlock, { evidence: evidence({ id: "line", chartType: "line", metrics: undefined, series: { unit: "%", points: [{ label: "W1", value: 23.1 }, { label: "W2", value: 21.3 }] } }) }),
  )
  assert.match(html, /report-line-path/)
  assert.match(html, /<svg/)
})

test("evidence renders a table exhibit with its caption", () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceBlock, { evidence: evidence({ id: "tbl", chartType: "table", metrics: undefined, table: { caption: "West shortfall by nest", columns: ["NEST", "TARGET"], rows: [["Nest 12", "40"]] } }) }),
  )
  assert.match(html, /report-table-caption/)
  assert.match(html, /West shortfall by nest/)
  assert.match(html, /<table/)
})

test("live evidence is marked, seeds first paint, and shows its refresh cadence", () => {
  const live = evidence({
    id: "live",
    chartType: "table",
    dataSource: "live",
    metrics: undefined,
    table: { caption: "West shortfall", columns: ["NEST", "ACTUAL"], rows: [["Nest 12", "22"]] },
    endpoint: "/report-kit-preview/api/pulse",
    refreshInterval: 15000,
  })
  const html = renderToStaticMarkup(createElement(EvidenceBlock, { evidence: live }))
  assert.match(html, /data-source="live"/)
  assert.match(html, />Live</)
  assert.match(html, /Refresh every 15s/)
  assert.match(html, /West shortfall/, "the static seed renders on first paint before the live pull")
})

test("evidence first render is deterministic and timezone-independent (hydration-safe)", () => {
  // The seed ISO is noon UTC. Because the formatter is pinned to UTC, the server
  // render and the client's first render must both print "12:00 UTC" regardless of
  // the machine's local timezone — this is exactly what prevents the hydration
  // mismatch overlay. We also prove the first render is a pure function of the seed
  // by rendering twice and asserting byte-identical markup (no Date.now/live values).
  const seeded = evidence({ pulledAt: "2026-07-18T12:00:00.000Z" })
  const first = renderToStaticMarkup(createElement(EvidenceBlock, { evidence: seeded }))
  const second = renderToStaticMarkup(createElement(EvidenceBlock, { evidence: seeded }))
  assert.equal(first, second, "first render must be deterministic across renders")
  assert.match(first, /Pulled 18 Jul, 12:00 UTC/, "the seed time must format in UTC on first paint")
  // Guard against any locale/zone drift sneaking back in via Date.now on initial render.
  assert.doesNotMatch(first, /Invalid Date/)
})

test("peak 'As of' timestamp is UTC-pinned and deterministic (hydration-safe)", () => {
  // The Peak is always visible, so a locale-dependent "As of" was the remaining
  // hydration mismatch source. It must format the seed in UTC identically across
  // renders regardless of the host timezone.
  const first = renderToStaticMarkup(createElement(ReportHeader, { peak }))
  const second = renderToStaticMarkup(createElement(ReportHeader, { peak }))
  assert.equal(first, second, "peak render must be deterministic across renders")
  assert.match(first, /As of 18 Jul, 12:00 UTC/, "the peak 'As of' must format in UTC on first paint")
  assert.doesNotMatch(first, /Invalid Date/)
})

test("live evidence still renders its seed (not a live/Date.now value) on first paint", () => {
  const live = evidence({
    id: "live-seed",
    chartType: "table",
    dataSource: "live",
    metrics: undefined,
    table: { caption: "Seed table", columns: ["A"], rows: [["1"]] },
    pulledAt: "2026-07-18T09:30:00.000Z",
    endpoint: "/report-kit-preview/api/pulse",
    refreshInterval: 5000,
  })
  const html = renderToStaticMarkup(createElement(EvidenceBlock, { evidence: live }))
  // useEffect (polling) does not run under renderToStaticMarkup, so the seeded
  // pulledAt is what hydration will match against on the client.
  assert.match(html, /Pulled 18 Jul, 09:30 UTC/)
})

test("the report kit ships its own design tokens and no local colour fork", () => {
  const root = process.cwd()
  const globals = readFileSync(join(root, "app/globals.css"), "utf8")
  for (const token of ["--report-accent:", "--report-peak-surface:", "--report-evidence-surface:", "--report-ask-surface:", "--report-chart-fill:"]) {
    assert.match(globals, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  const reportTokenLines = globals.split("\n").filter((line) => /--report-[a-z-]+:/.test(line))
  for (const line of reportTokenLines) assert.doesNotMatch(line, /#[0-9a-f]{3,8}/i, `raw hex in report token: ${line.trim()}`)

  for (const file of ["report-header.tsx", "action-accordion.tsx", "evidence-block.tsx", "metric-card.tsx", "data-table.tsx", "charts.tsx"]) {
    const source = readFileSync(join(root, "components/report", file), "utf8")
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i, `raw hex colour in ${file}`)
    assert.doesNotMatch(source, /<select\b/i, `native select in ${file}`)
  }
})
