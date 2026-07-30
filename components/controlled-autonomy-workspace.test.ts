import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { buildLiveFailedRecoveryCount, buildLiveSignOffGovernance, buildLiveSignOffLoopHealth, buildLiveSignOffUrgency, ControlledAutonomyWorkspace } from "@/components/controlled-autonomy-workspace"
import { buildControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"

const componentSource = readFileSync(new URL("./controlled-autonomy-workspace.tsx", import.meta.url), "utf8")
const dashboardSource = readFileSync(new URL("./nia-dashboard.tsx", import.meta.url), "utf8")

function renderWorkspace() {
  return renderToStaticMarkup(createElement(ControlledAutonomyWorkspace, { preview: buildControlledAutonomyPreview() }))
}

test("Self-Drive primary view groups work by the response it needs", () => {
  const html = renderWorkspace()
  const fixNow = html.indexOf("Fix now")
  const recovering = html.indexOf("Nia is recovering")
  const waiting = html.indexOf("Waiting for your sign-off")
  const verified = html.indexOf("Verified and closed")
  assert.ok(fixNow >= 0 && recovering > fixNow && waiting > recovering && verified > waiting)
  assert.equal((html.match(/data-action-segment=/g) ?? []).length, 4)
  assert.match(html, /Recovery failed, a deadline was missed, or impact is critical\./)
  assert.match(html, /Only material decisions requiring human authority appear here\./)
  assert.match(html, /Independent proof was accepted and the outcome is counted\./)
})

test("a verdict lead resolves what needs the human decision before the columns", () => {
  const html = renderWorkspace()
  const verdict = html.indexOf("self-drive-verdict")
  const board = html.indexOf('class="action-board"')
  assert.ok(verdict >= 0 && verdict < board, "verdict must precede the action board")
  assert.match(html, /need your sign-off|failing recovery|no material decision is waiting/)
  assert.match(html, /So what: nothing below changes money, contracts, people or systems until you decide/)
})

test("action cards show two summary fields, plain-language story and progress", () => {
  const html = renderWorkspace()
  const primary = html.slice(0, html.indexOf("Full background record"))
  const signOffCount = buildControlledAutonomyPreview().learningQueue.filter((entry) => entry.evaluation.requiredDisposition === "Human sign-off").length
  for (const field of ["Owner", "Due", "Why it matters", "What Nia already did", "What happens next"]) assert.match(primary, new RegExp(`>${field}<`))
  for (const field of ["Root cause", "Action"]) assert.match(primary, new RegExp(`>${field}<`))
  assert.ok((primary.match(/role="progressbar"/g) ?? []).length >= buildControlledAutonomyPreview().learningQueue.length)
  assert.match(primary, />View detail</)
  assert.equal((primary.match(/>Approve<\/button>/g) ?? []).length, signOffCount)
  assert.equal((primary.match(/>Decline<\/button>/g) ?? []).length, signOffCount)
  assert.match(primary, /Shadow decision only · no external effect/)
  assert.match(primary, /aria-valuenow="\d+"/)
})

test("Your Sign-Off and Learning history consume the same evaluated queue", () => {
  assert.match(componentSource, /preview\.learningQueue/)
  assert.match(dashboardSource, /controlledAutonomyPreview\?\.learningQueue/)
  assert.doesNotMatch(componentSource, /SHADOW-FINANCE-HOLD|SHADOW-PEOPLE-REVIEW/)
})

test("human authority names all permanent human decision categories", () => {
  const html = renderWorkspace()
  const disclosure = html.indexOf("Full background record")
  for (const category of ["Money", "Contracts", "Employment", "Legal / compliance", "External communication"]) assert.match(html, new RegExp(`>${category}<`))
  assert.ok(html.indexOf("Decisions Nia never makes alone") > disclosure)
  assert.match(html, /Financial approver · Pushkar/)
  assert.match(html, /Commercial approver · Pushkar/)
  assert.match(html, /Named HR \/ management approver/)
  assert.match(html, /Named legal \/ compliance approver/)
  assert.match(html, /Authorised communications leader/)
})

test("one global H1 supplies the title while trust status precedes the Self-Drive columns", () => {
  assert.equal((dashboardSource.match(/<h1/g) ?? []).length, 1)
  assert.doesNotMatch(componentSource, /<h1/)
  assert.match(dashboardSource, /"Your Sign-Off": \{ title: "Your Sign-Off", subtitle: "Only material changes and unresolved exceptions wait here for a human decision\."/)
  const html = renderWorkspace()
  assert.match(html, /^<div class="dashboard-accordion autonomy-workspace self-drive-workspace"[^>]+>/)
  assert.ok(html.indexOf("Loop health") < html.indexOf("Decisions by urgency"))
  assert.match(html, /aria-expanded="true"/)
  assert.doesNotMatch(html.slice(0, html.indexOf("Full background record")), /Phase 5|Synthetic fixture|Kill switch|controlled autonomy status/)
})

test("governed policy, audit, safeguards and source detail remain in a closed native disclosure", () => {
  const html = renderWorkspace()
  const disclosure = html.indexOf("<details class=\"self-drive-audit-details\">")
  const summary = html.indexOf("Full background record")
  assert.ok(disclosure >= 0 && summary > disclosure)
  assert.doesNotMatch(html.slice(disclosure, summary), /\sopen(?:=|\s|>)/)
  for (const retained of [
    "Routine Recovery",
    "People Exceptions",
    "Decision Accuracy",
    "Accuracy threshold",
    "Reversal threshold",
    "Audit threshold",
    "Learning Feedback",
    "System Performance",
    "execution adapter available: No",
  ]) assert.ok(html.indexOf(retained) > summary, `${retained} must remain inside audit details`)
})

test("approval controls are local-only and retain append-only synthetic audit support", () => {
  const preview = buildControlledAutonomyPreview()
  assert.equal(preview.writesEnabled, false)
  assert.equal(preview.externalMessagesEnabled, false)
  assert.equal(preview.executionAdapterAvailable, false)
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|server action|use server/)
  assert.match(componentSource, /setShadowDecisionAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /new Date\(\)\.toISOString\(\)/)
  const html = renderWorkspace()
  assert.match(html, /Your recent decisions log/)
  assert.match(html, /No local shadow decision recorded/)
  assert.doesNotMatch(html, /Approve contract|Move money|Send message|Terminate person/)
})

test("live Sign-Off Loop health uses Approval_Log decisions and linked Action_Log deadlines", () => {
  const preview = buildControlledAutonomyPreview()
  const liveData = { asOf: "2026-07-28T06:00:00.000Z", approvals: [
    { "approval id": "APR-1", "linked action id": "ACT-1", "decision type": "Finance", decision: "Approved", "decided at": "2026-07-28T05:00:00.000Z" },
    { "approval id": "APR-2", "linked action id": "ACT-2", "decision type": "Commercial", decision: "Pending", "updated at": "2026-07-28T04:00:00.000Z" },
  ], actions: [
    { "action id": "ACT-1", "operating objective": "Approved decision", "due at": "2026-07-28T05:00:00.000Z" },
    { "action id": "ACT-2", "operating objective": "Pending decision", "due at": "2026-07-28T05:30:00.000Z", "proposed at": "2026-07-28T04:00:00.000Z" },
  ], evidence: [] }
  const health = buildLiveSignOffLoopHealth(liveData, preview.loopHealth)
  assert.equal(health.verification.claimed, 2)
  assert.equal(health.verification.verified, 1)
  assert.equal(health.verification.awaiting, 1)
  assert.equal(health.clocks.length, 1)
  assert.equal(health.clocks[0]?.breached, true)
  const html = renderToStaticMarkup(createElement(ControlledAutonomyWorkspace, { preview, liveData }))
  assert.match(html, /1\/2 verified/)
  assert.match(html, /1 of 2/)
  assert.match(html, /Pending decision/)
})

test("live Decision status counts failed recoveries from rejected Evidence_Log rows", () => {
  const preview = buildControlledAutonomyPreview()
  const liveData = {
    approvals: [{ "approval id": "APR-1", "linked action id": "ACT-1", decision: "Pending" }],
    actions: [
      { "action id": "ACT-1", "operating objective": "Approve governed change" },
      { "action id": "RECOVERY-1", "operating objective": "Correct rejected recovery", state: "Reopened" },
    ],
    evidence: [
      { "evidence id": "E-1", "linked id": "RECOVERY-1", "verification status": "Rejected" },
      { "evidence id": "E-2", "verification status": "Pending" },
    ],
  }
  assert.equal(buildLiveFailedRecoveryCount(liveData, 99), 1)
  const html = renderToStaticMarkup(createElement(ControlledAutonomyWorkspace, { preview, liveData }))
  assert.match(html, /1 material decision/)
  assert.match(html, /1<\/strong> routine action is failing recovery/)
})

test("live Decisions by urgency replaces every routine fixture group with Sheet log records", () => {
  const preview = buildControlledAutonomyPreview()
  const liveData = {
    actions: [
      { "action id": "FAILED-1", "operating objective": "Correct rejected recovery", state: "Reopened", "owner actor id": "P-1" },
      { "action id": "WORK-1", "operating objective": "Continue recorded recovery", state: "In progress", "owner actor id": "P-1" },
      { "action id": "DONE-1", "operating objective": "Verified Sheet recovery", state: "Verified", "owner actor id": "P-1", "verification result": "Recovered" },
    ],
    evidence: [
      { "evidence id": "E-FAIL", "linked id": "FAILED-1", "verification status": "Rejected" },
      { "evidence id": "E-DONE", "linked id": "DONE-1", "verification status": "Verified" },
    ],
    people: [{ "actor id": "P-1", "display name": "Sheet Owner" }],
    approvals: [],
  }
  const groups = buildLiveSignOffUrgency(liveData)
  assert.deepEqual(groups.fixNow.map((row) => row.actionId), ["FAILED-1"])
  assert.deepEqual(groups.recovering.map((row) => row.actionId), ["WORK-1"])
  assert.deepEqual(groups.verified.map((row) => row.actionId), ["DONE-1"])
  const html = renderToStaticMarkup(createElement(ControlledAutonomyWorkspace, { preview, liveData }))
  assert.match(html, /Correct rejected recovery/)
  assert.match(html, /Continue recorded recovery/)
  assert.match(html, /Verified Sheet recovery/)
  const urgencyHtml = html.slice(html.indexOf('<section class="action-board"'), html.indexOf('<details class="self-drive-audit-details"'))
  assert.doesNotMatch(urgencyHtml, /Resolve missing activation proof|Recover a cross-pillar interruption|Restore stock availability/)
})

test("live Governance and background is derived only from governed Sheet logs", () => {
  const preview = buildControlledAutonomyPreview()
  const liveData = {
    asOf: "2026-07-28T06:00:00.000Z",
    actionLog: [{ "action id": "LIVE-ACT-1", "operating objective": "Live governed recovery", state: "Verified", "owner actor id": "ACT-LIVE" }],
    evidenceLog: [{ "evidence id": "LIVE-EV-1", "linked id": "LIVE-ACT-1", "verification status": "Verified" }],
    approvalLog: [{ "approval id": "LIVE-APR-1", title: "Live financial decision", decision: "Approved", owner: "Sheet Approver", "decided at": "2026-07-28T05:00:00.000Z" }],
    people: [{ "actor id": "ACT-LIVE", "display name": "Live Owner" }],
    policyRegistry: [{ "policy id": "POL-AUTONOMY-MODE", name: "Operating mode", value: "Shadow only", version: "2", "approved by": "Sheet Governor" }],
    learningHistory: [{ "learning id": "LEARN-1", domain: "Finance", disposition: "Human override", notes: "Live recorded feedback" }],
  }
  const governance = buildLiveSignOffGovernance(liveData)
  assert.equal(governance.decisions.length, 1)
  assert.equal(governance.routines.length, 1)
  assert.equal(governance.feedback.length, 1)
  assert.equal(governance.policies.length, 1)
  const html = renderToStaticMarkup(createElement(ControlledAutonomyWorkspace, { preview, liveData }))
  assert.match(html, /Live governed recovery/)
  assert.match(html, /Live financial decision/)
  assert.match(html, /Live recorded feedback/)
  assert.match(html, /Connected Google Sheet/)
  assert.doesNotMatch(html, /synthetic routes|fixture paths|Restore stock availability|Studio EAE/)
})
