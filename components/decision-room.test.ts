import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DecisionRoom, type DecisionRoomProps } from "@/components/decision-room"
import { buildCashControlPreview } from "@/lib/operating-loop/cash-control-loop"
import { buildEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import { buildMemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import { buildMemberSavingsPreview } from "@/lib/operating-loop/member-savings-loop"
import { buildNewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import { buildNiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import { buildNiaMarginsPreview, NIA_MARGINS_SYNTHETIC_INPUTS } from "@/lib/operating-loop/nia-margins-loop"

const css = [
  readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFileSync(new URL("./decision-room.css", import.meta.url), "utf8"),
].join("\n")

function renderDecisionRoom(cashControlPreview: DecisionRoomProps["cashControlPreview"]) {
  return renderToStaticMarkup(createElement(DecisionRoom, {
    enterpriseDemandPreview: buildEnterpriseDemandLoopPreview(),
    cashControlPreview,
    newAddsPreview: buildNewAddsPreview(),
    memberEngagementPreview: buildMemberEngagementPreview(),
    memberSavingsPreview: buildMemberSavingsPreview(),
    niaMarginsPreview: buildNiaMarginsPreview(NIA_MARGINS_SYNTHETIC_INPUTS),
    niaGrowthPreview: buildNiaGrowthPreview(),
    signOffCount: 0,
    period: "Jul 2026",
    onOpenLoop: () => undefined,
    onOpenSignOff: () => undefined,
  }))
}

test("Decision Room includes finance approvals and its scoreboard row only when finance preview is allowed", () => {
  const restricted = renderDecisionRoom(null)
  assert.doesNotMatch(restricted, /Cash &amp; Control/)
  assert.doesNotMatch(restricted, /Approve the monthly collected-cash target/)

  const finance = renderDecisionRoom(buildCashControlPreview())
  assert.match(finance, /aria-label="Inspect Cash &amp; Control evidence"/)
  assert.match(finance, /aria-label="Open Cash &amp; Control"/)
  assert.match(finance, /Approve the monthly CM destination/)
  assert.match(finance, /Approve the monthly collected-cash target/)
})

test("Decision Room leads with neutral charts and keeps exact evidence in a responsive table", () => {
  const html = renderDecisionRoom(null)
  const roomCss = readFileSync(new URL("./decision-room.css", import.meta.url), "utf8")
  assert.match(html, /aria-label="Current versus target by loop"/)
  assert.match(html, /aria-label="Escalations by loop"/)
  assert.match(html, /aria-label="Loop evidence table"/)
  assert.doesNotMatch(html, /decision-room-state/)
  assert.match(css, /#decision-room \.decision-room-chart-grid \{[^}]*grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(260px, \.7fr\)/)
  assert.match(css, /#decision-room \.decision-room-evidence button \{[^}]*grid-template-columns:/)
  assert.doesNotMatch(roomCss, /--status-|#[0-9a-f]{3,8}(?![0-9a-z_-])/i)
})
