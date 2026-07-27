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

function renderLiveWorkspace() {
  return renderToStaticMarkup(createElement(EnterpriseDemandWorkspace, {
    preview: buildEnterpriseDemandLoopPreview(),
    liveData: {
      enterpriseDemand: [{ "demand id": "DEM-TEST-001", "enterprise name": "Test Manufacturing Co.", latitude: "12.9650", longitude: "79.9430", "headcount required": "500", "role required": "Assembly operator", shift: "Day", status: "Open", "owner actor id": "ACT-PRIYA", "activation required at": "2026-07-29T09:00:00+05:30" }],
      summary: { readyNests: 246 },
      living: [
        { "living hourly id": "LIV-FONO", "supply model": "FONO", "activation ready nests": "96" },
        { "living hourly id": "LIV-SP", "supply model": "SP", "activation ready nests": "150" },
      ],
      studios: [
        { "studio id": "CRM-SRI-D01-S01", "studio name": "Nia Nest Menaka Ramdas", latitude: "12.9660", longitude: "79.9440", "supply model": "FONO", "contracted nests": "60", "activation ready nests": "40", "readiness status": "Verified ready" },
        { "studio id": "CRM-SRI-D01-S09", "studio name": "Nia Nest Vasu", latitude: "12.9700", longitude: "79.9500", "supply model": "SP", "contracted nests": "50", "activation ready nests": "30", "readiness status": "Verified ready" },
        { "studio id": "CRM-SRI-D01-S08", "studio name": "Nia Nest Hemalata Elumalai", latitude: "12.9900", longitude: "79.9700", "supply model": "FONO", "contracted nests": "80", "activation ready nests": "50", "readiness status": "In progress" },
      ],
      people: [{ "actor id": "ACT-PRIYA", "display name": "Priya Rao (Test)" }],
      actions: [
        { "action id": "SD-ACTION-ENT-TEST-001", "operating objective": "Approve enterprise demand SLA exception", "expected metric": "Matched headcount", state: "Proposed", "owner actor id": "ACT-PRIYA", "due at": "2026-07-27T14:00:00+05:30", "proposed at": "2026-07-26T12:00:00+05:30" },
        { "action id": "ENT-CALL-ACTION-TEST-001", "incident id": "ENT-CALL-INC-TEST-001", "operating objective": "Call Studio for enterprise demand readiness confirmation", "expected metric": "Activation ready nests", "required evidence": "Current Studio readiness confirmation", state: "Detected", "owner actor id": "ACT-PRIYA", "due at": "2026-07-27T16:00:00+05:30", "proposed at": "2026-07-27T10:00:00+05:30" },
      ],
      approvals: [{ "approval id": "SD-APR-ENT-TEST-001", "linked action id": "SD-ACTION-ENT-TEST-001", decision: "Pending", "approver actor id": "ACT-PRIYA", "updated at": "2026-07-26T12:00:00+05:30" }],
      evidence: [{ "evidence id": "EVD-ENT-TEST-001", "linked id": "SD-ACTION-ENT-TEST-001", "verification status": "Pending", "uploaded at": "2026-07-26T12:30:00+05:30" }],
      incidents: [{ "incident id": "ENT-CALL-INC-TEST-001", domain: "Enterprise Demand", "incident type": "Due-today readiness call", "studio id": "CRM-SRI-D01-S08", severity: "Medium", "severity reason": "Named enterprise arrival requires a current readiness confirmation", state: "Open" }],
      asOf: "2026-07-26T13:37:00+05:30",
    },
  }))
}

function renderEmptyFilteredWorkspace() {
  return renderToStaticMarkup(createElement(EnterpriseDemandWorkspace, {
    preview: buildEnterpriseDemandLoopPreview(),
    liveData: { enterpriseDemand: [], summary: { readyNests: 0 }, studios: [], living: [], activations: [], actions: [], evidence: [], incidents: [], approvals: [], people: [], asOf: "2026-07-26T13:37:00+05:30" },
  }))
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

test("the live task band contains no fixture values and derives every displayed result from connected rows", () => {
  const html = renderLiveWorkspace()
  assert.match(html, /Google Sheet · live read-only/)
  assert.match(html, /Test Manufacturing Co\. needs 500 verified ready Nests/)
  assert.match(html, /246 of 500 Nests are verified ready for Assembly operator on the Day shift/)
  assert.match(html, /Behind · 254 Nests to close/)
  assert.match(html, /Priya Rao \(Test\)/)
  assert.match(html, /49% · Pending approval/)
  assert.match(html, /246\/500 Nests/)
  const firstComponent = html.slice(html.indexOf('class="enterprise-today-task"'), html.indexOf('aria-label="How reliable is data"'))
  assert.doesNotMatch(firstComponent, /Synthetic fixture|shadow only|25%|Reopened/i)
})

test("live loop health is calculated from Enterprise Demand logs instead of fixture verification counts", () => {
  const html = renderLiveWorkspace()
  assert.match(html, /Attention · 0\/2 verified/)
  assert.match(html, /<b>0 of 2<\/b><span>outcomes independently confirmed<\/span>/)
  assert.match(html, /Waiting<b>2<\/b>/)
  assert.match(html, /Reopened<b>0<\/b>/)
  assert.match(componentSource, /Enterprise Demand · signed arrival/)
  assert.match(componentSource, /Action Log · demand recovery/)
  assert.match(componentSource, /Evidence Log · readiness proof/)
  assert.doesNotMatch(html, /11\/14 verified|11 of 14|1 row quarantined/)
})

test("live key numbers derive reference, supply split, arrival gap and run rate from Sheet rows", () => {
  const html = renderLiveWorkspace()
  assert.match(html, /Nests · DEM-TEST-001/)
  assert.match(html, /FONO 96 · SP 150/)
  assert.match(html, /3 days to arrival/)
  assert.match(html, />4\/hr</)
  assert.match(html, /0 missed follow-ups rolled forward/)
  const keyNumbers = html.slice(html.indexOf('aria-label="Key numbers at glance"'), html.indexOf('class="enterprise-first-viewport"'))
  assert.doesNotMatch(keyNumbers, /CONTRACT-VIKRAM|FONO 60|SP 80|9 days|2 missed/)
})

test("arrival implication sentence is generated from the live gap, run rate and deadline", () => {
  const html = renderLiveWorkspace()
  assert.match(html, /254 Nests must close before 29 Jul, 09:00 IST/)
  assert.match(html, /254 Nests must clear at 4\/hr before 29 Jul, 09:00 IST/)
  assert.match(html, /signed 500-Nest capacity misses its committed date/)
  assert.doesNotMatch(html, /the gap must clear at the required hourly rate before the arrival date/)
})

test("nearby plan, next action and eight-stage progress are calculated from existing Sheet tabs", () => {
  const html = renderLiveWorkspace()
  assert.match(html, /Ring 1 has 70 Nests · Call/)
  assert.match(html, /70 Nests available within 2 km/)
  assert.match(html, /Gap 254 · 5 km search open/)
  assert.match(html, /Call Nia Nest Hemalata Elumalai/)
  assert.match(html, /Sheet-driven demand-node plan/)
  assert.match(html, /Ring 1 is 184 Nests short/)
  assert.match(html, /2\/3/)
  assert.match(html, /246\/500/)
  const nearby = html.slice(html.indexOf('class="enterprise-first-viewport"'), html.indexOf('class="enterprise-supply-lanes"'))
  assert.doesNotMatch(nearby, /Oragadam|40 Nests available|140\/180|synthetic/i)
})

test("progress by channel is derived separately from Studio, Living and Member Activation rows", () => {
  const html = renderLiveWorkspace()
  assert.match(html, /FONO 40 verified · SP 30 spec verified/)
  assert.match(html, /0 recorded Member arrivals and 0 billed activations/)
  const lanes = html.slice(html.indexOf('class="enterprise-supply-lanes"'), html.indexOf('class="enterprise-work-panel"'))
  const laneValues = Object.fromEntries([...lanes.matchAll(/<span>([^<]+)<\/span><b>(\d+)<\/b>/g)].map((match) => [match[1], Number(match[2])]))
  assert.deepEqual(laneValues, {
    "Vacant Nests reserved": 140,
    "Readiness verified": 40,
    "Members arrived": 0,
    Billing: 0,
    "Park contracted": 50,
    "Build / hardware done": 30,
    "Services live": 0,
    "Spec verified": 30,
  })
  assert.doesNotMatch(lanes, />64<|>60<|>96<|>84<|>80</)
})

test("calls and visits are a read-only Sheet-driven plan with resolved owners and recorded states", () => {
  const html = renderLiveWorkspace()
  const calls = html.slice(html.indexOf('class="enterprise-work-panel"'), html.indexOf('class="enterprise-exceptions"'))
  assert.match(html, /3 Studio candidates · 2 km first · Sheet-driven/)
  assert.match(calls, /3 Studio candidates in the calculated plan/)
  assert.match(calls, /2 km first · Sheet-driven plan/)
  assert.match(calls, /Calls and visits plan/)
  assert.match(calls, /Nia Nest Menaka Ramdas/)
  assert.match(calls, /Priya Rao \(Test\)/)
  assert.match(calls, /Verified ready/)
  assert.match(calls, /Due today/)
  assert.match(calls, /Call Studio for enterprise demand readiness confirmation/)
  assert.match(calls, /Nia Nest Hemalata Elumalai/)
  assert.match(calls, /27 Jul, 16:00 IST/)
  assert.match(calls, /26 Jul/)
  assert.doesNotMatch(calls, /22 Jul|status advances from|preview only|Local preview only|>Record<|ACT-PRIYA/)
  assert.doesNotMatch(componentSource, /hasBilling \|\| \/closed\|resolved/)
})

test("background record is assembled from live demand, governed actions, evidence, incidents and approvals", () => {
  const html = renderLiveWorkspace()
  const background = html.slice(html.indexOf('class="enterprise-audit-details"'), html.indexOf('class="enterprise-ask"'))
  assert.match(html, /5 Sheet audit events · governed controls retained/)
  assert.match(background, /Contract-specific readiness/)
  assert.match(background, /Test Manufacturing Co\./)
  assert.match(background, /DEM-TEST-001/)
  assert.match(background, /Assembly operator \/ Day/)
  assert.match(background, /500 \/ 246 Nests/)
  assert.match(background, /Calculated plan and evidence controls/)
  assert.match(background, /70 Ring 1 Nests recorded/)
  assert.match(background, /254 Nests remain to be independently verified/)
  assert.match(background, /3 Studio candidates in the Sheet-driven plan/)
  assert.match(background, /1 linked evidence records await verification/)
  assert.match(background, /Governed registry/)
  assert.match(background, /SD-APR-ENT-TEST-001/)
  assert.match(background, /Append-only Sheet audit/)
  assert.match(background, /Incident · Open/)
  assert.match(background, /Action · Proposed/)
  assert.match(background, /Evidence · Pending/)
  assert.match(background, /Approval · Pending/)
  assert.match(background, /1 open Enterprise Demand incidents · 2 governed actions · 1 named approvals pending/)
  assert.doesNotMatch(background, /CONTRACT-VIKRAM|Append-only synthetic audit|No local shadow disposition|productionWrites|synthetic shadow/i)
})

test("decision required derives its gap, search boundary, named owner and deadline from live data", () => {
  const html = renderLiveWorkspace()
  const decision = html.slice(html.indexOf('class="enterprise-ask"'), html.indexOf('class="enterprise-source-note"'))
  assert.match(html, /Close the 254-Nest readiness gap/)
  assert.match(decision, /Close the 254-Nest readiness gap and submit contract-matched proof/)
  assert.match(decision, /70 Ring 1 Nests do not cover the 254-Nest gap/)
  assert.match(decision, /calculated Ring 2 search is open/)
  assert.match(decision, /Priya Rao \(Test\) remains accountable/)
  assert.match(decision, /<dt>Owner<\/dt><dd>Priya Rao \(Test\)<\/dd>/)
  assert.match(decision, /29 Jul, 09:00 IST/)
  assert.doesNotMatch(decision, /ACT-PRIYA|5 km search stays closed|Vikram Solar|Ops Control/)
})

test("source and confidence reports the connected Sheet feeds and calculated verification state", () => {
  const html = renderLiveWorkspace()
  const source = html.slice(html.indexOf('class="enterprise-source-note"'))
  assert.match(html, /8 connected Sheet feeds · 0\/2 outcomes verified/)
  for (const feed of ["Enterprise_Demand", "Studio_Master", "Living_Hourly", "Action_Log", "Evidence_Log", "Incident_Log", "Approval_Log", "People_Roster"]) assert.match(source, new RegExp(feed))
  assert.match(source, /26 Jul, 13:37 IST/)
  assert.match(source, /Attention · 0 stale · 2 awaiting verification · 0 reopened · read-only; no automated external action/)
  assert.doesNotMatch(source, /Typed Enterprise Demand Self-Drive fixture|synthetic shadow|synthetic\/shadow|17 Jul/)
})

test("an empty filtered live result never falls back to the Enterprise Demand fixture", () => {
  const html = renderEmptyFilteredWorkspace()
  assert.match(html, /No Enterprise Demand row matches the current filters/)
  assert.match(html, /No signed Enterprise Demand row is available for the selected filters; no fixture value is substituted/)
  assert.match(html, /No matching Enterprise Demand data/)
  assert.match(html, /No Enterprise Demand decision is required for the selected filters/)
  assert.match(html, /No matching signed demand, governed action, or arrival deadline is available/)
  assert.match(html, /Cannot confirm · 0\/0 verified/)
  assert.match(html, /Enterprise Demand · no matching row/)
  assert.match(html, /No matching arrival data/)
  assert.match(html, /no signed demand or arrival deadline matches the selected filters/)
  assert.doesNotMatch(html, /Vikram Solar|CONTRACT-VIKRAM|Oragadam|ACT-DEMAND-JCO|40 verified-ready Nests|Typed Enterprise Demand Self-Drive fixture|synthetic shadow/i)
})

test("issues needing help are automatically derived from live demand, incidents, actions and approvals", () => {
  const html = renderLiveWorkspace()
  const issues = html.slice(html.indexOf('class="enterprise-exceptions"'), html.indexOf('class="enterprise-audit-details"'))
  assert.match(issues, /3 issues need human help/)
  assert.match(issues, /Google Sheet · automatically derived/)
  assert.match(issues, /254 verified-ready Nests short · Test Manufacturing Co\./)
  assert.match(issues, /Shortfall open · 246\/500 recorded/)
  assert.match(issues, /Close the 254-Nest readiness gap/)
  assert.match(issues, /Approve enterprise demand SLA exception/)
  assert.match(issues, /Pending human approval/)
  assert.match(issues, /Due-today readiness call · Nia Nest Hemalata Elumalai/)
  assert.match(issues, /Call Studio for enterprise demand readiness confirmation/)
  assert.match(issues, /Named enterprise arrival requires a current readiness confirmation/)
  assert.match(issues, /Current Studio readiness confirmation/)
  assert.match(issues, /Priya Rao \(Test\)/)
  assert.doesNotMatch(issues, /Vikram Solar|Hyundai Mobis|Sundaram Fasteners|Coromandel Demand JCO/)
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
  assert.match(componentSource, /setLocalSteps\(\(current\) => current\.map/)
  const html = renderWorkspace()
  assert.match(html, /Local preview only/)
  assert.match(html, /productionWrites: blocked/)
  assert.match(html, /externalMessages: blocked/)
  assert.match(html, /contractChanges: blocked/)
})
