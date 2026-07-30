import dotenv from "dotenv"
import { google } from "googleapis"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

dotenv.config({ path: ".env.local" })
const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
const sheets = google.sheets({ version: "v4", auth })

async function main() {
  const source = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_TEAM_INPUT_SHEET_ID, range: "TEAM_ESSENTIALS_SUMMARY!A1:AZ20" })
  const backend = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "Essentials_Hourly!A1:AZ20" })
  const summarize = (rows: unknown[][]) => {
    const headers = (rows[0] || []).map(String)
    const index = headers.findIndex((header) => /weekly message status|delivery status/i.test(header))
    return { index, header: headers[index] || null, values: rows.slice(1).map((row) => row[index]).filter(Boolean) }
  }
  console.log(JSON.stringify({ source: summarize(source.data.values || []), backend: summarize(backend.data.values || []) }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
