import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildMemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"

const componentSource = readFileSync(new URL("./member-engagement-workspace.tsx", import.meta.url), "utf8")
const styleSource = readFileSync(new URL("./member-engagement-workspace.module.css", import.meta.url), "utf8")
const preview = buildMemberEngagementPreview()

test("standalone workspace has one content heading and no shell or duplicate navigation", () => {
  assert.equal((componentSource.match(/<h2/g) ?? []).length, 1)
  assert.equal((componentSource.match(/<h1/g) ?? []).length, 0)
  assert.doesNotMatch(componentSource, /nia-dashboard|OPERATIONS_TABS|navigation|app\/globals/)
  assert.match(componentSource, /member-engagement-heading/)
})

test("first viewport presents target through verified result in locked order", () => {
  const labels = ["Target", "Current", "Gap", "Owner", "Progress", "Verified result"]
  let cursor = -1
  for (const label of labels) {
    const next = componentSource.indexOf(`\"${label}\"`, cursor + 1)
    assert.ok(next > cursor, `${label} must follow the prior summary field`)
    cursor = next
  }
  assert.equal(preview.question, "Who is likely to leave, why, and has the cause actually recovered?")
  assert.match(preview.headline, /Recover the verified friction cause/)
})

test("task band carries a recoverable-risk verdict pill", () => {
  assert.match(componentSource, /verdictPill/)
  assert.match(componentSource, /Recovery target/)
  assert.match(componentSource, /preview\.summary\.gap/)
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
  assert.match(componentSource, /accountability sits with \$\{liveCommand\.owner\}/)
  assert.match(componentSource, /<dt>Owner<\/dt>/)
  assert.match(componentSource, /<dt>By<\/dt>/)
})

test("workspace renders exactly the four fixture measures", () => {
  assert.equal(preview.measures.length, 4)
  assert.match(componentSource, /data-measure-id/)
  for (const label of ["M6 retention", "Monthly churn", "Verified exit reasons", "At-risk recovery"]) assert.ok(preview.measures.some((measure) => measure.label === label))
})

test("retention curve is the primary visual with named cohorts and a governed Sheet floor", () => {
  assert.match(componentSource, /RetentionCurve/)
  assert.match(componentSource, /\{floor\}% M6 floor/)
  assert.match(componentSource, /preview\.retentionCurves\.map/)
  assert.match(componentSource, /Independent billing outcomes/)
})

test("survey and behavioural NPS remain inside the closed audit disclosure", () => {
  const disclosure = componentSource.indexOf("<details")
  const nps = componentSource.indexOf("Survey and behavioural NPS")
  assert.ok(disclosure >= 0 && nps > disclosure)
  assert.doesNotMatch(componentSource.slice(disclosure, componentSource.indexOf("<summary", disclosure)), /\sopen(?:=|\s|>)/)
  assert.match(componentSource, /method/)
  assert.match(componentSource, /inputs/)
})

test("protected labels are shown and sensitive identity is absent", () => {
  for (const task of preview.tasks) assert.match(task.memberLabel, /^Protected Member · [A-Z]-\d+$/)
  assert.doesNotMatch(JSON.stringify(preview), /\+91|\b\d{10}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|protected:\/\/member\//i)
  assert.match(componentSource, /Member identity protected/)
  assert.match(componentSource, /protected role-gated references only/)
})

test("Members needing action is read-only and driven by the joined Sheet logs", () => {
  assert.match(componentSource, /buildLiveMemberEngagementActions/)
  assert.match(componentSource, /Google Sheet · live read-only/)
  assert.match(componentSource, /status advances from Action_Log and Evidence_Log/)
  assert.doesNotMatch(componentSource, /Record locally|TokenSelect|recoverMemberEngagementTask/)
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.geolocation|use server|server action/)
  assert.equal(preview.blockedCapabilities.liveMemberContact, false)
  assert.equal(preview.blockedCapabilities.liveWeeklyMessage, false)
})

test("learning section exposes domain inputs, Low confidence and no auto-adoption", () => {
  for (const label of ["Proposed change", "Expected effect", "Attribution", "Evidence", "Forecast error", "Fresh / reversible", "Human controls", "Confidence / adoption", "Effects", "Rollback"]) assert.match(componentSource, new RegExp(label.replace("/", "\\/")))
  assert.equal(preview.learningInputs[0].production_confidence, "Low")
  assert.equal(preview.learningInputs[0].auto_adopt, false)
  assert.deepEqual(preview.learningInputs[0].confounders, ["confounders not ruled out"])
  assert.doesNotMatch(componentSource, /SharedLearning|MaterialityEngine/)
})

test("the visible R-0 strip and repeat-issue handoff use governed Sheet records", () => {
  for (const label of ["Data freshness", "Clocks running", "Outcome checks"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /preview\.loopHealth/)
  assert.match(componentSource, /buildLiveMemberEngagementRepeatIssues/)
  assert.match(componentSource, /verified evidence automatically removes resolved issues/)
  assert.ok(preview.despatchEscalations.length > 0)
})

test("Data freshness switches from the fixture to three live Sheet feeds", () => {
  assert.match(componentSource, /buildLiveMemberEngagementFreshness/)
  assert.match(componentSource, /Google Sheet sources current/)
  assert.match(componentSource, /connected feeds/)
  assert.match(componentSource, /protected-input rows quarantined/)
})

test("Retention command replaces the synthetic fixture with the Sheet recovery command", () => {
  assert.match(componentSource, /buildLiveMemberEngagementCommand/)
  assert.match(componentSource, /Google Sheet/)
  assert.match(componentSource, /live read-only/)
  assert.match(componentSource, /liveCommand!\.recoveryGap/)
  assert.match(componentSource, /liveCommand!\.openSignals/)
  assert.match(componentSource, /liveCommand!\.baselineRecovered/)
  assert.match(componentSource, /liveCommand!\.targetRecovered/)
})

test("Decision required uses the live command, governed floor and Sheet deadline", () => {
  assert.match(componentSource, /liveCommand!\.recoveryGap/)
  assert.match(componentSource, /liveCommand!\.owner/)
  assert.match(componentSource, /liveCommand!\.dueAt/)
  assert.match(componentSource, /liveHeadlineMeasures!\.retentionFloor/)
  assert.match(componentSource, /liveHeadlineMeasures\.cohortSummary/)
})

test("Source and confidence replaces the fixture with joined Sheet provenance", () => {
  assert.match(componentSource, /liveBackground!\.source\.count/)
  assert.match(componentSource, /liveBackground!\.source\.names/)
  assert.match(componentSource, /liveBackground!\.source\.asOf/)
  assert.match(componentSource, /liveBackground!\.source\.confidence/)
  assert.match(componentSource, /liveBackground!\.source\.adoption/)
})

test("Loop health uses live feeds, recovery clocks and evidence outcomes", () => {
  assert.match(componentSource, /buildLiveMemberEngagementLoopHealth/)
  assert.match(componentSource, /loopHealth: isLive \? liveLoopHealth!/)
  assert.match(componentSource, /preview\.loopHealth/)
})

test("Members saved vs goal uses one consistent Member Engagement source", () => {
  assert.match(componentSource, /liveCommand!\.targetRecovered.*recovered Members/)
  assert.match(componentSource, /liveCommand!\.baselineRecovered.*recovered Members/)
  assert.match(componentSource, /liveCommand!\.baselineRecovered \/ liveCommand!\.targetRecovered/)
  assert.match(componentSource, /liveLoopHealth!\.verification\.verified.*independently verified recoveries/)
})

test("Headline measures replace all four synthetic observations with Sheet values", () => {
  assert.match(componentSource, /buildLiveMemberEngagementHeadlineMeasures/)
  assert.match(componentSource, /measures: isLive \? liveHeadlineMeasures!\.measures/)
  assert.match(componentSource, /liveHeadlineMeasures\?\.implication/)
  assert.match(componentSource, /liveHeadlineMeasures\?\.retentionImplicationSummary/)
})

test("Cohorts and recovery replace chart, recovery totals and sentences with Sheet values", () => {
  assert.match(componentSource, /retentionCurves: isLive \? liveHeadlineMeasures!\.retentionCurves/)
  assert.match(componentSource, /floor=\{isLive \? liveHeadlineMeasures!\.retentionFloor/)
  assert.match(componentSource, /liveHeadlineMeasures\?\.cohortSummary/)
  assert.match(componentSource, /liveHeadlineMeasures\.recovery\.verified/)
  assert.match(componentSource, /liveHeadlineMeasures\.recovery\.total/)
  assert.match(componentSource, /liveHeadlineMeasures!\.recovery\.interventions/)
  assert.match(componentSource, /liveHeadlineMeasures!\.recovery\.awaiting/)
  assert.match(componentSource, /liveHeadlineMeasures!\.recovery\.reopened/)
  assert.match(componentSource, /liveHeadlineMeasures\?\.recovery\.closureRule/)
  assert.match(componentSource, /Google Sheet cohort observations/)
})

test("live mode never substitutes preview observations when a Sheet field is missing", () => {
  assert.match(componentSource, /const isLive = Boolean\(liveData\)/)
  assert.match(componentSource, /No Member-impacting recovery command is recorded/)
  assert.match(componentSource, /No Member Engagement source rows recorded/)
  assert.match(componentSource, /No Member Engagement Sheet sources recorded/)
  assert.match(componentSource, /No Sheet cohort observations recorded/)
  assert.match(componentSource, /liveHeadlineMeasures!\.recovery\.total \? Math\.round/)
})

test("Recovery implication summary and body are calculated from the same Sheet recovery totals", () => {
  assert.match(componentSource, /title: "Recovery implication"/)
  assert.match(componentSource, /liveHeadlineMeasures\.recovery\.total - liveHeadlineMeasures\.recovery\.verified/)
  assert.match(componentSource, /at-risk Members remain against the recorded recovery target/)
})

test("scoped styles provide desktop, tablet and mobile layouts without black hero or gradients", () => {
  assert.match(componentSource, /member-engagement-workspace\.module\.css/)
  assert.match(styleSource, /grid-template-columns:\s*repeat\(4/)
  assert.match(styleSource, /@media \(max-width: 1100px\)/)
  assert.match(styleSource, /@media \(max-width: 700px\)/)
  assert.match(styleSource, /@media \(max-width: 430px\)/)
  assert.doesNotMatch(styleSource, /linear-gradient|radial-gradient|#000(?:000)?\b|background:\s*black/)
  assert.match(styleSource, /overflow-x:\s*auto/)
})
