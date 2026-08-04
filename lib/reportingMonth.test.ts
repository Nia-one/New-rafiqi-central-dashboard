import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReportingMonth, reportingMonthFromDate, reportingMonthTimestamp } from "./reportingMonth";

test("reporting month accepts only the governed YYYY-MM format", () => {
  assert.equal(normalizeReportingMonth("2026-08"), "2026-08");
  assert.equal(normalizeReportingMonth("2026-8"), null);
  assert.equal(normalizeReportingMonth("Aug 2026"), null);
  assert.equal(normalizeReportingMonth("2026-13"), null);
});

test("reporting month creates a stable period timestamp", () => {
  assert.equal(reportingMonthTimestamp("2026-08"), "2026-08-01T00:00:00+05:30");
  assert.equal(reportingMonthTimestamp("08-2026"), null);
});

test("existing ISO and Indian dates can be safely backfilled", () => {
  assert.equal(reportingMonthFromDate("2026-07-30T18:30:00.000Z"), "2026-07");
  assert.equal(reportingMonthFromDate("30-07-2026"), "2026-07");
});
