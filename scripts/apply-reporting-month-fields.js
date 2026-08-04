require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const APPLY = process.argv.includes("--apply")
const HEADER = "reporting month"
const BLACK = { red: 0.03, green: 0.03, blue: 0.03 }
const WHITE = { red: 1, green: 1, blue: 1 }
const normal = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
const validMonth = (value) => /^(20\d{2})-(0[1-9]|1[0-2])$/.test(String(value ?? "").trim())
const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date())

const inputSpecs = [
  { tab: "TEAM_OCCUPANCY", anchors: ["studio code", "activation ready nests"], dates: ["as of at", "source updated at"], required: true },
  { tab: "TEAM_REQ_SP_SUPPLY", anchors: ["sp supply id", "site name"], dates: ["as of at", "updated at"], required: true },
  { tab: "TEAM_FINANCE_DAILY", anchors: ["business date", "theatre id"], dates: ["business date", "date", "decision due at"], required: true },
  { tab: "TEAM_MEMBER_ACTIVATION", anchors: ["member token", "activated at"], dates: ["activated at", "verified at"], required: true },
  { tab: "TEAM_MEMBER_FEEDBACK", anchors: ["member token", "score", "collected at"], dates: ["collected at"], required: true },
  { tab: "TEAM_REQ_PEOPLE_ROSTER", anchors: ["display name", "role"], dates: ["shift start at", "shift end at", "updated at"], required: false },
  { tab: "TEAM_ENTERPRISE_OUTCOMES", anchors: ["demand reference", "action / outcome"], dates: ["recorded at", "verified at", "due at"], required: true },
  { tab: "TEAM_NIA_GROWTH", anchors: ["growth record id", "supply model"], dates: ["readiness verified at", "action due at"], required: true },
  { tab: "TEAM_OWNER_REGISTRY", anchors: ["assignment id", "owner name"], dates: ["effective from", "effective to"], required: false },
  { tab: "TEAM_LEARNING_HISTORY", anchors: ["domain", "observed"], dates: ["proposed at", "observed at", "updated at"], required: true },
  { tab: "TEAM_REQ_POLICY_REGISTRY", anchors: ["policy id", "status"], dates: ["effective from", "effective to", "updated at"], required: true },
  { tab: "TEAM_REQ_INCIDENT_LOG", anchors: ["incident id", "state"], dates: ["detected at", "opened at", "created at", "updated at"], required: true },
  { tab: "TEAM_REQ_ACTION_LOG", anchors: ["action id", "state"], dates: ["proposed at", "due at", "created at", "updated at"], required: true },
  { tab: "TEAM_REQ_EVIDENCE_LOG", anchors: ["evidence id", "verification status"], dates: ["captured at", "verified at", "created at", "updated at"], required: true },
  { tab: "TEAM_REQ_APPROVAL_LOG", anchors: ["approval id", "decision"], dates: ["proposed at", "approved at", "created at", "updated at"], required: true },
]

const backendSpecs = [
  { tab: "Finance_Daily", dates: ["business date", "date", "captured at"], required: true },
  { tab: "Member_Activation", dates: ["activated at", "verified at", "updated at"], required: true },
  { tab: "People_Roster", dates: ["shift start at", "updated at"] },
  { tab: "Learning_History", dates: ["proposed at", "observed at", "updated at"], required: true },
  { tab: "Policy_Registry", dates: ["effective from", "updated at"], required: true },
  { tab: "Incident_Log", dates: ["detected at", "opened at", "created at", "updated at"], required: true },
  { tab: "Action_Log", dates: ["proposed at", "due at", "created at", "updated at"], required: true },
  { tab: "Evidence_Log", dates: ["captured at", "verified at", "created at", "updated at"], required: true },
  { tab: "Approval_Log", dates: ["proposed at", "approved at", "created at", "updated at"], required: true },
  { tab: "Living_Hourly", dates: ["captured at", "business date", "updated at"], required: true },
  { tab: "Studio_Master", dates: ["activation date", "updated at"] },
  { tab: "Member_NPS_Responses", dates: ["collected at", "month"], required: true },
  { tab: "Member_NPS_Feedback", dates: ["captured at", "created at", "updated at"], required: true },
  { tab: "Member_NPS_Dashboard", dates: ["month", "as of", "updated at"], required: true },
  { tab: "Enterprise_Demand", dates: ["opened at", "activation required at", "updated at"], required: true },
  { tab: "Owner_Registry", dates: ["updated at"] },
]

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

function columnName(index) {
  let value = index + 1, output = ""
  while (value) { const remainder = (value - 1) % 26; output = String.fromCharCode(65 + remainder) + output; value = Math.floor((value - 1) / 26) }
  return output
}

function monthFrom(value) {
  const text = String(value ?? "").trim()
  if (!text) return null
  const iso = text.match(/^(20\d{2})[-/](0?[1-9]|1[0-2])(?:$|[-/T ])/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`
  const indian = text.match(/^(?:0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})/)
  if (indian) return `${indian[2]}-${indian[1].padStart(2, "0")}`
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return null
  const date = new Date(parsed)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function findHeaderIndex(rows, anchors) {
  return rows.findIndex((row) => { const values = new Set(row.map(normal)); return anchors.every((anchor) => values.has(normal(anchor))) })
}

async function configureSpreadsheet(sheets, spreadsheetId, specs, input) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))" })
  const properties = new Map((metadata.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties]))
  const ranges = specs.map((spec) => `'${spec.tab}'!A1:AZ`)
  const values = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges })
  const requests = []
  const writes = []
  const results = []

  specs.forEach((spec, specIndex) => {
    const property = properties.get(spec.tab)
    const rows = values.data.valueRanges?.[specIndex]?.values || []
    if (!property) { results.push({ tab: spec.tab, status: "missing tab" }); return }
    const headerIndex = input ? findHeaderIndex(rows.slice(0, 8), spec.anchors) : 0
    if (headerIndex < 0 || !rows[headerIndex]?.length) { results.push({ tab: spec.tab, status: "missing header" }); return }
    const headers = rows[headerIndex].map(String)
    let monthIndex = headers.findIndex((header) => normal(header) === HEADER)
    const added = monthIndex < 0
    if (added) monthIndex = headers.length
    const requiredColumns = monthIndex + 1
    if ((property.gridProperties?.columnCount || 0) < requiredColumns) requests.push({ appendDimension: { sheetId: property.sheetId, dimension: "COLUMNS", length: requiredColumns - property.gridProperties.columnCount } })
    if (added) writes.push({ range: `'${spec.tab}'!${columnName(monthIndex)}${headerIndex + 1}`, values: [[HEADER]] })

    const normalizedHeaders = [...headers]
    normalizedHeaders[monthIndex] = HEADER
    const dateIndexes = spec.dates.map((date) => normalizedHeaders.findIndex((header) => normal(header) === normal(date))).filter((index) => index >= 0)
    let backfilled = 0, defaulted = 0, unresolved = 0, invalid = 0
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      if (!row.some((cell) => String(cell ?? "").trim()) || row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell ?? "")))) return
      const existing = row[monthIndex]
      if (validMonth(existing)) return
      if (String(existing ?? "").trim()) { invalid++; return }
      let month = dateIndexes.map((index) => monthFrom(row[index])).find(Boolean)
      if (!month && spec.required) { month = currentMonth; defaulted++ }
      if (!month) { unresolved++; return }
      writes.push({ range: `'${spec.tab}'!${columnName(monthIndex)}${headerIndex + 2 + offset}`, values: [[month]] })
      backfilled++
    })

    if (input) {
      const startRow = headerIndex + 2
      const column = columnName(monthIndex)
      const formula = spec.required
        ? `=OR(COUNTA($A${startRow}:$AZ${startRow})=0,AND($${column}${startRow}<>"",REGEXMATCH(TO_TEXT($${column}${startRow}),"^20[0-9]{2}-(0[1-9]|1[0-2])$")))`
        : `=OR($${column}${startRow}="",REGEXMATCH(TO_TEXT($${column}${startRow}),"^20[0-9]{2}-(0[1-9]|1[0-2])$"))`
      requests.push(
        { repeatCell: { range: { sheetId: property.sheetId, startRowIndex: headerIndex, endRowIndex: headerIndex + 1, startColumnIndex: monthIndex, endColumnIndex: monthIndex + 1 }, cell: { note: `${spec.required ? "REQUIRED" : "OPTIONAL FOR MASTER DATA"} — Enter reporting month as YYYY-MM, for example 2026-08. This field controls the dashboard month filter.`, userEnteredFormat: { backgroundColor: BLACK, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" } }, fields: "note,userEnteredFormat" } },
        { repeatCell: { range: { sheetId: property.sheetId, startRowIndex: headerIndex + 1, endRowIndex: property.gridProperties?.rowCount || 1000, startColumnIndex: monthIndex, endColumnIndex: monthIndex + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } }, fields: "userEnteredFormat.numberFormat" } },
        { setDataValidation: { range: { sheetId: property.sheetId, startRowIndex: headerIndex + 1, endRowIndex: property.gridProperties?.rowCount || 1000, startColumnIndex: monthIndex, endColumnIndex: monthIndex + 1 }, rule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: formula }] }, inputMessage: "Use YYYY-MM only, for example 2026-08.", strict: true, showCustomUi: true } } },
        { updateDimensionProperties: { range: { sheetId: property.sheetId, dimension: "COLUMNS", startIndex: monthIndex, endIndex: monthIndex + 1 }, properties: { pixelSize: 135 }, fields: "pixelSize" } },
      )
    }
    results.push({ tab: spec.tab, status: APPLY ? "applied" : "dry-run", headerRow: headerIndex + 1, column: columnName(monthIndex), required: Boolean(spec.required), added, backfilled, defaulted, unresolved, invalid })
  })

  if (APPLY && requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  if (APPLY && writes.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: writes } })
  return { results, writes: writes.length, requests: requests.length }
}

async function main() {
  const inputId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const backendId = process.env.GOOGLE_SHEET_ID
  if (!inputId || !backendId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID and GOOGLE_SHEET_ID are required")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const input = await configureSpreadsheet(sheets, inputId, inputSpecs, true)
  const backend = await configureSpreadsheet(sheets, backendId, backendSpecs, false)
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", format: "YYYY-MM", currentMonthFallback: currentMonth, input, backend }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
