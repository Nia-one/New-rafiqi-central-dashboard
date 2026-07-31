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

test("margin verdict is a direct live Sheet projection with honest missing-control handling", () => {
  assert.match(source, /liveData\?\.finance/)
  assert.match(source, /liveData\?\.living/)
  assert.match(source, /liveData\?\.actions/)
  assert.match(source, /liveData\?\.evidence/)
  assert.match(source, /liveData\?\.policies/)
  assert.match(source, /liveData\?\.people/)
  assert.match(source, /totalCm2Inr \/ occupiedNests/)
  assert.match(source, /Policy_Registry/)
  assert.match(source, /Control not recorded/)
  assert.match(source, /Cannot calculate/)
  assert.match(source, /Google Sheet · read-only/)
  assert.match(source, /verifiedMarginOutcomes/)
  assert.match(source, /No owner recorded/)
  assert.match(source, /verdictAnswer/)
  assert.match(source, /verdictQuestion/)
  assert.match(source, /verdictProgress/)
})

test("finance owner accepts either a People_Roster name or Actor ID", () => {
  assert.match(source, /liveOwnerReference/)
  assert.match(source, /financeOwnerReference/)
  assert.match(source, /validOwnerReference\(actionOwnerReference\) \|\| validOwnerReference\(financeOwnerReference\)/)
  assert.match(source, /display name", "name/)
  assert.match(source, /recordedOwnerName/)
  assert.match(source, /\^\(yes\|no\|true\|false\)\$/)
})

test("every headline exhibit closes with a so-what implication", () => {
  assert.ok((source.match(/styles\.soWhat/g) ?? []).length >= 3, "expected at least three So what lines")
  assert.ok((source.match(/So what:/g) ?? []).length >= 3)
})

test("workspace ends with an explicit owner-and-date ask", () => {
  assert.match(source, /styles\.askBand/)
  assert.match(source, /Decision required/)
  assert.match(source, /const decisionTitle =/)
  assert.match(source, /const decisionReason =/)
  assert.match(source, /const decisionDue = isLive \? marginApproval\?\.dueAt/)
  assert.match(source, /Policy_Registry has no approved per-unit control; no gap is claimed/)
  assert.match(source, /marginApproval\.businessReason/)
  assert.match(source, /<dt>Owner<\/dt>/)
})

test("Nia Margins renders Loop Health, waterfall and attributed owners", () => {
  assert.equal((source.match(/<LoopHealthStrip/g) ?? []).length, 1)
  assert.match(source, /Recorded CM2 by pillar/)
  assert.match(source, /item\.ownerRole/)
  assert.match(source, /item\.routeTo/)
  assert.match(source, /item\.actionState/)
  assert.match(source, /preview\.actions/)
  assert.match(source, /preview\.despatchEscalations/)
})

test("loop health derives live feed freshness, clocks, and verification state", () => {
  assert.match(source, /buildLoopHealth/)
  for (const feed of ["Finance CM2", "Living occupancy", "Work contribution", "Essentials contribution"]) assert.match(source, new RegExp(feed))
  assert.match(source, /marginActions\.filter/)
  assert.match(source, /marginEvidence\.filter/)
  assert.match(source, /verifiedMarginOutcomes/)
  assert.match(source, /reopenedMarginOutcomes/)
  assert.match(source, /awaitingMarginOutcomes/)
  assert.match(source, /earliestTimestamp/)
  assert.match(source, /const marginHealth = liveMarginHealth \?\? preview\.loopHealth/)
  assert.match(source, /<LoopHealthStrip health=\{marginHealth\}/)
})

test("headline measures use live finance and occupancy fields without inventing pillar CM2", () => {
  assert.match(source, /const liveOccupancyPct = contractedNests > 0/)
  assert.match(source, /const liveOccupancyTargetPct = rowNumber\(occupancyPolicy/)
  for (const field of ["living cm2 inr", "work cm2 inr", "essentials cm2 inr"]) assert.match(source, new RegExp(field))
  assert.match(source, /Pillar CM2 fields not recorded in Finance_Daily/)
  assert.match(source, /Approved Policy_Registry control not recorded/)
  assert.match(source, /Approved occupancy control not recorded/)
  assert.match(source, /studio gross margin pct/)
  assert.match(source, /headlineMeasuresSummary/)
  assert.match(source, /measureFullUseCm2/)
  assert.match(source, /measurePillarCm2/)
  assert.match(source, /measureOccupancyPct/)
  assert.match(source, /measureNegativeStudios/)
})

test("margin implication is calculated from live controls and never invents an operating cause", () => {
  assert.match(source, /marginImplicationSummary/)
  assert.match(source, /const marginImplication = !isLive/)
  assert.match(source, /Policy_Registry has no approved per-unit control/)
  assert.match(source, /does not infer unrecorded pillar costs/)
  assert.match(source, /operating cause cannot yet be attributed/)
  assert.match(source, /No full-use CM2 gap is recorded/)
  assert.match(source, /summary: marginImplicationSummary/)
  assert.match(source, /<p className=\{styles\.soWhat\}>\{marginImplication\}<\/p>/)
})

test("collection leakage remains outside billed CM2 and learning stays governed", () => {
  assert.match(source, /Collection leakage stays in Cash &amp; Control/)
  assert.match(source, /preview\.learning\.attributionLabel/)
  assert.match(source, /preview\.learning\.requiredDisposition/)
  assert.match(source, /cannot change CM definitions, prices, terms or Studio status/)
})

test("profit drivers and learning switch to governed live records", () => {
  assert.match(source, /liveData\?\.studios/)
  assert.match(source, /liveData\?\.learningHistory/)
  assert.match(source, /pillarControl/)
  assert.match(source, /const liveProfitDrivers = marginActions\.map/)
  assert.match(source, /target unit/)
  assert.match(source, /recorded units/)
  assert.match(source, /Recorded CM2 by pillar/)
  assert.match(source, /No Nia Margins action is recorded in the user-input TEAM_REQ_ACTION_LOG tab/)
  assert.match(source, /marginActions\.length/)
  assert.match(source, /verifiedMarginOutcomes/)
  assert.match(source, /reopenedMarginOutcomes/)
  assert.match(source, /liveEscalatedMargins/)
  assert.match(source, /marginLearning/)
  assert.match(source, /No Nia Margins observation is recorded in the user-input TEAM_LEARNING_HISTORY tab/)
  assert.match(source, /No linked materiality approval is recorded/)
  assert.match(source, /No recommendation is recorded in the user-input TEAM_LEARNING_HISTORY tab/)
  assert.match(source, /no recommendation changes margin definitions/)
})
