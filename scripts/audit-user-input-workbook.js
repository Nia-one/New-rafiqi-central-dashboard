require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
}

function colorName(color = {}) {
  if (Number(color.red || 0) > 0.5 && Number(color.green || 0) < 0.2) return "RED"
  if (Number(color.red || 0) < 0.2 && Number(color.green || 0) < 0.2 && Number(color.blue || 0) < 0.2) return "BLACK"
  return "OTHER"
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,index,hidden,tabColorStyle,gridProperties),protectedRanges(description,range,warningOnly))",
  })
  const tabs = (metadata.data.sheets || []).sort((a, b) => a.properties.index - b.properties.index)
  const values = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabs.map((tab) => `'${tab.properties.title.replace(/'/g, "''")}'!1:4`),
    valueRenderOption: "FORMULA",
  })
  const summary = tabs.map((tab, index) => {
    const rows = values.data.valueRanges?.[index]?.values || []
    const header = rows.reduce((best, row, rowIndex) => {
      const count = row.filter((cell) => String(cell || "").trim()).length
      return count > best.count ? { rowIndex, count, values: row } : best
    }, { rowIndex: 0, count: 0, values: [] })
    return {
      index: tab.properties.index,
      tab: tab.properties.title,
      hidden: Boolean(tab.properties.hidden),
      tabColor: colorName(tab.properties.tabColorStyle?.rgbColor),
      headerRow: header.rowIndex + 1,
      headers: header.values,
      protectedRanges: (tab.protectedRanges || []).length,
    }
  })
  console.log(JSON.stringify({ spreadsheetId, tabs: summary }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
