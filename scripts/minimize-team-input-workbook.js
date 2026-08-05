require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
const visibleTabs = new Set([
  "TEAM_DATA_ENTRY_HOME", "DATA_ENTRY_GUIDE", "TEAM_OCCUPANCY",
  "TEAM_FONO_SUPPLY_DEMAND", "TEAM_FINANCE_DAILY", "TEAM_MEMBER_ACTIVATION",
  "TEAM_REQ_SP_SUPPLY", "TEAM_MEMBER_FEEDBACK", "TEAM_REQ_PEOPLE_ROSTER",
  "TEAM_LEARNING_HISTORY", "Fono Funnel", "SELF_DRIVE_LEARN_GUIDE",
])
const formulaSpecs = {}
const letter = (index) => { let n = index + 1, out = ""; while (n) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26) } return out }

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,hidden)" })
  const tabs = metadata.data.sheets || []
  const formulaTabs = tabs.filter((tab) => formulaSpecs[tab.properties.title])
  const values = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: formulaTabs.map((tab) => `'${tab.properties.title}'!3:3`) })
  const formulaData = []
  formulaTabs.forEach((tab, index) => {
    const headers = (values.data.valueRanges?.[index]?.values?.[0] || []).map(String)
    const columns = Object.fromEntries(headers.map((header, column) => [header, letter(column)]))
    for (const [header, build] of Object.entries(formulaSpecs[tab.properties.title])) {
      const column = columns[header]
      if (column) formulaData.push({ range: `'${tab.properties.title}'!${column}4`, values: [[build(columns)]] })
    }
  })
  if (formulaData.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: formulaData } })
  const visibilityRequests = tabs.map((tab) => ({ updateSheetProperties: { properties: { sheetId: tab.properties.sheetId, hidden: !visibleTabs.has(tab.properties.title) }, fields: "hidden" } }))
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: visibilityRequests } })
  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title,hidden)" })
  console.log(JSON.stringify({ formulasInstalled: formulaData.map((item) => item.range), visibleTabs: verified.data.sheets?.filter((tab) => !tab.properties.hidden).map((tab) => tab.properties.title), hiddenTabs: verified.data.sheets?.filter((tab) => tab.properties.hidden).length }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
