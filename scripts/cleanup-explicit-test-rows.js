require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const APPLY = process.argv.includes("--apply")
const spreadsheetId = process.env.GOOGLE_SHEET_ID
if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing")

const excludedTitlePatterns = [
  /policy/i, /constraint/i, /schema/i, /definition/i, /config/i, /setup/i,
  /guide/i, /home/i, /mapping/i, /master/i, /actor/i, /archive/i,
  /read me/i, /dashboard/i, /content/i, /learning/i, /^rootcause$/i,
]

const explicitTestPatterns = [
  /(^|[^a-z])test(?: data)?([^a-z]|$)/i,
  /test:\/\//i,
  /(^|[^a-z])demo([^a-z]|$)/i,
  /(^|[^a-z])fixture([^a-z]|$)/i,
  /(^|[^a-z])synthetic([^a-z]|$)/i,
  /(^|[-_])seed(?:ed)?([-_]|$)/i,
]

function isExcluded(title) {
  return excludedTitlePatterns.some((pattern) => pattern.test(title))
}

function explicitMarkers(row) {
  const identity = row.slice(0, 5).map((value) => String(value || "")).join(" | ")
  const fullRow = row.map((value) => String(value || "")).join(" | ")
  return explicitTestPatterns
    .filter((pattern) => pattern.test(identity) || (String(pattern) === String(/test:\/\//i) && pattern.test(fullRow)))
    .map(String)
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.rowCount)" })
  const tabs = (metadata.data.sheets || []).map((sheet) => sheet.properties).filter(Boolean)
  const report = []
  const deletions = []

  for (const tab of tabs) {
    if (isExcluded(tab.title)) {
      report.push({ tab: tab.title, excluded: true, matches: 0 })
      continue
    }
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab.title.replace(/'/g, "''")}'!A:AZ` })
    const values = response.data.values || []
    const matches = []
    values.slice(1).forEach((row, index) => {
      const markers = explicitMarkers(row)
      if (markers.length) matches.push({ rowNumber: index + 2, markers, preview: row.slice(0, 5), values: row })
    })
    report.push({
      tab: tab.title,
      excluded: false,
      rows: Math.max(0, values.length - 1),
      matches: matches.length,
      sample: matches.slice(0, 3).map(({ rowNumber, markers, preview }) => ({ rowNumber, markers, preview })),
    })
    if (matches.length) deletions.push({ sheetId: tab.sheetId, title: tab.title, rows: matches })
  }

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    spreadsheetId,
    scannedTabs: tabs.length,
    affectedTabs: deletions.length,
    explicitTestRows: deletions.reduce((sum, item) => sum + item.rows.length, 0),
    report: report.filter((item) => item.matches || item.excluded),
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: summary.mode,
      spreadsheetId: summary.spreadsheetId,
      scannedTabs: summary.scannedTabs,
      affectedTabs: summary.affectedTabs,
      explicitTestRows: summary.explicitTestRows,
      report: summary.report.filter((item) => item.matches),
    }, null, 2))
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const archiveTitle = `TEST_DATA_ARCHIVE_${stamp.slice(0, 19)}`
  const add = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: archiveTitle } } }] } })
  const archiveSheetId = add.data.replies?.[0]?.addSheet?.properties?.sheetId
  if (archiveSheetId === undefined) throw new Error("Archive tab creation failed")

  const archiveRows = [["source_tab", "source_row", "archived_at", "row_json"]]
  for (const deletion of deletions) {
    for (const row of deletion.rows) archiveRows.push([deletion.title, row.rowNumber, new Date().toISOString(), JSON.stringify(row.values)])
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${archiveTitle}'!A1:D${archiveRows.length}`, valueInputOption: "RAW", requestBody: { values: archiveRows } })

  const requests = []
  for (const deletion of deletions) {
    for (const row of [...deletion.rows].sort((a, b) => b.rowNumber - a.rowNumber)) {
      requests.push({ deleteDimension: { range: { sheetId: deletion.sheetId, dimension: "ROWS", startIndex: row.rowNumber - 1, endIndex: row.rowNumber } } })
    }
  }
  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log(JSON.stringify({ ...summary, archiveTitle, deletedRows: requests.length }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
