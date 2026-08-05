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
  return renderToStaticMarkup(createElement(OverviewStory, { mode: "reporting", commitments: [], loopHealth, onModeChange: () => undefined, onNavigate: () => undefined }))
}

test("Overview suppresses the green flywheel when Loop Health cannot confirm performance", () => {
  const html = renderOverview("2026-07-18T08:00:00.000Z")
  assert.match(html, /Cannot confirm performance yet/)
  assert.doesNotMatch(html, /One live snapshot links source pages to the master view\./)
})

test("Overview renders the flywheel when Loop Health allows the answer", () => {
  const html = renderOverview("2026-07-18T12:00:00.000Z")
  assert.match(html, /One live snapshot links source pages to the master view\./)
  assert.doesNotMatch(html, /Cannot confirm performance yet/)
})
