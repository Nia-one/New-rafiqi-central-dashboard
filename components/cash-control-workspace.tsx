"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, FileCheck2, Landmark, LockKeyhole, RefreshCcw, ShieldCheck, WalletCards } from "lucide-react"
import { rankChannelMix, recoverCashControlAction, verifyCashControlClosure, type CashControlPreview, type CashControlTaskPreview } from "@/lib/operating-loop/cash-control-loop"
import { buildLoopHealth, type LoopHealth, type LoopHealthFeedInput } from "@/lib/operating-loop/loop-health"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { buildLiveApprovals } from "@/lib/live-approvals"
import { aggregateLatestFinanceSnapshots, optionalSheetNumber as optionalNumberFor } from "@/lib/live-mappers/cash-control-finance"
import styles from "./cash-control-workspace.module.css"

type Props = { preview: CashControlPreview; liveData?: any }
type ShadowOutcome = "Unresolved" | "Evidence received" | "Failed evidence" | "Human approval required" | "Missed hour"

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function valueFor(row: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function numberFor(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`
}

function validTimestamp(value: unknown) {
  const text = String(value ?? "").trim()
  return text && Number.isFinite(Date.parse(text)) ? text : ""
}

function latestTimestamp(rows: readonly Record<string, unknown>[]) {
  return rows.flatMap((row) => ["updated at", "captured at", "reported at", "proposed at", "submitted at", "approved at", "uploaded at", "decided at", "verified at", "closed at", "logged at", "business date", "as of"].map((key) => validTimestamp(row[key])))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? ""
}

function isCashControlRow(row: Record<string, unknown>) {
  const actionId = valueFor(row, ["action id", "id"]).toLowerCase()
  const text = [
    valueFor(row, ["operating objective", "title"]),
    valueFor(row, ["expected metric"]),
    valueFor(row, ["required evidence"]),
  ].join(" ").toLowerCase()
  return actionId.startsWith("cc-") || ["cash", "collection", "opex", "monthly destination", "collected-cash", "finance_daily", "current due"].some((term) => text.includes(term))
}

function liveCashControlLoopHealth(liveData: any, fallback: LoopHealth) {
  const finance = Array.isArray(liveData?.finance) ? liveData.finance as Record<string, unknown>[] : []
  // Source health must remain visible when a dashboard filter has no matching
  // finance value rows. Financial values stay filter-scoped; freshness uses
  // the unfiltered Finance_Daily source retained by the live mapper.
  const financeSource = Array.isArray(liveData?.financeSource) ? liveData.financeSource as Record<string, unknown>[] : finance
  const allEvidence = Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : []
  const governedApprovals = buildLiveApprovals(liveData)
  const cashApprovals = governedApprovals.filter((approval) => approval.domain === "cash-control")
  const approvals = cashApprovals.map((approval) => approval.approvalRow)
  const terminalApprovalActionIds = new Set(governedApprovals.filter((approval) => approval.terminal).map((approval) => approval.linkedActionId).filter(Boolean))
  const actions = ((Array.isArray(liveData?.actions) ? liveData.actions : []).filter(isCashControlRow) as Record<string, unknown>[]).filter((row) => valueFor(row, ["state", "status"]).toLowerCase() !== "dismissed" && !terminalApprovalActionIds.has(valueFor(row, ["action id", "id"])))
  const actionIds = new Set([...actions.map((row) => valueFor(row, ["action id", "id"])), ...cashApprovals.map((approval) => approval.linkedActionId)].filter(Boolean))
  const proofEvidenceIds = new Set(actions.map((row) => valueFor(row, ["proof evidence id"])).filter(Boolean))
  const evidence = allEvidence.filter((row) => actionIds.has(valueFor(row, ["linked id"])) || proofEvidenceIds.has(valueFor(row, ["evidence id", "id"])))
  const asOf = validTimestamp(liveData?.asOf) || latestTimestamp([...financeSource, ...actions, ...evidence, ...approvals])
  if (!liveData || !asOf) return { health: fallback, connected: false }

  const feeds: LoopHealthFeedInput[] = []
  if (financeSource.length) feeds.push({ feedId: "finance-daily", label: "Finance Daily · Cash & Control ledger", lastUpdatedAt: latestTimestamp(financeSource) || asOf, cadenceMinutes: 1440, critical: true, affectedClaims: ["cash balance", "opex", "collection leakage"] })
  if (actions.length) feeds.push({ feedId: "action-log", label: "Action Log · financial controls", lastUpdatedAt: latestTimestamp(actions) || asOf, cadenceMinutes: 240, critical: true, affectedClaims: ["financial actions", "closure integrity"] })
  if (evidence.length) feeds.push({ feedId: "evidence-log", label: "Evidence Log · outcome verification", lastUpdatedAt: latestTimestamp(evidence) || asOf, cadenceMinutes: 1440, critical: false, affectedClaims: ["outcome verification"] })
  if (approvals.length) feeds.push({ feedId: "approval-log", label: "Approval Log · financial decisions", lastUpdatedAt: latestTimestamp(approvals) || asOf, cadenceMinutes: 1440, critical: false, affectedClaims: ["approval status"] })

  const stateOf = (row: Record<string, unknown>) => valueFor(row, ["state", "status"]).toLowerCase()
  const verified = actions.filter((row) => stateOf(row) === "verified").length
  const reopened = actions.filter((row) => stateOf(row) === "reopened").length
  const awaitingRows = actions.filter((row) => !["verified", "reopened", "dismissed"].includes(stateOf(row)))
  const oldestAwaitingAt = awaitingRows.flatMap((row) => [validTimestamp(row["proposed at"]), validTimestamp(row["updated at"]), validTimestamp(row["due at"])])
    .filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
  const clocks = awaitingRows.map((row, index) => ({
    clockId: valueFor(row, ["action id", "id"]) || `cash-action-${index}`,
    label: valueFor(row, ["operating objective", "expected metric", "title"]) || "Financial action",
    ownerRole: valueFor(row, ["owner actor id", "owner"]) || "Unassigned",
    dueAt: validTimestamp(row["due at"]),
    state: "Running" as const,
  })).filter((clock) => clock.dueAt)

  return { connected: feeds.length > 0, health: buildLoopHealth({
    asOf,
    feeds,
    clocks,
    verification: {
      claimed: actions.length,
      verified,
      awaiting: awaitingRows.length,
      reopened,
      // With incomplete Action Log rows, the connected Sheet snapshot is the
      // only truthful observation time available for an awaiting action.
      oldestAwaitingAt: oldestAwaitingAt ?? (awaitingRows.length > 0 ? asOf : null),
    },
    quarantinedRecords: 0,
  }) }
}

function ControlPath({ path }: { path: CashControlPreview["controlPath"] }) {
  return <ol className={styles.controlPath} aria-label="Cash and Control monthly command path">
    {path.map((step, index) => <li data-control-state={step.state} key={step.id}>
      <span>{index + 1}</span>
      <div><strong>{step.label}</strong><small>{step.value}</small></div>
    </li>)}
  </ol>
}

function FinancialRail({ rail }: { rail: CashControlPreview["financialRails"][number] }) {
  return <article className={styles.financialRail} data-rail-id={rail.id}>
    <header><div><span>{rail.label}</span><strong>{rail.value}</strong></div><b>{rail.state}</b></header>
    <div className={styles.railTrack} aria-label={`${rail.label}: ${rail.value}; control ${rail.threshold}`}><i style={{ width: `${rail.progressPct}%` }} /></div>
    <small>{rail.threshold}</small>
  </article>
}

export function CashControlWorkspace({ preview: fixturePreview, liveData }: Props) {
  const financeRows = Array.isArray(liveData?.finance) ? liveData.finance as Record<string, unknown>[] : []
  const finance = aggregateLatestFinanceSnapshots(financeRows)
  const content = (component: string, key: string, fallback: string) => liveData?.dashboardContent?.find((row: Record<string, unknown>) => String(row.page || "") === "Cash & Control" && String(row.component || "") === component && String(row.key || "") === key)?.value || fallback
  const approvalRows = Array.isArray(liveData?.approvals) ? liveData.approvals as Record<string, unknown>[] : []
  const actionRows = Array.isArray(liveData?.actions) ? liveData.actions as Record<string, unknown>[] : []
  const evidenceRows = Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : []
  const learningHistoryRows = Array.isArray(liveData?.learningHistory) ? liveData.learningHistory as Record<string, unknown>[] : []
  const governedApprovals = buildLiveApprovals(liveData)
  const cashApprovalRegistry = governedApprovals.filter((approval) => approval.domain === "cash-control")
  const destinationApproval = [...approvalRows].filter((row) => {
    const text = Object.values(row).join(" ").toLowerCase()
    return text.includes("monthly cash destination") || text.includes("monthly collected-cash target")
  }).sort((a, b) => Date.parse(latestTimestamp([b]) || "1970-01-01") - Date.parse(latestTimestamp([a]) || "1970-01-01"))[0]
  const linkedDestinationActionId = valueFor(destinationApproval || {}, ["linked action id"])
  const destinationAction = actionRows.find((row) => valueFor(row, ["action id", "id"]) === linkedDestinationActionId)
  const approvalDecision = valueFor(destinationApproval || {}, ["decision"]).toLowerCase()
  const financeDestinationDecision = valueFor(finance || {}, ["destination approved"]).toLowerCase()
  const destinationApproved = ["approved", "approve", "accepted"].includes(approvalDecision) || ["yes", "true", "approved", "approve"].includes(financeDestinationDecision)
  const targetValue = optionalNumberFor(destinationApproval?.["amount inr"]) ?? optionalNumberFor(finance?.["cash target inr"])
  const currentValue = optionalNumberFor(finance?.["cash balance inr"])
  const opexForecastValue = optionalNumberFor(finance?.["opex forecast inr"])
  const opexCapValue = optionalNumberFor(finance?.["opex cap inr"])
  const currentDueValue = optionalNumberFor(finance?.["current due inr"])
  const totalBilledValue = optionalNumberFor(finance?.["total billed inr"])
  const totalCollectedValue = optionalNumberFor(finance?.["total collected inr"])
  const leakageValue = currentDueValue ?? (totalBilledValue !== null && totalCollectedValue !== null ? Math.max(0, totalBilledValue - totalCollectedValue) : null)
  const target = targetValue ?? 0
  const current = currentValue ?? 0
  const opexForecast = opexForecastValue ?? 0
  const opexCap = opexCapValue ?? 0
  const leakage = leakageValue ?? 0
  const ownerActorId = valueFor(destinationAction || {}, ["owner actor id", "owner"]) || valueFor(destinationApproval || {}, ["approver actor id"]) || valueFor(finance || {}, ["destination owner actor id"])
  const owner = liveData?.people?.find((person: Record<string, unknown>) => String(person["actor id"] || "").trim() === ownerActorId)?.["display name"] || ownerActorId || (liveData ? "Owner not recorded" : fixturePreview.summary.owner)
  const liveLoop = liveCashControlLoopHealth(liveData, fixturePreview.loopHealth)
  const loopHealth = liveLoop.health
  const cashStatus = String(finance?.["cash guardrail status"] || "").trim().toLowerCase()
  const cashProtected = ["protected", "within control", "passed", "healthy"].includes(cashStatus)
  const cashAtRisk = ["breached", "at risk", "failed"].includes(cashStatus)
  const cashGuardrailLabel = cashProtected ? "Cash protected" : cashAtRisk ? "Cash at risk" : cashStatus ? `Cash guardrail status ${cashStatus}` : "Cash guardrail not recorded"
  const cmActualValue = optionalNumberFor(finance?.["cm2 inr"])
  const monthlyCmTargetValue = optionalNumberFor(finance?.["cm target inr"]) ?? optionalNumberFor(liveData?.monthlyCMTarget)
  const cmActual = cmActualValue ?? 0
  const monthlyCmTarget = monthlyCmTargetValue ?? 0
  const cashGapValue = targetValue !== null && currentValue !== null ? Math.max(0, targetValue - currentValue) : null
  const cmGapValue = monthlyCmTargetValue !== null && cmActualValue !== null ? Math.max(0, monthlyCmTargetValue - cmActualValue) : null
  const cashGap = cashGapValue ?? 0
  const cmGap = cmGapValue ?? 0
  const opexWithinCap = opexForecastValue !== null && opexCapValue !== null ? opexForecastValue <= opexCapValue : null
  const liveClosureCounts: CashControlPreview["closureCounts"] = {
    claimed: loopHealth.verification.claimed,
    verified: loopHealth.verification.verified,
    awaitingVerification: loopHealth.verification.awaiting,
    reopened: loopHealth.verification.reopened,
  }
  const liveChannelRows = (Array.isArray(liveData?.channels) ? liveData.channels : []).filter((row: Record<string, unknown>) => !["no", "false", "inactive"].includes(valueFor(row, ["active"]).toLowerCase()))
  const liveChannelRecommendations = rankChannelMix(liveChannelRows.map((row: Record<string, unknown>, index: number) => ({
    candidateId: valueFor(row, ["candidate id", "id"]) || `cash-channel-${index}`,
    channel: valueFor(row, ["channel", "channel name"]) || "Unnamed channel",
    expectedVerifiedCmInr: numberFor(row["expected verified cm inr"]),
    requiredCashInr: numberFor(row["required cash inr"]),
    expectedHoursToOutcome: numberFor(row["expected hours to outcome"]),
    evidenceRef: valueFor(row, ["evidence ref", "evidence reference"]) || null,
    dataFreshness: valueFor(row, ["data freshness"]) === "Current" ? "Current" as const : valueFor(row, ["data freshness"]) === "Quarantined" ? "Quarantined" as const : "Stale" as const,
    independentlyVerified: ["yes", "true", "verified"].includes(valueFor(row, ["independently verified"]).toLowerCase()),
    quarantined: ["yes", "true"].includes(valueFor(row, ["quarantined"]).toLowerCase()),
  })))
  const cashLearningHistory = learningHistoryRows.filter((row) => /cash|finance/i.test(valueFor(row, ["domain"])))
  const liveLearningInputs = cashLearningHistory.length > 0
    ? cashLearningHistory.map((row, index) => ({
        id: valueFor(row, ["recommendation id", "id"]) || `cash-learning-${index}`,
        proposal: valueFor(row, ["proposed_change", "proposed change"]) || "No proposal recorded",
        expectedEffect: valueFor(row, ["expected_effect", "expected effect"]) || "No expected effect recorded",
        evidence: valueFor(row, ["observed", "evidence summary"]) || "No evidence summary recorded",
        attribution: valueFor(row, ["attribution"]) || "Attribution not recorded",
        forecastError: "Not separately recorded in Learning_History",
        freshness: `Sheet record · ${valueFor(row, ["disposition"]) || "disposition not recorded"}`,
        approvedBoundary: valueFor(row, ["disposition"]) || "Approval boundary not recorded",
        humanControls: valueFor(row, ["domain"]) || "Cash & Control",
        effects: valueFor(row, ["expected_effect", "expected effect"]) || "No effect recorded",
        materiality: `${valueFor(row, ["disposition"]) || "No disposition"} · ${valueFor(row, ["confidence"]) || "confidence not recorded"}`,
        adoption: "Automatically gated by the recorded disposition; no duplicate Operations input",
      }))
    : cashApprovalRegistry.map((approval) => {
        const action = approval.actionRow || {}
        const relatedEvidence = evidenceRows.filter((row) => valueFor(row, ["linked id"]) === approval.linkedActionId || valueFor(row, ["evidence id"]) === valueFor(action, ["proof evidence id"]))
        const verifiedEvidence = relatedEvidence.filter((row) => /verified|accepted/i.test(valueFor(row, ["verification status", "status"]))).length
        return {
          id: approval.approvalId,
          proposal: approval.proposedTerms || approval.title,
          expectedEffect: approval.expectedResult || valueFor(action, ["expected metric"]) || "No expected effect recorded",
          evidence: `${valueFor(action, ["required evidence"]) || "Evidence requirement not recorded"} · ${verifiedEvidence}/${relatedEvidence.length} linked evidence verified`,
          attribution: `Approval_Log ${approval.approvalId} · Action_Log ${approval.linkedActionId || "link not recorded"}`,
          forecastError: "Not separately recorded for this governed decision",
          freshness: `${liveLoop.connected ? "Connected Sheet record" : "Source unavailable"} · ${approval.decidedAt ? `updated ${date(approval.decidedAt)}` : "update time not recorded"}`,
          approvedBoundary: `${approval.decision} · auto-adoption blocked until authorised decision`,
          humanControls: `${valueFor(approval.approvalRow, ["approver role"]) || "Approver role not recorded"} · owner ${approval.owner}`,
          effects: `${approval.amountInr ? inr(approval.amountInr) : "No monetary amount"} · ${valueFor(action, ["expected metric"]) || "metric not recorded"} ${valueFor(action, ["target value"]) ? `target ${valueFor(action, ["target value"])}` : ""}`.trim(),
          materiality: `${approval.decision} · ${valueFor(action, ["confidence"]) || "confidence not recorded"}`,
          adoption: `Auto-adopt false · ${valueFor(action, ["reopen reason"]) || approval.decisionReason || "authorised decision required"}`,
        }
      })
  const liveMeasures: CashControlPreview["measures"] = [
    { id: "cm-destination", label: "CM destination", value: destinationApproved && monthlyCmTargetValue !== null ? inr(monthlyCmTarget) : "Pending approval", target: `${monthlyCmTargetValue !== null ? `Proposed ${inr(monthlyCmTarget)} · ` : ""}${cmActualValue !== null ? `Current CM2 ${inr(cmActual)}` : "Current CM2 not recorded"}`, detail: destinationApproved ? cmGapValue !== null ? `${inr(cmGap)} CM remaining against the approved monthly destination.` : "Remaining CM cannot be calculated until target and actual are recorded." : "The CM destination exists in Dashboard_Overview but remains locked until authorised approval." },
    { id: "opex-control", label: "Opex control", value: opexForecastValue !== null ? `${inr(opexForecast)} forecast` : "Forecast not recorded", target: opexCapValue !== null ? `${inr(opexCap)} cap` : "Cap not recorded", detail: opexWithinCap !== null ? `${inr(Math.abs(opexCap - opexForecast))} ${opexWithinCap ? "headroom" : "over cap"}.` : "Opex control requires both forecast and approved cap." },
    { id: "cash-protection", label: "Cash protection", value: currentValue !== null ? `${inr(current)} balance` : "Balance not recorded", target: targetValue !== null ? `${inr(target)} target` : "Target not recorded", detail: `${cashGuardrailLabel} per Finance_Daily.` },
    { id: "closure-integrity", label: "Leakage & closure", value: leakageValue !== null ? `${inr(leakage)} leakage` : "Leakage not recorded", target: `${liveClosureCounts.verified} verified · ${liveClosureCounts.claimed} claimed`, detail: `${liveClosureCounts.awaitingVerification} awaiting verification · ${liveClosureCounts.reopened} reopened.` },
  ]
  const liveControlPath: CashControlPreview["controlPath"] = [
    { id: "destination", label: "Monthly destination", value: destinationApproved && monthlyCmTargetValue !== null ? `${inr(monthlyCmTarget)} approved` : monthlyCmTargetValue !== null ? `${inr(monthlyCmTarget)} pending human approval` : "No CM destination recorded", state: destinationApproved && monthlyCmTargetValue !== null ? "Complete" : "Pending" },
    { id: "baseline", label: "Verified baseline", value: cmActualValue !== null ? `${inr(cmActual)} CM2 reported` : "CM2 not recorded", state: cmActualValue !== null ? "Complete" : "Pending" },
    { id: "gap", label: "Remaining gap", value: destinationApproved ? cmGapValue !== null ? inr(cmGap) : "Not recorded" : "Unavailable until destination approval", state: destinationApproved && cmGapValue !== null ? "Complete" : "Pending" },
    { id: "mix", label: "Channel recommendation", value: liveChannelRecommendations.length ? `${liveChannelRecommendations.length} evidence-eligible options ranked` : "No verified channel option available", state: liveChannelRecommendations.length ? "Complete" : "Pending" },
    { id: "feasibility", label: "Cash feasibility", value: `${cashGuardrailLabel} from Finance_Daily`, state: cashProtected || cashAtRisk ? "Complete" : "Pending" },
    { id: "cascade", label: "Cascade", value: destinationApproved ? "Unlocked" : "Blocked until approval", state: destinationApproved ? "Complete" : "Blocked" },
    { id: "recovery", label: "Hourly recovery", value: `${liveClosureCounts.awaitingVerification} actions awaiting verification`, state: liveClosureCounts.awaitingVerification ? "Pending" : "Complete" },
    { id: "month-close", label: "Month close", value: liveClosureCounts.reopened ? `${liveClosureCounts.reopened} reopened actions remain` : "No reopened financial actions", state: liveClosureCounts.reopened ? "Pending" : "Complete" },
  ]
  const liveFinancialRails: CashControlPreview["financialRails"] = [
    { id: "opex", label: "Opex forecast", value: opexForecastValue !== null ? inr(opexForecast) : "Not recorded", threshold: opexCapValue !== null ? `${inr(opexCap)} cap` : "Cap not recorded", progressPct: opexForecastValue !== null && opexCapValue ? Math.min(100, Math.round(opexForecast / opexCap * 100)) : 0, state: opexWithinCap === null ? "Pending" : opexWithinCap ? "Within control" : "Over control" },
    { id: "cash", label: "Cash balance", value: currentValue !== null ? inr(current) : "Not recorded", threshold: targetValue !== null ? `${inr(target)} target` : "Target not recorded", progressPct: currentValue !== null && targetValue ? Math.min(100, Math.round(current / target * 100)) : 0, state: cashProtected ? "Protected" : cashAtRisk ? "At risk" : "Pending" },
  ]
  const terminalApprovalActionIds = new Set(governedApprovals.filter((approval) => approval.terminal).map((approval) => approval.linkedActionId).filter(Boolean))
  const liveOpenTasks: readonly CashControlTaskPreview[] = actionRows.filter((row) => isCashControlRow(row) && !["verified", "closed", "dismissed"].includes(valueFor(row, ["state", "status"]).toLowerCase()) && !terminalApprovalActionIds.has(valueFor(row, ["action id", "id"]))).map((row, index) => {
    const template = fixturePreview.tasks[index % fixturePreview.tasks.length]
    const actionId = valueFor(row, ["action id", "id"]) || `cash-action-${index}`
    const rowState = valueFor(row, ["state", "status"])
    const stateText = rowState.toLowerCase()
    const state: CashControlTaskPreview["state"] = stateText === "reopened" ? "Reopened" : stateText.includes("proof") || stateText.includes("verification") ? "Awaiting verification" : stateText.includes("proposed") || stateText.includes("approval") ? "Awaiting approval" : "Assigned"
    const taskOwnerId = valueFor(row, ["owner actor id", "owner"])
    const taskOwner = liveData?.people?.find((person: Record<string, unknown>) => valueFor(person, ["actor id"]) === taskOwnerId)?.["display name"] || taskOwnerId || "Owner not recorded"
    const expectedMetric = valueFor(row, ["expected metric"])
    const targetValue = valueFor(row, ["target value"])
    const expectedVerifiedResult = [expectedMetric, targetValue ? `target ${targetValue}` : ""].filter(Boolean).join(" · ") || "Expected result not recorded"
    return {
      ...template,
      actionId,
      issue: valueFor(row, ["operating objective", "title"]) || "Financial control action",
      owner: String(taskOwner),
      dueAt: validTimestamp(row["due at"]),
      progress: rowState || "Open",
      expectedVerifiedResult,
      verifiedResult: valueFor(row, ["verification result"]) || (state === "Reopened" ? valueFor(row, ["reopen reason"]) || "Reopened for correction" : "Independent verification pending"),
      state,
      engineAction: { ...template.engineAction, actionId, eventId: valueFor(row, ["incident id"]) || actionId, idempotencyKey: actionId, ownerRole: String(taskOwner), dueAt: validTimestamp(row["due at"]), expectedVerifiedResult, nextAction: valueFor(row, ["required evidence"]) || valueFor(row, ["operating objective"]) || "Required action not recorded", state: state === "Awaiting verification" ? "Evidence pending" : state },
      verificationInput: { ...template.verificationInput, evidenceRef: valueFor(row, ["proof evidence id"]) || null, measuredOutcomeVerified: stateText === "verified", sourceMetricRecovered: stateText === "verified" },
    }
  })
  const liveApprovalCards = governedApprovals.filter((approval) => approval.domain === "cash-control" && approval.pending).map((approval) => ({
    id: approval.approvalId,
    decision: approval.title,
    owner: approval.owner,
    dueAt: approval.dueAt,
    amountInr: approval.amountInr,
    currentTerms: approval.currentTerms || "Current terms not recorded",
    expectedResult: approval.expectedResult || "Expected result not recorded",
    decisionReason: approval.decisionReason || "Decision note not recorded",
    nextAction: approval.action,
    status: "Pending human approval" as const,
  }))
  const cashActionIds = new Set([
    ...cashApprovalRegistry.map((approval) => approval.linkedActionId),
    ...actionRows.filter(isCashControlRow).map((row) => valueFor(row, ["action id", "id"])),
  ].filter(Boolean))
  const liveAuditEvents = Array.from(new Map([
    ...cashApprovalRegistry.map((approval) => ({
      id: `approval-${approval.approvalId}`,
      type: "Approval",
      state: approval.decision,
      detail: `${approval.title} · ${approval.owner}`,
      at: approval.decidedAt,
    })),
    ...actionRows.filter((row) => cashActionIds.has(valueFor(row, ["action id", "id"]))).map((row) => ({
      id: `action-${valueFor(row, ["action id", "id"])}`,
      type: "Action",
      state: valueFor(row, ["state", "status"]) || "State not recorded",
      detail: valueFor(row, ["operating objective", "title"]) || "Action detail not recorded",
      at: latestTimestamp([row]),
    })),
    ...evidenceRows.filter((row) => cashActionIds.has(valueFor(row, ["linked id"]))).map((row) => ({
      id: `evidence-${valueFor(row, ["evidence id", "id"])}`,
      type: "Evidence",
      state: valueFor(row, ["verification status", "status"]) || "Verification not recorded",
      detail: valueFor(row, ["description", "evidence type"]) || "Evidence detail not recorded",
      at: latestTimestamp([row]),
    })),
  ].map((entry) => [entry.id, entry] as const)).values())
    .sort((left, right) => Date.parse(right.at || "1970-01-01") - Date.parse(left.at || "1970-01-01"))
  const preview: CashControlPreview = {
    ...fixturePreview,
    headline: liveData ? currentValue !== null ? `Live cash balance is ₹${current.toLocaleString("en-IN")} against the current finance plan.` : "Live cash balance is not recorded in the current finance snapshot." : fixturePreview.headline,
    summary: { ...fixturePreview.summary, target: targetValue !== null ? `${inr(target)} cash target` : "Cash target not recorded", current: currentValue !== null ? `${inr(current)} cash` : "Cash balance not recorded", gap: cashGapValue !== null ? inr(cashGap) : "Gap not available", owner, progress: currentValue !== null && targetValue ? `${Math.min(100, Math.round(current / target * 100))}%` : "No data", verifiedResult: `${loopHealth.verification.verified} verified financial actions` },
    measures: liveData ? liveMeasures : fixturePreview.measures,
    controlPath: liveData ? liveControlPath : fixturePreview.controlPath,
    financialRails: liveData ? liveFinancialRails : fixturePreview.financialRails,
    closureCounts: liveData ? liveClosureCounts : fixturePreview.closureCounts,
    channelRecommendations: liveData ? liveChannelRecommendations : fixturePreview.channelRecommendations,
    tasks: liveData ? liveOpenTasks : fixturePreview.tasks,
    loopHealth,
  }
  const [tasks, setTasks] = useState<readonly CashControlTaskPreview[]>(preview.tasks)
  const approvalCards = liveData ? liveApprovalCards : fixturePreview.approvals.map((approval) => ({ ...approval, dueAt: "", amountInr: 0, currentTerms: "Current terms not recorded", expectedResult: approval.impact, decisionReason: "Decision note not recorded", nextAction: approval.impact }))
  const [selected, setSelected] = useState<Record<string, ShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, ShadowOutcome>)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; outcome: ShadowOutcome; route: string; at: string }[]>([])
  const taskFingerprint = preview.tasks.map((task) => `${task.actionId}:${task.state}:${task.progress}:${task.verifiedResult}`).join("|")

  useEffect(() => {
    setTasks(preview.tasks)
  }, [taskFingerprint])

  function recordShadowOutcome(task: CashControlTaskPreview) {
    const outcome = selected[task.actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const recovered = outcome === "Unresolved" ? task.engineAction : recoverCashControlAction(task.engineAction, outcome)
    const verificationInput = outcome === "Failed evidence"
      ? { ...task.verificationInput, evidenceRef: null, measuredOutcomeVerified: false, sourceMetricRecovered: false }
      : task.verificationInput
    const verification = verifyCashControlClosure(verificationInput)
    const route = outcome === "Unresolved" ? recovered.nextAction : `${recovered.nextAction} ${verification.reasons[0] ?? "Independent verification passed."}`
    setTasks((current) => current.map((row) => row.actionId !== task.actionId ? row : {
      ...row,
      progress: outcome,
      verifiedResult: verification.canClose ? "Independently verified" : verification.status,
      state: outcome === "Evidence received" ? "Awaiting verification" : recovered.state,
      recommendationOnly: recovered.recommendationOnly,
      engineAction: recovered,
    }))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${task.actionId}-${Date.parse(at)}`, actionId: task.actionId, outcome, route, at })])
  }

  const verdictLabel = `${cashGuardrailLabel} · ${destinationApproved ? "destination approved" : "destination needs approval"}`
  const decisionDueAt = liveData ? validTimestamp(destinationAction?.["due at"] || finance?.["decision due at"]) : preview.tasks[0].dueAt
  const decisionDue = decisionDueAt ? date(decisionDueAt) : "No deadline recorded"
  const staleFeeds = loopHealth.feeds.filter((feed) => feed.stale)
  const oldestFeed = [...loopHealth.feeds].sort((a, b) => b.ageMinutes - a.ageMinutes)[0]
  const freshnessSummary = liveLoop.connected
    ? `Google Sheet refresh ${date(loopHealth.asOf)} · ${loopHealth.feeds.length} connected feeds · ${staleFeeds.length} stale`
    : "Finance_Daily and governed Cash & Control logs are not connected"
  const controlPathImplicationSummary = destinationApproved
    ? content("control_path_implication", "approved_summary", "The approved target remains governed and the cascade is unlocked.")
    : content("control_path_implication", "pending_summary", "The proposed target cannot activate silently.")
  const controlPathImplicationDetail = destinationApproved
    ? content("control_path_implication", "approved_detail", "The destination is approved, the remaining CM gap is available, and the governed cascade can proceed.")
    : content("control_path_implication", "pending_detail", "The destination and remaining gap stay pending, so the cascade cannot start until a human approves the monthly target.")
  const topChannel = preview.channelRecommendations[0]
  const channelImplicationSummary = !topChannel
    ? "No evidence-eligible channel is currently available."
    : destinationApproved
      ? content("channel_implication", "approved_summary", `${preview.channelRecommendations.length} verified channels are available for human selection.`)
      : content("channel_implication", "pending_summary", "No allocation is imposed before destination approval.")
  const channelImplicationDetail = !topChannel
    ? "No current, independently verified channel passed the evidence rules, so no recommendation can be made."
    : destinationApproved
      ? content("channel_implication", "approved_detail", "The destination is approved; choose from the evidence-ranked channels without imposing a fixed split.")
      : content("channel_implication", "pending_detail", "The top-ranked verified channel remains a recommendation; approve the destination before choosing the mix.")
  const decisionHeading = destinationApproved
    ? `Monitor the approved ${monthlyCmTargetValue !== null ? `${inr(monthlyCmTarget)} monthly CM destination` : "monthly CM destination not recorded"} and ${targetValue !== null ? `${inr(target)} collected-cash target` : "collected-cash target not recorded"}.`
    : `Approve the ${monthlyCmTargetValue !== null ? `${inr(monthlyCmTarget)} monthly CM destination` : "monthly CM destination not recorded"} and ${targetValue !== null ? `${inr(target)} collected-cash target` : "collected-cash target not recorded"}.`
  const decisionDetail = destinationApproved
    ? `${cashGuardrailLabel}. The governed cascade is unlocked; ${cmGapValue !== null ? `${inr(cmGap)} CM` : "the CM gap is not recorded"} and ${cashGapValue !== null ? `${inr(cashGap)} cash` : "the cash gap is not recorded"} remain against the recorded targets, with accountability held by ${owner}.`
    : `${cashGuardrailLabel}. ${cmGapValue !== null ? `The ${inr(cmGap)} CM gap` : "The CM gap is not available"} and ${cashGapValue !== null ? `${inr(cashGap)} cash gap` : "the cash gap is not available"} remain locked until Approval_Log records an authorised decision; accountability currently sits with ${owner}.`
  const openTaskCount = tasks.length
  const awaitingEvidenceCount = liveClosureCounts.awaitingVerification
  const reopenedCount = liveClosureCounts.reopened
  const recoverySummary = `${openTaskCount} open financial ${openTaskCount === 1 ? "action rolls" : "actions roll"} forward; ${awaitingEvidenceCount} ${awaitingEvidenceCount === 1 ? "awaits" : "await"} verification and ${reopenedCount} ${reopenedCount === 1 ? "is" : "are"} reopened.`
  const recoveryDetail = `${openTaskCount} open financial ${openTaskCount === 1 ? "action moves" : "actions move"} into the remaining run rate; the ${monthlyCmTargetValue !== null ? `${inr(monthlyCmTarget)} monthly CM target` : "monthly CM target is not recorded and"} remains ${destinationApproved ? "approved" : "pending approval"}. ${awaitingEvidenceCount} ${awaitingEvidenceCount === 1 ? "claim remains" : "claims remain"} open for independent evidence${reopenedCount ? `, and ${reopenedCount} ${reopenedCount === 1 ? "reopened action remains" : "reopened actions remain"} unresolved` : ""}.`

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Cash and Control sections" sections={[
    { title: "Recommendation", summary: verdictLabel },
    { title: "Loop health", summary: `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` },
    { title: "Data freshness", summary: freshnessSummary },
    { title: "Monthly command", summary: `${preview.summary.owner} owns the destination decision` },
    { title: "Target to result", summary: `${preview.summary.current} current · ${preview.summary.gap} gap` },
    { title: "Headline measures", summary: `${preview.measures.length} Sheet-driven financial controls at a glance` },
    { title: "Control implication", summary: `${cashGuardrailLabel}; ${destinationApproved ? "the approved destination unlocks the cascade" : "destination approval still blocks the cascade"}.` },
    { title: "Monthly control path", summary: `${preview.closureCounts.verified}/${preview.closureCounts.claimed} closures verified` },
    { title: "Control path implication", summary: controlPathImplicationSummary },
    { title: "Channel recommendation", summary: `${preview.channelRecommendations.length} evidence-ranked options · recommendation only` },
    { title: "Channel implication", summary: channelImplicationSummary },
    { title: "Open work", summary: `${tasks.length} Sheet-backed command task${tasks.length === 1 ? "" : "s"} remain open` },
    { title: "Human approvals", summary: `${approvalCards.length} financial decision${approvalCards.length === 1 ? " requires" : "s require"} named authority` },
    { title: "Background record", summary: liveData ? `${liveAuditEvents.length} Sheet audit events · governed controls retained` : `${audit.length} local shadow events · governed controls retained` },
    { title: "Decision required", summary: `Owner ${preview.summary.owner} · due ${decisionDue}` },
    { title: "Recovery rule", summary: recoverySummary },
    { title: "Source and confidence", summary: liveLoop.connected ? `Finance_Daily and governed logs · refreshed ${date(loopHealth.asOf)}` : `${preview.source.name} · Production confidence Low` },
  ]}>
    <section className={styles.decision} data-state={cashProtected ? "protected" : "at-risk"} aria-label="Cash and Control recommendation">
      <div className={styles.decisionMain}>
        <p className={styles.stepLabel}><span>Recommendation</span>Cash &amp; Control · {preview.summary.owner}</p>
        <p className={styles.governing}>{preview.headline}</p>
        <dl className={styles.scqa}>
          <div><dt>Why you&apos;re here</dt><dd>{content("recommendation", "why_here", "Decide the monthly CM destination and collected-cash target so RafiQi can compute the remaining gap and cascade.")}</dd></div>
          <div><dt>Where we are</dt><dd>{preview.summary.current} · {opexForecastValue !== null ? `${inr(opexForecast)} opex forecast` : "opex forecast not recorded"}{opexCapValue !== null ? ` vs ${inr(opexCap)} cap` : " · cap not recorded"}.</dd></div>
          <div><dt>What changed</dt><dd>{destinationApproved ? "The destination is approved" : "No approved destination exists"}, with {leakageValue !== null ? `${inr(leakage)} collection leakage` : "collection leakage not recorded"}, {loopHealth.verification.awaiting} awaiting and {loopHealth.verification.reopened} reopened financial actions.</dd></div>
        </dl>
      </div>
      <div className={styles.decisionAside}>
        <b className={styles.verdictPill} data-state={cashProtected ? "protected" : "at-risk"}>{verdictLabel}</b>
        <p className={styles.askInline}>{destinationApproved ? content("recommendation", "approved_ask", "The approved destination is active; the system can track the remaining gap.") : content("recommendation", "pending_ask", "Approve the destination and cash target to unlock the cascade; leave them pending and they stay locked.")}</p>
        <dl className={styles.askMetaTop}><div><dt>Decision by</dt><dd><time dateTime={decisionDueAt}>{decisionDue}</time></dd></div></dl>
      </div>
    </section>

    <LoopHealthStrip health={loopHealth} />
    <section className={styles.freshnessPanel} aria-label="Cash and Control data freshness details">
      <div className={styles.freshness} role="status"><AlertTriangle aria-hidden /><strong>{liveLoop.connected ? staleFeeds.length ? `${staleFeeds.length} connected source${staleFeeds.length === 1 ? " is" : "s are"} stale` : "Google Sheet sources current" : "Required Sheet feeds not connected"}</strong><span>{liveLoop.connected ? `Sheet snapshot ${date(loopHealth.asOf)} · ${loopHealth.feeds.length} connected feeds${oldestFeed ? ` · oldest ${oldestFeed.label} ${oldestFeed.ageLabel}` : ""}` : "Finance_Daily has no production row; governed cash logs are not available"}</span><b>{liveLoop.connected ? `${loopHealth.verification.claimed} financial outcomes tracked` : "Financial outcomes cannot be verified"}</b></div>
      <div className={styles.freshnessFeeds}>
        {loopHealth.feeds.map((feed) => <article key={feed.feedId} data-stale={feed.stale}>
          <header><strong>{feed.label}</strong><b>{feed.stale ? "Stale" : "Current"}</b></header>
          <dl>
            <div><dt>Last source update</dt><dd><time dateTime={feed.lastUpdatedAt}>{date(feed.lastUpdatedAt)}</time></dd></div>
            <div><dt>Age</dt><dd>{feed.ageLabel}</dd></div>
            <div><dt>Expected cadence</dt><dd>Every {feed.cadenceMinutes >= 1440 ? `${Math.round(feed.cadenceMinutes / 1440)} day` : `${feed.cadenceMinutes} min`}</dd></div>
          </dl>
          <p>Affects: {feed.affectedClaims.join(" · ")}</p>
        </article>)}
      </div>
    </section>

    <section className={styles.taskBand} aria-labelledby="cash-control-heading">
      <div><span>{liveLoop.connected ? "Google Sheet snapshot · Live read-only" : `${preview.fixtureLabel} · ${preview.mode}`}</span><h2 id="cash-control-heading">{preview.headline}</h2><p>{content("monthly_command", "question", preview.question)}</p></div>
      <div className={styles.ownerSummary}><span>Current owner</span><strong>{preview.summary.owner}</strong><small>{content("monthly_command", "owner_note", "Targets, finance and guardrail exceptions remain human-approved")}</small></div>
    </section>

    <section className={styles.flow} aria-label="Cash and Control target to verified result">
      {([
        ["Target", preview.summary.target], ["Current", preview.summary.current], ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner], ["Progress", preview.summary.progress], ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Cash and Control four headline measures">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.value}</strong><MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} /><small>{measure.detail}</small></article>)}
    </section>
    <section className={styles.implicationPanel} aria-label="Cash and Control implication evidence">
      <p className={styles.soWhat}>So what: {cashGuardrailLabel.toLowerCase()} and opex is {opexWithinCap === null ? "not assessable against" : opexWithinCap ? "within" : "above"} the {opexCapValue !== null ? inr(opexCap) : "unrecorded"} cap; {leakageValue !== null ? `${inr(leakage)} leakage` : "leakage is not recorded"} and {liveClosureCounts.reopened} reopened financial actions remain visible until independently resolved.</p>
      <div className={styles.implicationFacts}>
        <dl><dt>Cash guardrail</dt><dd>{cashGuardrailLabel}</dd><small>{currentValue !== null ? `${inr(current)} current balance` : "Current balance not recorded"}</small></dl>
        <dl><dt>OPEX control</dt><dd>{opexWithinCap === null ? "Not assessable" : opexWithinCap ? `${inr(Math.max(0, opexCap - opexForecast))} headroom` : `${inr(opexForecast - opexCap)} over cap`}</dd><small>{opexForecastValue !== null ? `${inr(opexForecast)} forecast` : "forecast not recorded"} · {opexCapValue !== null ? `${inr(opexCap)} cap` : "cap not recorded"}</small></dl>
        <dl><dt>Collection leakage</dt><dd>{leakageValue !== null ? inr(leakage) : "Not recorded"}</dd><small>From Finance_Daily current due</small></dl>
        <dl><dt>Closure integrity</dt><dd>{liveClosureCounts.reopened} reopened</dd><small>{liveClosureCounts.verified} verified · {liveClosureCounts.awaitingVerification} awaiting</small></dl>
      </div>
    </section>

    <section className={styles.controlPanel} aria-label="Monthly control path">
      <header><div><span>Monthly control path</span><strong>{content("monthly_control_path", "heading", "Approve the destination, protect cash, then verify every outcome.")}</strong></div><p>{content("monthly_control_path", "policy_note", "No silent target reduction")}</p></header>
      <div className={styles.controlBody}>
        <ControlPath path={preview.controlPath} />
        <aside className={styles.protectionPanel}>
          <div className={styles.protectionHeading}><ShieldCheck aria-hidden /><div><span>Cash feasibility</span><strong>{cashProtected && opexWithinCap === true ? "Locked controls are protected." : cashAtRisk || opexWithinCap === false ? "A locked financial control needs attention." : "Control status is awaiting a governed Sheet value."}</strong></div></div>
          <div className={styles.financialRails}>{preview.financialRails.map((rail) => <FinancialRail key={rail.id} rail={rail} />)}</div>
          <div className={styles.closureSummary}><span>System work</span><strong>{preview.closureCounts.verified}/{preview.closureCounts.claimed} verified</strong><dl><div><dt>Awaiting</dt><dd>{preview.closureCounts.awaitingVerification}</dd></div><div><dt>Reopened</dt><dd>{preview.closureCounts.reopened}</dd></div></dl></div>
        </aside>
      </div>
    </section>
    <section className={styles.implicationPanel} aria-label="Monthly control path implication evidence">
      <p className={styles.soWhat}>So what: {controlPathImplicationDetail}</p>
      <div className={styles.implicationFacts}>
        <dl><dt>Destination approval</dt><dd>{destinationApproved ? "Approved" : destinationApproval ? "Pending" : "Not recorded"}</dd><small>Automatically derived from Approval_Log decision</small></dl>
        <dl><dt>Monthly CM target</dt><dd>{monthlyCmTargetValue !== null ? inr(monthlyCmTarget) : "Not recorded"}</dd><small>From Dashboard_Overview</small></dl>
        <dl><dt>Remaining CM gap</dt><dd>{destinationApproved ? cmGapValue !== null ? inr(cmGap) : "Not recorded" : "Locked"}</dd><small>{cmGapValue !== null ? `${inr(cmGap)} proposed gap` : "Target and actual required"}</small></dl>
        <dl><dt>Cascade</dt><dd>{destinationApproved ? "Unlocked" : "Blocked"}</dd><small>{destinationApproved ? "Approved destination can proceed" : "Waiting for human approval"}</small></dl>
      </div>
    </section>

    <section className={styles.mixPanel} aria-label="Evidence-ranked channel recommendation">
      <header><div><span>Evidence-ranked channel recommendation</span><strong>{content("channel_recommendation", "heading", "Recommend the mix; never impose a fixed split.")}</strong></div><p>{content("channel_recommendation", "policy_note", "Recommendation only")}</p></header>
      <div className={styles.mixRows}>{preview.channelRecommendations.map((row) => <article key={row.candidateId}><span className={styles.rank}>{row.rank}</span><div><strong>{row.channel}</strong><small>{row.evidenceRef ? "Protected evidence" : "Evidence missing"} · {row.dataFreshness.toLowerCase()} · {row.independentlyVerified ? "independently verified" : "verification pending"}</small></div><dl><div><dt>Expected CM</dt><dd>₹{(row.expectedVerifiedCmInr / 100_000).toFixed(1)}L</dd></div><div><dt>Cash needed</dt><dd>₹{(row.requiredCashInr / 100_000).toFixed(1)}L</dd></div><div><dt>Outcome</dt><dd>{row.expectedHoursToOutcome}h</dd></div></dl><b>{content("channel_recommendation", "allocation_note", "No allocation set")}</b></article>)}</div>
    </section>
    <section className={styles.implicationPanel} aria-label="Channel recommendation implication evidence">
      <p className={styles.soWhat}>So what: {channelImplicationDetail}</p>
      <div className={styles.implicationFacts}>
        <dl><dt>Top-ranked channel</dt><dd>{topChannel?.channel || "No eligible channel"}</dd><small>{topChannel ? `Rank 1 of ${preview.channelRecommendations.length}` : "Evidence rules not met"}</small></dl>
        <dl><dt>Expected verified CM</dt><dd>{topChannel ? inr(topChannel.expectedVerifiedCmInr) : "No data"}</dd><small>{topChannel ? `${(topChannel.expectedVerifiedCmInr / Math.max(1, topChannel.requiredCashInr)).toFixed(2)}× expected CM per cash rupee` : "No eligible projection"}</small></dl>
        <dl><dt>Cash needed</dt><dd>{topChannel ? inr(topChannel.requiredCashInr) : "No data"}</dd><small>{topChannel ? `${topChannel.expectedHoursToOutcome}h expected outcome` : "No eligible projection"}</small></dl>
        <dl><dt>Decision boundary</dt><dd>{destinationApproved ? "Human selection" : "Approval required"}</dd><small>No automatic allocation or fixed split</small></dl>
      </div>
    </section>

    <section className={styles.workPanel} aria-label="Open Cash and Control work">
      <header><div><span>{content("open_work", "eyebrow", "Owned command work")}</span><strong>{content("open_work", "heading", "Every miss stays open until independently verified.")}</strong></div><p>{liveData ? content("open_work", "live_note", "Google Sheet · read-only") : "Local shadow outcomes only"}</p></header>
      <OperationalCardStack label="Cash and Control command work">{tasks.length ? tasks.map((task) => <OperationalCard key={task.actionId} title={task.issue} domain={task.actionId} status={task.state} action={task.engineAction.nextAction} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: task.dueAt ? <time dateTime={task.dueAt}>{date(task.dueAt)}</time> : "No deadline recorded" }, { label: "Progress", value: task.progress }, { label: "Expected verified result", value: task.expectedVerifiedResult }, { label: "Verified result", value: task.verifiedResult }]}>{liveData ? null : <div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.issue}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Evidence received", "Failed evidence", "Human approval required", "Missed hour"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task)}>Record locally</button><small>No approval, payment, message or Production write</small></div>}</OperationalCard>) : <p className={styles.emptyState}>No open financial actions for the selected filters.</p>}</OperationalCardStack>
    </section>

    <section className={styles.approvalPanel} aria-label="Pending human approvals">
      <header><div><span>{content("human_approvals", "eyebrow", "Named human authority")}</span><strong>{content("human_approvals", "heading", "Financial controls cannot approve themselves.")}</strong></div><p>{content("human_approvals", "policy_note", "No automatic exception")}</p></header>
      <OperationalCardStack label="Pending human approvals">{approvalCards.length ? approvalCards.map((approval) => <OperationalCard key={approval.id} title={approval.decision} domain={approval.id} status={approval.status} action={approval.nextAction} fields={[{ label: "Owner", value: approval.owner }, { label: "Due", value: approval.dueAt ? <time dateTime={approval.dueAt}>{date(approval.dueAt)}</time> : "No deadline recorded" }, { label: "Amount", value: approval.amountInr ? inr(approval.amountInr) : "No amount recorded" }, { label: "Current terms", value: approval.currentTerms }, { label: "Expected result", value: approval.expectedResult }, { label: "Decision note", value: approval.decisionReason }]} />) : <p className={styles.emptyState}>No pending human approvals for the selected filters.</p>}</OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Versioned controls and pending approvals</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Status</th></tr></thead><tbody>{liveData ? (cashApprovalRegistry.length ? cashApprovalRegistry.map((approval) => <tr key={approval.approvalId}><td>{approval.title}</td><td>{approval.amountInr ? inr(approval.amountInr) : approval.proposedTerms || "No value recorded"}</td><td>{approval.approvalId}</td><td>{approval.decision}</td></tr>) : <tr><td>No linked approval</td><td>No Approval_Log record</td><td>—</td><td>Not recorded</td></tr>) : preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.name}</td><td>{policy.value === null ? "No value approved" : `₹${new Intl.NumberFormat("en-IN").format(policy.value)}`}</td><td>v{policy.version}</td><td>{policy.status}</td></tr>)}</tbody></table></div></section>
        <section><strong>Shared learning-control inputs</strong>{liveData ? (liveLearningInputs.length ? liveLearningInputs.map((input) => <dl className={styles.learningGrid} key={input.id}><div><dt>Proposal</dt><dd>{input.proposal}</dd></div><div><dt>Expected effect</dt><dd>{input.expectedEffect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence}</dd></div><div><dt>Attribution</dt><dd>{input.attribution}</dd></div><div><dt>Forecast error</dt><dd>{input.forecastError}</dd></div><div><dt>Fresh / reversible</dt><dd>{input.freshness}</dd></div><div><dt>Approved boundary</dt><dd>{input.approvedBoundary}</dd></div><div><dt>Human controls</dt><dd>{input.humanControls}</dd></div><div><dt>Effects</dt><dd>{input.effects}</dd></div><div><dt>Materiality / confidence</dt><dd>{input.materiality}</dd></div><div><dt>Adoption / rollback</dt><dd>{input.adoption}</dd></div></dl>) : <p>No Cash &amp; Control learning or approval record is available.</p>) : preview.learningInputs.map((input) => <dl className={styles.learningGrid} key={input.action_id}><div><dt>Proposal</dt><dd>{input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Approved boundary</dt><dd>{String(input.inside_approved_boundary)} · reverses human decision {String(input.reverses_human_decision)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ")}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Materiality / confidence</dt><dd>{input.materiality_status} · {input.production_confidence}</dd></div><div><dt>Adoption / rollback</dt><dd>Auto-adopt {String(input.auto_adopt)} · {input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>{liveData ? "Append-only Sheet audit" : "Append-only local shadow audit"}</strong>{liveData ? (liveAuditEvents.length ? <ol>{liveAuditEvents.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.type} · {entry.state}</b>{entry.detail}</span>{entry.at ? <time dateTime={entry.at}>{date(entry.at)}</time> : <small>Time not recorded</small>}</li>)}</ol> : <p>No linked Action_Log, Evidence_Log or Approval_Log event is available.</p>) : audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.outcome}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Structural action boundary</strong><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>{liveData ? "Automatically enforced system policy: RafiQi may detect, rank, recommend, re-slot and verify from connected records. It cannot approve a target or exception, change pricing, move money, sign a contract, contact anyone, write Production or adopt policy." : "RafiQi may detect, rank, recommend, re-slot and verify in synthetic shadow state. It cannot approve a target or exception, change pricing, move money, sign a contract, contact anyone, write Production or adopt policy."}</p></section>
      </div>
    </details>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>{decisionHeading}</strong>
        <p>{decisionDetail}</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{preview.summary.owner}</dd></div>
        <div><dt>By</dt><dd><time dateTime={decisionDueAt}>{decisionDue}</time></dd></div>
      </dl>
    </section>

    <div className={styles.closureRule}><RefreshCcw aria-hidden /><span><strong>Recovery rule</strong>{recoveryDetail}</span></div>
    <footer className={styles.sourceNote}><FileCheck2 aria-hidden /><span>{liveLoop.connected ? `Finance_Daily · Action_Log · Evidence_Log · Approval_Log · as of ${date(loopHealth.asOf)} · ${loopHealth.feeds.length} connected feeds · ${staleFeeds.length} stale` : `${preview.source.name} · as of ${date(preview.source.asOf)} · protected references only`}</span><Clock3 aria-hidden /><span>{liveLoop.connected ? `${loopHealth.state} · ${liveClosureCounts.verified}/${liveClosureCounts.claimed} verified · ${liveClosureCounts.awaitingVerification} awaiting · ${liveClosureCounts.reopened} reopened` : "Production confidence Low · unresolved controls remain pending human approval"}</span><WalletCards aria-hidden /><span>Read-only · no automated financial action</span></footer>
  </DashboardSectionAccordion>
}
