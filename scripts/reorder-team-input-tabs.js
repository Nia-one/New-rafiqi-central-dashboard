const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

const guideOrder = ["TEAM_DATA_ENTRY_HOME", "SELF_DRIVE_LEARN_GUIDE", "DATA_ENTRY_GUIDE"]
const color = (sheet) => sheet.properties.tabColorStyle?.rgbColor || sheet.properties.tabColor || {}
const isBlack = (sheet) => {
  const c = color(sheet)
  return Number(c.red || 0) <= 0.2 && Number(c.green || 0) <= 0.2 && Number(c.blue || 0) <= 0.2
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"))
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const response = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index,hidden,tabColor,tabColorStyle)" })
  const all = response.data.sheets || []
  const guides = guideOrder.map((title) => all.find((sheet) => sheet.properties.title === title)).filter(Boolean)
  const guideIds = new Set(guides.map((sheet) => sheet.properties.sheetId))
  const remaining = all.filter((sheet) => !guideIds.has(sheet.properties.sheetId))
  const manual = remaining.filter(isBlack).sort((a, b) => a.properties.index - b.properties.index)
  const automated = remaining.filter((sheet) => !isBlack(sheet)).sort((a, b) => a.properties.index - b.properties.index)
  const ordered = [...guides, ...manual, ...automated]
  for (let index = 0; index < ordered.length; index += 1) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: ordered[index].properties.sheetId, index }, fields: "index" } }] } })
  }
  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title,index,tabColor,tabColorStyle)" })
  const finalTabs = (verified.data.sheets || []).sort((a, b) => a.properties.index - b.properties.index)
  console.log(JSON.stringify({
    spreadsheetId,
    guides: finalTabs.slice(0, guides.length).map((sheet) => sheet.properties.title),
    manualBlack: finalTabs.filter((sheet) => !guideOrder.includes(sheet.properties.title) && isBlack(sheet)).map((sheet) => sheet.properties.title),
    automatedRedOrSystem: finalTabs.filter((sheet) => !guideOrder.includes(sheet.properties.title) && !isBlack(sheet)).map((sheet) => sheet.properties.title),
  }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
