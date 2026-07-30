require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const APPLY = process.argv.includes("--apply")
const books = [
  { label: "canonical", id: process.env.GOOGLE_SHEET_ID },
  { label: "team-input", id: process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU" },
  { label: "demand-bot", id: process.env.SHRAM_PARK_DEMAND_BOT_SHEET_ID || "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y" },
].filter((book) => book.id)

const excludedTabs = [/archive/i, /guide/i, /schema/i, /definition/i, /mapping/i, /^setup$/i, /^settings$/i, /^sync_log$/i, /^team_data_entry_home$/i]
const markers = [
  /(^|[^a-z])test(?: data)?([^a-z]|$)/i,
  /test:\/\//i,
  /(^|[^a-z])fictional([^a-z]|$)/i,
  /(^|[^a-z])simulator([^a-z]|$)/i,
  /(^|[^a-z])demo([^a-z]|$)/i,
  /(^|[^a-z])fixture([^a-z]|$)/i,
  /(^|[^a-z])synthetic([^a-z]|$)/i,
  /(^|[-_])seed(?:ed)?([-_]|$)/i,
]
const knownSeedIds = new Set([
  "c001", "c002", "c003", "rc001", "rc002", "rc003",
  "a001", "a002", "a003", "e001", "e002", "e003",
])

function rowReasons(book, tab, row) {
  if (book.label === "demand-bot" && tab === (process.env.SHRAM_PARK_DEMAND_BOT_TAB || "Demand Visit Data")) return ["pre-production demand-bot fixture row"]
  const text = row.map((value) => String(value ?? "")).join(" | ")
  const reasons = markers.filter((pattern) => pattern.test(text)).map(String)
  const first = String(row[0] ?? "").trim().toLowerCase()
  if (book.label === "canonical" && knownSeedIds.has(first)) reasons.push(`known seeded fixture id: ${first}`)
  return reasons
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const result = []

  for (const book of books) {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: book.id, fields: "properties.title,sheets.properties(sheetId,title)" })
    const matches = []
    const candidateSheets = (metadata.data.sheets || []).filter((sheet) => !excludedTabs.some((pattern) => pattern.test(sheet.properties.title)))
    const valueResponse = await sheets.spreadsheets.values.batchGet({ spreadsheetId: book.id, ranges: candidateSheets.map((sheet) => `'${sheet.properties.title.replace(/'/g, "''")}'!A:AZ`) })
    for (const [sheetIndex, sheet] of candidateSheets.entries()) {
      const title = sheet.properties.title
      const rows = valueResponse.data.valueRanges?.[sheetIndex]?.values || []
      rows.slice(1).forEach((row, index) => {
        const reasons = rowReasons(book, title, row)
        if (reasons.length) matches.push({ sheetId: sheet.properties.sheetId, tab: title, rowNumber: index + 2, reasons, row })
      })
    }

    const summary = { label: book.label, title: metadata.data.properties.title, spreadsheetId: book.id, matchedRows: matches.length, byTab: Object.entries(matches.reduce((out, row) => ({ ...out, [row.tab]: (out[row.tab] || 0) + 1 }), {})).map(([tab, count]) => ({ tab, count })), samples: matches.slice(0, 10).map(({ tab, rowNumber, reasons, row }) => ({ tab, rowNumber, reasons, preview: row.slice(0, 5) })) }
    if (!APPLY || !matches.length) { result.push(summary); continue }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const archiveTitle = `PROD_CLEAN_ARCHIVE_${stamp}`.slice(0, 99)
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId: book.id, requestBody: { requests: [{ addSheet: { properties: { title: archiveTitle } } }] } })
    const archiveRows = [["source_tab", "source_row", "archived_at", "reason", "row_json"], ...matches.map((match) => [match.tab, match.rowNumber, new Date().toISOString(), match.reasons.join("; "), JSON.stringify(match.row)])]
    await sheets.spreadsheets.values.update({ spreadsheetId: book.id, range: `'${archiveTitle}'!A1:E${archiveRows.length}`, valueInputOption: "RAW", requestBody: { values: archiveRows } })
    const deletions = matches.sort((a, b) => a.sheetId === b.sheetId ? b.rowNumber - a.rowNumber : a.sheetId - b.sheetId).map((match) => ({ deleteDimension: { range: { sheetId: match.sheetId, dimension: "ROWS", startIndex: match.rowNumber - 1, endIndex: match.rowNumber } } }))
    for (let index = 0; index < deletions.length; index += 400) await sheets.spreadsheets.batchUpdate({ spreadsheetId: book.id, requestBody: { requests: deletions.slice(index, index + 400) } })
    result.push({ ...summary, archiveTitle, removedRows: deletions.length })
  }
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", result }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
