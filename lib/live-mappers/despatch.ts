import type { DespatchEscalationRecord, DespatchSeverity, SelfDriveDomain } from "@/lib/operating-loop/runtime-contracts"

type Row = Record<string, unknown>

const text = (row: Row | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const found = Object.keys(row || {}).find((candidate) => candidate.trim().toLowerCase().replaceAll("_", " ") === key.trim().toLowerCase().replaceAll("_", " "))
    if (found && String(row?.[found] ?? "").trim()) return String(row?.[found]).trim()
  }
  return ""
}

function domain(value: string): SelfDriveDomain {
  const source = value.toLowerCase()
  if (source.includes("enterprise") || source.includes("demand")) return "Enterprise Demand"
  if (source.includes("engagement") || source.includes("nps") || source.includes("member issue")) return "Member Engagement"
  if (source.includes("saving") || source.includes("essential")) return "Member Savings"
  if (source.includes("margin") || source.includes("cm")) return "Nia Margins"
  if (source.includes("growth")) return "Nia Growth"
  if (source.includes("cash") || source.includes("finance")) return "Cash & Control"
  return "New Adds"
}

function severity(incident: Row | undefined, dueAt: string, now: number): DespatchSeverity {
  const source = text(incident, "severity").toLowerCase()
  if (["critical", "high", "severe"].includes(source)) return "Critical"
  if (["medium", "breach"].includes(source) || Date.parse(dueAt) < now) return "Breach"
  return "Attention"
}

export function buildLiveDespatchEscalations(input: {
  actionLog: readonly Row[]
  incidentLog: readonly Row[]
  people: readonly Row[]
  now?: string
}): readonly DespatchEscalationRecord[] {
  const now = Date.parse(input.now || new Date().toISOString())
  const incidentById = new Map(input.incidentLog.map((row) => [text(row, "incident id"), row]))
  const peopleById = new Map(input.people.map((row) => [text(row, "actor id"), text(row, "display name")]))
  return Object.freeze(input.actionLog.flatMap((action) => {
    const actionId = text(action, "action id")
    const state = text(action, "state").toLowerCase()
    if (!actionId || ["closed", "verified", "resolved", "dismissed", "recovered"].includes(state)) return []
    const incidentId = text(action, "incident id")
    const incident = incidentById.get(incidentId)
    const raisedAt = text(action, "escalated at", "proposed at", "updated at")
    const dueAt = text(action, "due at")
    if (!Number.isFinite(Date.parse(raisedAt)) || !Number.isFinite(Date.parse(dueAt))) return []
    const objective = text(action, "operating objective", "next action", "expected metric")
    const incidentReason = text(incident, "severity reason", "short description", "action required")
    const ownerId = text(action, "owner actor id") || text(incident, "owner actor id")
    const source = `${text(incident, "domain", "incident type")} ${objective} ${text(action, "expected metric")}`
    return [Object.freeze({
      escalationId: `LIVE-${actionId}`,
      domain: domain(source),
      sourceActionId: actionId,
      sourceEventId: incidentId || actionId,
      title: objective || text(incident, "action required", "short description") || actionId,
      reason: incidentReason || objective || text(action, "required evidence") || actionId,
      ownerRole: peopleById.get(ownerId) || ownerId || "Unassigned",
      dueAt,
      raisedAt,
      severity: severity(incident, dueAt, now),
      status: state === "acknowledged" || state === "in progress" ? "Acknowledged" : "Open",
      evidenceRefs: Object.freeze([]),
      synthetic: false,
    } satisfies DespatchEscalationRecord)]
  }))
}
