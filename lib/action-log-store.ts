import { randomUUID } from "node:crypto"
import { appendActionLogEntry, seedActionLog, type ActionLogWrite } from "@/lib/action-log"

// This in-memory store makes the local prototype executable. Production writes
// stay disabled until authenticated durable storage is connected.
let entries = seedActionLog.map((entry) => ({ ...entry }))

export function readActionLog() {
  return entries.map((entry) => ({ ...entry }))
}

export function writeActionLog(write: ActionLogWrite, serverExecutedAt = new Date().toISOString()) {
  entries = appendActionLogEntry(entries, write, serverExecutedAt, `log-${randomUUID()}`)
  return { entry: entries.at(-1)!, entries: readActionLog() }
}
