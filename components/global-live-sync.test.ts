import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./global-live-sync.tsx", import.meta.url), "utf8")
const shell = readFileSync(new URL("./control-tower-shell.tsx", import.meta.url), "utf8")
const dashboard = readFileSync(new URL("./nia-dashboard.tsx", import.meta.url), "utf8")
const sourceSync = readFileSync(new URL("../lib/sourceSync.ts", import.meta.url), "utf8")

test("global live sync runs one quota-safe dashboard-input batch every 45 seconds", () => {
  assert.match(source, /const SYNC_SECONDS = 45/)
  assert.match(source, /LEASE_KEY/)
  assert.match(source, /AbortSignal\.timeout\(SYNC_TIMEOUT_MS\)/)
  assert.match(source, /rafiqi:sync-complete/)
  assert.match(source, /handledByAnotherTab: true/)
  assert.match(source, /\/api\/ops-data\?input=1/)
  assert.doesNotMatch(source, /attempt < 3|\/api\/ops-data\?live=1/)
  assert.match(source, /report\.changedRows/)
  assert.match(source, /router\.refresh\(\)/)
  assert.doesNotMatch(source, /window\.location\.reload\(\)/)
})

test("global live sync stays mounted across Control Tower and dashboard workspaces", () => {
  assert.equal((shell.match(/<GlobalLiveSync \/>/g) ?? []).length, 1)
  assert.match(shell, /\{workspace\}/)
})

test("manual and cross-tab refreshes preserve the active dashboard location", () => {
  assert.match(source, /LAST_CHANGED_SYNC_KEY/)
  assert.match(source, /router\.refresh\(\)/)
  assert.match(dashboard, /window\.dispatchEvent\(new Event\("rafiqi:sync-now"\)\)/)
  assert.doesNotMatch(dashboard, /window\.location\.reload\(\)/)
})

test("live sync reports aggregate changed rows and isolates unrelated source failures", () => {
  assert.match(sourceSync, /const freshDashboardInputReport = await attempt\("fresh-dashboard-inputs"/)
  assert.match(sourceSync, /const changedRows = reports\.reduce/)
  assert.match(sourceSync, /failures/)
  assert.match(sourceSync, /reports\.every/)
})
