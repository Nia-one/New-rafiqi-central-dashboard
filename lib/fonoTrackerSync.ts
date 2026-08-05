import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { reportingMonthFromDate, REPORTING_MONTH_HEADER } from "./reportingMonth";

const SOURCE_ID = process.env.FONO_TRACKER_SHEET_ID || "1pZNwOip3teKUuV2bKQGuKnLMikKl5DVieNGVPBtEzqE";
const SOURCE_TAB = process.env.FONO_TRACKER_TAB || "Visit Log";
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const number = (value: unknown) => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
const cell = (row: unknown[], headers: string[], ...names: string[]) => { const wanted = new Set(names.map(norm)); const index = headers.findIndex((header) => wanted.has(norm(header))); return index < 0 ? "" : row[index] ?? ""; };
const stable = (prefix: string, values: unknown[]) => `${prefix}-${crypto.createHash("sha1").update(values.map(String).join("|")).digest("hex").slice(0, 16)}`;
const normalizeStage = (value: unknown) => norm(value).replaceAll(" ", "-");
const DEMAND_STAGES = new Set(["lead", "contracting", "onboarded-(takeover-pending)", "contracted"]);
const SUPPLY_STAGES = new Set(["contracted", "onboarded-(takeover-pending)"]);

const sourceDate = (value: unknown) => { const raw = String(value ?? "").trim(); if (!raw) return ""; const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString(); };

async function replaceOwned(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, records: Record<string, unknown>[]) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Enterprise_Demand!A:AZ" });
  const rows = (response.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === "demand id");
  if (keyIndex < 0) throw new Error("Enterprise_Demand is missing demand id");
  const keep = rows.slice(1).filter((row) => !String(row[keyIndex] ?? "").startsWith("FONO-TRACKER-"));
  const output = records.map((record) => headers.map((header) => record[header] ?? ""));
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Enterprise_Demand!A2:AZ" });
  if (keep.length || output.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "Enterprise_Demand!A2", valueInputOption: "USER_ENTERED", requestBody: { values: [...keep, ...output] } });
  return output.length;
}

export async function syncFonoTrackerData() {
  const backendId = process.env.GOOGLE_SHEET_ID;
  if (!backendId) throw new Error("GOOGLE_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_ID, range: `'${SOURCE_TAB}'!A:AM` });
  const values = (response.data.values || []) as unknown[][];
  const headers = (values[0] || []).map(String);
  const records = values.slice(1).flatMap((row) => {
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
    const key = stable("FONO-TRACKER", [date, acquirer, theatre, corridor, prospect, after, nests]);
    const isSupply = SUPPLY_STAGES.has(normalizedStage);
    return [{
      "demand id": key, "enterprise id": stable("FONO-PROSPECT", [prospect]), "enterprise name": prospect || "FONO prospect",
      "plant id": stable("FONO-LOCATION", [theatre, corridor, prospect]), "plant name": corridor || theatre,
      "role required": "Living supply", "headcount required": nests, "headcount matched": isSupply ? nests : 0,
      "headcount remaining": isSupply ? 0 : nests, certainty: after, status: after, "owner actor id": acquirer || "ACT-UNASSIGNED",
      "opened at": date, "source submission id": key, "updated at": date, "theatre id": theatre,
      "source note": `FONO Tracker · Demand=${nests} · Supply=${isSupply ? nests : 0}`,
      [REPORTING_MONTH_HEADER]: reportingMonthFromDate(date) || "",
    }];
  });
  const written = await replaceOwned(sheets, backendId, records);
  return { sourceSpreadsheetId: SOURCE_ID, sourceTab: SOURCE_TAB, sourceRows: Math.max(0, values.length - 1), demandRows: records.length,
    demandNests: records.reduce((sum, row) => sum + number(row["headcount required"]), 0), supplyNests: records.reduce((sum, row) => sum + number(row["headcount matched"]), 0),
    gapNests: records.reduce((sum, row) => sum + number(row["headcount remaining"]), 0), written };
}
