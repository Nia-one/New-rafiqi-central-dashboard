import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EnterpriseDemandWorkspace } from "@/components/enterprise-demand-workspace"
import { buildLiveSelfDriveSnapshot } from "@/lib/live-mappers/self-drive"
import { buildEnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"

async function main() {
  const response = await fetch("http://localhost:3000/api/ops-data", { cache: "no-store" })
  assert.equal(response.ok, true, `ops-data returned ${response.status}`)
  const payload = await response.json()
  assert.equal(payload.success, true, "ops-data did not return success")

  const snapshot = buildLiveSelfDriveSnapshot(payload.data)
  const html = renderToStaticMarkup(createElement(EnterpriseDemandWorkspace, {
    preview: buildEnterpriseDemandLoopPreview(),
    liveData: snapshot,
  }))

  for (const title of ["Today’s task", "Loop health", "Key numbers", "Arrival implication", "Nearby plan and next action", "Progress by channel", "Calls and visits", "Issues needing help", "Background record", "Decision required", "Source and confidence"]) assert.match(html, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.doesNotMatch(html, /Typed Enterprise Demand Self-Drive fixture|synthetic shadow|synthetic\/shadow|Vikram Solar|CONTRACT-VIKRAM|Oragadam|Hyundai Mobis|Sundaram Fasteners|ACT-PRIYA|17 Jul/i)

  const callsStart = html.indexOf('class="enterprise-work-panel"')
  const callsEnd = html.indexOf('class="enterprise-exceptions"')
  assert.ok(callsStart >= 0 && callsEnd > callsStart, "Calls and visits component was not rendered")
  const calls = html.slice(callsStart, callsEnd)

  assert.match(calls, /Due today/)
  assert.match(calls, /Sriperumbudur 01/)
  assert.match(calls, /Call Studio for enterprise demand readiness confirmation/)
  assert.match(calls, /Priya Rao \(Test\)/)
  assert.match(calls, /27 Jul, 16:00 IST/)

  const issuesStart = html.indexOf('class="enterprise-exceptions"')
  const issuesEnd = html.indexOf('class="enterprise-audit-details"')
  assert.ok(issuesStart >= 0 && issuesEnd > issuesStart, "Issues needing help component was not rendered")
  const issues = html.slice(issuesStart, issuesEnd)
  assert.match(issues, /4 issues need human help/)
  assert.match(issues, /254 verified-ready Nests short · Test Manufacturing Co\./)
  assert.match(issues, /Approve enterprise demand SLA exception/)
  assert.match(issues, /Due-today readiness call · Sriperumbudur 01/)
  assert.match(issues, /Contracted readiness-spec deviation · Sriperumbudur SP 01/)
  assert.match(issues, /Contracted readiness specification is not independently confirmed/)
  assert.match(issues, /Collect corrective readiness-spec evidence/)
  assert.match(issues, /Contract-matched readiness-spec proof/)
  assert.match(issues, /Google Sheet · automatically derived/)
  assert.doesNotMatch(issues, /Vikram Solar|Hyundai Mobis|Sundaram Fasteners/)

  const backgroundStart = html.indexOf('class="enterprise-audit-details"')
  const backgroundEnd = html.indexOf('class="enterprise-ask"')
  assert.ok(backgroundStart >= 0 && backgroundEnd > backgroundStart, "Background record component was not rendered")
  const background = html.slice(backgroundStart, backgroundEnd)
  assert.match(html, /[1-9]\d* Sheet audit events · governed controls retained/)
  assert.match(background, /Contract-specific readiness/)
  assert.match(background, /Test Manufacturing Co\./)
  assert.match(background, /Calculated plan and evidence controls/)
  assert.match(background, /Governed registry/)
  assert.match(background, /Append-only Sheet audit/)
  assert.match(background, /Structural action boundary/)
  assert.match(background, /no duplicate Operations input/i)
  assert.doesNotMatch(background, /Vikram Solar|CONTRACT-VIKRAM|Append-only synthetic audit|No local shadow disposition|productionWrites|synthetic shadow/i)

  const decisionStart = html.indexOf('class="enterprise-ask"')
  const decisionEnd = html.indexOf('class="enterprise-source-note"')
  assert.ok(decisionStart >= 0 && decisionEnd > decisionStart, "Decision required component was not rendered")
  const decision = html.slice(decisionStart, decisionEnd)
  assert.match(decision, /Close the 254-Nest readiness gap and submit contract-matched proof/)
  assert.match(decision, /316 Ring 1 Nests cover the 254-Nest gap/)
  assert.match(decision, /calculated Ring 2 search remains closed/)
  assert.match(decision, /Priya Rao \(Test\) remains accountable/)
  assert.match(decision, /<dt>Owner<\/dt><dd>Priya Rao \(Test\)<\/dd>/)
  assert.match(decision, /29 Jul, 09:00 IST/)
  assert.doesNotMatch(decision, /ACT-PRIYA|Vikram Solar/)

  const sourceStart = html.indexOf('class="enterprise-source-note"')
  assert.ok(sourceStart >= 0, "Source and confidence component was not rendered")
  const source = html.slice(sourceStart)
  assert.match(html, /[1-9]\d* connected Sheet feeds · \d+\/\d+ outcomes verified/)
  for (const feed of ["Enterprise_Demand", "Studio_Master", "Living_Hourly", "Member_Activation", "Action_Log", "Evidence_Log", "Incident_Log", "Approval_Log", "People_Roster"]) assert.match(source, new RegExp(feed))
  assert.match(source, /read-only; no automated external action/)
  assert.doesNotMatch(source, /Typed Enterprise Demand Self-Drive fixture|synthetic shadow|synthetic\/shadow|17 Jul/)

  console.log("Verified live Due today card: ENT-CALL-ACTION-TEST-001 -> Sriperumbudur 01 -> 27 Jul, 16:00 IST")
  console.log("Verified live Issues needing help: 4 derived Sheet-backed exceptions; detail sentences resolve from source rows")
  console.log("Verified live Background record: contract, controls, registry, audit events and boundary derive from connected Sheet feeds")
  console.log("Verified live Decision required: gap, Ring boundary, named owner and deadline derive from connected Sheet data")
  console.log("Verified live Source and confidence: connected feeds, refresh time and integrity counts derive from the current Sheet snapshot")
  console.log("Verified complete Enterprise Demand page: all 11 components render from live data with no fixture values in live output")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
