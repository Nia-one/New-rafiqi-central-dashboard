import assert from "node:assert/strict"
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
  assert.match(finance, /aria-label="Open Cash &amp; Control"/)
  assert.match(finance, /Approve the monthly CM destination/)
  assert.match(finance, /Approve the monthly collected-cash target/)
})

test("Decision Room renders chart-first comparisons and an exact evidence table", () => {
  const html = renderDecisionRoom(buildCashControlPreview())
  assert.match(html, /Current vs target/)
  assert.match(html, /Escalations/)
  assert.match(html, /Loop evidence table/)
  assert.match(html, /--decision-position/)
})
