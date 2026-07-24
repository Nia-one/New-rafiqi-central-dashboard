import assert from "node:assert/strict"
import test from "node:test"
import { NO_DATA, type MismatchInput } from "./allocation-types"
import { supplyOptions } from "./allocation-data"
import {
  buildDailyActionGrid,
  buildRankedQueue,
  classifyEssentials,
  essentialsDeadStockCm,
  essentialsStockoutCm,
  essentialsMatchKey,
  fonoBalance,
  fonoMatchKey,
  getMismatchForStage,
  isEligibleSupply,
  mismatchById,
  scoreComponents,
  shramParkMatchKey,
  urgencyMultiplier,
} from "./allocation-engine"
import { trajectory } from "./ops-data"
import { appendActionLogEntry, seedActionLog } from "./action-log"

test("domain-specific match keys use the correct join fields", () => {
  const sram = mismatchById("m-sram-shortfall-sriperumbudur")!
  const fono = mismatchById("m-fono-idle-chakan")!
  const ess = mismatchById("m-ess-stockout-hosur")!
  assert.equal(shramParkMatchKey(sram.joinKey), "Coromandel (Tamil Nadu) | Sriperumbudur | 2026-07-17")
  assert.equal(fonoMatchKey(fono.joinKey), "Deccan (Pune) | Chakan 04 | 2026-07-13")
  assert.equal(essentialsMatchKey(ess.joinKey), "Wellington (Karnataka) | Hosur 01 | shampoo-sachet | 2026-07-13")
})

test("stage lookup resolves the same mismatch contract used by the Overview queue", () => {
  const queue = buildRankedQueue()
  for (const id of ["m-fono-idle-chakan", "m-sram-shortfall-sriperumbudur", "m-ess-stockout-hosur"]) {
    const overview = queue.find((item) => item.id === id)!
    const stage = getMismatchForStage(overview.domain, overview.joinKey)!
    assert.equal(stage.id, overview.id)
    assert.equal(stage.nextAction, overview.nextAction)
    assert.equal(stage.accountableOwner, overview.accountableOwner)
    assert.equal(stage.forwardCmAtRisk24h, overview.forwardCmAtRisk24h)
  }
})

test("a newly diagnosed entity uses the engine action template and scoring contract", () => {
  const base = mismatchById("m-fono-activation-noida")!
  const { attentionBucket: _attention, nextAction: _action, actionBlocked: _blocked, missingField: _missing, ...input } = base
  const fallbackInput: MismatchInput = {
    ...input,
    id: "m-fono-generated-test",
    theatre: "Wellington (Karnataka)",
    where: "Test Studio 09",
    joinKey: { theatreId: "Wellington (Karnataka)", studioId: "Test Studio 09", dateBucket: "2026-07-13" },
    gapQty: 24,
    supplyQty: 24,
    demandQty: 0,
    ageHours: 72,
  }
  const generated = getMismatchForStage(fallbackInput.domain, fallbackInput.joinKey, { fallbackInput })!
  assert.equal(generated.nextAction, "Assign occupancy owner for Test Studio 09; 24 Nests unoccupied for 3 days since go-live.")
  assert.notEqual(scoreComponents(generated), NO_DATA)
})

test("Shram Park supply qualifies only within 2km and the 24h SLA by the required date", () => {
  const byId = Object.fromEntries(supplyOptions.map((option) => [option.id, isEligibleSupply(option)]))
  assert.equal(byId["opt-hosur"], true)
  assert.equal(byId["opt-chakan"], false) // 2.6km > 2km
  assert.equal(byId["opt-sriperumbudur"], false) // 27h > 24h SLA
})

test("FONO computes surplus, shortfall and whole days idle", () => {
  assert.deepEqual(fonoBalance(0, 128, 120), { surplus: 128, shortfall: 0, idleDays: 5 })
  assert.deepEqual(fonoBalance(282, 0, 27), { surplus: -282, shortfall: 282, idleDays: 1 })
})

test("Essentials classification separates stockout from dead-stock by days cover", () => {
  assert.equal(classifyEssentials(0.8), "stockout")
  assert.equal(classifyEssentials(5), "dead-stock")
  assert.equal(classifyEssentials(2), "stockout")
})

test("stale or missing data stays a No-data exception, never zero", () => {
  const stale = mismatchById("m-ess-dataquality-sriperumbudur")!
  assert.equal(stale.demandQty, NO_DATA)
  assert.equal(stale.supplyQty, NO_DATA)
  assert.equal(stale.gapQty, NO_DATA)
  assert.equal(stale.forwardCmAtRisk24h, NO_DATA)
})

test("all domains reconcile to the same forward-CM basis", () => {
  const stockout = mismatchById("m-ess-stockout-hosur")!
  const dead = mismatchById("m-ess-deadstock-chakan")!
  assert.equal(essentialsStockoutCm(700, 260), 182000)
  assert.equal(stockout.forwardCmAtRisk24h, 182000)
  assert.equal(essentialsDeadStockCm(480, 200), 96000)
  assert.equal(dead.forwardCmAtRisk24h, 96000)
})

test("urgency multiplier starts at 1, rises after threshold and caps at 2", () => {
  assert.equal(urgencyMultiplier(6, 8), 1)
  assert.equal(urgencyMultiplier(27, 24), 1.125)
  assert.equal(urgencyMultiplier(120, 48), 2)
  assert.equal(urgencyMultiplier(200, 10), 2)
})

test("queue scores, normalizes to 100 and orders by raw priority", () => {
  const queue = buildRankedQueue()
  assert.deepEqual(queue.map((row) => row.id), [
    "m-fono-idle-chakan",
    "m-sram-shortfall-sriperumbudur",
    "m-ess-stockout-hosur",
    "m-ess-deadstock-chakan",
    "m-fono-activation-noida",
    "m-ess-dataquality-sriperumbudur",
  ])
  assert.equal(queue[0].priorityScore, 100)
  assert.equal(queue[0].scoreComponents !== NO_DATA && queue[0].scoreComponents.rawPriority, 607200)
  assert.equal(queue.at(-1)?.priorityScore, NO_DATA) // data-quality row cannot be scored
})

test("daily action grid groups by exact Theatre and category without changing rank order", () => {
  const grid = buildDailyActionGrid()
  assert.deepEqual(grid.Living["Deccan (Pune)"]?.map((row) => row.id), ["m-fono-idle-chakan"])
  assert.deepEqual(grid.Living["Coromandel (Tamil Nadu)"]?.map((row) => row.id), ["m-sram-shortfall-sriperumbudur"])
  assert.deepEqual(grid.Essentials["Wellington (Karnataka)"]?.map((row) => row.id), ["m-ess-stockout-hosur"])
  assert.deepEqual(grid.Essentials["Deccan (Pune)"]?.map((row) => row.id), ["m-ess-deadstock-chakan"])
  assert.equal(grid.Work["Rajputana (NCR)"], null)
  for (const category of [grid.Living, grid.Essentials]) {
    for (const actions of Object.values(category)) assert.ok(actions !== null && actions.length <= 3)
  }
})

test("every canonical issue carries a reviewed five whys analysis", () => {
  const ids = [
    "m-fono-idle-chakan",
    "m-sram-shortfall-sriperumbudur",
    "m-ess-stockout-hosur",
    "m-ess-deadstock-chakan",
    "m-fono-activation-noida",
    "m-ess-dataquality-sriperumbudur",
    "m-sram-resolved-hosur",
    "m-ess-resolved-recharge-sriperumbudur",
  ]
  for (const id of ids) {
    const analysis = mismatchById(id)!.rootCauseAnalysis
    assert.equal(analysis.whys.length, 5)
    assert.ok(analysis.whys.every((why) => why.trim().length > 0))
    assert.ok(analysis.rootCause.length > 0)
    assert.ok(analysis.recommendedSolution.length > 0)
    assert.ok(analysis.evidenceReferences.length > 0)
    assert.equal(analysis.review.status, "Evidence-backed authored")
    assert.ok(analysis.review.reviewedBy.length > 0)
    assert.ok(analysis.review.reviewedAt.length > 0)
  }
})

test("uncertain and no-data analyses state evidence gaps instead of inventing causality", () => {
  const living = mismatchById("m-fono-idle-chakan")!.rootCauseAnalysis
  const essentials = mismatchById("m-ess-stockout-hosur")!.rootCauseAnalysis
  const noData = mismatchById("m-ess-dataquality-sriperumbudur")!.rootCauseAnalysis
  assert.match(living.whys[4], /Evidence gap/)
  assert.match(essentials.whys[4], /Evidence gap/)
  assert.match(noData.whys[4], /Evidence gap/)
  assert.match(noData.recommendedSolution, /Restore and validate/)
})

test("resolved and dismissed rows are excluded from the queue", () => {
  assert.equal(buildRankedQueue().some((row) => row.id === "m-sram-resolved-hosur"), false)
  const dismissedLog = appendActionLogEntry(seedActionLog, {
    queue_item_id: "m-fono-idle-chakan",
    actor_id: "operations-lead",
    action_type: "dismiss",
    note: "Duplicate illustrative issue",
  }, "2026-07-15T14:01:00+05:30", "test-dismiss")
  const dismissed = buildRankedQueue({ actionLog: dismissedLog, now: "2026-07-15T14:01:00+05:30" })
  assert.equal(dismissed.some((row) => row.id === "m-fono-idle-chakan"), false)
  assert.equal(dismissed[0].id, "m-sram-shortfall-sriperumbudur")
  assert.equal(dismissed[0].priorityScore, 100)
})

test("assigning a row lowers its raw priority via the attention weight", () => {
  const detected = buildRankedQueue().find((row) => row.id === "m-fono-idle-chakan")!
  const assignedLog = appendActionLogEntry(seedActionLog, {
    queue_item_id: "m-fono-idle-chakan",
    actor_id: "operations-lead",
    action_type: "assign",
  }, "2026-07-15T14:01:00+05:30", "test-assign")
  const inProgress = buildRankedQueue({ actionLog: assignedLog, now: "2026-07-15T14:01:00+05:30" }).find((row) => row.id === "m-fono-idle-chakan")!
  const detectedRaw = detected.scoreComponents !== NO_DATA ? detected.scoreComponents.rawPriority : 0
  const inProgressRaw = inProgress.scoreComponents !== NO_DATA ? inProgress.scoreComponents.rawPriority : 0
  assert.ok(inProgressRaw < detectedRaw)
})

test("deterministic templates populate only from verified fields", () => {
  assert.equal(mismatchById("m-sram-shortfall-sriperumbudur")!.nextAction, "Source 282 viable Nests within 2km of Sriperumbudur by 17 Jul.")
  assert.equal(mismatchById("m-fono-idle-chakan")!.nextAction, "Assign occupancy owner for Chakan 04; 128 Nests unoccupied for 5 days since go-live.")
  assert.equal(mismatchById("m-ess-stockout-hosur")!.nextAction, "Repool Shampoo sachet to Hosur 01 before 18:00; ₹1.8L CM at risk.")
  assert.equal(mismatchById("m-ess-deadstock-chakan")!.nextAction, "Reprice, transfer or return Work footwear at Chakan 04; ₹96k expected loss, aged 34 days.")
})

test("missing template inputs block the action instead of fabricating a number", () => {
  const stale = mismatchById("m-ess-dataquality-sriperumbudur")!
  assert.equal(stale.actionBlocked, true)
  assert.equal(stale.missingField, "forward CM at risk")
  assert.equal(stale.nextAction, "Action blocked: missing forward CM at risk")
})

test("Overview shows the top three unresolved rows and a live +N expansion", () => {
  const queue = buildRankedQueue()
  assert.equal(queue.slice(0, 3).map((row) => row.id).join(","), "m-fono-idle-chakan,m-sram-shortfall-sriperumbudur,m-ess-stockout-hosur")
  assert.equal(queue.length - 3, 3) // "+3 more"
})

test("CM Trajectory values remain unchanged", () => {
  const run = trajectory()
  assert.equal(run.current, 1360000)
  assert.equal(run.projection, 3240000)
  assert.equal(run.target, 4000000)
  assert.equal(Math.round(run.askRate / 10000) * 10000, 150000)
  assert.equal(run.askRateMultiple, 1.4)
  assert.equal(run.points.find((point) => point.day === 13)?.actual, 1360000)
  assert.equal(run.points.at(-1)?.day, 31)
})
