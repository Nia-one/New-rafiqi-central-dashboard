import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("collections preserve overpayments as negative balances", () => {
  const sync = readFileSync(new URL("./freshDashboardInputSync.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/live-sheet-workspace.tsx", import.meta.url), "utf8");
  assert.match(sync, /"current due inr": num\(cell\(table, row, "Billed_INR"\)\) - num\(cell\(table, row, "Collected_INR"\)\)/);
  assert.match(workspace, /Invoice-wise collection balance/);
  assert.match(workspace, /BALANCE.*inr\(amount\(row, "current due inr"\) \|\| amount\(row, "total billed inr"\) - amount\(row, "total collected inr"\)\)/s);
});
