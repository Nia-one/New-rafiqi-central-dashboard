require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.SHRAM_PARK_DEMAND_BOT_SHEET_ID || "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y"
const tab = process.env.SHRAM_PARK_DEMAND_BOT_TAB || "Demand Visit Data"
const normal = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
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
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const [metadata, values] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!1:1` }),
  ])
  const sheet = (metadata.data.sheets || []).find((item) => item.properties?.title === tab)
  if (!sheet?.properties?.sheetId) throw new Error(`${tab} was not found`)
  const headers = (values.data.values?.[0] || []).map(String)
  let ownerIndex = headers.findIndex((header) => normal(header) === "owner name")
  if (ownerIndex < 0) {
    ownerIndex = headers.length
    const available = sheet.properties.gridProperties?.columnCount || 0
    if (available <= ownerIndex) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", length: ownerIndex - available + 1 } }] } })
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${tab}'!${columnName(ownerIndex)}1`, valueInputOption: "RAW", requestBody: { values: [["Owner Name"]] } })
  }
  const ownerColumn = columnName(ownerIndex)
  const formula = '=ARRAYFORMULA(IF(F2:F="","",IF(REGEXMATCH(LOWER(F2:F),"rajputana|deccan|decaan"),"Prashant Wahire",IF(REGEXMATCH(LOWER(F2:F),"coromandal|coromandel|wellington|welington"),"Satish Sanghy",""))))'
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tab}'!${ownerColumn}2:${ownerColumn}` })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${tab}'!${ownerColumn}2`, valueInputOption: "USER_ENTERED", requestBody: { values: [[formula]] } })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: ownerIndex, endColumnIndex: ownerIndex + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.8, green: 0.05, blue: 0.05 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" }, note: "AUTO / DO NOT EDIT — Theatre owner: Rajputana/Deccan → Prashant Wahire; Coromandel/Wellington → Satish Sanghy." }, fields: "userEnteredFormat,note" } },
    { autoResizeDimensions: { dimensions: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", startIndex: ownerIndex, endIndex: ownerIndex + 1 } } },
  ] } })
  const check = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: [`'${tab}'!F2:F`, `'${tab}'!${ownerColumn}2:${ownerColumn}`] })
  const theatres = check.data.valueRanges?.[0]?.values || []
  const owners = check.data.valueRanges?.[1]?.values || []
  const distribution = {}
  theatres.forEach((row, index) => {
    const key = `${String(row[0] || "(blank)").trim()} → ${String(owners[index]?.[0] || "(blank)").trim()}`
    distribution[key] = (distribution[key] || 0) + 1
  })
  console.log(JSON.stringify({ spreadsheetId, tab, ownerColumn, mappings: { "Rajputana / Deccan": "Prashant Wahire", "Coromandel / Wellington": "Satish Sanghy" }, distribution }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
