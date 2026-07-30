require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const APPLY = process.argv.includes("--apply")
const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
const manualTabs = new Set([
  "TEAM_OCCUPANCY", "TEAM_FONO_SUPPLY_DEMAND", "TEAM_ESSENTIALS_SUMMARY",
  "TEAM_SHRAMPARK_DEMAND", "TEAM_CM", "TEAM_REQ_SP_SUPPLY",
  "TEAM_REQ_MEMBER_ENGAGEMENT", "TEAM_REQ_PEOPLE_ROSTER", "TEAM_REQ_POLICY_REGISTRY",
  "TEAM_REQ_INCIDENT_LOG", "TEAM_REQ_ACTION_LOG", "TEAM_REQ_EVIDENCE_LOG",
  "TEAM_REQ_APPROVAL_LOG",
])

function headerRowIndex(rows) {
  const likely = rows.slice(0, 3).findIndex((row) => row.filter((cell) => String(cell || "").trim()).length >= 4 && row.some((cell) => /(?:^|\s)(?:id|at|date|status)(?:$|\s)/i.test(String(cell || "").replace(/_/g, " "))))
  return likely >= 0 ? likely : rows.findIndex((row) => row.some((cell) => String(cell || "").trim()))
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets.properties(sheetId,title)" })
  const targets = (metadata.data.sheets || []).filter((sheet) => manualTabs.has(sheet.properties.title))
  const values = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: targets.map((sheet) => `'${sheet.properties.title}'!A:AZ`) })
  const removals = []
  targets.forEach((sheet, index) => {
    const rows = values.data.valueRanges?.[index]?.values || []
    const headerIndex = headerRowIndex(rows)
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      if (row.some((cell) => String(cell ?? "").trim())) removals.push({ sheetId: sheet.properties.sheetId, tab: sheet.properties.title, rowNumber: headerIndex + offset + 2, row })
    })
  })
  const summary = { workbook: metadata.data.properties.title, spreadsheetId, rowsToRemove: removals.length, byTab: Object.entries(removals.reduce((out, row) => ({ ...out, [row.tab]: (out[row.tab] || 0) + 1 }), {})).map(([tab, count]) => ({ tab, count })) }
  if (!APPLY || !removals.length) { console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", ...summary }, null, 2)); return }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const archiveTitle = `MANUAL_INPUT_ARCHIVE_${stamp}`
  const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: archiveTitle } } }] } })
  const archiveSheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId
  const archiveRows = [["source_tab", "source_row", "archived_at", "row_json"], ...removals.map((item) => [item.tab, item.rowNumber, new Date().toISOString(), JSON.stringify(item.row)])]
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${archiveTitle}'!A1:D${archiveRows.length}`, valueInputOption: "RAW", requestBody: { values: archiveRows } })
  const deletions = removals.sort((a, b) => a.sheetId === b.sheetId ? b.rowNumber - a.rowNumber : a.sheetId - b.sheetId).map((item) => ({ deleteDimension: { range: { sheetId: item.sheetId, dimension: "ROWS", startIndex: item.rowNumber - 1, endIndex: item.rowNumber } } }))
  for (let index = 0; index < deletions.length; index += 400) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: deletions.slice(index, index + 400) } })
  if (archiveSheetId != null) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: archiveSheetId, tabColorStyle: { rgbColor: { red: 0.8, green: 0.05, blue: 0.05 } } }, fields: "tabColorStyle" } }] } })
  console.log(JSON.stringify({ mode: "apply", ...summary, removedRows: deletions.length, archiveTitle }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
