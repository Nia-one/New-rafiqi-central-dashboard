import { buildLoopHealth, type LoopHealth, type LoopHealthClockInput, type LoopHealthFeedInput, type LoopHealthVerificationInput } from "@/lib/operating-loop/loop-health"

export const SELF_DRIVE_DOMAINS = [
  "Cash & Control",
  "Enterprise Demand",
  "New Adds",
  "Member Engagement",
  "Member Savings",
  "Nia Margins",
  "Nia Growth",
] as const

export type SelfDriveDomain = (typeof SELF_DRIVE_DOMAINS)[number]
export type DespatchSeverity = "Attention" | "Breach" | "Critical"
export type DespatchEscalationStatus = "Open" | "Acknowledged" | "Recovered"

export type DespatchEscalationRecord = {
  escalationId: string
  domain: SelfDriveDomain
  sourceActionId: string
  sourceEventId: string
  title: string
  reason: string
  ownerRole: string
  dueAt: string
  raisedAt: string
  severity: DespatchSeverity
  status: DespatchEscalationStatus
  evidenceRefs: readonly string[]
  synthetic: boolean
}

export type DespatchQueue = {
  visible: readonly DespatchEscalationRecord[]
  totalOpen: number
}

export type LoopHealthProjectionInput = {
  domain: SelfDriveDomain
  asOf: string
  feeds: readonly LoopHealthFeedInput[]
  clocks: readonly LoopHealthClockInput[]
  verification: LoopHealthVerificationInput
  quarantinedRecords: number
  dependentClaims: readonly string[]
  synthetic: boolean
}

function required(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`)
}

export function createDespatchEscalation(input: DespatchEscalationRecord): DespatchEscalationRecord {
  required(input.escalationId, "Escalation ID")
  required(input.sourceActionId, "Source action ID")
  required(input.sourceEventId, "Source event ID")
  required(input.title, "Escalation title")
  required(input.reason, "Escalation reason")
  required(input.ownerRole, "Escalation owner")
  if (!Number.isFinite(Date.parse(input.dueAt)) || !Number.isFinite(Date.parse(input.raisedAt))) throw new Error("Despatch escalation timestamps must be valid ISO dates.")
  if (input.status !== "Recovered" && Date.parse(input.dueAt) < Date.parse(input.raisedAt) && input.severity === "Attention") throw new Error("An overdue open escalation cannot remain Attention severity.")
  for (const reference of input.evidenceRefs) {
    if (!reference.startsWith("protected://")) throw new Error("Despatch escalation evidence must use protected references.")
  }
  return Object.freeze({ ...input, evidenceRefs: Object.freeze([...input.evidenceRefs]) })
}

export function buildDespatchQueue(inputs: readonly DespatchEscalationRecord[], limit = 5): DespatchQueue {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Despatch queue limit must be a positive integer.")
  if (new Set(inputs.map((input) => input.escalationId)).size !== inputs.length) throw new Error("Despatch escalation IDs must be unique across domains.")
  const severityRank: Readonly<Record<DespatchSeverity, number>> = Object.freeze({ Critical: 3, Breach: 2, Attention: 1 })
  const open = [...inputs]
    .filter((input) => input.status !== "Recovered")
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity] || Date.parse(left.dueAt) - Date.parse(right.dueAt) || left.escalationId.localeCompare(right.escalationId))
  return Object.freeze({ visible: Object.freeze(open.slice(0, limit)), totalOpen: open.length })
}

export function aggregateDespatchEscalations(inputs: readonly DespatchEscalationRecord[], limit = 5): readonly DespatchEscalationRecord[] {
  return buildDespatchQueue(inputs, limit).visible
}

export function projectLoopHealth(input: LoopHealthProjectionInput): LoopHealth {
  if (input.dependentClaims.length === 0) throw new Error(`${input.domain} must declare at least one health-dependent claim.`)
  return buildLoopHealth({
    asOf: input.asOf,
    feeds: input.feeds,
    clocks: input.clocks,
    verification: input.verification,
    quarantinedRecords: input.quarantinedRecords,
  })
}

export function aggregateLoopHealth(inputs: readonly { domain: SelfDriveDomain; health: LoopHealth }[]): LoopHealth {
  if (inputs.length === 0) throw new Error("Platform Loop Health requires at least one domain projection.")
  const reasons = inputs.flatMap(({ domain, health }) => health.reasons.map((reason) => `${domain}: ${reason}`))
  const hasAttention = inputs.some(({ health }) => health.state !== "Confirmed")
  const claimed = inputs.reduce((sum, { health }) => sum + health.verification.claimed, 0)
  const verified = inputs.reduce((sum, { health }) => sum + health.verification.verified, 0)
  const awaiting = inputs.reduce((sum, { health }) => sum + health.verification.awaiting, 0)
  const reopened = inputs.reduce((sum, { health }) => sum + health.verification.reopened, 0)
  const backlogAgeHours = Math.max(...inputs.map(({ health }) => health.verification.backlogAgeHours))
  const latestAsOf = inputs.reduce((latest, { health }) => Date.parse(health.asOf) > Date.parse(latest) ? health.asOf : latest, inputs[0].health.asOf)
  const oldestAwaitingAt = awaiting > 0
    ? new Date(Date.parse(latestAsOf) - backlogAgeHours * 60 * 60 * 1000).toISOString()
    : null
  return Object.freeze({
    asOf: latestAsOf,
    state: reasons.length > 0 ? "Cannot confirm" as const : hasAttention ? "Attention" as const : "Confirmed" as const,
    overviewAnswerAllowed: reasons.length === 0,
    reasons: Object.freeze(reasons),
    quarantinedRecords: inputs.reduce((sum, { health }) => sum + health.quarantinedRecords, 0),
    feeds: Object.freeze(inputs.flatMap(({ domain, health }) => health.feeds.map((feed) => Object.freeze({ ...feed, feedId: `${domain}:${feed.feedId}`, label: `${domain} · ${feed.label}` })))),
    clocks: Object.freeze(inputs.flatMap(({ domain, health }) => health.clocks.map((clock) => Object.freeze({ ...clock, clockId: `${domain}:${clock.clockId}`, label: `${domain} · ${clock.label}` })))),
    verification: Object.freeze({ claimed, verified, awaiting, reopened, oldestAwaitingAt, backlogAgeHours, backlogBeyondLimit: inputs.some(({ health }) => health.verification.backlogBeyondLimit) }),
  })
}
