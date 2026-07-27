require("dotenv").config({ path: ".env.local", quiet: true })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const fields = [
  { header: "cash target inr", value: 300000, format: "NUMBER", input: false, note: "AUTO-DERIVED LEGACY FALLBACK · Dashboard cash target now comes from Approval_Log amount inr for the monthly cash destination decision. Do not fill manually." },
  { header: "opex cap inr", value: 120000, format: "NUMBER", input: true, note: "OPS INPUT · Self Drive → Cash & Control → Recommendation / Where we are. Enter the approved monthly opex cap in INR." },
  { header: "destination approved", value: false, format: "BOOLEAN", input: false, note: "AUTO-DERIVED LEGACY FALLBACK · Dashboard approval status now comes from Approval_Log decision. Do not fill manually." },
  { header: "destination owner actor id", value: "ACT-PRIYA", format: "TEXT", input: false, note: "AUTO-DERIVED LEGACY FALLBACK · Dashboard owner now comes from the Approval_Log linked Action_Log owner. Do not fill manually." },
  { header: "decision due at", value: "2026-07-26T14:00:00+05:30", format: "TEXT", input: false, note: "AUTO-DERIVED LEGACY FALLBACK · Dashboard deadline now comes from the Approval_Log linked Action_Log due at. Do not fill manually." },
]

const contentRows = [
  ["self-drive", "Cash & Control", "recommendation", "why_here", "Decide the monthly CM destination and collected-cash target so RafiQi can compute the remaining gap and cascade.", "text", "Operations", "Finance_Daily", "2026-07-25T12:00:00+05:30"],
  ["self-drive", "Cash & Control", "recommendation", "pending_ask", "Approve the destination and cash target to unlock the cascade; leave them pending and they stay locked.", "text", "Operations", "Finance_Daily", "2026-07-25T12:00:00+05:30"],
  ["self-drive", "Cash & Control", "recommendation", "approved_ask", "The approved destination is active; the system can track the remaining gap.", "text", "Operations", "Finance_Daily", "2026-07-25T12:00:00+05:30"],
  ["self-drive", "Cash & Control", "monthly_command", "question", "What must Nia deliver this month, is cash protected, and is system work verified?", "text", "Operations", "Finance_Daily; Action_Log", "2026-07-25T12:00:00+05:30"],
  ["self-drive", "Cash & Control", "monthly_command", "owner_note", "Targets, finance and guardrail exceptions remain human-approved.", "text", "Operations", "Finance_Daily; People_Roster", "2026-07-25T12:00:00+05:30"],
  ["self-drive", "Cash & Control", "monthly_control_path", "heading", "Approve the destination, protect cash, then verify every outcome.", "text", "Operations", "Finance_Daily; Action_Log", "2026-07-26T10:00:00+05:30"],
  ["self-drive", "Cash & Control", "monthly_control_path", "policy_note", "No silent target reduction", "text", "Operations", "Dashboard_Overview", "2026-07-26T10:00:00+05:30"],
  ["self-drive", "Cash & Control", "control_path_implication", "pending_summary", "The proposed target cannot activate silently.", "text", "Operations", "Finance_Daily", "2026-07-26T10:30:00+05:30"],
  ["self-drive", "Cash & Control", "control_path_implication", "approved_summary", "The approved target remains governed and the cascade is unlocked.", "text", "Operations", "Finance_Daily", "2026-07-26T10:30:00+05:30"],
  ["self-drive", "Cash & Control", "control_path_implication", "pending_detail", "The destination and remaining gap stay pending, so the cascade cannot start until a human approves the monthly target.", "text", "Operations", "Finance_Daily; Dashboard_Overview", "2026-07-26T10:30:00+05:30"],
  ["self-drive", "Cash & Control", "control_path_implication", "approved_detail", "The destination is approved, the remaining CM gap is available, and the governed cascade can proceed.", "text", "Operations", "Finance_Daily; Dashboard_Overview", "2026-07-26T10:30:00+05:30"],
  ["self-drive", "Cash & Control", "channel_recommendation", "heading", "Recommend the mix; never impose a fixed split.", "text", "Operations", "Cash_Control_Channels", "2026-07-26T11:00:00+05:30"],
  ["self-drive", "Cash & Control", "channel_recommendation", "policy_note", "Recommendation only", "text", "Operations", "Cash_Control_Channels", "2026-07-26T11:00:00+05:30"],
  ["self-drive", "Cash & Control", "channel_recommendation", "allocation_note", "No allocation set", "text", "Operations", "Cash_Control_Channels", "2026-07-26T11:00:00+05:30"],
  ["self-drive", "Cash & Control", "channel_implication", "pending_summary", "No allocation is imposed before destination approval.", "text", "Operations", "Approval_Log; Cash_Control_Channels", "2026-07-26T11:15:00+05:30"],
  ["self-drive", "Cash & Control", "channel_implication", "approved_summary", "Verified channels are available for human selection.", "text", "Operations", "Approval_Log; Cash_Control_Channels", "2026-07-26T11:15:00+05:30"],
  ["self-drive", "Cash & Control", "channel_implication", "pending_detail", "The top-ranked verified channel remains a recommendation; approve the destination before choosing the mix.", "text", "Operations", "Approval_Log; Cash_Control_Channels", "2026-07-26T11:15:00+05:30"],
  ["self-drive", "Cash & Control", "channel_implication", "approved_detail", "The destination is approved; choose from the evidence-ranked channels without imposing a fixed split.", "text", "Operations", "Approval_Log; Cash_Control_Channels", "2026-07-26T11:15:00+05:30"],
  ["self-drive", "Cash & Control", "open_work", "heading", "Every miss stays open until independently verified.", "text", "Operations", "Action_Log; Evidence_Log", "2026-07-26T11:30:00+05:30"],
  ["self-drive", "Cash & Control", "open_work", "live_note", "Google Sheet - read-only", "text", "Operations", "Action_Log", "2026-07-26T11:30:00+05:30"],
  ["self-drive", "Cash & Control", "open_work", "eyebrow", "Owned command work", "text", "Operations", "Action_Log", "2026-07-26T11:30:00+05:30"],
  ["self-drive", "Cash & Control", "human_approvals", "eyebrow", "Named human authority", "text", "Operations", "Approval_Log", "2026-07-26T12:00:00+05:30"],
  ["self-drive", "Cash & Control", "human_approvals", "heading", "Financial controls cannot approve themselves.", "text", "Operations", "Approval_Log", "2026-07-26T12:00:00+05:30"],
  ["self-drive", "Cash & Control", "human_approvals", "policy_note", "No automatic exception", "text", "Operations", "Approval_Log", "2026-07-26T12:00:00+05:30"],
]

function columnName(index) {
  let value = index + 1, result = ""
  while (value > 0) { const remainder = (value - 1) % 26; result = String.fromCharCode(65 + remainder) + result; value = Math.floor((value - 1) / 26) }
  return result
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Finance_Daily!1:2" })).data.values || [[], []]
  const originalHeaders = current[0] || []
  const headers = [...originalHeaders, ...fields.map((field) => field.header).filter((header) => !originalHeaders.includes(header))]
  const row = [...(current[1] || [])]
  for (const field of fields) {
    const index = headers.indexOf(field.header)
    if (row[index] === undefined || row[index] === "") row[index] = field.value
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Finance_Daily!A1:${columnName(headers.length - 1)}2`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers, row] },
  })

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const financeSheet = metadata.data.sheets?.find((sheet) => sheet.properties.title === "Finance_Daily")
  if (!financeSheet) throw new Error("Finance_Daily was not found")
  const requests = fields.flatMap((field) => {
    const index = headers.indexOf(field.header)
    return [
      { repeatCell: { range: { sheetId: financeSheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { note: field.note }, fields: "note" } },
      { repeatCell: { range: { sheetId: financeSheet.properties.sheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: field.input ? { red: 1, green: 0.949, blue: 0.8 } : { red: 0.88, green: 0.93, blue: 1 }, numberFormat: field.format === "NUMBER" ? { type: "NUMBER", pattern: "#,##0" } : field.format === "BOOLEAN" ? { type: "TEXT", pattern: "@" } : { type: "TEXT", pattern: "@" } } }, fields: "userEnteredFormat(backgroundColor,numberFormat)" } },
    ]
  })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })

  const guide = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K" })).data.values || []
  const existingKeys = new Set(guide.slice(1).map((entry) => `${entry[0]}|${entry[1]}`))
  const guideRows = fields.filter((field) => !existingKeys.has(`Finance_Daily|${field.header}`)).map((field) => [
    "Finance_Daily", field.header, "One row per finance snapshot/day", "When the approved destination or finance snapshot changes",
    field.note.split(". ").at(-1), "Cash & Control", "Recommendation and monthly command", field.input ? "OPS INPUT" : "AUTO-DERIVED", field.note, String(field.value), field.input ? "Visible column" : "System column - do not edit",
  ])
  if (guideRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: guideRows } })
  for (const field of fields) {
    const guideIndex = guide.slice(1).findIndex((entry) => entry[0] === "Finance_Daily" && entry[1] === field.header)
    if (guideIndex >= 0) await sheets.spreadsheets.values.update({ spreadsheetId, range: `DATA_ENTRY_GUIDE!H${guideIndex + 2}:K${guideIndex + 2}`, valueInputOption: "RAW", requestBody: { values: [[field.input ? "OPS INPUT" : "AUTO-DERIVED", field.note, String(field.value), field.input ? "Visible column" : "System column - do not edit"]] } })
  }

  const content = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Dashboard_Content!A:I" })).data.values || []
  const contentKeys = new Set(content.slice(1).map((entry) => `${entry[0]}|${entry[1]}|${entry[2]}|${entry[3]}`))
  const contentUpdates = contentRows.flatMap((entry) => {
    const rowIndex = content.slice(1).findIndex((existing) => `${existing[0]}|${existing[1]}|${existing[2]}|${existing[3]}` === `${entry[0]}|${entry[1]}|${entry[2]}|${entry[3]}`)
    return rowIndex < 0 ? [] : [{ range: `Dashboard_Content!A${rowIndex + 2}:I${rowIndex + 2}`, values: [entry] }]
  })
  if (contentUpdates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: contentUpdates } })
  const missingContent = contentRows.filter((entry) => !contentKeys.has(`${entry[0]}|${entry[1]}|${entry[2]}|${entry[3]}`))
  if (missingContent.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "Dashboard_Content!A:I", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: missingContent } })

  console.log(JSON.stringify({ updated: true, tab: "Finance_Daily", addedFields: fields.map((field) => field.header), guideRowsAdded: guideRows.length, contentRowsUpdated: contentUpdates.length, contentRowsAdded: missingContent.length }, null, 2))
}

main().catch((error) => { console.error(error?.response?.data || error); process.exit(1) })
