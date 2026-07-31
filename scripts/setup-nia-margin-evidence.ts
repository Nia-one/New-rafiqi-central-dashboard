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
    range: "TEAM_REQ_EVIDENCE_LOG!A4:L4",
  })
  const existingRow = existing.data.values?.[0] ?? []
  if (existingRow.some((value) => String(value ?? "").trim()) && existingRow[0] !== "EVD-NIA-CM2-20260731") {
    throw new Error("Evidence row 4 belongs to another record; no change made")
  }

  const now = new Date().toISOString()
  const helpers = [[
    "AUTO - Stable evidence ID",
    "AUTO - Action",
    "AUTO - Linked Action Log ID",
    "AUTO - Finance and occupancy source snapshot",
    "AUTO - Protected source Sheet reference",
    "AUTO - Action owner/uploader",
    "AUTO - Upload timestamp",
    "AUTO - CM2 calculation description",
    "REVIEW - Pending / Verified / Rejected / Stale",
    "REVIEW - Independent verifier actor ID; must differ from uploader",
    "AUTO AFTER REVIEW - Verification timestamp",
    "AUTO - Last updated timestamp",
  ]]
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=1334013869#gid=1334013869`
  const row = [[
    "EVD-NIA-CM2-20260731",
    "Action",
    '=IFERROR(TEAM_REQ_ACTION_LOG!A4,"")',
    "Finance and occupancy source snapshot",
    sourceUrl,
    '=IFERROR(TEAM_REQ_ACTION_LOG!I4,"")',
    existingRow[6] ?? now,
    '=IFERROR("Full-use CM2 "&TEXT(TEAM_REQ_ACTION_LOG!E4,"₹#,##0")&" against approved "&TEXT(TEAM_REQ_ACTION_LOG!F4,"₹#,##0")&" control; calculated impact "&TEXT(TEAM_REQ_ACTION_LOG!G4,"₹#,##0"),"")',
    existingRow[8] || "Pending",
    existingRow[9] ?? "",
    existingRow[10] ?? "",
    now,
  ]]

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "TEAM_REQ_EVIDENCE_LOG!A2:L2", values: helpers },
        { range: "TEAM_REQ_EVIDENCE_LOG!A4:L4", values: row },
      ],
    },
  })
  const verified = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "TEAM_REQ_EVIDENCE_LOG!A4:L4",
  })
  console.log(JSON.stringify(verified.data.values ?? [], null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
