import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("./enterprise-demand-supply-match.ts", import.meta.url), "utf8")

test("dashboard loader reads the governed backend snapshot", () => {
  const loader = source.slice(
    source.indexOf("export async function loadEnterpriseDemandSupplyMatches"),
    source.indexOf("export async function syncEnterpriseSupplyMatchColumns"),
  )

  assert.match(loader, /readBackendMatches\(\)/)
  assert.doesNotMatch(loader, /calculateEnterpriseDemandSupplyMatches\(\)/)
  assert.doesNotMatch(loader, /readStoredMatches\(\)/)
  assert.match(source, /const BACKEND_MATCH_RESULTS_TAB = "Enterprise_Demand_Supply_Matches"/)
})

test("live source sync persists the complete payload into the backend", () => {
  const sync = source.slice(source.indexOf("export async function syncEnterpriseSupplyMatchColumns"))

  assert.match(sync, /loadSourceEnterpriseDemandSupplyMatches\(\)/)
  assert.match(sync, /persistBackendMatches\(matches, syncedAt\)/)
  assert.match(source, /process\.env\.GOOGLE_SHEET_ID/)
})
