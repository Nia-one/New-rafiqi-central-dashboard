require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const normal = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
const columnName = (index) => {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

function credentials() {
  const source = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(source) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), source), "utf8")) }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const [metadata, values] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "TEAM_OCCUPANCY!1:1" }),
  ])
  const sheet = (metadata.data.sheets || []).find((entry) => entry.properties?.title === "TEAM_OCCUPANCY")
  if (!sheet) throw new Error("TEAM_OCCUPANCY tab was not found")
  const headers = values.data.values?.[0] || []
  const required = ["Activation Ready Nests"]
  const missing = required.filter((header) => !headers.some((existing) => normal(existing) === normal(header)))
  if (!missing.length) return console.log(JSON.stringify({ tab: "TEAM_OCCUPANCY", added: [] }))
  const requiredCount = headers.length + missing.length
  const availableCount = sheet.properties.gridProperties?.columnCount || 0
  if (availableCount < requiredCount) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", length: requiredCount - availableCount } }] } })
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `TEAM_OCCUPANCY!${columnName(headers.length)}1`, valueInputOption: "RAW", requestBody: { values: [missing] } })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: missing.map((header, offset) => ({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: headers.length + offset, endColumnIndex: headers.length + offset + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.03, green: 0.03, blue: 0.03 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" }, note: "BLACK = USER INPUT. Enter activation-ready Nests for this Studio and snapshot; do not copy contracted capacity unless every Nest is genuinely ready." }, fields: "userEnteredFormat,note" } })) } })
  console.log(JSON.stringify({ tab: "TEAM_OCCUPANCY", added: missing, columns: missing.map((_, index) => columnName(headers.length + index)) }))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
