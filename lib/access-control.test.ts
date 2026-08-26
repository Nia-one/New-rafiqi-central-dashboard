import assert from "node:assert/strict"
import test from "node:test"
import { dashboardAccessForRole, financeAccessAllowed, roleAssignments } from "@/lib/access-control"

test("role assignments accept only known roles", () => {
  const roles = roleAssignments("ops@nia.one:operator,finance@nia.one:finance,bad@nia.one:superuser")
  assert.equal(roles.get("ops@nia.one"), "operator")
  assert.equal(roles.get("finance@nia.one"), "finance")
  assert.equal(roles.has("bad@nia.one"), false)
})

test("department roles receive least-privilege dashboard access", () => {
  assert.deepEqual(dashboardAccessForRole("operator"), { administration: false, operations: true, finance: false, reporting: true, canOperate: true })
  assert.deepEqual(dashboardAccessForRole("finance"), { administration: false, operations: false, finance: true, reporting: true, canOperate: false })
  assert.deepEqual(dashboardAccessForRole("administrator"), { administration: true, operations: true, finance: true, reporting: true, canOperate: true })
})

test("finance data is restricted to finance and administrator roles", () => {
  assert.equal(financeAccessAllowed("finance"), true)
  assert.equal(financeAccessAllowed("administrator"), true)
  assert.equal(financeAccessAllowed("operator"), false)
  assert.equal(financeAccessAllowed(null), false)
})
