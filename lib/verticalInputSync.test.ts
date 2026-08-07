import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("vertical input sync cannot overwrite bot-owned Essentials data", () => {
  const source = fs.readFileSync(new URL("./verticalInputSync.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /baseTabs\s*=\s*\[[^\]]*TEAM_ESSENTIALS_SUMMARY/);
  assert.doesNotMatch(source, /replaceAllRows\("Essentials_Hourly"/);
  assert.doesNotMatch(source, /replaceOwned\("Essentials_Inventory"/);
});

test("SP Supply has one live path into Living and Studio master", () => {
  const source = fs.readFileSync(new URL("./verticalInputSync.ts", import.meta.url), "utf8");
  assert.match(source, /baseTabs\s*=\s*\[[^\]]*TEAM_REQ_SP_SUPPLY/);
  assert.match(source, /const allLiving = \[\.\.\.living, \.\.\.spSupply/);
  assert.match(source, /living:\s*await replaceOwned\("Living_Hourly"/);
  assert.match(source, /spSupplyStudios:\s*await replaceOwned\("Studio_Master"/);
  assert.match(source, /"supply model": "SP"/);
});

test("vertical input sync removes legacy FONO demand without re-projecting it", () => {
  const source = fs.readFileSync(new URL("./verticalInputSync.ts", import.meta.url), "utf8");
  assert.match(source, /replaceOwned\("Enterprise_Demand", "demand id", "OPS-RPT-FONO", \[\]/);
  assert.doesNotMatch(source, /demandRecords\.push/);
  assert.doesNotMatch(source, /const fonoSources/);
});
