export const ROUTINE_LOOP_STATES = ["Detected", "Assigned through bot", "Chased", "Evidence collected", "Independently verified", "Closed", "Reopened", "Escalated"] as const
export type RoutineLoopState = (typeof ROUTINE_LOOP_STATES)[number]
export const PEOPLE_ESCALATION_STAGES = ["Coach / Counsel", "Performance review", "Exit review"] as const
export type PeopleEscalationStage = (typeof PEOPLE_ESCALATION_STAGES)[number]

export type RoutineLoopEvent = {
  eventId: string
  state: RoutineLoopState
  occurredAt: string
  actorId: string
  note: string
  evidenceRef: string
  verificationOutcome?: "Passed" | "Failed"
}

export type RoutineException = {
  exceptionId: string
  domain: string
  title: string
  ownerActorId: string
  verifierActorId: string
  state: RoutineLoopState
  botReminderCount: number
  evidenceCount: number
  assignedThroughBot: true
  managementInterventionRequired: false
  externalMessageSent: false
  history: readonly RoutineLoopEvent[]
}

export type NonPerformanceSignal = {
  signalId: string
  actorId: string
  displayName: string
  role: string
  metricId: string
  governedGoal: string
  governedSla: string
  actualOutcome: string
  impact: string
  occurredAt: string
  verificationStatus: "Verified" | "Pending" | "Poor data"
  independentlyVerifiedBy: string | null
  evidenceRef: string
}

export type PeopleIntervention = {
  interventionId: string
  actorId: string
  type: "Bot reminder" | "Counselling" | "Performance review"
  occurredAt: string
  performedBy: string
  evidenceRef: string
}

export type PeopleException = {
  actorId: string
  displayName: string
  role: string
  stage: PeopleEscalationStage
  recurrenceCount: number
  metricId: string
  governedGoal: string
  governedSla: string
  impact: string
  evidenceHistory: readonly string[]
  priorBotReminders: readonly PeopleIntervention[]
  priorCounselling: readonly PeopleIntervention[]
  priorPerformanceReviews: readonly PeopleIntervention[]
  recommendedNextStep: string
  namedHumanApprovalRequired: true
  legalProcessChecksRequired: boolean
  automaticEmploymentDecisionPermitted: false
  externalMessagePermitted: false
}

export type WithheldPeopleSignal = {
  actorId: string
  displayName: string
  reason: "Single verified event" | "Poor or unverified data" | "No repeated verified goal / SLA" | "No verified recurrence after prior intervention"
  recordedSignals: number
  verifiedRecurrences: number
}

function assertProtectedRef(value: string, label: string) {
  if (!value.startsWith("protected://")) throw new Error(`${label} must use a protected evidence reference.`)
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label} identifiers must be append-only and unique.`)
}

function immutableIntervention(intervention: PeopleIntervention) {
  assertProtectedRef(intervention.evidenceRef, "People intervention")
  return Object.freeze({ ...intervention })
}

function isIndependentlyVerified(signal: NonPerformanceSignal) {
  return signal.verificationStatus === "Verified" && Boolean(signal.independentlyVerifiedBy) && signal.independentlyVerifiedBy !== signal.actorId
}

function governedPerformanceKey(signal: NonPerformanceSignal) {
  return [signal.metricId, signal.governedGoal, signal.governedSla].join("\u0000")
}

export function buildRoutineLoopSnapshot(records: readonly RoutineException[]) {
  assertUnique(records.map((record) => record.exceptionId), "Routine exception")
  const frozen = records.map((record) => {
    if (!record.assignedThroughBot || record.managementInterventionRequired || record.externalMessageSent) throw new Error(`Routine exception ${record.exceptionId} must remain system-owned and shadow-only.`)
    if (record.ownerActorId === record.verifierActorId) throw new Error(`Routine exception ${record.exceptionId} requires an independent verifier.`)
    if (record.history[0]?.state !== "Detected") throw new Error(`Routine exception ${record.exceptionId} must begin at Detected.`)
    if (record.history.at(-1)?.state !== record.state) throw new Error(`Routine exception ${record.exceptionId} state must match its latest audit event.`)
    assertUnique(record.history.map((event) => event.eventId), `Routine exception ${record.exceptionId} event`)
    record.history.forEach((event) => assertProtectedRef(event.evidenceRef, "Routine loop event"))
    if (record.history.some((event) => event.state === "Independently verified" && event.actorId !== record.verifierActorId)) throw new Error(`Routine exception ${record.exceptionId} verification must be recorded by its independent verifier.`)
    if (record.state === "Closed" && !record.history.some((event) => event.state === "Independently verified" && event.verificationOutcome === "Passed")) throw new Error(`Routine exception ${record.exceptionId} cannot close without passed independent verification.`)
    return Object.freeze({ ...record, history: Object.freeze(record.history.map((event) => Object.freeze({ ...event }))) })
  })
  const stateCoverage = Object.freeze(ROUTINE_LOOP_STATES.map((state) => Object.freeze({ state, count: frozen.filter((record) => record.history.some((event) => event.state === state)).length })))
  return Object.freeze({ records: Object.freeze(frozen), stateCoverage })
}

function nextPeopleStage(verifiedSignals: readonly NonPerformanceSignal[], interventions: readonly PeopleIntervention[]) {
  const latestPerformanceReview = interventions.filter((item) => item.type === "Performance review").toSorted((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
  const latestCounselling = interventions.filter((item) => item.type === "Counselling").toSorted((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
  if (latestPerformanceReview) return verifiedSignals.some((signal) => Date.parse(signal.occurredAt) > Date.parse(latestPerformanceReview.occurredAt)) ? "Exit review" as const : null
  if (latestCounselling) return verifiedSignals.some((signal) => Date.parse(signal.occurredAt) > Date.parse(latestCounselling.occurredAt)) ? "Performance review" as const : null
  return "Coach / Counsel" as const
}

function recommendedNextStep(stage: PeopleEscalationStage) {
  if (stage === "Coach / Counsel") return "Human Coach / Counsel review using the cited evidence while the system continues routine chase and verification."
  if (stage === "Performance review") return "Named human performance review using the prior counselling record, recurrence history and verified impact."
  return "Named human HR/management exit review with legal and process checks; no employment decision is automated."
}

export function buildExceptionOnlyPeopleProjection(signals: readonly NonPerformanceSignal[], interventions: readonly PeopleIntervention[]) {
  assertUnique(signals.map((signal) => signal.signalId), "Non-performance signal")
  assertUnique(interventions.map((item) => item.interventionId), "People intervention")
  signals.forEach((signal) => assertProtectedRef(signal.evidenceRef, "Non-performance signal"))
  const frozenInterventions = interventions.map(immutableIntervention)
  const actorIds = [...new Set(signals.map((signal) => signal.actorId))]
  const surfaced: PeopleException[] = []
  const withheld: WithheldPeopleSignal[] = []
  for (const actorId of actorIds) {
    const actorSignals = signals.filter((signal) => signal.actorId === actorId).toSorted((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    const actor = actorSignals[0]!
    const independentlyVerified = actorSignals.filter(isIndependentlyVerified)
    const verifiedByGovernedContext = new Map<string, NonPerformanceSignal[]>()
    for (const signal of independentlyVerified) {
      const key = governedPerformanceKey(signal)
      verifiedByGovernedContext.set(key, [...(verifiedByGovernedContext.get(key) ?? []), signal])
    }
    const repeatedContexts = [...verifiedByGovernedContext.values()]
      .filter((contextSignals) => contextSignals.length >= 2)
      .toSorted((a, b) => Date.parse(b.at(-1)!.occurredAt) - Date.parse(a.at(-1)!.occurredAt))
    const verified = repeatedContexts[0]
    if (!verified) {
      const hasUnverifiedData = actorSignals.some((signal) => !isIndependentlyVerified(signal))
      const reason = independentlyVerified.length > 1 ? "No repeated verified goal / SLA" : hasUnverifiedData ? "Poor or unverified data" : "Single verified event"
      withheld.push(Object.freeze({ actorId, displayName: actor.displayName, reason, recordedSignals: actorSignals.length, verifiedRecurrences: Math.max(0, ...[...verifiedByGovernedContext.values()].map((items) => items.length)) }))
      continue
    }
    const actorInterventions = frozenInterventions.filter((item) => item.actorId === actorId)
    const stage = nextPeopleStage(verified, actorInterventions)
    if (!stage) {
      withheld.push(Object.freeze({ actorId, displayName: actor.displayName, reason: "No verified recurrence after prior intervention", recordedSignals: actorSignals.length, verifiedRecurrences: verified.length }))
      continue
    }
    const latestSignal = verified.at(-1)!
    const priorBotReminders = Object.freeze(actorInterventions.filter((item) => item.type === "Bot reminder"))
    const priorCounselling = Object.freeze(actorInterventions.filter((item) => item.type === "Counselling"))
    const priorPerformanceReviews = Object.freeze(actorInterventions.filter((item) => item.type === "Performance review"))
    surfaced.push(Object.freeze({
      actorId,
      displayName: actor.displayName,
      role: actor.role,
      stage,
      recurrenceCount: verified.length,
      metricId: latestSignal.metricId,
      governedGoal: latestSignal.governedGoal,
      governedSla: latestSignal.governedSla,
      impact: latestSignal.impact,
      evidenceHistory: Object.freeze(verified.map((signal) => signal.evidenceRef)),
      priorBotReminders,
      priorCounselling,
      priorPerformanceReviews,
      recommendedNextStep: recommendedNextStep(stage),
      namedHumanApprovalRequired: true,
      legalProcessChecksRequired: stage === "Exit review",
      automaticEmploymentDecisionPermitted: false,
      externalMessagePermitted: false,
    }))
  }
  return Object.freeze({ surfaced: Object.freeze(surfaced), withheld: Object.freeze(withheld) })
}

export function recordHumanStageApproval(input: {
  approvalId: string
  actorId: string
  stage: PeopleEscalationStage
  approvedBy: string
  approverRole: "HR" | "Management"
  approvedAt: string
  evidenceRef: string
  legalProcessCheckRef?: string
}) {
  if (!input.approvedBy.trim()) throw new Error("A named human approver is required for every people escalation stage.")
  assertProtectedRef(input.evidenceRef, "People stage approval")
  if (input.stage === "Exit review") {
    if (!input.legalProcessCheckRef) throw new Error("Exit review requires a protected legal and process check reference.")
    assertProtectedRef(input.legalProcessCheckRef, "Exit review legal and process check")
  }
  return Object.freeze({ ...input, reviewApproved: true as const, employmentDecisionExecuted: false as const, externalMessageSent: false as const })
}
