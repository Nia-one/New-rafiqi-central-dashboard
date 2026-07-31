import dotenv from "dotenv"
import { google } from "googleapis"
import { googleServiceAccountCredentials } from "../lib/googleCredentials"

dotenv.config({ path: ".env.local" })

const specs = [
  { tab: "TEAM_REQ_EVIDENCE_LOG", headerRow: 3, header: "verification_status", values: ["Pending", "Verified", "Rejected", "Stale"] },
  { tab: "TEAM_MEMBER_ACTIVATION", headerRow: 1, header: "verification status", values: ["Pending", "Verified", "Rejected", "Stale"] },
  { tab: "TEAM_REQ_POLICY_REGISTRY", headerRow: 3, header: "status", values: ["Draft", "Approved", "Retired"] },
  { tab: "TEAM_REQ_INCIDENT_LOG", headerRow: 3, header: "state", values: ["Open", "Investigating", "Resolved", "Closed"] },
  { tab: "TEAM_REQ_APPROVAL_LOG", headerRow: 3, header: "decision", values: ["Pending", "Approved", "Rejected"] },
  { tab: "TEAM_REQ_APPROVAL_LOG", headerRow: 3, header: "status", values: ["Pending", "Approved", "Rejected", "Closed"] },
  { tab: "TEAM_FINANCE_DAILY", headerRow: 3, header: "destination_approved", values: ["Yes", "No"] },
  { tab: "TEAM_REQ_PEOPLE_ROSTER", headerRow: 1, header: "active shift", values: ["TRUE", "FALSE"] },
  { tab: "TEAM_LEARNING_HISTORY", headerRow: 1, header: "confidence", values: ["Low", "Medium", "High"] },
  { tab: "TEAM_LEARNING_HISTORY", headerRow: 1, header: "disposition", values: ["Proposed", "Approved", "Rejected", "Rolled back"] },
] as const

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ")

async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({
    credentials: googleServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  const sheets = google.sheets({ version: "v4", auth })
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  })
  const sheetIds = new Map((metadata.data.sheets ?? []).map((sheet) => [sheet.properties?.title, sheet.properties?.sheetId]))
  const requests: any[] = []
  const applied: string[] = []

  for (const spec of specs) {
    const sheetId = sheetIds.get(spec.tab)
    if (sheetId === undefined) throw new Error(`Missing tab ${spec.tab}`)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${spec.tab}'!${spec.headerRow}:${spec.headerRow}`,
    })
    const headers = response.data.values?.[0] ?? []
    const column = headers.findIndex((header) => normalize(header) === normalize(spec.header))
    if (column < 0) throw new Error(`Missing ${spec.header} in ${spec.tab}`)
    requests.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: spec.headerRow,
          endRowIndex: 1000,
          startColumnIndex: column,
          endColumnIndex: column + 1,
        },
        rule: {
          condition: {
            type: "ONE_OF_LIST",
            values: spec.values.map((userEnteredValue) => ({ userEnteredValue })),
          },
          strict: true,
          showCustomUi: true,
        },
      },
    })
    applied.push(`${spec.tab}:${spec.header} = ${spec.values.join(" | ")}`)
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  console.log(applied.join("\n"))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
