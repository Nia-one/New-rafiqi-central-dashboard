/* Writes and verifies a clearly labelled test value for the Learning history adoption rule. */
require("dotenv").config({ path: ".env.local" })

const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

const TEST_VALUE = "TEST RULE: Material changes require named human approval before release."
const TAB = "Dashboard_Content"

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const values = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:I` })).data.values || []
  const rowNumber = values.findIndex((row, index) => index > 0 && String(row[1]).toLowerCase() === "definitions" && String(row[2]).toLowerCase() === "learning_history" && String(row[3]).toLowerCase() === "adoption_rule") + 1
  if (!rowNumber) throw new Error("Dashboard_Content row Definitions | learning_history | adoption_rule was not found.")

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!E${rowNumber}:I${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[TEST_VALUE, values[rowNumber - 1][5] || "text", values[rowNumber - 1][6] || "Operations", values[rowNumber - 1][7] || "Learning_History", new Date().toISOString()]] },
  })
  const verified = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!E${rowNumber}` })).data.values?.[0]?.[0]
  if (verified !== TEST_VALUE) throw new Error(`Verification failed. Sheet returned: ${verified}`)
  console.log(`Verified ${TAB}!E${rowNumber}: ${verified}`)
}

main().catch((error) => { console.error(error); process.exit(1) })
