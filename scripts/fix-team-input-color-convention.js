const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const SPREADSHEET_ID = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
// Deprecated: the authoritative black=input/red=protected convention is applied
// by color-code-connected-sheets.js across Team Input and both Bot workbooks.
const EDITABLE_TABS = new Set([
  "TEAM_REQ_PEOPLE_ROSTER",
  "TEAM_REQ_POLICY_REGISTRY",
  "TEAM_REQ_INCIDENT_LOG",
  "TEAM_REQ_ACTION_LOG",
  "TEAM_REQ_EVIDENCE_LOG",
  "TEAM_REQ_APPROVAL_LOG",
])
const RED = { red: 0.8, green: 0.05, blue: 0.05 }
const WHITE = { red: 1, green: 1, blue: 1 }
const BLACK = { red: 0, green: 0, blue: 0 }

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: "sheets.properties(sheetId,title)" })
  const requests = []
  const expected = []

  for (const sheet of metadata.data.sheets || []) {
    const { sheetId, title } = sheet.properties
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${title.replace(/'/g, "''")}'!1:3` })
    const rows = values.data.values || []
    let headerRowIndex = rows.findIndex((row) => row.filter((cell) => String(cell || "").trim()).length >= 4 && row.some((cell) => /(?:^|\s)(?:id|at|date|status)(?:$|\s)/i.test(String(cell || "").replace(/_/g, " "))))
    if (headerRowIndex < 0) headerRowIndex = rows.findIndex((row) => row.some((cell) => String(cell || "").trim()))
    const headers = headerRowIndex >= 0 ? rows[headerRowIndex].map(String) : []
    const editable = EDITABLE_TABS.has(title)

    requests.push({
      updateSheetProperties: {
        properties: editable ? { sheetId, tabColorStyle: { rgbColor: RED } } : { sheetId, tabColorStyle: null },
        fields: "tabColorStyle",
      },
    })
    if (headers.length) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: headerRowIndex, endRowIndex: headerRowIndex + 1, startColumnIndex: 0, endColumnIndex: headers.length },
          cell: editable
            ? { userEnteredFormat: { backgroundColor: RED, textFormat: { foregroundColor: WHITE, bold: true }, wrapStrategy: "WRAP" }, note: "RED = USER INPUT. Fill or update this field; dashboard refresh consumes this tab." }
            : { userEnteredFormat: { textFormat: { foregroundColor: BLACK, bold: true }, wrapStrategy: "WRAP" }, note: "NO COLOR = DO NOT UPDATE. This tab is not part of the current User Input synchronization path." },
          fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy),note",
        },
      })
    }
    expected.push({ title, sheetId, headerRowIndex, headerCount: headers.length, editable })
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } })
  const verified = []
  for (const item of expected) {
    const check = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, includeGridData: true, ranges: [`'${item.title.replace(/'/g, "''")}'!${item.headerRowIndex + 1}:${item.headerRowIndex + 1}`], fields: "sheets(properties(tabColorStyle),data.rowData.values.userEnteredFormat.backgroundColor)" })
    const tabColor = check.data.sheets?.[0]?.properties?.tabColorStyle?.rgbColor
    const cells = check.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || []
    const redHeaders = cells.slice(0, item.headerCount).filter((cell) => (cell.userEnteredFormat?.backgroundColor?.red || 0) > 0.5 && (cell.userEnteredFormat?.backgroundColor?.green || 0) < 0.2).length
    const hasTabColor = Boolean(tabColor)
    verified.push({ tab: item.title, expected: item.editable ? "RED" : "BLANK", tab: item.title, redHeaders, headerCount: item.headerCount, passed: item.editable ? hasTabColor && redHeaders === item.headerCount : !hasTabColor && redHeaders === 0 })
  }
  console.log(JSON.stringify({ spreadsheetId: SPREADSHEET_ID, allPassed: verified.every((item) => item.passed), verified }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
