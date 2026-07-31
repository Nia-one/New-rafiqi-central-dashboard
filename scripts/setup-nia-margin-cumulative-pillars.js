const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

function columnName(index) {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

const fields = [
  ["living_cm2_cumulative_inr", "Living CM2 cumulative ₹"],
  ["work_cm2_cumulative_inr", "Work CM2 cumulative ₹"],
  ["essentials_cm2_cumulative_inr", "Essentials CM2 cumulative ₹"],
]

async function ensureColumns(sheets, spreadsheetId, tab, headers) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" })
  const sheet = (metadata.data.sheets || []).find((item) => item.properties.title === tab)
  if (!sheet) throw new Error(`${tab} was not found`)
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!1:1` })).data.values?.[0] || []
  const missing = headers.filter((header) => !current.includes(header))
  if (!missing.length) return
  const required = current.length + missing.length
  const available = sheet.properties.gridProperties.columnCount || 0
  if (available < required) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", length: required - available } }] } })
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!${columnName(current.length)}1`, valueInputOption: "RAW", requestBody: { values: [missing] } })
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const sourceSpreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const backendSpreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!sourceSpreadsheetId || !backendSpreadsheetId) throw new Error("Google Sheet IDs are missing")
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })

  const metadata = await sheets.spreadsheets.get({ spreadsheetId: sourceSpreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" })
  const finance = (metadata.data.sheets || []).find((item) => item.properties.title === "TEAM_FINANCE_DAILY")
  if (!finance) throw new Error("TEAM_FINANCE_DAILY was not found")
  const sheetId = finance.properties.sheetId
  const rows = (await sheets.spreadsheets.values.get({ spreadsheetId: sourceSpreadsheetId, range: "TEAM_FINANCE_DAILY!1:3" })).data.values || []
  const canonical = rows[2] || []
  const existingNew = fields.map(([header]) => canonical.indexOf(header)).filter((index) => index >= 0)
  // Keep a visible spacer after the existing finance table. AG is the minimum
  // start so this block remains separate from the studio-wise inputs.
  const start = existingNew.length ? Math.min(...existingNew) : Math.max(32, canonical.length + 1)
  const requiredColumns = start + fields.length
  const availableColumns = finance.properties.gridProperties.columnCount || 0
  if (availableColumns < requiredColumns) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: sourceSpreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId, dimension: "COLUMNS", length: requiredColumns - availableColumns } }] } })
  }

  const startColumn = columnName(start)
  const endColumn = columnName(start + fields.length - 1)
  await sheets.spreadsheets.values.update({
    spreadsheetId: sourceSpreadsheetId,
    range: `TEAM_FINANCE_DAILY!${startColumn}1:${endColumn}3`,
    valueInputOption: "RAW",
    requestBody: { values: [
      fields.map(([, label]) => `${label}\nCUMULATIVE INPUT — ENTER ONCE`),
      fields.map(() => "Enter one cumulative total only in row 4. Do not split this value studio-wise. Number in INR; example: 125000."),
      fields.map(([header]) => header),
    ] },
  })
  await sheets.spreadsheets.values.clear({ spreadsheetId: sourceSpreadsheetId, range: `TEAM_FINANCE_DAILY!${startColumn}5:${endColumn}1000` })

  const requests = [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: start, endColumnIndex: start + 3 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.03, green: 0.03, blue: 0.03 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: start, endColumnIndex: start + 3 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.03, green: 0.03, blue: 0.03 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: start, endColumnIndex: start + 3 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.7 }, numberFormat: { type: "NUMBER", pattern: "#,##0.00" }, textFormat: { bold: true } } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 4, endRowIndex: 1000, startColumnIndex: start, endColumnIndex: start + 3 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 } } }, fields: "userEnteredFormat.backgroundColor" } },
    { setDataValidation: { range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: start, endColumnIndex: start + 3 }, rule: { condition: { type: "NUMBER_GREATER_THAN_EQ", values: [{ userEnteredValue: "0" }] }, strict: true, inputMessage: "Enter the cumulative INR total once in row 4." } } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: start, endIndex: start + 3 }, properties: { pixelSize: 210 }, fields: "pixelSize" } },
  ]
  for (const legacy of ["living_cm2_inr", "work_cm2_inr", "essentials_cm2_inr"]) {
    const index = canonical.indexOf(legacy)
    if (index >= 0) requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } })
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sourceSpreadsheetId, requestBody: { requests } })
  await ensureColumns(sheets, backendSpreadsheetId, "Finance_Daily", fields.map(([header]) => header.replaceAll("_", " ")))
  console.log(JSON.stringify({ tab: "TEAM_FINANCE_DAILY", inputRange: `${startColumn}4:${endColumn}4`, fields: fields.map(([header]) => header), legacyColumnsHidden: true }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
