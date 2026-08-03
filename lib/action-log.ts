import { mismatchInputs } from "@/lib/allocation-data"
import type { ActionStatus } from "@/lib/allocation-types"

export type ActionType = "detect" | "agree" | "assign" | "resolve" | "close" | "verify" | "dismiss" | "reassign" | "note"

export type ActionLogEntry = {
  id: string
  queue_item_id: string
  actor_id: string | null
  action_type: ActionType
  previous_status: ActionStatus | null
  new_status: ActionStatus
  executed_at: string
  note?: string
}

export type ActionLogWrite = {
  queue_item_id: string
  actor_id: string
  action_type: Exclude<ActionType, "detect">
  note?: string
}

export type ActionActor = { id: string; name: string; role: string }

export const ACTION_ACTORS: ActionActor[] = [
  { id: "jco-demand", name: "Demand JCO", role: "Demand" },
  { id: "jco-supply", name: "Supply JCO", role: "Supply" },
  { id: "eae-essentials", name: "Essentials EAE", role: "Essentials" },
  { id: "operations-lead", name: "Operations lead", role: "Living" },
  { id: "theatre-checker", name: "Theatre checker", role: "Checker" },
  { id: "jco-c", name: "JCO C", role: "Demand" },
]

export const ACTION_LOG_REFERENCE_AT = "2026-07-15T14:00:00+05:30"
export const ACTION_LOG_BLOCK_START = "2026-07-15T12:00:00+05:30"

function isoAtOffset(base: string, offsetHours: number) {
  return new Date(Date.parse(base) + offsetHours * 60 * 60 * 1000).toISOString()
}

function seedActor(owner: string) {
  const normalized = owner.toLowerCase()
  if (normalized.includes("eae") || normalized.includes("essential")) return "eae-essentials"
  if (normalized.includes("supply")) return "jco-supply"
  if (normalized.includes("demand")) return "jco-demand"
  return "operations-lead"
}

function buildSeedActionLog() {
  const entries: ActionLogEntry[] = []
  let closeIndex = 0

  for (const item of mismatchInputs) {
    // Closed migration rows need enough history for detect → assign → resolve → close.
    const detectedAgeHours = item.actionStatus === "Resolved" ? Math.max(item.ageHours, 4) : item.ageHours
    const detectedAt = isoAtOffset(ACTION_LOG_REFERENCE_AT, -detectedAgeHours)
    entries.push({
      id: `log-${item.id}-detect`,
      queue_item_id: item.id,
      actor_id: null,
      action_type: "detect",
      previous_status: null,
      new_status: "Detected",
      executed_at: detectedAt,
    })

    if (item.actionStatus === "Assigned" || item.actionStatus === "Resolved") {
      entries.push({
        id: `log-${item.id}-assign`,
        queue_item_id: item.id,
        actor_id: seedActor(item.accountableOwner),
        action_type: "assign",
        previous_status: "Detected",
        new_status: "Assigned",
        executed_at: isoAtOffset(detectedAt, Math.min(2, Math.max(1, item.ageHours / 2))),
        note: "Migrated illustrative assignment",
      })
    }

    if (item.actionStatus === "Resolved") {
      const resolveAt = isoAtOffset(ACTION_LOG_REFERENCE_AT, -2 + closeIndex * 0.35)
      const closeAt = isoAtOffset(ACTION_LOG_REFERENCE_AT, -1.4 + closeIndex * 0.65)
      entries.push({
        id: `log-${item.id}-resolve`,
        queue_item_id: item.id,
        actor_id: seedActor(item.accountableOwner),
        action_type: "resolve",
        previous_status: "Assigned",
        new_status: "Resolved",
        executed_at: resolveAt,
        note: "Execution evidence recorded",
      })
      entries.push({
        id: `log-${item.id}-close`,
        queue_item_id: item.id,
        actor_id: seedActor(item.accountableOwner),
        action_type: "close",
        previous_status: "Resolved",
        new_status: "Closed",
        executed_at: closeAt,
        note: "Executor marked the action closed",
      })
      entries.push({
        id: `log-${item.id}-verify`,
        queue_item_id: item.id,
        actor_id: "theatre-checker",
        action_type: "verify",
        previous_status: "Closed",
        new_status: "Verified",
        executed_at: isoAtOffset(closeAt, 0.1),
        note: "Checker verified the evidence",
      })
      closeIndex += 1
    }
  }

  entries.push({
    id: "log-jco-c-note",
    queue_item_id: "m-ess-dataquality-sriperumbudur",
    actor_id: "jco-c",
    action_type: "note",
    previous_status: "Detected",
    new_status: "Detected",
    executed_at: isoAtOffset(ACTION_LOG_REFERENCE_AT, -4),
    note: "Source follow-up recorded",
  })

  return entries.sort((a, b) => Date.parse(a.executed_at) - Date.parse(b.executed_at) || a.id.localeCompare(b.id))
}

export const seedActionLog: ActionLogEntry[] = buildSeedActionLog()

export function actionHistory(queueItemId: string, entries: ActionLogEntry[]) {
  return entries
    .filter((entry) => entry.queue_item_id === queueItemId)
    .sort((a, b) => Date.parse(a.executed_at) - Date.parse(b.executed_at) || a.id.localeCompare(b.id))
}

export function latestAction(queueItemId: string, entries: ActionLogEntry[]) {
  return actionHistory(queueItemId, entries).at(-1)
}

export function latestAssignee(queueItemId: string, entries: ActionLogEntry[]) {
  return actionHistory(queueItemId, entries).filter((entry) => entry.action_type === "assign" || entry.action_type === "reassign").at(-1)?.actor_id ?? null
}

export function deriveQueueItemState(queueItemId: string, entries: ActionLogEntry[], now: string) {
  const history = actionHistory(queueItemId, entries)
  const detected = history.find((entry) => entry.action_type === "detect" || entry.action_type === "agree")
  const latest = history.at(-1)
  if (!detected || !latest) throw new Error(`Action log is missing an origin entry for ${queueItemId}`)
  return {
    status: latest.new_status,
    ageHours: Math.max(0, Math.floor((Date.parse(now) - Date.parse(detected.executed_at)) / 3_600_000)),
    assignedActorId: latestAssignee(queueItemId, entries),
    history,
  }
}

export function closuresBetween(entries: ActionLogEntry[], startAt: string, endAt: string) {
  const start = Date.parse(startAt)
  const end = Date.parse(endAt)
  return entries.filter((entry) => entry.action_type === "close" && Date.parse(entry.executed_at) >= start && Date.parse(entry.executed_at) <= end).length
}

export function actorStalenessHours(actorId: string, entries: ActionLogEntry[], now: string) {
  const latest = entries
    .filter((entry) => entry.actor_id === actorId)
    .sort((a, b) => Date.parse(a.executed_at) - Date.parse(b.executed_at))
    .at(-1)
  return latest ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(latest.executed_at)) / 3_600_000)) : null
}

function nextStatus(actionType: ActionLogWrite["action_type"], previous: ActionStatus): ActionStatus {
  if (actionType === "agree" && previous === "Detected") return "Agreed"
  if (actionType === "assign" && (previous === "Detected" || previous === "Agreed")) return "Assigned"
  if (actionType === "reassign" && previous === "Assigned") return "Assigned"
  if (actionType === "resolve" && (previous === "Detected" || previous === "Assigned")) return "Resolved"
  if (actionType === "close" && previous === "Resolved") return "Closed"
  if (actionType === "verify" && previous === "Closed") return "Verified"
  if (actionType === "dismiss" && previous !== "Verified" && previous !== "Dismissed") return "Dismissed"
  if (actionType === "note" && previous !== "Verified" && previous !== "Dismissed") return previous
  throw new Error(`Cannot ${actionType} an item in ${previous} status`)
}

export function appendActionLogEntry(entries: ActionLogEntry[], write: ActionLogWrite, serverExecutedAt: string, id: string) {
  if (!write.actor_id.trim()) throw new Error("An actor is required")
  if (write.action_type === "dismiss" && !write.note?.trim()) throw new Error("A dismissal reason is required")
  const previous = latestAction(write.queue_item_id, entries)
  if (!previous) throw new Error("Queue item was not detected")
  const newStatus = nextStatus(write.action_type, previous.new_status)
  const entry: ActionLogEntry = {
    id,
    queue_item_id: write.queue_item_id,
    actor_id: write.actor_id,
    action_type: write.action_type,
    previous_status: previous.new_status,
    new_status: newStatus,
    executed_at: serverExecutedAt,
    ...(write.note?.trim() ? { note: write.note.trim() } : {}),
  }
  return [...entries, entry].sort((a, b) => Date.parse(a.executed_at) - Date.parse(b.executed_at) || a.id.localeCompare(b.id))
}
