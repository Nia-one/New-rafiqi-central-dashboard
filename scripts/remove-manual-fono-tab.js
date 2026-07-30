require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
const title = "TEAM_FONO_SUPPLY_DEMAND"

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => {
    try { return JSON.parse(raw) }
    catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) }
  })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const target = metadata.data.sheets?.find((sheet) => sheet.properties?.title === title)?.properties
  if (!target?.sheetId) {
    console.log(`${title} is already absent`)
    return
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteSheet: { sheetId: target.sheetId } }] },
  })
  console.log(`Deleted ${title} (sheetId ${target.sheetId})`)
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
