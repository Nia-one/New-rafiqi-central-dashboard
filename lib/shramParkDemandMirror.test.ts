import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./shramParkDemandBotSync.ts", import.meta.url), "utf8");

test("Shram Park bot mirror exposes validation status and quarantine reasons", () => {
  assert.match(source, /const target = "TEAM_SHRAMPARK_DEMAND"/);
  assert.match(source, /BOT SYNC STATUS/);
  assert.match(source, /QUARANTINE REASON/);
  assert.match(source, /QUARANTINED/);
  assert.match(source, /VALID — SYNCED/);
});
