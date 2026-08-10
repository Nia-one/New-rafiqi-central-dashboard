import assert from "node:assert/strict"
import test from "node:test"
import { selectApprovedMarginTarget } from "./margin-target"

test("live approved Nia Margins target wins over stale sample and legacy controls", () => {
  const selected = selectApprovedMarginTarget([
    { "policy id": "POL-NIA-CM2-001", "policy name": "Full-use CM2", "policy value": "500", status: "Approved", "updated at": "2026-08-05" },
    { "policy id": "SAMPLE-TARGET-MARGIN-001", "policy name": "Monthly Target · Nia Margins · Full-use CM2 target", "policy value": "300", status: "Approved", "updated at": "2026-08-11" },
    { "policy id": "TARGET-20260811-002", "policy name": "Monthly Target · Nia Margins · Full-use CM2 target", "policy value": "610", status: "Approved", "updated at": "2026-08-11T03:30:00+05:30" },
  ])

  assert.equal(selected?.["policy id"], "TARGET-20260811-002")
  assert.equal(selected?.["policy value"], "610")
})
