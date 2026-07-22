import assert from "node:assert/strict"
import test from "node:test"
import { REPORTING_EVENT_MAP, reportingDisposition } from "@/lib/reporting-event-map"
import { TRANSACTION_STATES } from "@/lib/transaction-types"

test("every transaction state has an explicit reporting disposition", () => {
  assert.deepEqual(Object.keys(REPORTING_EVENT_MAP).sort(), [...TRANSACTION_STATES].sort())
})

test("restricted payroll overrides verified projection eligibility", () => {
  assert.equal(reportingDisposition({ to: "Reconciled", verified: true, analyticsAllowed: false, classification: "Restricted payroll" }), "Excluded restricted payroll")
  assert.equal(reportingDisposition({ to: "Reconciled", verified: true, analyticsAllowed: true, classification: "Operational" }), "Verified projection")
})
