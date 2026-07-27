/* Seeds linked TEST DATA for Self Drive > Member Engagement > Members needing action. */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")
const now = "2026-07-26T18:30:00+05:30"
const incidents = [
  ["ME-INC-REPEAT-001", "Member Engagement", "Recurring Member issue", now, "CRM", "CRM-SRI-D01-S01", "", "", "Repeated housekeeping friction is affecting Member recovery", "1", "0", "12000", "High", "The same housekeeping failure has returned and recovery evidence is still pending", "ACT-PRIYA", "2026-07-27T15:00:00+05:30", "Recover repeated housekeeping friction", "FALSE", "", "", "", "", "Open", "", "", "ACT-PRIYA", now],
  ["ME-INC-REPEAT-002", "Member Engagement", "Recurring Member issue", now, "CRM", "CRM-SRI-D01-S09", "", "", "Recurring work-continuity interruption needs recovery", "1", "0", "18000", "Medium", "The Member needs a new verified placement after a work exit", "ACT-PRIYA", "2026-07-27T16:00:00+05:30", "Restore verified work continuity", "FALSE", "", "", "", "", "Open", "", "", "ACT-PRIYA", now],
  ["ME-INC-REPEAT-003", "Member Engagement", "Recurring Member issue", now, "CRM", "CRM-SRI-D01-S08", "", "", "Recurring curry-quality complaint reopened after failed evidence", "1", "0", "9000", "High", "Replacement evidence did not confirm the service-quality recovery", "ACT-PRIYA", "2026-07-27T17:00:00+05:30", "Recover the verified service-quality outcome", "FALSE", "", "", "", "", "Reopened", "", "", "ACT-PRIYA", now],
]
const actions = [
  ["feedback-action-housekeeping", "ME-INC-REPEAT-001", "Recover repeated housekeeping friction", "Verified Member recovery", "0", "1", "12000", "Confirmed", "ACT-PRIYA", "2026-07-27T15:00:00+05:30", "Source recovery evidence", "None", "Proof submitted", now, "", "", now, now, now, "ME-EVD-TEST-001", "", "", "Awaiting independent evidence review", "", "", "", "", "", "TEST DATA", now],
  ["feedback-action-replacement", "ME-INC-REPEAT-002", "Restore verified work continuity", "Verified Member recovery", "0", "1", "18000", "Confirmed", "ACT-PRIYA", "2026-07-27T16:00:00+05:30", "Verified placement or billing continuity", "None", "Assigned", now, "", "", now, "", "", "", "", "", "Not yet verified", "", "", "", "", "", "TEST DATA", now],
  ["feedback-action-curry-quality", "ME-INC-REPEAT-003", "Recover the verified service-quality outcome", "Verified Member recovery", "0", "1", "9000", "Confirmed", "ACT-PRIYA", "2026-07-27T17:00:00+05:30", "Verified replacement-batch evidence", "None", "Reopened", now, "", "", now, now, now, "ME-EVD-TEST-003", "", "", "Reopened after evidence rejection", "", now, "Replacement evidence did not confirm recovery", "", "", "TEST DATA", now],
]
const evidence = [
  ["ME-EVD-TEST-001", "Action", "feedback-action-housekeeping", "Recovery evidence", "test://member-engagement/housekeeping", "ACT-PRIYA", now, "TEST DATA · housekeeping recovery evidence awaiting verification", "", "", "Pending", "", "Test", "TEST DATA", now],
  ["ME-EVD-TEST-003", "Action", "feedback-action-curry-quality", "Recovery evidence", "test://member-engagement/curry-quality", "ACT-PRIYA", now, "TEST DATA · replacement batch evidence", "", "", "Rejected", "Replacement evidence did not confirm recovery", "Test", "TEST DATA", now],
]
function columnName(count) {
  let result = ""
  while (count > 0) {
    count -= 1
    result = String.fromCharCode(65 + (count % 26)) + result
    count = Math.floor(count / 26)
  }
  return result
}
async function upsert(sheets, spreadsheetId, tab, keyColumn, rows) {
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` })).data.values || []
  const rowByKey = new Map(current.slice(1).map((row, index) => [row[keyColumn], index + 2]))
  const updates = rows.filter((row) => rowByKey.has(row[keyColumn])).map((row) => ({ range: `${tab}!A${rowByKey.get(row[keyColumn])}:${columnName(row.length)}${rowByKey.get(row[keyColumn])}`, values: [row] }))
  const missing = rows.filter((row) => !rowByKey.has(row[keyColumn]))
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } })
  if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${tab}!A:AZ`, valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
}
async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth }), spreadsheetId = process.env.GOOGLE_SHEET_ID
  await upsert(sheets, spreadsheetId, "Incident_Log", 0, incidents)
  await upsert(sheets, spreadsheetId, "Action_Log", 0, actions)
  await upsert(sheets, spreadsheetId, "Evidence_Log", 0, evidence)
  console.log(`Member Engagement repeat-issue seed ready: ${incidents.length} incidents, ${actions.length} actions and ${evidence.length} evidence rows.`)
}
main().catch((error) => { console.error(error); process.exit(1) })
