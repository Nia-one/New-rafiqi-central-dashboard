/* Creates the Google Sheet source for the People page main-point component. */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")
const now = "2026-07-25T12:00:00+05:30"
const headers = ["section", "key", "label", "value number", "value text", "owner actor id", "studio id", "supply model", "updated at", "notes"]
const rows = [
  ["Main point", "people_main_kicker", "Main-point kicker", 0, "MAIN POINT", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Main point", "people_main_headline", "Main-point headline", 0, "4 of 18 field staff need attention. Two teams have problems today.", "ACT-PRIYA", "", "", now, "Editable operating message"],
  ["Main point", "people_main_detail", "Main-point detail", 0, "Marketing stays in the list. It is not marked Not reporting because orders update automatically.", "ACT-PRIYA", "", "", now, "Editable explanatory sentence"],
  ["Follow-through", "people_follow_through_kicker", "Follow-through kicker", 0, "EXECUTION CONTROL", "ACT-PRIYA", "", "", now, "Editable panel label"],
  ["Follow-through", "people_follow_through_heading", "Follow-through heading", 0, "Follow-through by person", "ACT-PRIYA", "", "", now, "Editable panel heading"],
  ["Follow-through", "people_follow_through_detail", "Follow-through detail", 0, "Closure and result rates are calculated from People_Follow_Through.", "ACT-PRIYA", "", "", now, "Editable explanatory sentence"],
  ["Headline KPI", "people_headline_employees_label", "Employees label", 0, "Employees", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Headline KPI", "people_headline_employees", "Employees", 21, "", "ACT-PRIYA", "", "", now, "Operations enters the employee count"],
  ["Headline KPI", "people_headline_employees_note", "Employees note", 0, "People Ops · 14:00", "ACT-PRIYA", "", "", now, "Editable note"],
  ["Headline KPI", "people_headline_on_plan_label", "On-plan label", 0, "On plan", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Headline KPI", "people_headline_on_plan", "On-plan people", 12, "", "ACT-PRIYA", "", "", now, "Operations enters the count"],
  ["Headline KPI", "people_headline_on_plan_note", "On-plan note", 0, "People Ops · 14:00", "ACT-PRIYA", "", "", now, "Editable note"],
  ["Headline KPI", "people_headline_behind_label", "Behind label", 0, "Behind", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Headline KPI", "people_headline_behind", "Behind people", 5, "", "ACT-PRIYA", "", "", now, "Operations enters the count"],
  ["Headline KPI", "people_headline_behind_note", "Behind note", 0, "People Ops · 14:00", "ACT-PRIYA", "", "", now, "Editable note"],
  ["Headline KPI", "people_headline_critical_label", "Critical label", 0, "Critical", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Headline KPI", "people_headline_critical", "Critical people", 4, "", "ACT-PRIYA", "", "", now, "Operations enters the count"],
  ["Headline KPI", "people_headline_critical_note", "Critical note", 0, "People Ops · 14:00", "ACT-PRIYA", "", "", now, "Editable note"],
  ["Headline KPI", "people_headline_median_attainment_label", "Median-attainment label", 0, "Median attainment", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Headline KPI", "people_headline_median_attainment", "Median attainment", "78%", "", "ACT-PRIYA", "", "", now, "Operations enters the percentage"],
  ["Headline KPI", "people_headline_median_attainment_note", "Median-attainment note", 0, "People Ops · 14:00", "ACT-PRIYA", "", "", now, "Editable note"],
  ["Headline KPI", "people_headline_reviews_due_label", "Reviews-due label", 0, "Reviews due", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Headline KPI", "people_headline_reviews_due", "Reviews due", 6, "", "ACT-PRIYA", "", "", now, "Operations enters the count"],
  ["Headline KPI", "people_headline_reviews_due_note", "Reviews-due note", 0, "People Ops · 14:00", "ACT-PRIYA", "", "", now, "Editable note"],
  ["Headline KPI", "people_headline_not_reporting_label", "Not-reporting label", 0, "Not reporting", "ACT-PRIYA", "", "", now, "Editable label"],
  ["Headline KPI", "people_headline_not_reporting", "Not-reporting people", 4, "", "ACT-PRIYA", "", "", now, "Operations enters the count"],
  ["Headline KPI", "people_headline_not_reporting_note", "Not-reporting note", 0, "Field roles only", "ACT-PRIYA", "", "", now, "Editable note"],
]
const performanceHeaders = ["actor id", "display name", "team", "lane", "status", "attainment pct", "review due", "reporting status", "updated at"]
const performanceRows = [
  ["ACT-PPL-001", "Aarav Kapoor", "FONO acquisition", "Demand", "On plan", 94, "No", "Reporting", now],
  ["ACT-PPL-002", "Diya Menon", "FONO acquisition", "Demand", "On plan", 88, "No", "Reporting", now],
  ["ACT-PPL-003", "Kabir Shah", "FONO acquisition", "Demand", "Behind", 67, "Yes", "Reporting", now],
  ["ACT-PPL-004", "Meera Nair", "FONO acquisition", "Demand", "Critical", 42, "Yes", "Reporting", now],
  ["ACT-PPL-005", "Rohan Iyer", "FONO acquisition", "Demand", "Critical", 38, "Yes", "Reporting", now],
  ["ACT-PPL-006", "Sana Verma", "Enterprise demand", "Demand", "On plan", 91, "No", "Reporting", now],
  ["ACT-PPL-007", "Vikram Singh", "Enterprise demand", "Demand", "Behind", 70, "No", "Reporting", now],
  ["ACT-PPL-008", "Nisha Patel", "Enterprise demand", "Demand", "On plan", 82, "No", "Reporting", now],
  ["ACT-PPL-009", "Arjun Rao", "Enterprise demand", "Demand", "On plan", 79, "No", "Reporting", now],
  ["ACT-PPL-010", "Priya Rao", "Member activation", "Supply", "On plan", 86, "No", "Reporting", now],
  ["ACT-PPL-011", "Aditya Kumar", "Member activation", "Supply", "Critical", 44, "Yes", "Reporting", now],
  ["ACT-PPL-012", "Neha Joshi", "Member activation", "Supply", "Critical", 36, "Yes", "Reporting", now],
  ["ACT-PPL-013", "Riya Das", "Member activation", "Supply", "Behind", 71, "No", "Reporting", now],
  ["ACT-PPL-014", "Siddharth Roy", "Field delivery", "Supply", "On plan", 89, "No", "Reporting", now],
  ["ACT-PPL-015", "Isha Gupta", "Field delivery", "Supply", "On plan", 84, "No", "Reporting", now],
  ["ACT-PPL-016", "Karan Malhotra", "Field delivery", "Supply", "Behind", 69, "No", "Not reporting", now],
  ["ACT-PPL-017", "Ananya Bose", "Field delivery", "Supply", "On plan", 83, "No", "Reporting", now],
  ["ACT-PPL-018", "Manav Jain", "Field delivery", "Supply", "On plan", 80, "No", "Not reporting", now],
]
const followThroughHeaders = ["actor id", "display name", "team", "commitments", "verified", "carried forward", "closed but not resolved", "updated at", "progress pct", "next action"]
const followThroughRows = [
  ["ACT-PPL-001", "Aarav Kapoor", "FONO acquisition", 10, 10, 0, 0, now, 100, "Confirm evidence and close the commitment"],
  ["ACT-PPL-003", "Kabir Shah", "FONO acquisition", 8, 6, 2, 0, now, 75, "Complete the two carried commitments"],
  ["ACT-PPL-004", "Meera Nair", "FONO acquisition", 7, 4, 2, 1, now, 57, "Recover the unresolved commitment and submit proof"],
  ["ACT-PPL-007", "Vikram Singh", "Enterprise demand", 9, 8, 1, 0, now, 89, "Close the carried enterprise-demand commitment"],
  ["ACT-PPL-010", "Priya Rao", "Member activation", 8, 8, 0, 0, now, 100, "Confirm evidence and close the commitment"],
  ["ACT-PPL-011", "Aditya Kumar", "Member activation", 6, 3, 2, 1, now, 50, "Recover the unresolved commitment and submit proof"],
  ["ACT-PPL-014", "Siddharth Roy", "Field delivery", 7, 7, 0, 0, now, 100, "Confirm evidence and close the commitment"],
  ["ACT-PPL-016", "Karan Malhotra", "Field delivery", 5, 4, 1, 0, now, 80, "Close the carried field-delivery commitment"],
]
async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth }), spreadsheetId = process.env.GOOGLE_SHEET_ID
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === "People_Dashboard")) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "People_Dashboard" } } }] } })
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === "People_Performance")) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "People_Performance" } } }] } })
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === "People_Follow_Through")) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "People_Follow_Through" } } }] } })
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "People_Dashboard!A:Z" })).data.values || []
  if (!current.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "People_Dashboard!A1", valueInputOption: "USER_ENTERED", requestBody: { values: [headers, ...rows] } })
  else {
    const keys = new Set(current.slice(1).map((row) => row[1]))
    const missing = rows.filter((row) => !keys.has(row[1]))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "People_Dashboard!A:Z", valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  }
  const performanceCurrent = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "People_Performance!A:Z" })).data.values || []
  if (!performanceCurrent.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "People_Performance!A1", valueInputOption: "USER_ENTERED", requestBody: { values: [performanceHeaders, ...performanceRows] } })
  else {
    const actorIds = new Set(performanceCurrent.slice(1).map((row) => row[0]))
    const missing = performanceRows.filter((row) => !actorIds.has(row[0]))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "People_Performance!A:Z", valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
  }
  const followThroughCurrent = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "People_Follow_Through!A:Z" })).data.values || []
  if (!followThroughCurrent.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "People_Follow_Through!A1", valueInputOption: "USER_ENTERED", requestBody: { values: [followThroughHeaders, ...followThroughRows] } })
  else {
    const existingHeaders = followThroughCurrent[0] || []
    const missingHeaders = followThroughHeaders.slice(existingHeaders.length)
    if (missingHeaders.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "People_Follow_Through!I1", valueInputOption: "USER_ENTERED", requestBody: { values: [missingHeaders] } })
    const actorIds = new Set(followThroughCurrent.slice(1).map((row) => row[0]))
    const missing = followThroughRows.filter((row) => !actorIds.has(row[0]))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "People_Follow_Through!A:Z", valueInputOption: "USER_ENTERED", requestBody: { values: missing } })
    const existingProgress = followThroughCurrent.slice(1).map((row) => row[8])
    if (!existingProgress.some((value) => String(value || "").trim())) await sheets.spreadsheets.values.update({ spreadsheetId, range: "People_Follow_Through!I2", valueInputOption: "USER_ENTERED", requestBody: { values: followThroughRows.map((row) => row.slice(8)) } })
  }
  console.log("People_Dashboard main-point rows are ready.")
}
main().catch((error) => { console.error(error); process.exit(1) })
