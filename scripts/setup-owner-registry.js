require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const tab = "TEAM_OWNER_REGISTRY"
const headers = ["assignment_id", "vertical", "scope", "theatre", "role_type", "owner_name", "business_responsibility", "effective_from", "effective_to", "status"]
const rows = [
  ["OWNER-OCCUPANCY", "Occupancy", "All", "All", "Owner", "Prashant Waghire", "Drive occupancy growth, improve occupancy %, and achieve Occupancy targets.", "2026-07-31", "", "Active"],
  ["OWNER-ESS-SUPPLY", "Essential Supply", "All", "All", "Owner", "Manikya Dahed", "Increase supply, ensure product availability, and achieve Essentials Supply targets.", "2026-07-31", "", "Active"],
  ["OWNER-ESS-DEMAND", "Essential Demand", "All", "All", "Owner", "Satish Sanghey", "Drive customer demand, improve conversions, and achieve Essentials Demand targets.", "2026-07-31", "", "Active"],
  ["OWNER-FONO-DEMAND", "FONO Demand", "All", "All", "Owner", "Srinivasan RG", "Generate FONO demand, improve funnel performance, and achieve FONO Demand targets.", "2026-07-31", "", "Active"],
  ["OWNER-FONO-SUPPLY", "FONO Supply", "All", "All", "Owner", "Srinivasan RG", "Increase FONO supply capacity and achieve FONO Supply targets.", "2026-07-31", "", "Active"],
  ["OWNER-SP-DEMAND-NORTH", "SP Demand", "SP Demand Bot", "Rajputana|Deccan", "Owner", "Prashant Waghire", "Drive Shram Park demand growth and targets for the assigned theatres.", "2026-07-31", "", "Active"],
  ["OWNER-SP-DEMAND-SOUTH", "SP Demand", "SP Demand Bot", "Coromandel|Wellington", "Owner", "Satish Sanghey", "Drive Shram Park demand growth and targets for the assigned theatres.", "2026-07-31", "", "Active"],
  ["OWNER-SP-SUPPLY-NORTH", "SP Supply", "All", "Rajputana|Deccan", "Owner", "Prashant Waghire", "Increase Shram Park supply and achieve targets for the assigned theatres.", "2026-07-31", "", "Active"],
  ["OWNER-SP-SUPPLY-SOUTH", "SP Supply", "All", "Coromandel|Wellington", "Owner", "Satish Sanghey", "Increase Shram Park supply and achieve targets for the assigned theatres.", "2026-07-31", "", "Active"],
  ["OWNER-ENTERPRISE-DEMAND", "Enterprise Demand", "All", "All", "Owner", "Srinivasan RG", "Drive enterprise demand generation and achieve Enterprise Demand targets.", "2026-07-31", "", "Active"],
  ["OWNER-ENTERPRISE-SUPPLY", "Enterprise Supply", "All", "All", "Owner", "Srinivasan RG", "Expand enterprise supply capacity and achieve Enterprise Supply targets.", "2026-07-31", "", "Active"],
  ["OWNER-FINANCE", "Finance", "All", "All", "Owner", "Shrey", "Own financial governance, budgets, approvals, targets, and controls.", "2026-07-31", "", "Active"],
  ["APPROVER-FINANCE", "Finance", "All", "All", "Approver", "Yoshit", "Approve and receive governed Finance decisions.", "2026-07-31", "", "Active"],
  ["RECIPIENT-FINANCE", "Finance", "All", "All", "Recipient", "Yoshit", "Receive governed Finance decisions and outputs.", "2026-07-31", "", "Active"],
  ["OWNER-COLLECTION-LOCAL", "Collection", "Theatre operations", "All", "Owner", "Local Theatre Teams", "Maximise collections and reduce outstanding dues within each theatre.", "2026-07-31", "", "Active"],
  ["OWNER-COLLECTION-FINANCE", "Collection", "Finance", "All", "Finance owner", "Bidhyadhar Nayak", "Own Collection finance controls and achievement of collection targets.", "2026-07-31", "", "Active"],
]
function credentials() { const source = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"; try { return JSON.parse(source) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), source), "utf8")) } }
async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  let metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  let sheet = metadata.data.sheets.find((item) => item.properties.title === tab)
  if (!sheet) { const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } }); sheet = added.data.replies[0].addSheet }
  const sheetId = sheet.properties.sheetId
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tab}'!A:Z` })
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${tab}'!A1`, valueInputOption: "RAW", requestBody: { values: [headers, ...rows] } })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 }, tabColorStyle: { rgbColor: { red: .05, green: .3, blue: .65 } } }, fields: "gridProperties.frozenRowCount,tabColorStyle" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0, green: 0, blue: 0 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: "WRAP" }, note: "BLACK = USER INPUT. Edit this registry for future owner changes; automation consumes Active rows." }, fields: "userEnteredFormat,note" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rows.length + 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0, green: 0, blue: 0 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: "userEnteredFormat" } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length } } },
  ] } })
  console.log(JSON.stringify({ spreadsheetId, tab, assignments: rows.length }, null, 2))
}
main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
