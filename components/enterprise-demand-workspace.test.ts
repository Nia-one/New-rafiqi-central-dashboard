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

test("Enterprise Demand replaces Demand activation in one Operations path", () => {
  assert.equal(OPERATIONS_TABS.filter((tab) => tab === "Enterprise Demand").length, 1)
  assert.equal((OPERATIONS_TABS as readonly string[]).some((tab) => tab === "Demand activation"), false)
  assert.equal((dashboardSource.match(/active === "Enterprise Demand"/g) ?? []).length, 1)
  assert.doesNotMatch(dashboardSource, /active === "Demand activation"/)
})

test("the global shell supplies the only H1 and exact Enterprise Demand hierarchy", () => {
  assert.equal((dashboardSource.match(/<h1/g) ?? []).length, 1)
  assert.doesNotMatch(componentSource, /<h1/)
  assert.match(dashboardSource, /"Enterprise Demand": \{ title: "Enterprise Demand", subtitle: "Turn every signed arrival into a verified 2 km, then 5 km capacity loop\."/)
})

test("the task band carries a verdict pill and a plain governing recommendation", () => {
  assert.match(componentSource, /enterprise-verdict/)
  assert.match(componentSource, /enterprise-governing/)
  assert.match(componentSource, /Work Ring 1 \(0–2 km\) to exhaustion before opening the 5 km search/)
})

test("every headline exhibit closes with a so-what implication", () => {
  assert.ok((componentSource.match(/enterprise-so-what/g) ?? []).length >= 3, "expected at least three So what lines")
  assert.ok((componentSource.match(/So what:/g) ?? []).length >= 3)
})

test("workspace ends with an explicit owner-and-date ask before the source footer", () => {
  const askIndex = componentSource.indexOf("enterprise-ask")
  const footerIndex = componentSource.indexOf("enterprise-source-note")
  assert.ok(askIndex >= 0 && askIndex < footerIndex, "closing ask must precede the source footer")
  assert.match(componentSource, /Decision required/)
  assert.match(componentSource, /accountability sits with Ops Control/)
  assert.match(componentSource, /<dt>Owner<\/dt>/)
  assert.match(componentSource, /<dt>By<\/dt>/)
})

test("the first viewport leads with the data-derived task, compact measures, nearby capacity and next action", () => {
  const html = renderWorkspace()
  assert.match(html, /Close 40 verified-ready Nests around Vikram Solar before the 26 July arrival\./)
  for (const measure of ["Signed target", "Verified ready", "Gap to close", "Required run rate"]) assert.match(html, new RegExp(`>${measure}<`))
  assert.match(html, /40 Nests available within 2 km/)
  assert.match(html, /Ring 2 · 2–5 km/)
  assert.match(html, /Ring 1 · 0–2 km/)
  assert.match(html, /Do this next/)
  assert.doesNotMatch(html.slice(0, html.indexOf("Calls and visits today")), /Full contract register|Actual price|Commercial terms table/)
})

test("the journey exposes the eight-stage pizza tracker using counts and percentage", () => {
  const html = renderWorkspace()
  for (const stage of ["Triggered", "Plan built", "Calls underway", "Evidence received", "Independently verified", "Capacity covered", "Members arrived", "Billing live"]) assert.match(html, new RegExp(`>${stage}<`))
  assert.match(html, /25% of steps to completion finished/)
  assert.equal((html.match(/enterprise-pizza-chart/g) ?? []).length, 1)
})

test("FONO renders before SP and both lanes retain different stage sequences", () => {
  const html = renderWorkspace()
  const fono = html.indexOf('data-supply-lane="FONO"')
  const sp = html.indexOf('data-supply-lane="SP"')
  assert.ok(fono >= 0 && sp > fono)
  for (const label of ["Vacant Nests reserved", "Readiness verified", "Park contracted", "Build / hardware done", "Services live", "Spec verified"]) assert.match(html, new RegExp(label.replace("/", "\\/")))
})

test("ordered work requires dispositions while every blocked exception remains visible", () => {
  const html = renderWorkspace()
  for (const outcome of ["Reached", "No answer", "Follow-up booked", "Unsuitable", "Spec mismatch", "Commercial exception", "Evidence pending", "Verified ready"]) assert.match(html, new RegExp(`>${outcome}<`))
  for (const exception of buildEnterpriseDemandLoopPreview().exceptions) assert.match(html, new RegExp(`<h3>${exception.issue}</h3>`))
  assert.match(html, new RegExp(`${buildEnterpriseDemandLoopPreview().exceptions.length} issues need human help`))
  assert.match(html, /Ops Control owns closure/)
  assert.equal((html.match(/disabled=""/g) ?? []).length, 4, "Both Ring 2 selects and buttons must remain gated")
  assert.match(html, /Ring 1 must close first/)
})

test("freshness, quarantine, safeguards and source metadata are consolidated without a second hero", () => {
  const html = renderWorkspace()
  assert.match(html, /Contracts 2h old/)
  assert.match(html, /1 row quarantined/)
  assert.equal((html.match(/aria-label="How reliable is data"/g) ?? []).length, 1)
  assert.match(html, /Full background record/)
  assert.match(html, /protected references only · synthetic\/shadow/)
  assert.doesNotMatch(componentSource, /closed-loop-status-band|background:\s*var\(--ink\)/)
})

test("the shared Loop Health strip qualifies stale claims and exposes all three integrity callouts", () => {
  const html = renderWorkspace()
  assert.match(html, /aria-label="How reliable is data"/)
  assert.match(html, /data-overview-answer-allowed="true"/)
  for (const label of ["Data freshness", "Clocks running", "Outcome checks"]) assert.match(html, new RegExp(`>${label}<`))
  assert.match(html, /loop-health-meter-track/)
  assert.match(html, /aria-label="2h old, cadence 1h"/)
  assert.match(html, /1 row quarantined/)
  assert.match(html, /loop-health-verify-bar/)
  assert.match(html, /outcomes independently confirmed/)
  for (const label of ["Confirmed", "Waiting", "Reopened"]) assert.match(html, new RegExp(`${label}<b>`))
  assert.match(html, /has-stale-input/)
  assert.match(html, /Close 40 verified-ready Nests around Vikram Solar before the 26 July arrival\. \(Contracts 2h old\)/)
})

test("contract detail and audit remain in a closed native disclosure", () => {
  const html = renderWorkspace()
  const disclosure = html.indexOf('<details class="enterprise-audit-details">')
  const summary = html.indexOf("Full background record")
  assert.ok(disclosure >= 0 && summary > disclosure)
  assert.doesNotMatch(html.slice(disclosure, summary), /\sopen(?:=|\s|>)/)
  for (const detail of ["Contract-specific readiness", "Priority overrides and field safety", "Governed registry", "Append-only synthetic audit", "Structural action boundary"]) assert.ok(html.indexOf(detail, summary) > summary)
})

test("shadow interactions append local state and no live side-effect path exists", () => {
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|use server|server action|navigator\.geolocation/)
  assert.match(componentSource, /setShadowAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /setSteps\(\(current\) => current\.map/)
  const html = renderWorkspace()
  assert.match(html, /Local preview only/)
  assert.match(html, /productionWrites: blocked/)
  assert.match(html, /externalMessages: blocked/)
  assert.match(html, /contractChanges: blocked/)
})
