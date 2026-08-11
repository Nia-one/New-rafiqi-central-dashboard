import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const shell = readFileSync(new URL("./control-tower-shell.tsx", import.meta.url), "utf8")
const dashboard = readFileSync(new URL("./nia-dashboard.tsx", import.meta.url), "utf8")

test("Control Tower Nia Growth launch is not overwritten by a stale dashboard page", () => {
  assert.match(shell, /"Nia growth": "Nia Growth"/)
  assert.match(shell, /initialActive=\{activeWorkspace\} restoreStoredPage=\{false\}/)
  assert.match(dashboard, /restoreStoredPage \? storedActive \|\| initialActive : initialActive/)
})
