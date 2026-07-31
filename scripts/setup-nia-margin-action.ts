import dotenv from "dotenv"
import { google } from "googleapis"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

dotenv.config({ path: ".env.local" })

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({
    credentials: googleServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  const sheets = google.sheets({ version: "v4", auth })
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: "TEAM_REQ_ACTION_LOG!A4:O4" })
  const existingRow = existing.data.values?.[0] ?? []
  if (existingRow.some((value) => String(value ?? "").trim()) && existingRow[0] !== "ACT-NIA-CM2-20260731") {
    throw new Error("Action row 4 belongs to another action; no change made")
  }

  const now = new Date().toISOString()
  const helpers = [[
    "AUTO — Stable action ID", "OPTIONAL — Linked incident ID", "AUTO — Nia Margins recovery objective",
    "AUTO — CM2 metric", "AUTO — Current CM2 per occupied Nest", "AUTO — Approved Policy target",
    "AUTO — Total CM2 gap across occupied Nests", "AUTO — Confidence from connected inputs",
    "AUTO — Latest Finance owner", "MANUAL — Deadline, YYYY-MM-DD", "AUTO — Required independent proof",
    "AUTO — Finance approval tier", "AUTO — Open while current CM2 is below target",
    "AUTO — Created timestamp", "AUTO — Updated timestamp",
  ]]
  const row = [[
    "ACT-NIA-CM2-20260731", "", "Recover Nia Margins full-use CM2 to the approved control",
    "Full-use CM2 INR per occupied Nest",
    '=IFERROR(ROUND(SUM(TEAM_FINANCE_DAILY!N4:N)/SUM(ARRAYFORMULA(IFERROR(VALUE(SUBSTITUTE(TEAM_OCCUPANCY!H2:H,",","")),0))),0),"")',
    '=IFERROR(TEAM_REQ_POLICY_REGISTRY!E4,"")',
    '=IF(OR(E4="",F4=""),"",MAX(0,F4-E4)*SUM(ARRAYFORMULA(IFERROR(VALUE(SUBSTITUTE(TEAM_OCCUPANCY!H2:H,",","")),0))))',
    '=IF(AND(E4<>"",F4<>""),"High","")',
    '=IFERROR(LOOKUP(2,1/(TEAM_FINANCE_DAILY!O$4:O<>""),TEAM_FINANCE_DAILY!O$4:O),"")',
    existingRow[9] ?? "",
    "Finance_Daily CM2, occupied Nest source rows, and independent recovery verification",
    "Finance",
    '=IF(OR(E4="",F4=""),"Pending",IF(E4<F4,"Open","Monitoring"))',
    existingRow[13] ?? now,
    now,
  ]]

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "TEAM_REQ_ACTION_LOG!A2:O2", values: helpers },
        { range: "TEAM_REQ_ACTION_LOG!A4:O4", values: row },
      ],
    },
  })
  const verified = await sheets.spreadsheets.values.get({ spreadsheetId, range: "TEAM_REQ_ACTION_LOG!A4:O4" })
  console.log(JSON.stringify(verified.data.values ?? [], null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
