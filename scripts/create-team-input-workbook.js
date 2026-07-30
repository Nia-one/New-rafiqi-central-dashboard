const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")
const ExcelJS = require("exceljs")

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

function valueOf(cell) {
  const value = cell.value
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") {
    if (value.text) return value.text
    if (value.result != null) return value.result
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("")
  }
  return String(value)
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"] })
  const sheets = google.sheets({ version: "v4", auth })
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path.join(process.cwd(), "outputs", "existing-data-audit-final-template", "Rafiqi_Existing_Data_Mapped_Final_Template.xlsx"))
  const tabMap = new Map([
    ["Occupany", "TEAM_OCCUPANCY"], ["FONO-Supply -Demand", "TEAM_FONO_SUPPLY_DEMAND"],
    ["Ess- Supply Manual", "TEAM_ESSENTIALS_SUMMARY"], ["Ess-Supply Bot", "TEAM_ESSENTIALS_BOT"],
    ["Ess.Demand-Inv Master-Manual", "TEAM_ESSENTIALS_INVENTORY"], ["Sharmpark Demand-Manual", "TEAM_SHRAMPARK_DEMAND"],
    ["CM", "TEAM_CM"], ["REQ_SP_SUPPLY", "TEAM_REQ_SP_SUPPLY"], ["REQ_MEMBER_ENGAGEMENT", "TEAM_REQ_MEMBER_ENGAGEMENT"],
    ["REQ_PEOPLE_ROSTER", "TEAM_REQ_PEOPLE_ROSTER"], ["REQ_POLICY_REGISTRY", "TEAM_REQ_POLICY_REGISTRY"],
    ["REQ_INCIDENT_LOG", "TEAM_REQ_INCIDENT_LOG"], ["REQ_ACTION_LOG", "TEAM_REQ_ACTION_LOG"],
    ["REQ_EVIDENCE_LOG", "TEAM_REQ_EVIDENCE_LOG"], ["REQ_APPROVAL_LOG", "TEAM_REQ_APPROVAL_LOG"],
  ])
  const titles = ["TEAM_DATA_ENTRY_HOME", ...tabMap.values()]
  const spreadsheetId = process.argv[2]
  if (!spreadsheetId) throw new Error("Pass the destination spreadsheet ID")
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title)" })
  const existing = new Set((metadata.data.sheets || []).map(sheet => sheet.properties.title))
  const missing = titles.filter(title => !existing.has(title))
  if (missing.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: missing.map(title => ({ addSheet: { properties: { title } } })) } })
  const home = [["RAFIQI TEAM DAILY INPUT — LIVE"], ["Rule", "Update only these tabs. Never rename headers or tabs."], ["Refresh", "After data entry, click Data refresh on the dashboard."], ["Safety", "Sync is key-based safe upsert; canonical backend rows are never cleared."], ["Dashboard UI", "No UI/component/layout changes are made by this workbook."]]
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "TEAM_DATA_ENTRY_HOME!A1", valueInputOption: "RAW", requestBody: { values: home } })
  for (const [sourceTitle, targetTitle] of tabMap) {
    const ws = workbook.getWorksheet(sourceTitle)
    if (!ws) continue
    const values = []
    ws.eachRow({ includeEmpty: false }, row => {
      const output = []
      for (let i = 1; i <= ws.columnCount; i++) output.push(valueOf(row.getCell(i)))
      while (output.length && output[output.length - 1] === "") output.pop()
      values.push(output)
    })
    if (values.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${targetTitle}'!A1`, valueInputOption: "USER_ENTERED", requestBody: { values } })
  }
  console.log(JSON.stringify({ spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` }))
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1 })
