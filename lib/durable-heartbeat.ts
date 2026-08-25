import { google } from "googleapis"
import { googleServiceAccountCredentials } from "@/lib/googleCredentials"
import { clearSheetCache } from "@/lib/googleSheets"
import type { HeartbeatAuditEntry } from "@/lib/heartbeat-control"

const TAB = "Action_Log"
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

export function heartbeatAcknowledgmentsFromRows(rows: readonly Record<string, unknown>[]): HeartbeatAuditEntry[] {
  return rows.flatMap((row) => {
    const objective = String(row["operating objective"] ?? row.objective ?? "").trim()
    if (!objective.startsWith("HEARTBEAT_ACK:")) return []
    const heartbeatId = objective.slice("HEARTBEAT_ACK:".length)
    const occurredAt = String(row["updated at"] ?? row["executed at"] ?? row["proposed at"] ?? "").trim()
    if (!heartbeatId || !Number.isFinite(Date.parse(occurredAt))) return []
    return [{ id: String(row["action id"] ?? `heartbeat-ack-${heartbeatId}-${occurredAt}`), heartbeat_id: heartbeatId, actor_id: String(row["owner actor id"] ?? row["updated by"] ?? "unknown"), action_type: "alert_acknowledged" as const, occurred_at: new Date(occurredAt).toISOString(), note: String(row["next action"] ?? row.note ?? "Alert acknowledged. The heartbeat rule remains active until a new qualifying signal arrives.") }]
  })
}

export async function writeHeartbeatAcknowledgment(entry: HeartbeatAuditEntry) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing")
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth })
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:AZ` })
  const rows = (response.data.values ?? []) as string[][]
  if (!rows.length) throw new Error("Action_Log headers are missing")
  const headers = rows[0].map(normalize)
  const output = Array(headers.length).fill("")
  const set = (value: string, ...names: string[]) => { const index = names.map(normalize).map((name) => headers.indexOf(name)).find((item) => item >= 0) ?? -1; if (index >= 0) output[index] = value }
  set(entry.id, "action id")
  set(`HEARTBEAT_ACK:${entry.heartbeat_id}`, "operating objective", "objective")
  set("Heartbeat alert acknowledgment", "expected metric")
  set(entry.actor_id, "owner actor id")
  set("Acknowledged", "state", "status")
  set(entry.occurred_at, "proposed at")
  set(entry.occurred_at, "updated at")
  set(entry.note, "next action", "note")
  set(entry.occurred_at.slice(0, 7), "reporting month")
  await sheets.spreadsheets.values.append({ spreadsheetId, range: `${TAB}!A:AZ`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [output] } })
  clearSheetCache()
}
