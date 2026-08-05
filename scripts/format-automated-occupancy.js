require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

const RED = { red: 0.8, green: 0.05, blue: 0.05 }
const PALE_RED = { red: 1, green: 0.86, blue: 0.86 }
const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const WHITE = { red: 1, green: 1, blue: 1 }

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.rowCount)" })
  const occupancy = (metadata.data.sheets || []).find((sheet) => sheet.properties.title === "TEAM_OCCUPANCY")
  if (!occupancy) throw new Error("TEAM_OCCUPANCY is missing")
  const sheetId = occupancy.properties.sheetId
  const rowCount = occupancy.properties.gridProperties?.rowCount || 1000
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [
      { updateSheetProperties: { properties: { sheetId, tabColorStyle: { rgbColor: BLACK } }, fields: "tabColorStyle" } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 22 }, cell: { userEnteredFormat: { backgroundColor: RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: "AUTOMATED FROM STUDIOS REPORT — DO NOT EDIT." }, fields: "userEnteredFormat,note" } },
      { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 22 }, cell: { userEnteredFormat: { backgroundColor: PALE_RED }, note: "Automated from the imported Studios tab. It will be replaced during sync." }, fields: "userEnteredFormat.backgroundColor,note" } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 22, endColumnIndex: 23 }, cell: { userEnteredFormat: { backgroundColor: BLACK, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: "USER INPUT — fill Activation Ready Nests only when operationally verified." }, fields: "userEnteredFormat,note" } },
      { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 22, endColumnIndex: 23 }, cell: { userEnteredFormat: { backgroundColor: WHITE }, note: "Only manual field in TEAM_OCCUPANCY. Existing values are preserved by Studio Code when Studios is re-imported." }, fields: "userEnteredFormat.backgroundColor,note" } },
    ] },
  })
  console.log(JSON.stringify({ tab: "TEAM_OCCUPANCY", automatedColumns: "A:V", manualColumns: "W", verified: true }))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
