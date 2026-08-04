import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DespatchScreen } from "@/components/despatch-screen"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation } from "@/lib/operating-loop/runtime-contracts"

test("Despatch derives its final compact queue and charts from live exceptions", () => {
  const base = createDespatchEscalation({ escalationId: "ESC-1", domain: "New Adds", sourceActionId: "ACT-1", sourceEventId: "EVT-1", title: "Fill overdue", reason: "Verified billing is overdue.", ownerRole: "Theatre lead", dueAt: "2026-07-18T12:00:00.000Z", raisedAt: "2026-07-18T10:00:00.000Z", severity: "Breach", status: "Open", evidenceRefs: ["protected://new-adds/ACT-1"], synthetic: true })
  const escalations = Array.from({ length: 7 }, (_, index) => createDespatchEscalation({ ...base, escalationId: `ESC-${index + 1}`, sourceActionId: `ACT-${index + 1}` }))
  const loopHealth = buildLoopHealth({ asOf: "2026-07-18T12:00:00.000Z", feeds: [], clocks: [], verification: { claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null } })
  const html = renderToStaticMarkup(createElement(DespatchScreen, { commitments: [], escalations, escalationTotal: 7, loopHealth, onValidateAction: () => undefined }))
  assert.match(html, /What needs doing next/)
  assert.match(html, /Start here/)
  assert.match(html, /Actions by owner/)
  assert.match(html, /Work needing response/)
  assert.match(html, /Action queue/)
  assert.doesNotMatch(html, /showing 5|\+2 more/)
  assert.equal((html.match(/<strong>Theatre lead<\/strong>/g) ?? []).length, 8)
  assert.equal((html.match(/Fill task overdue/g) ?? []).length, 8)
  assert.equal((html.match(/Escalate overdue fill/g) ?? []).length, 8)
  assert.match(html, /Member Adds/)
  assert.doesNotMatch(html, />New Adds</)
  assert.match(html, /Deadline passed/)
  assert.match(html, /Who has gone quiet/)
  assert.match(html, /No governed heartbeat source connected/)
  assert.doesNotMatch(html, /Vikram Singh|Illustrative control data/)
})
