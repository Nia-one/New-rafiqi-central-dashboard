require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const SOURCES = [
  { tab: "Living_Hourly", idHeader: "living hourly id", id: "LIV-TEST-001", minutesOld: 5 },
  { tab: "Member_Activation", idHeader: "activation id", id: "ACTV-TEST-001", minutesOld: 10 },
  { tab: "Action_Log", idHeader: "action id", id: "ACTION-TEST-001", minutesOld: 20 },
  { tab: "Evidence_Log", idHeader: "evidence id", id: "EVD-TEST-001", minutesOld: 15 },
]

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
  const credentialsPath = path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json")
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is not configured")
  const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const base = Date.now()
  const seeded = []

  for (const source of SOURCES) {
    const sheet = (workbook.data.sheets || []).find((entry) => entry.properties.title === source.tab)
    if (!sheet) throw new Error(`${source.tab} does not exist`)
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${source.tab}!A:AZ` })
    const rows = response.data.values || []
    const headers = [...(rows[0] || [])]
    if (!headers.includes("updated at")) headers.push("updated at")
    const idColumn = headers.indexOf(source.idHeader)
    const rowIndex = rows.slice(1).findIndex((row) => String(row[idColumn] || "").trim() === source.id) + 2
    if (rowIndex < 2) throw new Error(`${source.id} is missing from ${source.tab}`)

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${source.tab}!A1:${columnName(headers.length - 1)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    })
    const timestamp = new Date(base - source.minutesOld * 60_000).toISOString()
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${source.tab}!${columnName(headers.indexOf("updated at"))}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[timestamp]] },
    })
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ repeatCell: {
        range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: headers.indexOf("updated at"), endColumnIndex: headers.indexOf("updated at") + 1 },
        cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.85, blue: 0.4 }, textFormat: { bold: true } }, note: "Operations/system source timestamp (ISO 8601). Drives Self Drive > Member Adds > Proof and controls > Data freshness." },
        fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,note",
      } }] },
    })
    seeded.push({ tab: source.tab, id: source.id, updatedAt: timestamp })
  }

  console.log(JSON.stringify({ component: "Self Drive > Member Adds > Proof and controls > Data freshness", seeded }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
