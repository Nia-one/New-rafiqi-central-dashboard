require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TAB = "Essentials_Hourly"
const ROW_ID = "ESS-TEST-001"
const ID_HEADER = "essentials hourly id"
const FIELDS = [
  {
    header: "attach pct",
    value: 43,
    note: "OPS INPUT | Self Drive > Member Savings > Headline measures > Attach and repeat. Enter the attach percentage from 0 to 100 (example: 43).",
  },
  {
    header: "attach floor pct",
    value: 40,
    note: "GOVERNED INPUT | Self Drive > Member Savings > Headline measures > Attach and repeat. Enter the approved attach floor from 0 to 100 (example: 40).",
  },
  {
    header: "repeat pct",
    value: 61,
    note: "OPS INPUT | Self Drive > Member Savings > Headline measures > Attach and repeat. Enter the repeat percentage from 0 to 100 (example: 61).",
  },
  {
    header: "repeat baseline pct",
    value: 58,
    note: "GOVERNED INPUT | Self Drive > Member Savings > Headline measures > Attach and repeat. Enter the approved repeat baseline from 0 to 100 (example: 58).",
  },
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

  const workbook = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,gridProperties.columnCount)",
  })
  const sheet = (workbook.data.sheets || []).find((entry) => entry.properties.title === TAB)
  if (!sheet) throw new Error(`${TAB} does not exist`)

  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:AZ` })
  const rows = response.data.values || []
  const headers = [...(rows[0] || [])]
  const normalized = () => headers.map((header) => String(header).trim().toLowerCase())
  for (const field of FIELDS) if (!normalized().includes(field.header)) headers.push(field.header)

  const requiredColumns = headers.length
  const currentColumns = Number(sheet.properties.gridProperties.columnCount || 0)
  if (currentColumns < requiredColumns) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", length: requiredColumns - currentColumns } }] },
    })
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A1:${columnName(headers.length - 1)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  })

  const idColumn = normalized().indexOf(ID_HEADER)
  const rowIndex = rows.slice(1).findIndex((row) => String(row[idColumn] || "").trim() === ROW_ID) + 2
  if (rowIndex < 2) throw new Error(`${ROW_ID} is missing from ${TAB}`)

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: FIELDS.map((field) => {
        const column = normalized().indexOf(field.header)
        return { range: `${TAB}!${columnName(column)}${rowIndex}`, values: [[field.value]] }
      }),
    },
  })

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: FIELDS.map((field) => {
        const column = normalized().indexOf(field.header)
        return {
          repeatCell: {
            range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 },
            cell: {
              userEnteredFormat: { backgroundColor: { red: 1, green: 0.85, blue: 0.4 }, textFormat: { bold: true } },
              note: field.note,
            },
            fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,note",
          },
        }
      }),
    },
  })

  const verification = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB}!${columnName(normalized().indexOf(FIELDS[0].header))}${rowIndex}:${columnName(normalized().indexOf(FIELDS.at(-1).header))}${rowIndex}`,
  })
  console.log(JSON.stringify({
    component: "Self Drive > Member Savings > Headline measures > Attach and repeat",
    tab: TAB,
    rowId: ROW_ID,
    fields: Object.fromEntries(FIELDS.map((field, index) => [field.header, verification.data.values?.[0]?.[index]])),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
