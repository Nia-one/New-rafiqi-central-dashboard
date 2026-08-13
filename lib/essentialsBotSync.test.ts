import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { essentialsCollectedAmount, isFulfilledEssentialsOrder, latestEssentialsTimestamp } from "./essentialsBotSync";

const source = fs.readFileSync(path.join(process.cwd(), "lib", "essentialsBotSync.ts"), "utf8");

test("Essentials bot writes new governed rows explicitly from column A", () => {
  assert.match(source, /range: `\$\{tabName\}!A\$\{startRow\}`/);
  assert.match(source, /gridProperties: \{ rowCount: requiredRows \}/);
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

test("Essentials sync does not restore permanently deleted historical orders", () => {
  assert.doesNotMatch(source, /HISTORICAL_ORDER_RECOVERY/);
  assert.doesNotMatch(source, /HISTORICAL_ITEM_RECOVERY/);
  assert.doesNotMatch(source, /NIA-OFF-20260811-01[567]/);
  assert.doesNotMatch(source, /recoveryWrites\.length/);
});

test("Essentials report uses the UI Occupancy contract without duplicate input columns", () => {
  assert.doesNotMatch(source, /"reporting_month", "total_active_member_count", "studio_revenue"/);
  assert.match(source, /range: `\$\{COST_INPUT_TAB\}!A:M`/);
  assert.match(source, /`\$\{COST_INPUT_TAB\}!R2:X200`/);
  assert.match(source, /`\$\{COST_INPUT_TAB\}!AB2:AF5`/);
  assert.match(source, /const reportGroups = new Map<string, Group>\(\)/);
  assert.match(source, /range: `\$\{COST_INPUT_TAB\}!K2`/);
  assert.match(source, /range: `\$\{COST_INPUT_TAB\}!M2`/);
  assert.match(source, /summaryInputs\.studios\.get\(norm\(g\.studio\)\) \|\| summaryInputs\.studios\.get\(norm\(g\.studioName\)\)/);
  assert.match(source, /"curry unique members": category\?\.curryUniqueMembers \?\? 0/);
});

test("Essentials bot projects every page-level live dataset", () => {
  assert.match(source, /upsert\("Essentials_Hourly"/);
  assert.match(source, /upsert\("Essentials_Inventory"/);
  assert.match(source, /upsert\("Essentials_Cohorts"/);
  assert.match(source, /upsert\("Essentials_Dashboard"/);
  assert.match(source, /"cohort id": `BOT-ESS-GROUP-/);
  assert.match(source, /metricRow\("essentials_headline_cm"/);
});

test("pending payments and missing deliveries are never promoted to completed facts", () => {
  assert.equal(essentialsCollectedAmount("", "Pending", 90), 0);
  assert.equal(essentialsCollectedAmount(34, "Pending", 90), 34);
  assert.equal(essentialsCollectedAmount("", "Paid", 90), 90);
  assert.equal(isFulfilledEssentialsOrder("", "Confirmed"), false);
  assert.equal(isFulfilledEssentialsOrder("Delivered", "Confirmed"), true);
  assert.equal(isFulfilledEssentialsOrder("", "Completed"), true);
});

test("Essentials Studio projection keeps the freshest source timestamp", () => {
  assert.equal(latestEssentialsTimestamp("2026-08-03T12:00:00Z", "2026-08-10T05:29:48Z"), "2026-08-10T05:29:48Z");
  assert.equal(latestEssentialsTimestamp("2026-08-10T05:29:48Z", "2026-08-03T12:00:00Z"), "2026-08-10T05:29:48Z");
});
