import dotenv from "dotenv";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleCredentials";

dotenv.config({ path: ".env.local" });
const TAB = "TEAM_ESSENTIALS_SUMMARY", HEADER_ROW = 1, DATA_START_ROW = 2;
const headersToAdd = ["Total COGS (₹)", "Total Fulfilment Cost (₹)", "Total Member Savings (₹)", "Total Nia Margin (₹)", "Attach Floor %", "Repeat %", "Repeat Baseline %", "Weekly Message Status", "Next Action", "Next Action Owner Actor ID", "Next Action Due At", "Evidence Required"];
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const letter = (index: number) => { let n = index + 1, out = ""; while (n) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); } return out; };

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID!;
  const sheets = google.sheets({ version: "v4", auth: new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] }) });
  const [meta, values] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties)" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${TAB}'!A1:AZ1000` }),
  ]);
  const property = meta.data.sheets?.find((sheet) => sheet.properties?.title === TAB)?.properties;
  if (property?.sheetId == null) throw new Error(`${TAB} not found`);
  const headers = ((values.data.values || [])[0] || []).map(String), existing = new Map(headers.map((header, index) => [norm(header), index]));
  let next = headers.length;
  const assigned = headersToAdd.map((header) => ({ header, index: existing.get(norm(header)) ?? next++ }));
  const maxColumns = property.gridProperties?.columnCount || headers.length;
  if (next > maxColumns) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: property.sheetId, dimension: "COLUMNS", length: next - maxColumns } }] } });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: assigned.map(({ header, index }) => ({ range: `'${TAB}'!${letter(index)}1`, values: [[header]] })) } });
  const indexByHeader = new Map(assigned.map(({ header, index }) => [norm(header), index]));
  const black = { red: 0.03, green: 0.03, blue: 0.03 }, white = { red: 1, green: 1, blue: 1 }, rowCount = property.gridProperties?.rowCount || 1000;
  const requests: object[] = [];
  assigned.forEach(({ header, index }) => {
    requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: black, textFormat: { foregroundColor: white, bold: true }, wrapStrategy: "WRAP" }, note: header === "Total Nia Margin (₹)" ? "Automatic Studio total: Buying Value - Total COGS - Total Fulfilment Cost" : `BLACK = USER INPUT. One Studio-level total, not product-wise: ${header}` }, fields: "userEnteredFormat,note" } });
    requests.push({ updateDimensionProperties: { range: { sheetId: property.sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 }, properties: { pixelSize: 165 }, fields: "pixelSize" } });
    if (header.includes("%")) requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0.0%" } } }, fields: "userEnteredFormat.numberFormat" } });
  });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  const buyingIndex = headers.findIndex((header) => norm(header) === "buying value");
  if (buyingIndex < 0) throw new Error("Buying Value column missing");
  const cogs = letter(indexByHeader.get(norm("Total COGS (₹)"))!), fulfil = letter(indexByHeader.get(norm("Total Fulfilment Cost (₹)"))!), margin = letter(indexByHeader.get(norm("Total Nia Margin (₹)"))!), buying = letter(buyingIndex);
  const formulas = Array.from({ length: rowCount - DATA_START_ROW + 1 }, (_, offset) => { const row = DATA_START_ROW + offset; return { range: `'${TAB}'!${margin}${row}`, values: [[`=IF(OR(${cogs}${row}="",${fulfil}${row}=""),"",${buying}${row}-${cogs}${row}-${fulfil}${row})`]] }; });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: formulas } });
  const studioIndex = headers.findIndex((header) => norm(header) === "studio name");
  const delivery = letter(indexByHeader.get(norm("Weekly Message Status"))!);
  const populatedRows = (values.data.values || []).slice(1).flatMap((row, offset) => studioIndex >= 0 && String(row[studioIndex] ?? "").trim() ? [{ range: `'${TAB}'!${delivery}${offset + 2}`, values: [["Delivered"]] }] : []);
  if (populatedRows.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: populatedRows } });
  console.log(JSON.stringify({ tab: TAB, columns: assigned, formula: `${margin} = ${buying} - ${cogs} - ${fulfil}` }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
