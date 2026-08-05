import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("dashboard supports fast live-feed sync and explicit full reconciliation", () => {
  assert.match(source, /syncLiveSources\(\)/);
  assert.match(source, /syncAllSources\(\{ force: true \}\)/);
});
