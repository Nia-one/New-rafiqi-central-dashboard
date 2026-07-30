require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const { google } = require("googleapis")

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(raw, "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU"
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "TEAM_ESSENTIALS_INVENTORY!A2:AZ" })
  console.log(JSON.stringify({ clearedBotRowsFromManualTab: "TEAM_ESSENTIALS_INVENTORY!A2:AZ" }))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
