import { actionHistory, appendActionLogEntry, type ActionLogEntry } from "@/lib/action-log"
import type { ActionStatus } from "@/lib/allocation-types"
import type { DashboardRoute } from "@/lib/dashboard-model"

export type CommitmentSource = "system_detected" | "meeting_commitment" | "member_feedback"
export type ExpectedDirection = "up" | "down"
export type CommitmentOutcome = "Resolved" | "Closed but not resolved" | "Pending"
export type ExecutionResult = "Verified on time" | "Verified late" | "Awaiting verification" | "Verification overdue" | "Not executed" | "In progress" | "Rejected"

export type ExpectedMetric = {
  key: string
  label: string
  direction: ExpectedDirection
  checkWindowDays: number
  baselineValue: number
  actualValue: number | null
  unit: string
  memberSignal?: {
    label: string
    baselineValue: number
    actualValue: number | null
    unit: string
  }
}

type CommitmentBase = {
  id: string
  title: string
  owner: string
  team: string
  theatre: string
  committedBy: string
  dueAt: string
  evidence: string[]
  affectedMembers: number
  expectedMetric: ExpectedMetric
  actionLog: ActionLogEntry[]
  route: DashboardRoute
  mismatchId?: string
}

export type SystemDetectedCommitment = CommitmentBase & {
  source: "system_detected"
  meetingId: null
  meetingLabel: null
  meetingDate: null
  decisionText: null
  nextMeetingDue: null
}

export type MeetingCommitment = CommitmentBase & {
  source: "meeting_commitment"
  meetingId: string
  meetingLabel: string
  meetingDate: string
  decisionText: string
  nextMeetingDue: string
}

export type MemberFeedbackCommitment = CommitmentBase & {
  source: "member_feedback"
  memberToken: string
  pillar: "Living" | "Work" | "Essentials" | "General"
  category: string
  studio: string
  feedbackSummary: string
  rawConversationRef: string
  npsResponseId: string | null
  meetingId: null
  meetingLabel: null
  meetingDate: null
  decisionText: null
  nextMeetingDue: null
}

export type ExecutionAction = SystemDetectedCommitment | MeetingCommitment | MemberFeedbackCommitment

export type CreateCommitmentInput = {
  source: CommitmentSource
  title: string
  owner: string
  team: string
  theatre: string
  committedBy: string
  dueAt: string
  evidence?: string[]
  affectedMembers?: number
  expectedMetric: ExpectedMetric
  route: DashboardRoute
  meetingId?: string
  meetingLabel?: string
  meetingDate?: string
  decisionText?: string
  nextMeetingDue?: string
  mismatchId?: string
  memberToken?: string
  pillar?: MemberFeedbackCommitment["pillar"]
  category?: string
  studio?: string
  feedbackSummary?: string
  rawConversationRef?: string
  npsResponseId?: string | null
}

export type ActionWithResult = ExecutionAction & {
  status: ActionStatus
  result: ExecutionResult
  outcome: CommitmentOutcome
  carryForward: boolean
  verificationOverdue: boolean
  closedAt: string | null
  verifiedAt: string | null
}

export type PersonFollowThrough = {
  owner: string
  team: string
  commitments: number
  closed: number
  verified: number
  carriedForward: number
  closureRate: number
  closedButNotResolvedRate: number
}

export type MeetingFollowThrough = {
  meetingId: string
  meetingLabel: string
  commitments: number
  verifiedBeforeNextMeeting: number
  carriedForward: number
  closureRate: number
}

export type ExecutionReport = {
  actions: ActionWithResult[]
  agreed: number
  closed: number
  verified: number
  verifiedOnTime: number
  verifiedLate: number
  notExecuted: number
  awaitingVerification: number
  verificationOverdue: number
  rejected: number
  closureRate: number
  evidenceCoverage: number
  resolvedOutcomes: number
  closedButNotResolved: number
  pendingOutcomes: number
  affectedMembers: number
  carryForward: ActionWithResult[]
  people: PersonFollowThrough[]
  meetings: MeetingFollowThrough[]
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

function percentage(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100)
}

function required(value: string | undefined, label: string) {
  if (!value?.trim()) throw new Error(`${label} is required`)
  return value.trim()
}

export function nextMonthlyOccurrence(meetingDate: string) {
  const next = new Date(meetingDate)
  if (Number.isNaN(next.getTime())) throw new Error("Meeting date must be valid")
  const originalDate = next.getDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const daysInMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(originalDate, daysInMonth))
  return next.toISOString()
}

export function createCommitment(input: CreateCommitmentInput, createdAt: string, id: string): ExecutionAction {
  required(id, "Commitment ID")
  required(input.title, "Action")
  required(input.owner, "Owner")
  required(input.team, "Team")
  required(input.theatre, "Theatre")
  required(input.committedBy, "Committed by")
  required(input.dueAt, "Due date")
  required(input.expectedMetric.key, "Expected metric")
  required(input.expectedMetric.label, "Expected metric label")
  required(input.expectedMetric.direction, "Expected direction")
  if (!Number.isFinite(input.expectedMetric.checkWindowDays) || input.expectedMetric.checkWindowDays <= 0) {
    throw new Error("Check window must be greater than zero")
  }

  const isMeeting = input.source === "meeting_commitment"
  const originStatus: ActionStatus = isMeeting ? "Agreed" : "Detected"
  const actionLog: ActionLogEntry[] = [{
    id: `log-${id}-${isMeeting ? "agree" : "detect"}`,
    queue_item_id: id,
    actor_id: isMeeting ? input.committedBy : null,
    action_type: isMeeting ? "agree" : "detect",
    previous_status: null,
    new_status: originStatus,
    executed_at: createdAt,
    note: isMeeting ? required(input.decisionText, "Decision") : input.source === "member_feedback" ? "Member feedback captured" : "System detected the mismatch",
  }]

  const base: CommitmentBase = {
    id,
    title: input.title.trim(),
    owner: input.owner.trim(),
    team: input.team.trim(),
    theatre: input.theatre.trim(),
    committedBy: input.committedBy.trim(),
    dueAt: input.dueAt,
    evidence: input.evidence ?? [],
    affectedMembers: input.affectedMembers ?? 0,
    expectedMetric: input.expectedMetric,
    actionLog,
    route: input.route,
    ...(input.mismatchId ? { mismatchId: input.mismatchId } : {}),
  }

  if (input.source === "member_feedback") {
    return {
      ...base,
      source: "member_feedback",
      memberToken: required(input.memberToken, "Member token"),
      pillar: input.pillar ?? "General",
      category: required(input.category, "Feedback category"),
      studio: required(input.studio, "Studio"),
      feedbackSummary: required(input.feedbackSummary, "Feedback summary"),
      rawConversationRef: required(input.rawConversationRef, "Conversation reference"),
      npsResponseId: input.npsResponseId ?? null,
      meetingId: null,
      meetingLabel: null,
      meetingDate: null,
      decisionText: null,
      nextMeetingDue: null,
    }
  }

  if (!isMeeting) {
    return { ...base, source: "system_detected", meetingId: null, meetingLabel: null, meetingDate: null, decisionText: null, nextMeetingDue: null }
  }

  const meetingDate = required(input.meetingDate, "Meeting date")
  return {
    ...base,
    source: "meeting_commitment",
    meetingId: required(input.meetingId, "Meeting series"),
    meetingLabel: required(input.meetingLabel, "Meeting name"),
    meetingDate,
    decisionText: required(input.decisionText, "Decision"),
    nextMeetingDue: input.nextMeetingDue || nextMonthlyOccurrence(meetingDate),
  }
}

export function commitmentStatus(action: ExecutionAction): ActionStatus {
  return actionHistory(action.id, action.actionLog).at(-1)?.new_status ?? (action.source === "meeting_commitment" ? "Agreed" : "Detected")
}

function timestampFor(action: ExecutionAction, actionType: ActionLogEntry["action_type"]) {
  return actionHistory(action.id, action.actionLog).filter((entry) => entry.action_type === actionType).at(-1)?.executed_at ?? null
}

export function verificationDetails(action: ExecutionAction) {
  const history = actionHistory(action.id, action.actionLog)
  const close = history.filter((entry) => entry.action_type === "close").at(-1)
  const verify = history.filter((entry) => entry.action_type === "verify").at(-1)
  const differentActor = Boolean(close?.actor_id && verify?.actor_id && close.actor_id !== verify.actor_id)
  const valid = Boolean(
    close &&
    verify &&
    Date.parse(verify.executed_at) > Date.parse(close.executed_at) &&
    (action.evidence.length > 0 || differentActor),
  )
  return { close, verify, valid, differentActor }
}

export function commitmentOutcome(action: ExecutionAction, asOf: string): CommitmentOutcome {
  const verification = verificationDetails(action)
  if (!verification.valid || !verification.verify) return "Pending"
  const checkAt = Date.parse(verification.verify.executed_at) + action.expectedMetric.checkWindowDays * DAY_MS
  if (Date.parse(asOf) < checkAt || action.expectedMetric.actualValue === null) return "Pending"
  const { actualValue, baselineValue, direction } = action.expectedMetric
  const movedAsExpected = direction === "up" ? actualValue > baselineValue : actualValue < baselineValue
  return movedAsExpected ? "Resolved" : "Closed but not resolved"
}

export function shouldCarryForward(action: ExecutionAction, asOf: string) {
  if (action.source !== "meeting_commitment" || commitmentStatus(action) === "Dismissed") return false
  const verification = verificationDetails(action)
  const verifiedBeforeNextMeeting = Boolean(
    verification.valid &&
    verification.verify &&
    Date.parse(verification.verify.executed_at) <= Date.parse(action.nextMeetingDue),
  )
  return Date.parse(asOf) >= Date.parse(action.nextMeetingDue) && !verifiedBeforeNextMeeting
}

export function executionResult(action: ExecutionAction, asOf: string): ExecutionResult {
  const status = commitmentStatus(action)
  if (status === "Dismissed") return "Rejected"
  const verification = verificationDetails(action)
  if (verification.valid && verification.verify) {
    return Date.parse(verification.verify.executed_at) <= Date.parse(action.dueAt) ? "Verified on time" : "Verified late"
  }
  if (status === "Closed") {
    const closedAt = verification.close?.executed_at
    return closedAt && Date.parse(asOf) - Date.parse(closedAt) > 72 * HOUR_MS ? "Verification overdue" : "Awaiting verification"
  }
  return Date.parse(action.dueAt) < Date.parse(asOf) ? "Not executed" : "In progress"
}

export function buildExecutionReport(source: ExecutionAction[], asOf: string): ExecutionReport {
  const actions: ActionWithResult[] = source.map((action) => {
    const verification = verificationDetails(action)
    const result = executionResult(action, asOf)
    return {
      ...action,
      status: commitmentStatus(action),
      result,
      outcome: commitmentOutcome(action, asOf),
      carryForward: shouldCarryForward(action, asOf),
      verificationOverdue: result === "Verification overdue",
      closedAt: verification.close?.executed_at ?? null,
      verifiedAt: verification.valid ? verification.verify?.executed_at ?? null : null,
    }
  })
  const confirmed = actions.filter((action) => action.status !== "Dismissed")
  const closed = confirmed.filter((action) => action.status === "Closed" || action.status === "Verified")
  const verified = confirmed.filter((action) => action.result === "Verified on time" || action.result === "Verified late")
  const evaluated = verified.filter((action) => action.outcome !== "Pending")
  const groupedPeople = new Map<string, PersonFollowThrough>()

  for (const action of confirmed) {
    const current = groupedPeople.get(action.owner) ?? {
      owner: action.owner,
      team: action.team,
      commitments: 0,
      closed: 0,
      verified: 0,
      carriedForward: 0,
      closureRate: 0,
      closedButNotResolvedRate: 0,
    }
    current.commitments += 1
    if (action.status === "Closed" || action.status === "Verified") current.closed += 1
    if (action.verifiedAt) current.verified += 1
    if (action.carryForward) current.carriedForward += 1
    groupedPeople.set(action.owner, current)
  }

  const people = [...groupedPeople.values()].map((person) => {
    const personActions = confirmed.filter((action) => action.owner === person.owner)
    const personEvaluated = personActions.filter((action) => action.outcome !== "Pending")
    return {
      ...person,
      closureRate: percentage(person.verified, person.commitments),
      closedButNotResolvedRate: percentage(personEvaluated.filter((action) => action.outcome === "Closed but not resolved").length, personEvaluated.length),
    }
  }).sort((a, b) => b.carriedForward - a.carriedForward || a.closureRate - b.closureRate || a.owner.localeCompare(b.owner))

  const meetingGroups = new Map<string, MeetingFollowThrough>()
  for (const action of confirmed) {
    if (action.source !== "meeting_commitment") continue
    const current = meetingGroups.get(action.meetingId) ?? {
      meetingId: action.meetingId,
      meetingLabel: action.meetingLabel,
      commitments: 0,
      verifiedBeforeNextMeeting: 0,
      carriedForward: 0,
      closureRate: 0,
    }
    current.commitments += 1
    const verification = verificationDetails(action)
    if (verification.valid && verification.verify && Date.parse(verification.verify.executed_at) <= Date.parse(action.nextMeetingDue)) current.verifiedBeforeNextMeeting += 1
    if (action.carryForward) current.carriedForward += 1
    meetingGroups.set(action.meetingId, current)
  }
  const meetings = [...meetingGroups.values()].map((meeting) => ({
    ...meeting,
    closureRate: percentage(meeting.verifiedBeforeNextMeeting, meeting.commitments),
  })).sort((a, b) => a.closureRate - b.closureRate || a.meetingLabel.localeCompare(b.meetingLabel))

  return {
    actions,
    agreed: confirmed.length,
    closed: closed.length,
    verified: verified.length,
    verifiedOnTime: verified.filter((action) => action.result === "Verified on time").length,
    verifiedLate: verified.filter((action) => action.result === "Verified late").length,
    notExecuted: confirmed.filter((action) => action.result === "Not executed").length,
    awaitingVerification: confirmed.filter((action) => action.result === "Awaiting verification").length,
    verificationOverdue: confirmed.filter((action) => action.result === "Verification overdue").length,
    rejected: actions.filter((action) => action.result === "Rejected").length,
    closureRate: percentage(verified.length, confirmed.length),
    evidenceCoverage: percentage(verified.filter((action) => action.evidence.length > 0).length, verified.length),
    resolvedOutcomes: evaluated.filter((action) => action.outcome === "Resolved").length,
    closedButNotResolved: evaluated.filter((action) => action.outcome === "Closed but not resolved").length,
    pendingOutcomes: confirmed.filter((action) => action.outcome === "Pending").length,
    affectedMembers: evaluated.reduce((total, action) => total + action.affectedMembers, 0),
    carryForward: actions.filter((action) => action.carryForward).sort((a, b) => Date.parse(a.nextMeetingDue ?? asOf) - Date.parse(b.nextMeetingDue ?? asOf)),
    people,
    meetings,
  }
}

/**
 * The person-level chase queue. Owner non-execution is shown before checker
 * delay so the operating meeting starts with the action that never happened.
 */
export function buildActionChaseQueue(actions: ActionWithResult[]) {
  const chaseable = actions.filter((action) => action.result === "Not executed" || action.result === "Verification overdue")
  return chaseable.sort((a, b) => {
    const aRank = a.result === "Not executed" ? 0 : 1
    const bRank = b.result === "Not executed" ? 0 : 1
    return aRank - bRank || Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.owner.localeCompare(b.owner)
  })
}

/** Proof submitted by an owner is reviewed in Despatch, never edited in a report. */
export function buildDespatchValidationQueue(actions: ExecutionAction[], asOf: string) {
  return buildExecutionReport(actions, asOf).actions
    .filter((action) => action.status === "Closed" && action.evidence.length > 0)
    .sort((a, b) => Date.parse(a.closedAt ?? asOf) - Date.parse(b.closedAt ?? asOf))
}

/** Append the independent Despatch decision without changing the owner's proof. */
export function validateActionProof(action: ExecutionAction, checkerId: string, verifiedAt: string, logId: string): ExecutionAction {
  if (commitmentStatus(action) !== "Closed") throw new Error("Only a closed action can be validated")
  if (action.evidence.length === 0) throw new Error("Proof is required before Despatch validation")
  return {
    ...action,
    actionLog: appendActionLogEntry(action.actionLog, {
      queue_item_id: action.id,
      actor_id: checkerId,
      action_type: "verify",
      note: "Despatch validated the submitted proof.",
    }, verifiedAt, logId),
  }
}

export function commitmentBlockChanges(actions: ExecutionAction[], startAt: string, endAt: string) {
  const start = Date.parse(startAt)
  const end = Date.parse(endAt)
  let verifiedClosures = 0
  let closedButNotResolved = 0
  for (const action of actions) {
    const verification = verificationDetails(action)
    if (!verification.valid || !verification.verify) continue
    const verifiedAt = Date.parse(verification.verify.executed_at)
    if (verifiedAt >= start && verifiedAt <= end) verifiedClosures += 1
    const outcomeAt = verifiedAt + action.expectedMetric.checkWindowDays * DAY_MS
    if (outcomeAt >= start && outcomeAt <= end && commitmentOutcome(action, endAt) === "Closed but not resolved") closedButNotResolved += 1
  }
  return { verifiedClosures, closedButNotResolved }
}

export function eventTimestamp(action: ExecutionAction, actionType: ActionLogEntry["action_type"]) {
  return timestampFor(action, actionType)
}
