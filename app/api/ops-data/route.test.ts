import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("manual dashboard refresh forces a fresh source synchronization", () => {
  assert.match(source, /syncAllSources\(\{ force: true \}\)/);
});
