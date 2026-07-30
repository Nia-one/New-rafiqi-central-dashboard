const fs = require("fs")
const path = require("path")
const ExcelJS = require("exceljs")
const { google } = require("googleapis")

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

function primitive(value) {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value !== "object") return value
  if (Object.prototype.hasOwnProperty.call(value, "result")) return primitive(value.result)
  if (value.text) return value.text
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("")
  if (value.hyperlink) return value.text || value.hyperlink
  return ""
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const reportPath = process.argv[2]
  if (!reportPath || !fs.existsSync(reportPath)) throw new Error("Pass the daily Business Performance Report .xlsx path")
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(reportPath)
  const wanted = ["Studios", "Fono Funnel", "Essentials", "Flow", "CM Actions"]
  let metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const byTitle = new Map((metadata.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties]))
  const imported = []
  for (const title of wanted) {
    const source = workbook.getWorksheet(title)
    if (!source) continue
    let target = byTitle.get(title)
    if (!target) {
      const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title, tabColor: { red: 0.95, green: 0.72, blue: 0.12 } } } }] } })
      target = added.data.replies[0].addSheet.properties
      byTitle.set(title, target)
    }
    const rows = Array.from({ length: source.rowCount }, (_, rowIndex) => Array.from({ length: source.columnCount }, (_, columnIndex) => primitive(source.getRow(rowIndex + 1).getCell(columnIndex + 1).value)))
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${title.replace(/'/g, "''")}'!A:AZ` })
    if (rows.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${title.replace(/'/g, "''")}'!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: rows } })
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: target.sheetId, tabColor: { red: 0.95, green: 0.72, blue: 0.12 }, gridProperties: { frozenRowCount: title === "Essentials" || title === "Flow" ? 4 : 3 } }, fields: "tabColor,gridProperties.frozenRowCount" } }] } })
    imported.push({ title, rows: rows.length, columns: source.columnCount })
  }
  console.log(JSON.stringify({ spreadsheetId, reportPath, imported }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
