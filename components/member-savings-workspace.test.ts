import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildMemberSavingsPreview, type SavingsTaskPreview, type MemberSavingsShadowOutcome } from "@/lib/operating-loop/member-savings-loop"
import { resolveMemberSavingsAskDueAt, synchronizeMemberSavingsTaskState } from "./member-savings-workspace-helpers"

const componentSource = readFileSync(new URL("./member-savings-workspace.tsx", import.meta.url), "utf8")
const styleSource = readFileSync(new URL("./member-savings-workspace.module.css", import.meta.url), "utf8")
const preview = buildMemberSavingsPreview()

const taskFixture = (actionId: string, state: SavingsTaskPreview["state"] = "Detected"): SavingsTaskPreview => ({
  actionId,
  issue: `Issue ${actionId}`,
  service: "Studio A",
  owner: "Alex",
  dueAt: "2026-07-27T00:00:00.000Z",
  expectedMetric: "Dual gate",
  progress: "Pending",
  verifiedResult: "Not yet independently verified",
  state,
  engineAction: {} as SavingsTaskPreview["engineAction"],
})

test("synchronizeMemberSavingsTaskState preserves shadow state for surviving tasks and resets new ones to unresolved", () => {
  const priorTasks = [taskFixture("A", "Detected")]
  const nextTasks = [taskFixture("A", "Detected"), taskFixture("B", "Awaiting verification")]
  const priorSelection: Record<string, MemberSavingsShadowOutcome> = { A: "Evidence received" }
  const result = synchronizeMemberSavingsTaskState(priorTasks, nextTasks, priorSelection)

  assert.equal(result.tasks[0].state, "Detected")
  assert.equal(result.tasks[0].progress, "Pending")
  assert.equal(result.selected.A, "Evidence received")
  assert.equal(result.selected.B, "Unresolved")
  assert.equal(result.tasks[1].actionId, "B")
})

test("resolveMemberSavingsAskDueAt returns an honest empty-state value for live task lists with no due date", () => {
  assert.equal(resolveMemberSavingsAskDueAt([], "2026-07-27T01:00:00.000Z", true), null)
  assert.equal(resolveMemberSavingsAskDueAt([], "2026-07-27T01:00:00.000Z", false), "2026-07-27T01:00:00.000Z")
  assert.equal(resolveMemberSavingsAskDueAt([taskFixture("A")], undefined, true), "2026-07-27T00:00:00.000Z")
})

test("standalone workspace has one content heading and no shared shell changes", () => {
  assert.equal((componentSource.match(/<h2/g) ?? []).length, 1)
  assert.equal((componentSource.match(/<h1/g) ?? []).length, 0)
  assert.doesNotMatch(componentSource, /nia-dashboard|OPERATIONS_TABS|navigation|app\/globals|LoopHealth/)
  assert.match(componentSource, /member-savings-heading/)
})

test("task band carries a recoverable-risk dual-gate verdict pill", () => {
  assert.match(componentSource, /verdictPill/)
  assert.match(componentSource, /Dual gate passed/)
  assert.match(componentSource, /Dual-gate breach/)
  assert.match(componentSource, /preview\.summary\.gap/)
  assert.match(componentSource, /Dual gate not calculated/)
})

test("live savings command resolves its owner and sentences from Sheet-backed values", () => {
  assert.match(componentSource, /ownerPerson/)
  assert.match(componentSource, /display name/)
  assert.match(componentSource, /liveQuestion/)
  assert.match(componentSource, /pendingApprovals/)
  assert.match(componentSource, /approvalNote/)
  assert.match(componentSource, /liveData\?\.actions\?\.find/)
  assert.match(componentSource, /No owner recorded/)
  assert.doesNotMatch(componentSource, /ownerActorId \|\| fixturePreview\.summary\.owner/)
})

test("live totals aggregate every eligible Essentials row and preserve an honest no-data state", () => {
  assert.match(componentSource, /liveGateRows\.reduce\(\(sum, row\) => sum \+ \(recordedNumber\(row, "member savings inr"\)/)
  assert.match(componentSource, /liveGateRows\.reduce\(\(sum, row\) => sum \+ \(recordedNumber\(row, "nia margin inr"\)/)
  assert.match(componentSource, /const hasLiveGateData = liveGateRows\.length > 0/)
  assert.match(componentSource, /No eligible Sheet data/)
  assert.match(componentSource, /Cannot calculate without an eligible Essentials_Hourly row/)
  assert.doesNotMatch(componentSource, /finance\?\.\["cm2 inr"\]/)
})

test("weekly message delivery status is Sheet-backed or explicitly unavailable", () => {
  assert.match(componentSource, /weeklyMessageStatusByServiceId/)
  assert.match(componentSource, /weekly message status/)
  assert.match(componentSource, /delivery status/)
  assert.match(componentSource, /Delivery status not recorded/)
  assert.doesNotMatch(componentSource, /Google Sheet · read-only · not sent/)
})

test("live headline measures replace every fixture KPI with governed Sheet calculations", () => {
  assert.match(componentSource, /liveMeasures/)
  assert.match(componentSource, /liveGateRows/)
  assert.match(componentSource, /passingGateRows/)
  assert.match(componentSource, /verifiedSavingsOutcomes/)
  assert.match(componentSource, /openSavingsActions/)
  assert.match(componentSource, /averageRecordedPercent/)
  assert.match(componentSource, /attach pct/)
  assert.match(componentSource, /attach floor pct/)
  assert.match(componentSource, /repeat pct/)
  assert.match(componentSource, /repeat baseline pct/)
  assert.match(componentSource, /hasAttachRepeatComparators/)
  assert.match(componentSource, /Calculated from Essentials_Hourly/)
  assert.match(componentSource, /Calculated from Action_Log and Evidence_Log/)
  assert.doesNotMatch(componentSource, /value: "36% \/ 59%"/)
  assert.match(componentSource, /measures: isLive \? liveMeasures : fixturePreview\.measures/)
})

test("savings margin and repeat panels use Essentials_Hourly service rows in live mode", () => {
  assert.match(componentSource, /const liveServices: MemberSavingsPreview\["services"\]/)
  assert.match(componentSource, /essentials hourly id/)
  assert.match(componentSource, /member savings inr/)
  assert.match(componentSource, /nia margin inr/)
  assert.match(componentSource, /attach pct/)
  assert.match(componentSource, /repeat pct/)
  assert.match(componentSource, /services: isLive \? liveServices : fixturePreview\.services/)
  assert.match(componentSource, /Google Sheet · live read-only/)
  assert.match(componentSource, /Essentials_Hourly observations/)
  assert.match(componentSource, /serviceGateSummary/)
  assert.match(componentSource, /serviceGateImplication/)
})

test("service implication accordion summary is derived from live service gate rows", () => {
  assert.match(componentSource, /const serviceImplicationSummary = liveServices\.length === 0/)
  assert.match(componentSource, /The recorded service clears both gates/)
  assert.match(componentSource, /All \$\{liveServices\.length\} recorded services clear both gates/)
  assert.match(componentSource, /the recorded service clears both the Member-savings and Nia-margin gates/)
  assert.match(componentSource, /\$\{failingGateRows\} recorded/)
  assert.match(componentSource, /title: "Service implication", summary: isLive \? serviceImplicationSummary/)
})

test("services needing action is a live read-only Sheet-backed queue", () => {
  assert.match(componentSource, /const serviceActionCount = displayedTasks\.length/)
  assert.match(componentSource, /No actions generated · savings inputs pending/)
  assert.match(componentSource, /Google Sheet · live read-only/)
  assert.match(componentSource, /status advances automatically from Action_Log and Evidence_Log/)
  assert.match(componentSource, /Sheet-backed service/)
  assert.match(componentSource, /isLive \? <small>/)
  assert.match(componentSource, /isLive\s*\? preview\.tasks/)
  assert.match(componentSource, /action=\{task\.progress\}/)
})

test("dual-gate implication is derived from the same live service rows as the headline measure", () => {
  assert.match(componentSource, /const failingGateRows = Math\.max\(0, liveGateRows\.length - passingGateRows\)/)
  assert.match(componentSource, /const dualGateImplicationSummary = isLive/)
  assert.match(componentSource, /const dualGateImplication = isLive/)
  assert.match(componentSource, /summary: dualGateImplicationSummary/)
  assert.match(componentSource, /<p className=\{styles\.soWhat\}>\{dualGateImplication\}<\/p>/)
  assert.match(componentSource, /no dual-gate recovery is currently required/)
  assert.match(componentSource, /not a category-wide reprice/)
})

test("every headline exhibit closes with a so-what implication", () => {
  assert.ok((componentSource.match(/styles\.soWhat/g) ?? []).length >= 3, "expected at least three So what lines")
  assert.ok((componentSource.match(/So what:/g) ?? []).length >= 3)
})

test("workspace ends with an explicit owner-and-date ask before the source footer", () => {
  const askIndex = componentSource.indexOf("styles.askBand")
  const footerIndex = componentSource.indexOf("styles.sourceNote")
  assert.ok(askIndex >= 0 && askIndex < footerIndex, "closing ask must precede the footer")
  assert.match(componentSource, /Decision required/)
  assert.match(componentSource, /accountability sits with \$\{preview\.summary\.owner\}/)
  assert.match(componentSource, /Repricing stays a recommendation only/)
  assert.match(componentSource, /<dt>Owner<\/dt>/)
  assert.match(componentSource, /<dt>By<\/dt>/)
})

test("decision required prioritises a live approval and never asks to recover zero failures", () => {
  assert.match(componentSource, /const liveDecisionApproval = pendingApprovals\[0\]/)
  assert.match(componentSource, /const liveDecisionTask = liveEscalations\[0\]/)
  assert.match(componentSource, /Approval required · \$\{liveDecisionApproval\.owner\}/)
  assert.match(componentSource, /No decision required/)
  assert.match(componentSource, /No Member Savings decision is currently required/)
  assert.match(componentSource, /records the decision in Approval_Log/)
  assert.match(componentSource, /no price or supplier change is automatic/)
  assert.match(componentSource, /action\.replace\(\/\[\.!\?\]\?\$\/, "\."\)/)
  assert.match(componentSource, /decisionHeading/)
  assert.match(componentSource, /decisionOwner/)
  assert.match(componentSource, /decisionDueAt/)
})

test("first viewport preserves target through verified-result order", () => {
  let cursor = -1
  for (const label of ["Target", "Current", "Gap", "Owner", "Progress", "Verified result"]) {
    const next = componentSource.indexOf(`\"${label}\"`, cursor + 1)
    assert.ok(next > cursor, label)
    cursor = next
  }
  assert.equal(preview.question, "Are Members saving money on services that also make Nia margin?")
})

test("exactly four locked measures are projected", () => {
  assert.equal(preview.measures.length, 4)
  assert.match(componentSource, /data-measure-id/)
  for (const label of ["Verified Member savings", "Attach and repeat", "Services passing both gates", "At-risk recovery"]) assert.ok(preview.measures.some((measure) => measure.label === label))
})

test("primary visual is a paired dual-gate matrix without price-stack clutter", () => {
  assert.match(componentSource, /DualGateMatrix/)
  assert.match(componentSource, /Verified Member saving/)
  assert.match(componentSource, /Verified Nia margin/)
  assert.match(componentSource, /prices hidden/)
  const beforeWork = componentSource.slice(0, componentSource.indexOf("Services needing action now"))
  assert.doesNotMatch(beforeWork, /MRP|buying price|selling price|supplier cost/i)
})

test("gate status is written in text and does not rely on colour", () => {
  assert.match(componentSource, /service\.status/)
  assert.match(componentSource, /statusReason/)
  assert.match(componentSource, /Pass/)
  assert.match(componentSource, /Issues needing your review/)
})

test("pending human approvals and no-approved-value state remain in closed audit details", () => {
  const details = componentSource.indexOf("<details")
  const pending = componentSource.indexOf("Versioned controls and pending approvals")
  assert.ok(details >= 0 && pending > details)
  assert.match(componentSource, /No value approved/)
  assert.doesNotMatch(componentSource.slice(details, componentSource.indexOf("<summary", details)), /\sopen(?:=|\s|>)/)
  assert.ok(preview.policyRegistry.some((policy) => policy.status === "Pending human approval" && policy.value === null))
})

test("shadow controls update local state with no live side-effect path", () => {
  assert.match(componentSource, /recoverMemberSavingsTask/)
  assert.doesNotMatch(componentSource, /routeFor|state:\s*outcome ===/)
  assert.match(componentSource, /setTasks\(\(current\) => current\.map/)
  assert.match(componentSource, /setAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /No price, supplier or external action/)
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.geolocation|use server|server action/)
})

test("live service-action cards render the current Sheet projection instead of stale local task state", () => {
  assert.match(componentSource, /const displayedTasks = isLive \? preview\.tasks : tasks/)
  assert.match(componentSource, /displayedTasks\.map\(\(task\) => <OperationalCard/)
  assert.match(componentSource, /action=\{task\.progress\}/)
  assert.match(componentSource, /label: "Verified result", value: task\.verifiedResult/)
})

test("learning and weekly message sections expose shadow inputs without shared engines", () => {
  for (const label of ["Proposed change", "Expected effect", "Evidence", "Attribution", "Forecast error", "Fresh / reversible", "Approved boundary", "Human controls", "Effects", "Confidence / adoption", "Rollback"]) assert.match(componentSource, new RegExp(label.replace("/", "\\/")))
  assert.match(componentSource, /Weekly savings-message inputs/)
  assert.equal(preview.weeklyMessageInputs[0].sent, false)
  assert.equal(preview.learningInputs[0].production_confidence, "Low")
  assert.equal(preview.learningInputs[0].auto_adopt, false)
  assert.doesNotMatch(componentSource, /SharedLearning|MaterialityEngine|LoopHealth/)
})

test("background record switches every visible subsection to connected Sheet records in live mode", () => {
  assert.match(componentSource, /liveLearningRows/)
  assert.match(componentSource, /liveSavingsActions/)
  assert.match(componentSource, /liveSavingsEvidence/)
  assert.match(componentSource, /liveAuditEvents/)
  assert.match(componentSource, /Append-only Sheet audit/)
  assert.match(componentSource, /No eligible Essentials_Hourly savings input is recorded/)
  assert.match(componentSource, /No Member Savings row is recorded in Learning_History/)
  assert.match(componentSource, /connectedSourceNames/)
  assert.match(componentSource, /sourceHealthDetail/)
})

test("source and confidence reports actual connected feed names and calculated health", () => {
  assert.match(componentSource, /connectedSourceNames/)
  assert.match(componentSource, /sourceConfidenceSummary/)
  assert.match(componentSource, /sourceHealthDetail/)
  assert.match(componentSource, /No connected Member Savings feed/)
  assert.match(componentSource, /preview\.loopHealth\.state/)
  assert.match(componentSource, /stale.*quarantined.*human approvals retained/)
  assert.match(componentSource, /summary: sourceConfidenceSummary/)
})

test("the visible R-0 strip and Despatch handoff remain domain-scoped", () => {
  for (const label of ["Data freshness", "Clocks running", "Outcome checks"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /preview\.loopHealth/)
  assert.match(componentSource, /preview\.despatchEscalations/)
  assert.ok(preview.despatchEscalations.length > 0)
})

test("issues needing review uses live escalations and approvals when Sheet data is connected", () => {
  assert.match(componentSource, /const liveEscalations = liveTasks\.filter/)
  assert.match(componentSource, /repeat count/)
  assert.match(componentSource, /const liveReviewCount = liveEscalations\.length \+ pendingApprovals\.length/)
  assert.match(componentSource, /Action_Log \+ Evidence_Log \+ Approval_Log/)
  assert.match(componentSource, /liveEscalations\.map/)
  assert.match(componentSource, /pendingApprovals\.map/)
  assert.match(componentSource, /No escalated Member Savings action or pending human approval/)
  assert.match(componentSource, /isLive \? <>/)
})

test("fixtures expose protected labels only and no raw contact pattern", () => {
  assert.doesNotMatch(JSON.stringify(preview), /\+91|\b\d{10}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|rawSupplierContact|rawMemberIdentity/i)
  assert.match(componentSource, /protected references only/)
})

test("scoped styles support desktop, tablet and mobile without gradients or black hero", () => {
  assert.match(componentSource, /member-savings-workspace\.module\.css/)
  assert.match(styleSource, /grid-template-columns:\s*repeat\(4/)
  assert.match(styleSource, /@media \(max-width: 1100px\)/)
  assert.match(styleSource, /@media \(max-width: 700px\)/)
  assert.match(styleSource, /@media \(max-width: 430px\)/)
  assert.match(styleSource, /overflow-x:\s*auto/)
  assert.doesNotMatch(styleSource, /linear-gradient|radial-gradient|#000(?:000)?\b|background:\s*black/)
})
