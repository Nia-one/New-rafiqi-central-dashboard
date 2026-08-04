const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

function columnName(index) {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

const columns = [
  ["reporting_month", true, "REQUIRED — Dashboard reporting period. Format: YYYY-MM only. Example: 2026-08."],
  ["business_date", true, "REQUIRED — Finance snapshot date. Format: YYYY-MM-DD. Example: 2026-07-29"],
  ["theatre_id", true, "REQUIRED — Theatre identifier used in dashboard filters. Use the same ID as Theatre_Master."],
  ["studio_id", true, "OPTIONAL — Studio identifier from Studio_Master. Leave blank only when the row is a theatre-level total."],
  ["opex_mtd_inr", true, "REQUIRED — Actual operating expenses incurred from month start through business_date, in INR. Number only."],
  ["opex_forecast_inr", true, "REQUIRED — Finance-approved expected total OPEX at month end, in INR. Number only."],
  ["opex_cap_inr", true, "REQUIRED — Approved maximum OPEX allowed for the month, in INR. Number only."],
  ["cash_balance_inr", true, "REQUIRED — Available cash/bank balance at close of business_date, after confirmed postings, in INR."],
  ["cash_target_inr", true, "REQUIRED — Minimum protected cash balance/guardrail approved for this scope, in INR."],
  ["cm_target_inr", true, "REQUIRED — Approved or proposed monthly contribution-margin destination, in INR."],
  ["destination_approved", true, "REQUIRED — Select Yes only when the monthly CM/cash destination has formal human approval; otherwise No."],
  ["destination_owner_actor_id", true, "REQUIRED — Actor ID of the person accountable for approving/delivering the destination; must exist in People_Roster."],
  ["decision_due_at", true, "REQUIRED — Deadline for the destination decision. Format: YYYY-MM-DD."],
  ["cm1_inr", true, "REQUIRED — Current governed CM1 for this date/scope: revenue minus governed direct variable costs, in INR."],
  ["cm2_inr", false, "AUTO / DO NOT TOUCH — Calculated per row as CM1 minus OPEX Actual (MTD). Both inputs must use the same date and scope."],
  ["reported_by_actor_id", true, "REQUIRED — Finance person name or Actor ID. If a name is entered, use the same spelling as People_Roster."],
  ["notes", true, "OPTIONAL — Brief explanation of exception, reconciliation gap, approval condition or unusual movement."],
  ["finance_daily_id", false, "AUTO / DO NOT TOUCH — Stable finance snapshot ID generated during synchronization."],
  ["total_billed_inr", false, "AUTO / DO NOT TOUCH — Aggregated billed revenue from Living, Work and Essentials source feeds for the same scope/date."],
  ["total_collected_inr", false, "AUTO / DO NOT TOUCH — Aggregated verified collections from connected source feeds for the same scope/date."],
  ["current_due_inr", false, "AUTO / DO NOT TOUCH — total_billed_inr minus total_collected_inr; never manually enter."],
  ["overdue_inr", false, "AUTO / DO NOT TOUCH — Sum of explicit overdue amounts recorded by connected source feeds."],
  ["cash_guardrail_status", false, "AUTO / DO NOT TOUCH — Protected when cash balance meets target; otherwise At risk."],
  ["reconciliation_status", false, "AUTO / DO NOT TOUCH — Derived from billed, collected and due values."],
  ["reported_at", false, "AUTO / DO NOT TOUCH — System submission timestamp."],
  ["source_submission_id", false, "AUTO / DO NOT TOUCH — System lineage reference connecting input, backend and dashboard."],
  ["updated_at", false, "AUTO / DO NOT TOUCH — Latest synchronization timestamp."],
  ["living_cm2_inr", true, "OPTIONAL — Living contribution included in CM2 for this same date and scope, in INR."],
  ["work_cm2_inr", true, "OPTIONAL — Work contribution included in CM2 for this same date and scope, in INR."],
  ["essentials_cm2_inr", true, "OPTIONAL — Essentials contribution included in CM2 for this same date and scope, in INR."],
]

const displayLabels = {
  reporting_month: "Reporting Month (YYYY-MM)",
  business_date: "Date",
  theatre_id: "Theatre",
  studio_id: "Studio Code",
  opex_mtd_inr: "OPEX Actual (MTD) ₹",
  opex_forecast_inr: "OPEX Forecast (Month-End) ₹",
  opex_cap_inr: "OPEX Budget Cap ₹",
  cash_balance_inr: "Available Cash Balance ₹",
  cash_target_inr: "Minimum Cash Balance ₹",
  cm_target_inr: "Targeted CM ₹",
  destination_approved: "Target Approved?",
  destination_owner_actor_id: "Target Owner",
  decision_due_at: "Target Close Date",
  cm1_inr: "CM1 ₹",
  cm2_inr: "CM2 ₹",
  reported_by_actor_id: "Updated By",
  notes: "Finance Notes",
  finance_daily_id: "Record ID",
  total_billed_inr: "Total Billing ₹",
  total_collected_inr: "Total Collection ₹",
  current_due_inr: "Current Due ₹",
  overdue_inr: "Overdue ₹",
  cash_guardrail_status: "Cash Status",
  reconciliation_status: "Reconciliation Status",
  reported_at: "Reported At",
  source_submission_id: "Source Record ID",
  updated_at: "Last Updated",
  living_cm2_inr: "Living CM2 ₹",
  work_cm2_inr: "Work CM2 ₹",
  essentials_cm2_inr: "Essentials CM2 ₹",
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  let sheet = (metadata.data.sheets || []).find((item) => item.properties.title === "TEAM_FINANCE_DAILY")
  if (!sheet) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "TEAM_FINANCE_DAILY", tabColor: { red: 0.05, green: 0.05, blue: 0.05 }, gridProperties: { frozenRowCount: 3 } } } }] } })
    const sheetId = added.data.replies[0].addSheet.properties.sheetId
    sheet = { properties: { sheetId, title: "TEAM_FINANCE_DAILY" } }
  }
  const sheetId = sheet.properties.sheetId
  const backendId = process.env.GOOGLE_SHEET_ID
  const backendHeader = (await sheets.spreadsheets.values.get({ spreadsheetId: backendId, range: "Finance_Daily!1:1" })).data.values?.[0] || []
  const requiredBackendColumns = ["cm target inr", "living cm2 inr", "work cm2 inr", "essentials cm2 inr"]
  const missingBackendColumns = requiredBackendColumns.filter((header) => !backendHeader.includes(header))
  if (missingBackendColumns.length) {
    const backendMetadata = await sheets.spreadsheets.get({ spreadsheetId: backendId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" })
    const financeSheet = (backendMetadata.data.sheets || []).find((item) => item.properties.title === "Finance_Daily")
    if (!financeSheet) throw new Error("Canonical Finance_Daily tab was not found")
    const requiredColumnCount = backendHeader.length + missingBackendColumns.length
    const availableColumnCount = financeSheet.properties.gridProperties.columnCount || 0
    if (availableColumnCount < requiredColumnCount) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: backendId, requestBody: { requests: [{ appendDimension: { sheetId: financeSheet.properties.sheetId, dimension: "COLUMNS", length: requiredColumnCount - availableColumnCount } }] } })
    }
    await sheets.spreadsheets.values.update({ spreadsheetId: backendId, range: `Finance_Daily!${columnName(backendHeader.length)}1`, valueInputOption: "RAW", requestBody: { values: [missingBackendColumns] } })
  }
  const values = [
    columns.map(([header, manual]) => `${displayLabels[header] || header}\n${manual ? "FINANCE INPUT" : "AUTOMATED — DO NOT EDIT"}`),
    columns.map(([, , help]) => help),
    columns.map(([header]) => header),
  ]
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "TEAM_FINANCE_DAILY!A1", valueInputOption: "RAW", requestBody: { values } })
  const requests = [{ updateSheetProperties: { properties: { sheetId, tabColor: { red: 0.05, green: 0.05, blue: 0.05 }, gridProperties: { frozenRowCount: 3 } }, fields: "tabColor,gridProperties.frozenRowCount" } }]
  columns.forEach(([header, manual, help], index) => {
    for (const [startRowIndex, endRowIndex] of [[0, 1], [2, 3]]) requests.push({ repeatCell: { range: { sheetId, startRowIndex, endRowIndex, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { backgroundColor: manual ? { red: 0.03, green: 0.03, blue: 0.03 } : { red: 0.8, green: 0.02, blue: 0.02 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" }, note: help }, fields: "userEnteredFormat,note" } })
  })
  requests.push(
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } }, fields: "userEnteredFormat.numberFormat" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 58 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 76 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 2, endIndex: 3 }, properties: { pixelSize: 42 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columns.length }, properties: { pixelSize: 150 }, fields: "pixelSize" } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 2, startColumnIndex: 0, endColumnIndex: columns.length } } } },
  )
  columns.forEach(([header], index) => {
    if (header.endsWith("_inr")) requests.push({ repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: index, endColumnIndex: index + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" } } }, fields: "userEnteredFormat.numberFormat" } })
  })
  const decisionDateIndex = columns.findIndex(([header]) => header === "decision_due_at")
  requests.push({ repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: decisionDateIndex, endColumnIndex: decisionDateIndex + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } }, fields: "userEnteredFormat.numberFormat" } })
  const approvedIndex = columns.findIndex(([header]) => header === "destination_approved")
  requests.push({ setDataValidation: { range: { sheetId, startRowIndex: 3, endRowIndex: 1000, startColumnIndex: approvedIndex, endColumnIndex: approvedIndex + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Yes" }, { userEnteredValue: "No" }] }, strict: true, showCustomUi: true } } })
  const cm2Index = columns.findIndex(([header]) => header === "cm2_inr")
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `TEAM_FINANCE_DAILY!${columnName(cm2Index)}4:${columnName(cm2Index)}1000` })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `TEAM_FINANCE_DAILY!${columnName(cm2Index)}4`, valueInputOption: "USER_ENTERED", requestBody: { values: [['=ARRAYFORMULA(IF(A4:A="","",IF((M4:M="")+(D4:D=""),"",M4:M-D4:D)))']] } })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log(JSON.stringify({ spreadsheetId, tab: "TEAM_FINANCE_DAILY", sheetId, manualColumns: columns.filter(([, manual]) => manual).map(([name]) => name), automatedColumns: columns.filter(([, manual]) => !manual).map(([name]) => name) }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
