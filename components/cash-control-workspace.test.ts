import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildCashControlPreview } from "@/lib/operating-loop/cash-control-loop"

const componentSource = readFileSync(new URL("./cash-control-workspace.tsx", import.meta.url), "utf8")
const styleSource = readFileSync(new URL("./cash-control-workspace.module.css", import.meta.url), "utf8")
const preview = buildCashControlPreview()

test("standalone workspace has one content heading and no shared-shell integration", () => {
  assert.equal((componentSource.match(/<h2/g) ?? []).length, 1)
  assert.equal((componentSource.match(/<h1/g) ?? []).length, 0)
  assert.match(componentSource, /cash-control-heading/)
  assert.doesNotMatch(componentSource, /nia-dashboard|OPERATIONS_TABS|navigation|app\/globals|SharedLearning|MaterialityEngine/)
  assert.equal((componentSource.match(/<LoopHealthStrip/g) ?? []).length, 1)
})

test("answer-first decision band leads with a verdict, governing recommendation and SCQA", () => {
  const decisionIndex = componentSource.indexOf("styles.decision")
  const healthIndex = componentSource.indexOf("<LoopHealthStrip")
  const headingIndex = componentSource.indexOf("cash-control-heading")
  assert.ok(decisionIndex >= 0 && decisionIndex < healthIndex && decisionIndex < headingIndex, "decision band must render before the health strip and heading")
  assert.match(componentSource, /styles\.verdictPill/)
  assert.match(componentSource, /styles\.governing/)
  assert.match(componentSource, /Why you&apos;re here/)
  assert.match(componentSource, /What changed/)
  assert.match(componentSource, /cashGuardrailLabel = cashProtected \? "Cash protected" : cashAtRisk \? "Cash at risk"/)
  assert.match(componentSource, /destinationApproved \? "destination approved" : "destination needs approval"/)
})

test("every headline exhibit closes with a so-what implication", () => {
  assert.ok((componentSource.match(/styles\.soWhat/g) ?? []).length >= 3, "expected at least three So what lines")
  assert.ok((componentSource.match(/So what:/g) ?? []).length >= 3)
})

test("workspace ends with an explicit owner-and-date ask that transfers accountability", () => {
  const askIndex = componentSource.indexOf("styles.askBand")
  const footerIndex = componentSource.indexOf("styles.sourceNote")
  assert.ok(askIndex >= 0 && askIndex < footerIndex, "closing ask must appear before the source footer")
  assert.match(componentSource, /Decision required/)
  assert.match(componentSource, /const decisionHeading = destinationApproved/)
  assert.match(componentSource, /monthlyCmTargetValue !== null \? `\$\{inr\(monthlyCmTarget\)\}/)
  assert.match(componentSource, /collected-cash target/)
  assert.match(componentSource, /accountability currently sits with \$\{owner\}/)
  assert.match(componentSource, /<dt>Owner<\/dt>/)
  assert.match(componentSource, /<dt>By<\/dt>/)
})

test("first viewport preserves target through verified-result order", () => {
  let cursor = -1
  for (const label of ["Target", "Current", "Gap", "Owner", "Progress", "Verified result"]) {
    const next = componentSource.indexOf(`\"${label}\"`, cursor + 1)
    assert.ok(next > cursor, label)
    cursor = next
  }
  assert.equal(preview.question, "What must Nia deliver this month, is cash protected, and is system work verified?")
})

test("exactly four locked face measures are projected", () => {
  assert.equal(preview.measures.length, 4)
  assert.match(componentSource, /data-measure-id/)
  assert.deepEqual(preview.measures.map((measure) => measure.label), ["CM destination", "Opex control", "Cash protection", "Leakage & closure"])
})

test("live Sheet snapshot drives the remaining Cash and Control sections", () => {
  for (const field of ["cm2 inr", "opex forecast inr", "opex cap inr", "cash balance inr", "current due inr", "amount inr", "linked action id", "decision"]) {
    assert.match(componentSource, new RegExp(field))
  }
  assert.match(componentSource, /liveMeasures/)
  assert.match(componentSource, /liveControlPath/)
  assert.match(componentSource, /liveFinancialRails/)
  assert.match(componentSource, /liveClosureCounts/)
  assert.match(componentSource, /measures: liveData \? liveMeasures/)
  assert.match(componentSource, /controlPath: liveData \? liveControlPath/)
  assert.match(componentSource, /financialRails: liveData \? liveFinancialRails/)
  assert.match(componentSource, /closureCounts: liveData \? liveClosureCounts/)
  assert.match(componentSource, /staleFeeds\.length/)
  assert.match(componentSource, /oldestFeed\.ageLabel/)
  assert.match(componentSource, /loopHealth\.feeds\.map/)
  assert.match(componentSource, /liveData\?\.financeSource/)
  assert.match(componentSource, /latestTimestamp\(financeSource\)/)
  assert.match(componentSource, /Last source update/)
  assert.match(componentSource, /Expected cadence/)
  assert.match(componentSource, /affectedClaims\.join/)
  assert.match(componentSource, /content\("monthly_command", "question"/)
  assert.match(componentSource, /content\("monthly_command", "owner_note"/)
  assert.match(componentSource, /optionalNumberFor\(finance\?\.\["cm target inr"\]\) \?\? optionalNumberFor\(liveData\?\.monthlyCMTarget\)/)
  assert.match(componentSource, /aggregateLatestFinanceSnapshots\(financeRows\)/)
  assert.match(componentSource, /optionalSheetNumber as optionalNumberFor/)
  assert.match(componentSource, /Balance not recorded/)
  assert.match(componentSource, /No deadline recorded/)
  assert.match(componentSource, /CM remaining against the approved monthly destination/)
  for (const label of ["Cash guardrail", "OPEX control", "Collection leakage", "Closure integrity"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /liveData\?\.channels/)
  assert.match(componentSource, /rankChannelMix\(liveChannelRows/)
  assert.match(componentSource, /content\("monthly_control_path", "heading"/)
  assert.match(componentSource, /content\("control_path_implication", "pending_summary"/)
  assert.match(componentSource, /content\("control_path_implication", "approved_detail"/)
  for (const label of ["Destination approval", "Monthly CM target", "Remaining CM gap", "Cascade"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /destinationApproval/)
  assert.match(componentSource, /Approval_Log decision/)
  assert.match(componentSource, /content\("channel_recommendation", "heading"/)
  assert.match(componentSource, /row\.dataFreshness\.toLowerCase/)
  assert.match(componentSource, /content\("channel_implication", "pending_summary"/)
  for (const label of ["Top-ranked channel", "Expected verified CM", "Cash needed", "Decision boundary"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /liveOpenTasks/)
  assert.match(componentSource, /content\("open_work", "heading"/)
  assert.match(componentSource, /content\("open_work", "eyebrow"/)
  assert.match(componentSource, /action=\{task\.engineAction\.nextAction\}/)
  assert.match(componentSource, /liveApprovalCards/)
  assert.match(componentSource, /terminalApprovalActionIds/)
  assert.match(componentSource, /liveLearningInputs/)
  assert.match(componentSource, /learningHistoryRows/)
  assert.match(componentSource, /Approval_Log \$\{approval\.approvalId\}/)
  assert.match(componentSource, /liveAuditEvents/)
  assert.match(componentSource, /Append-only Sheet audit/)
  assert.match(componentSource, /Automatically enforced system policy/)
  assert.match(componentSource, /content\("human_approvals", "heading"/)
  assert.match(componentSource, /action=\{approval\.nextAction\}/)
  assert.match(componentSource, /No open financial actions for the selected filters/)
  assert.match(componentSource, /No pending human approvals for the selected filters/)
})

test("source and confidence exposes live feed health and verification confidence", () => {
  assert.match(componentSource, /loopHealth\.feeds\.length/)
  assert.match(componentSource, /staleFeeds\.length/)
  assert.match(componentSource, /loopHealth\.state/)
  assert.match(componentSource, /liveClosureCounts\.verified/)
  assert.match(componentSource, /liveClosureCounts\.claimed/)
})

test("monthly control path follows destination through month close", () => {
  assert.deepEqual(preview.controlPath.map((step) => step.label), ["Monthly destination", "Verified baseline", "Remaining gap", "Channel recommendation", "Cash feasibility", "Cascade", "Hourly recovery", "Month close"])
  assert.match(componentSource, /Approve the destination, protect cash, then verify every outcome/)
  assert.match(componentSource, /No silent target reduction/)
})

test("channel recommendations never expose a fixed allocation", () => {
  assert.match(componentSource, /Recommend the mix; never impose a fixed split/)
  assert.match(componentSource, /No allocation set/)
  assert.ok(preview.channelRecommendations.every((row) => row.allocationPct === null && row.recommendationOnly))
})

test("locked cash controls remain visible in plain words", () => {
  assert.match(JSON.stringify(preview.measures), /₹60L cap/)
  assert.match(JSON.stringify(preview.measures), /₹150L guardrail/)
  assert.match(componentSource, /Locked controls are protected/)
})

test("pending decisions retain named human authority", () => {
  assert.match(componentSource, /Financial controls cannot approve themselves/)
  assert.match(componentSource, /No automatic exception/)
  assert.ok(preview.approvals.every((approval) => approval.owner === "Pushkar" && approval.status === "Pending human approval"))
})

test("pending values and learning inputs remain in a closed native disclosure", () => {
  const details = componentSource.indexOf("<details")
  const pending = componentSource.indexOf("Versioned controls and pending approvals")
  assert.ok(details >= 0 && pending > details)
  assert.match(componentSource, /No value approved/)
  assert.doesNotMatch(componentSource.slice(details, componentSource.indexOf("<summary", details)), /\sopen(?:=|\s|>)/)
  assert.ok(preview.policyRegistry.some((policy) => policy.status === "Pending human approval" && policy.value === null))
})

test("shadow controls update local append-only state with no live side effects", () => {
  assert.match(componentSource, /setTasks\(\(current\) => current\.map/)
  assert.match(componentSource, /setAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /No approval, payment, message or Production write/)
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.geolocation|use server|server action/)
})

test("missed hour copy re-slots work and preserves the target", () => {
  assert.match(componentSource, /const recoverySummary =/)
  assert.match(componentSource, /const recoveryDetail =/)
  assert.match(componentSource, /openTaskCount/)
  assert.match(componentSource, /awaitingEvidenceCount/)
  assert.match(componentSource, /reopenedCount/)
  assert.match(componentSource, /monthlyCmTarget/)
})

test("learning section exposes materiality, confidence and no auto-adoption", () => {
  for (const label of ["Proposal", "Expected effect", "Evidence", "Attribution", "Forecast error", "Fresh / reversible", "Approved boundary", "Human controls", "Effects", "Materiality / confidence", "Adoption / rollback"]) assert.match(componentSource, new RegExp(label.replace("/", "\\/")))
  assert.ok(preview.learningInputs.every((input) => input.production_confidence === "Low" && input.auto_adopt === false))
  assert.deepEqual(preview.learningInputs[0].confounders, ["confounders not ruled out"])
})

test("fixtures expose protected references and no real financial identity", () => {
  assert.doesNotMatch(JSON.stringify(preview), /\+91|\b\d{10}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|rawBankAccount|rawCustomerIdentity/i)
  assert.match(componentSource, /protected references only/)
})

test("forbidden legacy values and terms do not appear", () => {
  const all = `${componentSource}\n${JSON.stringify(preview)}`
  assert.doesNotMatch(all, /\bFloat\b|₹500|₹612|50\s*\/\s*50/i)
})

test("scoped styles support desktop, tablet and mobile without gradients or black hero", () => {
  assert.match(componentSource, /cash-control-workspace\.module\.css/)
  assert.match(styleSource, /grid-template-columns:\s*repeat\(4/)
  assert.match(styleSource, /@media \(max-width: 1100px\)/)
  assert.match(styleSource, /@media \(max-width: 700px\)/)
  assert.match(styleSource, /@media \(max-width: 430px\)/)
  assert.match(styleSource, /overflow-x:\s*auto/)
  assert.doesNotMatch(styleSource, /linear-gradient|radial-gradient|#000(?:000)?\b|background:\s*black/)
})
