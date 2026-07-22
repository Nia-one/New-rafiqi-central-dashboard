import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"

const asOf = "2026-07-18T12:00:00.000Z"

test("healthy Data Confidence stays compact with manually available detail", () => {
  const health = buildLoopHealth({ asOf, feeds: [], clocks: [], verification: { claimed: 2, verified: 2, awaiting: 0, reopened: 0, oldestAwaitingAt: null } })
  const html = renderToStaticMarkup(createElement(LoopHealthStrip, { health }))
  assert.match(html, /Data current · No overdue clocks · 2 of 2 outcomes confirmed/)
  assert.match(html, /View details/)
  assert.doesNotMatch(html, /<details open=""/)
})

test("attention Data Confidence automatically expands the full breakdown", () => {
  const health = buildLoopHealth({ asOf, feeds: [{ feedId: "adds", label: "New Adds source", lastUpdatedAt: "2026-07-18T09:00:00.000Z", cadenceMinutes: 60, critical: true, affectedClaims: ["fills"] }], clocks: [], verification: { claimed: 2, verified: 1, awaiting: 1, reopened: 0, oldestAwaitingAt: "2026-07-18T11:00:00.000Z" } })
  const html = renderToStaticMarkup(createElement(LoopHealthStrip, { health }))
  assert.match(html, /<details open=""/)
  assert.match(html, /Check issues/)
  assert.match(html, /Member Adds source/)
  assert.doesNotMatch(html, />New Adds source</)
})

test("verified outcomes render as a composition chart, not a plain number list", () => {
  const health = buildLoopHealth({ asOf, feeds: [], clocks: [], verification: { claimed: 14, verified: 11, awaiting: 3, reopened: 1, oldestAwaitingAt: "2026-07-18T11:00:00.000Z" } })
  const html = renderToStaticMarkup(createElement(LoopHealthStrip, { health }))
  assert.match(html, /loop-health-verify-bar/)
  assert.match(html, /11 of 14/)
  assert.match(html, /outcomes independently confirmed/)
  assert.match(html, /aria-label="11 Confirmed, 3 Waiting, 1 Reopened"/)
})
