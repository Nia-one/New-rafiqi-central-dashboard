import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EnterpriseDemandWorkspace } from "@/components/enterprise-demand-workspace"
import { OPERATIONS_TABS } from "@/lib/dashboard-model"
import { buildEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"

const componentSource = readFileSync(new URL("./enterprise-demand-workspace.tsx", import.meta.url), "utf8")
const dashboardSource = readFileSync(new URL("./nia-dashboard.tsx", import.meta.url), "utf8")

function renderWorkspace() {
  return renderToStaticMarkup(createElement(EnterpriseDemandWorkspace, { preview: buildEnterpriseDemandLoopPreview() }))
}

test("Enterprise Demand remains one governed Operations route", () => {
  assert.equal(OPERATIONS_TABS.filter((tab) => tab === "Enterprise Demand").length, 1)
  assert.equal((OPERATIONS_TABS as readonly string[]).some((tab) => tab === "Demand activation"), false)
  assert.match(dashboardSource, /active === "Enterprise Demand"/)
})

test("the shell has one rail and compact page tabs without a Details or duplicate Readiness tab", () => {
  assert.match(dashboardSource, /CentralSidebar/)
  assert.doesNotMatch(dashboardSource, /EnterpriseContextRail|enterprise-workspace-context/)
  for (const section of ["Overview", "FONO", "Śram Park", "Actions", "Evidence"]) assert.match(dashboardSource, new RegExp(`label: "${section}"`))
  assert.doesNotMatch(dashboardSource, /label: "Details"/)
  assert.doesNotMatch(dashboardSource, /label: "Readiness"/)
})

test("the first viewport leads with context then one lapsed-plan recovery action", () => {
  const html = renderWorkspace()
  const context = html.indexOf("operating-context-strip")
  const decision = html.indexOf("operating-decision-band")
  const evidence = html.indexOf("enterprise-evidence-grid")
  assert.ok(context >= 0 && context < decision && decision < evidence)
  assert.match(html, /Lapsed · recovery required/)
  assert.match(html, /Recover the lapsed plan: Call Oragadam FONO reserve A/)
  assert.match(html, /FONO Supply JCO/)
  assert.match(html, /17 Jul, 10:30 IST<\/time> · overdue/)
  assert.match(html, /2 of 8 stages cleared/)
  assert.match(html, /24 Nests to independent verification/)
})

test("score rows carry units and identified nearby supply is not presented as verified coverage", () => {
  const html = renderWorkspace()
  for (const value of ["140 / 180 Nests", "40 Nests", "2 of 8 cleared", "40 Nests"]) assert.match(html, new RegExp(value.replace("/", "\\/")))
  assert.match(html, /Not yet verified against the gap/)
  assert.match(html, /Identified capacity is not counted as verified and is not assumed to close the 40-Nest gap/)
  assert.doesNotMatch(html, /Ring 1 covers the full/)
  assert.doesNotMatch(componentSource, /enterprise-details-fields|enterprise-view-radio|aria-pressed/)
})

test("behavior-driving evidence is directly visible and uses real preview arrays", () => {
  const html = renderWorkspace()
  assert.match(html, /Verified capacity vs target/)
  assert.match(html, /enterprise-readiness-bridge/)
  assert.match(html, /Arrival lapsed with 40 Nests unverified/)
  assert.match(html, /enterprise-arrival-stage-chart/)
  assert.match(componentSource, /preview\.progress\.map/)
  assert.equal((html.match(/enterprise-channel-funnel/g) ?? []).length, 2)
  assert.match(html, /data-supply-lane="FONO"/)
  assert.match(html, /data-supply-lane="SP"/)
  assert.match(componentSource, /lane\.stages\.map/)
})

test("current mix is a labeled composition chart rather than input-like boxes", () => {
  const html = renderWorkspace()
  assert.match(html, /enterprise-current-mix/)
  assert.match(html, /Verified capacity mix: FONO 60 Nests and Śram Park 80 Nests/)
  assert.match(html, /Total verified<\/dt><dd>140 Nests/)
  assert.doesNotMatch(html, /<input|<textarea/)
})

test("today's work and assigned exceptions are visible with owner due progress and outcome", () => {
  const html = renderWorkspace()
  assert.match(html, /Today&#x27;s work/)
  assert.match(html, /2 governed actions · 2 gated/)
  assert.match(html, /Assigned support/)
  assert.match(html, />Owner</)
  assert.match(html, />Due</)
  assert.match(html, /Expected verified outcome/)
  assert.match(componentSource, /disabled=\{step\.state === "Ring 2 gated" \|\| step\.humanApprovalRequired\}/)
  assert.match(componentSource, /Ring 1 must close first/)
})

test("supporting detail uses a keyboard-accessible segmented control and compact disclosure", () => {
  const html = renderWorkspace()
  assert.match(html, /role="tablist" aria-label="Supporting view"/)
  assert.match(html, /role="tab" aria-selected="true"/)
  for (const tab of ["Nearby supply", "Activity record", "Controls &amp; audit"]) assert.match(html, new RegExp(`>${tab}<`))
  assert.match(html, /operating-compact-disclosure enterprise-audit-details/)
  assert.match(html, /Full background record/)
  const auditStart = html.indexOf('<details class="operating-compact-disclosure enterprise-audit-details"')
  assert.ok(auditStart >= 0)
  const auditTag = html.slice(auditStart, html.indexOf(">", auditStart) + 1)
  assert.doesNotMatch(auditTag, /\sopen(?:=|\s|>)/)
})

test("shared Loop Health still qualifies stale claims and exposes integrity evidence", () => {
  const html = renderWorkspace()
  assert.match(html, /aria-label="How reliable is data"/)
  for (const label of ["Data freshness", "Clocks running", "Outcome checks"]) assert.match(html, new RegExp(`>${label}<`))
  assert.match(html, /1 row quarantined/)
  assert.match(html, /11 of 14 outcomes confirmed/)
  assert.match(html, /protected governed references only/)
})

test("UI interactions remain local and preserve all upstream safety boundaries", () => {
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|use server|server action|navigator\.geolocation/)
  assert.match(componentSource, /setShadowAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /setSteps\(\(current\) => current\.map/)
  const html = renderWorkspace()
  for (const boundary of ["productionWrites: blocked", "externalMessages: blocked", "contractChanges: blocked"]) assert.match(html, new RegExp(boundary))
})
