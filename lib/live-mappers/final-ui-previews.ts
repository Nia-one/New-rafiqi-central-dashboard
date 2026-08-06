import type { MemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import type { MemberSavingsPreview, ServiceGateProjection } from "@/lib/operating-loop/member-savings-loop"
import type { NewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import type { NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import type { CashControlPreview } from "@/lib/operating-loop/cash-control-loop"
import type { FinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"
import type { ControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import { categoriseNps, type MemberFeedbackItem, type NpsResponse } from "@/lib/member-feedback"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"
import {
  buildLiveMemberEngagementActions,
  buildLiveMemberEngagementBackground,
  buildLiveMemberEngagementCommand,
  buildLiveMemberEngagementHeadlineMeasures,
  buildLiveMemberEngagementLoopHealth,
  buildLiveMemberSavingsFreshness,
  buildLiveMemberSavingsHealth,
  buildLiveMemberSavingsTasks,
  buildLiveNewAddsFillStatus,
  buildLiveNewAddsFillTasks,
  buildLiveNewAddsProof,
  buildLiveNewAddsTheatreProgress,
  buildLiveNiaGrowthProjection,
  type LiveSelfDriveSnapshot,
} from "@/lib/live-mappers/self-drive"

type Row = Record<string, unknown>

function raw(row: Row, key: string) {
  const direct = row[key]
  if (direct !== undefined && direct !== null) return direct
  const normalized = key.trim().toLowerCase().replaceAll("_", " ")
  const match = Object.keys(row).find((candidate) => candidate.trim().toLowerCase().replaceAll("_", " ") === normalized)
  return match ? row[match] : undefined
}

function text(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = raw(row, key)
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function number(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = raw(row, key)
    if (typeof value === "number" && Number.isFinite(value)) return value
    const parsed = Number(String(value ?? "").replace(/[₹,%\s,]/g, ""))
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const liveBoundary = Object.freeze({
  externalMessaging: false,
  productionWrites: false,
  moneyMovement: false,
  policyAutoChange: false,
})

export function buildLiveNewAddsPreview(snapshot: LiveSelfDriveSnapshot): NewAddsPreview | null {
  const status = buildLiveNewAddsFillStatus(snapshot)
  const proof = buildLiveNewAddsProof(snapshot)
  const actions = buildLiveNewAddsFillTasks(snapshot)
  return Object.freeze({
    mode: "Live read-only",
    fixtureLabel: "Governed live data",
    question: "Where must verified billing-live Members be added next?",
    headline: status.hasData ? `${status.gap} contracted FONO Nests currently require verified member adds.` : "No governed contracted/onboarded FONO rows are currently available.",
    source: { name: "FONO Funnel · Member Activation · Action Log", asOf: snapshot.asOf, lastRefreshAt: snapshot.asOf, freshness: proof.loopHealth.state, synthetic: false },
    taskSummary: { target: status.target, current: status.verified, gap: status.gap, owner: status.owner, progressPercent: status.progressPercent, verifiedResult: `${status.verified}/${status.target} billing-live` },
    measures: proof.measures,
    theatres: buildLiveNewAddsTheatreProgress(snapshot),
    actions,
    escalations: [],
    despatchEscalations: [],
    quarantineCount: proof.loopHealth.quarantinedRecords,
    policyRegistry: [],
    blockedCapabilities: liveBoundary,
    loopHealthInputs: { feeds: proof.loopHealth.feeds, clocks: proof.loopHealth.clocks, outcomes: [], metricDependencies: [] },
    loopHealth: proof.loopHealth,
    learningProjection: { question: "What verified fill pattern should be reviewed?", accepted: [], rejected: [], proposedCalibration: [], protectedPolicyChanges: [] },
  } as unknown as NewAddsPreview)
}

export function buildLiveMemberEngagementPreview(snapshot: LiveSelfDriveSnapshot): MemberEngagementPreview | null {
  const headline = buildLiveMemberEngagementHeadlineMeasures(snapshot)
  const command = buildLiveMemberEngagementCommand(snapshot)
  if (!snapshot.memberNpsDashboard.length && !snapshot.memberNpsFeedback.length && !snapshot.memberNpsResponses.length && !command.hasData) return null
  const background = buildLiveMemberEngagementBackground(snapshot)
  const hasMeasuredEngagement = headline.hasData || command.hasData
  const tasks = buildLiveMemberEngagementActions(snapshot).map((row) => ({
    actionId: row.actionId,
    memberLabel: row.memberLabel,
    cause: row.category || "Friction up",
    ownerRole: row.owner,
    dueAt: row.dueAt,
    progress: row.progress,
    verifiedResult: row.verifiedResult,
    state: row.state,
    priority: row.state === "Reopened" ? "High" : "Standard",
    recoveryRoute: row.action,
  }))
  const numeric = (value: string) => Number.parseFloat(value) || 0
  return Object.freeze({
    mode: "Live read-only",
    fixtureLabel: "Governed live data",
    question: "Which verified Member friction must be recovered next?",
    source: { name: background.source.names || "Member NPS", asOf: snapshot.asOf, lastRefreshAt: snapshot.asOf, freshness: "Current", synthetic: false },
    headline: command.hasData ? `Recover ${command.recoveryGap} open Member signals before the next checkpoint.` : headline.hasData ? headline.implication : "No valid Member retention observation or recovery target is currently recorded.",
    summary: hasMeasuredEngagement
      ? { target: String(command.targetRecovered), current: String(command.baselineRecovered), gap: String(command.recoveryGap), owner: command.owner, progress: command.state || "Open", verifiedResult: `${command.baselineRecovered} verified recoveries` }
      : { target: "No data", current: "No data", gap: "No data", owner: "Unassigned", progress: "No governed action", verifiedResult: "No verified recovery record" },
    measures: headline.measures,
    retentionCurves: headline.retentionCurves,
    tasks,
    despatchEscalations: [],
    loopHealth: buildLiveMemberEngagementLoopHealth(snapshot),
    exitReasonMovements: background.exitMovements.map((row) => ({ reason: row.reason, current: numeric(row.current), baseline: numeric(row.baseline) })),
    npsDrilldown: { survey: { ...background.nps.survey, score: numeric(background.nps.survey.score) }, behavioural: { ...background.nps.behavioural, score: numeric(background.nps.behavioural.score) }, gap: numeric(background.nps.gap) },
    learningInputs: [],
    quarantinedCount: buildLiveMemberEngagementLoopHealth(snapshot).quarantinedRecords,
    policyRegistry: [],
    blockedCapabilities: liveBoundary,
  } as unknown as MemberEngagementPreview)
}

function liveSavingsServices(snapshot: LiveSelfDriveSnapshot): readonly ServiceGateProjection[] {
  return Object.freeze(snapshot.essentials.flatMap((row, index) => {
    const serviceId = text(row, "service id", "essentials hourly id", "product id")
    const serviceName = text(row, "service name", "product name", "category")
    if (!serviceId && !serviceName) return []
    const saving = number(row, "member savings inr", "verified member savings inr", "savings inr")
    const margin = number(row, "nia margin inr", "margin inr", "cm inr")
    const attach = number(row, "attach pct", "attach percent")
    const repeat = number(row, "repeat pct", "repeat percent")
    return [{
      serviceId: serviceId || `service-${index + 1}`,
      serviceName: serviceName || serviceId,
      studio: text(row, "studio name", "studio id", "theatre id") || "Unassigned",
      memberSavingsInr: saving,
      niaMarginInr: margin,
      status: saving > 0 && margin > 0 ? "Pass" as const : "Exception" as const,
      statusReason: saving <= 0 ? "Verified Member saving is not recorded above zero." : margin <= 0 ? "Verified Nia margin is not recorded above zero." : "Both governed gates pass.",
      attachPct: attach,
      repeatPct: repeat,
      peerBandLabel: text(row, "peer band label") || "Not recorded",
      repeatBaselinePct: number(row, "repeat baseline pct"),
    }]
  }))
}

export function buildLiveMemberSavingsPreview(snapshot: LiveSelfDriveSnapshot): MemberSavingsPreview | null {
  const services = liveSavingsServices(snapshot)
  const tasks = buildLiveMemberSavingsTasks(snapshot)
  if (!services.length && !tasks.length) return null
  const passing = services.filter((row) => row.status === "Pass").length
  const totalSaving = services.reduce((sum, row) => sum + row.memberSavingsInr, 0)
  const totalMargin = services.reduce((sum, row) => sum + row.niaMarginInr, 0)
  const exceptions = services.length - passing
  const freshness = buildLiveMemberSavingsFreshness(snapshot)
  const measures = [
    { id: "verified-savings", label: "Verified Member savings", value: `₹${Math.round(totalSaving).toLocaleString("en-IN")}`, target: "Above ₹0", detail: `${services.length} governed services` },
    { id: "attach-repeat", label: "Attach and repeat", value: services.length ? `${Math.round(services.reduce((sum, row) => sum + row.attachPct, 0) / services.length)}% attach` : "No data", target: "Governed baseline", detail: "Calculated only from recorded service rows" },
    { id: "dual-gate", label: "Dual gate", value: `${passing}/${services.length} pass`, target: "Saving and margin above ₹0", detail: `₹${Math.round(totalMargin).toLocaleString("en-IN")} recorded Nia margin` },
    { id: "exceptions", label: "Exceptions", value: String(exceptions), target: "0", detail: `${tasks.length} governed recovery actions` },
  ]
  return Object.freeze({
    fixtureLabel: "Governed live data",
    mode: "Live read-only",
    question: "Which service must recover Member saving or Nia margin next?",
    source: { name: "Essentials · Action Log · Evidence Log", asOf: snapshot.asOf, lastRefreshAt: snapshot.asOf, freshness: freshness.staleFeedCount ? "Attention" : "Current", synthetic: false },
    headline: `${exceptions} service exceptions require verified recovery.`,
    summary: { target: `${services.length} dual-gate passes`, current: `${passing} pass`, gap: `${exceptions} exceptions`, owner: tasks[0]?.owner || "Unassigned", progress: `${tasks.length} actions`, verifiedResult: `${passing} verified passes` },
    measures,
    services,
    tasks,
    despatchEscalations: [],
    loopHealth: buildLiveMemberSavingsHealth(snapshot),
    learningInputs: [],
    weeklyMessageInputs: [],
    quarantineCount: freshness.quarantinedRecords,
    policyRegistry: [],
    blockedCapabilities: liveBoundary,
  } as unknown as MemberSavingsPreview)
}

export function buildLiveNiaGrowthPreview(snapshot: LiveSelfDriveSnapshot): NiaGrowthPreview | null {
  if (!snapshot.enterpriseDemand.length && !snapshot.living.length) return null
  const projection = buildLiveNiaGrowthProjection(snapshot)
  const channelRows = (channel: "FONO" | "SP") => snapshot.enterpriseDemand.filter((row) => {
    const identity = `${text(row, "demand id")} ${text(row, "source submission id")} ${text(row, "role required")}`.toLowerCase()
    return channel === "SP" ? identity.includes("sp-bot") : identity.includes("fono") || identity.includes("living supply")
  })
  const lane = (channel: "FONO" | "SP") => {
    const rows = channelRows(channel)
    const planned = rows.reduce((sum, row) => sum + number(row, "headcount required"), 0)
    const ready = rows.reduce((sum, row) => sum + number(row, "headcount matched"), 0)
    return { supplyModel: channel, capacityLabel: `${channel} capacity`, plannedNests: planned, activationReadyNests: ready, gapNests: Math.max(0, planned - ready), timeToReadyLabel: "From governed demand stages", coverageLabel: `${ready}/${planned || 0} matched`, coverageDetail: `${rows.length} governed demand records`, progressPct: planned ? Math.min(100, ready / planned * 100) : 0, stages: [] }
  }
  const lanes = [lane("FONO"), lane("SP")] as const
  const claimed = lanes.reduce((sum, row) => sum + row.plannedNests, 0)
  const verified = lanes.reduce((sum, row) => sum + row.activationReadyNests, 0)
  const loopHealth = buildLoopHealth({ asOf: snapshot.asOf, feeds: [], clocks: [], verification: { claimed, verified: Math.min(claimed, verified), awaiting: Math.max(0, claimed - verified), reopened: 0, oldestAwaitingAt: claimed > verified ? snapshot.asOf : null } })
  return Object.freeze({
    fixtureLabel: "Governed live data",
    mode: "Live read-only",
    question: "Where does verified demand justify the next capacity decision?",
    source: { name: "Enterprise Demand · Living · Studios", asOf: snapshot.asOf, lastRefreshAt: snapshot.asOf, freshness: loopHealth.state, synthetic: false },
    headline: `${projection.summary.gap} remains between required and matched demand capacity.`,
    summary: projection.summary,
    measures: projection.measures,
    lanes,
    tasks: [],
    despatchEscalations: [],
    signOffs: [],
    learningInputs: [],
    quarantineCount: 0,
    policyRegistry: [],
    blockedCapabilities: liveBoundary,
    loopHealth,
  } as unknown as NiaGrowthPreview)
}

export function buildLiveCashControlPreview(snapshot: LiveSelfDriveSnapshot): CashControlPreview | null {
  if (!snapshot.finance.length && !snapshot.channels.length && !snapshot.approvals.length) return null
  const currentCm = snapshot.finance.reduce((sum, row) => sum + number(row, "cm2 inr", "contribution margin inr", "cm inr"), 0)
  const opex = snapshot.finance.reduce((sum, row) => sum + number(row, "opex inr", "operating expense inr"), 0)
  const cash = snapshot.finance.reduce((sum, row) => sum + number(row, "cash collected inr", "collection inr", "cash inr"), 0)
  const target = snapshot.monthlyCMTarget
  const gap = Math.max(0, target - currentCm)
  const linkedActions = snapshot.actions.filter((row) => /cash|finance|collection|cm/.test(`${text(row, "domain")} ${text(row, "operating objective")}`.toLowerCase()))
  const actionIds = new Set(linkedActions.map((row) => text(row, "action id")).filter(Boolean))
  const evidence = snapshot.evidence.filter((row) => actionIds.has(text(row, "linked id")))
  const verified = evidence.filter((row) => text(row, "verification status").toLowerCase() === "verified").length
  const reopened = evidence.filter((row) => text(row, "verification status").toLowerCase() === "reopened").length
  const claimed = Math.max(linkedActions.length, evidence.length)
  const awaiting = Math.max(0, claimed - verified - reopened)
  const health = buildLoopHealth({ asOf: snapshot.asOf, feeds: [], clocks: [], verification: { claimed, verified, awaiting, reopened, oldestAwaitingAt: awaiting ? snapshot.asOf : null } })
  const approvals = snapshot.approvals.filter((row) => /cash|finance|collection|cm/.test(`${text(row, "approval type")} ${text(row, "title")} ${text(row, "decision note")}`.toLowerCase())).map((row, index) => ({ id: text(row, "approval id") || `finance-approval-${index + 1}`, decision: text(row, "title", "approval type") || "Financial decision", owner: text(row, "approver actor id", "requested from actor id") || "Finance approver", impact: text(row, "decision note", "reason") || "Governed financial approval", status: "Pending human approval" as const }))
  const measures = [
    { id: "cm-destination", label: "Contribution margin destination", value: `₹${Math.round(currentCm).toLocaleString("en-IN")}`, target: target ? `₹${Math.round(target).toLocaleString("en-IN")}` : "Not recorded", detail: target ? `₹${Math.round(gap).toLocaleString("en-IN")} remaining` : "Monthly target is not recorded" },
    { id: "opex-control", label: "Operating expense", value: `₹${Math.round(opex).toLocaleString("en-IN")}`, target: "Governed finance control", detail: "Recorded Finance Daily rows" },
    { id: "cash-protection", label: "Collected cash", value: `₹${Math.round(cash).toLocaleString("en-IN")}`, target: "Governed cash control", detail: "Recorded collections only" },
    { id: "closure-integrity", label: "Verified closures", value: `${verified}/${claimed}`, target: "All independently verified", detail: `${awaiting} awaiting · ${reopened} reopened` },
  ]
  return Object.freeze({
    fixtureLabel: "Governed live data",
    mode: "Live read-only",
    question: "What financial gap must be closed without breaching cash control?",
    source: { name: "Finance Daily · Cash Control Channels · Approval Log", asOf: snapshot.asOf, lastRefreshAt: snapshot.asOf, freshness: health.state, synthetic: false },
    headline: target ? `Close the ₹${Math.round(gap).toLocaleString("en-IN")} contribution-margin gap within governed cash controls.` : "Record the governed monthly contribution-margin destination.",
    summary: { target: target ? `₹${Math.round(target).toLocaleString("en-IN")}` : "Not recorded", current: `₹${Math.round(currentCm).toLocaleString("en-IN")}`, gap: `₹${Math.round(gap).toLocaleString("en-IN")}`, owner: approvals[0]?.owner || "Finance owner", progress: target ? `${Math.min(100, Math.round(currentCm / Math.max(target, 1) * 100))}%` : "Cannot calculate", verifiedResult: `${verified} independently verified closures` },
    measures,
    controlPath: [
      { id: "destination", label: "Destination", value: target ? "Recorded" : "Pending", state: target ? "Complete" : "Pending" },
      { id: "current", label: "Current CM", value: `₹${Math.round(currentCm).toLocaleString("en-IN")}`, state: "Complete" },
      { id: "gap", label: "Remaining gap", value: `₹${Math.round(gap).toLocaleString("en-IN")}`, state: target ? "Pending" : "Blocked" },
    ],
    financialRails: [
      { id: "opex", label: "Recorded opex", value: `₹${Math.round(opex).toLocaleString("en-IN")}`, threshold: "Governed policy", progressPct: 0, state: "Within control" },
      { id: "cash", label: "Collected cash", value: `₹${Math.round(cash).toLocaleString("en-IN")}`, threshold: "Governed policy", progressPct: 100, state: "Protected" },
    ],
    closureCounts: { claimed, verified, awaitingVerification: awaiting, reopened },
    channelRecommendations: [],
    tasks: [],
    despatchEscalations: [],
    approvals,
    learningInputs: [],
    policyRegistry: [],
    blockedCapabilities: liveBoundary,
    loopHealth: health,
  } as unknown as CashControlPreview)
}

export function buildLiveFinanceExpansionPreview(snapshot: LiveSelfDriveSnapshot): FinanceExpansionPreview | null {
  const activeStudios = snapshot.studios.filter((row) => {
    const active = text(row, "active", "status").toLowerCase()
    return !active || ["true", "yes", "1", "active"].includes(active)
  })
  if (!activeStudios.length) return null
  const finance = snapshot.finance[0] ?? {}
  const monthlyOpex = snapshot.finance.reduce((sum, row) => sum + number(row, "opex inr", "operating expense inr"), 0)
  const cash = snapshot.finance.reduce((sum, row) => sum + number(row, "cash inr", "cash collected inr", "collection inr"), 0)
  const options = activeStudios.map((row, index) => {
    const studioId = text(row, "studio id", "studio code") || `studio-${index + 1}`
    const contracted = number(row, "contracted nests", "capacity")
    const living = snapshot.living.find((candidate) => text(candidate, "studio id") === studioId) ?? {}
    const occupied = number(living, "occupied nests")
    const deposit = number(row, "refundable deposit inr", "deposit inr")
    const nonrefundable = number(row, "nonrefundable deposit inr")
    const capex = number(row, "nia funded capex inr", "capex inr")
    const partnerCost = number(row, "monthly partner cost inr", "rental cost inr")
    const upfront = deposit + nonrefundable + capex
    return {
      rank: index + 1,
      studioId,
      studioName: text(row, "studio name", "name") || studioId,
      canMeetDemand: contracted > 0,
      refundableDepositInr: deposit,
      nonrefundableDepositInr: nonrefundable,
      niaFundedCapexInr: capex,
      upfrontCapitalInr: upfront,
      capitalPerActivationReadyNestInr: contracted ? upfront / contracted : 0,
      recurringCostPerExpectedOccupiedNestInr: occupied ? partnerCost / occupied : 0,
      activationFrictionDays: 0,
      projectedContributionMarginInr: number(finance, "cm2 inr", "contribution margin inr"),
      monthlyPartnerCostInr: partnerCost,
      expectedOccupiedNests: occupied,
      activationReadyNests: contracted,
      contributionMarginAssumption: { scope: "Recorded finance and occupancy", formula: "Recorded contribution margin from governed Finance Daily rows", exclusions: "Missing source inputs remain blank or zero; no value is inferred." },
      activationFriction: { commercialAgreementDays: 0, complianceReadinessDays: 0, physicalReadinessDays: 0, unresolvedDependencyDays: 0 },
      source: { rowIdentity: text(row, "source row identity", "studio id") || studioId },
    }
  })
  const approvalRows = snapshot.approvals.filter((row) => /finance|deposit|capex|commercial|pricing|forecast/.test(`${text(row, "approval type")} ${text(row, "title")}`.toLowerCase()))
  const approvals = approvalRows.map((row, index) => ({ requestId: text(row, "approval id") || `approval-${index + 1}`, category: text(row, "approval type", "title") || "Financial commitment", studioId: text(row, "studio id") || null, amountInr: number(row, "amount inr"), requestedBy: text(row, "requested by actor id") || "Operations", requestedAt: text(row, "requested at") || snapshot.asOf, reason: text(row, "decision note", "reason") || "Governed financial approval", policyRefs: [], protectedEvidenceRefs: [], approver: text(row, "approver actor id") || "Finance approver", status: text(row, "decision").toLowerCase() === "approved" ? "Approved" : "Requested", version: 1 }))
  const incidentRows = snapshot.incidents.filter((row) => /finance|cash|studio|margin|opex/.test(`${text(row, "domain")} ${text(row, "incident type")} ${text(row, "short description")}`.toLowerCase()))
  const warRoomCases = (incidentRows.length ? incidentRows : [snapshot.incidents[0] ?? {}]).map((row, index) => {
    const incidentId = text(row, "incident id") || `finance-case-${index + 1}`
    const action = snapshot.actions.find((candidate) => text(candidate, "incident id") === incidentId) ?? {}
    return { caseId: incidentId, title: text(row, "short description", "incident type") || "Governed finance review", priority: text(row, "severity") || "Priority", state: text(row, "state") || "Open", ownerActorId: text(action, "owner actor id") || text(row, "reported by actor id") || "Finance owner", verifierActorId: text(action, "verified by") || "Independent verifier pending", responseDueAt: text(action, "due at") || snapshot.asOf, decisionDueAt: text(action, "due at") || snapshot.asOf, evidence: [], triggers: [text(row, "severity reason", "short description") || "Governed finance exception"], requiredEvidence: [text(action, "required evidence") || "Independent finance evidence"], history: [] }
  })
  const studioHealth = options.map((option, index) => ({ assessmentId: `health-${option.studioId}`, studioId: option.studioId, studioName: option.studioName, status: option.expectedOccupiedNests > 0 ? "Green" : "Amber", requiredResponse: option.expectedOccupiedNests > 0 ? "Continue governed monitoring." : "Record current occupancy and finance evidence.", ownerActorId: "Studio owner", reviewDueAt: snapshot.asOf, occupancyRatio: option.activationReadyNests ? option.expectedOccupiedNests / option.activationReadyNests : 0, grossMarginRatio: 0, contributionMarginInr: option.projectedContributionMarginInr, sourceRowIdentity: option.source.rowIdentity, asOf: snapshot.asOf, reasons: [], decisionDueAt: null, actionPlanDueAt: null }))
  return Object.freeze({
    mode: "Live read-only",
    writesEnabled: false,
    source: { name: "Studios · Living · Finance Daily · Approval Log", asOf: snapshot.asOf, freshness: "Current", synthetic: false },
    policies: { financialApprover: { policyId: "governed-finance-approver", version: 1, value: "Finance approver" }, monthlyOpexCap: { policyId: "governed-opex-control", version: 1, value: monthlyOpex || 0 }, minimumCash: { policyId: "governed-cash-control", version: 1, value: 0 }, hiringState: { policyId: "governed-hiring-state", version: 1, value: "Human approval required" } },
    options,
    selectedStudioId: options[0].studioId,
    guardrails: { forecast: { forecastMonthlyOpexInr: monthlyOpex, proposedNewHires: 0 }, projectedCashAfterCommitmentInr: cash, breaches: [] },
    approvals,
    studioHealth,
    warRoomCases,
    projection: { eventType: "Governed finance review", result: "Read-only live projection", verifiedBy: "Independent verification required" },
  } as unknown as FinanceExpansionPreview)
}

export function buildLiveControlledAutonomyPreview(snapshot: LiveSelfDriveSnapshot): ControlledAutonomyPreview {
  // Rows without a source submission id are legacy/manual residue with no
  // auditable lineage. Do not expose them as live governed alarms.
  const governedActions = snapshot.actions.filter((row) => text(row, "source submission id"))
  const records = governedActions.map((row, index) => {
    const sourceState = text(row, "state").toLowerCase()
    const state = sourceState === "closed" || sourceState === "verified" ? "Closed" : sourceState === "reopened" ? "Reopened" : sourceState === "escalated" ? "Escalated" : "Detected"
    const actionId = text(row, "action id") || `action-${index + 1}`
    return { exceptionId: actionId, domain: text(row, "domain") || "Operations", title: text(row, "operating objective", "next action") || actionId, ownerActorId: text(row, "owner actor id") || "Unassigned", verifierActorId: text(row, "verified by") || "Independent verifier pending", state, botReminderCount: 0, evidenceCount: snapshot.evidence.filter((evidence) => text(evidence, "linked id") === actionId).length, assignedThroughBot: false, managementInterventionRequired: false, externalMessageSent: false, history: [] }
  })
  const states = ["Detected", "Assigned through bot", "Chased", "Evidence collected", "Independently verified", "Closed", "Reopened", "Escalated"]
  const stateCoverage = states.map((state) => ({ state, count: records.filter((record) => record.state === state).length }))
  const approvalIds = new Set(snapshot.approvals.filter((row) => !["approved", "declined", "rejected"].includes(text(row, "decision").toLowerCase())).map((row) => text(row, "linked action id")).filter(Boolean))
  const learningQueue = snapshot.learningHistory.map((row, index) => ({ recommendationId: text(row, "recommendation id") || `learning-${index + 1}`, domain: text(row, "domain") || "Operations", observed: text(row, "observed") || "Governed observation recorded", proposedChange: text(row, "proposed change") || "Review recorded learning proposal", expectedEffect: text(row, "expected effect") || "Governed effect not recorded", authority: text(row, "authority", "owner") || "Human approver", evaluation: { requiredDisposition: text(row, "disposition").toLowerCase().includes("sign") ? "Human sign-off" : "Human review", attributionLabel: text(row, "attribution") || "Observed", confidence: text(row, "confidence") || "Unconfirmed", materialityReasons: [text(row, "observed")].filter(Boolean), confidenceReasons: [text(row, "confidence")].filter(Boolean) } }))
  const claimed = records.length
  const verified = records.filter((record) => record.state === "Closed").length
  const reopened = records.filter((record) => record.state === "Reopened").length
  const awaiting = Math.max(0, claimed - verified - reopened)
  const loopHealth = buildLoopHealth({ asOf: snapshot.asOf, feeds: [], clocks: [], verification: { claimed, verified, awaiting, reopened, oldestAwaitingAt: awaiting ? snapshot.asOf : null } })
  const policy = (policyId: string, value: unknown) => ({ policyId, version: 1, value })
  return Object.freeze({
    phase: "Governed live operations",
    mode: "Live read-only",
    writesEnabled: false,
    liveReadsEnabled: true,
    externalMessagesEnabled: false,
    executionAdapterAvailable: false,
    source: { name: "Action Log · Evidence Log · Approval Log · Learning History", asOf: snapshot.asOf, freshness: loopHealth.state, synthetic: false },
    routineLoop: { records, stateCoverage },
    peopleExceptions: { surfaced: [], withheld: [] },
    evaluation: {
      expectedSignals: [],
      comparisons: [],
      feedback: [],
      metrics: {
        recommendationCount: 0,
        expectedSignalCount: 0,
        reviewedCount: 0,
        detectionPrecision: null,
        falsePositiveRate: null,
        missedEventRate: null,
        acceptanceRate: null,
        rejectionRate: null,
        overrideRate: null,
        reversalRate: null,
        auditCompleteness: null,
        verificationFailureRate: null,
        medianDecisionMinutes: null,
        medianVerificationMinutes: null,
      },
      recordedAt: snapshot.asOf,
    },
    learningQueue,
    loopHealth,
    policies: { mode: policy("governed-operating-mode", "Human controlled"), minimumPrecision: policy("minimum-precision", "Not recorded"), maximumReversal: policy("maximum-reversal", "Not recorded"), minimumAuditCompleteness: policy("minimum-audit-completeness", "Not recorded"), killSwitch: policy("kill-switch", true), highRiskRule: policy("high-risk-human-approval", "Required") },
    readiness: { lowRisk: { reasons: ["Automatic execution is not connected to this read-only dashboard."] }, highRisk: { reasons: ["Permanent human approval is required."] } },
    systemScorecard: [
      { label: "Routine-loop ownership", value: `${records.length} governed actions`, source: "Action Log", status: records.length ? "Covered" : "No data" },
      { label: "Approvals waiting", value: String(approvalIds.size), source: "Approval Log", status: approvalIds.size ? "Covered" : "No data" },
      { label: "Audit completeness", value: `${verified}/${claimed}`, source: "Action Log + Evidence Log", status: claimed ? "Covered" : "No data" },
    ],
  } as unknown as ControlledAutonomyPreview)
}

export function buildLiveMemberFeedbackModel(snapshot: LiveSelfDriveSnapshot): { items: MemberFeedbackItem[]; responses: NpsResponse[] } {
  const responses = snapshot.memberNpsResponses.flatMap((row, index) => {
    const score = number(row, "score")
    const collectedAt = text(row, "collected at", "captured at")
    if (!Number.isInteger(score) || score < 0 || score > 10 || !collectedAt) return []
    const month = text(row, "month") || collectedAt.slice(0, 7)
    return [{ id: text(row, "id") || `nps-${index + 1}`, memberToken: text(row, "member token") || `Member ${index + 1}`, score, category: categoriseNps(score), followUpText: text(row, "follow up text", "comment") || null, collectedAt, month, theatre: text(row, "theatre", "theatre id") || "Unassigned", studio: text(row, "studio", "studio id") || "Unassigned" }]
  })
  const items = snapshot.memberNpsFeedback.flatMap((row, index) => {
    const id = text(row, "id", "feedback id")
    const capturedAt = text(row, "captured at", "collected at")
    if (!id || !capturedAt) return []
    const pillarValue = text(row, "pillar").toLowerCase()
    const pillar = pillarValue === "work" ? "Work" : pillarValue === "essentials" ? "Essentials" : "Living"
    const riskValue = text(row, "exit risk", "risk").toLowerCase()
    const exitRisk = riskValue.includes("immediate") || riskValue.includes("high") ? "Immediate attention" : riskValue.includes("watch") || riskValue.includes("medium") ? "Watch closely" : "Monitor"
    const sourceValue = text(row, "source").toLowerCase()
    return [{ id, actionId: text(row, "action id") || `feedback-action-${index + 1}`, memberToken: text(row, "member token") || `Member ${index + 1}`, pillar, category: text(row, "category") || "Uncategorised", theatre: text(row, "theatre", "theatre id") || "Unassigned", studio: text(row, "studio", "studio id") || "Unassigned", summary: text(row, "summary", "feedback") || "Feedback detail is restricted.", capturedAt, source: sourceValue.includes("chat") ? "Chatbot" : "Monthly NPS", exitRisk, rawConversationRef: text(row, "raw conversation ref", "conversation ref") || `restricted://member-feedback/${id}`, npsResponseId: text(row, "nps response id") || null }]
  })
  return { items: items as MemberFeedbackItem[], responses: responses as NpsResponse[] }
}
