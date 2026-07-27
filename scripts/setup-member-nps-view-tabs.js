require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")

const feedbackHeaders = ["id", "action id", "member token", "pillar", "category", "theatre", "studio", "summary", "captured at", "source", "exit risk", "raw conversation ref", "nps response id"]
const feedbackRows = [
  ["NPS-FB-001", "feedback-action-housekeeping", "Member 4C21", "Living", "Housekeeping", "Deccan (Pune)", "Chakan 04", "Housekeeping was missed twice this week.", "2026-07-24T09:00:00+05:30", "Monthly NPS", "Immediate attention", "restricted://conversation/NPS-FB-001", "NPS-RESP-007"],
  ["NPS-FB-002", "feedback-action-replacement", "Member 8H07", "Work", "Job continuity", "Wellington (Karnataka)", "Hosur 01", "The Member needs a new placement after a work exit.", "2026-07-24T08:00:00+05:30", "Monthly NPS", "Immediate attention", "restricted://conversation/NPS-FB-002", "NPS-RESP-008"],
  ["NPS-FB-003", "feedback-action-curry-quality", "Member 9S14", "Essentials", "Curry quality", "Coromandel (Tamil Nadu)", "Sriperumbudur 02", "Curry quality needs a verified replacement batch.", "2026-07-24T07:00:00+05:30", "Chatbot", "Watch closely", "restricted://conversation/NPS-FB-003", ""],
]

const responseHeaders = ["id", "member token", "score", "follow up text", "collected at", "month", "theatre", "studio"]
const responseRows = [
  ["NPS-RESP-001", "Member A01", 9, "", "2026-05-04T10:00:00+05:30", "2026-05", "Deccan (Pune)", "Chakan 04"],
  ["NPS-RESP-002", "Member A02", 7, "More predictable housekeeping.", "2026-05-11T10:00:00+05:30", "2026-05", "Wellington (Karnataka)", "Hosur 01"],
  ["NPS-RESP-003", "Member A03", 5, "Improve Curry availability.", "2026-05-18T10:00:00+05:30", "2026-05", "Coromandel (Tamil Nadu)", "Sriperumbudur 02"],
  ["NPS-RESP-004", "Member B01", 9, "", "2026-06-05T10:00:00+05:30", "2026-06", "Deccan (Pune)", "Chakan 04"],
  ["NPS-RESP-005", "Member B02", 6, "Faster work matching.", "2026-06-12T10:00:00+05:30", "2026-06", "Wellington (Karnataka)", "Hosur 01"],
  ["NPS-RESP-006", "Member B03", 8, "", "2026-06-19T10:00:00+05:30", "2026-06", "Coromandel (Tamil Nadu)", "Sriperumbudur 02"],
  ["NPS-RESP-007", "Member 4C21", 4, "Keep housekeeping predictable.", "2026-07-06T10:00:00+05:30", "2026-07", "Deccan (Pune)", "Chakan 04"],
  ["NPS-RESP-008", "Member 8H07", 3, "Help me find work again.", "2026-07-12T10:00:00+05:30", "2026-07", "Wellington (Karnataka)", "Hosur 01"],
  ["NPS-RESP-009", "Member 9S14", 8, "", "2026-07-18T10:00:00+05:30", "2026-07", "Coromandel (Tamil Nadu)", "Sriperumbudur 02"],
]

async function ensureSheet(sheets, spreadsheetId, title, headers, rows) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === title)) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } })
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:Z` })).data.values || []
  if (!current.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers, ...rows] } })
  else {
    const ids = new Set(current.slice(1).map((row) => row[0]))
    const missing = rows.filter((row) => !ids.has(row[0]))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A:Z`, valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  }
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  await ensureSheet(sheets, process.env.GOOGLE_SHEET_ID, "Member_NPS_Feedback", feedbackHeaders, feedbackRows)
  await ensureSheet(sheets, process.env.GOOGLE_SHEET_ID, "Member_NPS_Responses", responseHeaders, responseRows)
  console.log("Member NPS view data tabs are ready.")
}
main().catch((error) => { console.error(error); process.exit(1) })
