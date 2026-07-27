require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TAB = "Member_Activation"
const REQUIRED_COLUMNS = ["acquisition source", "actual loaded cac inr", "payback days"]
const TEST_ACTIVATION_ID = "ACTV-TEST-001"
const TEST_VALUES = {
  "acquisition source": "Nia fill",
  "actual loaded cac inr": 82,
  "payback days": 13,
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
  const credentialsPath = path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json")
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is not configured")

  const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const sheet = (workbook.data.sheets || []).find((entry) => entry.properties.title === TAB)
  if (!sheet) throw new Error(`${TAB} does not exist`)

  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:AZ` })
  const rows = response.data.values || []
  const headers = [...(rows[0] || [])]
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) headers.push(column)
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A1:${columnName(headers.length - 1)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  })

  let rowIndex = rows.slice(1).findIndex((row) => String(row[headers.indexOf("activation id")] || "").trim() === TEST_ACTIVATION_ID) + 2
  if (rowIndex < 2) throw new Error(`${TEST_ACTIVATION_ID} is missing; the existing seed row was not replaced`)
  const values = headers.map((header, index) => TEST_VALUES[header] ?? rows[rowIndex - 1]?.[index] ?? "")
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A${rowIndex}:${columnName(headers.length - 1)}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  })

  const startColumn = headers.indexOf(REQUIRED_COLUMNS[0])
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        repeatCell: {
          range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: startColumn, endColumnIndex: startColumn + REQUIRED_COLUMNS.length },
          cell: {
            userEnteredFormat: { backgroundColor: { red: 1, green: 0.85, blue: 0.4 }, textFormat: { bold: true } },
            note: "Operations input for Self Drive > Member Adds > Proof and controls. acquisition source: text; actual loaded cac inr: INR number; payback days: number.",
          },
          fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,note",
        },
      }],
    },
  })

  const readback = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A${rowIndex}:${columnName(headers.length - 1)}${rowIndex}` })
  const readRow = readback.data.values?.[0] || []
  console.log(JSON.stringify({
    tab: TAB,
    activationId: readRow[headers.indexOf("activation id")],
    acquisitionSource: readRow[headers.indexOf("acquisition source")],
    actualLoadedCacInr: Number(readRow[headers.indexOf("actual loaded cac inr")]),
    paybackDays: Number(readRow[headers.indexOf("payback days")]),
    dashboardComponent: "Self Drive > Member Adds > Proof and controls",
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
