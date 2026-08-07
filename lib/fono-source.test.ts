import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const fonoSync = readFileSync(new URL("./fonoTrackerSync.ts", import.meta.url), "utf8");
const freshSync = readFileSync(new URL("./freshDashboardInputSync.ts", import.meta.url), "utf8");

test("FONO is sourced only from the imported Business Report Fono Funnel tab", () => {
  assert.match(fonoSync, /process\.env\.GOOGLE_TEAM_INPUT_SHEET_ID/);
  assert.match(fonoSync, /const SOURCE_TAB = "Fono Funnel"/);
  assert.doesNotMatch(fonoSync, /process\.env\.FONO_TRACKER_SHEET_ID/);
  assert.doesNotMatch(fonoSync, /const SOURCE_TAB = process\.env\.FONO_TRACKER_TAB/);
  assert.match(fonoSync, /cells\.includes\("date"\).*cells\.includes\("stage after"\).*cells\.includes\("nests potential"\)/s);
});

test("the fresh UI connector cannot reintroduce stale UI_FONO_Supply rows", () => {
  const configuredTabs = freshSync.match(/const tabs = \[([^\]]+)\]/)?.[1] || "";
  const supplyTabs = freshSync.match(/const supplyTabs = \[([^\]]+)\]/)?.[1] || "";
  assert.doesNotMatch(configuredTabs, /UI_FONO_Supply/);
  assert.doesNotMatch(supplyTabs, /UI_FONO_Supply/);
});

test("FONO Member Adds is projected explicitly from Fono Funnel without changing the FONO demand totals", () => {
  assert.match(fonoSync, /const memberAdds = number\(cell\(row, headers, "Member_Adds", "Member Adds"\)\)/);
  assert.match(fonoSync, /"role required": "Member Adds"/);
  assert.match(fonoSync, /"headcount matched": memberAdds/);
  assert.match(fonoSync, /\[\.\.\.records, \.\.\.memberAddsRecords\]/);
  assert.match(fonoSync, /demandNests: records\.reduce/);
});

test("FONO owner names generate stable actor IDs and People_Roster rows automatically", () => {
  assert.match(fonoSync, /return slug \? `ACT-FONO-\$\{slug\}` : "ACT-UNASSIGNED"/);
  assert.match(fonoSync, /"display name": acquirer, role: "FONO Acquirer"/);
  assert.match(fonoSync, /replaceOwned\(sheets, backendId, "People_Roster", "actor id", "ACT-FONO-"/);
  assert.doesNotMatch(fonoSync, /"owner actor id": acquirer \|\| "ACT-UNASSIGNED"/);
});
