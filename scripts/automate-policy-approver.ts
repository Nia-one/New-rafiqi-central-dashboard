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
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "TEAM_REQ_POLICY_REGISTRY!A4:K4",
  })
  const row = existing.data.values?.[0] ?? []
  if (!String(row[0] ?? "").trim()) throw new Error("Policy row 4 has no policy_id")
  if (String(row[10] ?? "").trim()) throw new Error("Policy row 4 already has an approver; no change made")

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: "TEAM_REQ_POLICY_REGISTRY!K2",
          values: [["AUTO — Latest non-empty Finance owner from TEAM_FINANCE_DAILY Updated By. Do not enter manually."]],
        },
        {
          range: "TEAM_REQ_POLICY_REGISTRY!K4",
          values: [["=IF(A4=\"\",\"\",IFERROR(LOOKUP(2,1/(TEAM_FINANCE_DAILY!O$4:O<>\"\"),TEAM_FINANCE_DAILY!O$4:O),\"\"))"]],
        },
      ],
    },
  })

  const verified = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "TEAM_REQ_POLICY_REGISTRY!A4:K4",
  })
  console.log(JSON.stringify(verified.data.values ?? [], null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
