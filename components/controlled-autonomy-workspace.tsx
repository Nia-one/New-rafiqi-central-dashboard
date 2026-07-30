"use client"

import { useMemo, useState } from "react"
import { BadgeCheck, Ban, Bot, BriefcaseBusiness, CircleGauge, ClipboardCheck, Database, FileLock2, MessageSquare, RotateCcw, ShieldCheck, UserCheck, UsersRound } from "lucide-react"
import type { AutonomyFeedbackLabel } from "@/lib/operating-loop/autonomy-control"
import type { ControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { ActionSegment, OperationalCard, OperationalCardStack, type ActionStage } from "@/components/operational-card"
import { dashboardDisplayLabel } from "@/lib/dashboard-model"
import { buildLiveApprovals } from "@/lib/live-approvals"
import { buildLoopHealth, type LoopHealth } from "@/lib/operating-loop/loop-health"

type Props = { preview: ControlledAutonomyPreview; liveData?: any }
type FeedbackFilter = "All feedback" | AutonomyFeedbackLabel
type ShadowDecisionOutcome = "Approved" | "Declined"
type ShadowDecisionAudit = Readonly<{ auditId: string; decisionId: string; outcome: ShadowDecisionOutcome; recordedAt: string }>
type LiveUrgencyRecord = Readonly<{ actionId: string; title: string; domain: string; owner: string; dueAt: string; state: string; evidenceCount: number; reason: string; nextAction: string; result: string }>
type LiveUrgencyGroups = Readonly<{ fixNow: readonly LiveUrgencyRecord[]; recovering: readonly LiveUrgencyRecord[]; verified: readonly LiveUrgencyRecord[] }>
type LiveGovernance = Readonly<{ asOf: string; decisions: readonly Record<string, string>[]; authorities: readonly { authority: string; role: string }[]; routines: readonly LiveUrgencyRecord[]; lifecycle: readonly { state: string; count: number }[]; peopleExceptions: readonly Record<string, string | number>[]; feedback: readonly Record<string, string>[]; policies: readonly Record<string, string>[]; scorecard: readonly { label: string; value: string; source: string; status: string }[] }>

const HUMAN_AUTHORITIES = [
  { authority: "Money", role: "Financial approver · Pushkar" },
  { authority: "Contracts", role: "Commercial approver · Pushkar" },
  { authority: "Employment", role: "Named HR / management approver" },
  { authority: "Legal / compliance", role: "Named legal / compliance approver" },
  { authority: "External communication", role: "Authorised communications leader" },
] as const

const OWNER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "ACT-EAE": "Essentials EAE",
  "ACT-THEATRE": "Theatre lead",
  "ACT-JCO": "Demand JCO",
})

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function percentage(value: number | null) {
  return value === null ? "No data" : `${(value * 100).toFixed(1)}%`
}

function minutes(value: number | null) {
  return value === null ? "No data" : `${value.toFixed(0)} min`
}

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

const rowText = (row: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return String(row[key]).trim()
  return ""
}

const latestTimestamp = (rows: readonly Record<string, unknown>[], fallback: string) => rows
  .map((row) => rowText(row, ["updated at", "decided at", "proposed at", "uploaded at", "due at"]))
  .filter((value) => Number.isFinite(Date.parse(value))).sort((left, right) => Date.parse(right) - Date.parse(left))[0] || fallback

export function buildLiveSignOffLoopHealth(liveData: any, fallback: LoopHealth): LoopHealth {
  if (!liveData) return fallback
  const approvals = buildLiveApprovals(liveData)
  const asOf = String(liveData.asOf || liveData.fetchedAt || liveData?.meta?.snapshotAt || fallback.asOf)
  const actionRows: Record<string, unknown>[] = Array.isArray(liveData.actionLog) ? liveData.actionLog : Array.isArray(liveData.actions) ? liveData.actions : []
  const evidenceRows: Record<string, unknown>[] = Array.isArray(liveData.evidenceLog) ? liveData.evidenceLog : Array.isArray(liveData.evidence) ? liveData.evidence : []
  const approvalRows: Record<string, unknown>[] = Array.isArray(liveData.approvalLog) ? liveData.approvalLog : Array.isArray(liveData.approvals) ? liveData.approvals : []
  const pending = approvals.filter((approval) => approval.pending)
  const terminal = approvals.filter((approval) => approval.terminal)
  const oldestPendingAt = pending.map((approval) => rowText(approval.actionRow ?? {}, ["proposed at", "updated at", "due at"])).filter((value) => Number.isFinite(Date.parse(value))).sort((left, right) => Date.parse(left) - Date.parse(right))[0] || (pending.length ? asOf : null)
  const feeds = [
    { feedId: "approval-log", label: "Approval Log", rows: approvalRows, critical: true },
    { feedId: "action-log", label: "Action Log", rows: actionRows, critical: true },
    { feedId: "evidence-log", label: "Evidence Log", rows: evidenceRows, critical: false },
  ].filter((source) => source.rows.length).map((source) => ({ feedId: source.feedId, label: source.label, lastUpdatedAt: latestTimestamp(source.rows, asOf), cadenceMinutes: 120, critical: source.critical, affectedClaims: source.rows.map((row, index) => rowText(row, ["approval id", "action id", "evidence id"]) || `${source.feedId}-${index + 1}`) }))
  const clocks = pending.filter((approval) => Number.isFinite(Date.parse(approval.dueAt))).map((approval) => ({ clockId: approval.approvalId, label: approval.title, ownerRole: approval.owner, dueAt: approval.dueAt, state: "Running" as const }))
  return buildLoopHealth({ asOf, feeds, clocks, verification: { claimed: approvals.length, verified: terminal.length, awaiting: pending.length, reopened: 0, oldestAwaitingAt: oldestPendingAt }, quarantinedRecords: 0 })
}

export function buildLiveFailedRecoveryCount(liveData: any, fallback: number): number {
  if (!liveData) return fallback
  const evidenceRows: Record<string, unknown>[] = Array.isArray(liveData.evidenceLog) ? liveData.evidenceLog : Array.isArray(liveData.evidence) ? liveData.evidence : []
  return evidenceRows.filter((row) => /^(rejected|failed|invalid)$/i.test(rowText(row, ["verification status", "status", "verification result"]))).length
}

export function buildLiveSignOffUrgency(liveData: any): LiveUrgencyGroups {
  const actionRows: Record<string, unknown>[] = Array.isArray(liveData?.actionLog) ? liveData.actionLog : Array.isArray(liveData?.actions) ? liveData.actions : []
  const evidenceRows: Record<string, unknown>[] = Array.isArray(liveData?.evidenceLog) ? liveData.evidenceLog : Array.isArray(liveData?.evidence) ? liveData.evidence : []
  const peopleRows: Record<string, unknown>[] = Array.isArray(liveData?.people) ? liveData.people : []
  const incidentRows: Record<string, unknown>[] = Array.isArray(liveData?.incidents) ? liveData.incidents : Array.isArray(liveData?.incidentLog) ? liveData.incidentLog : []
  const approvalActionIds = new Set(buildLiveApprovals(liveData).map((approval) => approval.linkedActionId).filter(Boolean))

  const records = actionRows.filter((row) => {
    const actionId = rowText(row, ["action id", "id"])
    return actionId && !approvalActionIds.has(actionId)
  }).map((row): LiveUrgencyRecord & { rejected: boolean; verified: boolean } => {
    const actionId = rowText(row, ["action id", "id"])
    const linkedEvidence = evidenceRows.filter((evidence) => rowText(evidence, ["linked id", "action id"]) === actionId)
    const evidenceStatuses = linkedEvidence.map((evidence) => rowText(evidence, ["verification status", "status", "verification result"]))
    const incident = incidentRows.find((item) => rowText(item, ["incident id", "id"]) === rowText(row, ["incident id"]))
    const actorId = rowText(row, ["owner actor id", "owner"]) || rowText(incident ?? {}, ["owner actor id", "owner"])
    const person = peopleRows.find((item) => rowText(item, ["actor id", "id"]) === actorId)
    const state = rowText(row, ["state", "status"]) || "Detected"
    const rejected = evidenceStatuses.some((status) => /^(rejected|failed|invalid)$/i.test(status)) || /^(escalated|failed)$/i.test(state)
    const verified = /^(verified|closed|complete|completed)$/i.test(state) || evidenceStatuses.some((status) => /^(verified|accepted|approved)$/i.test(status))
    return {
      actionId,
      title: rowText(row, ["operating objective", "title", "next action"]) || "Recorded action",
      domain: rowText(incident ?? {}, ["domain", "pillar"]) || "Action Log",
      owner: rowText(person ?? {}, ["display name", "role"]) || actorId || "Owner not recorded",
      dueAt: rowText(row, ["due at"]) || rowText(incident ?? {}, ["due at"]),
      state,
      evidenceCount: linkedEvidence.length,
      reason: rowText(row, ["reopen reason", "verification result", "required evidence"]) || rowText(incident ?? {}, ["severity reason", "short description"]) || "Recorded outcome requires governed follow-up.",
      nextAction: rowText(row, ["next action", "required evidence"]) || (rejected ? "Submit corrected evidence for independent verification" : verified ? "No further action" : "Complete the recorded action and submit proof"),
      result: rowText(row, ["verification result", "expected metric", "expected result"]) || (verified ? "Independently verified" : "Awaiting verified recovery"),
      rejected,
      verified,
    }
  })

  return {
    fixNow: records.filter((record) => record.rejected),
    recovering: records.filter((record) => !record.rejected && !record.verified && /^(reopened|assigned|in progress|proof submitted)$/i.test(record.state)),
    verified: records.filter((record) => !record.rejected && record.verified),
  }
}

export function buildLiveSignOffGovernance(liveData: any, urgency = buildLiveSignOffUrgency(liveData)): LiveGovernance {
  const rows = (a: string, b?: string): Record<string, unknown>[] => Array.isArray(liveData?.[a]) ? liveData[a] : b && Array.isArray(liveData?.[b]) ? liveData[b] : []
  const actions = rows("actionLog", "actions"), evidence = rows("evidenceLog", "evidence"), approvals = rows("approvalLog", "approvals"), people = rows("people"), policies = rows("policyRegistry", "policies"), learning = rows("learningHistory")
  const decisions = approvals.filter((row) => !/^(pending|proposed|awaiting)$/i.test(rowText(row, ["decision", "status"]))).map((row) => ({ id: rowText(row, ["approval id", "id"]), decision: rowText(row, ["decision", "status"]) || "Recorded", title: rowText(row, ["title", "proposed change"]) || "Governed decision", owner: rowText(row, ["decided by", "owner", "approver"]) || "Approver not recorded", at: rowText(row, ["decided at", "updated at", "requested at"]) }))
  const authorityMap = new Map<string, string>()
  for (const row of [...policies, ...approvals]) { const value = `${rowText(row, ["category", "authority", "name", "title"])} ${rowText(row, ["approver role", "approver", "owner", "approved by"])}`; const category = /money|cash|financial|price|margin/i.test(value) ? "Money" : /contract|commercial|supplier/i.test(value) ? "Contracts" : /employment|people|hr|performance/i.test(value) ? "Employment" : /legal|compliance/i.test(value) ? "Legal / compliance" : /communication|external/i.test(value) ? "External communication" : ""; if (category) authorityMap.set(category, rowText(row, ["approver role", "approver", "owner", "approved by"]) || "Named approver not recorded") }
  const routines = [...urgency.fixNow, ...urgency.recovering, ...urgency.verified]
  const lifecycle = ["Detected", "Assigned", "In progress", "Proof submitted", "Verified", "Closed", "Reopened", "Escalated"].map((state) => ({ state, count: actions.filter((row) => rowText(row, ["state", "status"]).toLowerCase() === state.toLowerCase()).length }))
  const peopleExceptions = actions.filter((row) => /people|performance|employment|counsel/i.test(`${rowText(row, ["domain", "category", "operating objective", "title"])} ${rowText(row, ["state", "status"])}`)).map((row) => { const actor = rowText(row, ["owner actor id", "owner"]), person = people.find((item) => rowText(item, ["actor id", "id"]) === actor), id = rowText(row, ["action id", "id"]); return { id, name: rowText(person ?? {}, ["display name", "name"]) || actor || "Named person not recorded", role: rowText(person ?? {}, ["role"]) || "Role not recorded", state: rowText(row, ["state", "status"]) || "Recorded", reason: rowText(row, ["reopen reason", "required evidence", "verification result"]) || "Governed review required", evidence: evidence.filter((item) => rowText(item, ["linked id", "action id"]) === id).length } })
  const feedback = learning.map((row, index) => ({ id: rowText(row, ["learning id", "id"]) || `learning-${index + 1}`, label: rowText(row, ["label", "disposition", "outcome"]) || "Recorded feedback", summary: rowText(row, ["notes", "observed", "proposed change"]) || "Governed learning record", domain: rowText(row, ["domain"]) || "Learning History", at: rowText(row, ["recorded at", "updated at"]), recommendation: rowText(row, ["recommendation id", "proposed change"]) || "No recommendation", evidence: rowText(row, ["evidence ref", "evidence", "observed"]) || "No evidence reference recorded" }))
  const policyRecords = policies.map((row) => ({ id: rowText(row, ["policy id", "id"]), name: rowText(row, ["name", "policy"]) || "Governed policy", value: rowText(row, ["value", "status"]) || "Not recorded", version: rowText(row, ["version"]) || "Not recorded", approver: rowText(row, ["approved by", "approver"]) || "Not recorded" }))
  const verifiedEvidence = evidence.filter((row) => /^(verified|accepted|approved)$/i.test(rowText(row, ["verification status", "status", "verification result"]))).length
  return { asOf: String(liveData?.asOf || liveData?.fetchedAt || liveData?.meta?.snapshotAt || new Date(0).toISOString()), decisions, authorities: [...authorityMap].map(([authority, role]) => ({ authority, role })), routines, lifecycle, peopleExceptions, feedback, policies: policyRecords, scorecard: [
    { label: "Routine-loop ownership", value: `${routines.length} Sheet actions`, source: "Action_Log", status: actions.length ? "Covered" : "No data" }, { label: "People exceptions surfaced", value: `${peopleExceptions.length} recorded`, source: "Action_Log + People", status: peopleExceptions.length ? "Covered" : "No data" }, { label: "Verified outcomes", value: String(verifiedEvidence), source: "Evidence_Log", status: evidence.length ? "Covered" : "No data" }, { label: "Governed policies", value: String(policies.length), source: "Policy_Registry", status: policies.length ? "Covered" : "No data" }, { label: "Audit records", value: String(actions.length + evidence.length + approvals.length), source: "Action_Log + Evidence_Log + Approval_Log", status: actions.length + evidence.length + approvals.length ? "Covered" : "No data" },
  ] }
}

export function ControlledAutonomyWorkspace({ preview, liveData }: Props) {
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>("All feedback")
  const [shadowDecisionAudit, setShadowDecisionAudit] = useState<readonly ShadowDecisionAudit[]>([])
  const { evaluation } = preview
  const filteredFeedback = feedbackFilter === "All feedback" ? evaluation.feedback : evaluation.feedback.filter((item) => item.label === feedbackFilter)
  const filters: readonly FeedbackFilter[] = ["All feedback", "Rejected action", "Human override", "Missed alert", "Failed verification"]
  const closedRoutine = preview.routineLoop.records.filter((record) => record.state === "Closed").length
  const reopenedRoutine = preview.routineLoop.records.filter((record) => record.state === "Reopened").length
  const escalatedRoutine = preview.routineLoop.records.filter((record) => record.state === "Escalated").length
  const peopleException = preview.peopleExceptions.surfaced[0]
  const fixNowRoutine = preview.routineLoop.records.filter((record) => record.state === "Escalated")
  const recoveringRoutine = preview.routineLoop.records.filter((record) => record.state === "Reopened")
  const verifiedRoutine = preview.routineLoop.records.filter((record) => record.state === "Closed")
  const fixtureWaitingDecisions = preview.learningQueue
    .filter((entry) => entry.evaluation.requiredDisposition === "Human sign-off")
    .map((entry) => ({
      decisionId: entry.recommendationId,
      decisionRequired: entry.proposedChange,
      why: entry.evaluation.materialityReasons[0] ?? entry.evaluation.confidenceReasons[0] ?? "A governed human decision is required.",
      impact: entry.expectedEffect,
      deadline: `Before adoption · ${entry.authority}`,
      owner: entry.authority,
    }))
  const liveWaitingDecisions = buildLiveApprovals(liveData).filter((approval) => approval.pending).map((approval) => ({
    decisionId: approval.approvalId,
    decisionRequired: approval.title,
    why: approval.businessReason || approval.decisionReason || "A governed human decision is required.",
    impact: approval.expectedResult || approval.action,
    deadline: approval.dueAt ? date(approval.dueAt) : "No deadline recorded",
    owner: approval.owner,
    domain: approval.domain,
    action: approval.action,
  }))
  const waitingDecisions = liveData ? liveWaitingDecisions : fixtureWaitingDecisions
  const loopHealth = useMemo(() => buildLiveSignOffLoopHealth(liveData, preview.loopHealth), [liveData, preview.loopHealth])
  const liveUrgency = useMemo(() => buildLiveSignOffUrgency(liveData), [liveData])
  const liveGovernance = useMemo(() => liveData ? buildLiveSignOffGovernance(liveData, liveUrgency) : null, [liveData, liveUrgency])
  const failedRecoveryCount = liveData ? liveUrgency.fixNow.length : fixNowRoutine.length
  const fixNowCount = liveData ? liveUrgency.fixNow.length : fixNowRoutine.length
  const recoveringCount = liveData ? liveUrgency.recovering.length : recoveringRoutine.length
  const verifiedCount = liveData ? liveUrgency.verified.length : verifiedRoutine.length

  function expectedCompletion(state: (typeof preview.routineLoop.records)[number]["state"]) {
    if (state === "Closed") return "Complete"
    if (state === "Reopened") return "Next verification cycle"
    if (state === "Escalated") return "After verified owner response"
    return "Current operating cycle"
  }

  function routineProgress(state: (typeof preview.routineLoop.records)[number]["state"]): ActionStage {
    if (state === "Closed") return "verified"
    if (state === "Reopened" || state === "Escalated") return "working"
    return "assigned"
  }

  function recordShadowDecision(decisionId: string, outcome: ShadowDecisionOutcome) {
    setShadowDecisionAudit((current) => [...current, Object.freeze({
      auditId: `SHADOW-${decisionId}-${current.length + 1}`,
      decisionId,
      outcome,
      recordedAt: new Date().toISOString(),
    })])
  }

  return <DashboardSectionAccordion className="autonomy-workspace self-drive-workspace" ariaLabel="Your Sign-Off sections" defaultOpenIndex={0} sections={[
    { title: "Loop health", summary: `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` },
    { title: "Decision status", summary: `${waitingDecisions.length} material decisions · ${failedRecoveryCount} failed recoveries` },
    { title: "Decisions by urgency", summary: `${waitingDecisions.length + fixNowCount + recoveringCount} items need review or recovery` },
    { title: "Governance and background", summary: `${liveGovernance ? liveGovernance.decisions.length : shadowDecisionAudit.length} governed decisions · automatic execution locked` },
  ]}>
    <LoopHealthStrip health={loopHealth} />
    <div className={`self-drive-verdict is-${waitingDecisions.length + failedRecoveryCount > 0 ? "action" : "clear"}`} role="status">
      <b className="self-drive-verdict-pill">{waitingDecisions.length > 0 ? "Your decision needed" : failedRecoveryCount > 0 ? "Recovery failing" : "Nothing waiting"}</b>
      <span>{waitingDecisions.length > 0 ? <><strong>{waitingDecisions.length} material decision{waitingDecisions.length === 1 ? "" : "s"}</strong> need your sign-off{failedRecoveryCount > 0 ? <>, and <strong>{failedRecoveryCount}</strong> routine action{failedRecoveryCount === 1 ? " is" : "s are"} failing recovery.</> : "."}</> : failedRecoveryCount > 0 ? <><strong>{failedRecoveryCount}</strong> routine action{failedRecoveryCount === 1 ? " is" : "s are"} failing recovery and need you now.</> : "Routine work is running itself; no material decision is waiting for you."}</span>
      <small>So what: nothing below changes money, contracts, people or systems until you decide, so each item stays open until you approve or decline it.</small>
    </div>
    <section className="action-board" aria-label="Decisions ranked by urgency">
      <ActionSegment segment="fix-now" count={fixNowCount}>
        {liveData ? liveUrgency.fixNow.map((record) => <OperationalCard key={record.actionId} title={record.title} domain={record.domain} status="Recovery failed" tone="critical" action={record.nextAction} fields={[{ label: "Owner", value: record.owner }, { label: "Due", value: record.dueAt ? date(record.dueAt) : "No deadline recorded" }]} progress="working" story={[{ label: "Why it matters", value: record.reason }, { label: "What Nia already did", value: `Recorded ${record.evidenceCount} protected evidence reference${record.evidenceCount === 1 ? "" : "s"}; independent verification rejected the recovery.` }, { label: "What happens next", value: record.nextAction }]} />) : fixNowRoutine.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={dashboardDisplayLabel(record.domain)} status="Recovery failed" tone="critical" fields={[{ label: "Owner", value: OWNER_LABELS[record.ownerActorId] ?? record.ownerActorId }, { label: "Due", value: "Now" }]} progress={routineProgress(record.state)} story={[{ label: "Why it matters", value: record.history.at(-1)?.note ?? "The expected result was not verified." }, { label: "What Nia already did", value: `Assigned the owner, sent ${record.botReminderCount} governed reminder${record.botReminderCount === 1 ? "" : "s"} and collected ${record.evidenceCount} protected proof reference${record.evidenceCount === 1 ? "" : "s"}.` }, { label: "What happens next", value: expectedCompletion(record.state) }]} />)}
      </ActionSegment>

      <ActionSegment segment="nia-recovering" count={recoveringCount}>
        {liveData ? liveUrgency.recovering.map((record) => <OperationalCard key={record.actionId} title={record.title} domain={record.domain} status={record.state} tone="attention" action={record.nextAction} fields={[{ label: "Owner", value: record.owner }, { label: "Expected", value: record.result }]} progress="working" story={[{ label: "Why it matters", value: record.reason }, { label: "What Nia already did", value: `${record.state} is recorded in Action_Log with ${record.evidenceCount} linked evidence reference${record.evidenceCount === 1 ? "" : "s"}.` }, { label: "What happens next", value: record.nextAction }]} />) : recoveringRoutine.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={dashboardDisplayLabel(record.domain)} status="Reopened" tone="attention" fields={[{ label: "Owner", value: OWNER_LABELS[record.ownerActorId] ?? record.ownerActorId }, { label: "Expected", value: expectedCompletion(record.state) }]} progress={routineProgress(record.state)} story={[{ label: "Why it matters", value: record.history.at(-1)?.note ?? "A verified result did not hold." }, { label: "What Nia already did", value: "Reopened the same action instead of counting the earlier closure as a lasting result." }, { label: "What happens next", value: "The named owner is chased again until new proof passes independent verification." }]} />)}
      </ActionSegment>

      <ActionSegment segment="waiting-sign-off" count={waitingDecisions.length}>
        {waitingDecisions.map((decision) => {
          const localDecision = shadowDecisionAudit.filter((item) => item.decisionId === decision.decisionId).at(-1)
          return <OperationalCard key={decision.decisionId} title={decision.decisionRequired} domain={"domain" in decision ? decision.domain.replaceAll("-", " ") : "Material target change"} status={liveData ? "Pending human approval" : localDecision ? `${localDecision.outcome} locally` : "Your sign-off"} tone={localDecision ? "verified" : "breach"} action={"action" in decision ? decision.action : undefined} fields={[{ label: "Owner", value: decision.owner }, { label: "Due", value: decision.deadline }]} progress="evidence" story={[{ label: "Why it matters", value: decision.why }, { label: "What Nia already did", value: `Prepared the recommendation and quantified the expected effect: ${decision.impact}` }, { label: "What happens next", value: liveData ? "The authorised approver records one decision in Approval_Log." : "Approve or decline. Nothing changes outside this shadow preview." }]}>
            {liveData ? <p className="self-drive-shadow-note"><FileLock2 aria-hidden />Google Sheet - read-only · update Approval_Log once</p> : <><div className="self-drive-approval-controls"><button type="button" onClick={() => recordShadowDecision(decision.decisionId, "Approved")}>Approve</button><button type="button" onClick={() => recordShadowDecision(decision.decisionId, "Declined")}>Decline</button></div><p className="self-drive-shadow-note"><FileLock2 aria-hidden />Shadow decision only · {localDecision ? `${localDecision.outcome} locally` : "no external effect"}</p></>}
          </OperationalCard>
        })}
      </ActionSegment>

      <ActionSegment segment="verified" count={verifiedCount}>
        {liveData ? liveUrgency.verified.map((record) => <OperationalCard key={record.actionId} title={record.title} domain={record.domain} status="Verified" tone="verified" action="No further action" fields={[{ label: "Owner", value: record.owner }, { label: "Result", value: record.result }]} progress="verified" story={[{ label: "Why it matters", value: "Only independently verified outcomes count toward performance." }, { label: "What Nia already did", value: `Recorded ${record.evidenceCount} protected evidence reference${record.evidenceCount === 1 ? "" : "s"} and an independently verified result in the governed Sheet logs.` }, { label: "What happens next", value: "No action. The verified result remains in the Sheet audit history." }]} />) : verifiedRoutine.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={dashboardDisplayLabel(record.domain)} status="Verified" tone="verified" fields={[{ label: "Owner", value: OWNER_LABELS[record.ownerActorId] ?? record.ownerActorId }, { label: "Result", value: "Closed" }]} progress="verified" story={[{ label: "Why it matters", value: "Only independently verified outcomes count toward performance." }, { label: "What Nia already did", value: `Collected ${record.evidenceCount} protected proof references and used a separate verifier.` }, { label: "What happens next", value: "No action. The verified result remains in the audit history." }]} />)}
      </ActionSegment>
    </section>

    <details className="self-drive-audit-details">
      <summary>Full background record</summary>
      <div className="self-drive-audit-body">
        <section className="closed-loop-panel self-drive-local-audit" aria-label="Your recent decisions log">
          <header><div><p className="section-kicker">Your recent decisions log</p><h3>Recent decisions</h3></div><span>{liveGovernance ? `${liveGovernance.decisions.length} governed Sheet entries` : `${shadowDecisionAudit.length} entries · no external effect`}</span></header>
          {liveGovernance ? (liveGovernance.decisions.length ? <ol>{liveGovernance.decisions.map((entry) => <li key={entry.id}><strong>{entry.decision}</strong><span>{entry.title}</span><small>{entry.at && Number.isFinite(Date.parse(entry.at)) ? date(entry.at) : entry.owner}</small></li>)}</ol> : <p className="readonly-note"><FileLock2 aria-hidden />No completed Approval_Log decision recorded.</p>) : shadowDecisionAudit.length === 0
            ? <p className="readonly-note"><FileLock2 aria-hidden />No local shadow decision recorded.</p>
            : <ol>{shadowDecisionAudit.map((entry) => <li key={entry.auditId}><strong>{entry.outcome}</strong><span>{entry.decisionId}</span><small>{date(entry.recordedAt)}</small></li>)}</ol>}
        </section>
        <section className="closed-loop-panel" aria-label="Always your call">
          <header><div><p className="section-kicker">Always your call</p><h3>Decisions Nia never makes alone</h3></div></header>
          <div className="self-drive-authority-list">{(liveGovernance ? liveGovernance.authorities : HUMAN_AUTHORITIES).map((item) => <article key={item.authority}><h3>{item.authority}</h3><p>{item.role}</p></article>)}</div>
          {liveGovernance && !liveGovernance.authorities.length ? <p className="readonly-note">No named authority mapping is recorded in Policy_Registry or Approval_Log.</p> : null}
        </section>
    <section className="closed-loop-status-band autonomy-status-band" aria-label="How much runs itself">
      <div>
        <span className="status-badge"><ShieldCheck aria-hidden />{liveGovernance ? "Connected Google Sheet · read-only" : `${preview.phase} · ${preview.mode}`}</span>
        <h2>Routine work runs itself</h2>
        <p>The system detects, routes, chases, collects proof, verifies, closes, reopens and escalates routine work. A person appears only after repeated, independently verified non-performance survives data-quality and prior-intervention checks.</p>
      </div>
      <dl>
        <div><dt>Source</dt><dd><Database aria-hidden />{liveData ? "Approval_Log + Action_Log" : "Synthetic fixture"}</dd></div>
        <div><dt>As of</dt><dd>{date(liveGovernance?.asOf ?? preview.source.asOf)}</dd></div>
        <div><dt>Execution</dt><dd><FileLock2 aria-hidden />Kill switch engaged</dd></div>
      </dl>
    </section>

    <section className="closed-loop-metrics autonomy-metrics" data-kpi-group aria-label="Overall performance summary">
      <article><span>Routine exceptions</span><strong>{liveGovernance?.routines.length ?? preview.routineLoop.records.length}</strong><p>Recorded governed actions</p><small><Bot aria-hidden />{liveGovernance ? "Action_Log · read-only" : "Shadow bot routes · no message sent"}</small></article>
      <article><span>System outcomes</span><strong>{liveGovernance ? `${liveUrgency.verified.length} / ${liveUrgency.recovering.filter((r) => /^reopened$/i.test(r.state)).length} / ${liveUrgency.fixNow.length}` : `${closedRoutine} / ${reopenedRoutine} / ${escalatedRoutine}`}</strong><p>Closed / reopened / failed or escalated</p><small><RotateCcw aria-hidden />Append-only lifecycle</small></article>
      <article><span>People exceptions</span><strong>{liveGovernance?.peopleExceptions.length ?? preview.peopleExceptions.surfaced.length}</strong><p>Recorded people-related actions only</p><small><UsersRound aria-hidden />Named human review · not a work queue</small></article>
      <article><span>Governed policies</span><strong>{liveGovernance?.policies.length ?? preview.peopleExceptions.withheld.length}</strong><p>{liveGovernance ? "Policy_Registry records" : "Single-event and poor-data records withheld"}</p><small><ShieldCheck aria-hidden />No inference from missing evidence</small></article>
    </section>

    <section className="closed-loop-panel autonomy-routine-loop" aria-labelledby="autonomy-routine-title">
      <header><div><p className="section-kicker">Routine Recovery</p><h3 id="autonomy-routine-title">The system owns routine exceptions</h3></div><span>{liveGovernance ? `${liveGovernance.routines.length} governed Sheet actions` : "0 management interventions · synthetic routes"}</span></header>
      <ol className="autonomy-lifecycle" aria-label="Routine exception lifecycle">
        {(liveGovernance?.lifecycle ?? preview.routineLoop.stateCoverage).map((item, index) => <li key={item.state}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.state}</strong><small>{item.count} {liveGovernance ? "Action_Log records" : `fixture ${item.count === 1 ? "path" : "paths"}`}</small></li>)}
      </ol>
      <OperationalCardStack label="System-owned routine exceptions">{liveGovernance ? liveGovernance.routines.map((record) => <OperationalCard key={record.actionId} title={record.title} domain={`${record.domain} · ${record.actionId}`} status={record.state} fields={[{ label: "Owner", value: record.owner }, { label: "Evidence", value: `${record.evidenceCount} linked refs` }, { label: "Due", value: record.dueAt && Number.isFinite(Date.parse(record.dueAt)) ? date(record.dueAt) : "Not recorded" }, { label: "Result", value: record.result }]} />) : preview.routineLoop.records.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={`${dashboardDisplayLabel(record.domain)} · ${record.exceptionId}`} status={record.state} fields={[{ label: "Owner", value: record.ownerActorId }, { label: "Verifier", value: record.verifierActorId }, { label: "Evidence", value: `${record.evidenceCount} protected refs` }, { label: "Bot chase", value: `${record.botReminderCount} governed reminders · no external message` }, { label: "Audit", value: `${record.history.length} append-only events` }, { label: "Management", value: "None · system continues the loop" }]} />)}</OperationalCardStack>
    </section>

    <section className="closed-loop-panel autonomy-people-exceptions" aria-labelledby="autonomy-people-title">
      <header><div><p className="section-kicker">People Exceptions</p><h3 id="autonomy-people-title">{liveGovernance?.peopleExceptions.length ?? preview.peopleExceptions.surfaced.length} recorded people exceptions need review</h3></div><span>{liveGovernance ? "Action_Log + People · read-only" : `${preview.peopleExceptions.withheld.length} weak signals withheld`}</span></header>
      <ol className="autonomy-stage-path" aria-label="Governed people escalation path">
        <li data-state="complete"><span>01</span><strong>Coach / Counsel</strong><small>Evidence-led human support</small></li>
        <li data-state="current"><span>02</span><strong>Performance review</strong><small>Named human review</small></li>
        <li data-state="locked"><span>03</span><strong>Exit review</strong><small>HR/management + legal checks</small></li>
      </ol>
      {liveGovernance ? (liveGovernance.peopleExceptions.length ? liveGovernance.peopleExceptions.map((item) => <article className="autonomy-person-exception" key={String(item.id)}><div className="autonomy-person-heading"><BriefcaseBusiness aria-hidden /><div><span>{String(item.state)}</span><h4>{String(item.name)} · {String(item.role)}</h4><p>{String(item.id)}</p></div><strong>{String(item.evidence)} linked evidence refs</strong></div><div className="autonomy-person-evidence"><div><ClipboardCheck aria-hidden /><span>Governed reason</span><strong>{String(item.reason)}</strong></div><div><MessageSquare aria-hidden /><span>Decision boundary</span><strong>Named human review required</strong><small>No automatic employment, discipline, legal or external action.</small></div></div></article>) : <p className="readonly-note">No people-exception action is recorded in the connected Action_Log.</p>) : peopleException ? <article className="autonomy-person-exception">
        <div className="autonomy-person-heading"><BriefcaseBusiness aria-hidden /><div><span>{peopleException.stage}</span><h4>{peopleException.displayName} · {peopleException.role}</h4><p>{peopleException.metricId} · {peopleException.governedGoal}</p></div><strong>{peopleException.recurrenceCount} verified recurrences</strong></div>
        <dl><div><dt>Governed SLA</dt><dd>{peopleException.governedSla}</dd></div><div><dt>Prior bot reminders</dt><dd>{peopleException.priorBotReminders.length} retained</dd></div><div><dt>Prior counselling</dt><dd>{peopleException.priorCounselling.length} retained</dd></div><div><dt>Impact</dt><dd>{peopleException.impact}</dd></div></dl>
        <div className="autonomy-person-evidence"><div><ClipboardCheck aria-hidden /><span>Evidence history</span><strong>{peopleException.evidenceHistory.length} independently verified records</strong>{peopleException.evidenceHistory.map((ref) => <small key={ref}>{ref}</small>)}</div><div><MessageSquare aria-hidden /><span>Recommended next step</span><strong>{peopleException.recommendedNextStep}</strong><small>Named human approval required · no automatic discipline, termination, external message or employment decision</small></div></div>
      </article> : null}
      <div className="autonomy-withheld"><ShieldCheck aria-hidden /><div><strong>Single events and poor data stay out of the human surface.</strong><p>{liveGovernance ? "Only explicitly recorded Action_Log people exceptions are shown; no withheld count is inferred without a governed record." : preview.peopleExceptions.withheld.map((item) => `${item.reason}: ${item.recordedSignals}`).join(" · ")}</p><small>Missing or weak evidence never creates an automatic people decision.</small></div></div>
    </section>

    <section className="closed-loop-panel autonomy-comparison" aria-labelledby="autonomy-comparison-title">
      <header><div><p className="section-kicker">Decision Accuracy</p><h3 id="autonomy-comparison-title">Recommendations compared with outcomes</h3></div><span>{liveGovernance ? `${liveGovernance.decisions.length} completed of ${buildLiveApprovals(liveData).length} Approval_Log records` : `${evaluation.metrics.reviewedCount} reviews · agent ${evaluation.comparisons[0]?.recommendation.agentVersion}`}</span></header>
      {liveGovernance ? <div className="autonomy-calibration-strip" aria-label="Governed decision coverage"><span>Recorded approvals <strong>{buildLiveApprovals(liveData).length}</strong></span><span>Completed decisions <strong>{liveGovernance.decisions.length}</strong></span><span>Pending <strong>{buildLiveApprovals(liveData).filter((item) => item.pending).length}</strong></span><span>Verified actions <strong>{liveUrgency.verified.length}</strong></span><span>Source <strong>Sheet logs</strong></span></div> : <div className="autonomy-calibration-strip" aria-label="Shadow model quality"><span>Precision <strong>{percentage(evaluation.metrics.detectionPrecision)}</strong></span><span>Missed events <strong>{percentage(evaluation.metrics.missedEventRate)}</strong></span><span>Accepted / overridden <strong>{percentage(evaluation.metrics.acceptanceRate)} / {percentage(evaluation.metrics.overrideRate)}</strong></span><span>Median decision <strong>{minutes(evaluation.metrics.medianDecisionMinutes)}</strong></span><span>Audit complete <strong>{percentage(evaluation.metrics.auditCompleteness)}</strong></span></div>}
      <OperationalCardStack label="Recommendations compared with actual human decisions">{liveGovernance ? buildLiveApprovals(liveData).map((item) => <OperationalCard key={item.approvalId} title={item.title} domain={`${item.domain} · ${item.approvalId}`} status={item.decision} fields={[{ label: "Owner", value: item.owner }, { label: "Due", value: item.dueAt && Number.isFinite(Date.parse(item.dueAt)) ? date(item.dueAt) : "Not recorded" }, { label: "Expected result", value: item.expectedResult || "Not recorded" }, { label: "Linked action", value: item.linkedActionId || "Not recorded" }]} />) : evaluation.comparisons.map((item) => <OperationalCard key={item.recommendation.recommendationId} title={item.recommendation.title} domain={`${dashboardDisplayLabel(item.recommendation.domain)} · ${item.recommendation.recommendationId}`} status={item.disposition?.outcome ?? item.decision?.outcome ?? "Pending"} />)}</OperationalCardStack>
    </section>

    <section className="closed-loop-panel autonomy-readiness" aria-labelledby="autonomy-readiness-title">
      <header><div><p className="section-kicker">Autonomy Gate</p><h3 id="autonomy-readiness-title">Automatic execution is locked</h3></div><span>{liveGovernance ? `${liveGovernance.policies.length} Policy_Registry records` : `Registry v${preview.policies.mode.version}`}</span></header>
      <div className="autonomy-gate-grid">
        {liveGovernance ? ["precision", "reversal", "audit", "mode|kill"].map((pattern, index) => { const policy = liveGovernance.policies.find((item) => new RegExp(pattern, "i").test(`${item.id} ${item.name}`)); const labels = ["Accuracy threshold", "Reversal threshold", "Audit threshold", "Operating mode"]; return <article key={labels[index]}><FileLock2 aria-hidden /><span>{labels[index]}</span><strong>{policy?.value || "Not recorded"}</strong><small>{policy ? `${policy.id} · v${policy.version}` : "Policy_Registry has no matching record"}</small></article> }) : <><article><CircleGauge aria-hidden /><span>Accuracy threshold</span><strong>{String(preview.policies.minimumPrecision.value)}</strong><small>{preview.policies.minimumPrecision.policyId}@v{preview.policies.minimumPrecision.version}</small></article><article><RotateCcw aria-hidden /><span>Reversal threshold</span><strong>{String(preview.policies.maximumReversal.value)}</strong><small>{preview.policies.maximumReversal.policyId}@v{preview.policies.maximumReversal.version}</small></article><article><BadgeCheck aria-hidden /><span>Audit threshold</span><strong>{String(preview.policies.minimumAuditCompleteness.value)}</strong><small>{preview.policies.minimumAuditCompleteness.policyId}@v{preview.policies.minimumAuditCompleteness.version}</small></article><article><FileLock2 aria-hidden /><span>Operating mode</span><strong>{String(preview.policies.mode.value)}</strong><small>Kill switch: {String(preview.policies.killSwitch.value)}</small></article></>}
      </div>
      <div className="autonomy-lock-grid">
        <div><Ban aria-hidden /><span>Low risk</span><strong>Automatic execution blocked</strong><p>{liveGovernance ? "Read-only Sheet projection; no execution adapter or approved automatic-execution policy is recorded." : preview.readiness.lowRisk.reasons.join(" ")}</p><small>Policy evaluator only · execution adapter available: No</small></div>
        <div><UserCheck aria-hidden /><span>High risk</span><strong>Permanent human approval</strong><p>{liveGovernance ? "Named authority must be recorded in Policy_Registry or Approval_Log; no authority is inferred." : `${preview.readiness.highRisk.reasons[0]} Financial and commercial changes route to Pushkar; external, configuration and irreversible changes route to Sachin.`}</p><small>{liveGovernance ? "Governed Sheet authority only" : `${preview.policies.highRiskRule.policyId}@v${preview.policies.highRiskRule.version}`}</small></div>
      </div>
    </section>

    <section className="closed-loop-panel autonomy-feedback" aria-labelledby="autonomy-feedback-title">
      <header><div><p className="section-kicker">Learning Feedback</p><h3 id="autonomy-feedback-title">Disagreements and verification gaps</h3></div><span>{liveGovernance ? `${liveGovernance.feedback.length} Learning_History records` : `${filteredFeedback.length} of ${evaluation.feedback.length} shown`}</span></header>
      <div className="autonomy-feedback-filters" role="group" aria-label="Filter labelled feedback">
        {!liveGovernance ? filters.map((filter) => <button key={filter} type="button" aria-pressed={feedbackFilter === filter} onClick={() => setFeedbackFilter(filter)}>{filter}<span>{filter === "All feedback" ? evaluation.feedback.length : evaluation.feedback.filter((item) => item.label === filter).length}</span></button>) : <span>Connected Google Sheet · read-only</span>}
      </div>
      <OperationalCardStack label="Filtered autonomy feedback">{liveGovernance ? liveGovernance.feedback.map((item) => <OperationalCard key={item.id} title={item.summary} domain={item.domain} status={item.label} fields={[{ label: "Recorded", value: item.at && Number.isFinite(Date.parse(item.at)) ? date(item.at) : "Not recorded" }, { label: "Recommendation", value: item.recommendation }, { label: "Evidence", value: item.evidence }]} />) : filteredFeedback.map((item) => <OperationalCard key={item.feedbackId} title={item.summary} domain={dashboardDisplayLabel(item.domain)} status={item.label} fields={[{ label: "Recorded", value: date(item.recordedAt) }, { label: "Recommendation", value: item.recommendationId ?? "No recommendation" }, { label: "Signal", value: item.signalId ?? "False-positive review" }, { label: "Evidence", value: item.evidenceRef }]} />)}</OperationalCardStack>
    </section>

    <section className="closed-loop-panel autonomy-effectiveness" aria-labelledby="autonomy-effectiveness-title">
      <header><div><p className="section-kicker">System Performance</p><h3 id="autonomy-effectiveness-title">Verified outcomes and missing definitions</h3></div><span>Read-only</span></header>
      <div className="autonomy-scorecard-grid">{(liveGovernance?.scorecard ?? preview.systemScorecard).map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.source}</p><small className="written-status">{metric.status}</small></article>)}</div>
      <p className="readonly-note"><FileLock2 aria-hidden />Task and message counts are not primary success metrics. No metric on this screen can mutate an operating record, approve a high-risk action or enable automatic execution.</p>
    </section>
      </div>
    </details>
  </DashboardSectionAccordion>
}
