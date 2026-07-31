import { createHash } from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";

const SOURCE_SHEET_ID = process.env.SHRAM_PARK_DEMAND_BOT_SHEET_ID || "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y";
const SOURCE_TAB = process.env.SHRAM_PARK_DEMAND_BOT_TAB || "Demand Visit Data";
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const slug = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);
const number = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const value = (row: unknown[], headers: string[], ...names: string[]) => {
  const wanted = new Set(names.map(norm));
  const index = headers.findIndex((header) => wanted.has(norm(header)));
  return index < 0 ? "" : row[index];
};
const stable = (prefix: string, raw: unknown) => `${prefix}-${slug(raw) || createHash("sha1").update(String(raw ?? "")).digest("hex").slice(0, 12).toUpperCase()}`;
const stableRow = (prefix: string, raw: unknown) => `${prefix}-${createHash("sha1").update(String(raw ?? "")).digest("hex").slice(0, 16).toUpperCase()}`;

export function shramParkOwnerForTheatre(theatre: unknown) {
  const name = norm(theatre);
  if (/rajputana|deccan|decaan/.test(name)) return "Prashant Wahire";
  if (/coromandal|coromandel|wellington|welington/.test(name)) return "Satish Sanghy";
  return "";
}

function credentials() {
  return googleServiceAccountCredentials();
}

async function sheetsClient(write = false) {
  const auth = new google.auth.GoogleAuth({
    credentials: credentials(),
    scopes: [write ? "https://www.googleapis.com/auth/spreadsheets" : "https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

const requiredSourceColumns = [
  "Activation Required At",
  "Headcount Matched",
  "Monthly Wage INR",
  "Latitude",
  "Longitude",
  "Owner Name",
];

async function mirrorShramParkSource(values: unknown[][]) {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing");
  const target = "TEAM_SHRAMPARK_DEMAND";
  const sheets = await sheetsClient(true);
  let metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  let sheet = metadata.data.sheets?.find((item) => item.properties?.title === target);
  if (!sheet) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: target } } }] } });
    sheet = added.data.replies?.[0]?.addSheet;
  }
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) throw new Error(`${target} mirror tab could not be resolved`);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${target}'!A:AZ` });
  if (values.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${target}'!A1`, valueInputOption: "RAW", requestBody: { values } });
  const width = Math.max(1, values[0]?.length || 1);
  const red = { red: 0.8, green: 0.05, blue: 0.05 };
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { updateSheetProperties: { properties: { sheetId, tabColorStyle: { rgbColor: red }, gridProperties: { frozenRowCount: 1 } }, fields: "tabColorStyle,gridProperties.frozenRowCount" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: width }, cell: { userEnteredFormat: { backgroundColor: red, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" }, note: "RED = BOT MIRROR. Do not edit; refreshed automatically from the Shram Park Demand Bot source." }, fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy),note" } },
  ] } });
  return { targetTab: target, rows: Math.max(0, values.length - 1) };
}

export async function ensureShramParkDemandBotSchema() {
  const sheets = await sheetsClient(true);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: `'${SOURCE_TAB}'!1:1` });
  const headers = (response.data.values?.[0] || []).map(String);
  const missing = requiredSourceColumns.filter((column) => !headers.some((header) => norm(header) === norm(column)));
  if (missing.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `'${SOURCE_TAB}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers, ...missing]] },
    });
  }
  return { sourceTab: SOURCE_TAB, preservedColumns: headers.length, addedColumns: missing };
}

export type ShramParkDemandRecord = Record<string, string | number>;

export function mapShramParkDemandRow(row: unknown[], headers: string[]) {
  const submissionId = String(value(row, headers, "Submission ID")).trim();
  const company = String(value(row, headers, "Company Name")).trim().replace(/^=/, "");
  const location = String(value(row, headers, "Location")).trim();
  const theatre = String(value(row, headers, "Theatre")).trim();
  const notes = String(value(row, headers, "Additional Notes"));
  const source = String(value(row, headers, "Source"));
  const joined = `${company} ${location} ${notes} ${source}`.toLowerCase();
  const obviousTest = /\b(test|fictional|simulator)\b/.test(joined);
  const requirement = norm(value(row, headers, "Requirement"));
  const currentManpower = number(value(row, headers, "Current Manpower Count"));
  const statedRequirement = number(value(row, headers, "Total Requirement")) || number(value(row, headers, "Male Requirement")) + number(value(row, headers, "Female Requirement"));
  // Requirement=N is still a valid Shram Park lead/visit, but current manpower
  // is client context and must never be presented as Rafiqi demand or matched
  // capacity. Only an explicit requirement contributes demand Nests.
  const hasActiveRequirement = requirement === "y" || requirement === "yes";
  const headcountRequired = hasActiveRequirement ? statedRequirement : 0;
  const recordedMatched = number(value(row, headers, "Headcount Matched"));
  const headcountMatched = hasActiveRequirement ? recordedMatched : 0;
  const latitude = number(value(row, headers, "Latitude"));
  const longitude = number(value(row, headers, "Longitude"));
  const activationRequiredAt = String(value(row, headers, "Activation Required At")).trim();
  const openedAt = String(value(row, headers, "Submission Timestamp")).trim();
  const effectiveActivationAt = activationRequiredAt || String(value(row, headers, "Date Visited")).trim() || openedAt;
  const followUp = String(value(row, headers, "Follow Up Action")).trim();
  const errors: string[] = [];
  if (!submissionId) errors.push("submission_id_missing");
  if (!company) errors.push("company_missing");
  if (!location) errors.push("location_missing");
  if (!theatre) errors.push("theatre_missing");
  if (obviousTest) errors.push("test_or_fictional_row");
  if (hasActiveRequirement && headcountRequired <= 0) errors.push("required_headcount_missing");
  if (!effectiveActivationAt || Number.isNaN(new Date(effectiveActivationAt).getTime())) errors.push("activation_required_at_missing");
  if (!latitude || latitude < -90 || latitude > 90) errors.push("latitude_missing_or_invalid");
  if (!longitude || longitude < -180 || longitude > 180) errors.push("longitude_missing_or_invalid");
  if (!openedAt || Number.isNaN(new Date(openedAt).getTime())) errors.push("submission_timestamp_invalid");

  const status = /lost|no action/i.test(followUp) ? "Closed"
    : /won|contracted|agreement signed/i.test(followUp) ? "Contracted"
      : /proposal|quote|commercial|contracting|escalate/i.test(followUp) ? "Contracting"
        : "Lead";
  const owner = shramParkOwnerForTheatre(theatre) || String(value(row, headers, "Owner Name")).trim() || String(value(row, headers, "Assigned To")).trim();
  const record: ShramParkDemandRecord = {
    // Some bot exports repeat Submission ID across multiple visits. Include
    // stable business identity so every source row remains independently owned.
    "demand id": stableRow("SP-BOT", `${submissionId}|${company}|${location}|${openedAt}`),
    "enterprise id": stable("ENT", company),
    "enterprise name": company,
    "plant id": stable("PLANT", `${company}-${location}`),
    "plant name": location,
    latitude,
    longitude,
    "role required": "Enterprise manpower",
    "skill required": String(value(row, headers, "Designation of POC")).trim(),
    shift: String(value(row, headers, "Time")).trim(),
    "headcount required": headcountRequired,
    "headcount matched": Math.min(headcountMatched, headcountRequired),
    "current manpower count": currentManpower,
    "wage inr": number(value(row, headers, "Monthly Wage INR")),
    "activation required at": effectiveActivationAt,
    // Preserve the bot's actual Column S funnel stage for dashboard grouping.
    certainty: followUp || "Follow Up Action not recorded",
    status,
    "owner actor id": owner ? stable("ACT", owner) : "ACT-UNASSIGNED",
    "opened at": openedAt,
    "source submission id": submissionId,
    "updated at": openedAt,
  };
  return { record, errors };
}

async function upsertShramParkOwners() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const sheets = await sheetsClient(true);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "People_Roster!A:Z" });
  const rows = (response.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === "actor id");
  if (keyIndex < 0) throw new Error("People_Roster is missing actor id");
  const now = new Date().toISOString();
  const owners = ["Prashant Wahire", "Satish Sanghy"].map((name) => ({
    "actor id": stable("ACT", name), "display name": name, role: "Shram Park Theatre Owner",
    "active shift": "Active", language: "English / Hindi", "updated at": now,
  }));
  const output = rows.map((row) => [...row]);
  const existing = new Map(output.slice(1).map((row, index) => [norm(row[keyIndex]), index + 1]));
  let inserted = 0, updated = 0;
  for (const owner of owners) {
    const key = norm(owner["actor id"]);
    const found = existing.get(key);
    const destination = found == null ? Array(headers.length).fill("") : [...output[found]];
    headers.forEach((header, index) => {
      const ownerValue = owner[norm(header) as keyof typeof owner];
      if (ownerValue !== undefined) destination[index] = ownerValue;
    });
    if (found == null) { output.push(destination); existing.set(key, output.length - 1); inserted++; }
    else { output[found] = destination; updated++; }
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "People_Roster!A1", valueInputOption: "USER_ENTERED", requestBody: { values: output } });
  return { inserted, updated };
}

async function upsertEnterpriseDemand(records: ShramParkDemandRecord[]) {
  if (!records.length) return { inserted: 0, updated: 0 };
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const sheets = await sheetsClient(true);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Enterprise_Demand!A:AZ" });
  const rows = (response.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === "demand id");
  if (keyIndex < 0) throw new Error("Enterprise_Demand is missing demand id");
  const existing = new Map<string, number>();
  rows.slice(1).forEach((row, index) => { const key = norm(row[keyIndex]); if (key) existing.set(key, index + 2); });
  const updates: { range: string; values: unknown[][] }[] = [];
  const append: unknown[][] = [];
  for (const record of records) {
    const key = norm(record["demand id"]);
    const rowNumber = existing.get(key);
    const prior = rowNumber ? rows[rowNumber - 1] || [] : [];
    const output = headers.map((header, index) => record[header] === undefined || record[header] === "" ? prior[index] ?? "" : record[header]);
    if (rowNumber) updates.push({ range: `Enterprise_Demand!A${rowNumber}`, values: [output] });
    else append.push(output);
  }
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } });
  if (append.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "Enterprise_Demand!A:AZ", valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: append } });
  return { inserted: append.length, updated: updates.length };
}

async function reconcileShramParkDemand(records: ShramParkDemandRecord[]) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const sheets = await sheetsClient(true);
  const [values, metadata] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Enterprise_Demand!A:AZ" }),
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" }),
  ]);
  const rows = (values.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === "demand id");
  const sheetId = metadata.data.sheets?.find((sheet) => sheet.properties?.title === "Enterprise_Demand")?.properties?.sheetId;
  if (keyIndex < 0 || sheetId == null) return 0;
  const desired = new Set(records.map((record) => norm(record["demand id"])));
  const stale = rows.slice(1).map((row, index) => ({ key: norm(row[keyIndex]), rowIndex: index + 1 })).filter(({ key }) => key.startsWith("sp-bot-") && !desired.has(key));
  if (stale.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: stale.sort((a, b) => b.rowIndex - a.rowIndex).map(({ rowIndex }) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } })) } });
  return stale.length;
}

export async function syncShramParkDemandBotData() {
  const source = await sheetsClient();
  const response = await source.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: `'${SOURCE_TAB}'!A:AZ` });
  const values = (response.data.values || []) as unknown[][];
  const headers = (values[0] || []).map(String);
  const sourceRows = values.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim()));
  const mapped = sourceRows.map((row) => mapShramParkDemandRow(row, headers));
  const mirrorValues = [
    [...headers, "BOT SYNC STATUS", "QUARANTINE REASON"],
    ...mapped.map((item, index) => [...sourceRows[index], item.errors.length ? "QUARANTINED" : "VALID — SYNCED", item.errors.join(", ")]),
  ];
  const mirror = await mirrorShramParkSource(mirrorValues);
  const valid = mapped.filter((item) => item.errors.length === 0).map((item) => item.record);
  const ownerDistribution = valid.reduce<Record<string, number>>((counts, record) => {
    const owner = String(record["owner actor id"] || "ACT-UNASSIGNED");
    counts[owner] = (counts[owner] || 0) + 1;
    return counts;
  }, {});
  const quarantineByReason = mapped.flatMap((item) => item.errors).reduce<Record<string, number>>((counts, reason) => ({ ...counts, [reason]: (counts[reason] || 0) + 1 }), {});
  const enterpriseDemand = await upsertEnterpriseDemand(valid);
  const peopleRoster = await upsertShramParkOwners();
  const removedStale = await reconcileShramParkDemand(valid);
  return {
    mirror,
    sourceSheetId: SOURCE_SHEET_ID,
    sourceTab: SOURCE_TAB,
    sourceRows: mapped.length,
    validRows: valid.length,
    uniqueDemandIds: new Set(valid.map((record) => String(record["demand id"]))).size,
    ownerDistribution,
    quarantinedRows: mapped.length - valid.length,
    quarantineByReason,
    enterpriseDemand: { ...enterpriseDemand, removedStale },
    peopleRoster,
  };
}
