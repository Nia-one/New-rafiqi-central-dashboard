require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

const targets = [
  "TEAM_ESSENTIALS_SUMMARY", "TEAM_CM", "TEAM_REQ_MEMBER_ENGAGEMENT", "TEAM_BOT_SHRAMPARK_DEMAND",
  "Dashboard", "Curry", "Studio Check In_Out", "Daily Studio Log",
  "PROD_CLEAN_ARCHIVE_2026-07-29T09-47-49", "MANUAL_INPUT_ARCHIVE_2026-07-29T11-08-13",
]

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title)" })
  const kept = (metadata.data.sheets || []).filter((sheet) => !targets.includes(sheet.properties.title))
  const result = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: kept.map((sheet) => `'${sheet.properties.title.replace(/'/g, "''")}'!A1:AZ2000`),
    valueRenderOption: "FORMULA",
  })
  const references = Object.fromEntries(targets.map((target) => [target, []]))
  ;(result.data.valueRanges || []).forEach((range, sheetIndex) => (range.values || []).forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (typeof value !== "string" || !value.startsWith("=")) return
    for (const target of targets) if (value.toLowerCase().includes(target.toLowerCase())) references[target].push({
      from: kept[sheetIndex].properties.title,
      row: rowIndex + 1,
      column: columnIndex + 1,
      formula: value.slice(0, 220),
    })
  })))
  console.log(JSON.stringify(references, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
