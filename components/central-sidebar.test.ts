import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CentralSidebar } from "@/components/central-sidebar"
import type { DashboardWorkspace } from "@/lib/dashboard-model"

function render(workspace: DashboardWorkspace) {
  return renderToStaticMarkup(createElement(CentralSidebar, {
    active: workspace === "self-drive" ? "Despatch" : workspace === "self-learn" ? "Overview" : "Finance control",
    workspace,
    lens: "operate",
    decisionRoomActive: false,
    financeAllowed: true,
    enterpriseAllowed: true,
    signOffAllowed: true,
    open: true,
    onClose() {}, onWorkspace() {}, onNavigate() {}, onDecisionRoom() {}, onLens() {}, onSignOut() {},
  }))
}

test("final rail covers every Self Drive component", () => {
  const html = render("self-drive")
  for (const label of ["Despatch", "Cash &amp; Control", "Enterprise Demand", "Member Adds", "Member Engagement", "Member Savings", "Nia Margins", "Nia Growth", "Your Sign-Off", "Learning History"]) assert.match(html, new RegExp(label))
})

test("final rail covers every Self Learn component", () => {
  const html = render("self-learn")
  for (const label of ["Overview", "Living", "Work", "Essentials", "Member NPS", "People", "Learning History"]) assert.match(html, new RegExp(label))
})

test("final rail exposes the authorised Finance workspace", () => {
  const html = render("self-drive")
  assert.match(html, />Finance<\/span>/)
  const finance = render("finance")
  for (const label of ["Finance Control", "Nia Margins", "Cash &amp; Control"]) assert.match(finance, new RegExp(label))
})
