import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./living-screen.tsx", import.meta.url), "utf8");

test("FONO stage rows retain unique React keys when labels are unavailable", () => {
  assert.match(source, /key=\{`\$\{item\.stage\}-\$\{index\}`\}/);
  assert.doesNotMatch(source, /<li key=\{item\.stage\}>/);
});
