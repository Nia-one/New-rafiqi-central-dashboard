import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildMemberSavingsPreview } from "@/lib/operating-loop/member-savings-loop"

const componentSource = readFileSync(new URL("./member-savings-workspace.tsx", import.meta.url), "utf8")
const styleSource = readFileSync(new URL("./member-savings-workspace.module.css", import.meta.url), "utf8")
const preview = buildMemberSavingsPreview()

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
  assert.match(componentSource, /\{preview\.summary\.gap\} failing/)
})

test("live savings command resolves its owner and sentences from Sheet-backed values", () => {
  assert.match(componentSource, /ownerPerson/)
  assert.match(componentSource, /display name/)
  assert.match(componentSource, /liveQuestion/)
  assert.match(componentSource, /pendingApprovals/)
  assert.match(componentSource, /approvalNote/)
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
  assert.match(componentSource, /accountability sits with \{preview\.summary\.owner\}/)
  assert.match(componentSource, /Repricing stays a recommendation only/)
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

test("learning and weekly message sections expose shadow inputs without shared engines", () => {
  for (const label of ["Proposed change", "Expected effect", "Evidence", "Attribution", "Forecast error", "Fresh / reversible", "Approved boundary", "Human controls", "Effects", "Confidence / adoption", "Rollback"]) assert.match(componentSource, new RegExp(label.replace("/", "\\/")))
  assert.match(componentSource, /Weekly savings-message inputs/)
  assert.equal(preview.weeklyMessageInputs[0].sent, false)
  assert.equal(preview.learningInputs[0].production_confidence, "Low")
  assert.equal(preview.learningInputs[0].auto_adopt, false)
  assert.doesNotMatch(componentSource, /SharedLearning|MaterialityEngine|LoopHealth/)
})

test("the visible R-0 strip and Despatch handoff remain domain-scoped", () => {
  for (const label of ["Data freshness", "Clocks running", "Outcome checks"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /preview\.loopHealth/)
  assert.match(componentSource, /preview\.despatchEscalations/)
  assert.ok(preview.despatchEscalations.length > 0)
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
