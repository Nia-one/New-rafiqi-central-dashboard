require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TAB = "Policy_Registry"
const POLICIES = [
  ["POL-RETENTION-M6-WARNING", "Member Engagement M6 retention floor", 65, "percent", "Member governance", "M6 cohort control"],
  ["POL-MONTHLY-CHURN-REFERENCE", "Member Engagement monthly churn control", 6, "percent", "Member governance", "Monthly churn control"],
  ["POL-MEMBER-ENGAGEMENT-VERIFIED-RECOVERY", "Member Engagement verified recovery evidence", 1, "independently verified outcome", "Member governance", "Recovery closure control"],
  ["POL-MEMBER-ENGAGEMENT-NO-AUTO-ACTION", "Member Engagement automatic external action", "Blocked", "capability", "System governance", "Read-only safety boundary"],
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
  if (required.some((header, index) => headers[index] !== header)) throw new Error(`${TAB} headers do not match the existing governed schema`)
  const existing = new Map(rows.slice(1).map((row, index) => [String(row[0] || ""), index + 2]))
  const now = new Date().toISOString()
  const values = POLICIES.map(([id, name, value, unit, approver, note]) => [id, name, value, unit, "2026-07-26", approver, "Active", note, now])
  for (const row of values) {
    const rowIndex = existing.get(row[0])
    if (rowIndex) {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${TAB}!A${rowIndex}:I${rowIndex}`, valueInputOption: "RAW", requestBody: { values: [row] } })
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `${TAB}!A:I`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [row] } })
    }
  }
  console.log(JSON.stringify({ tab: TAB, seededPolicies: values.map((row) => row[0]), component: "Self Drive > Member Engagement > Background record" }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
