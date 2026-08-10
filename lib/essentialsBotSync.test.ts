import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "lib", "essentialsBotSync.ts"), "utf8");

test("Essentials bot writes new governed rows explicitly from column A", () => {
  assert.match(source, /range: `\$\{tabName\}!A\$\{startRow\}`/);
  assert.doesNotMatch(source, /values\.append\(\{ spreadsheetId, range: `\$\{tabName\}!A:AZ`/);
});

test("Essentials reconciliation owns historical shifted BOT-ESS rows", () => {
  assert.match(source, /row\.some\(\(value\) => norm\(value\)\.startsWith\("bot-ess-"\)\)/);
});

test("Essentials fulfilment costs use the persistent order-item sidecar", () => {
  assert.match(source, /const COST_INPUT_TAB = "Rafiqi_Order_Item_Costs"/);
  assert.match(source, /costInputs\.byItemId\.get/);
  assert.match(source, /savedCosts\.direct \+ savedCosts\.packaging \+ savedCosts\.delivery/);
});

test("Essentials cost sync preserves user inputs and only inserts missing order items", () => {
  assert.match(source, /existingIds\.has\(id\)/);
  assert.match(source, /range: `\$\{COST_INPUT_TAB\}!A\$\{startRow\}:D/);
  assert.match(source, /range: `\$\{COST_INPUT_TAB\}!J\$\{startRow\}:J/);
  assert.doesNotMatch(source, /range: `\$\{COST_INPUT_TAB\}!E\$\{startRow\}:G/);
});
