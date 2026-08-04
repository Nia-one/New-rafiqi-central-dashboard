require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const inputId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const backendId = process.env.GOOGLE_SHEET_ID
const tabs = ["TEAM_OCCUPANCY", "Fono Funnel", "TEAM_REQ_SP_SUPPLY", "TEAM_FINANCE_DAILY", "TEAM_MEMBER_ACTIVATION", "TEAM_MEMBER_FEEDBACK", "TEAM_REQ_PEOPLE_ROSTER", "TEAM_ENTERPRISE_OUTCOMES", "TEAM_NIA_GROWTH", "TEAM_OWNER_REGISTRY", "TEAM_LEARNING_HISTORY"]
const sample = (value) => /SAMPLE.*DO.NOT.SYNC/i.test(String(value || ""))
const credentials = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

async function main() {
  if (!inputId || !backendId) throw new Error("Google Sheet IDs are missing")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const input = await sheets.spreadsheets.values.batchGet({ spreadsheetId: inputId, ranges: tabs.map((tab) => `'${tab}'!A:AZ`) })
  const counts = Object.fromEntries(tabs.map((tab, index) => [tab, (input.data.valueRanges?.[index]?.values || []).filter((row) => row.some(sample)).length]))
  const invalid = Object.entries(counts).filter(([, count]) => count !== 1)
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: backendId, fields: "sheets.properties.title" })
  const backendTabs = (metadata.data.sheets || []).map((item) => item.properties.title).filter(Boolean)
  const backend = await sheets.spreadsheets.values.batchGet({ spreadsheetId: backendId, ranges: backendTabs.map((tab) => `'${String(tab).replace(/'/g, "''")}'!A:AZ`) })
  const leaked = backendTabs.filter((tab, index) => (backend.data.valueRanges?.[index]?.values || []).some((row) => row.some(sample)))
  if (invalid.length || leaked.length) throw new Error(`Sample verification failed: invalid=${JSON.stringify(invalid)} leaked=${JSON.stringify(leaked)}`)
  console.log(JSON.stringify({ sampleRows: counts, backendLeaks: leaked, verified: true }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
