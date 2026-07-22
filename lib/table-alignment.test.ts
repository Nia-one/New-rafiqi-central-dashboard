import assert from "node:assert/strict"
import test from "node:test"
import { isNumericColumn } from "@/components/data-table"

test("operating tables align measures numerically and keep dimensions textual", () => {
  for (const label of ["MEMBERS", "AVAILABLE", "OCCUPANCY", "GMV", "D30", "DAYS LIVE"]) {
    assert.equal(isNumericColumn(label), true, `${label} should align on the numeric rail`)
  }

  for (const label of ["STUDIO", "THEATRE", "OWNER", "JCO", "SOURCE"]) {
    assert.equal(isNumericColumn(label), false, `${label} should stay left aligned`)
  }
})
