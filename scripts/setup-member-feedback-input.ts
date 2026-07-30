import dotenv from "dotenv";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleCredentials";
import { MEMBER_FEEDBACK_INPUT_TAB, memberFeedbackInputHeaders } from "../lib/memberFeedbackSync";

dotenv.config({ path: ".env.local" });

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  let property = metadata.data.sheets?.find((sheet) => sheet.properties?.title === MEMBER_FEEDBACK_INPUT_TAB)?.properties;
  if (!property) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: MEMBER_FEEDBACK_INPUT_TAB, gridProperties: { frozenRowCount: 2 } } } }] } });
    property = added.data.replies?.[0].addSheet?.properties;
  }
  if (!property?.sheetId) throw new Error("Unable to create Member Feedback input tab");
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${MEMBER_FEEDBACK_INPUT_TAB}!A1:K2` });
  if (!(current.data.values || []).length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${MEMBER_FEEDBACK_INPUT_TAB}!A1`, valueInputOption: "RAW", requestBody: { values: [
    ["MEMBER FEEDBACK / NPS INPUT", "Fill one row per response. Backend tabs are automatic—do not edit them."],
    [...memberFeedbackInputHeaders],
  ] } });
  const black = { red: 0.03, green: 0.03, blue: 0.03 }, white = { red: 1, green: 1, blue: 1 };
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { updateSheetProperties: { properties: { sheetId: property.sheetId, tabColor: black, gridProperties: { frozenRowCount: 2 } }, fields: "tabColor,gridProperties.frozenRowCount" } },
    { repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: memberFeedbackInputHeaders.length }, cell: { userEnteredFormat: { backgroundColor: black, textFormat: { foregroundColor: white, bold: true }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { setDataValidation: { range: { sheetId: property.sheetId, startRowIndex: 2, endRowIndex: 1000, startColumnIndex: 1, endColumnIndex: 2 }, rule: { condition: { type: "NUMBER_BETWEEN", values: [{ userEnteredValue: "0" }, { userEnteredValue: "10" }] }, strict: true, showCustomUi: true } } },
    { setDataValidation: { range: { sheetId: property.sheetId, startRowIndex: 2, endRowIndex: 1000, startColumnIndex: 8, endColumnIndex: 9 }, rule: { condition: { type: "ONE_OF_LIST", values: ["Immediate attention", "Watch closely", "Low"].map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } },
    { repeatCell: { range: { sheetId: property.sheetId, startRowIndex: 2, endRowIndex: 1000, startColumnIndex: 3, endColumnIndex: 4 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE_TIME", pattern: "yyyy-mm-dd hh:mm" } } }, fields: "userEnteredFormat.numberFormat" } },
    { updateDimensionProperties: { range: { sheetId: property.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: memberFeedbackInputHeaders.length }, properties: { pixelSize: 165 }, fields: "pixelSize" } },
  ] } });
  console.log(JSON.stringify({ spreadsheetId, tab: MEMBER_FEEDBACK_INPUT_TAB, columns: memberFeedbackInputHeaders.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
