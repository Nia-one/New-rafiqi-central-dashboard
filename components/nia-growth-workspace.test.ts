import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildNiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"

const componentSource = readFileSync(new URL("./nia-growth-workspace.tsx", import.meta.url), "utf8")
const styleSource = readFileSync(new URL("./nia-growth-workspace.module.css", import.meta.url), "utf8")
const preview = buildNiaGrowthPreview()

test("standalone workspace has one content heading and no shell or shared-engine edit", () => {
  assert.equal((componentSource.match(/<h2/g) ?? []).length, 1)
  assert.equal((componentSource.match(/<h1/g) ?? []).length, 0)
  assert.doesNotMatch(componentSource, /nia-dashboard|OPERATIONS_TABS|navigation|app\/globals|SharedLearning|MaterialityEngine/)
  assert.equal((componentSource.match(/<LoopHealthStrip/g) ?? []).length, 1)
  assert.match(componentSource, /nia-growth-heading/)
})

test("Loop health is calculated from live Sheet readiness, actions, and evidence", () => {
  assert.match(componentSource, /buildLoopHealth/)
  assert.match(componentSource, /liveData\?\.enterpriseDemand/)
  assert.match(componentSource, /liveData\?\.actions/)
  assert.match(componentSource, /liveData\?\.evidence/)
  assert.match(componentSource, /FONO and Shram Park demand ledger/)
  assert.match(componentSource, /verifiedGrowth/)
  assert.match(componentSource, /quarantinedRecords/)
  assert.match(componentSource, /loopHealth: liveLoopHealth \?\? fixturePreview\.loopHealth/)
})

test("Data freshness switches from the fixture to the live growth demand connection", () => {
  assert.match(componentSource, /const growthRefreshAt = latestTimestamp/)
  assert.match(componentSource, /const growthQuarantineCount =/)
  assert.match(componentSource, /Connected Google Sheet/)
  assert.match(componentSource, /Enterprise_Demand read-only/)
  assert.match(componentSource, /No valid FONO or Shram Park refresh recorded/)
})

test("task band carries a recoverable-risk verdict pill", () => {
  assert.match(componentSource, /verdictPill/)
  assert.match(componentSource, /growthBehind \? `Behind plan/)
  assert.match(componentSource, /At or above recorded plan/)
  assert.match(componentSource, /const commandLabel = liveData \? "LIVE GOOGLE SHEET"/)
  assert.match(componentSource, /const commandMode = liveData \? "READ-ONLY"/)
  assert.match(componentSource, /Which recorded FONO or Shram Park readiness gap/)
})

test("every headline exhibit closes with a so-what implication", () => {
  assert.ok((componentSource.match(/styles\.soWhat/g) ?? []).length >= 3, "expected at least three So what lines")
  assert.ok((componentSource.match(/So what:/g) ?? []).length >= 3)
})

test("capacity implication follows governed live readiness without inventing SP coverage", () => {
  assert.match(componentSource, /const capacityImplicationSummary =/)
  assert.match(componentSource, /const capacityImplication =/)
  assert.match(componentSource, /SP coverage cannot be assessed/)
  assert.match(componentSource, /cannot claim a growth gap or recommend capital action/)
  assert.match(componentSource, /summary: capacityImplicationSummary/)
  assert.match(componentSource, /\{capacityImplication\}/)
})

test("workspace ends with an explicit owner-and-date ask before the source footer", () => {
  const askIndex = componentSource.indexOf("styles.askBand")
  const footerIndex = componentSource.indexOf("styles.sourceNote")
  assert.ok(askIndex >= 0 && askIndex < footerIndex, "closing ask must precede the footer")
  assert.match(componentSource, /Decision required/)
  assert.match(componentSource, /const decisionDetail =/)
  assert.match(componentSource, /no contract, property or capital action occurs automatically/)
  assert.match(componentSource, /<dt>Owner<\/dt>/)
  assert.match(componentSource, /<dt>By<\/dt>/)
})

test("live decision required uses Approval_Log decision and linked Action_Log deadline", () => {
  assert.match(componentSource, /const liveDecision = liveSignOffs\[0\]/)
  assert.match(componentSource, /const decisionTitle =/)
  assert.match(componentSource, /const decisionDetail =/)
  assert.match(componentSource, /const decisionDeadline = liveData/)
  assert.match(componentSource, /\{decisionTitle\}/)
  assert.match(componentSource, /\{decisionDetail\}/)
  assert.match(componentSource, /decisionDeadline \? <div><dt>By<\/dt>/)
})

test("first viewport preserves target through verified-result order", () => {
  let cursor = -1
  for (const label of ["Target", "Current", "Gap", "Owner", "Progress", "Verified result"]) {
    const next = componentSource.indexOf(`\"${label}\"`, cursor + 1)
    assert.ok(next > cursor, label)
    cursor = next
  }
  assert.equal(preview.question, "Where should Nia add capacity next, through FONO or Shram Park, without creating unapproved capital risk?")
})

test("exactly four locked measures are projected", () => {
  assert.equal(preview.measures.length, 4)
  assert.match(componentSource, /data-measure-id/)
  for (const label of ["Activation-ready capacity", "Opportunity to ready", "FONO conversion health", "SP capital coverage"]) assert.ok(preview.measures.some((measure) => measure.label === label))
})

test("two-channel primary visual shows FONO first and SP second before any combined view", () => {
  assert.match(componentSource, /Growth by Channel/)
  assert.match(componentSource, /FONO and Shram Park stay separate/)
  assert.deepEqual(preview.lanes.map((lane) => lane.supplyModel), ["FONO", "SP"])
  assert.equal(preview.lanes[0].coverageLabel, "Base 92 · Nia fill 34")
  assert.match(preview.lanes[1].coverageLabel, /signed/)
})

test("live channel lanes use separate governed FONO and Shram Park demand rows", () => {
  assert.match(componentSource, /const liveLanes = \(\["FONO", "SP"\]/)
  assert.match(componentSource, /timeToReadyLabel: "Not recorded"/)
  assert.match(componentSource, /Base \/ Nia-fill split not recorded/)
  assert.match(componentSource, /Signed contract coverage not recorded/)
  assert.match(componentSource, /FONO Funnel required and matched capacity/)
  assert.match(componentSource, /Shram Park demand required and matched capacity/)
  assert.match(componentSource, /lanes: liveData \? liveLanes : fixturePreview\.lanes/)
  assert.match(componentSource, /hasLiveData \? `\$\{lane\.progressPct\}% ready` : "No data"/)
  assert.match(componentSource, /No governed channel row/)
  assert.match(componentSource, /Approved readiness SLA not recorded/)
})

test("lane states use written labels and do not rely on colour", () => {
  assert.match(componentSource, /stage\.state/)
  assert.match(componentSource, /stage\.label/)
  assert.match(componentSource, /stage\.value/)
  assert.match(componentSource, /data-stage-state/)
})

test("recommendation cards retain named human authority and pending approval", () => {
  assert.match(componentSource, /Growth decisions waiting/)
  assert.match(componentSource, /Human approval required/)
  assert.ok(preview.signOffs.every((row) => row.status === "Pending human approval"))
  assert.deepEqual(preview.signOffs.map((row) => row.owner), ["CEO/COO", "Pushkar"])
})

test("live human decisions use Approval_Log deadlines and linked evidence state", () => {
  assert.match(componentSource, /dueAt: approval\.dueAt/)
  assert.match(componentSource, /No linked Evidence_Log record/)
  assert.match(componentSource, /awaiting verification/)
  assert.match(componentSource, /Not recorded in linked Action_Log/)
  assert.match(componentSource, /approves or declines in Approval_Log/)
})

test("pending thresholds remain in a closed native disclosure", () => {
  const details = componentSource.indexOf("<details")
  const pending = componentSource.indexOf("Versioned controls and pending approvals")
  assert.ok(details >= 0 && pending > details)
  assert.match(componentSource, /No value approved/)
  assert.doesNotMatch(componentSource.slice(details, componentSource.indexOf("<summary", details)), /\sopen(?:=|\s|>)/)
  assert.ok(preview.policyRegistry.some((policy) => policy.status === "Pending human approval" && policy.value === null))
})

test("live closure rule comes from Policy_Registry or reports the missing control", () => {
  assert.match(componentSource, /const growthClosurePolicy =/)
  assert.match(componentSource, /const closureSummary =/)
  assert.match(componentSource, /Policy_Registry does not contain an approved Nia Growth closure rule/)
  assert.match(componentSource, /will not claim capacity closed automatically/)
  assert.match(componentSource, /summary: closureSummary/)
})

test("source and confidence use connected Sheet sources and live governed state", () => {
  assert.match(componentSource, /const connectedGrowthSources =/)
  for (const source of ["Enterprise_Demand", "Action_Log", "Evidence_Log", "Approval_Log", "Learning_History", "Policy_Registry"]) assert.match(componentSource, new RegExp(source))
  assert.match(componentSource, /const growthConfidence =/)
  assert.match(componentSource, /const sourceSummary =/)
  assert.match(componentSource, /const sourceDetail =/)
  assert.match(componentSource, /const confidenceDetail =/)
  assert.match(componentSource, /\{sourceDetail\}/)
  assert.match(componentSource, /\{confidenceDetail\}/)
})

test("live background record uses Learning_History and the governed Sheet audit chain", () => {
  assert.match(componentSource, /const growthLearningRows =/)
  assert.match(componentSource, /const growthPolicyRows =/)
  assert.match(componentSource, /const liveAuditEvents =/)
  assert.match(componentSource, /Append-only Sheet audit/)
  assert.match(componentSource, /No Nia Growth record is present in Learning_History/)
  assert.match(componentSource, /No Nia Growth structural policy is recorded in Policy_Registry/)
  assert.match(componentSource, /This projection is read-only/)
  assert.match(componentSource, /Pending approvals and recorded controls/)
  assert.match(componentSource, /<th>Decision<\/th><th>Reason<\/th><th>Approval ID<\/th>/)
})

test("shadow controls update local append-only state without a live side-effect path", () => {
  assert.match(componentSource, /setTasks\(\(current\) => current\.map/)
  assert.match(componentSource, /setAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /No property, contract, capital or external action/)
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.geolocation|use server|server action/)
})

test("open opportunities use only Nia Growth Action_Log records in live read-only mode", () => {
  assert.match(componentSource, /function isNiaGrowthAction/)
  assert.doesNotMatch(componentSource, /actionRows\.filter\(\(row\) => \/nia growth\|capacity\|readiness/)
  assert.match(componentSource, /const liveGrowthTasks = growthActions\.filter/)
  assert.match(componentSource, /liveData\?\.people/)
  assert.match(componentSource, /liveData\?\.studios/)
  assert.match(componentSource, /No linked Evidence_Log record/)
  assert.match(componentSource, /Action_Log · read-only/)
  assert.match(componentSource, /No open Nia Growth action is recorded in Action_Log/)
})

test("channel coverage comes from governed TEAM_NIA_GROWTH approval terms", () => {
  assert.match(componentSource, /OPS-NIA-GROWTH-/)
  assert.match(componentSource, /current terms/)
  assert.match(componentSource, /TEAM_NIA_GROWTH user input/)
  assert.match(componentSource, /Nia-filled Nests field/)
  assert.match(componentSource, /signed-contract-covered Nests field/)
})

test("learning section exposes domain inputs, Low confidence and no auto-adoption", () => {
  for (const label of ["Channel / proposal", "Expected effect", "Evidence", "Attribution", "Forecast error", "Fresh / reversible", "Approved boundary", "Human controls", "Effects", "Confidence / adoption", "Rollback"]) assert.match(componentSource, new RegExp(label.replace("/", "\\/")))
  assert.ok(preview.learningInputs.every((input) => input.production_confidence === "Low" && input.auto_adopt === false))
  assert.deepEqual(preview.learningInputs[1].confounders, ["confounders not ruled out"])
})

test("fixtures expose protected labels only and no real contact or coordinate pattern", () => {
  assert.doesNotMatch(JSON.stringify(preview), /\+91|\b\d{10}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|rawPropertyOwner|rawCoordinates|latitude|longitude/i)
  assert.match(componentSource, /protected references only/)
})

test("scoped styles support desktop, tablet and mobile without gradients or black hero", () => {
  assert.match(componentSource, /nia-growth-workspace\.module\.css/)
  assert.match(styleSource, /grid-template-columns:\s*repeat\(4/)
  assert.match(styleSource, /@media \(max-width: 1100px\)/)
  assert.match(styleSource, /@media \(max-width: 700px\)/)
  assert.match(styleSource, /@media \(max-width: 430px\)/)
  assert.match(styleSource, /overflow-x:\s*auto/)
  assert.doesNotMatch(styleSource, /linear-gradient|radial-gradient|#000(?:000)?\b|background:\s*black/)
})
