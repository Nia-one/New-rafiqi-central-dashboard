import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./sourceSync.ts", import.meta.url), "utf8");

test("source synchronization is single-flight and rate limited", () => {
  assert.match(source, /if \(activeSync\) return activeSync/);
  assert.match(source, /SOURCE_SYNC_COOLDOWN_MS = 300_000/);
  assert.match(source, /lastSuccessfulSync/);
  assert.match(source, /Promise\.resolve\(lastSuccessfulSync\)/);
  assert.match(source, /lastFailureAt/);
});

test("failed synchronization is not cached as successful", () => {
  assert.match(source, /\.then\(\(report\) => \{ lastSuccessfulSync = report/);
  assert.match(source, /\.catch\(\(error\) => \{ lastFailureAt = Date\.now\(\)/);
});
