const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")
const ExcelJS = require("exceljs")

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
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
    return String(value)
  }
  return value
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing")
  const credentialsPath = path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json")
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const workbookPath = path.join(process.cwd(), "outputs", "existing-data-audit-final-template", "Rafiqi_Existing_Data_Mapped_Final_Template.xlsx")
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(workbookPath)

  const tabMap = new Map([
    ["Occupany", "TEAM_OCCUPANCY"],
    ["FONO-Supply -Demand", "TEAM_FONO_SUPPLY_DEMAND"],
    ["Ess- Supply Manual", "TEAM_ESSENTIALS_SUMMARY"],
    ["Ess-Supply Bot", "TEAM_ESSENTIALS_BOT"],
    ["Ess.Demand-Inv Master-Manual", "TEAM_ESSENTIALS_INVENTORY"],
    ["Sharmpark Demand-Manual", "TEAM_SHRAMPARK_DEMAND"],
    ["CM", "TEAM_CM"],
    ["REQ_SP_SUPPLY", "TEAM_REQ_SP_SUPPLY"],
    ["REQ_MEMBER_ENGAGEMENT", "TEAM_REQ_MEMBER_ENGAGEMENT"],
    ["REQ_PEOPLE_ROSTER", "TEAM_REQ_PEOPLE_ROSTER"],
    ["REQ_POLICY_REGISTRY", "TEAM_REQ_POLICY_REGISTRY"],
    ["REQ_INCIDENT_LOG", "TEAM_REQ_INCIDENT_LOG"],
    ["REQ_ACTION_LOG", "TEAM_REQ_ACTION_LOG"],
    ["REQ_EVIDENCE_LOG", "TEAM_REQ_EVIDENCE_LOG"],
    ["REQ_APPROVAL_LOG", "TEAM_REQ_APPROVAL_LOG"],
  ])
  const sourceTabs = [...tabMap.values()]

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const existing = new Set((metadata.data.sheets || []).map((sheet) => sheet.properties.title))
  const missing = sourceTabs.filter((title) => !existing.has(title))
  if (!existing.has("TEAM_DATA_ENTRY_HOME")) missing.unshift("TEAM_DATA_ENTRY_HOME")
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
    })
  }

  const homeRows = [
    ["RAFIQI DAILY DATA ENTRY HOME"],
    ["Rule", "Team updates only the source tabs listed below. Do not rename headers or tabs."],
    ["Refresh", "After paste/append, use Dashboard > Data refresh. Existing UI/components remain unchanged."],
    ["Source", "Entry method", "Team action"],
    ["Occupany", "Manual Google Sheet", "Replace/append latest occupancy snapshot"],
    ["FONO-Supply -Demand", "Manual tracker", "Append/update FONO demand and supply records"],
    ["Ess- Supply Manual", "Manual summary", "Update studio-level Essentials summary"],
    ["Ess-Supply Bot", "Bot", "Bot appends rows; team corrects missing studio_id"],
    ["Ess.Demand-Inv Master-Manual", "Manual inventory", "Replace/append inventory snapshot"],
    ["Sharmpark Demand-Manual", "Manual now / bot later", "Append/update Shram Park demand"],
    ["CM", "Manual summary", "Update contribution summary"],
    ["REQ_*", "Manual until source automation", "Fill only the missing governed fields"],
  ]
  if (!existing.has("TEAM_DATA_ENTRY_HOME")) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: "TEAM_DATA_ENTRY_HOME!A1", valueInputOption: "RAW", requestBody: { values: homeRows } })
  }

  for (const [workbookTitle, title] of tabMap) {
    if (existing.has(title)) continue
    const worksheet = workbook.getWorksheet(workbookTitle)
    if (!worksheet) continue
    const values = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const output = []
      for (let column = 1; column <= worksheet.columnCount; column += 1) output.push(valueOf(row.getCell(column)))
      while (output.length && output[output.length - 1] === "") output.pop()
      values.push(output)
    })
    if (values.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${title.replace(/'/g, "''")}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      })
    }
  }

  console.log(JSON.stringify({ spreadsheetId, createdTabs: missing, populatedTabs: sourceTabs }))
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
