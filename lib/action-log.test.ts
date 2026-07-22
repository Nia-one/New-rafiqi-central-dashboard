import assert from "node:assert/strict"
import test from "node:test"
import {
  ACTION_LOG_BLOCK_START,
  ACTION_LOG_REFERENCE_AT,
  actionHistory,
  actorStalenessHours,
  appendActionLogEntry,
  closuresBetween,
  deriveQueueItemState,
  latestAssignee,
  seedActionLog,
} from "./action-log"
import { buildRankedQueue } from "./allocation-engine"
import { mismatchInputs } from "./allocation-data"
import { blockNarrative } from "./ops-data"

const itemId = "m-fono-idle-chakan"

test("every actionable report highlight starts in the shared action log", () => {
  for (const mismatch of mismatchInputs) {
    const origin = actionHistory(mismatch.id, seedActionLog).find((entry) => entry.action_type === "detect")
    assert.ok(origin, `${mismatch.id} is missing its detect event`)
  }
})

test("every workflow change appends a row without overwriting prior history", () => {
  const before = actionHistory(itemId, seedActionLog)
  const after = appendActionLogEntry(seedActionLog, {
    queue_item_id: itemId,
    actor_id: "operations-lead",
    action_type: "assign",
    note: "Owner accepted",
  }, "2026-07-15T14:01:00+05:30", "test-append")
  assert.equal(actionHistory(itemId, after).length, before.length + 1)
  assert.deepEqual(actionHistory(itemId, after).slice(0, before.length), before)
  assert.equal(deriveQueueItemState(itemId, after, "2026-07-15T14:01:00+05:30").status, "Assigned")
})

test("age and SLA priority are derived from the detect timestamp", () => {
  const ageTarget = "m-sram-shortfall-sriperumbudur"
  const backdated = seedActionLog.map((entry) => entry.id === `log-${ageTarget}-detect`
    ? { ...entry, executed_at: "2026-07-10T14:00:00+05:30" }
    : entry)
  const original = buildRankedQueue().find((item) => item.id === ageTarget)!
  const aged = buildRankedQueue({ actionLog: backdated, now: ACTION_LOG_REFERENCE_AT }).find((item) => item.id === ageTarget)!
  assert.equal(aged.ageHours, 120)
  assert.ok(aged.ageHours > aged.thresholdHours)
  assert.notDeepEqual(aged.scoreComponents, original.scoreComponents)
})

test("closure delta and JCO staleness change when log timestamps are backdated", () => {
  assert.equal(closuresBetween(seedActionLog, ACTION_LOG_BLOCK_START, ACTION_LOG_REFERENCE_AT), 2)
  assert.equal(actorStalenessHours("jco-c", seedActionLog, ACTION_LOG_REFERENCE_AT), 4)

  const moved = seedActionLog.map((entry) => {
    if (entry.action_type === "close" && entry.id.includes("sram-resolved")) return { ...entry, executed_at: "2026-07-15T11:59:00+05:30" }
    if (entry.id === "log-jco-c-note") return { ...entry, executed_at: "2026-07-15T07:00:00+05:30" }
    return entry
  })
  assert.equal(closuresBetween(moved, ACTION_LOG_BLOCK_START, ACTION_LOG_REFERENCE_AT), 1)
  assert.equal(actorStalenessHours("jco-c", moved, ACTION_LOG_REFERENCE_AT), 7)
  assert.match(blockNarrative(moved), /\+1 closures/)
  assert.match(blockNarrative(moved), /stale 7h/)
})

test("actor and dismissal reason are required", () => {
  assert.throws(() => appendActionLogEntry(seedActionLog, {
    queue_item_id: itemId,
    actor_id: "",
    action_type: "assign",
  }, ACTION_LOG_REFERENCE_AT, "no-actor"), /actor is required/i)
  assert.throws(() => appendActionLogEntry(seedActionLog, {
    queue_item_id: itemId,
    actor_id: "operations-lead",
    action_type: "dismiss",
  }, ACTION_LOG_REFERENCE_AT, "no-reason"), /dismissal reason is required/i)
})

test("reassignment preserves the original assignment and updates the current assignee", () => {
  const assigned = appendActionLogEntry(seedActionLog, {
    queue_item_id: itemId,
    actor_id: "operations-lead",
    action_type: "assign",
  }, "2026-07-15T14:01:00+05:30", "first-assign")
  const reassigned = appendActionLogEntry(assigned, {
    queue_item_id: itemId,
    actor_id: "jco-demand",
    action_type: "reassign",
  }, "2026-07-15T14:02:00+05:30", "second-assign")
  const assignments = actionHistory(itemId, reassigned).filter((entry) => entry.action_type === "assign" || entry.action_type === "reassign")
  assert.deepEqual(assignments.map((entry) => entry.id), ["first-assign", "second-assign"])
  assert.equal(latestAssignee(itemId, reassigned), "jco-demand")
})
