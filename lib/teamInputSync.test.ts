import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizeTeamInputDate } from "./teamInputSync";

const source = readFileSync(new URL("./teamInputSync.ts", import.meta.url), "utf8");

test("normalizes Indian user dates for canonical datetime fields", () => {
  assert.equal(normalizeTeamInputDate("verified_at", "01-08-2026"), "2026-08-01T00:00:00+05:30");
  assert.equal(normalizeTeamInputDate("due at", "3/8/2026"), "2026-08-03T00:00:00+05:30");
});

test("Nia Growth user input synchronizes governed records without manual backend entry", () => {
  assert.match(source, /TEAM_NIA_GROWTH/);
  for (const target of ["Action_Log", "Evidence_Log", "Approval_Log", "Policy_Registry", "Learning_History"]) {
    assert.match(source, new RegExp(`upsertObjects\\(sheets, spreadsheetId, "${target}"`));
  }
  assert.match(source, /Closure requires independently verified readiness evidence and human approval/);
  assert.match(source, /readinessComplete = required > 0 && ready >= required/);
  assert.match(source, /financeApproved = \/\^approved\$\/i\.test/);
  assert.match(source, /protected:\/\/governed\/nia-growth/);
});

test("keeps date-only fields date-only and preserves generated timestamps", () => {
  assert.equal(normalizeTeamInputDate("effective_from", "31-07-2026"), "2026-07-31");
  assert.equal(normalizeTeamInputDate("verified_at", "2026-07-31T09:30:00+05:30"), "2026-07-31T09:30:00+05:30");
  assert.equal(normalizeTeamInputDate("updated_at", "31-07-2026"), "31-07-2026");
});
