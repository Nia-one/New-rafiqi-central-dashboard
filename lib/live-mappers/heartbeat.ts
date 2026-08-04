import { buildHeartbeatSnapshot, type HeartbeatKind, type HeartbeatSnapshot, type HeartbeatSource, type RosterState } from "@/lib/heartbeat-control"
import { heartbeatRules } from "@/lib/heartbeat-rules"

type Row = Record<string, unknown>

function value(row: Row | undefined, ...keys: string[]) {
  for (const key of keys) {
    const normalized = key.trim().toLowerCase().replaceAll("_", " ")
    const found = Object.keys(row ?? {}).find((candidate) => candidate.trim().toLowerCase().replaceAll("_", " ") === normalized)
    const result = found ? String(row?.[found] ?? "").trim() : ""
    if (result) return result
  }
  return ""
}

function timestamp(row: Row | undefined, ...keys: string[]) {
  const candidate = value(row, ...keys)
  return Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : ""
}

function rosterState(row: Row): RosterState {
  const state = value(row, "active shift", "active status", "roster state", "shift status").toLowerCase()
  if (state.includes("break")) return "approved_break"
  if (state.includes("rest")) return "rest_day"
  if (state.includes("off") || state.includes("inactive") || state === "false" || state === "no") return "off_shift"
  return "active_shift"
}

function kindFor(role: string): HeartbeatKind {
  const normalized = role.toLowerCase()
  if (normalized.includes("essential") || normalized.includes("category")) return "essentials_category"
  if (normalized.includes("supply") && normalized.includes("jco")) return "supply_jco"
  if (normalized.includes("demand") && normalized.includes("jco")) return "demand_jco"
  return "other"
}

function latestActionByOwner(actions: readonly Row[]) {
  const result = new Map<string, { row: Row; at: string }>()
  for (const row of actions) {
    const owner = value(row, "owner actor id", "actor id")
    const at = timestamp(row, "verified at", "proof submitted at", "in progress at", "assigned at", "escalated at", "updated at", "proposed at")
    if (!owner || !at) continue
    const current = result.get(owner)
    if (!current || Date.parse(at) > Date.parse(current.at)) result.set(owner, { row, at })
  }
  return result
}

export function buildLiveHeartbeatSnapshot(input: {
  people: readonly Row[]
  actionLog: readonly Row[]
  essentials?: readonly Row[]
  computedAt?: string
}): HeartbeatSnapshot | null {
  const computedAt = Number.isFinite(Date.parse(input.computedAt ?? "")) ? new Date(input.computedAt!).toISOString() : new Date().toISOString()
  const actionByOwner = latestActionByOwner(input.actionLog)
  const sources: HeartbeatSource[] = []

  for (const person of input.people) {
    const actorId = value(person, "actor id")
    const role = value(person, "role") || "Operations"
    const action = actorId ? actionByOwner.get(actorId) : undefined
    const lastHeartbeatAt = timestamp(person, "last heartbeat at", "last signal at", "last qualifying signal at") || action?.at || ""
    if (!actorId || !lastHeartbeatAt) continue
    sources.push({
      id: `live-person-${actorId}`,
      name: value(person, "display name", "name") || actorId,
      role,
      theatre: value(action?.row, "theatre", "theatre id") || value(person, "theatre", "theatre id") || "Not recorded",
      location: value(action?.row, "studio", "studio id", "location") || value(person, "studio", "studio id", "location") || "Not recorded",
      kind: kindFor(role),
      roster_state: rosterState(person),
      last_heartbeat_at: lastHeartbeatAt,
    })
  }

  for (const [owner, action] of actionByOwner) {
    if (sources.some((source) => source.id === `live-person-${owner}`)) continue
    const role = value(action.row, "team", "lane", "role") || "Operations"
    sources.push({
      id: `live-action-owner-${owner}`,
      name: owner,
      role,
      theatre: value(action.row, "theatre", "theatre id") || "Not recorded",
      location: value(action.row, "studio", "studio id", "location") || "Not recorded",
      kind: kindFor(role),
      roster_state: "active_shift",
      last_heartbeat_at: action.at,
    })
  }

  for (const [index, order] of (input.essentials ?? []).entries()) {
    const at = timestamp(order, "order placed at", "ordered at")
    const category = value(order, "category", "product category")
    if (!at || !category) continue
    sources.push({
      id: `live-essential-${value(order, "order id") || `${category}-${index + 1}`}`,
      name: category,
      role: "Essentials category",
      theatre: value(order, "theatre", "theatre id") || "Not recorded",
      location: value(order, "studio", "studio id", "location") || "Not recorded",
      kind: "essentials_category",
      roster_state: "active_shift",
      last_heartbeat_at: at,
      checklist: ["Check order-feed continuity", "Check Member demand", "Check category availability"],
    })
  }

  if (!sources.length) return null
  return { ...buildHeartbeatSnapshot(sources, heartbeatRules, computedAt), persistence: "governed-live" }
}
