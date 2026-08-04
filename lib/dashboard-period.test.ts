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
