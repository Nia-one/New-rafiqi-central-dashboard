export const LOOP_HEALTH_CRITICAL_MULTIPLIER = 2
export const LOOP_HEALTH_VERIFICATION_BACKLOG_HOURS = 48

export type LoopHealthFeedInput = {
  feedId: string
  label: string
  lastUpdatedAt: string
  cadenceMinutes: number
  critical: boolean
  affectedClaims: readonly string[]
}

export type LoopHealthClockInput = {
  clockId: string
  label: string
  ownerRole: string
  dueAt: string
  state: "Running" | "Recovered"
}

export type LoopHealthVerificationInput = {
  claimed: number
  verified: number
  awaiting: number
  reopened: number
  oldestAwaitingAt: string | null
}

export type LoopHealthFeed = LoopHealthFeedInput & {
  ageMinutes: number
  ageLabel: string
  stale: boolean
  criticalBeyondLimit: boolean
}

export type LoopHealthClock = LoopHealthClockInput & {
  breached: boolean
  agePastDueMinutes: number
}

export type LoopHealth = {
  asOf: string
  state: "Confirmed" | "Attention" | "Cannot confirm"
  overviewAnswerAllowed: boolean
  reasons: readonly string[]
  quarantinedRecords: number
  feeds: readonly LoopHealthFeed[]
  clocks: readonly LoopHealthClock[]
  verification: LoopHealthVerificationInput & {
    backlogAgeHours: number
    backlogBeyondLimit: boolean
  }
}

function minutesBetween(later: string, earlier: string) {
  const minutes = Math.floor((Date.parse(later) - Date.parse(earlier)) / 60_000)
  if (!Number.isFinite(minutes)) throw new Error("Loop Health timestamps must be valid ISO dates.")
  return Math.max(0, minutes)
}

function ageLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min old`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining === 0 ? `${hours}h old` : `${hours}h ${remaining}m old`
}

// Terse age like "45m", "2h", "2h 30m" for compact chart captions and labels.
export function compactAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`
}

function validateFeed(feed: LoopHealthFeedInput) {
  if (!feed.feedId.trim() || !feed.label.trim()) throw new Error("Loop Health feeds require stable identity and label.")
  if (!Number.isFinite(feed.cadenceMinutes) || feed.cadenceMinutes <= 0) throw new Error(`Feed ${feed.feedId} requires a positive cadence.`)
}

function validateVerification(input: LoopHealthVerificationInput) {
  for (const [label, value] of Object.entries({ claimed: input.claimed, verified: input.verified, awaiting: input.awaiting, reopened: input.reopened })) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`Verification ${label} must be a non-negative integer.`)
  }
  if (input.verified + input.awaiting + input.reopened < input.claimed) throw new Error("Claimed outcomes must resolve to verified, awaiting, or reopened outcomes.")
  if (input.awaiting === 0 && input.oldestAwaitingAt !== null) throw new Error("An empty verification backlog cannot have an oldest timestamp.")
  if (input.awaiting > 0 && input.oldestAwaitingAt === null) throw new Error("A verification backlog requires its oldest timestamp.")
}

export function buildLoopHealth(input: {
  asOf: string
  feeds: readonly LoopHealthFeedInput[]
  clocks: readonly LoopHealthClockInput[]
  verification: LoopHealthVerificationInput
  quarantinedRecords?: number
}): LoopHealth {
  if (!Number.isFinite(Date.parse(input.asOf))) throw new Error("Loop Health requires a valid as-of timestamp.")
  if (new Set(input.feeds.map((feed) => feed.feedId)).size !== input.feeds.length) throw new Error("Loop Health feed IDs must be unique.")
  if (new Set(input.clocks.map((clock) => clock.clockId)).size !== input.clocks.length) throw new Error("Loop Health clock IDs must be unique.")
  input.feeds.forEach(validateFeed)
  validateVerification(input.verification)
  const quarantinedRecords = input.quarantinedRecords ?? 0
  if (!Number.isInteger(quarantinedRecords) || quarantinedRecords < 0) throw new Error("Quarantined records must be a non-negative integer.")

  const feeds = Object.freeze(input.feeds.map((feed) => {
    const ageMinutes = minutesBetween(input.asOf, feed.lastUpdatedAt)
    return Object.freeze({
      ...feed,
      affectedClaims: Object.freeze([...feed.affectedClaims]),
      ageMinutes,
      ageLabel: ageLabel(ageMinutes),
      stale: ageMinutes > feed.cadenceMinutes,
      criticalBeyondLimit: feed.critical && ageMinutes > feed.cadenceMinutes * LOOP_HEALTH_CRITICAL_MULTIPLIER,
    })
  }))

  const clocks = Object.freeze(input.clocks.map((clock) => {
    const agePastDueMinutes = clock.state === "Running" ? minutesBetween(input.asOf, clock.dueAt) : 0
    return Object.freeze({ ...clock, breached: clock.state === "Running" && Date.parse(input.asOf) > Date.parse(clock.dueAt), agePastDueMinutes })
  }))

  const backlogAgeMinutes = input.verification.oldestAwaitingAt
    ? minutesBetween(input.asOf, input.verification.oldestAwaitingAt)
    : 0
  const backlogAgeHours = Math.floor(backlogAgeMinutes / 60)
  const backlogBeyondLimit = input.verification.awaiting > 0 && backlogAgeMinutes > LOOP_HEALTH_VERIFICATION_BACKLOG_HOURS * 60
  const reasons = [
    ...feeds.filter((feed) => feed.criticalBeyondLimit).map((feed) => `${feed.label} is beyond 2× cadence`),
    ...clocks.filter((clock) => clock.breached).map((clock) => `${clock.label} is waiting on ${clock.ownerRole}`),
    ...(backlogBeyondLimit ? [`Verification backlog is ${backlogAgeHours} hours old`] : []),
  ]
  const hasAttention = feeds.some((feed) => feed.stale) || clocks.some((clock) => clock.state === "Running") || input.verification.awaiting > 0 || input.verification.reopened > 0
  const state = reasons.length > 0 ? "Cannot confirm" : hasAttention ? "Attention" : "Confirmed"

  return Object.freeze({
    asOf: input.asOf,
    state,
    overviewAnswerAllowed: reasons.length === 0,
    reasons: Object.freeze(reasons),
    quarantinedRecords,
    feeds,
    clocks,
    verification: Object.freeze({ ...input.verification, backlogAgeHours, backlogBeyondLimit }),
  })
}

export function loopHealthAnswer(health: LoopHealth, healthyAnswer: string) {
  if (!health.overviewAnswerAllowed) return `Cannot confirm: ${health.reasons.join("; ")}.`
  const staleFeeds = health.feeds.filter((feed) => feed.stale)
  return staleFeeds.length > 0
    ? `${healthyAnswer} (${staleFeeds.map((feed) => `${feed.label} ${feed.ageLabel}`).join("; ")})`
    : healthyAnswer
}
