import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildNewAddsPreview } from "@/lib/operating-loop/new-adds-loop"

const componentSource = readFileSync(new URL("./new-adds-workspace.tsx", import.meta.url), "utf8")
const cssSource = readFileSync(new URL("./new-adds-workspace.module.css", import.meta.url), "utf8")

test("the standalone workspace has one content heading and the exact locked question", () => {
  assert.equal((componentSource.match(/<h2/g) ?? []).length, 1)
  assert.doesNotMatch(componentSource, /<h1|<h3/)
  assert.match(componentSource, /\{preview\.question\}/)
  assert.equal(buildNewAddsPreview().question, "Are vacant FONO Nests filling at the approved run rate, cost and billing standard?")
})

test("every headline exhibit closes with a so-what implication", () => {
  assert.ok((componentSource.match(/styles\.soWhat/g) ?? []).length >= 3, "expected at least three So what lines")
  assert.ok((componentSource.match(/So what:/g) ?? []).length >= 3)
})

test("workspace ends with an explicit owner-and-done-when ask before the footer", () => {
  const askIndex = componentSource.indexOf("styles.askBand")
  const footerIndex = componentSource.indexOf("styles.footer")
  assert.ok(askIndex >= 0 && askIndex < footerIndex, "closing ask must precede the footer")
  assert.match(componentSource, /Decision required/)
  assert.match(componentSource, /accountability sits with \{owner\}/)
  assert.match(componentSource, /<dt>Owner<\/dt>/)
  assert.match(componentSource, /<dt>Done when<\/dt>/)
})

test("the first viewport renders Target to verified result in the locked order", () => {
  const order = ["Target", "Current", "Gap", "Owner", "Progress", "Verified result"]
  let cursor = componentSource.indexOf("const items")
  for (const label of order) {
    const next = componentSource.indexOf(`\"${label}\"`, cursor)
    assert.ok(next > cursor, `${label} must follow the prior first-viewport field`)
    cursor = next
  }
  assert.equal(buildNewAddsPreview().headline, "Close 9 billing-live FONO fills today; Sriperumbudur is 4 behind its approved run rate.")
})

test("the workspace renders exactly four measure cards from the typed projection", () => {
  const preview = buildNewAddsPreview()
  assert.equal(preview.measures.length, 4)
  assert.match(componentSource, /preview\.measures\.map/)
  for (const label of ["Verified fills", "Adds by source", "Actual CAC & payback", "Arrival to billing live"]) assert.ok(preview.measures.some((row) => row.label === label))
})

test("the primary visual explains today's Member target, remaining vacancy and fill time by Theatre", () => {
  for (const marker of ["Empty spots by location", "needs", "more Member", "Members billing", "Still needed", "Vacant Nests", "Average fill time", "targetLine"]) assert.match(componentSource, new RegExp(marker))
  for (const theatre of ["Oragadam", "Sriperumbudur", "Hosur"]) assert.ok(buildNewAddsPreview().theatres.some((row) => row.theatre === theatre))
})

test("the component remains FONO-only and does not create a second report or shared shell", () => {
  assert.match(componentSource, /data-supply-model=\"FONO\"/)
  assert.doesNotMatch(componentSource, /nia-dashboard|dashboard-model|OPERATIONS_TABS|Rafiqi Inside|Self Learn|LoopHealth|loop-health/)
  assert.doesNotMatch(componentSource, /supplyModel:\s*\"SP\"|data-supply-model=\"SP\"/)
})

test("shadow recovery is functional and no live side-effect path exists", () => {
  assert.match(componentSource, /resolveNewAddsShadowOutcome/)
  assert.doesNotMatch(componentSource, /recoverFillTask/)
  assert.match(componentSource, /setTasks\(\(current\) => current\.map/)
  assert.match(componentSource, /setAudit\(\(current\) => \[\.\.\.current, Object\.freeze/)
  assert.match(componentSource, /No message or Production write/)
  assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|use server|server action|navigator\.geolocation/)
})

test("domain styles are scoped, calm, responsive and contain no pure-black hero or gradient", () => {
  assert.match(componentSource, /new-adds-workspace\.module\.css/)
  assert.match(cssSource, /@media \(max-width: 1100px\)/)
  assert.match(cssSource, /@media \(max-width: 680px\)/)
  assert.doesNotMatch(cssSource, /linear-gradient|radial-gradient|background:\s*#000|background:\s*#111318/)
  assert.doesNotMatch(cssSource, /--(?:ink|muted|surface|bg|accent):\s*#/)
  assert.match(cssSource, /font-family:\s*var\(--font-ui\)/)
})

test("audit details stay closed natively and expose safety without a duplicated learning UI", () => {
  assert.match(componentSource, /<details className=\{styles\.auditDetails\}>/)
  assert.doesNotMatch(componentSource, /<details[^>]*\sopen/)
  assert.match(componentSource, /Full background record/)
  assert.match(componentSource, /Shared R-0 projection state/)
  assert.match(componentSource, /no policy auto-change/)
})

test("the visible R-0 strip and Despatch rows use the shared domain projection", () => {
  for (const label of ["Data freshness", "Clocks running", "Outcome checks"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /preview\.loopHealth/)
  assert.match(componentSource, /preview\.despatchEscalations/)
  assert.ok(buildNewAddsPreview().despatchEscalations.length > 0)
})

test("Member Adds is the visible label while internal New Adds contracts stay intact", () => {
  for (const label of ["Today's target vs actual", "Synthetic Member Adds source status", "Data and check status", "Four key numbers", "Decisions blocking progress"]) assert.match(componentSource, new RegExp(label))
  assert.match(componentSource, /resolveNewAddsShadowOutcome/)
  assert.match(componentSource, /OperationalCardStack/)
  assert.doesNotMatch(componentSource, /aria-label="New Adds/)
})
