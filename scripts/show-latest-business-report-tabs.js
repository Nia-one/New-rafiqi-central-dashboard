require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
const bases = ["Studios", "Fono Funnel", "Essentials", "Flow", "CM Actions"]
const YELLOW = { red: 1, green: 0.75, blue: 0.05 }

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index,hidden)" })
  const tabs = (metadata.data.sheets || []).map((sheet) => sheet.properties)
  const selected = []
  const stale = []

  for (const base of bases) {
    const matches = tabs
      .filter((tab) => tab.title === base || tab.title.startsWith(`${base} (`))
      .sort((a, b) => b.index - a.index)
    if (matches[0]) selected.push(matches[0])
    stale.push(...matches.slice(1))
  }

  if (!selected.length) throw new Error("No imported Business Performance Report tabs were found")
  const firstImportIndex = tabs.filter((tab) => !tab.hidden).length
  const requests = []
  selected.forEach((tab, offset) => requests.push({
    updateSheetProperties: {
      properties: { sheetId: tab.sheetId, hidden: false, tabColor: YELLOW, index: firstImportIndex + offset },
      fields: "hidden,tabColor,index",
    },
  }))
  stale.forEach((tab) => requests.push({
    updateSheetProperties: { properties: { sheetId: tab.sheetId, hidden: true }, fields: "hidden" },
  }))
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log(JSON.stringify({ visibleYellowImports: selected.map((tab) => tab.title), hiddenOlderImports: stale.map((tab) => tab.title) }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
