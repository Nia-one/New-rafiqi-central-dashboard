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

test("task band carries a recoverable-risk verdict pill", () => {
  assert.match(componentSource, /verdictPill/)
  assert.match(componentSource, /Behind plan · \{preview\.summary\.gap\} to add/)
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
  assert.match(componentSource, /No contract, property or capital action happens automatically/)
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

test("pending thresholds remain in a closed native disclosure", () => {
  const details = componentSource.indexOf("<details")
  const pending = componentSource.indexOf("Versioned controls and pending approvals")
  assert.ok(details >= 0 && pending > details)
  assert.match(componentSource, /No value approved/)
  assert.doesNotMatch(componentSource.slice(details, componentSource.indexOf("<summary", details)), /\sopen(?:=|\s|>)/)
  assert.ok(preview.policyRegistry.some((policy) => policy.status === "Pending human approval" && policy.value === null))
})

test("shadow controls update local append-only state without a live side-effect path", () => {
  assert.match(componentSource, /setTasks\(\(current\) => current\.map/)
  assert.match(componentSource, /setAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /No property, contract, capital or external action/)
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.geolocation|use server|server action/)
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
