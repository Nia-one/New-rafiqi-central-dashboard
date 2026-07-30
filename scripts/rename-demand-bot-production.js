require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

async function main() {
  const spreadsheetId = process.env.SHRAM_PARK_DEMAND_BOT_SHEET_ID || "1cF4YdD3ydSwqhKCN5KzSV3CdATLZaiTR-Gu0Xm39d9Y"
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSpreadsheetProperties: { properties: { title: "Nia Demand Bot — Live" }, fields: "title" } }] } })
  const verified = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title" })
  console.log(JSON.stringify({ spreadsheetId, title: verified.data.properties.title, passed: verified.data.properties.title === "Nia Demand Bot — Live" }))
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
