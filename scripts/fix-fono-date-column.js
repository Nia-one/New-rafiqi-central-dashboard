require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
  const credentials = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), raw), "utf8")) } })()
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties)" })
  const tab = metadata.data.sheets.find((sheet) => sheet.properties.title === "TEAM_FONO_SUPPLY_DEMAND")
  if (!tab) throw new Error("TEAM_FONO_SUPPLY_DEMAND tab not found")
  const sheetId = tab.properties.sheetId
  const endRowIndex = tab.properties.gridProperties?.rowCount || 1000
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } }, note: "Select the actual visit date. Required format: YYYY-MM-DD (example: 2026-07-29)." }, fields: "userEnteredFormat.numberFormat,note" } },
    { setDataValidation: { range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 0, endColumnIndex: 1 }, rule: { condition: { type: "DATE_IS_VALID" }, inputMessage: "Choose a valid date. It will display as YYYY-MM-DD.", strict: true, showCustomUi: true } } },
  ] } })
  if (process.argv.includes("--set-row-3-today")) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "TEAM_FONO_SUPPLY_DEMAND!A3",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["2026-07-29"]] },
    })
  }
  const check = await sheets.spreadsheets.values.get({ spreadsheetId, range: "TEAM_FONO_SUPPLY_DEMAND!A2:A3", valueRenderOption: "FORMATTED_VALUE" })
  console.log("Stored FONO dates:", JSON.stringify(check.data.values || []))
  console.log("TEAM_FONO_SUPPLY_DEMAND Date column now uses yyyy-mm-dd with valid-date enforcement")
}

main().catch((error) => { console.error(error); process.exit(1) })
