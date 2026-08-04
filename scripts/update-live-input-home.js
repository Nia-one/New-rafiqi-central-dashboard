require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const rows = [
  ["RAFIQI LIVE DATA ENTRY", "BLACK tabs/columns = user or report input · RED = automated/system, do not edit"],
  ["Rule", "Enter each fact once in its owning tab. For every dated/event row, Reporting Month is required in YYYY-MM format (example: 2026-08). Other pages derive automatically after sync."],
  ["ORDER", "INPUT TAB", "WHAT THE USER DOES", "DASHBOARD CONSUMERS"],
  [1, "TEAM_OCCUPANCY", "Only fill Activation Ready Nests when verified. All other columns come from active Studios.", "Living · Member Adds · Nia Margins · Nia Growth · Overview"],
  [2, "Fono Funnel", "Import/replace the latest Business Report FONO Funnel tab; do not duplicate it elsewhere.", "Living FONO · Member Adds · Nia Growth · Overview"],
  [3, "TEAM_REQ_SP_SUPPLY", "Record verified SP supply readiness and coverage once.", "Living SP supply · Enterprise Demand · Nia Growth"],
  [4, "TEAM_FINANCE_DAILY", "Fill only black control, expense, cash, target and approval fields. Billing/collections are derived.", "Cash & Control · Nia Margins · Overview · Sign-Off"],
  [5, "TEAM_MEMBER_ACTIVATION", "Record verified member activation/billing evidence once.", "Member Adds · Engagement · People · Overview"],
  [6, "TEAM_MEMBER_FEEDBACK", "Record Member score/feedback or chatbot reference once.", "Member NPS · Member Engagement · Despatch"],
  [7, "TEAM_REQ_PEOPLE_ROSTER", "Maintain active people, role, Studio and shift details.", "People · Despatch · heartbeat ownership"],
  [8, "TEAM_ENTERPRISE_OUTCOMES", "Record only real enterprise action/outcome and proof events.", "Enterprise Demand · Despatch · Sign-Off"],
  [9, "TEAM_NIA_GROWTH", "Fill only black SLA, evidence, approval and learning fields; FONO/SP baselines auto-calculate.", "Nia Growth · Sign-Off · Learning History"],
  [10, "TEAM_OWNER_REGISTRY", "Change only when accountable ownership changes.", "All owner labels and action routing"],
  [11, "TEAM_LEARNING_HISTORY", "Record a verified observation/proposal once; no duplicate entry on reference pages.", "Learning History · Sign-Off · Overview"],
  ["BOT SOURCES", "SP Demand and Essentials", "Bot workbooks sync automatically and are strictly protected.", "Enterprise Demand · Essentials · Savings · Margins"],
  ["SYNC", "Automatic / Refresh data", "Sync validates Reporting Month, quarantines invalid/missing temporal rows, and moves valid YYYY-MM periods into the dashboard filter.", "All pages"],
]

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const account = credentials()
  const auth = new google.auth.GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const sheet = (metadata.data.sheets || []).find((item) => item.properties.title === "TEAM_DATA_ENTRY_HOME")
  if (!sheet) throw new Error("TEAM_DATA_ENTRY_HOME is missing")
  const sheetId = sheet.properties.sheetId
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "TEAM_DATA_ENTRY_HOME!A1:D100" })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "TEAM_DATA_ENTRY_HOME!A1", valueInputOption: "RAW", requestBody: { values: rows } })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { unmergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 4 } } },
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 1, endColumnIndex: 4 }, mergeType: "MERGE_ALL" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.8, green: 0.05, blue: 0.05 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 12 }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 4 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.03, green: 0.03, blue: 0.03 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 14, startColumnIndex: 0, endColumnIndex: 4 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment" } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 3, hideGridlines: true } }, fields: "gridProperties.frozenRowCount,gridProperties.hideGridlines" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 90 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 220 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 }, properties: { pixelSize: 470 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 420 }, fields: "pixelSize" } },
  ] } })
  console.log(JSON.stringify({ tab: "TEAM_DATA_ENTRY_HOME", listedInputTabs: 11, rule: "Enter once; derived pages update automatically" }))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
