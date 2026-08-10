import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./global-live-sync.tsx", import.meta.url), "utf8")
const shell = readFileSync(new URL("./control-tower-shell.tsx", import.meta.url), "utf8")
const dashboard = readFileSync(new URL("./nia-dashboard.tsx", import.meta.url), "utf8")

test("global live sync runs every 45 seconds with locking and retries", () => {
  assert.match(source, /const SYNC_SECONDS = 45/)
  assert.match(source, /LEASE_KEY/)
  assert.match(source, /attempt < 3/)
  assert.match(source, /\/api\/ops-data\?live=1/)
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
