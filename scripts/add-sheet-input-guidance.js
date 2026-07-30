const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const BOOKS = [
  process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU",
  process.env.ESSENTIALS_BOT_SHEET_ID || "1C8y3uVxp5toMwLBPGVWbltOoNX_hVuKtvyfiqIUC0oY",
  process.env.SHRAM_PARK_DEMAND_BOT_SHEET_ID || "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y",
]
const GUIDE = "DATA_ENTRY_GUIDE"
const RED = { red: 0.8, green: 0.05, blue: 0.05 }
const WHITE = { red: 1, green: 1, blue: 1 }

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}
const normal = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
const columnLetter = (index) => { let n = index + 1, out = ""; while (n) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26) } return out }
const isBlack = (color) => color && (color.red || 0) < 0.2 && (color.green || 0) < 0.2 && (color.blue || 0) < 0.2

function instruction(header) {
  const h = normal(header)
  if (h === "payment collected at") return { meaning: "Actual date and time when payment was received", format: "ISO 8601 timestamp with timezone", example: "2026-07-29T14:30:00+05:30", numberFormat: { type: "TEXT", pattern: "@" } }
  if (h === "collected amount") return { meaning: "Amount actually collected for this order", format: "Number in INR; digits/decimal only, no ₹ symbol", example: "850.00", numberFormat: { type: "NUMBER", pattern: "#,##0.00" } }
  if (["direct fulfilment cost", "packaging cost", "delivery cost"].includes(h)) return { meaning: `${header.replaceAll("_", " ")} attributable to this order item`, format: "Number in INR; use 0 when there is no cost", example: "25.00", numberFormat: { type: "NUMBER", pattern: "#,##0.00" } }
  if (h === "dispatched at" || h === "delivered at") return { meaning: `Actual ${h.replace(" at", "")} timestamp`, format: "ISO 8601 timestamp with timezone", example: "2026-07-29T16:45:00+05:30", numberFormat: { type: "TEXT", pattern: "@" } }
  if (h === "delivery status") return { meaning: "Current delivery state", format: "Text: Pending, Dispatched, Delivered, Failed, or Cancelled", example: "Delivered", numberFormat: { type: "TEXT", pattern: "@" } }
  if (h === "delivery owner") return { meaning: "Named person/actor responsible for delivery", format: "Name or approved actor ID", example: "ACT-DELIVERY-01", numberFormat: { type: "TEXT", pattern: "@" } }
  if (h === "activation required at") return { meaning: "Deadline by which demand activation is required", format: "ISO 8601 timestamp with timezone", example: "2026-08-05T09:00:00+05:30", numberFormat: { type: "TEXT", pattern: "@" } }
  if (h === "headcount matched") return { meaning: "Number of required people already matched", format: "Whole number, zero or greater", example: "25", numberFormat: { type: "NUMBER", pattern: "0" } }
  if (h === "monthly wage inr") return { meaning: "Monthly wage offered per person", format: "Number in INR; no ₹ symbol", example: "18500", numberFormat: { type: "NUMBER", pattern: "#,##0" } }
  if (h === "latitude") return { meaning: "Site latitude in decimal degrees", format: "Decimal number from -90 to 90", example: "26.9124", numberFormat: { type: "NUMBER", pattern: "0.000000" } }
  if (h === "longitude") return { meaning: "Site longitude in decimal degrees", format: "Decimal number from -180 to 180", example: "75.7873", numberFormat: { type: "NUMBER", pattern: "0.000000" } }
  if (/(^| )id$/.test(h)) return { meaning: `Stable unique identifier for ${h.replace(/ id$/, "") || "this record"}`, format: "Unique text ID; never reuse an ID for a different record", example: `${String(header).split(/[_ ]/)[0].toUpperCase()}-001`, numberFormat: { type: "TEXT", pattern: "@" } }
  if (/( at| timestamp|updated at|reported at|uploaded at|verified at|due at)$/.test(h)) return { meaning: `Date and time for ${h.replace(/ at$/, "")}`, format: "ISO 8601 timestamp with timezone", example: "2026-07-29T14:30:00+05:30", numberFormat: { type: "TEXT", pattern: "@" } }
  if (h === "date" || / date$/.test(h)) return { meaning: `Calendar date for ${h}`, format: "Date as YYYY-MM-DD", example: "2026-07-29", numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } }
  if (/(amount|cost|revenue|rent|deposit|wage|value|price|cm|impact)/.test(h)) return { meaning: `Numeric value for ${h}`, format: "Number only; do not type currency symbols", example: "12500", numberFormat: { type: "NUMBER", pattern: "#,##0.00" } }
  if (/(count|nests|headcount|quantity|stock|members|orders|units|room)/.test(h)) return { meaning: `Count for ${h}`, format: "Whole number, zero or greater", example: "25", numberFormat: { type: "NUMBER", pattern: "0" } }
  if (/(ratio|percent|occupancy %|cm%|attach)/.test(h)) return { meaning: `Percentage/rate for ${h}`, format: "Percentage; enter 75% or 0.75", example: "75%", numberFormat: { type: "PERCENT", pattern: "0.0%" } }
  if (/(status|state|stage|certainty|type|domain|severity|confidence)/.test(h)) return { meaning: `Approved status/category for ${h}`, format: "Short controlled text matching the process vocabulary", example: h.includes("status") ? "Open" : "Operations", numberFormat: { type: "TEXT", pattern: "@" } }
  if (/(phone|mobile|number)/.test(h)) return { meaning: `Contact/reference value for ${h}`, format: "Text; phone numbers should include country code where available", example: "+919876543210", numberFormat: { type: "TEXT", pattern: "@" } }
  if (/(email|mail)/.test(h)) return { meaning: `Email address for ${h}`, format: "Valid email address", example: "name@company.com", numberFormat: { type: "TEXT", pattern: "@" } }
  return { meaning: `User-provided value for ${String(header).replaceAll("_", " ")}`, format: "Plain text; use the same naming convention as existing rows", example: "Enter verified value", numberFormat: { type: "TEXT", pattern: "@" } }
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const results = []

  for (const spreadsheetId of BOOKS) {
    let metadata = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: true, fields: "properties.title,sheets(properties(sheetId,title,gridProperties),data.rowData.values(userEnteredValue,userEnteredFormat.backgroundColor))" })
    const existingGuide = (metadata.data.sheets || []).find((sheet) => sheet.properties.title === GUIDE)
    if (!existingGuide) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: GUIDE } } }] } })
      metadata = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: true, fields: "properties.title,sheets(properties(sheetId,title,gridProperties),data.rowData.values(userEnteredValue,userEnteredFormat.backgroundColor))" })
    }
    const guide = metadata.data.sheets.find((sheet) => sheet.properties.title === GUIDE)
    const guideRows = [["TAB", "COLUMN", "FIELD", "WHAT TO ENTER", "REQUIRED FORMAT", "EXAMPLE", "COLOR RULE"]]
    const requests = []
    for (const sheet of metadata.data.sheets || []) {
      if (sheet.properties.title === GUIDE) continue
      const rows = sheet.data?.[0]?.rowData || []
      const headerRowIndex = rows.findIndex((row) => (row.values || []).filter((cell) => String(cell.userEnteredValue?.stringValue || cell.userEnteredValue?.numberValue || "").trim()).length >= 1 && (row.values || []).some((cell) => isBlack(cell.userEnteredFormat?.backgroundColor)))
      if (headerRowIndex < 0) continue
      const cells = rows[headerRowIndex].values || []
      cells.forEach((cell, columnIndex) => {
        const header = cell.userEnteredValue?.stringValue || String(cell.userEnteredValue?.numberValue || "")
        if (!header || !isBlack(cell.userEnteredFormat?.backgroundColor)) return
        const info = instruction(header)
        const note = `BLACK = USER INPUT\nWhat to enter: ${info.meaning}\nRequired format: ${info.format}\nExample: ${info.example}`
        requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: headerRowIndex, endRowIndex: headerRowIndex + 1, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 }, cell: { note }, fields: "note" } })
        requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: headerRowIndex + 1, endRowIndex: Math.min(sheet.properties.gridProperties?.rowCount || 1000, headerRowIndex + 1000), startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 }, cell: { userEnteredFormat: { numberFormat: info.numberFormat } }, fields: "userEnteredFormat.numberFormat" } })
        guideRows.push([sheet.properties.title, columnLetter(columnIndex), header, info.meaning, info.format, info.example, "BLACK = fill/update"])
      })
    }
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${GUIDE}!A:G` })
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${GUIDE}!A1`, valueInputOption: "RAW", requestBody: { values: guideRows } })
    requests.push({ updateSheetProperties: { properties: { sheetId: guide.properties.sheetId, tabColorStyle: { rgbColor: RED }, gridProperties: { frozenRowCount: 1 } }, fields: "tabColorStyle,gridProperties.frozenRowCount" } })
    requests.push({ repeatCell: { range: { sheetId: guide.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 }, cell: { userEnteredFormat: { backgroundColor: RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: "RED reference tab: read only; do not edit." }, fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy),note" } })
    requests.push({ repeatCell: { range: { sheetId: guide.properties.sheetId, startRowIndex: 1, endRowIndex: guideRows.length, startColumnIndex: 0, endColumnIndex: 7 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } }, fields: "userEnteredFormat(wrapStrategy,verticalAlignment)" } })
    requests.push({ autoResizeDimensions: { dimensions: { sheetId: guide.properties.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 7 } } })
    for (let index = 0; index < requests.length; index += 400) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(index, index + 400) } })
    results.push({ title: metadata.data.properties.title, guideRows: guideRows.length - 1, notesAndFormatsApplied: (requests.length - 4) / 2 })
  }
  console.log(JSON.stringify({ success: true, results }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
