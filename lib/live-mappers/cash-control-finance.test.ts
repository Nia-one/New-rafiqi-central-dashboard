import assert from "node:assert/strict"
import test from "node:test"
import { aggregateLatestFinanceSnapshots, latestFinanceSnapshots, optionalSheetNumber } from "./cash-control-finance"

test("uses the latest finance snapshot per theatre before aggregation", () => {
  const rows = [
    { "finance daily id": "old-a", "theatre id": "A", "cash balance inr": "100", "updated at": "2026-07-25T10:00:00+05:30" },
    { "finance daily id": "new-a", "theatre id": "A", "cash balance inr": "150", "updated at": "2026-07-26T10:00:00+05:30" },
    { "finance daily id": "new-b", "theatre id": "B", "cash balance inr": "200", "updated at": "2026-07-26T09:00:00+05:30" },
  ]
  assert.deepEqual(latestFinanceSnapshots(rows).map((row) => row["finance daily id"]), ["new-a", "new-b"])
  assert.equal(aggregateLatestFinanceSnapshots(rows)?.["cash balance inr"], 350)
})

test("blank amounts stay missing instead of becoming zero", () => {
  assert.equal(optionalSheetNumber(""), null)
  assert.equal(optionalSheetNumber(undefined), null)
  assert.equal(aggregateLatestFinanceSnapshots([{ "theatre id": "A", "cash balance inr": "" }])?.["cash balance inr"], undefined)
})

test("an at-risk theatre governs the combined cash status", () => {
  const aggregate = aggregateLatestFinanceSnapshots([
    { "theatre id": "A", "cash guardrail status": "Protected" },
    { "theatre id": "B", "cash guardrail status": "Breached" },
  ])
  assert.equal(aggregate?.["cash guardrail status"], "At risk")
})
