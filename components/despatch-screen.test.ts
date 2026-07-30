import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { buildLiveDespatchActions, buildLiveHeartbeatProjection, DespatchScreen } from "@/components/despatch-screen"
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
  assert.match(html, /<details class="system-monitoring-details"><summary>Who has gone quiet<\/summary>/)
})

test("Despatch live queue uses non-terminal Action_Log rows and governed incident context", () => {
  const liveData = { actions: [
    { "action id": "ACT-OPEN", "incident id": "INC-1", "operating objective": "Recover readiness", "expected metric": "Ready nests", "baseline value": "96", "target value": "120", "owner actor id": "ACT-PRIYA", "due at": "2026-07-28T12:00:00+05:30", "required evidence": "Readiness proof", state: "In progress" },
    { "action id": "ACT-DONE", "operating objective": "Old synthetic action", state: "Verified" },
  ], incidents: [{ "incident id": "INC-1", domain: "Enterprise Demand", "short description": "Readiness proof is pending", "severity reason": "Contract readiness is not confirmed" }], people: [{ "actor id": "ACT-PRIYA", "display name": "Priya Rao (Test)" }] }
  assert.equal(buildLiveDespatchActions(liveData).length, 1)
  const html = renderToStaticMarkup(createElement(DespatchScreen, { commitments: [], liveData, onValidateAction: () => undefined }))
  assert.match(html, /1 live Sheet action/)
  assert.match(html, /Recover readiness/)
  assert.match(html, /Readiness proof is pending/)
  assert.match(html, /Action_Log \+ Incident_Log · ACT-OPEN/)
  assert.match(html, /Priya Rao \(Test\)/)
  assert.match(html, /Contract readiness is not confirmed/)
  assert.doesNotMatch(html, /Old synthetic action|went silent|Confirm checked|must move/)
  assert.match(html, /Connected Google Sheet · read-only/)
  assert.doesNotMatch(html, /Illustrative control data|Poll now|Pause|Acknowledge/)
})

test("live heartbeat projection is shift-aware and uses People and Policy_Registry values", () => {
  const projection = buildLiveHeartbeatProjection({
    asOf: "2026-07-28T06:00:00.000Z",
    people: [
      { "actor id": "ACT-1", "display name": "Escalated owner", role: "JCO", "theatre id": "TH-1", "studio id": "ST-1", "active shift": "Day", "shift start at": "2026-07-28T04:00:00.000Z", "shift end at": "2026-07-28T12:00:00.000Z", "last heartbeat at": "2026-07-28T04:30:00.000Z", "next heartbeat due at": "2026-07-28T05:00:00.000Z" },
      { "actor id": "ACT-3", "display name": "Current owner", role: "JCO", "active shift": "Day", "shift start at": "2026-07-28T04:00:00.000Z", "shift end at": "2026-07-28T12:00:00.000Z", "last heartbeat at": "2026-07-28T05:30:00.000Z", "next heartbeat due at": "2026-07-28T06:30:00.000Z" },
      { "actor id": "ACT-4", "display name": "Overdue owner", role: "JCO", "active shift": "Day", "shift start at": "2026-07-28T04:00:00.000Z", "shift end at": "2026-07-28T12:00:00.000Z", "last heartbeat at": "2026-07-28T05:00:00.000Z", "next heartbeat due at": "2026-07-28T05:50:00.000Z" },
      { "actor id": "ACT-2", "display name": "Off shift owner", role: "JCO", "active shift": "Day", "shift start at": "2026-07-27T04:00:00.000Z", "shift end at": "2026-07-27T12:00:00.000Z", "next heartbeat due at": "2026-07-27T05:00:00.000Z" },
    ],
    theatres: [{ "theatre id": "TH-1", "theatre name": "Test Theatre" }],
    studios: [{ "studio id": "ST-1", "studio name": "Test Studio" }],
    policies: [{ "policy id": "POL-HEARTBEAT-ESCALATION", name: "Missed heartbeat manager escalation", value: "20" }],
  })
  assert.equal(projection.streams.length, 4)
  assert.equal(projection.active.length, 3)
  assert.equal(projection.alerts.length, 2)
  assert.equal(projection.alerts[0]?.status, "Escalated")
  assert.equal(projection.alerts[0]?.overdueMinutes, 60)
  assert.equal(projection.alerts[0]?.theatre, "Test Theatre")
  assert.equal(projection.alerts[0]?.studio, "Test Studio")
  assert.equal(projection.streams.find((stream) => stream.id === "ACT-3")?.status, "Current")
  assert.equal(projection.streams.find((stream) => stream.id === "ACT-4")?.status, "Overdue")
  assert.equal(projection.streams.find((stream) => stream.id === "ACT-2")?.status, "Not evaluated")
})

test("missing heartbeat escalation policy is not interpreted as zero", () => {
  const projection = buildLiveHeartbeatProjection({ asOf: "2026-07-28T06:00:00.000Z", people: [], policies: [] })
  assert.equal(projection.escalationMinutes, null)
})
