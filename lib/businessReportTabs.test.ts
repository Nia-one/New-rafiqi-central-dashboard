import assert from "node:assert/strict";
import test from "node:test";
import { latestImportedReport, reportCandidates } from "./businessReportTabs";

const tabs = [
  { sheetId: 1, title: "Fono Funnel", index: 2, rowCount: 10, columnCount: 5 },
  { sheetId: 2, title: "Fono Funnel (1)", index: 8, rowCount: 11, columnCount: 5 },
  { sheetId: 3, title: "Fono Funnel (2)", index: 9, rowCount: 12, columnCount: 6 },
  { sheetId: 4, title: "Fono Funnel backup", index: 10, rowCount: 20, columnCount: 8 },
];

test("business report matching accepts only canonical and Google import suffixes", () => {
  assert.deepEqual(reportCandidates(tabs, "Fono Funnel").map((tab) => tab.sheetId), [1, 2, 3]);
});

test("latest imported report is the newest suffixed sheet", () => {
  assert.equal(latestImportedReport(tabs, "Fono Funnel")?.sheetId, 3);
});
