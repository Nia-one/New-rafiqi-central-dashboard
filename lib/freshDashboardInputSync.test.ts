import assert from "node:assert/strict";
import test from "node:test";
import { prepareFreshInputRow, sourceDateIso, writeFreshInputSourceUpdates } from "./freshDashboardInputSync";

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

const demandHeaders = [
  "Record_ID", "Sample_Live", "Reporting_Date", "Reporting_Time",
  "Enterprise_Name", "Studio_Name", "Headcount_Required", "Last_Updated",
];

test("enterprise demand derives a blank Enterprise_Name from Studio_Name", () => {
  const prepared = prepareFreshInputRow(
    "UI_Enterprise_Demand",
    demandHeaders,
    ["", "Live", "", "", "", "Studio North", 12, ""],
    8,
    now,
  );

  assert.equal(prepared.isLive, true);
  assert.equal(prepared.row[4], "Studio North");
  assert.deepEqual(prepared.updates.find((update) => update.columnIndex === 4), { columnIndex: 4, value: "Studio North", valueInputOption: "RAW" });
});

const exactDemandHeaders = [
  "Record_ID", "Sample_Live", "Reporting_Date", "Reporting_Time", "Theatre_ID", "Studio_ID",
  "Studio_Name", "Location", "Business_Owner", "Enterprise_ID", "Enterprise_Name", "Plant_ID",
  "Plant_Name", "Role_Required", "Skill_Required", "Shift", "Headcount_Required", "Headcount_Matched",
  "Activation_Required_At", "Stage", "Status", "Remarks", "Evidence_Ref", "Last_Updated",
];
const exactDemandRow = [
  "", "Live", "2026-09-15", "11:11:19", "TH-RJT", "", "UAT Build2 Enterprise", "UAT Bengaluru",
  "", "", "", "", "", "", "", "", 37, "", "2026-09-22T11:11:00.000", "Lead", "Open",
  "UAT-B2-ENT-01", "", "",
];
const exactNow = new Date("2026-09-30T12:00:00.000Z");

test("enterprise demand row 8 deterministically generates the reviewed ID and only blank system-owned fields", () => {
  const original = structuredClone(exactDemandRow);
  const prepared = prepareFreshInputRow("UI_Enterprise_Demand", exactDemandHeaders, exactDemandRow, 8, exactNow);

  assert.deepEqual(exactDemandRow, original, "preparation must not mutate the caller input");
  assert.equal(prepared.row.length, 24);
  assert.equal(prepared.row[0], "UI-ENTERPRISE-DEMAND-B0E24F65D780");
  assert.equal(prepared.row[10], "UAT Build2 Enterprise");
  assert.equal(prepared.row[23], "2026-09-30T12:00:00.000Z");
  assert.deepEqual(prepared.updates, [
    { columnIndex: 10, value: "UAT Build2 Enterprise", valueInputOption: "RAW" },
    { columnIndex: 0, value: "UI-ENTERPRISE-DEMAND-B0E24F65D780", valueInputOption: "USER_ENTERED" },
    { columnIndex: 23, value: "2026-09-30T12:00:00.000Z", valueInputOption: "USER_ENTERED" },
  ]);
  for (let index = 0; index < original.length; index += 1) {
    if (![0, 10, 23].includes(index)) assert.deepEqual(prepared.row[index], original[index]);
  }
  assert.deepEqual(exactDemandRow, original);

  const repeated = prepareFreshInputRow("UI_Enterprise_Demand", exactDemandHeaders, prepared.row, 8, exactNow);
  assert.deepEqual(repeated.row, prepared.row);
  assert.deepEqual(repeated.updates, []);
});

test("existing enterprise demand values and IDs are preserved exactly", () => {
  const row = ["UI-ENTERPRISE-DEMAND-EXISTING", "Live", "2026-08-07", "12:00:45", "Existing Enterprise", "Studio North", 12, "2026-08-07T06:30:45.000Z"];
  const prepared = prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, row, 8, now);

  assert.equal(prepared.row[0], "UI-ENTERPRISE-DEMAND-EXISTING");
  assert.equal(prepared.row[4], "Existing Enterprise");
  assert.deepEqual(prepared.row, row);
  assert.deepEqual(prepared.updates, []);
});

test("enterprise demand does not invent a name without Studio_Name or derive it on other tabs", () => {
  const withoutStudio = prepareFreshInputRow(
    "UI_Enterprise_Demand",
    demandHeaders,
    ["", "Live", "", "", "", "", 12, ""],
    8,
    now,
  );
  const otherTab = prepareFreshInputRow(
    "UI_Enterprise_Supply",
    demandHeaders,
    ["", "Live", "", "", "", "Studio North", 12, ""],
    8,
    now,
  );

  assert.equal(withoutStudio.row[4], "");
  assert.equal(withoutStudio.updates.some((update) => update.columnIndex === 4), false);
  assert.equal(otherTab.row[4], "");
  assert.equal(otherTab.updates.some((update) => update.columnIndex === 4), false);
});

test("enterprise demand derivation tolerates whitespace blanks and missing headers", () => {
  const whitespaceBlank = prepareFreshInputRow(
    "UI_Enterprise_Demand",
    demandHeaders,
    ["", "Live", "", "", " \t ", "  Studio North  ", 12, ""],
    8,
    now,
  );
  const missingNameHeader = prepareFreshInputRow(
    "UI_Enterprise_Demand",
    demandHeaders.filter((header) => header !== "Enterprise_Name"),
    ["", "Live", "", "", "Studio North", 12, ""],
    8,
    now,
  );

  assert.equal(whitespaceBlank.row[4], "  Studio North  ");
  assert.deepEqual(whitespaceBlank.updates.find((update) => update.columnIndex === 4), {
    columnIndex: 4, value: "  Studio North  ", valueInputOption: "RAW",
  });
  assert.equal(missingNameHeader.updates.some((update) => update.value === "Studio North" && update.valueInputOption === "RAW"), false);
});

test("enterprise demand Sample, Draft, and blank rows remain excluded", () => {
  assert.equal(prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, ["", "Sample", "", "", "", "Studio North", 12, ""], 7, now).isLive, false);
  assert.equal(prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, ["", "Draft", "", "", "", "Studio North", 12, ""], 8, now).isLive, false);
  assert.equal(prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, [], 9, now).isLive, false);
  assert.equal(prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, ["", "Live", "", "", "System Name Only", "", "", ""], 10, now).isLive, false);
});

test("enterprise demand IDs ignore Enterprise_Name but include business fields", () => {
  const blankName = prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, ["", "Live", "", "", "", "Studio North", 12, ""], 8, now);
  const named = prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, ["", "Live", "", "", "Different Enterprise", "Studio North", 12, ""], 8, now);
  const changedHeadcount = prepareFreshInputRow("UI_Enterprise_Demand", demandHeaders, ["", "Live", "", "", "", "Studio North", 13, ""], 8, now);

  assert.equal(blankName.row[0], named.row[0]);
  assert.notEqual(blankName.row[0], changedHeadcount.row[0]);
});

test("derived enterprise names cross the Sheets API boundary as exact RAW strings", async () => {
  const calls: unknown[] = [];
  const sheets = {
    spreadsheets: { values: { batchUpdate: async (request: unknown) => { calls.push(structuredClone(request)); return {}; } } },
  };
  const names = ["=1+1", "00123", "09/30/2026", "'quoted", "  spaced name  "];
  const updates = names.map((name, index) => {
    const prepared = prepareFreshInputRow(
      "UI_Enterprise_Demand",
      demandHeaders,
      ["EXISTING", "Live", "2026-09-30", "17:30:00", "", name, 12, "2026-09-30T12:00:00.000Z"],
      index + 2,
      exactNow,
    );
    const derived = prepared.updates.find((update) => update.columnIndex === 4);
    assert.ok(derived);
    assert.deepEqual(derived, { columnIndex: 4, value: name, valueInputOption: "RAW" });
    return { range: `'UI_Enterprise_Demand'!E${index + 2}`, values: [[derived.value]], valueInputOption: derived.valueInputOption };
  });

  assert.deepEqual(await writeFreshInputSourceUpdates(sheets, "source-sheet", updates), { unpersisted: 0 });
  assert.deepEqual(calls, [{
    spreadsheetId: "source-sheet",
    requestBody: {
      valueInputOption: "RAW",
      data: names.map((name, index) => ({ range: `'UI_Enterprise_Demand'!E${index + 2}`, values: [[name]] })),
    },
  }]);
});

test("source update writer keeps historical system updates USER_ENTERED and reports read-only groups", async () => {
  const calls: string[] = [];
  const sheets = {
    spreadsheets: { values: { batchUpdate: async (request: { requestBody: { valueInputOption: string } }) => {
      calls.push(request.requestBody.valueInputOption);
      if (request.requestBody.valueInputOption === "RAW") throw Object.assign(new Error("forbidden"), { code: 403 });
      return {};
    } } },
  };
  const result = await writeFreshInputSourceUpdates(sheets, "source-sheet", [
    { range: "'UI_Enterprise_Demand'!A8", values: [["UI-ID"]], valueInputOption: "USER_ENTERED" },
    { range: "'UI_Enterprise_Demand'!K8", values: [["=1+1"]], valueInputOption: "RAW" },
  ]);

  assert.deepEqual(calls, ["USER_ENTERED", "RAW"]);
  assert.deepEqual(result, { unpersisted: 1 });
});


test("source update writer propagates transport errors without retries and skips empty batches", async () => {
  for (const code of [401, 429, 500]) {
    const expected = Object.assign(new Error("simulated API failure"), { code });
    let calls = 0;
    const sheets = { spreadsheets: { values: { batchUpdate: async () => { calls += 1; throw expected; } } } };
    await assert.rejects(writeFreshInputSourceUpdates(sheets, "source-sheet", [
      { range: "'UI_Enterprise_Demand'!K8", values: [["literal name"]], valueInputOption: "RAW" },
    ]), (error: unknown) => error === expected);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const sheets = { spreadsheets: { values: { batchUpdate: async () => { calls += 1; return {}; } } } };
  assert.deepEqual(await writeFreshInputSourceUpdates(sheets, "source-sheet", []), { unpersisted: 0 });
  assert.equal(calls, 0);
});
