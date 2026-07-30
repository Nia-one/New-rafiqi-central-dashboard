require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
  const result = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: true, ranges: ["SELF_DRIVE_LEARN_GUIDE!A1:J6"], fields: "sheets(properties(title,hidden,tabColorStyle,gridProperties),merges,data.rowData.values(effectiveValue,effectiveFormat.backgroundColor))" })
  const tab = result.data.sheets?.[0]
  const color = tab?.properties?.tabColorStyle?.rgbColor || {}
  const values = tab?.data?.[0]?.rowData || []
  const text = (cell) => cell?.effectiveValue?.stringValue || ""
  const header = values[2]?.values || []
  console.log(JSON.stringify({
    tab: tab?.properties?.title,
    visible: tab?.properties?.hidden !== true,
    redTab: (color.red || 0) > .5 && (color.green || 0) < .2,
    frozenRows: tab?.properties?.gridProperties?.frozenRowCount,
    gridlinesHidden: tab?.properties?.gridProperties?.hideGridlines,
    mergedTitleRows: tab?.merges?.length || 0,
    title: text(values[0]?.values?.[0]),
    subtitle: text(values[1]?.values?.[0]),
    headerCount: header.filter((cell) => text(cell)).length,
    sampleComponent: text(values[3]?.values?.[2]),
  }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
