import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { OverviewStory } from "@/components/overview/overview-story"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"

function renderOverview(lastUpdatedAt: string) {
  const loopHealth = buildLoopHealth({
    asOf: "2026-07-18T12:00:00.000Z",
    feeds: [{ feedId: "overview", label: "Overview outcomes", lastUpdatedAt, cadenceMinutes: 60, critical: true, affectedClaims: ["flywheel"] }],
    clocks: [],
    verification: { claimed: 1, verified: 1, awaiting: 0, reopened: 0, oldestAwaitingAt: null },
  })
  const liveOpsData = {
    spine: [],
    executionActions: [],
    constraints: [],
    history: [],
    flywheel: { work: { demand: 0, supply: 0 }, essentials: { eligible: 0, purchasing: 0, fulfilled: 0 } },
    cmReportingPeriod: { snapshotAt: "2026-07-18T12:00:00.000Z", day: 18, daysInMonth: 31, daysLeft: 13, month: "July 2026", updatedAt: "18 Jul, 17:30 IST", block: "Current block" },
    monthlyCMTarget: 100,
    monthEndProjection: 100,
    askRateMultiple: 1,
    dashboardContent: [],
  }
  return renderToStaticMarkup(createElement(OverviewStory, { mode: "reporting", commitments: [], loopHealth, liveOpsData, onModeChange: () => undefined, onNavigate: () => undefined }))
}

test("Overview suppresses the green flywheel when Loop Health cannot confirm performance", () => {
  const html = renderOverview("2026-07-18T08:00:00.000Z")
  assert.match(html, /Cannot confirm performance yet/)
  assert.doesNotMatch(html, /One system\. Three connected pillars\./)
})

test("Overview renders the flywheel when Loop Health allows the answer", () => {
  const html = renderOverview("2026-07-18T12:00:00.000Z")
  assert.match(html, /One system\. Three connected pillars\./)
  assert.doesNotMatch(html, /Cannot confirm performance yet/)
})
