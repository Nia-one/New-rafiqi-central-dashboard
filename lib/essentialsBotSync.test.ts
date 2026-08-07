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
