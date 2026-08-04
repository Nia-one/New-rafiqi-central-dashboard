require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

const TABS = [
  "TEAM_OCCUPANCY", "Fono Funnel", "TEAM_REQ_SP_SUPPLY", "TEAM_FINANCE_DAILY",
  "TEAM_MEMBER_ACTIVATION", "TEAM_MEMBER_FEEDBACK", "TEAM_REQ_PEOPLE_ROSTER",
  "TEAM_ENTERPRISE_OUTCOMES", "TEAM_NIA_GROWTH", "TEAM_OWNER_REGISTRY",
  "TEAM_LEARNING_HISTORY",
]
const PROTECTION_PREFIX = "RAFIQI_SAMPLE_ROW"
const isSampleRow = (row) => row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell || "")))

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const account = credentials()
  const auth = new google.auth.GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description))" })
  const byTitle = new Map((metadata.data.sheets || []).map((sheet) => [sheet.properties?.title, sheet]))
  const activeTabs = TABS.filter((tab) => byTitle.has(tab))
  const values = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: activeTabs.map((tab) => `'${tab}'!A:AZ`), valueRenderOption: "FORMULA" })
  const requests = []
  const report = []

  for (const tab of TABS.filter((candidate) => !byTitle.has(candidate))) report.push({ tab, status: "missing-tab" })
  for (const [index, tab] of activeTabs.entries()) {
    const sheet = byTitle.get(tab)
    const rows = values.data.valueRanges?.[index]?.values || []
    const header = rows.reduce((best, row, rowIndex) => {
      const count = row.filter((cell) => String(cell || "").trim()).length
      return count > best.count ? { rowIndex, count } : best
    }, { rowIndex: 0, count: 0 })
    const sampleIndex = rows.findIndex((row, rowIndex) => rowIndex > header.rowIndex && isSampleRow(row))
    const targetIndex = header.rowIndex + 1
    if (sampleIndex < 0) { report.push({ tab, headerRow: header.rowIndex + 1, status: "no-sample" }); continue }
    if (sampleIndex === targetIndex) { report.push({ tab, headerRow: header.rowIndex + 1, sampleRow: sampleIndex + 1, status: "already-top" }); continue }

    for (const protection of sheet.protectedRanges || []) {
      if (String(protection.description || "").startsWith(PROTECTION_PREFIX)) requests.push({ deleteProtectedRange: { protectedRangeId: protection.protectedRangeId } })
    }
    requests.push(
      { moveDimension: { source: { sheetId: sheet.properties.sheetId, dimension: "ROWS", startIndex: sampleIndex, endIndex: sampleIndex + 1 }, destinationIndex: targetIndex } },
      { addProtectedRange: { protectedRange: { description: `${PROTECTION_PREFIX}: ${tab}`, range: { sheetId: sheet.properties.sheetId, startRowIndex: targetIndex, endRowIndex: targetIndex + 1, startColumnIndex: 0, endColumnIndex: Math.max(...rows.map((row) => row.length), 1) }, warningOnly: false, editors: { users: [account.client_email] } } } },
    )
    report.push({ tab, headerRow: header.rowIndex + 1, fromRow: sampleIndex + 1, sampleRow: targetIndex + 1, status: "moved" })
  }

  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })

  const verify = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: activeTabs.map((tab) => `'${tab}'!A1:AZ6`) })
  const verified = activeTabs.map((tab, index) => {
    const rows = verify.data.valueRanges?.[index]?.values || []
    const sampleIndex = rows.findIndex(isSampleRow)
    return { tab, sampleRow: sampleIndex < 0 ? null : sampleIndex + 1 }
  })
  console.log(JSON.stringify({ report, verified, moved: report.filter((item) => item.status === "moved").length }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
