require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TITLE = "Living_Dashboard"
const HEADERS = ["section", "key", "label", "value number", "value text", "owner actor id", "studio id", "supply model", "updated at", "notes"]
const NOW = "2026-07-24T12:00:00+05:30"
const ROWS = [
  ["FONO stage", "visits", "Studios visited", 68, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA — replace with Operations update"],
  ["FONO stage", "agreed", "Agreed", 31, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA — replace with Operations update"],
  ["FONO stage", "contracted", "Contracted", 1, "", "ACT-PRIYA", "", "FONO", NOW, "Derived from current Living_Hourly; replace only if an approved stage snapshot is entered"],
  ["FONO stage", "kyc", "KYC", 11, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA — replace with Operations update"],
  ["FONO stage", "live", "Live", 1, "", "ACT-PRIYA", "", "FONO", NOW, "Derived from current Studio_Master count"],
  ["Pacing", "fono_target", "FONO monthly target", 2000, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA — monthly target"],
  ["Pacing", "sp_target", "Shram Park monthly target", 2000, "", "ACT-PRIYA", "", "SP", NOW, "TEST DATA — monthly target"],
  ["Pacing", "days_elapsed", "Days elapsed", 24, "", "ACT-PRIYA", "", "", NOW, "TEST DATA — update daily"],
  ["Pacing", "days_in_month", "Days in month", 31, "", "ACT-PRIYA", "", "", NOW, "TEST DATA — update monthly"],
  ["FONO detail", "franchisee_sourced", "Franchisee-sourced Members", 42, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA"],
  ["FONO detail", "nia_filled", "Nia-filled Members", 30, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA"],
  ["FONO detail", "vacant_cycle_start", "Vacant Nests at cycle start", 96, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA"],
  ["FONO detail", "nia_fill_rate", "Nia fill rate", 0.31, "", "ACT-PRIYA", "", "FONO", NOW, "TEST DATA — ratio 0 to 1"],
  ["Metric", "cm1", "CM1", 62500, "", "ACT-PRIYA", "", "", NOW, "TEST DATA — INR"],
  ["Metric", "cm2", "CM2", 43000, "", "ACT-PRIYA", "", "", NOW, "TEST DATA — INR"],
]

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const existing = (workbook.data.sheets || []).find((sheet) => sheet.properties.title === TITLE)
  if (!existing) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: TITLE } } }] } })
  const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TITLE}!A:Z` })
  if (!(values.data.values || []).length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${TITLE}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: [HEADERS, ...ROWS] } })
  const refreshed = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const sheet = (refreshed.data.sheets || []).find((item) => item.properties.title === TITLE)
  if (sheet) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.18, green: 0.36, blue: 0.55 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
    { repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: 501, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.65 } } }, fields: "userEnteredFormat.backgroundColor" } },
    { autoResizeDimensions: { dimensions: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 10 } } },
  ] } })
  console.log(`${TITLE} is ready; all yellow cells are Operations inputs.`)
}

main().catch((error) => { console.error(error); process.exit(1) })
