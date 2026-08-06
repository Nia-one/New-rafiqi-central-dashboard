import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { reportingMonthFromDate, REPORTING_MONTH_HEADER } from "./reportingMonth";

// The imported Business Report tab in the Fresh User Input workbook is the
// single FONO authority. A:I are imported; the Black columns enrich its rows.
const SOURCE_ID = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "1e54fm3oUeseNzsTFG8O4XweRnWVU2n8OvBc7MLOu6nE";
const SOURCE_TAB = "Fono Funnel";
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const number = (value: unknown) => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
const cell = (row: unknown[], headers: string[], ...names: string[]) => { const wanted = new Set(names.map(norm)); const index = headers.findIndex((header) => wanted.has(norm(header))); return index < 0 ? "" : row[index] ?? ""; };
const stable = (prefix: string, values: unknown[]) => `${prefix}-${crypto.createHash("sha1").update(values.map(String).join("|")).digest("hex").slice(0, 16)}`;
const normalizeStage = (value: unknown) => norm(value).replaceAll(" ", "-");
const DEMAND_STAGES = new Set(["lead", "contracting", "onboarded-(takeover-pending)", "contracted"]);
const SUPPLY_STAGES = new Set(["contracted", "onboarded-(takeover-pending)"]);

const sourceDate = (value: unknown) => { const raw = String(value ?? "").trim(); if (!raw) return ""; const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString(); };

async function replaceOwned(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, tab: string, keyHeader: string, prefix: string, records: Record<string, unknown>[]) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` });
  const rows = (response.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === norm(keyHeader));
  if (keyIndex < 0) throw new Error(`${tab} is missing ${keyHeader}`);
  const keep = rows.slice(1).filter((row) => !String(row[keyIndex] ?? "").startsWith(prefix));
  const output = records.map((record) => headers.map((header) => record[header] ?? ""));
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tab}!A2:AZ` });
  if (keep.length || output.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: [...keep, ...output] } });
  return output.length;
}

export async function syncFonoTrackerData() {
  const backendId = process.env.GOOGLE_SHEET_ID;
  if (!backendId) throw new Error("GOOGLE_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_ID, range: `'${SOURCE_TAB}'!A:AM` });
  const values = (response.data.values || []) as unknown[][];
  const headerIndex = values.findIndex((row) => {
    const cells = row.map(norm);
    return cells.includes("date") && cells.includes("stage after") && cells.includes("nests potential");
  });
  if (headerIndex < 0) throw new Error(`${SOURCE_TAB} is missing Date, Stage After or Nests Potential headers`);
  const headers = (values[headerIndex] || []).map(String);
  const sourceRows = values.slice(headerIndex + 1).filter((row) => row.some((value) => String(value ?? "").trim()));
  const livingRecords: Record<string, unknown>[] = [];
  const records = sourceRows.flatMap((row) => {
    const after = String(cell(row, headers, "Stage After")).trim();
    const normalizedStage = normalizeStage(after);
    if (!DEMAND_STAGES.has(normalizedStage)) return [];
    const nests = number(cell(row, headers, "Nests Potential"));
    if (nests <= 0) return [];
    const date = sourceDate(cell(row, headers, "Date"));
    const acquirer = String(cell(row, headers, "Acquirer")).trim();
    const theatre = String(cell(row, headers, "Theatre")).trim();
    const corridor = String(cell(row, headers, "Corridor")).trim();
    const prospect = String(cell(row, headers, "Prospect (PG / owner)")).trim();
    const locationId = String(cell(row, headers, "Location_ID", "Location ID")).trim();
    const studioId = String(cell(row, headers, "Studio_ID", "Studio ID")).trim() || locationId || stable("FONO-LOCATION", [theatre, corridor, prospect]);
    const studioName = String(cell(row, headers, "Studio_Name", "Studio Name")).trim() || prospect || corridor || theatre;
    const studiosCount = number(cell(row, headers, "Studios_Count", "Studios Count"));
    const activationReady = number(cell(row, headers, "Activation_Ready_Nests", "Activation Ready Nests"));
    const memberAdds = number(cell(row, headers, "Member_Adds", "Member Adds"));
    const lastUpdated = sourceDate(cell(row, headers, "Last_Updated", "Last Updated")) || date;
    const evidence = String(cell(row, headers, "Evidence_Ref", "Evidence Ref")).trim();
    const remarks = String(cell(row, headers, "Remarks")).trim();
    const verifier = String(cell(row, headers, "Verifier")).trim();
    if (norm(studioId).startsWith("sample") || norm(remarks).includes("do not count")) return [];
    const key = stable("FONO-TRACKER", [date, acquirer, theatre, corridor, prospect, after, nests]);
    const isSupply = SUPPLY_STAGES.has(normalizedStage);
    if (isSupply) livingRecords.push({
      "living hourly id": key.replace("FONO-TRACKER-", "FONO-TRACKER-LIVING-"), "studio id": studioId, "studio name": studioName,
      "theatre id": theatre, "supply model": "FONO", "contracted nests": nests,
      "activation ready nests": activationReady || nests, "occupied nests": memberAdds,
      "occupancy ratio": nests ? memberAdds / nests : 0, "updated at": lastUpdated,
      "source submission id": key, "source note": [locationId && `Location=${locationId}`, studiosCount && `Studios=${studiosCount}`, verifier && `Verifier=${verifier}`, remarks, evidence && `Evidence=${evidence}`].filter(Boolean).join(" | "),
      [REPORTING_MONTH_HEADER]: reportingMonthFromDate(lastUpdated) || reportingMonthFromDate(date) || "",
    });
    return [{
      "demand id": key, "enterprise id": stable("FONO-PROSPECT", [prospect]), "enterprise name": prospect || "FONO prospect",
      "plant id": studioId, "plant name": studioName,
      "role required": "Living supply", "headcount required": nests, "headcount matched": isSupply ? nests : 0,
      "headcount remaining": isSupply ? 0 : nests, certainty: after, status: after, "owner actor id": acquirer || "ACT-UNASSIGNED",
      "opened at": date, "source submission id": key, "updated at": lastUpdated, "theatre id": theatre,
      "source note": `Business Report Fono Funnel | Demand=${nests} | Supply=${isSupply ? nests : 0}${evidence ? ` | Evidence=${evidence}` : ""}`,
      [REPORTING_MONTH_HEADER]: reportingMonthFromDate(date) || "",
    }];
  });
  const written = await replaceOwned(sheets, backendId, "Enterprise_Demand", "demand id", "FONO-TRACKER-", records);
  const livingWritten = await replaceOwned(sheets, backendId, "Living_Hourly", "living hourly id", "FONO-TRACKER-LIVING-", livingRecords);
  return { sourceSpreadsheetId: SOURCE_ID, sourceTab: SOURCE_TAB, sourceRows: sourceRows.length, demandRows: records.length,
    demandNests: records.reduce((sum, row) => sum + number(row["headcount required"]), 0), supplyNests: records.reduce((sum, row) => sum + number(row["headcount matched"]), 0),
    gapNests: records.reduce((sum, row) => sum + number(row["headcount remaining"]), 0), written, livingWritten };
}
