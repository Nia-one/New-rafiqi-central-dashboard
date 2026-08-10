import assert from "node:assert/strict";
import test from "node:test";
import { mapShramParkDemandRow, shramParkOwnerForTheatre, shramParkRowsToDelete } from "./shramParkDemandBotSync";

const headers = ["Submission Timestamp", "Submission ID", "Company Name", "Location", "Theatre", "Requirement", "Male Requirement", "Female Requirement", "Total Requirement", "Follow Up Action", "Assigned To", "Source", "Activation Required At", "Headcount Matched", "Monthly Wage INR", "Latitude", "Longitude"];

test("maps each qualified Shram Park bot submission as one lead", () => {
  const row = ["2026-07-29T09:00:00+05:30", "SUB-1", "Acme Manufacturing", "Farukhnagar", "Rajputana", "Y", 10, 5, 15, "Send Proposal / Quote", "Priya", "WhatsApp", "2026-08-05T09:00:00+05:30", 3, 18000, 28.32, 76.82];
  const result = mapShramParkDemandRow(row, headers);
  assert.deepEqual(result.errors, []);
  assert.equal(result.record["headcount required"], 1);
  assert.equal(result.record["headcount matched"], 0);
  assert.equal(result.record.status, "Interested");
  assert.equal(result.record.certainty, "Send Proposal / Quote");
  assert.equal(result.record["source submission id"], "SUB-1");
  assert.equal(result.record["theatre id"], "Rajputana");
  assert.equal(result.record["owner actor id"], "ACT-PRASHANT-WAGHIRE");
});

test("counts the fixed bot format as one lead without treating current manpower as demand", () => {
  const fixedHeaders = ["Submission Timestamp", "Submission ID", "Company Name", "Location", "Theatre", "Current Manpower Count", "Requirement", "Male Requirement", "Female Requirement", "Total Requirement", "Follow Up Action", "Assigned To", "Source", "Date Visited", "Headcount Matched", "Monthly Wage INR", "Latitude", "Longitude"];
  const row = ["2026-07-11T14:23:00+05:30", "SUB-CAP-1", "Hyundai Motor India Ltd", "Sriperumbudur", "Coromandel", 3000, "N", 0, 0, 0, "Schedule Next Visit", "", "WhatsApp", "2026-07-11", 0, 2000, 12.9716, 77.5946];
  const result = mapShramParkDemandRow(row, fixedHeaders);
  assert.deepEqual(result.errors, []);
  assert.equal(result.record["headcount required"], 1);
  assert.equal(result.record["headcount matched"], 0);
  assert.equal(result.record["current manpower count"], 3000);
  assert.equal(result.record.status, "Lead");
  assert.equal(result.record.certainty, "Schedule Next Visit");
  assert.equal(result.record["activation required at"], "2026-07-11");
  assert.equal(result.record["owner actor id"], "ACT-SATISH-SANGHEY");
});

test("preserves Interested as an actual Bot Sheet funnel stage", () => {
  const row = ["2026-07-11T14:23:00+05:30", "SUB-INTERESTED", "Acme", "Plant", "Deccan", 3000, "Y", 0, 0, 0, "Interested", "", "WhatsApp", "2026-07-11", 0, 2000, 28.32, 76.82];
  const result = mapShramParkDemandRow(row, ["Submission Timestamp", "Submission ID", "Company Name", "Location", "Theatre", "Current Manpower Count", "Requirement", "Male Requirement", "Female Requirement", "Total Requirement", "Follow Up Action", "Assigned To", "Source", "Date Visited", "Headcount Matched", "Monthly Wage INR", "Latitude", "Longitude"]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.record.status, "Interested");
  assert.equal(result.record.certainty, "Interested");
});

test("Interested wins when the Bot status also mentions a proposal", () => {
  const row = ["2026-07-11T14:23:00+05:30", "SUB-INTERESTED-PROPOSAL", "Acme", "Plant", "Deccan", 3000, "Y", 0, 0, 0, "Interested - proposal shared", "", "WhatsApp", "2026-07-11", 0, 2000, 28.32, 76.82];
  const result = mapShramParkDemandRow(row, ["Submission Timestamp", "Submission ID", "Company Name", "Location", "Theatre", "Current Manpower Count", "Requirement", "Male Requirement", "Female Requirement", "Total Requirement", "Follow Up Action", "Assigned To", "Source", "Date Visited", "Headcount Matched", "Monthly Wage INR", "Latitude", "Longitude"]);
  assert.equal(result.record.status, "Interested");
});

test("assigns the accountable owner from all accepted Theatre spellings", () => {
  for (const theatre of ["Rajputana", "Deccan", "Decaan"]) assert.equal(shramParkOwnerForTheatre(theatre), "Prashant Waghire");
  for (const theatre of ["Coromandel", "Coromandal", "Commandal", "Wellington", "Welington"]) assert.equal(shramParkOwnerForTheatre(theatre), "Satish Sanghey");
  assert.equal(shramParkOwnerForTheatre("Unknown"), "");
});

test("repeated bot submission IDs still produce stable row-unique demand IDs", () => {
  const first = mapShramParkDemandRow(["2026-07-29T09:00:00+05:30", "SUB-REPEAT", "Acme", "Plant A", "Rajputana", "Y", 10, 0, 10, "Proposal", "", "WhatsApp", "2026-08-05", 0, 18000, 28.32, 76.82], headers);
  const second = mapShramParkDemandRow(["2026-07-30T09:00:00+05:30", "SUB-REPEAT", "Beta", "Plant B", "Coromandel", "Y", 20, 0, 20, "Proposal", "", "WhatsApp", "2026-08-06", 0, 18000, 12.97, 77.59], headers);
  assert.notEqual(first.record["demand id"], second.record["demand id"]);
});

test("quarantines test data and incomplete governed fields", () => {
  const row = ["2026-07-29T09:00:00+05:30", "SUB-2", "Test Company", "Test Area", "Deccan", "Y", 10, 5, 15, "Send Proposal / Quote", "Priya", "Simulator", "", 0, 0, "", ""];
  const result = mapShramParkDemandRow(row, headers);
  assert.ok(result.errors.includes("test_or_fictional_row"));
  assert.equal(result.record["activation required at"], "2026-07-29T09:00:00+05:30");
  assert.ok(result.errors.includes("latitude_missing_or_invalid"));
  assert.ok(result.errors.includes("longitude_missing_or_invalid"));
});

test("reconciliation keeps only the final governed row for each Shram Park demand ID", () => {
  const rows = [
    ["demand id", "status"],
    ["SP-BOT-A", "Lead"],
    ["SP-BOT-B", "Lead"],
    ["SP-BOT-A", "Contracting"],
    ["SP-BOT-STALE", "Lead"],
  ];
  assert.deepEqual(shramParkRowsToDelete(rows, 0, new Set(["sp-bot-a", "sp-bot-b"])), [
    { key: "sp-bot-a", rowIndex: 1 },
    { key: "sp-bot-stale", rowIndex: 4 },
  ]);
});
