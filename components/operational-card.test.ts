import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ActionSegment, actionStageFromStatus, OperationalCard, operationalTone } from "@/components/operational-card"

test("operational cards expose concise summaries and collapse healthy detail", () => {
  const html = renderToStaticMarkup(createElement(OperationalCard, { title: "Capacity covered", status: "Verified", fields: [{ label: "Owner", value: "Theatre lead" }, { label: "Due", value: "Today" }, { label: "Result", value: "40 Nests" }, { label: "Evidence", value: "Protected reference" }], description: "Independent check passed" }))
  assert.match(html, /Capacity covered/)
  assert.match(html, /Owner/)
  assert.match(html, /View detail/)
  assert.doesNotMatch(html, /<details[^>]* open=""/)
  assert.equal(operationalTone("Verified"), "verified")
})

test("critical and breached cards keep detail collapsed until requested", () => {
  for (const status of ["Critical", "Breach"]) {
    const html = renderToStaticMarkup(createElement(OperationalCard, { title: "Exception", status, description: "Evidence and explanation" }))
    assert.doesNotMatch(html, /<details[^>]* open=""/)
    assert.match(html, /View detail/)
  }
})

test("action cards expose a progress bar, compact cause/action and no more than two summary fields", () => {
  const html = renderToStaticMarkup(createElement(OperationalCard, { title: "Recover occupancy", status: "Working", progress: "working", fields: [{ label: "Owner", value: "Theatre lead" }, { label: "Due", value: "Today" }, { label: "Evidence", value: "Pending" }], story: [{ label: "Why it matters", value: "Capacity is below target." }, { label: "What Nia already did", value: "Assigned the owner." }, { label: "What happens next", value: "Submit proof." }] }))
  assert.match(html, /Progress: Working/)
  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-valuenow="60"/)
  const summary = html.slice(0, html.indexOf("<details"))
  assert.match(summary, />Owner</)
  assert.match(summary, />Due</)
  assert.doesNotMatch(summary, />Evidence</)
  assert.match(html, />Why it matters</)
  assert.match(html, />What Nia already did</)
  assert.match(html, />What happens next</)
  assert.match(html, />Root cause</)
  assert.match(html, />Action</)
  assert.match(html, /Target remains below plan/)
  assert.match(html, /Submit proof/)
})

test("cards without a written cause hide the root cause line and show only the action", () => {
  const html = renderToStaticMarkup(createElement(OperationalCard, { title: "STUDIO-FONO-01", domain: "Oragadam · FONO", status: "Assigned", description: "Run the verified Returning Member fill playbook." }))
  assert.doesNotMatch(html, /Root cause/)
  assert.doesNotMatch(html, /Vacancy not yet filled/)
  assert.match(html, /data-single="action"/)
  assert.match(html, />Action</)
  assert.match(html, /Run verified fill playbook/)
  assert.equal((html.match(/Run verified fill playbook/g) ?? []).length, 1)
})

test("explicit percentage progress is used when a card supplies it", () => {
  const html = renderToStaticMarkup(createElement(OperationalCard, { title: "Recover occupancy", status: "Working", progress: "working", fields: [{ label: "Progress", value: "72%" }] }))
  assert.match(html, /aria-valuenow="72"/)
  assert.match(html, />72%</)
})

test("owner-first exception cards can replace workflow progress with a labelled gap optic", () => {
  const html = renderToStaticMarkup(createElement(OperationalCard, {
    title: "Pushkar / Finance",
    subtitle: "Member cost over limit",
    status: "Breach",
    tone: "breach",
    optic: { label: "₹104 · cap ₹100", percent: 96, markerPercent: 92 },
    action: "Review cost exception",
    story: [{ label: "Why it matters", value: "Actual loaded CAC ₹104 is above ₹100." }],
  }))
  assert.match(html, /<h3>Pushkar \/ Finance<\/h3>/)
  assert.match(html, /Member cost over limit/)
  assert.match(html, /₹104 · cap ₹100/)
  assert.match(html, /aria-valuenow="96"/)
  assert.match(html, /left:92%/)
  assert.match(html, /Review cost exception/)
  assert.doesNotMatch(html, /Progress: /)
})

test("verified action segments remain collapsed by default", () => {
  const html = renderToStaticMarkup(createElement(ActionSegment, { segment: "verified", count: 1 }, createElement(OperationalCard, { title: "Outcome accepted", status: "Verified" })))
  assert.match(html, /data-action-segment="verified"/)
  assert.match(html, /Verified and closed/)
  assert.doesNotMatch(html, /<details[^>]* open=""/)
})

test("operating states map to a consistent five-stage path", () => {
  assert.equal(actionStageFromStatus("Assigned"), "assigned")
  assert.equal(actionStageFromStatus("Retry scheduled"), "working")
  assert.equal(actionStageFromStatus("Evidence pending"), "evidence")
  assert.equal(actionStageFromStatus("Verified"), "verified")
})
