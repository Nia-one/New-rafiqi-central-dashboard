/* Creates the Work copy tab used to make all Work page wording Sheet-driven. */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")
const headers = ["section", "key", "label", "value number", "value text", "owner actor id", "studio id", "supply model", "updated at", "notes"]
const now = "2026-07-24T18:30:00+05:30"
const rows = [
  ["Work empty", "work_empty_accordion_title", "Empty accordion title", 0, "Work data requirement", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work empty", "work_empty_accordion_summary", "Empty accordion summary", 0, "The Work data feed is not connected yet.", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work empty", "work_empty_kicker", "Empty kicker", 0, "WORK · DATA REQUIREMENT", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work empty", "work_empty_title", "Empty title", 0, "The Work data feed is not connected yet.", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work empty", "work_empty_description", "Empty description", 0, "When connected, this page will show ARPU (average revenue per Member) by Studio. It will also show each enterprise or employer's share. Missing data will stay blank, not become zero.", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work empty", "work_required_fields_title", "Required fields label", 0, "Required source fields", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work live", "work_live_accordion_title", "Live accordion title", 0, "Work performance", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work live", "work_live_accordion_summary", "Live accordion summary", 0, "{recordCount} live Studio record(s) loaded from Work_Hourly.", "ACT-PRIYA", "", "", now, "Token: {recordCount}"],
  ["Work live", "work_live_kicker", "Live kicker", 0, "WORK · LIVE PERFORMANCE", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work live", "work_live_title", "Live title", 0, "ARPU by Studio and employer revenue share.", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work live", "work_live_intro", "Live introduction", 0, "All measures below are calculated from the connected Work_Hourly rows for the selected period.", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work metrics", "work_active_members_label", "Active members label", 0, "ACTIVE MEMBERS", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work metrics", "work_active_members_detail", "Active members detail", 0, "Across {recordCount} live Studio record(s)", "ACT-PRIYA", "", "", now, "Token: {recordCount}"],
  ["Work metrics", "work_revenue_label", "Revenue label", 0, "WORK REVENUE", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work metrics", "work_revenue_detail", "Revenue detail", 0, "Reported for the selected period", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work metrics", "work_arpu_label", "ARPU label", 0, "AVERAGE ARPU", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work metrics", "work_arpu_detail", "ARPU detail", 0, "Work revenue ÷ active Members", "ACT-PRIYA", "", "", now, "Operations editable copy"],
  ["Work table", "work_table_caption", "Table caption", 0, "Live Work revenue by Studio", "ACT-PRIYA", "", "", now, "Operations editable copy"],
]
async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth }), spreadsheetId = process.env.GOOGLE_SHEET_ID
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  let sheet = metadata.data.sheets?.find((item) => item.properties?.title === "Work_Dashboard")
  if (!sheet) { await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "Work_Dashboard" } } }] } }); sheet = (await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })).data.sheets?.find((item) => item.properties?.title === "Work_Dashboard") }
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Work_Dashboard!A:J" })).data.values || []
  if (!current.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "Work_Dashboard!A1:J1", valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } })
  const existingKeys = new Set(current.slice(1).map((row) => row[1]))
  const missing = rows.filter((row) => !existingKeys.has(row[1]))
  if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "Work_Dashboard!A:J", valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  console.log(`Work_Dashboard ready; added ${missing.length} editable copy rows.`)
}
main().catch((error) => { console.error(error.message); process.exit(1) })
