/* Creates the Sheet-backed content rows for the Member NPS connector-status card. */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")
const now = "2026-07-24T20:00:00+05:30"
const headers = ["section", "key", "label", "value number", "value text", "owner actor id", "studio id", "supply model", "updated at", "notes"]
const rows = [
  ["Connector status", "member_nps_connector_title", "Accordion title", 0, "Connector status", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Connector status", "member_nps_connector_summary", "Accordion summary", 0, "Capture is designed; chatbot and NPS connectors are not live.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Connector status", "member_nps_connector_headline", "Connector headline", 0, "Capture is designed. The connectors are not live yet.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Connector status", "member_nps_connector_detail", "Connector detail", 0, "Chatbot and NPS responses will create Member feedback actions in the shared execution log.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Connector status", "member_nps_connector_timestamp", "Data status timestamp", 0, "Illustrative operating data · 15 Jul, 14:00 IST", "ACT-PRIYA", "", "", now, "Update when an external connector is live"],
  ["Closure loop", "member_nps_closure_title", "Accordion title", 0, "Closure loop", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_summary", "Accordion summary", 0, "Member speaks · RafiQi structures · owner fixes · Despatch verifies", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_1", "Stage 1 label", 0, "Member speaks", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_1_note", "Stage 1 note", 0, "Natural conversation", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_2", "Stage 2 label", 0, "RafiQi structures", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_2_note", "Stage 2 note", 0, "Pillar, cause, Studio", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_3", "Stage 3 label", 0, "Owner fixes", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_3_note", "Stage 3 note", 0, "Action and proof", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_4", "Stage 4 label", 0, "Despatch verifies", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Closure loop", "member_nps_closure_stage_4_note", "Stage 4 note", 0, "Member hears closure", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_title", "Accordion title", 0, "Feedback summary", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_summary", "Accordion summary", 0, "{open} open · NPS {score} from {respondents} responses", "ACT-PRIYA", "", "", now, "Tokens: open, score, respondents"],
  ["Feedback summary", "member_nps_feedback_captured", "Feedback captured", 8, "", "ACT-PRIYA", "", "", now, "Operations enters count"],
  ["Feedback summary", "member_nps_feedback_open", "Feedback open", 6, "", "ACT-PRIYA", "", "", now, "Operations enters count"],
  ["Feedback summary", "member_nps_feedback_immediate", "Immediate attention", 4, "", "ACT-PRIYA", "", "", now, "Operations enters count"],
  ["Feedback summary", "member_nps_feedback_score", "NPS score", -13, "", "ACT-PRIYA", "", "", now, "Operations enters NPS score"],
  ["Feedback summary", "member_nps_feedback_respondents", "NPS respondents", 8, "", "ACT-PRIYA", "", "", now, "Operations enters response count"],
  ["Feedback summary", "member_nps_feedback_detractors", "NPS detractors", 3, "", "ACT-PRIYA", "", "", now, "Operations enters count"],
  ["Feedback summary", "member_nps_feedback_captured_label", "Captured label", 0, "Feedback captured", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_captured_note", "Captured note", 0, "All feedback items captured", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_open_label", "Open label", 0, "Still open", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_open_note", "Open note", 0, "Of {captured} captured items", "ACT-PRIYA", "", "", now, "Token: captured"],
  ["Feedback summary", "member_nps_feedback_immediate_label", "Immediate label", 0, "Immediate attention", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_immediate_note", "Immediate note", 0, "Of {open} open items", "ACT-PRIYA", "", "", now, "Token: open"],
  ["Feedback summary", "member_nps_feedback_score_label", "Score label", 0, "July NPS", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_score_note", "Score note", 0, "{respondents} Member responses", "ACT-PRIYA", "", "", now, "Token: respondents"],
  ["Feedback summary", "member_nps_feedback_detractors_label", "Detractors label", 0, "Detractors", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Feedback summary", "member_nps_feedback_detractors_note", "Detractors note", 0, "Of {respondents} July responses", "ACT-PRIYA", "", "", now, "Token: respondents"],
  ["Privacy", "member_nps_privacy_title", "Accordion title", 0, "Privacy", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Privacy", "member_nps_privacy_summary", "Accordion summary", 0, "Anonymised Member tokens only; conversations remain restricted.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Privacy", "member_nps_privacy_headline", "Privacy headline", 0, "Member privacy is part of the operating design.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Privacy", "member_nps_privacy_detail", "Privacy guidance", 0, "This tab shows anonymised Member tokens, category, Studio, summary and action state. Full conversations stay behind restricted references and are never shown here.", "ACT-PRIYA", "", "", now, "Editable copy"],
]

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth }), spreadsheetId = process.env.GOOGLE_SHEET_ID
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === "Member_NPS_Dashboard")) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "Member_NPS_Dashboard" } } }] } })
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Member_NPS_Dashboard!A:Z" })).data.values || []
  if (!current.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "Member_NPS_Dashboard!A1", valueInputOption: "USER_ENTERED", requestBody: { values: [headers, ...rows] } })
  else {
    const keys = new Set(current.slice(1).map((row) => row[1]))
    const missing = rows.filter((row) => !keys.has(row[1]))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "Member_NPS_Dashboard!A:Z", valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  }
  console.log("Member NPS connector-status rows are ready.")
}
main().catch((error) => { console.error(error); process.exit(1) })
