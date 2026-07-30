import assert from "node:assert/strict";
import test from "node:test";
import { mapShramParkDemandRow } from "./shramParkDemandBotSync";

const headers = ["Submission Timestamp", "Submission ID", "Company Name", "Location", "Theatre", "Requirement", "Male Requirement", "Female Requirement", "Total Requirement", "Follow Up Action", "Assigned To", "Source", "Activation Required At", "Headcount Matched", "Monthly Wage INR", "Latitude", "Longitude"];

test("maps a complete Shram Park demand bot row to Enterprise_Demand", () => {
  const row = ["2026-07-29T09:00:00+05:30", "SUB-1", "Acme Manufacturing", "Farukhnagar", "Rajputana", "Y", 10, 5, 15, "Send Proposal / Quote", "Priya", "WhatsApp", "2026-08-05T09:00:00+05:30", 3, 18000, 28.32, 76.82];
  const result = mapShramParkDemandRow(row, headers);
  assert.deepEqual(result.errors, []);
  assert.equal(result.record["headcount required"], 15);
  assert.equal(result.record["headcount matched"], 3);
  assert.equal(result.record.status, "Contracting");
  assert.equal(result.record.certainty, "Send Proposal / Quote");
  assert.equal(result.record["source submission id"], "SUB-1");
});

test("keeps the fixed bot format when Requirement is N without treating current manpower as demand", () => {
  const fixedHeaders = ["Submission Timestamp", "Submission ID", "Company Name", "Location", "Theatre", "Current Manpower Count", "Requirement", "Male Requirement", "Female Requirement", "Total Requirement", "Follow Up Action", "Assigned To", "Source", "Date Visited", "Headcount Matched", "Monthly Wage INR", "Latitude", "Longitude"];
  const row = ["2026-07-11T14:23:00+05:30", "SUB-CAP-1", "Hyundai Motor India Ltd", "Sriperumbudur", "Coromandel", 3000, "N", 0, 0, 0, "Schedule Next Visit", "", "WhatsApp", "2026-07-11", 0, 2000, 12.9716, 77.5946];
  const result = mapShramParkDemandRow(row, fixedHeaders);
  assert.deepEqual(result.errors, []);
  assert.equal(result.record["headcount required"], 0);
  assert.equal(result.record["headcount matched"], 0);
  assert.equal(result.record["current manpower count"], 3000);
  assert.equal(result.record.status, "Lead");
  assert.equal(result.record.certainty, "Schedule Next Visit");
  assert.equal(result.record["activation required at"], "2026-07-11");
});

test("quarantines test data and incomplete governed fields", () => {
  const row = ["2026-07-29T09:00:00+05:30", "SUB-2", "Test Company", "Test Area", "Deccan", "Y", 10, 5, 15, "Send Proposal / Quote", "Priya", "Simulator", "", 0, 0, "", ""];
  const result = mapShramParkDemandRow(row, headers);
  assert.ok(result.errors.includes("test_or_fictional_row"));
  assert.equal(result.record["activation required at"], "2026-07-29T09:00:00+05:30");
  assert.ok(result.errors.includes("latitude_missing_or_invalid"));
  assert.ok(result.errors.includes("longitude_missing_or_invalid"));
});
