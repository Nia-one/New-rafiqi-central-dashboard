require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

const TITLE = "TEAM_OCCUPANCY"
const PROTECTION = "RAFIQI_SAMPLE_ROW: TEAM_OCCUPANCY"
const PALE_RED = { red: 1, green: 0.86, blue: 0.86 }
const WHITE = { red: 1, green: 1, blue: 1 }
const GREY = { red: 0.92, green: 0.92, blue: 0.92 }

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const account = credentials()
  const auth = new google.auth.GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title,gridProperties),protectedRanges(protectedRangeId,description))" })
  const sheet = (metadata.data.sheets || []).find((item) => item.properties?.title === TITLE)
  if (!sheet) throw new Error(`${TITLE} is missing`)

  const rows = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TITLE}!A1:X80` })).data.values || []
  const sampleIndex = rows.findIndex((row, index) => index > 0 && row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell || ""))))
  if (sampleIndex !== 1) throw new Error(`Expected the sample at row 2 after sync; found row ${sampleIndex + 1}`)

  const sheetId = sheet.properties.sheetId
  const rowCount = sheet.properties.gridProperties?.rowCount || 1000
  const requests = (sheet.protectedRanges || [])
    .filter((range) => String(range.description || "").startsWith("RAFIQI_SAMPLE_ROW"))
    .map((range) => ({ deleteProtectedRange: { protectedRangeId: range.protectedRangeId } }))
  requests.push(
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 22 }, cell: { userEnteredFormat: { backgroundColor: PALE_RED, textFormat: { italic: false }, wrapStrategy: "WRAP" }, note: "Automated from the imported Studios tab. It will be replaced during sync." }, fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.italic,userEnteredFormat.wrapStrategy,note" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 22, endColumnIndex: 23 }, cell: { userEnteredFormat: { backgroundColor: WHITE, textFormat: { italic: false }, wrapStrategy: "WRAP" }, note: "Only manual field in TEAM_OCCUPANCY. Existing values are preserved by Studio Code during sync." }, fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.italic,userEnteredFormat.wrapStrategy,note" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 23, endColumnIndex: 24 }, cell: { userEnteredFormat: { backgroundColor: PALE_RED, textFormat: { italic: false }, wrapStrategy: "WRAP" }, note: "Automated reporting month in YYYY-MM format." }, fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.italic,userEnteredFormat.wrapStrategy,note" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 24 }, cell: { userEnteredFormat: { backgroundColor: GREY, textFormat: { italic: true }, wrapStrategy: "WRAP" }, note: "SAMPLE — DO NOT SYNC. Format example only; excluded from dashboard/backend sync." }, fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.italic,userEnteredFormat.wrapStrategy,note" } },
    { addProtectedRange: { protectedRange: { description: PROTECTION, range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 24 }, warningOnly: false, editors: { users: [account.client_email] } } } },
  )
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log(JSON.stringify({ tab: TITLE, sampleRow: 2, firstDataRow: 3, protected: true, formatted: true }))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
