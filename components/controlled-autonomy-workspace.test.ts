import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ControlledAutonomyWorkspace } from "@/components/controlled-autonomy-workspace"
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
  // Exactly one H1 renders in every state: the visible page heading when the
  // Decision Room is closed, and a single visually-hidden H1 when it is open.
  // The two literals are mutually exclusive on decisionRoomOpen.
  assert.equal((dashboardSource.match(/<h1/g) ?? []).length, 2)
  assert.match(dashboardSource, /\{decisionRoomOpen \? null : <section className="platform-heading"><div><h1>/)
  assert.match(dashboardSource, /\{decisionRoomOpen \? <h1 className="sr-only">Decision Room<\/h1> : null\}/)
  assert.doesNotMatch(componentSource, /<h1/)
  assert.match(dashboardSource, /"Your Sign-Off": \{ title: "Your Sign-Off", subtitle: "Only material changes and unresolved exceptions wait here for a human decision\."/)
  const html = renderWorkspace()
  assert.match(html, /^<div class="dashboard-accordion autonomy-workspace self-drive-workspace"[^>]+>/)
  assert.ok(html.indexOf("Loop health") < html.indexOf("Decisions by urgency"))
  assert.doesNotMatch(html, /aria-expanded=/)
  assert.equal((html.match(/data-dashboard-section-index=/g) ?? []).length, 4)
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
