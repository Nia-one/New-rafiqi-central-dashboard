import dotenv from "dotenv";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleCredentials";

dotenv.config({ path: ".env.local" });

const TAB = "Essentials";
const HEADER_ROW = 4;
const DATA_START_ROW = 5;
const columns = [
  "Total COGS (₹)", "Total Fulfilment Cost (₹)", "Total Member Savings (₹)", "Total Nia Margin (₹)",
  "Attach Floor %", "Repeat %", "Repeat Baseline %", "Next Action",
  "Next Action Owner Actor ID", "Next Action Due At", "Evidence Required",
] as const;
const legacyAliases: Record<string, string> = {
  "total cogs (₹)": "product cogs (₹)",
  "total fulfilment cost (₹)": "fulfilment cost (₹)",
  "total member savings (₹)": "member savings (₹)",
  "total nia margin (₹)": "nia margin (₹)",
};
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const columnLetter = (index: number) => {
  let value = index + 1, output = "";
  while (value) { value--; output = String.fromCharCode(65 + value % 26) + output; value = Math.floor(value / 26); }
  return output;
};

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const [metadata, values] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties)" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${TAB}'!${HEADER_ROW}:${HEADER_ROW}` }),
  ]);
  const property = metadata.data.sheets?.find((sheet) => sheet.properties?.title === TAB)?.properties;
  if (property?.sheetId == null) throw new Error("Essentials tab was not found");
  const headers = ((values.data.values || [])[0] || []).map(String);
  const indexes = new Map(headers.map((header, index) => [norm(header), index]));
  let nextIndex = headers.length;
  const assigned = columns.map((header) => {
    const existing = indexes.get(norm(header)) ?? indexes.get(legacyAliases[norm(header)] || "");
    const index = existing == null ? nextIndex++ : existing;
    indexes.set(norm(header), index);
    return { header, index };
  });
  const currentColumnCount = property.gridProperties?.columnCount || headers.length;
  if (nextIndex > currentColumnCount) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: property.sheetId, dimension: "COLUMNS", length: nextIndex - currentColumnCount } }] } });
  const totalRevenueIndex = headers.findIndex((header) => norm(header).startsWith("total rev"));
  if (totalRevenueIndex < 0) throw new Error("Essentials tab is missing Total Rev");
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: assigned.map(({ header, index }) => ({ range: `'${TAB}'!${columnLetter(index)}${HEADER_ROW}`, values: [[header]] })) } });

  const black = { red: 0.03, green: 0.03, blue: 0.03 }, white = { red: 1, green: 1, blue: 1 };
  const rowCount = Math.max(DATA_START_ROW + 1, property.gridProperties?.rowCount || 1000);
  const requests: object[] = [];
  for (const { header, index } of assigned) {
    requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: HEADER_ROW - 1, endRowIndex: HEADER_ROW, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: black, textFormat: { foregroundColor: white, bold: true }, wrapStrategy: "WRAP" }, note: header === "Total Nia Margin (₹)" ? "Studio-level formula: Total Rev - Total COGS - Total Fulfilment Cost. One value for the row's Unique Members population." : `BLACK = STUDIO-LEVEL USER INPUT: ${header}. Do not enter product-wise values.` }, fields: "userEnteredFormat,note" } });
    requests.push({ updateDimensionProperties: { range: { sheetId: property.sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 }, properties: { pixelSize: 165 }, fields: "pixelSize" } });
    if (/₹|cost|savings|margin/i.test(header)) requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: DATA_START_ROW - 1, endRowIndex: rowCount, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "₹#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } });
    if (/%/.test(header)) requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: DATA_START_ROW - 1, endRowIndex: rowCount, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0.0%" } } }, fields: "userEnteredFormat.numberFormat" } });
    if (header === "Next Action Due At") requests.push({ repeatCell: { range: { sheetId: property.sheetId, startRowIndex: DATA_START_ROW - 1, endRowIndex: rowCount, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE_TIME", pattern: "yyyy-mm-dd hh:mm" } } }, fields: "userEnteredFormat.numberFormat" } });
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  const cogs = columnLetter(indexes.get(norm("Total COGS (₹)"))!);
  const fulfilment = columnLetter(indexes.get(norm("Total Fulfilment Cost (₹)"))!);
  const margin = columnLetter(indexes.get(norm("Total Nia Margin (₹)"))!);
  const revenue = columnLetter(totalRevenueIndex);
  const data = [];
  for (let row = DATA_START_ROW; row <= rowCount; row++) data.push({ range: `'${TAB}'!${margin}${row}`, values: [[`=IF(OR(${cogs}${row}="",${fulfilment}${row}=""),"",${revenue}${row}-${cogs}${row}-${fulfilment}${row})`]] });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data } });
  console.log(JSON.stringify({ tab: TAB, addedOrConfirmed: assigned, formula: `${margin} = ${revenue} - ${cogs} - ${fulfilment}` }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
