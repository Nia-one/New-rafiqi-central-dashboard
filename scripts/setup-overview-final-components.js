require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "CM_History!A1:C3",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [
      ["business_date", "actual", "captured_at"],
      ["2026-07-25", 41000, "2026-07-25T10:00:00+05:30"],
      ["2026-07-25", 43000, "2026-07-25T12:00:00+05:30"],
    ] },
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Previous_Block!A1:J2",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [
      ["snapshot_time", "cm", "contracted", "membersActive", "attach", "closures", "stockoutsClearedStudios", "stalledTheatre", "staleOwner", "staleHours"],
      ["2026-07-25T10:00:00+05:30", 41000, 400, 182, 43, 0, 0, "Deccan (Pune)", "", ""],
    ] },
  })

  const workResult = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Work_Hourly!A:AZ" })
  const workRows = workResult.data.values || []
  const originalWorkHeaders = workRows[0] || []
  const workInputColumns = ["recoverable share", "confidence", "age hours", "threshold hours"]
  const workHeaders = [...originalWorkHeaders, ...workInputColumns.filter((column) => !originalWorkHeaders.includes(column))]
  const workRowIndex = workRows.findIndex((row, index) => index > 0 && row[0] === "WRK-TEST-001")
  const columnName = (index) => {
    let value = index + 1, name = ""
    while (value > 0) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26) }
    return name
  }
  const workUpdates = workHeaders.length === originalWorkHeaders.length ? [] : [{ range: `Work_Hourly!A1:${columnName(workHeaders.length - 1)}1`, values: [workHeaders] }]
  if (workRowIndex > 0) {
    const testValues = { "recoverable share": 0.65, confidence: "Medium", "age hours": 4, "threshold hours": 3 }
    for (const column of workInputColumns) workUpdates.push({ range: `Work_Hourly!${columnName(workHeaders.indexOf(column))}${workRowIndex + 1}`, values: [[testValues[column]]] })
  }
  if (workUpdates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: workUpdates } })

  const workbook = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
  const sheetIds = new Map((workbook.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId]))
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [
      { repeatCell: { range: { sheetId: sheetIds.get("CM_History"), startRowIndex: 1, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 3 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.68 } }, note: "Operations input. Current values are TEST DATA for the two-hour recap." }, fields: "userEnteredFormat.backgroundColor,note" } },
      { repeatCell: { range: { sheetId: sheetIds.get("Previous_Block"), startRowIndex: 1, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.68 } }, note: "Operations input. Current values are TEST DATA for the previous snapshot." }, fields: "userEnteredFormat.backgroundColor,note" } },
      ...workInputColumns.map((column) => ({ repeatCell: { range: { sheetId: sheetIds.get("Work_Hourly"), startRowIndex: 1, endRowIndex: 100, startColumnIndex: workHeaders.indexOf(column), endColumnIndex: workHeaders.indexOf(column) + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.95, blue: 0.68 }, numberFormat: column === "confidence" ? { type: "TEXT", pattern: "@" } : { type: "NUMBER", pattern: column === "recoverable share" ? "0.00" : "0" } }, note: "Operations input. Current value is TEST DATA for Work action scoring." }, fields: "userEnteredFormat.backgroundColor,userEnteredFormat.numberFormat,note" } })),
    ] },
  })

  console.log("Final Overview component snapshots seeded in CM_History and Previous_Block.")
}

main().catch((error) => { console.error(error); process.exit(1) })
