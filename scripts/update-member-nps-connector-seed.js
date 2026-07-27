/* One-time visible test seed for the Member NPS connector-status card. */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const rows = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Member_NPS_Dashboard!A:J" })).data.values || []
  const replacements = new Map([
    ["member_nps_connector_summary", "Google Sheet status loaded; chatbot and NPS connectors are pending."],
    ["member_nps_connector_headline", "Google Sheet is connected. External connectors are pending."],
    ["member_nps_connector_timestamp", "Google Sheet test data · 24 Jul, 20:00 IST"],
  ])
  const updates = rows.slice(1).flatMap((row, index) => {
    const value = replacements.get(row[1])
    return value ? [{ range: `Member_NPS_Dashboard!E${index + 2}`, values: [[value]] }] : []
  })
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } })
  console.log("Member NPS connector seed updated.")
}
main().catch((error) => { console.error(error); process.exit(1) })
