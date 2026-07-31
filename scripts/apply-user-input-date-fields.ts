import dotenv from "dotenv";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleCredentials";

dotenv.config({ path: ".env.local" });

const tabs = [
  "TEAM_FINANCE_DAILY", "TEAM_MEMBER_ACTIVATION", "TEAM_REQ_PEOPLE_ROSTER",
  "TEAM_LEARNING_HISTORY", "TEAM_REQ_POLICY_REGISTRY", "TEAM_REQ_INCIDENT_LOG",
  "TEAM_REQ_ACTION_LOG", "TEAM_REQ_EVIDENCE_LOG", "TEAM_REQ_APPROVAL_LOG",
] as const;

const manualDateHeaders = new Set([
  "business date", "activation required at", "activated at", "verified at",
  "decision due at", "due at", "effective from", "effective to",
  "shift start at", "shift end at",
]);
const normal = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const [metadata, values] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.rowCount)" }),
    sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: tabs.map((tab) => `${tab}!A1:AZ5`) }),
  ]);
  const properties = new Map((metadata.data.sheets || []).map((sheet) => [sheet.properties?.title, sheet.properties]));
  const requests: object[] = [];
  const helperWrites: { range: string; values: string[][] }[] = [];

  values.data.valueRanges?.forEach((valueRange, tabIndex) => {
    const tab = tabs[tabIndex];
    const property = properties.get(tab);
    const rows = (valueRange.values || []) as unknown[][];
    if (property?.sheetId == null) return;
    const headerRowIndex = rows.findIndex((row) => row.some((cell) => manualDateHeaders.has(normal(cell))));
    if (headerRowIndex < 0) return;
    rows[headerRowIndex].forEach((cell, columnIndex) => {
      if (!manualDateHeaders.has(normal(cell))) return;
      requests.push({
        repeatCell: {
          range: { sheetId: property.sheetId, startRowIndex: headerRowIndex + 1, endRowIndex: property.gridProperties?.rowCount, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd-mm-yyyy" } }, dataValidation: { condition: { type: "DATE_IS_VALID" }, strict: true, showCustomUi: true } },
          fields: "userEnteredFormat.numberFormat,dataValidation",
        },
      });
      if (headerRowIndex > 0) {
        const column = `${String.fromCharCode(65 + Math.floor(columnIndex / 26) - 1)}${String.fromCharCode(65 + columnIndex % 26)}`.replace(/^@/, "");
        helperWrites.push({ range: `${tab}!${column}${headerRowIndex}`, values: [["DATE ONLY — DD-MM-YYYY; dashboard/backend generates the timestamp"]] });
      }
    });
  });

  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  if (helperWrites.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: helperWrites } });
  console.log(`Configured ${requests.length} user date columns; automatic timestamp columns unchanged.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
