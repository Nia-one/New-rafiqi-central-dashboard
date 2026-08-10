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

test("Essentials cost sync preserves user inputs and mirrors order items with formulas", () => {
  assert.match(source, /Order_Items!A2:A/);
  assert.match(source, /Order_Items!A:P,16,FALSE/);
  assert.match(source, /Order_Items!A:J,10,FALSE/);
  assert.doesNotMatch(source, /range: `\$\{COST_INPUT_TAB\}!A\$\{startRow\}/);
  assert.doesNotMatch(source, /range: `\$\{COST_INPUT_TAB\}!E\$\{startRow\}:G/);
});

test("Essentials bot projects every page-level live dataset", () => {
  assert.match(source, /upsert\("Essentials_Hourly"/);
  assert.match(source, /upsert\("Essentials_Inventory"/);
  assert.match(source, /upsert\("Essentials_Cohorts"/);
  assert.match(source, /upsert\("Essentials_Dashboard"/);
  assert.match(source, /"cohort id": `BOT-ESS-GROUP-/);
  assert.match(source, /metricRow\("essentials_headline_cm"/);
});
