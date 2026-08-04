import assert from "node:assert/strict"
import test from "node:test"
import { availableDashboardPeriods, filterDashboardDataByPeriod } from "./dashboardService"

const snapshot = {
  financeDaily: [
    ["business date", "revenue inr"],
    ["2026-06-30", 100],
    ["2026-07-01", 200],
    ["2026-07-31", 300],
  ],
  enterpriseDemand: [
    ["demand id", "opened at"],
    ["D-JUN", "2026-06-12T10:00:00+05:30"],
    ["D-JUL", "2026-07-12T10:00:00+05:30"],
  ],
  studioMaster: [["studio id", "activation date"], ["S1", "2025-01-01"]],
}

test("available periods are discovered from governed temporal tabs", () => {
  assert.deepEqual(availableDashboardPeriods(snapshot), ["2026-07", "2026-06"])
})

test("one selected month filters temporal rows but retains master data", () => {
  const filtered = filterDashboardDataByPeriod(snapshot, "2026-07")
  assert.deepEqual(filtered.financeDaily, [["business date", "revenue inr"], ["2026-07-01", 200], ["2026-07-31", 300]])
  assert.deepEqual(filtered.enterpriseDemand, [["demand id", "opened at"], ["D-JUL", "2026-07-12T10:00:00+05:30"]])
  assert.deepEqual(filtered.studioMaster, snapshot.studioMaster)
})

test("All preserves the complete cumulative snapshot", () => {
  assert.equal(filterDashboardDataByPeriod(snapshot, "all"), snapshot)
})

test("explicit reporting month is authoritative over operational timestamps", () => {
  const governed = {
    actionLog: [
      ["action id", "reporting month", "created at"],
      ["A-AUG", "2026-08", "2026-07-31T23:59:00Z"],
    ],
  }
  assert.deepEqual(availableDashboardPeriods(governed), ["2026-08"])
  assert.equal(filterDashboardDataByPeriod(governed, "2026-07").actionLog.length, 1)
  assert.equal(filterDashboardDataByPeriod(governed, "2026-08").actionLog.length, 2)
})
