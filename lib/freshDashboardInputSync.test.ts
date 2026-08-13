import assert from "node:assert/strict";
import test from "node:test";
import { prepareFreshInputRow, sourceDateIso } from "./freshDashboardInputSync";

test("sourceDateIso converts Google Sheets serial dates", () => {
  assert.equal(sourceDateIso(46244), "2026-08-10T00:00:00.000Z");
});

const headers = ["Record_ID", "Sample_Live", "Reporting_Date", "Reporting_Time", "Person_Name", "Last_Updated"];
const now = new Date("2026-08-07T06:30:45.000Z");

test("live rows receive stable system identifiers and India reporting defaults", () => {
  const first = prepareFreshInputRow("UI_People", headers, ["", "Live", "", "", "Ajay Kumar", ""], 8, now);
  const second = prepareFreshInputRow("UI_People", headers, ["", "Live", "", "", "Ajay Kumar", ""], 8, now);
  assert.equal(first.isLive, true);
  assert.match(String(first.row[0]), /^UI-PEOPLE-[A-F0-9]{12}$/);
  assert.equal(first.row[0], second.row[0]);
  assert.equal(first.row[2], "2026-08-07");
  assert.equal(first.row[3], "12:00:45");
  assert.equal(first.row[5], "2026-08-07T06:30:45.000Z");
  assert.equal(first.updates.length, 4);
});

test("existing identifiers and historical reporting values are preserved", () => {
  const row = ["ACT-001", "Live", "2025-01-02", "09:15:00", "Ajay Kumar", "2025-01-02T03:45:00.000Z"];
  const prepared = prepareFreshInputRow("UI_People", headers, row, 8, now);
  assert.deepEqual(prepared.row, row);
  assert.deepEqual(prepared.updates, []);
});

test("sample rows are excluded and never receive system values", () => {
  const row = ["SAMPLE-DO-NOT-SYNC", "Sample", "", "", "Example Person", ""];
  const prepared = prepareFreshInputRow("UI_People", headers, row, 7, now);
  assert.equal(prepared.isLive, false);
  assert.deepEqual(prepared.row, row);
  assert.deepEqual(prepared.updates, []);
});

test("populated rows with blank Sample_Live are promoted and fully automated", () => {
  const prepared = prepareFreshInputRow("UI_People", headers, ["", "", "", "", "Ajay Kumar", ""], 8, now);
  assert.equal(prepared.isLive, true);
  assert.equal(prepared.row[1], "Live");
  assert.equal(prepared.row[2], "2026-08-07");
  assert.equal(prepared.row[3], "12:00:45");
  assert.equal(prepared.updates.length, 5);
});

test("blank template rows and explicitly held rows are not synchronized", () => {
  assert.equal(prepareFreshInputRow("UI_People", headers, [], 9, now).isLive, false);
  assert.equal(prepareFreshInputRow("UI_People", headers, ["", "Draft", "", "", "Ajay Kumar", ""], 10, now).isLive, false);
});
