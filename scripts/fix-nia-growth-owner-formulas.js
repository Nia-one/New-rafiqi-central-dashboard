require("dotenv").config({ path: ".env.local" })
const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")
function credentials() { const source = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"; try { return JSON.parse(source) } catch { return JSON.parse(fs.readFileSync(path.join(process.cwd(), source), "utf8")) } }
async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const formulas = [
    ['=IFERROR("ACT-"&REGEXREPLACE(UPPER(INDEX(FILTER(TEAM_OWNER_REGISTRY!F:F,TEAM_OWNER_REGISTRY!B:B="FONO Supply",TEAM_OWNER_REGISTRY!E:E="Owner",TEAM_OWNER_REGISTRY!J:J="Active"),1)),"[^A-Z0-9]+","-"),"ACT-UNASSIGNED")'],
    ['=IF(COUNTIFS(TEAM_OWNER_REGISTRY!B:B,"SP Supply",TEAM_OWNER_REGISTRY!E:E,"Owner",TEAM_OWNER_REGISTRY!J:J,"Active")>0,"ACT-SP-THEATRE-OWNERS","ACT-UNASSIGNED")'],
  ]
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "'TEAM_NIA_GROWTH'!F4:F5", valueInputOption: "USER_ENTERED", requestBody: { values: formulas } })
  const check = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TEAM_NIA_GROWTH'!A3:F5", valueRenderOption: "FORMATTED_VALUE" })
  console.log(JSON.stringify({ spreadsheetId, tab: "TEAM_NIA_GROWTH", values: check.data.values }, null, 2))
}
main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
