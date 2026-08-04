require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const tabs = [
  "TEAM_OCCUPANCY", "Fono Funnel", "TEAM_REQ_SP_SUPPLY", "TEAM_FINANCE_DAILY",
  "TEAM_MEMBER_ACTIVATION", "TEAM_MEMBER_FEEDBACK", "TEAM_REQ_PEOPLE_ROSTER",
  "TEAM_ENTERPRISE_OUTCOMES", "TEAM_NIA_GROWTH", "TEAM_OWNER_REGISTRY", "TEAM_LEARNING_HISTORY",
]
const MARKER = "SAMPLE — DO NOT SYNC"
const PROTECTION = "RAFIQI_SAMPLE_ROW"
const norm = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

function example(header, tab, column) {
  const key = norm(header)
  if (column === 0 || /(^| )id$| id |record id|reference$/.test(` ${key} `)) return column === 0 ? `SAMPLE-DO-NOT-SYNC-${tab.replace(/[^A-Z0-9]+/gi, "-").toUpperCase()}` : "SAMPLE-REF-001"
  if (/date$|business date|effective from|effective to/.test(key)) return "04-08-2026"
  if (/ at$|timestamp|due at|start at|end at|verified at|updated at|activated at|collected at/.test(key)) return "04-08-2026 10:30"
  if (/url|proof|evidence|conversation ref/.test(key)) return "https://example.com/proof/sample-001"
  if (/email/.test(key)) return "sample@example.com"
  if (/phone|mobile/.test(key)) return "9876543210"
  if (/score/.test(key)) return 9
  if (/percent|%|ratio|occupancy/.test(key)) return 0.75
  if (/inr|revenue|cost|cash|opex|cm|amount|billing|billed|collected|wage|rent|price/.test(key)) return 125000
  if (/nest|headcount|member|stock|quantity|count|days|sla|potential/.test(key)) return 100
  if (/active shift/.test(key)) return "Active"
  if (/verification status/.test(key)) return "Verified"
  if (/approval|destination approved/.test(key)) return "Approved"
  if (/status|state|disposition/.test(key)) return "Active"
  if (/confidence/.test(key)) return "High"
  if (/supply model/.test(key)) return "FONO"
  if (/theatre/.test(key)) return "Coromandel"
  if (/studio/.test(key)) return "STUDIO-SAMPLE-01"
  if (/location|corridor/.test(key)) return "Sriperumbudur"
  if (/owner|actor|manager|verified by|reported by|acquirer/.test(key)) return "ACT-SAMPLE-OWNER"
  if (/role/.test(key)) return "Operations Owner"
  if (/language/.test(key)) return "Hindi"
  if (/pillar|vertical|domain/.test(key)) return "Living"
  if (/category/.test(key)) return "Service quality"
  if (/risk/.test(key)) return "Low"
  if (/feedback|observed|notes|reason|responsibility|outcome|change|effect|scope/.test(key)) return "Example text — replace with the actual observed value"
  if (/name|prospect|company|site/.test(key)) return "Sample Name"
  return MARKER
}

async function main() {
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const account = credentials()
  const auth = new google.auth.GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title,gridProperties),protectedRanges(protectedRangeId,description))" })
  const byTitle = new Map((metadata.data.sheets || []).map((sheet) => [sheet.properties.title, sheet]))
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: tabs.map((tab) => `'${tab}'!A:AZ`), valueRenderOption: "FORMULA" })
  const writes = []
  const formatRequests = []
  const report = []

  for (const [index, tab] of tabs.entries()) {
    const sheet = byTitle.get(tab)
    if (!sheet) throw new Error(`Missing manual tab: ${tab}`)
    const rows = response.data.valueRanges?.[index]?.values || []
    const header = rows.reduce((best, row, rowIndex) => {
      const count = row.filter((cell) => String(cell || "").trim()).length
      return count > best.count ? { rowIndex, count, values: row.map(String) } : best
    }, { rowIndex: 0, count: 0, values: [] })
    if (!header.count) throw new Error(`${tab} has no header row`)
    const existing = rows.findIndex((row, rowIndex) => rowIndex > header.rowIndex && row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell || ""))))
    const lastUsed = rows.reduce((last, row, rowIndex) => row.some((cell) => String(cell || "").trim()) ? rowIndex : last, header.rowIndex)
    const rowIndex = existing >= 0 ? existing : lastUsed + 1
    const values = header.values.map((name, column) => example(name, tab, column))
    if (!values.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell)))) values[0] = `SAMPLE-DO-NOT-SYNC-${tab}`
    writes.push({ range: `'${tab}'!A${rowIndex + 1}`, values: [values] })
    formatRequests.push(
      { repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: values.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.92, green: 0.92, blue: 0.92 }, textFormat: { foregroundColor: { red: 0.2, green: 0.2, blue: 0.2 }, italic: true }, wrapStrategy: "WRAP" }, note: `${MARKER}. Format example only. This row is excluded from every dashboard/backend sync.` }, fields: "userEnteredFormat,note" } },
      { addProtectedRange: { protectedRange: { description: `${PROTECTION}: ${tab}`, range: { sheetId: sheet.properties.sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: values.length }, warningOnly: false, editors: { users: [account.client_email] } } } },
    )
    report.push({ tab, headerRow: header.rowIndex + 1, sampleRow: rowIndex + 1, columns: values.length })
  }

  for (const sheet of metadata.data.sheets || []) for (const protection of sheet.protectedRanges || []) {
    if (String(protection.description || "").startsWith(PROTECTION)) formatRequests.unshift({ deleteProtectedRange: { protectedRangeId: protection.protectedRangeId } })
  }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: writes } })
  for (let index = 0; index < formatRequests.length; index += 300) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formatRequests.slice(index, index + 300) } })
  console.log(JSON.stringify({ spreadsheetId, marker: MARKER, rows: report }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
