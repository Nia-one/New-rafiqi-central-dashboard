import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("./nia-margins-workspace.tsx", import.meta.url), "utf8")

test("Nia Margins renders one answer, one question and exactly four measures", () => {
  assert.equal((source.match(/<h2>/g) ?? []).length, 1)
  assert.equal((source.match(/<article className=\{styles\.measure\}/g) ?? []).length, 4)
  assert.match(source, /preview\.question/)
})

test("headline carries a verdict pill that resolves the decision", () => {
  assert.match(source, /verdictPill/)
  assert.match(source, /verdictLabel/)
  assert.match(source, /Below control · \$\{inr\(gapInr\)\}\/unit to recover/)
})

test("every headline exhibit closes with a so-what implication", () => {
  assert.ok((source.match(/styles\.soWhat/g) ?? []).length >= 3, "expected at least three So what lines")
  assert.ok((source.match(/So what:/g) ?? []).length >= 3)
})

test("workspace ends with an explicit owner-and-date ask", () => {
  assert.match(source, /styles\.askBand/)
  assert.match(source, /Decision required/)
  assert.match(source, /accountability sits with \{decisionOwner\}/)
  assert.match(source, /<dt>Owner<\/dt>/)
})

test("Nia Margins renders Loop Health, waterfall and attributed owners", () => {
  assert.equal((source.match(/<LoopHealthStrip/g) ?? []).length, 1)
  assert.match(source, /Billed CM2 waterfall by pillar/)
  assert.match(source, /item\.ownerRole/)
  assert.match(source, /item\.routeTo/)
  assert.match(source, /item\.actionState/)
  assert.match(source, /preview\.actions/)
  assert.match(source, /preview\.despatchEscalations/)
})

test("collection leakage remains outside billed CM2 and learning stays governed", () => {
  assert.match(source, /Collection leakage stays in Cash &amp; Control/)
  assert.match(source, /preview\.learning\.attributionLabel/)
  assert.match(source, /preview\.learning\.requiredDisposition/)
  assert.match(source, /cannot change CM definitions, prices, terms or Studio status/)
})
