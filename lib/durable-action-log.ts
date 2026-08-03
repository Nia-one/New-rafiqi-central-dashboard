import { google } from "googleapis"
import { googleServiceAccountCredentials } from "@/lib/googleCredentials"
import { clearSheetCache } from "@/lib/googleSheets"
import type { ActionLogWrite } from "@/lib/action-log"

const TAB = "Action_Log"

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function stateFor(action: ActionLogWrite["action_type"]) {
  if (action === "note") return undefined
  return ({ agree: "Agreed", assign: "Assigned", reassign: "Assigned", resolve: "Resolved", close: "Closed", verify: "Verified", dismiss: "Dismissed" } as const)[action]
}

export async function writeDurableActionLog(write: ActionLogWrite) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:AZ` })
  const rows = (response.data.values ?? []) as string[][]
  if (!rows.length) throw new Error("Action_Log headers are missing")
  const headers = rows[0].map(normalize)
  const column = (...names: string[]) => names.map(normalize).map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1
  const actionIdColumn = column("action id", "queue item id")
  if (actionIdColumn < 0) throw new Error("Action_Log action id column is missing")
  const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[actionIdColumn] ?? "").trim() === write.queue_item_id)
  const now = new Date().toISOString()
  const output = rowIndex >= 1 ? [...rows[rowIndex]] : Array(headers.length).fill("")
  output[actionIdColumn] = write.queue_item_id
  const set = (value: string | undefined, ...names: string[]) => { const index = column(...names); if (index >= 0 && value !== undefined) output[index] = value }
  set(stateFor(write.action_type), "state", "status")
  set(now, "updated at")
  set(write.note, "next action", "note")
  if (write.action_type === "assign" || write.action_type === "reassign") { set(now, "assigned at"); set(write.actor_id, "owner actor id") }
  if (write.action_type === "resolve") set(now, "proof submitted at")
  if (write.action_type === "close") set(now, "closed at")
  if (write.action_type === "verify") { set(now, "verified at"); set(write.actor_id, "verified by"); set("Verified", "verification result") }
  if (write.action_type === "dismiss") { set(now, "closed at"); set(write.note, "reopen reason", "next action", "note") }
  if (rowIndex >= 1) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${TAB}!A${rowIndex + 1}:AZ${rowIndex + 1}`, valueInputOption: "USER_ENTERED", requestBody: { values: [output] } })
  } else {
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${TAB}!A:AZ`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [output] } })
  }
  clearSheetCache()
  return { entry: { ...write, new_status: stateFor(write.action_type) ?? "Recorded", executed_at: now }, persistence: "google-sheets" }
}
