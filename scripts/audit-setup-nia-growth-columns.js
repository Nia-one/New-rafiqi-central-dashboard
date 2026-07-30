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
const specs = [
  { header: "Theatre", aliases: ["theatre", "theater"], help: "REQUIRED — Theatre name/ID. Example: Rajputana.", kind: "text" },
  { header: "Studio Code", aliases: ["studio code", "studio id"], help: "REQUIRED — Stable Studio code used across the workbook. Example: RJT-FN-D01.", kind: "text" },
  { header: "Studio Name", aliases: ["studio name", "studio"], help: "REQUIRED — Human-readable Studio name.", kind: "text" },
  { header: "supply_model", aliases: ["supply model"], help: "REQUIRED — Select FONO or SP. Do not mix the two operating models.", kind: "supply" },
  { header: "Contracted Nest", aliases: ["contracted nest", "contracted nests"], help: "REQUIRED — Total contracted Nests for this Studio. Whole number, zero or greater.", kind: "integer" },
  { header: "Activation Ready Nests", aliases: ["activation ready nests", "activation ready nest"], help: "REQUIRED — Nests genuinely ready for activation now. Whole number; must not exceed Contracted Nest.", kind: "integer" },
  { header: "Occupied Nest", aliases: ["occupied nest", "occupied nests"], help: "REQUIRED — Currently occupied Nests. Whole number; must not exceed Contracted Nest.", kind: "integer" },
  { header: "Determined Revenue", aliases: ["determined revenue", "living billed inr"], help: "OPTIONAL — Recorded Living revenue for the same Studio and snapshot, INR number only.", kind: "currency" },
  { header: "as_of_at", aliases: ["as of at", "date"], help: "REQUIRED — Snapshot date/time. Format: YYYY-MM-DD HH:MM. Example: 2026-07-30 16:30.", kind: "datetime" },
  { header: "source_updated_at", aliases: ["source updated at", "updated at"], help: "REQUIRED — Time this source row was last updated. Format: YYYY-MM-DD HH:MM.", kind: "datetime" },
]

function credentials() {
  const source = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(source) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), source), "utf8")) }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const [metadata, response] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "TEAM_OCCUPANCY!A:AZ" }),
  ])
  const sheet = (metadata.data.sheets || []).find((entry) => entry.properties?.title === "TEAM_OCCUPANCY")
  if (!sheet) throw new Error("TEAM_OCCUPANCY tab was not found")
  const rows = response.data.values || []
  const headers = rows[0] || []
  const found = specs.map((spec) => {
    const index = headers.findIndex((header) => spec.aliases.includes(normal(header)) || normal(header) === normal(spec.header))
    return { ...spec, index }
  })
  const missing = found.filter((spec) => spec.index < 0)
  const requiredCount = headers.length + missing.length
  const availableCount = sheet.properties.gridProperties?.columnCount || 0
  if (missing.length && availableCount < requiredCount) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", length: requiredCount - availableCount } }] } })
  }
  if (missing.length) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `TEAM_OCCUPANCY!${columnName(headers.length)}1`, valueInputOption: "RAW", requestBody: { values: [missing.map((spec) => spec.header)] } })
  }
  const requests = []
  found.forEach((spec) => {
      const index = spec.index >= 0 ? spec.index : headers.length + missing.findIndex((entry) => entry.header === spec.header)
      requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.03, green: 0.03, blue: 0.03 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" }, note: spec.help }, fields: "userEnteredFormat,note" } })
      if (spec.kind === "integer" || spec.kind === "currency") requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: spec.kind === "integer" ? "0" : "₹#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } })
      if (spec.kind === "datetime") requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE_TIME", pattern: "yyyy-mm-dd hh:mm" } } }, fields: "userEnteredFormat.numberFormat" } })
      if (spec.kind === "supply") requests.push({ setDataValidation: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: index, endColumnIndex: index + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "FONO" }, { userEnteredValue: "SP" }] }, strict: true, showCustomUi: true } } })
  })
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  }
  const audit = found.map((spec) => ({
    field: spec.header,
    status: spec.index >= 0 ? "existing" : "added",
    column: columnName(spec.index >= 0 ? spec.index : headers.length + missing.findIndex((entry) => entry.header === spec.header)),
    populatedRows: spec.index >= 0 ? rows.slice(1).filter((row) => String(row[spec.index] ?? "").trim()).length : 0,
    format: spec.help,
  }))
  console.log(JSON.stringify({ tab: "TEAM_OCCUPANCY", dataRows: rows.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim())).length, existing: audit.filter((item) => item.status === "existing").length, added: audit.filter((item) => item.status === "added").length, audit }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
