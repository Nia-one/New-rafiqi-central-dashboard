require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TAB = "Dashboard_Content"
const HEADERS = ["workspace", "page", "component", "key", "value", "format", "owner", "source_tab", "last_updated"]

// These are starter values only. The application always reads the Sheet after setup.
const INITIAL_ROWS = [
  ["self-drive", "Cash & Control", "page", "title", "Set the destination. Let Nia run the month.", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "Cash & Control", "page", "subtitle", "Approve the goal once; Nia allocates, recovers and verifies the work while protecting cash.", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "Enterprise Demand", "page", "title", "Enterprise Demand", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "Enterprise Demand", "page", "subtitle", "Turn every signed arrival into a verified 2 km, then 5 km capacity loop.", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "New Adds", "page", "title", "Fill every FONO vacancy with verified billing-live Members.", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "Member Engagement", "page", "title", "Keep Members by removing the friction that makes them leave.", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "Member Savings", "page", "title", "Every service must save the Member and pay Nia.", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "Nia Margins", "page", "title", "Nia Margins", "text", "Operations", "Dashboard_Content", ""],
  ["self-drive", "Nia Growth", "page", "title", "Add capacity where demand supports it.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "page", "title", "Making Leaving Home Worth It.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Living", "page", "title", "Community Living and Well-Being.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Work", "page", "title", "Enable upskilling and higher incomes.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Essentials", "page", "title", "Members save more and order again.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "People", "page", "title", "Make everyone do their bit.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Member Feedback", "page", "title", "Fix the signal before a Member exits.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Definitions", "page", "title", "Use one meaning for each number.", "text", "Operations", "Dashboard_Content", ""],
]

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  const exists = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === TAB)
  if (!exists) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } })
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:I` })
  if (!existing.data.values?.length) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${TAB}!A1`, valueInputOption: "RAW", requestBody: { values: [HEADERS, ...INITIAL_ROWS] } })
    console.log(`${TAB} created with editable starter content.`)
  } else console.log(`${TAB} already contains data; no rows were overwritten.`)
  console.log("Operations should edit column E (value). Keep the other columns as the controlled schema.")
}

main().catch((error) => { console.error(error); process.exit(1) })
