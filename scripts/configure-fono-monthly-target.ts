import "dotenv/config"
import { google } from "googleapis"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "1e54fm3oUeseNzsTFG8O4XweRnWVU2n8OvBc7MLOu6nE"
const title = "Fono Funnel"
const normal = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const [meta, read] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title}'!A1:AM80`, valueRenderOption: "FORMATTED_VALUE" }),
  ])
  const rows = (read.data.values || []) as unknown[][]
  const headerRow = rows.findIndex((row) => row.map(normal).includes("date") && row.map(normal).includes("stage after") && row.map(normal).includes("nests potential"))
  if (headerRow < 0) throw new Error("Fono Funnel headers not found")
  const headers = rows[headerRow].map(String)
  let column = headers.findIndex((header) => normal(header) === "monthly fono target")
  if (column < 0) column = headers.length
  const dateColumn = headers.findIndex((header) => normal(header) === "date")
  const stageColumn = headers.findIndex((header) => normal(header) === "stage after")
  const activeStages = new Set(["lead", "contracting", "contracted", "onboarded (takeover pending)"])
  const targetRow = rows.findIndex((row, index) => index > headerRow && String(row[dateColumn] ?? "").trim() && activeStages.has(normal(row[stageColumn])) && !row.some((cell) => /sample|do not count/i.test(String(cell ?? ""))))
  if (targetRow < 0) throw new Error("No governed FONO row available for the monthly target")
  const letter = (index: number) => { let n = index + 1, result = ""; while (n) { n--; result = String.fromCharCode(65 + n % 26) + result; n = Math.floor(n / 26) } return result }
  const col = letter(column)
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${title}'!${col}${headerRow + 2}:${col}80` })
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: [
    { range: `'${title}'!${col}${headerRow + 1}`, values: [["Monthly_FONO_Target"]] },
    { range: `'${title}'!${col}${targetRow + 1}`, values: [[1700]] },
  ] } })
  const sheetId = meta.data.sheets?.find((sheet) => sheet.properties?.title === title)?.properties?.sheetId
  if (sheetId == null) throw new Error("Fono Funnel sheet id not found")
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { repeatCell: { range: { sheetId, startRowIndex: headerRow, endRowIndex: headerRow + 1, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.05, green: 0.05, blue: 0.05 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, horizontalAlignment: "CENTER", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: targetRow, endRowIndex: targetRow + 1, startColumnIndex: column, endColumnIndex: column + 1 }, cell: { note: "MANUAL INPUT: company-wide monthly FONO and Member Adds target. Enter once per reporting month; do not repeat for every Studio.", userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.65 }, numberFormat: { type: "NUMBER", pattern: "0" } } }, fields: "note,userEnteredFormat" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: column, endIndex: column + 1 }, properties: { pixelSize: 150 }, fields: "pixelSize" } },
  ] } })
  console.log(JSON.stringify({ spreadsheetId, tab: title, header: `${col}${headerRow + 1}`, targetCell: `${col}${targetRow + 1}`, target: 1700 }))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
