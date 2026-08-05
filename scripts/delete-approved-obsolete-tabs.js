require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

const approved = [
  "TEAM_ESSENTIALS_SUMMARY", "TEAM_CM", "TEAM_REQ_MEMBER_ENGAGEMENT", "TEAM_BOT_SHRAMPARK_DEMAND",
  "Dashboard",
  "PROD_CLEAN_ARCHIVE_2026-07-29T09-47-49", "MANUAL_INPUT_ARCHIVE_2026-07-29T11-08-13",
]
const required = [
  "TEAM_DATA_ENTRY_HOME", "SELF_DRIVE_LEARN_GUIDE", "DATA_ENTRY_GUIDE", "TEAM_OCCUPANCY",
  "Fono Funnel", "TEAM_REQ_SP_SUPPLY", "TEAM_FINANCE_DAILY", "TEAM_MEMBER_ACTIVATION",
  "TEAM_MEMBER_FEEDBACK", "TEAM_REQ_PEOPLE_ROSTER", "TEAM_LEARNING_HISTORY",
]

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const before = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index)" })
  const tabs = before.data.sheets || []
  const byTitle = new Map(tabs.map((sheet) => [sheet.properties.title, sheet.properties]))
  const missingRequired = required.filter((title) => !byTitle.has(title))
  if (missingRequired.length) throw new Error(`Required tabs missing; deletion cancelled: ${missingRequired.join(", ")}`)
  const targets = approved.map((title) => byTitle.get(title)).filter(Boolean)
  if (targets.some((properties) => !approved.includes(properties.title))) throw new Error("Resolved deletion target escaped the approved list")
  if (targets.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: targets.map((properties) => ({ deleteSheet: { sheetId: properties.sheetId } })) } })
  const after = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(title,index,hidden)" })
  const remaining = (after.data.sheets || []).sort((a, b) => a.properties.index - b.properties.index)
  const notDeleted = approved.filter((title) => remaining.some((sheet) => sheet.properties.title === title))
  const requiredAfter = required.filter((title) => !remaining.some((sheet) => sheet.properties.title === title))
  if (notDeleted.length || requiredAfter.length) throw new Error(`Verification failed. Not deleted: ${notDeleted.join(", ")}; required missing: ${requiredAfter.join(", ")}`)
  console.log(JSON.stringify({ deleted: targets.map((properties) => properties.title), alreadyAbsent: approved.filter((title) => !byTitle.has(title)), remainingCount: remaining.length, visibleOrder: remaining.filter((sheet) => !sheet.properties.hidden).map((sheet) => sheet.properties.title) }, null, 2))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
