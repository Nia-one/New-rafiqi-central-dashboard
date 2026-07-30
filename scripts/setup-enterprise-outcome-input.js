const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
}

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const title = "TEAM_ENTERPRISE_OUTCOMES"
const headers = ["Demand Reference", "Action / Outcome", "Owner Actor ID", "Due At", "State", "Proof Reference", "Verified By Actor ID", "Verified At", "Notes"]
const descriptions = [
  "Required: identify the FONO demand (prospect/name/studio).",
  "Required: outcome or next action to track.",
  "Required: responsible owner/person ID or name.",
  "Required while open: deadline, preferably YYYY-MM-DD HH:mm.",
  "Required: Open, In Progress, Verified, Closed, Resolved or Reopened.",
  "Required before Verified/Closed: protected URL, document ID, or proof reference.",
  "Required before Verified/Closed: independent verifier ID or name.",
  "Required before Verified/Closed: verification timestamp.",
  "Optional context. Imported business-report tabs remain untouched.",
]

async function main() {
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const book = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index)" })
  let tab = (book.data.sheets || []).find((sheet) => sheet.properties.title === title)
  if (!tab) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title, index: 6, tabColor: { red: 0.05, green: 0.05, blue: 0.05 } } } }] } })
    tab = added.data.replies[0].addSheet
  }
  const sheetId = tab.properties.sheetId
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A1:Z2` })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!A1`, valueInputOption: "RAW", requestBody: { values: [headers, descriptions] } })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { updateSheetProperties: { properties: { sheetId, tabColor: { red: 0.05, green: 0.05, blue: 0.05 }, gridProperties: { frozenRowCount: 2 } }, fields: "tabColor,gridProperties.frozenRowCount" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.03, green: 0.03, blue: 0.03 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" }, note: "BLACK = USER INPUT. Complete this field; dashboard Loop Health consumes it through Action_Log/Evidence_Log." }, fields: "userEnteredFormat,note" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }, wrapStrategy: "WRAP", textFormat: { fontSize: 9 } } }, fields: "userEnteredFormat" } },
    { setDataValidation: { range: { sheetId, startRowIndex: 2, endRowIndex: 1000, startColumnIndex: 4, endColumnIndex: 5 }, rule: { condition: { type: "ONE_OF_LIST", values: ["Open", "In Progress", "Verified", "Closed", "Resolved", "Reopened"].map((userEnteredValue) => ({ userEnteredValue })) }, strict: true, showCustomUi: true } } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length } } },
  ] } })
  console.log(JSON.stringify({ spreadsheetId, title, sheetId, status: "ready" }))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
