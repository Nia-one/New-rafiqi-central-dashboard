require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: "Constraints!A:Z" })).data.values || []
  const headers = current[0] || []
  const needed = ["ageHours", "thresholdHours", "deadlineAt"]
  const finalHeaders = [...headers, ...needed.filter((header) => !headers.includes(header))]
  if (finalHeaders.length !== headers.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: "Constraints!1:1", valueInputOption: "USER_ENTERED", requestBody: { values: [finalHeaders] } })
  const rowIndex = current.findIndex((row, index) => index > 0 && row[0] === "c001") + 1
  if (!rowIndex) throw new Error("Constraint c001 was not found")
  const column = (header) => String.fromCharCode(65 + finalHeaders.indexOf(header))
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: [
    { range: `Constraints!${column("ageHours")}${rowIndex}`, values: [[12]] },
    { range: `Constraints!${column("thresholdHours")}${rowIndex}`, values: [[24]] },
    { range: `Constraints!${column("deadlineAt")}${rowIndex}`, values: [["2026-07-25T18:00:00+05:30"]] },
    { range: `Constraints!${column("idleUnits")}${rowIndex}`, values: [[128]] },
    { range: `Constraints!${column("cmPerUnit")}${rowIndex}`, values: [[300]] },
    { range: `Constraints!${column("riskHours")}${rowIndex}`, values: [[24]] },
  ] } })
  console.log("Seeded live allocation timing fields for c001.")
}
main().catch((error) => { console.error(error); process.exit(1) })
