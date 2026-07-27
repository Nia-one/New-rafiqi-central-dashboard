/* Seeds visible TEST DATA for the Self Drive > Member Engagement headline cards. */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")
const now = "2026-07-26T17:30:00+05:30"
const rows = [
  ["Member engagement headline", "member_engagement_m6_retention_pct", "M6 retention", 68, "", "ACT-PRIYA", "", "", now, "TEST DATA · percent · monthly cohort observation"],
  ["Member engagement headline", "member_engagement_monthly_churn_pct", "Monthly churn", 5.5, "", "ACT-PRIYA", "", "", now, "TEST DATA · percent · monthly observation"],
  ["Member engagement headline", "member_engagement_exit_reasons_verified", "Verified exit reasons", 2, "", "ACT-PRIYA", "", "", now, "TEST DATA · independently verified count"],
  ["Member engagement headline", "member_engagement_exit_reasons_claimed", "Exit reasons claimed", 3, "", "ACT-PRIYA", "", "", now, "TEST DATA · recorded claim count"],
  ["Member engagement headline", "member_engagement_at_risk_recovered", "At-risk Members recovered", 8, "", "ACT-PRIYA", "", "", now, "TEST DATA · recovered Member count"],
  ["Member engagement headline", "member_engagement_at_risk_total", "At-risk recovery target", 20, "", "ACT-PRIYA", "", "", now, "TEST DATA · target Member count"],
  ["Member engagement headline", "member_engagement_interventions", "Interventions assigned", 14, "", "ACT-PRIYA", "", "", now, "TEST DATA · assigned intervention count"],
  ["Member engagement headline", "member_engagement_recovery_awaiting", "Recovery awaiting verification", 3, "", "ACT-PRIYA", "", "", now, "TEST DATA · awaiting independent verification"],
  ["Member engagement headline", "member_engagement_recovery_reopened", "Recovery reopened", 1, "", "ACT-PRIYA", "", "", now, "TEST DATA · reopened recovery count"],
  ["Member engagement headline", "member_engagement_closure_rule", "Closure rule", 0, "A recovery counts only when independent evidence confirms the Member outcome.", "ACT-PRIYA", "", "", now, "TEST DATA · governed display copy"],
  ["Member engagement background", "member_engagement_survey_nps_score", "Survey NPS", 41, "", "ACT-PRIYA", "", "", now, "TEST DATA · NPS score from approved survey responses"],
  ["Member engagement background", "member_engagement_survey_nps_responses", "Survey responses", 32, "", "ACT-PRIYA", "", "", now, "TEST DATA · recorded response count"],
  ["Member engagement background", "member_engagement_survey_nps_method", "Survey NPS method", 0, "Approved survey responses only", "ACT-PRIYA", "", "", now, "TEST DATA · governed method copy"],
  ["Member engagement background", "member_engagement_behavioural_nps_score", "Behavioural NPS", 34, "", "ACT-PRIYA", "", "", now, "TEST DATA · derived behavioural score"],
  ["Member engagement background", "member_engagement_behavioural_nps_records", "Behavioural Member records", 57, "", "ACT-PRIYA", "", "", now, "TEST DATA · protected record count"],
  ["Member engagement background", "member_engagement_behavioural_nps_weeks", "Behavioural observation window", 6, "", "ACT-PRIYA", "", "", now, "TEST DATA · weeks"],
  ["Member engagement background", "member_engagement_behavioural_nps_method", "Behavioural NPS method", 0, "Composite of own-baseline usage and verified service recovery", "ACT-PRIYA", "", "", now, "TEST DATA · governed method copy"],
  ["Member engagement background", "member_engagement_exit_reason_service_friction", "Service friction", 5, "3", "ACT-PRIYA", "", "", now, "TEST DATA · current count; baseline in value text"],
  ["Member engagement background", "member_engagement_exit_reason_work_migration", "Work migration", 3, "4", "ACT-PRIYA", "", "", now, "TEST DATA · current count; baseline in value text"],
  ["Member engagement background", "member_engagement_exit_reason_savings_pressure", "Savings pressure", 3, "2", "ACT-PRIYA", "", "", now, "TEST DATA · current count; baseline in value text"],
  ["Member engagement background", "member_engagement_forecast_error", "Forecast error", 0, "8%", "ACT-PRIYA", "", "", now, "TEST DATA · display value"],
  ["Member engagement cohorts", "member_engagement_retention_2026_01", "Jan 2026", 52, "100,94,89,84,79,73,68", "ACT-PRIYA", "", "", now, "TEST DATA · member count in value number; M0-M6 percentages in value text"],
  ["Member engagement cohorts", "member_engagement_retention_2026_02", "Feb 2026", 48, "100,93,89,85,81,76,70", "ACT-PRIYA", "", "", now, "TEST DATA · member count in value number; M0-M6 percentages in value text"],
  ["Member engagement cohorts", "member_engagement_retention_2026_03", "Mar 2026", 57, "100,95,91,87,83,78,72", "ACT-PRIYA", "", "", now, "TEST DATA · member count in value number; M0-M6 percentages in value text"],
]
async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth }), spreadsheetId = process.env.GOOGLE_SHEET_ID
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Member_NPS_Dashboard!A:J" })).data.values || []
  const rowByKey = new Map(current.slice(1).map((row, index) => [row[1], index + 2]))
  const updates = rows.filter((row) => rowByKey.has(row[1])).map((row) => ({ range: `Member_NPS_Dashboard!A${rowByKey.get(row[1])}:J${rowByKey.get(row[1])}`, values: [row] }))
  const missing = rows.filter((row) => !rowByKey.has(row[1]))
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } })
  if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "Member_NPS_Dashboard!A:J", valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  console.log(`Member Engagement headline seed ready: ${rows.length} rows.`)
}
main().catch((error) => { console.error(error); process.exit(1) })
