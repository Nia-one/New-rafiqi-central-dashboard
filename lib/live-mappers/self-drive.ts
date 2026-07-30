/**
 * Normalised, server-only read model for the Self Drive workspaces.
 *
 * It deliberately retains the original Sheet row alongside each calculated
 * value, so every visible value can be traced back to an Operations entry.
 */
type SheetRow = Record<string, unknown>
import type { MarginStudioInput } from "@/lib/operating-loop/nia-margins-loop"
import type { FillTask, NewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import type { MemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import type { NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import type { SavingsAction, SavingsTaskPreview } from "@/lib/operating-loop/member-savings-loop"
import { buildLoopHealth, type LoopHealth } from "@/lib/operating-loop/loop-health"

const text = (row: SheetRow, key: string) => String(row[key] ?? "").trim()
const number = (row: SheetRow, key: string) => {
  const parsed = Number(String(row[key] ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const latestRowTimestamp = (rows: readonly SheetRow[], keys: readonly string[], fallback: string) => {
  const timestamps = rows.flatMap((row) => keys.map((key) => text(row, key)))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))
  return timestamps[0] || fallback
}

export type LiveSelfDriveSnapshot = Readonly<{
  asOf: string
  monthlyCMTarget: number
  enterpriseDemand: readonly SheetRow[]
  activations: readonly SheetRow[]
  incidents: readonly SheetRow[]
  actions: readonly SheetRow[]
  evidence: readonly SheetRow[]
  approvals: readonly SheetRow[]
  people: readonly SheetRow[]
  theatres: readonly SheetRow[]
  studios: readonly SheetRow[]
  living: readonly SheetRow[]
  work: readonly SheetRow[]
  essentials: readonly SheetRow[]
  finance: readonly SheetRow[]
  /** Unfiltered source rows used only to report Finance_Daily connectivity/freshness. */
  financeSource: readonly SheetRow[]
  channels: readonly SheetRow[]
  learningHistory: readonly SheetRow[]
  dashboardContent: readonly SheetRow[]
  policies: readonly SheetRow[]
  memberNpsDashboard: readonly SheetRow[]
  memberNpsFeedback: readonly SheetRow[]
  memberNpsResponses: readonly SheetRow[]
  summary: Readonly<{
    openDemand: number
    remainingHeadcount: number
    verifiedActivations: number
    openIncidents: number
    openActions: number
    readyNests: number
    occupiedNests: number
    cm2Inr: number
  }>
}>

export type LiveMemberEngagementFreshness = Readonly<{
  connected: boolean
  asOf: string
  feeds: LoopHealth["feeds"]
  staleFeedCount: number
  quarantinedRecords: number
}>

export type LiveMemberSavingsFreshness = Readonly<{
  connected: boolean
  asOf: string
  feeds: LoopHealth["feeds"]
  staleFeedCount: number
  quarantinedRecords: number
}>

export type LiveMemberEngagementCommand = Readonly<{
  hasData: boolean
  openSignals: number
  baselineRecovered: number
  targetRecovered: number
  recoveryGap: number
  owner: string
  ownerActorId: string
  state: string
  dueAt: string
}>

export type LiveMemberEngagementHeadlineMeasures = Readonly<{
  hasData: boolean
  measures: MemberEngagementPreview["measures"]
  retentionImplicationSummary: string
  implication: string
  cohortSummary: string
  retentionCurves: MemberEngagementPreview["retentionCurves"]
  retentionFloor: number | null
  recovery: Readonly<{ verified: number; total: number; interventions: number; awaiting: number; reopened: number; closureRule: string }>
}>

export type LiveMemberEngagementAction = Readonly<{
  actionId: string
  memberLabel: string
  category: string
  issue: string
  owner: string
  dueAt: string
  action: string
  state: "Open" | "Reopened" | "Awaiting verification" | "Verified recovered"
  progress: string
  verifiedResult: string
}>

export type LiveMemberEngagementRepeatIssue = Readonly<{
  incidentId: string
  title: string
  severity: string
  owner: string
  dueAt: string
  state: string
  action: string
  whyItMatters: string
  alreadyDid: string
  whatHappensNext: string
}>

export type LiveMemberEngagementBackground = Readonly<{
  eventCount: number
  source: Readonly<{
    connected: boolean
    count: number
    names: string
    asOf: string
    confidence: string
    adoption: string
  }>
  nps: Readonly<{
    survey: Readonly<{ score: string; method: string; inputs: string }>
    behavioural: Readonly<{ score: string; method: string; inputs: string }>
    gap: string
  }>
  exitMovements: readonly Readonly<{ reason: string; current: string; baseline: string }>[]
  learning: Readonly<{
    proposedChange: string; expectedEffect: string; attribution: string; evidence: string
    forecastError: string; freshReversible: string; humanControls: string
    confidenceAdoption: string; effects: string; rollback: string
  }>
  auditEvents: readonly Readonly<{ id: string; type: string; status: string; detail: string; at: string }>[]
  boundary: Readonly<{ summary: string; detail: string }>
}>

export type LiveSelfDriveFilters = Readonly<{
  theatre: string
  location: string
  studio: string
  person: string
}>

export type LiveNiaGrowthProjection = Readonly<{
  summary: NiaGrowthPreview["summary"]
  measures: NiaGrowthPreview["measures"]
}>

export type LiveNewAddsFillStatus = Readonly<{
  hasData: boolean
  target: number
  verified: number
  gap: number
  progressPercent: number
  owner: string
}>

export type LiveNewAddsTheatreProgress = Readonly<{
  theatre: string
  ownerRole: string
  vacantNests: number
  verifiedBillingLiveFills: number
  dailyTarget: number
  daysToFill: number
  averageFillTimeLabel: string
}>

export type LiveNewAddsVacancyStudio = Readonly<{
  theatre: string
  studioId: string
  studioName: string
  contractedNests: number
  occupiedNests: number
  pendingNests: number
  occupancyPercent: number
}>

export type LiveNewAddsVacancyGroup = Readonly<{
  theatre: string
  contractedNests: number
  occupiedNests: number
  pendingNests: number
  studios: readonly LiveNewAddsVacancyStudio[]
}>

export type LiveNewAddsProof = Readonly<{
  loopHealth: LoopHealth
  measures: NewAddsPreview["measures"]
  feedInputCount: number
  clockInputCount: number
  governedActionCount: number
  auditEventCount: number
}>

const uniqueRows = (rows: readonly SheetRow[], keys: readonly string[]) => {
  const unique = new Map<string, SheetRow>()
  rows.forEach((row, index) => {
    const key = keys.map((field) => text(row, field)).find(Boolean) || `row-${index}`
    if (!unique.has(key)) unique.set(key, row)
  })
  return [...unique.values()]
}

const verifiedBillingLiveActivations = (snapshot: LiveSelfDriveSnapshot, studioIds: ReadonlySet<string>) => uniqueRows(snapshot.activations
  .filter((row) => studioIds.has(text(row, "studio id")))
  .filter((row) => text(row, "verification status").toLowerCase() === "verified")
  .filter((row) => number(row, "membership billed inr") > 0), ["member token", "activation id"])

function averageFillTimeLabel(rows: readonly SheetRow[]) {
  const durations = rows.map((row) => {
    const started = Date.parse(text(row, "activated at"))
    const verified = Date.parse(text(row, "verified at"))
    return Number.isFinite(started) && Number.isFinite(verified) && verified >= started ? (verified - started) / 3_600_000 : NaN
  }).filter(Number.isFinite)
  if (!durations.length) return "No history"
  const hours = durations.reduce((sum, value) => sum + value, 0) / durations.length
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 24) return `${Math.round(hours)} hr`
  return `${Math.round(hours / 24)} days`
}

export function buildLiveNewAddsTheatreProgress(snapshot: LiveSelfDriveSnapshot): readonly LiveNewAddsTheatreProgress[] {
  const fonoLiving = snapshot.living.filter((row) => text(row, "supply model").toLowerCase() === "fono")
  const theatreIds = [...new Set(fonoLiving.map((row) => text(row, "theatre id")))]

  return Object.freeze(theatreIds.map((theatreId) => {
    const livingRows = fonoLiving.filter((row) => text(row, "theatre id") === theatreId)
    const studioIds = new Set(livingRows.map((row) => text(row, "studio id")).filter(Boolean))
    const activationRows = verifiedBillingLiveActivations(snapshot, studioIds)
    // Studios is the occupancy system of record. Aggregate before calculating
    // the gap so an over-occupied Studio offsets vacancy elsewhere in the same
    // Theatre, exactly as the source report totals do.
    const contractedNests = livingRows.reduce((sum, row) => sum + (number(row, "contracted nests") || number(row, "activation ready nests")), 0)
    const occupiedNests = livingRows.reduce((sum, row) => sum + number(row, "occupied nests"), 0)
    const vacantNests = Math.max(0, contractedNests - occupiedNests)
    const normalizedTheatreId = theatreId.trim().toLowerCase()
    const theatreRow = snapshot.theatres.find((row) => [text(row, "theatre id"), text(row, "theatre name")].some((value) => value.trim().toLowerCase() === normalizedTheatreId))
    const ownerActorId = livingRows.map((row) => text(row, "next action owner actor id")).find(Boolean) || text(theatreRow ?? {}, "lead actor id")
    const owner = snapshot.people.find((row) => text(row, "actor id") === ownerActorId)?.["display name"]
    const theatre = theatreRow?.["theatre name"]

    return Object.freeze({
      theatre: String(theatre || theatreId || "Unmapped Theatre").trim(),
      ownerRole: String(owner || ownerActorId || "Living Operations").trim(),
      vacantNests,
      verifiedBillingLiveFills: occupiedNests,
      dailyTarget: contractedNests,
      daysToFill: 0,
      averageFillTimeLabel: averageFillTimeLabel(activationRows),
    })
  }))
}

/** Studio-level FONO vacancies sourced only from the Studios-backed Living rows. */
export function buildLiveNewAddsVacancyGroups(snapshot: LiveSelfDriveSnapshot): readonly LiveNewAddsVacancyGroup[] {
  const studioNameById = new Map(snapshot.studios.map((row) => [text(row, "studio id"), text(row, "studio name")]))
  const fonoRows = snapshot.living.filter((row) => text(row, "supply model").toLowerCase() === "fono")
  const rows = fonoRows.flatMap((row) => {
    const contractedNests = number(row, "contracted nests") || number(row, "activation ready nests")
    const occupiedNests = number(row, "occupied nests")
    const pendingNests = Math.max(0, contractedNests - occupiedNests)
    if (pendingNests <= 0) return []
    const studioId = text(row, "studio id")
    return [Object.freeze({
      theatre: text(row, "theatre id") || "Unmapped Theatre",
      studioId,
      studioName: studioNameById.get(studioId) || studioId || "Unmapped Studio",
      contractedNests,
      occupiedNests,
      pendingNests,
      occupancyPercent: contractedNests > 0 ? Math.round(occupiedNests / contractedNests * 1_000) / 10 : 0,
    })]
  })
  const theatres = [...new Set(rows.map((row) => row.theatre))]
  return Object.freeze(theatres.map((theatre) => {
    const studios = rows.filter((row) => row.theatre === theatre).sort((left, right) => right.pendingNests - left.pendingNests || left.studioName.localeCompare(right.studioName))
    const theatreRows = fonoRows.filter((row) => (text(row, "theatre id") || "Unmapped Theatre") === theatre)
    const contractedNests = theatreRows.reduce((sum, row) => sum + (number(row, "contracted nests") || number(row, "activation ready nests")), 0)
    const occupiedNests = theatreRows.reduce((sum, row) => sum + number(row, "occupied nests"), 0)
    return Object.freeze({
      theatre,
      contractedNests,
      occupiedNests,
      pendingNests: Math.max(0, contractedNests - occupiedNests),
      studios: Object.freeze(studios),
    })
  }).sort((left, right) => right.pendingNests - left.pendingNests || left.theatre.localeCompare(right.theatre)))
}

function fillTaskState(value: string): FillTask["state"] {
  const state = value.trim().toLowerCase()
  if (["verified", "closed", "resolved", "complete", "completed"].includes(state)) return "Verified"
  if (state === "reopened") return "Reopened"
  if (["in progress", "proof submitted", "evidence pending"].includes(state)) return "Evidence pending"
  if (state.includes("retry")) return "Retry scheduled"
  if (state === "detected") return "Detected"
  if (state === "proposed") return "Proposed"
  return "Assigned"
}

export function buildLiveNewAddsFillTasks(snapshot: LiveSelfDriveSnapshot): readonly FillTask[] {
  const fonoStudioIds = new Set(snapshot.living
    .filter((row) => text(row, "supply model").toLowerCase() === "fono")
    .map((row) => text(row, "studio id"))
    .filter(Boolean))
  const incidentById = new Map(snapshot.incidents.map((row) => [text(row, "incident id"), row]))
  const actionStudioIds = new Set(snapshot.actions
    .map((row) => text(row, "studio id"))
    .filter((value) => fonoStudioIds.has(value)))

  return Object.freeze(snapshot.actions.flatMap((action) => {
    const actionId = text(action, "action id")
    const linkedIncidentId = text(action, "incident id")
    const incident = linkedIncidentId ? incidentById.get(linkedIncidentId) : undefined
    const actionStudioId = text(action, "studio id")
    const incidentStudioId = text(incident ?? {}, "studio id")
    const studioId = actionStudioId || incidentStudioId
    const isFonoAction = Boolean(studioId && fonoStudioIds.has(studioId)) || actionStudioIds.has(actionStudioId)
    const incidentIsLiving = text(incident ?? {}, "domain").toLowerCase() === "living"
    const isGovernedByIncident = Boolean(incident && incidentIsLiving && studioId && fonoStudioIds.has(studioId))
    if (!isFonoAction || (!isGovernedByIncident && !actionStudioId)) return []
    const theatreId = text(incident ?? {}, "theatre id") || text(action, "theatre id")
    const ownerActorId = text(action, "owner actor id") || text(incident ?? {}, "owner actor id")
    const owner = snapshot.people.find((row) => text(row, "actor id") === ownerActorId)?.["display name"]
    const theatre = snapshot.theatres.find((row) => text(row, "theatre id") === theatreId)?.["theatre name"]
    const studio = snapshot.studios.find((row) => text(row, "studio id") === studioId)?.["studio name"]
    const expectedMetric = text(action, "expected metric")
    const targetValue = text(action, "target value")
    const requiredEvidence = text(action, "required evidence")
    const nextAction = text(action, "operating objective") || text(incident ?? {}, "action required") || "Action required"

    return [Object.freeze({
      actionId,
      idempotencyKey: actionId,
      eventId: linkedIncidentId || actionId,
      supplyModel: "FONO" as const,
      theatre: String(theatre || theatreId || "Unmapped Theatre").trim(),
      studioId: String(studio || studioId || "Unmapped Studio").trim(),
      channel: "Nia field" as const,
      ownerRole: String(owner || ownerActorId || "Unassigned").trim(),
      dueAt: text(action, "due at") || text(incident ?? {}, "due at"),
      expectedOutcome: requiredEvidence || [targetValue, expectedMetric].filter(Boolean).join(" ") || "Verified billing-live result",
      state: fillTaskState(text(action, "state")),
      nextAction,
      attempts: 0,
      whatsapp: Object.freeze({ approvedTemplate: false, memberConsent: false, withinQuietHours: false, liveEnabledIntegration: false, execution: "Shadow only" as const }),
    })]
  }))
}

/** Member Adds is a FONO vacancy loop; Shram Park capacity never belongs here. */
export function buildLiveNewAddsFillStatus(snapshot: LiveSelfDriveSnapshot): LiveNewAddsFillStatus {
  const theatres = buildLiveNewAddsTheatreProgress(snapshot)
  const openVacancies = theatres.reduce((sum, row) => sum + row.vacantNests, 0)
  const verified = theatres.reduce((sum, row) => sum + row.verifiedBillingLiveFills, 0)
  const target = theatres.reduce((sum, row) => sum + row.dailyTarget, 0)
  const owners = [...new Set(theatres.map((row) => row.ownerRole).filter(Boolean))]
  const owner = theatres.length === 0 ? "Unassigned" : owners.length === 1 ? owners[0] : owners.length > 1 ? "Theatre owners" : "Living Operations"

  return Object.freeze({
    hasData: theatres.length > 0,
    target,
    verified,
    gap: openVacancies,
    progressPercent: target > 0 ? Math.min(100, Math.round(verified / target * 100)) : 0,
    owner,
  })
}

function median(values: readonly number[]) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

/** One live projection for every value in Member Adds > Proof and controls. */
export function buildLiveNewAddsProof(snapshot: LiveSelfDriveSnapshot): LiveNewAddsProof {
  const status = buildLiveNewAddsFillStatus(snapshot)
  const tasks = buildLiveNewAddsFillTasks(snapshot)
  const actionIds = new Set(tasks.map((task) => task.actionId))
  const fonoStudioIds = new Set(snapshot.living
    .filter((row) => text(row, "supply model").toLowerCase() === "fono")
    .map((row) => text(row, "studio id"))
    .filter(Boolean))
  const quarantinedLivingRows = snapshot.living.filter((row) => text(row, "supply model").toLowerCase() !== "fono").length
  const activations = verifiedBillingLiveActivations(snapshot, fonoStudioIds)
  const evidence = uniqueRows(snapshot.evidence.filter((row) => actionIds.has(text(row, "linked id"))), ["evidence id"])
  const reopenedActions = tasks.filter((task) => task.state === "Reopened").length
  const verifiedEvidence = evidence.filter((row) => ["verified", "approved", "accepted"].includes(text(row, "verification status").toLowerCase())).length
  const reopenedEvidence = evidence.filter((row) => ["reopened", "rejected", "failed"].includes(text(row, "verification status").toLowerCase())).length
  const awaitingEvidence = Math.max(0, evidence.length - verifiedEvidence - reopenedEvidence)
  const verified = activations.length + verifiedEvidence
  const reopened = reopenedActions + reopenedEvidence
  const awaiting = awaitingEvidence
  const claimed = verified + awaiting + reopened
  const oldestAwaitingAt = awaiting > 0
    ? evidence.filter((row) => !["verified", "approved", "accepted", "reopened", "rejected", "failed"].includes(text(row, "verification status").toLowerCase()))
      .map((row) => text(row, "uploaded at"))
      .filter((value) => Number.isFinite(Date.parse(value)))
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] || snapshot.asOf
    : null
  const sourceRows = activations.map((row) => text(row, "acquisition source") || text(row, "member source") || text(row, "source") || text(row, "channel")).filter(Boolean)
  const sourceCounts = [...new Set(sourceRows)].map((source) => Object.freeze({ label: source, value: sourceRows.filter((value) => value === source).length }))
  const loadedCacRows = activations.map((row) => number(row, "actual loaded cac inr") || number(row, "loaded cac inr") || number(row, "channel cost inr")).filter((value) => value > 0)
  const paybackRows = activations.map((row) => number(row, "payback days")).filter((value) => value > 0)
  const durationHours = activations.map((row) => {
    const activatedAt = Date.parse(text(row, "activated at"))
    const verifiedAt = Date.parse(text(row, "verified at"))
    return Number.isFinite(activatedAt) && Number.isFinite(verifiedAt) && verifiedAt >= activatedAt ? (verifiedAt - activatedAt) / 3_600_000 : NaN
  }).filter(Number.isFinite)
  const medianHours = median(durationHours)
  const averageCac = loadedCacRows.length ? Math.round(loadedCacRows.reduce((sum, value) => sum + value, 0) / loadedCacRows.length) : 0
  const medianPayback = median(paybackRows)
  const occupancyUpdatedAt = latestRowTimestamp(
    snapshot.living.filter((row) => text(row, "supply model").toLowerCase() === "fono"),
    ["updated at", "captured at", "heartbeat at"],
    snapshot.asOf,
  )
  const billingUpdatedAt = latestRowTimestamp(
    activations,
    ["updated at", "verified at", "activated at"],
    snapshot.asOf,
  )
  const controlsUpdatedAt = latestRowTimestamp(
    [...snapshot.actions.filter((row) => actionIds.has(text(row, "action id"))), ...evidence],
    ["updated at", "verified at", "proof submitted at", "reopened at", "in progress at", "assigned at", "proposed at", "uploaded at"],
    snapshot.asOf,
  )
  const sourceSummary = sourceCounts.length ? sourceCounts.map((row) => `${row.label} ${row.value}`).join(" · ") : "Source not recorded"
  const measures: NewAddsPreview["measures"] = Object.freeze([
    Object.freeze({ id: "verified-fills" as const, label: "Occupancy gap", primary: `${status.gap} Nests vacant`, secondary: `${status.verified} of ${status.target} contracted Nests occupied from Studios · ${activations.length} new billing-live fill${activations.length === 1 ? "" : "s"} independently verified`, chart: Object.freeze({ kind: "progress" as const, value: status.verified, max: Math.max(1, status.target) }) }),
    Object.freeze({ id: "adds-by-source" as const, label: "Adds by source", primary: sourceSummary, secondary: sourceCounts.length ? "From Member_Activation" : "No acquisition-source field is recorded", chart: Object.freeze({ kind: "segments" as const, parts: Object.freeze(sourceCounts) }) }),
    Object.freeze({ id: "cac-payback" as const, label: "Actual CAC & payback", primary: averageCac ? `₹${averageCac.toLocaleString("en-IN")} · ${medianPayback ? `${medianPayback} days` : "payback not recorded"}` : "No verified CAC", secondary: averageCac ? `${loadedCacRows.length} verified loaded-cost record${loadedCacRows.length === 1 ? "" : "s"}` : "No loaded acquisition cost is recorded", chart: Object.freeze({ kind: "segments" as const, parts: Object.freeze(averageCac ? [Object.freeze({ label: "Verified CAC records", value: loadedCacRows.length })] : []) }) }),
    Object.freeze({ id: "arrival-billing" as const, label: "Arrival to billing live", primary: durationHours.length ? `${medianHours < 1 ? Math.max(1, Math.round(medianHours * 60)) : Math.round(medianHours)} ${medianHours < 1 ? "minutes" : "hours"}` : "No verified duration", secondary: durationHours.length ? `Median · ${durationHours.filter((hours) => hours > 48).length} activations over 48h` : "Activated and verified timestamps required", chart: Object.freeze({ kind: "threshold" as const, value: medianHours, target: 48, unit: "h", goodWhenUnder: true }) }),
  ])
  const loopHealth = buildLoopHealth({
    asOf: snapshot.asOf,
    feeds: Object.freeze([
      Object.freeze({ feedId: "LIVE-FONO-OCCUPANCY", label: "FONO membership and occupancy", lastUpdatedAt: occupancyUpdatedAt, cadenceMinutes: 60, critical: true, affectedClaims: Object.freeze(["Verified fills"]) }),
      Object.freeze({ feedId: "LIVE-BILLING-OUTCOMES", label: "Billing-live outcomes", lastUpdatedAt: billingUpdatedAt, cadenceMinutes: 60, critical: true, affectedClaims: Object.freeze(["Verified fills", "Arrival to billing live"]) }),
      Object.freeze({ feedId: "LIVE-ACTION-EVIDENCE", label: "Action and evidence controls", lastUpdatedAt: controlsUpdatedAt, cadenceMinutes: 240, critical: true, affectedClaims: Object.freeze(["Outcome checks", "CAC and payback"]) }),
    ]),
    clocks: Object.freeze(tasks.filter((task) => Number.isFinite(Date.parse(task.dueAt))).map((task) => Object.freeze({ clockId: `LIVE-CLOCK-${task.actionId}`, label: `${task.studioId} fill recovery`, ownerRole: task.ownerRole, dueAt: task.dueAt, state: task.state === "Verified" ? "Recovered" as const : "Running" as const }))),
    verification: Object.freeze({ claimed, verified, awaiting, reopened, oldestAwaitingAt }),
    quarantinedRecords: quarantinedLivingRows,
  })

  return Object.freeze({
    loopHealth,
    measures,
    feedInputCount: loopHealth.feeds.length,
    clockInputCount: loopHealth.clocks.length,
    governedActionCount: tasks.length,
    auditEventCount: tasks.length + evidence.length + snapshot.approvals.filter((row) => actionIds.has(text(row, "linked action id"))).length,
  })
}

/** Live Sheet connectivity and validation for Member Engagement > Data freshness. */
export function buildLiveMemberEngagementFreshness(snapshot: LiveSelfDriveSnapshot): LiveMemberEngagementFreshness {
  const engagementActions = snapshot.actions.filter((row) => {
    const actionId = text(row, "action id").toLowerCase()
    const objective = text(row, "operating objective").toLowerCase()
    return actionId.includes("eng") || objective.includes("member engagement") || objective.includes("retention")
  })
  const feedbackRows = snapshot.memberNpsFeedback
  const responseRows = snapshot.memberNpsResponses
  const validFeedback = feedbackRows.filter((row) => text(row, "id") && text(row, "member token") && text(row, "captured at"))
  const validResponses = responseRows.filter((row) => text(row, "id") && text(row, "member token") && text(row, "collected at") && text(row, "score"))
  const validActions = engagementActions.filter((row) => text(row, "action id") && text(row, "owner actor id") && text(row, "due at"))
  const quarantinedRecords = feedbackRows.length - validFeedback.length + responseRows.length - validResponses.length + engagementActions.length - validActions.length
  const connected = feedbackRows.length > 0 || responseRows.length > 0 || engagementActions.length > 0
  const health = buildLoopHealth({
    asOf: snapshot.asOf,
    feeds: Object.freeze([
      Object.freeze({ feedId: "LIVE-MEMBER-NPS-FEEDBACK", label: "Member feedback", lastUpdatedAt: latestRowTimestamp(validFeedback, ["updated at", "captured at"], snapshot.asOf), cadenceMinutes: 1_440, critical: true, affectedClaims: Object.freeze(["Member-impacting issues"]) }),
      Object.freeze({ feedId: "LIVE-MEMBER-NPS-RESPONSES", label: "Member NPS responses", lastUpdatedAt: latestRowTimestamp(validResponses, ["updated at", "collected at"], snapshot.asOf), cadenceMinutes: 43_200, critical: true, affectedClaims: Object.freeze(["NPS and retention"]) }),
      Object.freeze({ feedId: "LIVE-MEMBER-ENGAGEMENT-ACTIONS", label: "Member recovery actions", lastUpdatedAt: latestRowTimestamp(validActions, ["updated at", "verified at", "proof submitted at", "in progress at", "assigned at", "proposed at"], snapshot.asOf), cadenceMinutes: 240, critical: true, affectedClaims: Object.freeze(["Recovery ownership"]) }),
    ]),
    clocks: Object.freeze([]),
    verification: Object.freeze({ claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null }),
    quarantinedRecords,
  })

  return Object.freeze({ connected, asOf: snapshot.asOf, feeds: health.feeds, staleFeedCount: health.feeds.filter((feed) => feed.stale).length, quarantinedRecords })
}

const isMemberSavingsAction = (row: SheetRow) => {
  const identity = `${text(row, "action id")} ${text(row, "operating objective")} ${text(row, "expected metric")}`.toLowerCase()
  return identity.includes("sav") || identity.includes("member savings") || identity.includes("essentials pricing")
}

/** Sheet-backed connectivity and control state for Member Savings. */
export function buildLiveMemberSavingsFreshness(snapshot: LiveSelfDriveSnapshot): LiveMemberSavingsFreshness {
  const savingsActions = snapshot.actions.filter(isMemberSavingsAction)
  const actionIds = new Set(savingsActions.map((row) => text(row, "action id")).filter(Boolean))
  const savingsEvidence = snapshot.evidence.filter((row) => actionIds.has(text(row, "linked id")))
  const savingsApprovals = snapshot.approvals.filter((row) => actionIds.has(text(row, "linked action id")))
  const validEssentials = snapshot.essentials.filter((row) => text(row, "essentials hourly id") && text(row, "captured at"))
  const validActions = savingsActions.filter((row) => text(row, "action id") && text(row, "owner actor id") && text(row, "due at"))
  const validEvidence = savingsEvidence.filter((row) => text(row, "evidence id") && text(row, "linked id") && (text(row, "uploaded at") || text(row, "verified at")))
  const validApprovals = savingsApprovals.filter((row) => text(row, "approval id") && text(row, "linked action id") && text(row, "decision"))
  const quarantinedRecords = snapshot.essentials.length - validEssentials.length
    + savingsActions.length - validActions.length
    + savingsEvidence.length - validEvidence.length
    + savingsApprovals.length - validApprovals.length
  const feedInputs = [
    validEssentials.length ? Object.freeze({ feedId: "LIVE-MEMBER-SAVINGS-ESSENTIALS", label: "Essentials savings and margin", lastUpdatedAt: latestRowTimestamp(validEssentials, ["updated at", "captured at"], snapshot.asOf), cadenceMinutes: 1_440, critical: true, affectedClaims: Object.freeze(["Member savings", "Nia margin"]) }) : null,
    validActions.length ? Object.freeze({ feedId: "LIVE-MEMBER-SAVINGS-ACTIONS", label: "Member Savings actions", lastUpdatedAt: latestRowTimestamp(validActions, ["updated at", "in progress at", "assigned at", "proposed at"], snapshot.asOf), cadenceMinutes: 240, critical: true, affectedClaims: Object.freeze(["Recovery ownership", "Action clocks"]) }) : null,
    validEvidence.length ? Object.freeze({ feedId: "LIVE-MEMBER-SAVINGS-EVIDENCE", label: "Independent savings evidence", lastUpdatedAt: latestRowTimestamp(validEvidence, ["verified at", "uploaded at", "updated at"], snapshot.asOf), cadenceMinutes: 1_440, critical: true, affectedClaims: Object.freeze(["Verified recovery"]) }) : null,
    validApprovals.length ? Object.freeze({ feedId: "LIVE-MEMBER-SAVINGS-APPROVALS", label: "Savings approvals", lastUpdatedAt: latestRowTimestamp(validApprovals, ["decided at", "updated at", "requested at"], snapshot.asOf), cadenceMinutes: 1_440, critical: true, affectedClaims: Object.freeze(["Governed pricing decisions"]) }) : null,
  ].filter((feed): feed is NonNullable<typeof feed> => feed !== null)
  const health = buildLoopHealth({
    asOf: snapshot.asOf,
    feeds: Object.freeze(feedInputs),
    clocks: Object.freeze([]),
    verification: Object.freeze({ claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null }),
    quarantinedRecords,
  })
  return Object.freeze({ connected: feedInputs.length > 0, asOf: snapshot.asOf, feeds: health.feeds, staleFeedCount: health.feeds.filter((feed) => feed.stale).length, quarantinedRecords })
}

export function buildLiveMemberSavingsHealth(snapshot: LiveSelfDriveSnapshot): LoopHealth {
  const freshness = buildLiveMemberSavingsFreshness(snapshot)
  const savingsActions = snapshot.actions.filter(isMemberSavingsAction)
  const actionIds = new Set(savingsActions.map((row) => text(row, "action id")).filter(Boolean))
  const evidence = snapshot.evidence.filter((row) => actionIds.has(text(row, "linked id")))
  const approvals = snapshot.approvals.filter((row) => actionIds.has(text(row, "linked action id")))
  const verified = evidence.filter((row) => text(row, "verification status").toLowerCase() === "verified").length
  const reopened = evidence.filter((row) => text(row, "verification status").toLowerCase() === "reopened").length
    + savingsActions.filter((row) => text(row, "state").toLowerCase() === "reopened").length
  const claimed = Math.max(evidence.length, savingsActions.length)
  const awaiting = Math.max(0, claimed - verified - reopened)
  const oldestAwaitingAt = awaiting > 0 ? ([
    ...evidence.filter((row) => !["verified", "reopened"].includes(text(row, "verification status").toLowerCase()))
      .map((row) => text(row, "uploaded at") || text(row, "updated at")),
    ...savingsActions.filter((row) => !["verified", "closed", "reopened"].includes(text(row, "state").toLowerCase()))
      .map((row) => text(row, "proposed at") || text(row, "assigned at") || text(row, "in progress at") || text(row, "updated at")),
    ...approvals.filter((row) => !["approved", "rejected"].includes(text(row, "decision").toLowerCase()))
      .map((row) => text(row, "requested at") || text(row, "updated at")),
  ]
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? snapshot.asOf) : null
  return buildLoopHealth({
    asOf: snapshot.asOf,
    feeds: freshness.feeds.map((feed) => Object.freeze({ feedId: feed.feedId, label: feed.label, lastUpdatedAt: feed.lastUpdatedAt, cadenceMinutes: feed.cadenceMinutes, critical: feed.critical, affectedClaims: feed.affectedClaims })),
    clocks: savingsActions.filter((row) => Number.isFinite(Date.parse(text(row, "due at")))).map((row) => {
      const state = text(row, "state").toLowerCase()
      return Object.freeze({ clockId: `LIVE-MEMBER-SAVINGS-${text(row, "action id")}`, label: text(row, "operating objective") || "Member Savings recovery", ownerRole: text(row, "owner actor id") || "Unassigned", dueAt: text(row, "due at"), state: state === "verified" || state === "closed" ? "Recovered" as const : "Running" as const })
    }),
    verification: Object.freeze({ claimed, verified, awaiting, reopened, oldestAwaitingAt }),
    quarantinedRecords: freshness.quarantinedRecords,
  })
}

export function buildLiveMemberSavingsTasks(snapshot: LiveSelfDriveSnapshot): readonly SavingsTaskPreview[] {
  const actions = snapshot.actions.filter(isMemberSavingsAction)
  const peopleById = new Map(snapshot.people.map((row) => [text(row, "actor id"), row]))
  const studiosById = new Map(snapshot.studios.flatMap((row) => [text(row, "studio id"), text(row, "studio code")].filter(Boolean).map((id) => [id, row] as const)))

  return Object.freeze(actions.flatMap((action) => {
    const actionId = text(action, "action id")
    const evidence = snapshot.evidence.filter((row) => text(row, "linked id") === actionId)
    const latestEvidence = evidence.slice().sort((left, right) => {
      const leftAt = Date.parse(text(left, "verified at") || text(left, "uploaded at") || text(left, "updated at")) || 0
      const rightAt = Date.parse(text(right, "verified at") || text(right, "uploaded at") || text(right, "updated at")) || 0
      return rightAt - leftAt
    })[0]
    const evidenceStatus = text(latestEvidence ?? {}, "verification status").toLowerCase()
    const actionState = text(action, "state").toLowerCase()
    if (["verified", "approved", "accepted", "closed", "resolved"].includes(evidenceStatus) || ["verified", "closed", "resolved"].includes(actionState)) return []
    const ownerActorId = text(action, "owner actor id")
    const studioId = text(action, "studio id") || text(action, "studio code")
    const studio = studiosById.get(studioId)
    const owner = text(peopleById.get(ownerActorId) ?? {}, "display name") || ownerActorId || "No owner recorded"
    const expectedMetric = text(action, "expected metric") || "No expected metric recorded"
    const issue = text(action, "operating objective") || "No operating objective recorded"
    const service = text(studio ?? {}, "studio") || text(studio ?? {}, "studio name") || text(action, "studio") || studioId || "No Studio recorded"
    const progress = text(action, "next action") || "No next action recorded"
    const verifiedResult = text(latestEvidence ?? {}, "notes") || text(latestEvidence ?? {}, "rejected reason") || text(action, "verification result") || (evidenceStatus ? `Evidence ${evidenceStatus}` : "No independent evidence recorded")
    const state = (["reopened", "rejected", "failed"].includes(evidenceStatus) ? "Reopened" : evidenceStatus ? "Awaiting verification" : text(action, "state") || "Assigned") as SavingsTaskPreview["state"]

    return [Object.freeze({
      actionId,
      issue,
      service,
      owner,
      dueAt: text(action, "due at"),
      expectedMetric,
      progress,
      verifiedResult,
      state,
      engineAction: action as unknown as SavingsAction,
    })]
  }))
}

/** Sheet-backed command for Member Engagement > Retention command. */
export function buildLiveMemberEngagementCommand(snapshot: LiveSelfDriveSnapshot): LiveMemberEngagementCommand {
  const engagementActions = snapshot.actions.filter((row) => {
    const actionId = text(row, "action id").toLowerCase()
    const objective = text(row, "operating objective").toLowerCase()
    return actionId.includes("eng") || objective.includes("member engagement") || objective.includes("retention")
  })
  const command = engagementActions[0]
  const hasGovernedAction = Boolean(command && (text(command, "action id") || text(command, "operating objective") || text(command, "owner actor id") || text(command, "due at") || text(command, "state")))
  const verifiedEvidenceIds = new Set(snapshot.evidence
    .filter((row) => text(row, "verification status").toLowerCase() === "verified")
    .map((row) => text(row, "linked id"))
    .filter(Boolean))
  const openSignals = snapshot.memberNpsFeedback.filter((row) => {
    const actionId = text(row, "action id")
    const responseId = text(row, "nps response id")
    return !verifiedEvidenceIds.has(actionId) && !verifiedEvidenceIds.has(responseId)
  }).length
  const baselineRecovered = hasGovernedAction ? number(command, "baseline value") : 0
  const targetRecovered = hasGovernedAction ? number(command, "target value") : 0
  const ownerActorId = hasGovernedAction ? text(command, "owner actor id") : ""
  const owner = hasGovernedAction ? (text(snapshot.people.find((row) => text(row, "actor id") === ownerActorId) ?? {}, "display name") || ownerActorId || "Unassigned") : "Unassigned"
  return Object.freeze({
    hasData: hasGovernedAction,
    openSignals,
    baselineRecovered,
    targetRecovered,
    recoveryGap: Math.max(0, targetRecovered - baselineRecovered),
    owner,
    ownerActorId,
    state: hasGovernedAction ? text(command, "state") || "Detected" : "Detected",
    dueAt: hasGovernedAction ? text(command, "due at") : "",
  })
}

/** Read-only recovery queue for Member Engagement > Members needing action.
 * Member_NPS_Feedback owns the protected signal; Action_Log owns execution;
 * Evidence_Log owns independent verification; People_Roster owns display names.
 */
export function buildLiveMemberEngagementActions(snapshot: LiveSelfDriveSnapshot): readonly LiveMemberEngagementAction[] {
  const actionById = new Map(snapshot.actions.map((row) => [text(row, "action id"), row]))
  const evidenceByAction = new Map<string, SheetRow[]>()
  snapshot.evidence.forEach((row) => {
    const linkedId = text(row, "linked id")
    if (!linkedId) return
    evidenceByAction.set(linkedId, [...(evidenceByAction.get(linkedId) ?? []), row])
  })

  return Object.freeze(snapshot.memberNpsFeedback.flatMap((feedback) => {
    const actionId = text(feedback, "action id")
    const action = actionById.get(actionId)
    if (!action) return []
    const rawState = text(action, "state").toLowerCase()
    const evidence = evidenceByAction.get(actionId) ?? []
    const verifiedEvidence = evidence.find((row) => ["verified", "approved", "accepted"].includes(text(row, "verification status").toLowerCase()))
    const rejectedEvidence = evidence.find((row) => ["reopened", "rejected", "failed"].includes(text(row, "verification status").toLowerCase()))
    const pendingEvidence = evidence.find((row) => !["verified", "approved", "accepted", "reopened", "rejected", "failed"].includes(text(row, "verification status").toLowerCase()))
    const state: LiveMemberEngagementAction["state"] = verifiedEvidence || ["verified", "closed", "resolved", "complete", "completed"].includes(rawState)
      ? "Verified recovered"
      : rejectedEvidence || rawState === "reopened"
        ? "Reopened"
        : pendingEvidence || ["proof submitted", "evidence pending", "awaiting verification"].includes(rawState)
          ? "Awaiting verification"
          : "Open"
    if (state === "Verified recovered") return []

    const ownerActorId = text(action, "owner actor id")
    const owner = snapshot.people.find((row) => text(row, "actor id") === ownerActorId)
    const requiredEvidence = text(action, "required evidence") || "Independent recovery evidence"
    const progress = state === "Reopened"
      ? text(action, "reopen reason") || text(rejectedEvidence ?? {}, "rejected reason") || "Recovery evidence was rejected and reopened"
      : state === "Awaiting verification"
        ? `${requiredEvidence} pending independent verification`
        : text(feedback, "summary") || "Member recovery action remains open"
    const verifiedResult = text(action, "verification result")
      || (state === "Reopened" ? "Reopened" : state === "Awaiting verification" ? "Awaiting evidence" : "Not yet verified")

    return [Object.freeze({
      actionId,
      memberLabel: `Protected Member · ${text(feedback, "member token") || text(feedback, "id")}`,
      category: text(feedback, "category") || text(feedback, "pillar") || "Member recovery",
      issue: text(feedback, "summary") || "Member-impacting signal",
      owner: text(owner ?? {}, "display name") || ownerActorId || "Unassigned",
      dueAt: text(action, "due at"),
      action: text(action, "operating objective") || "Recover the Member outcome",
      state,
      progress,
      verifiedResult,
    })]
  }))
}

/** Read-only recurring-issue escalation view for Member Engagement.
 * Incident_Log owns the issue; Action_Log owns recovery execution;
 * Evidence_Log owns closure; People_Roster owns the display name.
 */
export function buildLiveMemberEngagementRepeatIssues(snapshot: LiveSelfDriveSnapshot): readonly LiveMemberEngagementRepeatIssue[] {
  const actionsByIncident = new Map(snapshot.actions
    .filter((row) => text(row, "incident id"))
    .map((row) => [text(row, "incident id"), row]))
  const peopleById = new Map(snapshot.people.map((row) => [text(row, "actor id"), row]))

  return Object.freeze(snapshot.incidents.flatMap((incident) => {
    const incidentId = text(incident, "incident id")
    const searchable = `${text(incident, "domain")} ${text(incident, "incident type")} ${text(incident, "short description")} ${text(incident, "severity reason")}`.toLowerCase()
    if (!searchable.includes("member engagement") || !/(repeat|recurr)/.test(searchable)) return []

    const action = actionsByIncident.get(incidentId)
    if (!action) return []
    const actionId = text(action, "action id")
    const evidence = snapshot.evidence.filter((row) => [incidentId, actionId].includes(text(row, "linked id")))
    const verified = evidence.some((row) => ["verified", "approved", "accepted"].includes(text(row, "verification status").toLowerCase()))
    const rawIncidentState = text(incident, "state").toLowerCase()
    const rawActionState = text(action, "state").toLowerCase()
    if (verified || ["closed", "resolved", "complete", "completed"].includes(rawIncidentState) || ["closed", "resolved", "complete", "completed", "verified"].includes(rawActionState)) return []

    const rejected = evidence.some((row) => ["reopened", "rejected", "failed"].includes(text(row, "verification status").toLowerCase()))
    const pending = evidence.some((row) => !["verified", "approved", "accepted", "reopened", "rejected", "failed"].includes(text(row, "verification status").toLowerCase()))
    const ownerActorId = text(action, "owner actor id") || text(incident, "owner actor id")
    const owner = text(peopleById.get(ownerActorId) ?? {}, "display name") || ownerActorId || "Unassigned"
    const state = rejected || rawActionState === "reopened"
      ? "Reopened"
      : pending || /(proof submitted|evidence pending|awaiting verification)/.test(rawActionState)
        ? "Awaiting verification"
        : text(action, "state") || text(incident, "state") || "Open"
    const actionText = text(action, "operating objective") || "Recover the recurring Member issue"
    const requiredEvidence = text(action, "required evidence") || "Independent recovery evidence"
    const whyItMatters = text(incident, "severity reason") || text(incident, "short description") || "A recurring Member issue remains unresolved"

    return [Object.freeze({
      incidentId,
      title: text(incident, "short description") || text(incident, "incident type") || "Recurring Member issue",
      severity: text(incident, "severity") || "Attention",
      owner,
      dueAt: text(action, "due at") || text(incident, "due at"),
      state,
      action: actionText,
      whyItMatters,
      alreadyDid: `Recorded ${incidentId} and routed ${actionId} to ${owner}.`,
      whatHappensNext: requiredEvidence,
    })]
  }))
}

/** Read-only evidence record for the Member Engagement background disclosure. */
export function buildLiveMemberEngagementBackground(snapshot: LiveSelfDriveSnapshot): LiveMemberEngagementBackground {
  const timestamp = (row: SheetRow, ...fields: string[]) => fields
    .map((field) => text(row, field))
    .find((value) => Number.isFinite(Date.parse(value))) ?? ""
  const metric = (key: string) => snapshot.memberNpsDashboard.find((row) => text(row, "key") === key)
  const metricText = (key: string, field: "value text" | "label" = "value text") => text(metric(key) ?? {}, field)
  const metricNumber = (key: string) => metric(key) ? number(metric(key)!, "value number") : null
  const responseScores = snapshot.memberNpsResponses.map((row) => number(row, "score")).filter((score) => score >= 0 && score <= 10)
  const calculatedSurvey = responseScores.length
    ? Math.round((responseScores.filter((score) => score >= 9).length - responseScores.filter((score) => score <= 6).length) / responseScores.length * 100)
    : null
  const surveyScore = metricNumber("member_engagement_survey_nps_score") ?? calculatedSurvey
  const surveyResponses = metricNumber("member_engagement_survey_nps_responses") ?? responseScores.length
  const behaviouralScore = metricNumber("member_engagement_behavioural_nps_score")
  const behaviouralRecords = metricNumber("member_engagement_behavioural_nps_records")
  const behaviouralWeeks = metricNumber("member_engagement_behavioural_nps_weeks")
  const gap = surveyScore === null || behaviouralScore === null ? null : Math.abs(surveyScore - behaviouralScore)

  const exitMovements = Object.freeze(snapshot.memberNpsDashboard
    .filter((row) => text(row, "key").startsWith("member_engagement_exit_reason_"))
    .map((row) => Object.freeze({
      reason: text(row, "label") || text(row, "key").replace("member_engagement_exit_reason_", "").replaceAll("_", " "),
      current: String(number(row, "value number")),
      baseline: text(row, "value text") || "Not recorded",
    })))

  const engagementIncidents = snapshot.incidents.filter((row) => `${text(row, "domain")} ${text(row, "incident type")}`.toLowerCase().includes("member engagement"))
  const incidentIds = new Set(engagementIncidents.map((row) => text(row, "incident id")).filter(Boolean))
  const feedbackActionIds = new Set(snapshot.memberNpsFeedback.map((row) => text(row, "action id")).filter(Boolean))
  const engagementActions = snapshot.actions.filter((row) => incidentIds.has(text(row, "incident id")) || feedbackActionIds.has(text(row, "action id")) || `${text(row, "action id")} ${text(row, "operating objective")}`.toLowerCase().includes("member engagement"))
  const actionIds = new Set(engagementActions.map((row) => text(row, "action id")).filter(Boolean))
  const engagementEvidence = snapshot.evidence.filter((row) => actionIds.has(text(row, "linked id")) || incidentIds.has(text(row, "linked id")))
  const engagementApprovals = snapshot.approvals.filter((row) => actionIds.has(text(row, "linked action id")) || `${text(row, "title")} ${text(row, "decision note")}`.toLowerCase().includes("member engagement"))
  const learningRow = snapshot.learningHistory.find((row) => text(row, "domain").toLowerCase() === "member engagement") ?? {}
  const verifiedEvidence = engagementEvidence.filter((row) => ["verified", "approved", "accepted"].includes(text(row, "verification status").toLowerCase())).length
  const verificationRate = engagementEvidence.length ? Math.round(verifiedEvidence / engagementEvidence.length * 100) : 0
  const auditEvents = Object.freeze([
    ...engagementIncidents.map((row) => ({ id: text(row, "incident id"), type: "Incident", status: text(row, "state") || "Open", detail: text(row, "short description") || text(row, "incident type"), at: timestamp(row, "reported at", "event at", "updated at") })),
    ...engagementActions.map((row) => ({ id: text(row, "action id"), type: "Action", status: text(row, "state") || "Open", detail: text(row, "operating objective"), at: timestamp(row, "updated at", "proof submitted at", "reopened at", "in progress at", "assigned at", "proposed at") })),
    ...engagementEvidence.map((row) => ({ id: text(row, "evidence id"), type: "Evidence", status: text(row, "verification status") || "Pending", detail: text(row, "evidence type") || text(row, "notes"), at: timestamp(row, "uploaded at", "verified at", "updated at") })),
    ...engagementApprovals.map((row) => ({ id: text(row, "approval id"), type: "Approval", status: text(row, "decision") || "Pending", detail: text(row, "title") || text(row, "approval type") || text(row, "decision note") || "Governed Member Engagement decision", at: timestamp(row, "decided at", "requested at", "updated at") })),
  ].filter((entry) => entry.id).sort((left, right) => (Date.parse(right.at) || 0) - (Date.parse(left.at) || 0)).map((entry) => Object.freeze(entry)))
  const relevantPolicies = snapshot.policies.filter((row) => {
    const descriptor = `${text(row, "policy id")} ${text(row, "policy name") || text(row, "name")} ${text(row, "domain")}`.toLowerCase()
    return descriptor.includes("member engagement") || /retention|churn/.test(descriptor)
  })
  const sourceNames = Object.freeze([
    snapshot.memberNpsFeedback.length ? "Member_NPS_Feedback" : "",
    snapshot.memberNpsResponses.length ? "Member_NPS_Responses" : "",
    snapshot.memberNpsDashboard.length ? "Member_NPS_Dashboard" : "",
    engagementIncidents.length ? "Incident_Log" : "",
    engagementActions.length ? "Action_Log" : "",
    engagementEvidence.length ? "Evidence_Log" : "",
    engagementApprovals.length ? "Approval_Log" : "",
    relevantPolicies.length ? "Policy_Registry" : "",
    Object.keys(learningRow).length ? "Learning_History" : "",
    snapshot.people.length ? "People_Roster" : "",
  ].filter(Boolean))

  return Object.freeze({
    eventCount: auditEvents.length,
    source: Object.freeze({
      connected: sourceNames.length > 0,
      count: sourceNames.length,
      names: sourceNames.join(" · "),
      asOf: snapshot.asOf,
      confidence: text(learningRow, "confidence") || "Not recorded",
      adoption: text(learningRow, "disposition") || "Governed human review",
    }),
    nps: Object.freeze({
      survey: Object.freeze({ score: surveyScore === null ? "Not recorded" : String(surveyScore), method: metricText("member_engagement_survey_nps_method") || "Calculated from recorded survey responses", inputs: surveyResponses ? `${surveyResponses} recorded responses` : "No recorded responses" }),
      behavioural: Object.freeze({ score: behaviouralScore === null ? "Not recorded" : String(behaviouralScore), method: metricText("member_engagement_behavioural_nps_method") || "No behavioural method recorded", inputs: behaviouralRecords === null ? "No behavioural record count" : `${behaviouralRecords} protected Member records${behaviouralWeeks ? ` · ${behaviouralWeeks}-week observation window` : ""}` }),
      gap: gap === null ? "Not recorded" : `${gap} points`,
    }),
    exitMovements,
    learning: Object.freeze({
      proposedChange: text(learningRow, "proposed change") || "Not recorded",
      expectedEffect: text(learningRow, "expected effect") || "Not recorded",
      attribution: text(learningRow, "attribution") || "Not recorded",
      evidence: `${engagementEvidence.length} linked evidence records · ${verificationRate}% verified`,
      forecastError: metricText("member_engagement_forecast_error") || "Not separately recorded",
      freshReversible: `${text(learningRow, "disposition") || "Not recorded"} · governed by human sign-off`,
      humanControls: `${engagementApprovals.length} recorded approval${engagementApprovals.length === 1 ? "" : "s"}`,
      confidenceAdoption: `${text(learningRow, "confidence") || "Not recorded"} · no automatic adoption`,
      effects: text(learningRow, "observed") || text(learningRow, "expected effect") || "Not recorded",
      rollback: text(learningRow, "notes") || "Disposition remains governed in Learning_History",
    }),
    auditEvents,
    boundary: Object.freeze({ summary: `${relevantPolicies.length} governed Member Engagement controls · ${engagementApprovals.length} named approval${engagementApprovals.length === 1 ? "" : "s"} recorded`, detail: "No approval, external message, policy change or production write is performed by this read-only view." }),
  })
}

/** Operational observations for Member Engagement > Headline measures.
 * Policy_Registry supplies controls; Member_NPS_Dashboard supplies observations.
 */
export function buildLiveMemberEngagementHeadlineMeasures(snapshot: LiveSelfDriveSnapshot): LiveMemberEngagementHeadlineMeasures {
  const metric = (key: string) => snapshot.memberNpsDashboard.find((row) => text(row, "key") === key)
  const value = (key: string) => {
    const row = metric(key)
    return row ? number(row, "value number") : null
  }
  const m6 = value("member_engagement_m6_retention_pct")
  const churn = value("member_engagement_monthly_churn_pct")
  const exitVerified = value("member_engagement_exit_reasons_verified")
  const exitClaimed = value("member_engagement_exit_reasons_claimed")
  const recoveryVerified = value("member_engagement_at_risk_recovered")
  const recoveryTotal = value("member_engagement_at_risk_total")
  const interventions = value("member_engagement_interventions")
  const recoveryAwaiting = value("member_engagement_recovery_awaiting")
  const recoveryReopened = value("member_engagement_recovery_reopened")
  const policyValue = (needle: string) => {
    const row = snapshot.policies.find((candidate) => `${text(candidate, "policy id")} ${text(candidate, "policy name") || text(candidate, "name")}`.toLowerCase().includes(needle))
    if (!row) return null
    const raw = number(row, "policy value") || number(row, "value")
    return raw > 0 && raw <= 1 ? raw * 100 : raw || null
  }
  const m6Floor = policyValue("retention-m6-warning")
  const churnControl = policyValue("monthly-churn-reference")
  const asPercent = (n: number | null) => n === null ? "No data" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`
  const measures: MemberEngagementPreview["measures"] = Object.freeze([
    Object.freeze({ id: "m6-retention" as const, label: "M6 retention", value: asPercent(m6), target: m6Floor === null ? "No governed floor" : `${m6Floor}% floor`, detail: m6 === null ? "Awaiting a recorded M6 cohort observation" : m6Floor === null ? "Awaiting a governed M6 retention floor" : `${m6 >= m6Floor ? "At or above" : `${(m6Floor - m6).toFixed(1)} pp below`} the governed floor` }),
    Object.freeze({ id: "monthly-churn" as const, label: "Monthly churn", value: asPercent(churn), target: churnControl === null ? "No governed control" : `${churnControl}% control`, detail: churn === null ? "Awaiting a recorded monthly churn observation" : churnControl === null ? "Awaiting a governed monthly churn control" : `${Math.abs(churn - churnControl).toFixed(1)} pp ${churn <= churnControl ? "within" : "above"} control` }),
    Object.freeze({ id: "exit-reasons" as const, label: "Verified exit reasons", value: exitVerified === null || exitClaimed === null ? "No data" : `${exitVerified}/${exitClaimed}`, target: exitClaimed === null || exitVerified === null ? "Awaiting exit-reason evidence" : `${Math.max(0, exitClaimed - exitVerified)} awaiting`, detail: "Independent evidence only" }),
    Object.freeze({ id: "at-risk-recovery" as const, label: "At-risk recovery", value: recoveryVerified === null || recoveryTotal === null ? "No data" : `${recoveryVerified}/${recoveryTotal}`, target: interventions === null ? "No intervention count" : `${interventions} interventions`, detail: recoveryAwaiting === null ? "Awaiting recovery evidence" : `${recoveryAwaiting} awaiting independent verification` }),
  ])
  const hasData = [m6, churn, exitVerified, exitClaimed, recoveryVerified, recoveryTotal].some((entry) => entry !== null)
  const implication = m6 === null || churn === null || m6Floor === null || churnControl === null
    ? "So what: retention and churn remain unconfirmed until the observations and governed controls are recorded in the Sheet."
    : `So what: M6 retention is ${asPercent(m6)} against the ${m6Floor}% floor, while monthly churn is ${asPercent(churn)} against the ${churnControl}% control.`
  const unverifiedExitReasons = exitClaimed === null || exitVerified === null ? null : Math.max(0, exitClaimed - exitVerified)
  const retentionImplicationSummary = unverifiedExitReasons === null
    ? "Exit-reason verification is not recorded."
    : unverifiedExitReasons === 0
      ? "All recorded exit reasons are independently verified."
      : `${unverifiedExitReasons} exit reason${unverifiedExitReasons === 1 ? " awaits" : "s await"} independent verification.`
  const retentionCurves: MemberEngagementPreview["retentionCurves"] = Object.freeze(snapshot.memberNpsDashboard
    .filter((row) => text(row, "key").startsWith("member_engagement_retention_"))
    .map((row) => Object.freeze({
      cohort: text(row, "label") || text(row, "key").replace("member_engagement_retention_", ""),
      values: Object.freeze(text(row, "value text").split(",").map((entry) => {
        const parsed = Number(entry.trim())
        return Number.isFinite(parsed) ? parsed : null
      })),
      memberCount: number(row, "value number"),
    }))
    .filter((curve) => curve.values.length === 7))
  const belowFloor = m6Floor === null ? [] : retentionCurves.filter((curve) => (curve.values[6] ?? 0) < m6Floor)
  const cohortSummary = retentionCurves.length === 0
    ? "No M0-M6 cohort series is recorded."
    : m6Floor === null
      ? "No governed M6 retention floor is recorded."
    : belowFloor.length === 0
      ? `All ${retentionCurves.length} recorded M6 cohorts are at or above the ${m6Floor}% floor.`
      : `${belowFloor.length} recorded M6 cohort${belowFloor.length === 1 ? " is" : "s are"} below the ${m6Floor}% floor.`
  const closureRule = text(metric("member_engagement_closure_rule") ?? {}, "value text") || "No closure rule is recorded."
  const recovery = Object.freeze({
    verified: recoveryVerified ?? 0,
    total: recoveryTotal ?? 0,
    interventions: interventions ?? 0,
    awaiting: recoveryAwaiting ?? 0,
    reopened: recoveryReopened ?? 0,
    closureRule,
  })
  return Object.freeze({ hasData, measures, retentionImplicationSummary, implication, cohortSummary, retentionCurves, retentionFloor: m6Floor, recovery })
}

/** Sheet-backed health state for Member Engagement > Loop health. */
export function buildLiveMemberEngagementLoopHealth(snapshot: LiveSelfDriveSnapshot): LoopHealth {
  const freshness = buildLiveMemberEngagementFreshness(snapshot)
  const engagementActions = snapshot.actions.filter((row) => {
    const actionId = text(row, "action id").toLowerCase()
    const objective = text(row, "operating objective").toLowerCase()
    return actionId.includes("eng") || objective.includes("member engagement") || objective.includes("retention")
  })
  const actionById = new Map(engagementActions.map((row) => [text(row, "action id"), row]))
  const verifiedEvidenceIds = new Set(snapshot.evidence
    .filter((row) => text(row, "verification status").toLowerCase() === "verified")
    .map((row) => text(row, "linked id"))
    .filter(Boolean))
  const feedbackStatus = snapshot.memberNpsFeedback.map((row) => {
    const actionId = text(row, "action id")
    const responseId = text(row, "nps response id")
    const actionState = text(actionById.get(actionId) ?? {}, "state").toLowerCase()
    return {
      verified: verifiedEvidenceIds.has(actionId) || verifiedEvidenceIds.has(responseId),
      reopened: actionState === "reopened",
      capturedAt: text(row, "captured at"),
    }
  })
  const verified = feedbackStatus.filter((row) => row.verified).length
  const reopened = feedbackStatus.filter((row) => !row.verified && row.reopened).length
  const awaitingRows = feedbackStatus.filter((row) => !row.verified && !row.reopened)
  const oldestAwaitingAt = awaitingRows.map((row) => row.capturedAt)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null

  return buildLoopHealth({
    asOf: snapshot.asOf,
    feeds: freshness.feeds.map((feed) => Object.freeze({
      feedId: feed.feedId,
      label: feed.label,
      lastUpdatedAt: feed.lastUpdatedAt,
      cadenceMinutes: feed.cadenceMinutes,
      critical: feed.critical,
      affectedClaims: feed.affectedClaims,
    })),
    clocks: engagementActions.filter((row) => Number.isFinite(Date.parse(text(row, "due at")))).map((row) => {
      const state = text(row, "state").toLowerCase()
      return Object.freeze({
        clockId: `LIVE-MEMBER-ENGAGEMENT-${text(row, "action id")}`,
        label: text(row, "operating objective") || "Member recovery",
        ownerRole: text(row, "owner actor id") || "Unassigned",
        dueAt: text(row, "due at"),
        state: state === "verified" || state === "closed" ? "Recovered" as const : "Running" as const,
      })
    }),
    verification: Object.freeze({
      claimed: feedbackStatus.length,
      verified,
      awaiting: awaitingRows.length,
      reopened,
      oldestAwaitingAt,
    }),
    quarantinedRecords: freshness.quarantinedRecords,
  })
}

export function buildLiveNiaGrowthProjection(snapshot: LiveSelfDriveSnapshot): LiveNiaGrowthProjection {
  const channel = (row: SheetRow) => {
    const ids = `${text(row, "demand id")} ${text(row, "source submission id")}`.toLowerCase()
    if (ids.includes("ops-rpt-fono") || text(row, "role required").toLowerCase() === "living supply") return "FONO"
    if (ids.includes("sp-bot")) return "SP"
    return ""
  }
  const governedLiving = snapshot.enterpriseDemand.filter((row) => channel(row)
    && text(row, "demand id")
    && ["updated at", "opened at", "activation required at"].some((key) => Number.isFinite(Date.parse(text(row, key)))))
  const contractedNests = governedLiving.reduce((sum, row) => sum + number(row, "headcount required"), 0)
  const activationReadyNests = governedLiving.reduce((sum, row) => sum + number(row, "headcount matched"), 0)
  const gapNests = Math.max(0, contractedNests - activationReadyNests)
  const ownerActorId = governedLiving.map((row) => text(row, "owner actor id")).find(Boolean) || ""
  const owner = String(snapshot.people.find((row) => text(row, "actor id") === ownerActorId)?.["display name"] || ownerActorId || "Unassigned").trim()
  const progress = contractedNests > 0 ? `${Math.round(activationReadyNests / contractedNests * 100)}%` : "No data"
  const summary = Object.freeze({
    target: `${contractedNests} required Nests`,
    current: `${activationReadyNests} matched Nests`,
    gap: `${gapNests} Nests`,
    owner,
    progress,
    verifiedResult: `${activationReadyNests} matched Nests from FONO and Shram Park demand`,
  })
  const fonoRows = governedLiving.filter((row) => channel(row) === "FONO")
  const spRows = governedLiving.filter((row) => channel(row) === "SP")
  const fonoReady = fonoRows.reduce((sum, row) => sum + number(row, "headcount matched"), 0)
  const spReady = spRows.reduce((sum, row) => sum + number(row, "headcount matched"), 0)
  const fonoContracted = fonoRows.reduce((sum, row) => sum + number(row, "headcount required"), 0)
  const spContracted = spRows.reduce((sum, row) => sum + number(row, "headcount required"), 0)
  const readinessSlaPolicy = snapshot.policies.find((row) => {
    const descriptor = `${text(row, "policy id")} ${text(row, "policy name")} ${text(row, "name")} ${text(row, "source note")}`.toLowerCase()
    return /growth|capacity|readiness/.test(descriptor) && /sla|time/.test(descriptor) && text(row, "status").toLowerCase() === "approved"
  })
  const readinessSlaValue = text(readinessSlaPolicy ?? {}, "policy value") || text(readinessSlaPolicy ?? {}, "value")
  const readinessSlaUnit = text(readinessSlaPolicy ?? {}, "unit")
  const measures: NiaGrowthPreview["measures"] = Object.freeze([
    Object.freeze({ id: "ready-capacity", label: "Matched pipeline capacity", value: `${activationReadyNests} matched Nests · FONO ${fonoReady} · SP ${spReady}`, target: `Required: ${fonoContracted} · ${spContracted}`, detail: "Current FONO Funnel and Shram Park demand records" }),
    Object.freeze({ id: "time-to-ready", label: "Opportunity gap", value: `${gapNests} Nest gap`, target: readinessSlaValue ? `Approved SLA ${readinessSlaValue}${readinessSlaUnit ? ` ${readinessSlaUnit}` : ""}` : "Approved readiness SLA not recorded", detail: "Required minus matched demand capacity" }),
    Object.freeze({ id: "fono-health", label: "FONO conversion health", value: `FONO ${fonoReady} matched · ${fonoContracted} required`, target: "Kept separate", detail: "FONO Funnel only; Studio occupancy is not inferred" }),
    Object.freeze({ id: "sp-exposure", label: "SP pipeline coverage", value: spRows.length ? `SP ${spReady} matched · ${spContracted} required` : "No current governed SP data", target: "Shram Park demand ledger", detail: "Shram Park remains separate from existing Studio occupancy" }),
  ])
  return Object.freeze({ summary, measures })
}

export function buildLiveSelfDriveSnapshot(ops: any): LiveSelfDriveSnapshot {
  const rows = (name: string): SheetRow[] => Array.isArray(ops?.[name]) ? ops[name] : []
  const enterpriseDemand = rows("enterpriseDemand")
  const activations = rows("memberActivation")
  const incidents = rows("incidentLog")
  const actions = rows("actionLog")
  const evidence = rows("evidenceLog")
  const approvals = rows("approvalLog")
  const people = rows("people")
  const theatres = rows("theatres")
  const studios = rows("studios")
  const living = rows("living")
  const work = rows("work")
  const essentials = rows("essentials")
  const finance = rows("finance")
  const channels = rows("cashControlChannels")
  const learningHistory = rows("learningHistory")
  const dashboardContent = ops?.dashboardContent && typeof ops.dashboardContent.values === "function"
    ? Array.from(ops.dashboardContent.values()) as SheetRow[]
    : rows("dashboardContent")
  const policies = rows("policyRegistry")
  const memberNpsDashboard = rows("memberNpsDashboard")
  const memberNpsFeedback = rows("memberNpsFeedback")
  const memberNpsResponses = rows("memberNpsResponses")

  return {
    asOf: ops?.fetchedAt || ops?.meta?.updatedAt || new Date().toISOString(),
    monthlyCMTarget: Number(ops?.monthlyCMTarget) || 0,
    enterpriseDemand, activations, incidents, actions, evidence, approvals, people, theatres, studios, living, work, essentials, finance, financeSource: finance, channels, learningHistory, dashboardContent,
    policies, memberNpsDashboard, memberNpsFeedback, memberNpsResponses,
    summary: {
      openDemand: enterpriseDemand.filter((row) => text(row, "status").toLowerCase() !== "closed").length,
      remainingHeadcount: enterpriseDemand.reduce((sum, row) => sum + number(row, "headcount remaining"), 0),
      verifiedActivations: activations.filter((row) => text(row, "verification status").toLowerCase() === "verified").length,
      openIncidents: incidents.filter((row) => !["closed", "resolved"].includes(text(row, "state").toLowerCase())).length,
      openActions: actions.filter((row) => !["closed", "verified"].includes(text(row, "state").toLowerCase())).length,
      readyNests: living.reduce((sum, row) => sum + number(row, "activation ready nests"), 0),
      occupiedNests: living.reduce((sum, row) => sum + number(row, "occupied nests"), 0),
      cm2Inr: finance.reduce((sum, row) => sum + number(row, "cm2 inr"), 0),
    },
  }
}

const actorKeys = ["owner actor id", "reported by actor id", "next action owner actor id", "approver actor id", "uploaded by actor id", "verified by"] as const

export function filterLiveSelfDriveSnapshot(snapshot: LiveSelfDriveSnapshot, filters: LiveSelfDriveFilters): LiveSelfDriveSnapshot {
  if (!filters.theatre && !filters.location && !filters.studio && !filters.person) return snapshot
  const dimensionalFilter = Boolean(filters.theatre || filters.location || filters.studio)

  const isActive = (row: SheetRow) => !text(row, "active") || ["true", "yes", "1", "active"].includes(text(row, "active").toLowerCase())
  const matchingStudios = snapshot.studios
    .filter(isActive)
    .filter((row) => !filters.theatre || text(row, "theatre id") === filters.theatre)
    .filter((row) => !filters.location || text(row, "address") === filters.location)
    .filter((row) => !filters.studio || text(row, "studio id") === filters.studio)
  const theatreIds = new Set(matchingStudios.map((row) => text(row, "theatre id")))
  if (!filters.location && !filters.studio) {
    for (const row of snapshot.theatres.filter(isActive).filter((row) => !filters.theatre || text(row, "theatre id") === filters.theatre)) theatreIds.add(text(row, "theatre id"))
  }
  const studioIds = new Set(matchingStudios.map((row) => text(row, "studio id")))
  const normalized = (value: string) => value.trim().toLowerCase()
  const nameVariants = (value: string) => {
    const raw = normalized(value)
    const withoutRegion = raw.replace(/\s*\([^)]*\)\s*$/, "").trim()
    return raw && withoutRegion !== raw ? [raw, withoutRegion] : raw ? [raw] : []
  }
  const theatreNames = new Set<string>()
  const studioNames = new Set<string>()
  for (const row of matchingStudios) {
    for (const field of ["studio id", "studio name", "name"]) {
      for (const value of nameVariants(text(row, field))) studioNames.add(value)
    }
    const theatreId = text(row, "theatre id")
    const theatre = snapshot.theatres.find((candidate) => text(candidate, "theatre id") === theatreId)
    for (const field of ["theatre id", "theatre name", "name"]) {
      for (const value of nameVariants(text(theatre ?? {}, field) || (field === "theatre id" ? theatreId : ""))) theatreNames.add(value)
    }
  }
  const peopleIds = new Set(snapshot.people
    .filter((row) => !filters.person || text(row, "actor id") === filters.person)
    .filter((row) => !dimensionalFilter || !text(row, "theatre id") || theatreIds.has(text(row, "theatre id")))
    .filter((row) => !filters.studio || !text(row, "studio id") || studioIds.has(text(row, "studio id")))
    .map((row) => text(row, "actor id")))

  const rowMatches = (row: SheetRow) => {
    const theatreId = text(row, "theatre id")
    const studioId = text(row, "studio id")
    const theatreName = text(row, "theatre") || text(row, "theatre name")
    const studioName = text(row, "studio") || text(row, "studio name")
    const theatreNameMatches = !theatreName || nameVariants(theatreName).some((value) => theatreNames.has(value))
    const studioNameMatches = !studioName || nameVariants(studioName).some((value) => studioNames.has(value))
    if (dimensionalFilter && theatreId && !theatreIds.has(theatreId)) return false
    if (dimensionalFilter && theatreName && !theatreNameMatches) return false
    const actors = actorKeys.map((key) => text(row, key)).filter(Boolean)
    if (filters.location || filters.studio) {
      if (studioId && !studioIds.has(studioId)) return false
      if (filters.studio && studioName && !studioNameMatches) return false
      const matchedByName = filters.studio ? Boolean(studioName && studioNameMatches) : Boolean(theatreName && theatreNameMatches)
      if (!studioId && !matchedByName && !actors.some((id) => peopleIds.has(id))) return false
    }
    if (filters.person && actors.length > 0 && !actors.some((id) => peopleIds.has(id))) return false
    if (dimensionalFilter && !theatreId && !studioId && actors.length > 0 && !actors.some((id) => peopleIds.has(id))) return false
    return true
  }

  const actions = snapshot.actions.filter(rowMatches)
  const actionIds = new Set(actions.map((row) => text(row, "action id")).filter(Boolean))
  const approvals = snapshot.approvals.filter((row) => !text(row, "linked action id") || actionIds.has(text(row, "linked action id"))).filter(rowMatches)
  const evidence = snapshot.evidence.filter((row) => !text(row, "linked id") || actionIds.has(text(row, "linked id"))).filter(rowMatches)
  const enterpriseDemand = snapshot.enterpriseDemand.filter(rowMatches)
  const activations = snapshot.activations.filter(rowMatches)
  const incidents = snapshot.incidents.filter(rowMatches)
  const living = snapshot.living.filter(rowMatches)
  const work = snapshot.work.filter(rowMatches)
  const essentials = snapshot.essentials.filter(rowMatches)
  const finance = snapshot.finance.filter(rowMatches)
  const memberNpsDashboard = snapshot.memberNpsDashboard.filter(rowMatches)
  const memberNpsFeedback = snapshot.memberNpsFeedback.filter(rowMatches)
  const memberNpsResponses = snapshot.memberNpsResponses.filter(rowMatches)
  const learningHistory = snapshot.learningHistory.filter(rowMatches)
  const people = snapshot.people.filter((row) => peopleIds.has(text(row, "actor id")))
  const theatres = snapshot.theatres.filter((row) => !dimensionalFilter || theatreIds.has(text(row, "theatre id")))
  const studios = snapshot.studios.filter((row) => !dimensionalFilter || studioIds.has(text(row, "studio id")))

  return Object.freeze({
    ...snapshot, enterpriseDemand, activations, incidents, actions, evidence, approvals, people, theatres, studios, living, work, essentials, finance,
    memberNpsDashboard, memberNpsFeedback, memberNpsResponses, learningHistory,
    summary: Object.freeze({
      openDemand: enterpriseDemand.filter((row) => text(row, "status").toLowerCase() !== "closed").length,
      remainingHeadcount: enterpriseDemand.reduce((sum, row) => sum + number(row, "headcount remaining"), 0),
      verifiedActivations: activations.filter((row) => text(row, "verification status").toLowerCase() === "verified").length,
      openIncidents: incidents.filter((row) => !["closed", "resolved"].includes(text(row, "state").toLowerCase())).length,
      openActions: actions.filter((row) => !["closed", "verified"].includes(text(row, "state").toLowerCase())).length,
      readyNests: living.reduce((sum, row) => sum + number(row, "activation ready nests"), 0),
      occupiedNests: living.reduce((sum, row) => sum + number(row, "occupied nests"), 0),
      cm2Inr: finance.reduce((sum, row) => sum + number(row, "cm2 inr"), 0),
    }),
  })
}

export function buildLiveMarginInputs(snapshot: LiveSelfDriveSnapshot): readonly MarginStudioInput[] {
  return snapshot.living.flatMap((row) => {
    const studioId = text(row, "studio id")
    const sourceRowIdentity = text(row, "living hourly id") || studioId
    const contractedNests = number(row, "contracted nests")
    const occupied = number(row, "occupied nests")

    // Margin diagnostics require a governed, internally consistent capacity
    // record. Do not invent or clamp capacity when a live Sheet row is
    // incomplete; exclude it until the source data is corrected.
    if (!studioId || !sourceRowIdentity || contractedNests <= 0 || occupied < 0 || occupied > contractedNests) return []

    const finance = snapshot.finance.find((entry) => text(entry, "theatre id") === text(row, "theatre id")) || {}
    const billedLiving = number(row, "living billed inr")
    const workBilled = number(snapshot.work.find((entry) => text(entry, "theatre id") === text(row, "theatre id")) || {}, "work billed inr")
    const essentialsBilled = number(snapshot.essentials.find((entry) => text(entry, "studio id") === text(row, "studio id")) || {}, "essentials billed inr")
    return [{
      studioId, studioName: studioId, theatreId: text(row, "theatre id"),
      supplyModel: text(row, "supply model") === "SP" ? "SP" : "FONO",
      contractedNests, occupiedNests: occupied, rampDay: 30,
      billedLivingArpuInr: occupied ? billedLiving / occupied : 0,
      livingPartnerCostInr: 0, livingUtilitiesInr: 0,
      billedWorkArpuInr: occupied ? workBilled / occupied : 0, workDirectDeliveryCostInr: 0,
      billedEssentialsArpuInr: occupied ? essentialsBilled / occupied : 0, essentialsDirectDeliveryCostInr: 0,
      studioGrossMarginPct: 0, previousVerifiedFullUseCm2Inr: number(finance, "cm2 inr"),
      ownerActorId: text(row, "next action owner actor id") || "Operations", sourceUpdatedAt: snapshot.asOf,
      sourceRowIdentity, synthetic: false,
    }]
  })
}
