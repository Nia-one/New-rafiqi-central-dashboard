import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTeamInputDate } from "./teamInputSync";

test("normalizes Indian user dates for canonical datetime fields", () => {
  assert.equal(normalizeTeamInputDate("verified_at", "01-08-2026"), "2026-08-01T00:00:00+05:30");
  assert.equal(normalizeTeamInputDate("due at", "3/8/2026"), "2026-08-03T00:00:00+05:30");
});

test("keeps date-only fields date-only and preserves generated timestamps", () => {
  assert.equal(normalizeTeamInputDate("effective_from", "31-07-2026"), "2026-07-31");
  assert.equal(normalizeTeamInputDate("verified_at", "2026-07-31T09:30:00+05:30"), "2026-07-31T09:30:00+05:30");
  assert.equal(normalizeTeamInputDate("updated_at", "31-07-2026"), "31-07-2026");
});
