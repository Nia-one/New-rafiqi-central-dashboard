const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TEAM_SHEET_ID = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
const ESSENTIALS_SHEET_ID = process.env.ESSENTIALS_BOT_SHEET_ID || "1C8y3uVxp5toMwLBPGVWbltOoNX_hVuKtvyfiqIUC0oY"
const DEMAND_SHEET_ID = process.env.SHRAM_PARK_DEMAND_BOT_SHEET_ID || "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y"

const BLACK = { red: 0.05, green: 0.05, blue: 0.05 }
const RED = { red: 0.8, green: 0.05, blue: 0.05 }
const WHITE = { red: 1, green: 1, blue: 1 }

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

const norm = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")
const editableTeamTabs = new Set([
  "TEAM_OCCUPANCY", "TEAM_FONO_SUPPLY_DEMAND", "TEAM_ESSENTIALS_SUMMARY",
])
const protectedTeamHeaders = new Map([
  ["TEAM_OCCUPANCY", new Set(["dashboard record id", "as of at", "location id", "supply model", "source updated at"])],
  ["TEAM_FONO_SUPPLY_DEMAND", new Set(["dashboard record id", "enterprise id", "plant id", "headcount required", "headcount matched", "activation required at", "certainty", "owner actor id", "source updated at"])],
])
const essentialsEditable = {
  Orders: new Set(["payment collected at", "collected amount"]),
  Order_Items: new Set(["direct fulfilment cost", "packaging cost", "delivery cost"]),
  Delivery_Status: new Set(["dispatched at", "delivered at", "delivery status", "delivery owner"]),
}
const demandEditable = new Set(["activation required at", "headcount matched", "monthly wage inr", "latitude", "longitude"])

function colorRequest(sheetId, rowIndex, columnIndex, color, editable) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
      cell: {
        userEnteredFormat: { backgroundColor: color, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" },
        note: editable ? "BLACK = TEAM INPUT. This field is consumed by the dashboard synchronization path." : "RED = SYSTEM / BOT / FORMULA / NOT CONNECTED. Do not edit this field.",
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy),note",
    },
  }
}

async function readBook(sheets, spreadsheetId) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets.properties(sheetId,title,gridProperties)" })
  const sourceSheets = metadata.data.sheets || []
  const valuesResponse = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: sourceSheets.map((sheet) => `'${sheet.properties.title.replace(/'/g, "''")}'!1:3`) })
  const tabs = []
  for (const [sheetIndex, sheet] of sourceSheets.entries()) {
    const title = sheet.properties.title
    const rows = valuesResponse.data.valueRanges?.[sheetIndex]?.values || []
    let headerRowIndex = rows.findIndex((row) => row.filter((cell) => String(cell || "").trim()).length >= 4 && row.some((cell) => /(?:^|\s)(?:id|at|date|status)(?:$|\s)/i.test(String(cell || "").replace(/_/g, " "))))
    if (headerRowIndex < 0) headerRowIndex = rows.findIndex((row) => row.some((cell) => String(cell || "").trim()))
    tabs.push({ title, sheetId: sheet.properties.sheetId, rowCount: sheet.properties.gridProperties?.rowCount || 1000, headerRowIndex, headers: headerRowIndex >= 0 ? rows[headerRowIndex].map(String) : [] })
  }
  return { title: metadata.data.properties.title, tabs }
}

async function formatBook(sheets, spreadsheetId, kind) {
  const book = await readBook(sheets, spreadsheetId)
  const requests = []
  const summary = []
  for (const tab of book.tabs) {
    let editableColumns = new Set()
    if (kind === "team" && editableTeamTabs.has(tab.title)) {
      const protectedHeaders = protectedTeamHeaders.get(tab.title) || new Set()
      editableColumns = new Set(tab.headers.map((header, index) => protectedHeaders.has(norm(header)) ? -1 : index).filter((index) => index >= 0))
    }
    if (kind === "essentials") editableColumns = new Set(tab.headers.map((header, index) => essentialsEditable[tab.title]?.has(norm(header)) ? index : -1).filter((index) => index >= 0))
    if (kind === "demand" && tab.title === (process.env.SHRAM_PARK_DEMAND_BOT_TAB || "Demand Visit Data")) editableColumns = new Set(tab.headers.map((header, index) => demandEditable.has(norm(header)) ? index : -1).filter((index) => index >= 0))
    const tabEditable = editableColumns.size > 0
    requests.push({ updateSheetProperties: { properties: { sheetId: tab.sheetId, tabColorStyle: { rgbColor: tabEditable ? BLACK : RED }, gridProperties: { frozenRowCount: Math.max(1, tab.headerRowIndex + 1) } }, fields: "tabColorStyle,gridProperties.frozenRowCount" } })
    tab.headers.forEach((_, index) => requests.push(colorRequest(tab.sheetId, tab.headerRowIndex, index, editableColumns.has(index) ? BLACK : RED, editableColumns.has(index))))
    summary.push({ tab: tab.title, tabColor: tabEditable ? "BLACK" : "RED", headerRow: tab.headerRowIndex + 1, editableHeaders: tab.headers.filter((_, index) => editableColumns.has(index)), protectedHeaders: tab.headers.filter((_, index) => !editableColumns.has(index)) })
  }
  for (let index = 0; index < requests.length; index += 400) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(index, index + 400) } })
  }
  return { spreadsheetId, title: book.title, summary }
}

function colorName(color) {
  if (!color) return "NONE"
  return (color.red || 0) > 0.5 && (color.green || 0) < 0.2 ? "RED" : (color.red || 0) < 0.2 && (color.green || 0) < 0.2 && (color.blue || 0) < 0.2 ? "BLACK" : "OTHER"
}

async function verifyBook(sheets, formatted) {
  const response = await sheets.spreadsheets.get({ spreadsheetId: formatted.spreadsheetId, includeGridData: true, fields: "sheets(properties(sheetId,title,tabColorStyle),data(startRow,startColumn,rowData.values.userEnteredFormat.backgroundColor))" })
  const expected = new Map(formatted.summary.map((item) => [item.tab, item]))
  const checks = []
  for (const sheet of response.data.sheets || []) {
    const item = expected.get(sheet.properties.title)
    if (!item) continue
    const row = sheet.data?.[0]?.rowData?.[item.headerRow - 1]?.values || []
    const actualHeaders = row.slice(0, item.editableHeaders.length + item.protectedHeaders.length).map((cell) => colorName(cell.userEnteredFormat?.backgroundColor))
    const wantedHeaders = [...Array(item.editableHeaders.length).fill("BLACK"), ...Array(item.protectedHeaders.length).fill("RED")]
    const blackCount = actualHeaders.filter((value) => value === "BLACK").length
    const redCount = actualHeaders.filter((value) => value === "RED").length
    checks.push({ tab: item.tab, tabColor: colorName(sheet.properties.tabColorStyle?.rgbColor), expectedTabColor: item.tabColor, blackHeaders: blackCount, redHeaders: redCount, expectedBlackHeaders: item.editableHeaders.length, expectedRedHeaders: item.protectedHeaders.length, passed: colorName(sheet.properties.tabColorStyle?.rgbColor) === item.tabColor && blackCount === wantedHeaders.filter((v) => v === "BLACK").length && redCount === wantedHeaders.filter((v) => v === "RED").length })
  }
  return checks
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const formatted = []
  for (const [spreadsheetId, kind] of [[TEAM_SHEET_ID, "team"], [ESSENTIALS_SHEET_ID, "essentials"], [DEMAND_SHEET_ID, "demand"]]) formatted.push(await formatBook(sheets, spreadsheetId, kind))
  const verification = []
  for (const book of formatted) verification.push({ title: book.title, checks: await verifyBook(sheets, book) })
  console.log(JSON.stringify({ formatted, verification, allPassed: verification.every((book) => book.checks.every((check) => check.passed)) }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
