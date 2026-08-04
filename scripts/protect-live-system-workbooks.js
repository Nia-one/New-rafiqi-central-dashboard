require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const RED = { red: 0.8, green: 0.05, blue: 0.05 }
const WHITE = { red: 1, green: 1, blue: 1 }
const PREFIX = "RAFIQI_MANAGED_SYSTEM_LOCK"

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

async function protectWorkbook(sheets, account, spreadsheetId, label) {
  if (!spreadsheetId) throw new Error(`${label} spreadsheet ID is missing`)
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets(properties(sheetId,title,gridProperties),protectedRanges(protectedRangeId,description))",
  })
  const requests = []
  for (const sheet of metadata.data.sheets || []) {
    for (const protection of sheet.protectedRanges || []) {
      if (String(protection.description || "").startsWith(PREFIX)) requests.push({ deleteProtectedRange: { protectedRangeId: protection.protectedRangeId } })
    }
    const rowCount = sheet.properties.gridProperties?.rowCount || 1000
    const columnCount = sheet.properties.gridProperties?.columnCount || 26
    requests.push({ updateSheetProperties: { properties: { sheetId: sheet.properties.sheetId, tabColorStyle: { rgbColor: RED } }, fields: "tabColorStyle" } })
    requests.push({ repeatCell: { range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: "RED = BACKEND / BOT / SYSTEM. Do not edit." }, fields: "userEnteredFormat,note" } })
    requests.push({ addProtectedRange: { protectedRange: { description: `${PREFIX}: ${label} / ${sheet.properties.title}`, range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount }, warningOnly: false, editors: { users: [account.client_email] } } } })
  }
  for (let index = 0; index < requests.length; index += 350) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(index, index + 350) } })
  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets(properties(title,tabColorStyle),protectedRanges(description))" })
  const tabs = verified.data.sheets || []
  return {
    label,
    title: verified.data.properties?.title,
    tabs: tabs.length,
    protectedTabs: tabs.filter((sheet) => (sheet.protectedRanges || []).some((item) => String(item.description || "").startsWith(PREFIX))).length,
    redTabs: tabs.filter((sheet) => Number(sheet.properties.tabColorStyle?.rgbColor?.red || 0) > 0.5).length,
  }
}

async function main() {
  const account = credentials()
  const auth = new google.auth.GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const workbooks = [
    [process.env.GOOGLE_SHEET_ID, "Backend"],
    [process.env.ESSENTIALS_BOT_SHEET_ID || "1C8y3uVxp5toMwLBPGVWbltOoNX_hVuKtvyfiqIUC0oY", "Essentials Bot"],
    [process.env.SHRAM_PARK_DEMAND_BOT_SHEET_ID || "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y", "SP Demand Bot"],
  ]
  const results = []
  for (const [spreadsheetId, label] of workbooks) results.push(await protectWorkbook(sheets, account, spreadsheetId, label))
  console.log(JSON.stringify({ results, allProtected: results.every((item) => item.tabs === item.protectedTabs && item.tabs === item.redTabs) }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
