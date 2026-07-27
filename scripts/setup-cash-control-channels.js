require("dotenv").config({ path: ".env.local", quiet: true })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const tab = "Cash_Control_Channels"
const headers = ["candidate id", "channel", "expected verified cm inr", "required cash inr", "expected hours to outcome", "evidence ref", "data freshness", "independently verified", "quarantined", "active", "updated at", "notes"]
const rows = [
  ["CC-CHANNEL-TEST-001", "Enterprise readiness", 625000, 115000, 68, "protected://evidence/enterprise-ramp", "Current", true, false, true, "2026-07-26T10:30:00+05:30", "TEST DATA - replace with verified Operations evidence"],
  ["CC-CHANNEL-TEST-002", "FONO verified fills", 345000, 76000, 42, "protected://evidence/fono-ramp", "Current", true, false, true, "2026-07-26T10:30:00+05:30", "TEST DATA - reuses the FONO operating channel"],
]

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  let sheet = metadata.data.sheets?.find((entry) => entry.properties.title === tab)
  if (!sheet) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } })
    sheet = added.data.replies?.[0]?.addSheet
  }
  const existing = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:Z` })).data.values || []
  if (!existing.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1:L3`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers, ...rows] } })
  else {
    const idIndex = existing[0].indexOf("candidate id")
    if (idIndex < 0) throw new Error(`${tab} exists but its required headers do not match`)
    const ids = new Set(existing.slice(1).map((row) => row[idIndex]))
    const missing = rows.filter((row) => !ids.has(row[0]))
    if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${tab}!A:L`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: missing } })
    for (const seed of rows) {
      const rowIndex = existing.slice(1).findIndex((row) => row[idIndex] === seed[0])
      if (rowIndex >= 0) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A${rowIndex + 2}:L${rowIndex + 2}`, valueInputOption: "USER_ENTERED", requestBody: { values: [seed] } })
    }
  }

  const sheetId = sheet.properties?.sheetId
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: .85, green: .9, blue: 1 } } }, fields: "userEnteredFormat(textFormat,backgroundColor)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: .95, blue: .8 } } }, fields: "userEnteredFormat.backgroundColor" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { note: "OPS INPUT · Self Drive → Cash & Control → Monthly control path and Channel recommendation. Use one row per evidence-backed channel. INR columns must be numbers; freshness must be Current/Stale/Quarantined; verified/quarantined/active must be TRUE/FALSE." }, fields: "note" } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
  ] } })

  const guide = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K" })).data.values || []
  const keys = new Set(guide.slice(1).map((row) => `${row[0]}|${row[1]}`))
  const guideRows = headers.filter((header) => !keys.has(`${tab}|${header}`)).map((header) => [tab, header, "One row per evidence-backed channel", "When verified channel evidence changes", formatFor(header), "Cash & Control", "Monthly control path; Channel recommendation", "OPS INPUT", "Yellow cells are entered by Operations; rankings and efficiency are calculated by the dashboard.", rows[0][headers.indexOf(header)], "Visible column"])
  if (guideRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "DATA_ENTRY_GUIDE!A:K", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: guideRows } })
  console.log(JSON.stringify({ tab, rows: rows.length, guideRowsAdded: guideRows.length }, null, 2))
}

function formatFor(header) {
  if (header.includes(" inr") || header.includes("hours")) return "Number without symbols or commas"
  if (["independently verified", "quarantined", "active"].includes(header)) return "TRUE or FALSE"
  if (header === "updated at") return "ISO 8601 timestamp"
  if (header === "data freshness") return "Current, Stale, or Quarantined"
  return "Text"
}

main().catch((error) => { console.error(error?.response?.data || error); process.exit(1) })
