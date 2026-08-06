import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("./work-screen.tsx", import.meta.url), "utf8")

test("connected Work rows render the reference fields as semantic employer and Studio views", () => {
  for (const label of ["Main point", "Work measures", "Employer share", "Studio ARPU", "Source and coverage"]) {
    assert.match(source, new RegExp(label))
  }
  for (const field of ["Studio ID", "Theatre", "enterprise or employer", "active Members", "Work revenue", "period start", "period end"]) {
    assert.match(source, new RegExp(field, "i"))
  }
})

test("Work keeps unsupported Studio detail unavailable and deduplicates current heartbeats", () => {
  assert.match(source, /latestById/)
  assert.match(source, /Studio ARPU is not yet confirmable/)
  assert.match(source, /missing fields are not converted to zero/)
  assert.doesNotMatch(source, /LiveSheetWorkspace/)
})
