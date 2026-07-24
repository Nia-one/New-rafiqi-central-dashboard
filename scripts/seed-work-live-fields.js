/* Adds the founder-defined Work data contract and one test row. */
require("dotenv").config({ path: ".env.local" })
const { google } = require("googleapis")
const fs = require("fs")
const path = require("path")

const fields = {
  "Studio ID": "STU-SRI-01",
  "Theatre": "THR-CHN",
  "enterprise or employer": "Test Manufacturing Co.",
  "active Members": "54",
  "Work revenue": "54000",
  "period start": "2026-07-01",
  "period end": "2026-07-31",
}

function columnName(index) {
  let value = index + 1
  let result = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing from .env.local")
  const keyFile = path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json")
  const credentials = JSON.parse(fs.readFileSync(keyFile, "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const existing = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Work_Hourly!1:2" })).data.values || [[], []]
  const headers = [...(existing[0] || [])]
  const requests = []
  for (const [header, sample] of Object.entries(fields)) {
    let index = headers.findIndex((value) => String(value).trim().toLowerCase() === header.toLowerCase())
    if (index < 0) { index = headers.length; headers.push(header) }
    const column = columnName(index)
    requests.push({ range: `Work_Hourly!${column}1:${column}2`, values: [[header], [sample]] })
  }
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  const workSheet = metadata.data.sheets?.find((sheet) => sheet.properties?.title === "Work_Hourly")
  const currentColumns = workSheet?.properties?.gridProperties?.columnCount ?? 0
  if (!workSheet?.properties?.sheetId) throw new Error("Work_Hourly tab was not found")
  if (headers.length > currentColumns) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ appendDimension: { sheetId: workSheet.properties.sheetId, dimension: "COLUMNS", length: headers.length - currentColumns } }] },
    })
  }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: requests } })
  console.log(`Seeded ${requests.length} Work_Hourly fields on test row 2.`)
}

main().catch((error) => { console.error(error.message); process.exit(1) })
