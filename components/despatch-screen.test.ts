import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DespatchScreen } from "@/components/despatch-screen"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"
import { createDespatchEscalation } from "@/lib/operating-loop/runtime-contracts"

const css = readFileSync(new URL("./despatch-screen.css", import.meta.url), "utf8")

test("Despatch leads with neutral charts and a compact action queue", () => {
  const base = createDespatchEscalation({ escalationId: "ESC-1", domain: "New Adds", sourceActionId: "ACT-1", sourceEventId: "EVT-1", title: "Fill overdue", reason: "Verified billing is overdue.", ownerRole: "Theatre lead", dueAt: "2026-07-18T12:00:00.000Z", raisedAt: "2026-07-18T10:00:00.000Z", severity: "Breach", status: "Open", evidenceRefs: ["protected://new-adds/ACT-1"], synthetic: true })
  const escalations = Array.from({ length: 7 }, (_, index) => createDespatchEscalation({ ...base, escalationId: `ESC-${index + 1}`, sourceActionId: `ACT-${index + 1}` }))
  const loopHealth = buildLoopHealth({ asOf: "2026-07-18T12:00:00.000Z", feeds: [], clocks: [], verification: { claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null } })
  const html = renderToStaticMarkup(createElement(DespatchScreen, { commitments: [], escalations, escalationTotal: 7, loopHealth, onValidateAction: () => undefined }))
  assert.match(html, /What needs doing next/)
  assert.match(html, /aria-label="Operate action overview"/)
  assert.ok(html.indexOf("Start here") < html.indexOf("Actions by owner"))
  assert.match(html, /despatch-priority-line/)
  assert.match(html, /aria-label="Actions by owner"/)
  assert.match(html, /aria-label="Work type distribution"/)
  assert.match(html, /aria-label="Action queue"/)
  assert.ok(html.indexOf("Actions by owner") < html.indexOf("Action queue"), "charts must lead the queue")
  assert.doesNotMatch(html, /despatch-owner-clusters|despatch-verdict/)
  assert.doesNotMatch(html, /showing 5|\+2 more/)
  assert.ok((html.match(/Fill task overdue/g) ?? []).length >= 7)
  assert.ok((html.match(/Escalate overdue fill/g) ?? []).length >= 7)
  assert.match(html, /Member Adds/)
  assert.doesNotMatch(html, />New Adds</)
  assert.match(html, /Deadline passed/)
  assert.match(css, /#despatch-screen \.despatch-chart-grid \{[^}]*grid-template-columns:/)
  assert.match(css, /#despatch-screen \.despatch-action-row \{[^}]*grid-template-columns:/)
  assert.doesNotMatch(css, /--status-|--tone-|#[0-9a-f]{3,8}(?![0-9a-z_-])/i)
  assert.match(html, /aria-label="Heartbeat data status"/)
})
