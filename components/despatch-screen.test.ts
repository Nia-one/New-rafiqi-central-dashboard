import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DespatchScreen } from "@/components/despatch-screen"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation } from "@/lib/operating-loop/runtime-contracts"

test("Despatch groups every exception by owner and leads with owner, gap and action", () => {
  const base = createDespatchEscalation({ escalationId: "ESC-1", domain: "New Adds", sourceActionId: "ACT-1", sourceEventId: "EVT-1", title: "Fill overdue", reason: "Verified billing is overdue.", ownerRole: "Theatre lead", dueAt: "2026-07-18T12:00:00.000Z", raisedAt: "2026-07-18T10:00:00.000Z", severity: "Breach", status: "Open", evidenceRefs: ["protected://new-adds/ACT-1"], synthetic: true })
  const escalations = Array.from({ length: 7 }, (_, index) => createDespatchEscalation({ ...base, escalationId: `ESC-${index + 1}`, sourceActionId: `ACT-${index + 1}` }))
  const loopHealth = buildLoopHealth({ asOf: "2026-07-18T12:00:00.000Z", feeds: [], clocks: [], verification: { claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null } })
  const html = renderToStaticMarkup(createElement(DespatchScreen, { commitments: [], escalations, escalationTotal: 7, loopHealth, onValidateAction: () => undefined }))
  assert.match(html, /NEXT ACTIONS/)
  assert.match(html, /What needs doing next/)
  assert.ok(html.indexOf("NEXT ACTIONS") < html.indexOf("How reliable is data"))
  assert.match(html, /despatch-verdict/)
  assert.ok(html.indexOf("despatch-verdict") < html.indexOf("Actions grouped by owner"), "verdict must lead the queue")
  assert.match(html, /owns the most urgent action of/)
  assert.match(html, /So what: each item below closes only on independently verified proof/)
  assert.match(html, /Actions grouped by owner/)
  assert.match(html, /data-tone="breach"/)
  assert.match(html, /Theatre lead actions/)
  assert.doesNotMatch(html, /showing 5|\+2 more/)
  assert.equal((html.match(/<h3>Theatre lead<\/h3>/g) ?? []).length, 7)
  assert.equal((html.match(/Fill task overdue/g) ?? []).length, 14)
  assert.equal((html.match(/Escalate overdue fill/g) ?? []).length, 14)
  assert.match(html, /operational-card-breach/)
  assert.match(html, /Member Adds/)
  assert.doesNotMatch(html, />New Adds</)
  assert.match(html, /Deadline passed/)
  assert.match(html, /role="progressbar"/)
  assert.match(html, />Why it matters</)
  assert.match(html, />What Nia already did</)
  assert.match(html, />What happens next</)
  assert.doesNotMatch(html, /Who has gone quiet|Vikram Singh|Illustrative control data/)
})
