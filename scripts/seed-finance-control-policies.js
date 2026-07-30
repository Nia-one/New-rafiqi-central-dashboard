require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TAB = "Policy_Registry"
const POLICIES = [
  ["POL-FINANCE-MODE-TEST", "Finance operating mode", "Shadow only", "mode", "Priya Rao (Test)", "TEST DATA - read-only Finance operating mode"],
  ["POL-OPEX-CAP-TEST", "Monthly opex cap", 120000, "INR/month", "Priya Rao (Test)", "TEST DATA - Finance control threshold"],
  ["POL-CASH-GUARD-TEST", "Minimum cash guardrail", 150000, "INR", "Priya Rao (Test)", "TEST DATA - Finance control threshold"],
  ["POL-HIRING-TEST", "Hiring state", "Frozen", "state", "Priya Rao (Test)", "TEST DATA - Finance hiring control"],
  ["POL-PROPOSED-HIRES-TEST", "Proposed new hires", 0, "people", "Priya Rao (Test)", "TEST DATA - no proposed hires recorded"],
]

async function main() {
  const credentialsPath = path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json")
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is not configured")

  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:I` })
  const rows = response.data.values || []
  const headers = rows[0] || []
  const required = ["policy id", "policy name", "policy value", "unit", "effective from", "approved by", "status", "source note", "updated at"]
  if (required.some((header, index) => headers[index] !== header)) throw new Error(`${TAB} headers do not match the governed schema`)

  const existing = new Map(rows.slice(1).map((row, index) => [String(row[0] || ""), index + 2]))
  const now = new Date().toISOString()
  const values = POLICIES.map(([id, name, value, unit, approver, note]) => [id, name, value, unit, "2026-07-28", approver, "Active", note, now])
  for (const row of values) {
    const rowIndex = existing.get(row[0])
    if (rowIndex) {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${TAB}!A${rowIndex}:I${rowIndex}`, valueInputOption: "RAW", requestBody: { values: [row] } })
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `${TAB}!A:I`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [row] } })
    }
  }
  console.log(JSON.stringify({ tab: TAB, upserted: values.map((row) => row[0]) }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
