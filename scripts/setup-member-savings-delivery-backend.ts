import dotenv from "dotenv"
import { google } from "googleapis"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

dotenv.config({ path: ".env.local" })
const TAB = "Essentials_Hourly"
const HEADER = "weekly message status"
const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
const sheets = google.sheets({ version: "v4", auth })

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.columnCount)" })
  const property = metadata.data.sheets?.find((sheet) => sheet.properties?.title === TAB)?.properties
  if (property?.sheetId == null) throw new Error(`${TAB} not found`)
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!1:1` })
  const headers = (response.data.values?.[0] || []).map(String)
  let index = headers.findIndex((header) => header.trim().toLowerCase() === HEADER)
  if (index < 0) {
    index = headers.length
    const columnCount = property.gridProperties?.columnCount || 0
    if (index >= columnCount) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId: property.sheetId, dimension: "COLUMNS", length: index - columnCount + 1 } }] } })
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${TAB}!${column(index)}1`, valueInputOption: "RAW", requestBody: { values: [[HEADER]] } })
  }
  console.log(JSON.stringify({ tab: TAB, header: HEADER, column: column(index) }))
}

function column(index: number) {
  let value = index + 1, result = ""
  while (value) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26) }
  return result
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
