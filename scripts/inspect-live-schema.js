require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" })
  const titles = (workbook.data.sheets || []).map((sheet) => sheet.properties.title)
  const data = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: titles.map((title) => `'${title}'!A1:AZ6`) })
  for (let index = 0; index < titles.length; index += 1) {
    const rows = data.data.valueRanges?.[index]?.values || []
    console.log(JSON.stringify({ tab: titles[index], headers: rows[0] || [], sampleRows: rows.slice(1, 3), rowCountSampled: Math.max(0, rows.length - 1) }))
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
