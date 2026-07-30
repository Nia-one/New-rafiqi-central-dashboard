"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react"
import { recoverMemberSavingsTask, type MemberSavingsPreview, type MemberSavingsShadowOutcome, type SavingsTaskPreview, type SavingsVerification } from "@/lib/operating-loop/member-savings-loop"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { compactAge } from "@/lib/operating-loop/loop-health"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { approvalsForDomain } from "@/lib/live-approvals"
import { buildLiveMemberSavingsFreshness, buildLiveMemberSavingsHealth, buildLiveMemberSavingsTasks } from "@/lib/live-mappers/self-drive"
import { resolveMemberSavingsAskDueAt, synchronizeMemberSavingsTaskState } from "./member-savings-workspace-helpers"
import styles from "./member-savings-workspace.module.css"

type Props = { preview: MemberSavingsPreview; liveData?: any }

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function averageRecordedPercent(rows: readonly Record<string, unknown>[], field: string) {
  const values = rows.flatMap((row) => {
    const raw = row[field]
    if (raw === null || raw === undefined || String(raw).trim() === "") return []
    const value = Number(raw)
    return Number.isFinite(value) ? [value] : []
  })
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function percent(value: number) {
  const display = Math.abs(value) <= 1 ? value * 100 : value
  return `${display.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`
}

function recordedNumber(row: Record<string, unknown>, field: string) {
  const raw = row[field]
  if (raw === null || raw === undefined || String(raw).trim() === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function recordedText(row: Record<string, unknown> | undefined, ...fields: string[]) {
  for (const field of fields) {
    const value = row?.[field]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function DualGateMatrix({ preview }: Props) {
  const maxValue = Math.max(...preview.services.flatMap((service) => [service.memberSavingsInr, Math.max(0, service.niaMarginInr)]), 1)
  return <div className={styles.matrix} role="img" aria-label="Paired bars comparing recorded Member savings and Nia margin by service and Studio">
    <div className={styles.matrixLegend}><span><i className={styles.savingsKey} />Verified Member saving</span><span><i className={styles.marginKey} />Verified Nia margin</span><small>₹ per fulfilled unit · prices hidden</small></div>
    <div className={styles.zeroRule}><span>Both values must be above ₹0</span></div>
    {preview.services.map((service) => <article className={styles.serviceRow} data-gate-status={service.status} key={service.serviceId}>
      <div className={styles.serviceIdentity}><strong>{service.serviceName}</strong><span>{service.studio}</span></div>
      <div className={styles.barPair}>
        <div><span>Member</span><i className={styles.savingsBar} style={{ width: `${Math.max(2, service.memberSavingsInr / maxValue * 100)}%` }} /><b>₹{service.memberSavingsInr}</b></div>
        <div><span>Nia</span>{service.niaMarginInr > 0 ? <i className={styles.marginBar} style={{ width: `${Math.max(2, service.niaMarginInr / maxValue * 100)}%` }} /> : <i className={styles.failedBar} /> }<b>{service.niaMarginInr > 0 ? `₹${service.niaMarginInr}` : `−₹${Math.abs(service.niaMarginInr)}`}</b></div>
      </div>
      <div className={service.status === "Pass" ? styles.passLabel : styles.exceptionLabel}><span>{service.status}</span><small>{service.statusReason}</small></div>
    </article>)}
  </div>
}

export function MemberSavingsWorkspace({ preview: fixturePreview, liveData }: Props) {
  const isLive = Boolean(liveData)
  const liveFreshness = isLive ? buildLiveMemberSavingsFreshness(liveData) : null
  const liveHealth = isLive ? buildLiveMemberSavingsHealth(liveData) : null
  const liveTasks = isLive ? buildLiveMemberSavingsTasks(liveData) : []
  const liveEssentialsRows = Array.isArray(liveData?.essentials) ? liveData.essentials as Record<string, unknown>[] : []
  const liveGateRows = liveEssentialsRows.filter((row) => recordedNumber(row, "member savings inr") !== null && recordedNumber(row, "nia margin inr") !== null)
  const savings = liveGateRows.reduce((sum, row) => sum + (recordedNumber(row, "member savings inr") ?? 0), 0)
  const margin = liveGateRows.reduce((sum, row) => sum + (recordedNumber(row, "nia margin inr") ?? 0), 0)
  const eligibleMembers = liveEssentialsRows.reduce((sum, row) => sum + (recordedNumber(row, "eligible members") ?? 0), 0)
  const buyingMembers = liveEssentialsRows.reduce((sum, row) => sum + (recordedNumber(row, "buying members") ?? 0), 0)
  const buyingValue = liveEssentialsRows.reduce((sum, row) => sum + (recordedNumber(row, "essentials billed inr") ?? 0), 0)
  const sourceAttachPct = eligibleMembers > 0 ? buyingMembers / eligibleMembers : null
  const livePolicyApprovals = approvalsForDomain(liveData, "member-savings")
  const savingsAction = liveData?.actions?.find((row: Record<string, unknown>) => {
    const source = `${row["operating objective"] ?? ""} ${row["expected metric"] ?? ""}`.toLowerCase()
    return source.includes("savings") || source.includes("essentials pricing")
  })
  const ownerActorId = String(savingsAction?.["owner actor id"] ?? liveGateRows[0]?.["next action owner actor id"] ?? "").trim()
  const ownerPerson = liveData?.people?.find((row: Record<string, unknown>) => String(row["actor id"] ?? "").trim() === ownerActorId)
  const owner = String(ownerPerson?.["display name"] || livePolicyApprovals[0]?.owner || ownerActorId || (isLive ? "No owner recorded" : fixturePreview.summary.owner))
  const hasLiveGateData = liveGateRows.length > 0
  const memberSavingsPass = hasLiveGateData && savings > 0
  const niaMarginPass = hasLiveGateData && margin > 0
  const gap = hasLiveGateData ? Number(!memberSavingsPass) + Number(!niaMarginPass) : 0
  const liveQuestion = hasLiveGateData ? `Are recorded Member savings of ₹${savings.toLocaleString("en-IN")} and Nia margin of ₹${margin.toLocaleString("en-IN")} both above ₹0?` : `${liveEssentialsRows.length} Studio summaries loaded from TEAM_ESSENTIALS_SUMMARY. Fill Total Member Savings, Total COGS and Total Fulfilment Cost to calculate the dual gate.`
  const pendingApprovals = livePolicyApprovals.filter((approval) => approval.pending)
  const liveEscalations = liveTasks.filter((task) => {
    const action = task.engineAction as unknown as Record<string, unknown>
    const state = String(action.state ?? task.state).toLowerCase()
    const escalation = String(action["escalation level"] ?? action.escalation ?? "").toLowerCase()
    const repeatCount = Number(action["repeat count"] ?? action["failure count"] ?? 0)
    return task.state === "Reopened" || repeatCount > 1 || /escalat|overdue|blocked|failed|reopen/.test(`${state} ${escalation}`)
  })
  const liveReviewCount = liveEscalations.length + pendingApprovals.length
  const reviewCount = isLive ? liveReviewCount : fixturePreview.despatchEscalations.length + 1
  const reviewSummary = reviewCount === 0 ? "No issues need review" : `${reviewCount} ${reviewCount === 1 ? "issue needs" : "issues need"} review`
  const approvalNote = pendingApprovals.length
    ? `${pendingApprovals.length} governed price or supplier decision${pendingApprovals.length === 1 ? "" : "s"} awaiting human approval`
    : "No governed price or supplier decision is awaiting approval"
  const studioNameById = new Map<string, string>((Array.isArray(liveData?.studios) ? liveData.studios : []).map((row: Record<string, unknown>) => [String(row["studio id"] ?? "").trim(), String(row["studio name"] ?? row.studio ?? "").trim()] as const))
  const weeklyMessageStatusByServiceId = new Map(liveGateRows.map((row, index) => {
    const serviceId = String(row["essentials hourly id"] ?? `ESSENTIALS-${index + 1}`).trim()
    const recordedStatus = recordedText(row, "weekly message status", "message status", "delivery status")
    const sent = row.sent
    const status = recordedStatus || (sent === true || String(sent).toLowerCase() === "true" ? "Sent" : sent === false || String(sent).toLowerCase() === "false" ? "Not sent" : "Delivery status not recorded")
    return [serviceId, status] as const
  }))
  const liveServices: MemberSavingsPreview["services"] = Object.freeze(liveGateRows.map((row: Record<string, unknown>, index: number) => {
    const serviceId = String(row["essentials hourly id"] ?? `ESSENTIALS-${index + 1}`).trim()
    const studioId = String(row["studio id"] ?? "").trim()
    const memberSavingsInr = recordedNumber(row, "member savings inr") ?? 0
    const niaMarginInr = recordedNumber(row, "nia margin inr") ?? 0
    const attachFloor = recordedNumber(row, "attach floor pct")
    const status = memberSavingsInr > 0 && niaMarginInr > 0 ? "Pass" as const : "Exception" as const
    const statusReason = status === "Pass" ? "Both recorded gates pass" : memberSavingsInr <= 0 && niaMarginInr <= 0 ? "Member savings and Nia margin gates fail" : memberSavingsInr <= 0 ? "Member savings gate fails" : "Nia margin gate fails"
    return Object.freeze({
      serviceId,
      serviceName: `Essentials service · ${serviceId}`,
      studio: studioNameById.get(studioId) || studioId || "Studio not recorded",
      memberSavingsInr,
      niaMarginInr,
      status,
      statusReason,
      attachPct: recordedNumber(row, "attach pct") ?? 0,
      repeatPct: recordedNumber(row, "repeat pct") ?? 0,
      peerBandLabel: attachFloor === null ? "No governed floor recorded" : `floor ${percent(attachFloor)}`,
      repeatBaselinePct: recordedNumber(row, "repeat baseline pct") ?? 0,
    })
  }))
  const passingGateRows = liveServices.filter((service) => service.status === "Pass").length
  const failingGateRows = Math.max(0, liveGateRows.length - passingGateRows)
  const serviceGateSummary = liveServices.length === 0 ? "No recorded services" : failingGateRows === 0 ? `All ${liveServices.length} recorded ${liveServices.length === 1 ? "service passes" : "services pass"}` : `${failingGateRows} ${failingGateRows === 1 ? "service fails" : "services fail"} the dual gate`
  const serviceGateImplication = liveServices.length === 0 ? `So what: ${liveEssentialsRows.length} Studio summaries are loaded, but savings and margin totals are still pending.` : failingGateRows === 0 ? liveServices.length === 1 ? "So what: the recorded service clears both the Member-savings and Nia-margin gates." : `So what: all ${liveServices.length} recorded services clear both the Member-savings and Nia-margin gates.` : `So what: ${failingGateRows} recorded ${failingGateRows === 1 ? "service needs" : "services need"} cost or attach recovery while preserving Member savings.`
  const serviceImplicationSummary = liveServices.length === 0
    ? liveEssentialsRows.length ? `${liveEssentialsRows.length} Studio summaries available · savings implication pending.` : "No service implication can be calculated."
    : failingGateRows === 0
      ? liveServices.length === 1 ? "The recorded service clears both gates." : `All ${liveServices.length} recorded services clear both gates.`
      : `${failingGateRows} recorded ${failingGateRows === 1 ? "service needs" : "services need"} cost or attach recovery.`
  const dualGateImplicationSummary = isLive
    ? liveGateRows.length === 0
      ? `${liveEssentialsRows.length} Studio summaries loaded · savings inputs pending.`
      : failingGateRows === 0
        ? "All recorded services pass both gates."
        : failingGateRows === 1
          ? "Recovery belongs on the single failing service."
          : `Recovery belongs on ${failingGateRows} failing services.`
    : "Recovery belongs on the single failing service."
  const dualGateImplication = isLive
    ? liveGateRows.length === 0
      ? `So what: ${liveEssentialsRows.length} Studio summaries are connected; the dual gate will calculate after the black savings and cost columns are filled.`
      : failingGateRows === 0
        ? `So what: ${passingGateRows} of ${liveGateRows.length} recorded ${liveGateRows.length === 1 ? "service clears" : "services clear"} both gates, so no dual-gate recovery is currently required.`
        : `So what: ${passingGateRows} of ${liveGateRows.length} recorded ${liveGateRows.length === 1 ? "service clears" : "services clear"} both gates; recovery belongs on the ${failingGateRows === 1 ? "single failing service" : `${failingGateRows} failing services`}, not a category-wide reprice.`
    : "So what: 3 of 4 services clear both gates, so the single failing service is where recovery effort belongs, not a category-wide reprice."
  const attachPct = averageRecordedPercent(liveEssentialsRows, "attach pct")
  const attachFloorPct = averageRecordedPercent(liveEssentialsRows, "attach floor pct")
  const repeatPct = averageRecordedPercent(liveEssentialsRows, "repeat pct")
  const repeatBaselinePct = averageRecordedPercent(liveEssentialsRows, "repeat baseline pct")
  const hasAttachRepeat = attachPct !== null && repeatPct !== null
  const hasAttachRepeatComparators = attachFloorPct !== null && repeatBaselinePct !== null
  const verifiedSavingsOutcomes = liveHealth?.verification.verified ?? 0
  const openSavingsActions = liveHealth ? liveHealth.verification.awaiting + liveHealth.verification.reopened : 0
  const liveMeasures: MemberSavingsPreview["measures"] = Object.freeze([
    Object.freeze({ id: "verified-savings" as const, label: verifiedSavingsOutcomes > 0 ? "Verified Member savings" : "Recorded Member savings", value: `₹${savings.toLocaleString("en-IN")}`, target: "Above ₹0", detail: verifiedSavingsOutcomes > 0 ? `${verifiedSavingsOutcomes} independently verified outcome${verifiedSavingsOutcomes === 1 ? "" : "s"}` : "Independent verification is awaiting Evidence_Log" }),
    Object.freeze({ id: "attach-repeat" as const, label: "Attach and repeat", value: hasAttachRepeat ? `${percent(attachPct)} / ${percent(repeatPct)}` : "No data", target: hasAttachRepeatComparators ? `Floor ${percent(attachFloorPct)} / baseline ${percent(repeatBaselinePct)}` : "Governed comparison unavailable", detail: hasAttachRepeat ? `Calculated from ${liveEssentialsRows.length} Essentials_Hourly row${liveEssentialsRows.length === 1 ? "" : "s"}` : "No attach or repeat metric is recorded in the connected Sheet feeds" }),
    Object.freeze({ id: "dual-gate" as const, label: "Services passing both gates", value: liveGateRows.length ? `${passingGateRows}/${liveGateRows.length}` : "No data", target: "Savings + margin", detail: liveGateRows.length ? "Calculated from Essentials_Hourly" : "No eligible Essentials_Hourly row is recorded" }),
    Object.freeze({ id: "exceptions" as const, label: "At-risk recovery", value: `${openSavingsActions} open`, target: `${verifiedSavingsOutcomes} verified`, detail: "Calculated from Action_Log and Evidence_Log" }),
  ])
  const liveLearningRows = (Array.isArray(liveData?.learningHistory) ? liveData.learningHistory as Record<string, unknown>[] : [])
    .filter((row) => recordedText(row, "domain").toLowerCase() === "member savings")
  const liveSavingsActions = (Array.isArray(liveData?.actions) ? liveData.actions as Record<string, unknown>[] : []).filter((row) => {
    const descriptor = `${recordedText(row, "operating objective", "title")} ${recordedText(row, "expected metric")} ${recordedText(row, "required evidence")}`.toLowerCase()
    return /member savings|essentials|supplier|pricing|sku|stock|repeat purchase/.test(descriptor)
  })
  const liveSavingsActionIds = new Set(liveSavingsActions.map((row) => recordedText(row, "action id", "id")).filter(Boolean))
  const liveSavingsEvidence = (Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : [])
    .filter((row) => liveSavingsActionIds.has(recordedText(row, "linked id")))
  const liveAuditEvents = [
    ...liveSavingsActions.map((row) => ({ id: recordedText(row, "action id", "id"), type: "Action", state: recordedText(row, "state", "status") || "State not recorded", detail: recordedText(row, "operating objective", "title") || "Objective not recorded", at: recordedText(row, "updated at", "proof submitted at", "reopened at", "in progress at", "assigned at", "proposed at") })),
    ...liveSavingsEvidence.map((row) => ({ id: recordedText(row, "evidence id", "id"), type: "Evidence", state: recordedText(row, "verification status", "status") || "Pending", detail: recordedText(row, "notes", "description", "evidence type") || "Evidence detail not recorded", at: recordedText(row, "verified at", "uploaded at", "updated at") })),
    ...livePolicyApprovals.map((approval) => ({ id: approval.approvalId, type: "Approval", state: approval.decision, detail: approval.title, at: approval.decidedAt })),
  ].filter((entry) => entry.id).sort((left, right) => (Date.parse(right.at) || 0) - (Date.parse(left.at) || 0))
  let preview: MemberSavingsPreview = {
    ...fixturePreview,
    loopHealth: liveHealth ?? fixturePreview.loopHealth,
    quarantineCount: liveFreshness?.quarantinedRecords ?? fixturePreview.quarantineCount,
    headline: liveData ? hasLiveGateData ? `Members saved ₹${savings.toLocaleString("en-IN")}; Nia margin is ₹${margin.toLocaleString("en-IN")}.` : "Member savings and Nia margin are not recorded for the current filters." : fixturePreview.headline,
    summary: {
      ...fixturePreview.summary,
      target: "Savings and margin above ₹0",
      current: hasLiveGateData ? `₹${savings.toLocaleString("en-IN")} / ₹${margin.toLocaleString("en-IN")}` : "No eligible Sheet data",
      gap: hasLiveGateData ? String(gap) : "No data",
      owner,
      progress: hasLiveGateData ? gap === 0 ? "100%" : "0%" : "No data",
      verifiedResult: hasLiveGateData ? gap === 0 ? "Both live data gates passed" : "One or more live data gates failed" : "Cannot calculate without an eligible Essentials_Hourly row",
    },
    measures: isLive ? liveMeasures : fixturePreview.measures,
    services: isLive ? liveServices : fixturePreview.services,
    tasks: isLive ? liveTasks : fixturePreview.tasks,
  }
  if (isLive && !hasLiveGateData && liveEssentialsRows.length > 0) {
    preview = {
      ...preview,
      headline: `₹${buyingValue.toLocaleString("en-IN")} Essentials buying value from ${buyingMembers.toLocaleString("en-IN")} unique buying Members.`,
      summary: {
        ...preview.summary,
        target: "Record savings and margin totals",
        current: `₹${buyingValue.toLocaleString("en-IN")} · ${buyingMembers.toLocaleString("en-IN")}/${eligibleMembers.toLocaleString("en-IN")} Members`,
        gap: "Inputs pending",
        progress: sourceAttachPct === null ? "Attach unavailable" : `${percent(sourceAttachPct)} attach`,
        verifiedResult: "Summary data loaded; savings and margin await black-column inputs",
      },
      measures: Object.freeze([
        Object.freeze({ id: "verified-savings" as const, label: "Essentials buying value", value: `₹${buyingValue.toLocaleString("en-IN")}`, target: "TEAM_ESSENTIALS_SUMMARY", detail: `Across ${liveEssentialsRows.length} recorded Studios` }),
        Object.freeze({ id: "attach-repeat" as const, label: "Unique buying Members", value: `${buyingMembers.toLocaleString("en-IN")} / ${eligibleMembers.toLocaleString("en-IN")}`, target: sourceAttachPct === null ? "Attach unavailable" : `${percent(sourceAttachPct)} attach`, detail: "Unique buyers divided by active Members" }),
        Object.freeze({ id: "dual-gate" as const, label: "Savings inputs", value: "Pending", target: "Total savings + margin", detail: "Fill the black total columns in TEAM_ESSENTIALS_SUMMARY" }),
        Object.freeze({ id: "exceptions" as const, label: "At-risk recovery", value: `${openSavingsActions} open`, target: `${verifiedSavingsOutcomes} verified`, detail: "Calculated from Action_Log and Evidence_Log" }),
      ]),
    }
  }
  const [tasks, setTasks] = useState<readonly SavingsTaskPreview[]>(preview.tasks)
  const [selected, setSelected] = useState<Record<string, MemberSavingsShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, MemberSavingsShadowOutcome>)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; outcome: MemberSavingsShadowOutcome; verification: SavingsVerification["status"]; route: string; at: string }[]>([])
  const taskSyncKey = preview.tasks.map((task) => `${task.actionId}:${task.issue}:${task.service}:${task.owner}:${task.dueAt ?? ""}:${task.expectedMetric}:${task.state}:${task.progress}:${task.verifiedResult}`).join("|")
  // Live cards must render the current Sheet projection directly. Local task state
  // exists only for the non-live shadow controls and must never mask a refresh.
  const displayedTasks = isLive ? preview.tasks : tasks
  const serviceActionCount = displayedTasks.length
    ? `${displayedTasks.length} service action${displayedTasks.length === 1 ? "" : "s"} open`
    : isLive && liveEssentialsRows.length ? "No actions generated · savings inputs pending" : "0 service actions open"
  const liveDecisionApproval = pendingApprovals[0]
  const liveDecisionTask = liveEscalations[0] ?? (gap > 0 ? liveTasks[0] : undefined)
  const liveDecisionRequired = Boolean(liveDecisionApproval || liveDecisionTask || gap > 0)
  const decisionSummary = !isLive
    ? `Recover ${preview.summary.gap} dual-gate failure`
    : liveDecisionApproval
      ? `Approval required · ${liveDecisionApproval.owner}`
      : liveDecisionRequired
        ? `Recover ${gap} dual-gate failure${gap === 1 ? "" : "s"}`
        : "No decision required"
  const decisionHeading = !isLive
    ? `Recover the ${preview.summary.gap} failing the dual gate so both Member savings and Nia margin clear ₹0.`
    : liveDecisionApproval
      ? liveDecisionApproval.title
      : liveDecisionRequired
        ? `Recover ${gap} failing dual-gate control${gap === 1 ? "" : "s"} so Member savings and Nia margin both clear ₹0.`
        : "No Member Savings decision is currently required."
  const decisionDetail = !isLive
    ? `Repricing stays a recommendation only; accountability sits with ${preview.summary.owner} until verified attach or margin evidence closes the gate.`
    : liveDecisionApproval
      ? `${liveDecisionApproval.action.replace(/[.!?]?$/, ".")} The authorised owner records the decision in Approval_Log; no price or supplier change is automatic.`
      : liveDecisionTask
        ? `${liveDecisionTask.progress} Closure requires independently verified Evidence_Log proof.`
        : hasLiveGateData ? "Both recorded gates pass and no pending Member Savings approval is recorded." : "No eligible dual-gate data or pending Member Savings approval is recorded."
  const decisionOwner = !isLive ? preview.summary.owner : liveDecisionApproval?.owner || liveDecisionTask?.owner || (liveDecisionRequired ? preview.summary.owner : "Not required")
  const decisionDueAt = isLive
    ? liveDecisionApproval?.dueAt || liveDecisionTask?.dueAt || null
    : resolveMemberSavingsAskDueAt(displayedTasks, preview.tasks[0]?.dueAt, false)
  const connectedSourceNames = liveFreshness?.feeds.map((feed) => feed.label).join(" · ") || "No connected Member Savings feed"
  const sourceConfidenceSummary = isLive
    ? `${liveFreshness!.feeds.length} connected Sheet feed${liveFreshness!.feeds.length === 1 ? "" : "s"} · ${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} outcomes verified`
    : `${preview.source.name} · Production confidence Low`
  const sourceHealthDetail = isLive
    ? `${preview.loopHealth.state} · ${liveFreshness!.staleFeedCount} stale · ${preview.quarantineCount} quarantined · human approvals retained`
    : "Production confidence Low · pending thresholds do not block shadow progress"

  useEffect(() => {
    setSelected((currentSelection) => {
      const nextSelection = Object.fromEntries(preview.tasks.map((task) => [task.actionId, currentSelection[task.actionId] ?? "Unresolved"])) as Record<string, MemberSavingsShadowOutcome>
      setTasks((currentTasks) => isLive
        ? preview.tasks
        : synchronizeMemberSavingsTaskState(currentTasks, preview.tasks, nextSelection).tasks)
      return nextSelection
    })
  }, [taskSyncKey, isLive])

  function recordShadowOutcome(actionId: string) {
    const outcome = selected[actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const task = tasks.find((candidate) => candidate.actionId === actionId)
    if (!task) return
    const transition = recoverMemberSavingsTask(task, outcome)
    setTasks((current) => current.map((candidate) => candidate.actionId === actionId ? transition.task : candidate))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${actionId}-${Date.parse(at)}`, actionId, outcome, verification: transition.verification.status, route: transition.route, at })])
  }

  const savingsCommandSummary = isLive && !hasLiveGateData
    ? `Savings inputs pending · ${liveEssentialsRows.length} Studio summaries connected · owner ${preview.summary.owner}`
    : `${preview.summary.gap} failing the dual gate · owner ${preview.summary.owner}`
  const loopHealthSummary = isLive && preview.loopHealth.verification.claimed === 0
    ? `${liveEssentialsRows.length} Studio summaries connected · no outcome checks recorded`
    : `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} confirmed`

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Member Savings sections" sections={[
    { title: "Data freshness", summary: isLive ? `Google Sheet refresh ${date(liveFreshness!.asOf)} · ${liveFreshness!.feeds.length} connected feeds${liveFreshness!.staleFeedCount ? ` · ${liveFreshness!.staleFeedCount} stale` : ""}` : `Last refresh ${date(preview.source.lastRefreshAt)} · ${preview.quarantineCount} quarantined` },
    { title: "Savings command", summary: savingsCommandSummary },
    { title: "Loop health", summary: loopHealthSummary },
    { title: "Savings vs goal", summary: `${preview.summary.current} current · ${preview.summary.target} target` },
    { title: "Headline measures", summary: `${preview.measures.length} dual-gate controls at a glance` },
    { title: "Dual-gate implication", summary: dualGateImplicationSummary },
    { title: "Savings, margin and repeat", summary: preview.services.length ? `${preview.services.filter((service) => service.status === "Pass").length}/${preview.services.length} services pass` : isLive && liveEssentialsRows.length ? `${liveEssentialsRows.length} Studio summaries · savings and repeat inputs pending` : "No recorded services" },
    { title: "Service implication", summary: isLive ? serviceImplicationSummary : "Fix cost or attach without withdrawing Member savings." },
    { title: "Services needing action", summary: serviceActionCount },
    { title: "Issues needing review", summary: reviewSummary },
    { title: "Background record", summary: isLive ? `${liveAuditEvents.length} Sheet audit events · governed controls retained` : `${audit.length} local shadow events · governed controls retained` },
    { title: "Decision required", summary: decisionSummary },
    { title: "Source and confidence", summary: sourceConfidenceSummary },
  ]}>
    <div className={styles.freshness} role="status">
      {isLive && liveFreshness!.staleFeedCount === 0 ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
      <strong>{isLive ? liveFreshness!.staleFeedCount ? `${liveFreshness!.staleFeedCount} connected source${liveFreshness!.staleFeedCount === 1 ? " is" : "s are"} stale` : "Google Sheet sources current" : "Stale synthetic fixture"}</strong>
      <span>{isLive ? `Sheet snapshot ${date(liveFreshness!.asOf)} · ${liveFreshness!.feeds.length} connected feeds` : `Last refresh ${date(preview.source.lastRefreshAt)} · no live connection`}</span>
      <b>{preview.quarantineCount} protected-input rows quarantined</b>
    </div>

    <section className={styles.taskBand} aria-labelledby="member-savings-heading">
      <div>
        <span>{isLive ? "Google Sheet · live read-only" : `${preview.fixtureLabel} · ${preview.mode}`}</span>
        <h2 id="member-savings-heading">{preview.headline}</h2>
        <p>{isLive ? liveQuestion : preview.question}</p>
      </div>
      <div className={styles.ownerSummary}><b className={styles.verdictPill} data-state={hasLiveGateData && gap === 0 ? "on-track" : "behind"}>{isLive && !hasLiveGateData ? "Dual gate not calculated" : gap === 0 ? "Dual gate passed" : "Dual-gate breach"} · {preview.summary.gap}{hasLiveGateData || !isLive ? " failing" : ""}</b><span>Current owner</span><strong>{preview.summary.owner}</strong><small>{isLive ? approvalNote : "Human approval retained for price and supplier decisions"}</small></div>
    </section>

    <section className={styles.loopHealthStrip} data-health-state={preview.loopHealth.state} aria-label="Data and check status">
      {(() => {
        const lh = preview.loopHealth
        const stale = lh.feeds.filter((feed) => feed.stale)
        const oldest = [...lh.feeds].sort((a, b) => b.ageMinutes - a.ageMinutes)[0]
        const breached = lh.clocks.filter((clock) => clock.breached).length
        const running = lh.clocks.filter((clock) => clock.state === "Running").length
        const { verified, awaiting, reopened } = lh.verification
        const total = verified + awaiting + reopened
        const segments = [{ v: verified, t: "good" }, { v: awaiting, t: "warn" }, { v: reopened, t: "bad" }] as const
        return <>
          <article><span>Data freshness</span><strong>{stale.length} stale</strong><small>{oldest ? `Oldest ${compactAge(oldest.ageMinutes)}` : "All current"}</small></article>
          <article><span>Clocks running</span><strong>{running} active · {breached} breached</strong><small>{breached > 0 ? `${breached} owner wait` : "None breached"}</small></article>
          <article><span>Outcome checks</span><strong>{verified} of {lh.verification.claimed} confirmed</strong>
            <div className="loop-health-verify-bar" role="img" aria-label={`${verified} confirmed, ${awaiting} waiting, ${reopened} reopened`}>
              {total === 0 ? <i data-tone="empty" style={{ width: "100%" }} /> : segments.filter((s) => s.v > 0).map((s) => <i key={s.t} data-tone={s.t} style={{ width: `${(s.v / total) * 100}%` }} />)}
            </div>
          </article>
        </>
      })()}
    </section>

    <section className={styles.flow} aria-label="Savings vs monthly goal">
      {([
        ["Target", preview.summary.target], ["Current", preview.summary.current], ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner], ["Progress", preview.summary.progress], ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.value}</strong><MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} /><small>{measure.detail}</small></article>)}
    </section>
    <p className={styles.soWhat}>{dualGateImplication}</p>

    <div className={styles.primaryGrid}>
      <section className={styles.panel} aria-label="Savings and profit check">
        <header><div><span>Savings and profit check</span><strong>{isLive ? serviceGateSummary : "1 service fails the margin test"}</strong></div><p>{isLive ? "Google Sheet · live read-only" : "Confirmed outcomes · synthetic"}</p></header>
        <DualGateMatrix preview={preview} />
      </section>

      <section className={`${styles.panel} ${styles.healthPanel}`} aria-label="Usage and repeat trends">
        <header><div><span>Usage and repeat trends</span><strong>{isLive ? preview.services.length ? `Attach and repeat recorded for ${preview.services.length} ${preview.services.length === 1 ? "service" : "services"}` : "No attach or repeat data recorded" : "Attach and repeat tracked locally"}</strong></div><p>{isLive ? "Essentials_Hourly observations" : "Studio baselines only"}</p></header>
        <div className={styles.usageList}>{preview.services.map((service) => <article key={service.serviceId}><div><strong>{service.serviceName}</strong><span>{service.studio}</span></div><dl><div><dt>Attach</dt><dd>{service.attachPct}%</dd></div><div><dt>Repeat</dt><dd>{service.repeatPct}%</dd></div></dl><small>Peer: {service.peerBandLabel} · own baseline {service.repeatBaselinePct}%</small></article>)}</div>
        <div className={styles.rule}><ShieldCheck aria-hidden /><span><strong>Recovery rule</strong>Actual attach or repeat must recover against current governed evidence. A visit does not close.</span></div>
      </section>
    </div>
    <p className={styles.soWhat}>{isLive ? serviceGateImplication : "So what: the failing service loses Nia margin while still saving the Member, so it needs a cost or attach fix, not withdrawal of the saving."}</p>

    <section className={styles.workPanel} aria-label="Services needing action now">
      <header><div><span>Services needing action now</span><strong>{serviceActionCount}</strong></div><p>{isLive ? "Google Sheet · live read-only" : "Preview only"}</p></header>
      <OperationalCardStack label="Member Savings action work">{displayedTasks.map((task) => <OperationalCard key={task.actionId} title={task.issue} domain={`${task.service} · ${task.actionId}`} status={task.state} progress={actionStageFromStatus(task.state)} action={task.progress} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: task.dueAt ? <time dateTime={task.dueAt}>{date(task.dueAt)}</time> : "No due date recorded" }, { label: "Expected metric", value: task.expectedMetric }, { label: "Progress", value: task.progress }, { label: "Verified result", value: task.verifiedResult }]}>{isLive ? <small>Read-only · status advances automatically from Action_Log and Evidence_Log.</small> : <div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.service}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Evidence received", "Failed evidence", "Systemic pattern"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task.actionId)}>Record locally</button><small>No price, supplier or external action</small></div>}</OperationalCard>)}</OperationalCardStack>
      <p className={styles.soWhat}>{displayedTasks.length ? `So what: ${displayedTasks.length} Sheet-backed service ${displayedTasks.length === 1 ? "action remains" : "actions remain"} open; verified evidence automatically removes ${displayedTasks.length === 1 ? "it" : "them"} from this view.` : "So what: no Sheet-backed Member Savings service action remains open."}</p>
    </section>

    <section className={styles.exceptions} aria-label="Issues needing your review">
      <header><div><span>Issues needing your review</span><strong>{reviewSummary}</strong></div><p>{isLive ? "Action_Log + Evidence_Log + Approval_Log" : "Evidence retained"}</p></header>
      <OperationalCardStack label="Issues needing your review">{isLive ? <>
        {liveEscalations.map((task) => <OperationalCard key={task.actionId} title={task.issue} status={task.state} domain={task.service} action={task.progress} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: task.dueAt ? <time dateTime={task.dueAt}>{date(task.dueAt)}</time> : "No deadline recorded" }]} progress={actionStageFromStatus(task.state)} story={[{ label: "Why it matters", value: task.expectedMetric }, { label: "What Nia already did", value: task.verifiedResult }, { label: "What happens next", value: task.progress }]} />)}
        {pendingApprovals.map((approval) => <OperationalCard key={approval.approvalId} title={approval.title} status="Pending human approval" domain="Member Savings" action={approval.action} fields={[{ label: "Owner", value: approval.owner }, { label: "Due", value: approval.dueAt ? <time dateTime={approval.dueAt}>{date(approval.dueAt)}</time> : "No deadline recorded" }]} progress="evidence" story={[{ label: "Why it matters", value: approval.businessReason || approval.expectedResult || "Business reason not recorded" }, { label: "What Nia already did", value: approval.proposedTerms || "Proposal details are recorded in Approval_Log" }, { label: "What happens next", value: `${approval.owner} approves or rejects the recorded proposal in Approval_Log.` }]} />)}
        {liveReviewCount === 0 ? <p className={styles.emptyState}>No escalated Member Savings action or pending human approval is recorded in the connected Sheet.</p> : null}
      </> : <>{preview.despatchEscalations.map((row) => <OperationalCard key={row.escalationId} title={row.title} status={row.severity} domain="Member Savings" fields={[{ label: "Owner", value: row.ownerRole }, { label: "Due", value: <time dateTime={row.dueAt}>{date(row.dueAt)}</time> }, { label: "Despatch", value: row.status }]} progress={row.status === "Acknowledged" ? "working" : "assigned"} story={[{ label: "Why it matters", value: row.reason }, { label: "What Nia already did", value: `Confirmed the repeated dual-gate failure and routed it to ${row.ownerRole}.` }, { label: "What happens next", value: "Recover both Member savings and Nia margin, then submit verified evidence." }]} />)}<OperationalCard title="Repricing proposal" status="Recommendation only" domain="Member Savings" fields={[{ label: "Owner", value: "Pushkar" }]} story={[{ label: "Why it matters", value: "Price changes affect both Member savings and Nia margin." }, { label: "What Nia already did", value: "Prepared an evidence-backed recommendation without changing the price." }, { label: "What happens next", value: "Pushkar reviews and approves or declines the proposal." }]} progress="evidence" /></>}</OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Versioned controls and pending approvals</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Status</th></tr></thead><tbody>{liveData ? (livePolicyApprovals.length ? livePolicyApprovals.map((approval) => <tr key={approval.approvalId}><td>{approval.title}</td><td>{approval.proposedTerms || approval.expectedResult || "No value recorded"}</td><td>{approval.approvalId}</td><td>{approval.decision}</td></tr>) : <tr><td>No linked policy approval</td><td>No Approval_Log record</td><td>—</td><td>Not recorded</td></tr>) : preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.name}</td><td>{policy.value === null ? "No value approved" : `${policy.value} ${policy.unit}`}</td><td>v{policy.version}</td><td>{policy.status}</td></tr>)}</tbody></table></div></section>
        <section><strong>Weekly savings-message inputs</strong>{isLive ? (liveServices.length ? liveServices.map((service) => <dl key={service.serviceId}><div><dt>Service</dt><dd>{service.serviceName} · {service.studio}</dd></div><div><dt>Recorded saving</dt><dd>₹{service.memberSavingsInr.toLocaleString("en-IN")}</dd></div><div><dt>Freshness</dt><dd>{liveFreshness?.staleFeedCount ? `${liveFreshness.staleFeedCount} connected feed stale` : "Current connected snapshot"}</dd></div><div><dt>Delivery status</dt><dd>{weeklyMessageStatusByServiceId.get(service.serviceId)} · Google Sheet</dd></div></dl>) : <p>No eligible Essentials_Hourly savings input is recorded.</p>) : preview.weeklyMessageInputs.map((input) => <dl key={input.serviceRef}><div><dt>Service</dt><dd>Protected service reference</dd></div><div><dt>Verified saving</dt><dd>{input.verifiedSavingsInr === null ? "Unavailable" : `₹${input.verifiedSavingsInr}`}</dd></div><div><dt>Freshness</dt><dd>{input.dataFreshness}</dd></div><div><dt>Delivery status</dt><dd>{input.mode} · sent {String(input.sent)}</dd></div></dl>)}</section>
        <section><strong>Shared learning-control inputs</strong>{isLive ? (liveLearningRows.length ? liveLearningRows.map((row, index) => <dl className={styles.learningGrid} key={recordedText(row, "id") || `member-savings-learning-${index}`}><div><dt>Proposed change</dt><dd>{recordedText(row, "proposed change") || "Not recorded"}</dd></div><div><dt>Expected effect</dt><dd>{recordedText(row, "expected effect") || "Not recorded"}</dd></div><div><dt>Evidence</dt><dd>{liveSavingsEvidence.length} linked Evidence_Log record{liveSavingsEvidence.length === 1 ? "" : "s"}</dd></div><div><dt>Attribution</dt><dd>{recordedText(row, "attribution") || "Not recorded"}</dd></div><div><dt>Forecast error</dt><dd>Not separately recorded in Learning_History</dd></div><div><dt>Fresh / reversible</dt><dd>{recordedText(row, "disposition") || "Not recorded"} · human governed</dd></div><div><dt>Approved boundary</dt><dd>{livePolicyApprovals.length} recorded approval{livePolicyApprovals.length === 1 ? "" : "s"}</dd></div><div><dt>Human controls</dt><dd>Pricing and supplier decisions require Approval_Log</dd></div><div><dt>Effects</dt><dd>{recordedText(row, "observed", "expected effect") || "Not recorded"}</dd></div><div><dt>Confidence / adoption</dt><dd>{recordedText(row, "confidence") || "Not recorded"} · no automatic adoption</dd></div><div><dt>Rollback</dt><dd>{recordedText(row, "notes") || "Disposition remains governed in Learning_History"}</dd></div></dl>) : <p>No Member Savings row is recorded in Learning_History.</p>) : preview.learningInputs.map((input) => <dl className={styles.learningGrid} key={input.action_id}><div><dt>Proposed change</dt><dd>{input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Approved boundary</dt><dd>{String(input.inside_approved_boundary)} · reverses human decision {String(input.reverses_human_decision)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ") || "No category changed"}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Confidence / adoption</dt><dd>{input.production_confidence} · auto-adopt {String(input.auto_adopt)}</dd></div><div><dt>Rollback</dt><dd>{input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>{isLive ? "Append-only Sheet audit" : "Append-only local shadow audit"}</strong>{isLive ? (liveAuditEvents.length ? <ol>{liveAuditEvents.map((entry) => <li key={`${entry.type}-${entry.id}`}><CheckCircle2 aria-hidden /><span><b>{entry.type} · {entry.state}</b>{entry.id} · {entry.detail}</span>{entry.at && Number.isFinite(Date.parse(entry.at)) ? <time dateTime={entry.at}>{date(entry.at)}</time> : <small>Time not recorded</small>}</li>)}</ol> : <p>No linked Member Savings action, evidence, or approval is recorded.</p>) : audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.outcome} · {entry.verification}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Structural action boundary</strong><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>{isLive ? "This is a read-only projection of connected governed records. RafiQi may detect, rank, assign and verify; it cannot change price, contact a supplier or Member, sign a contract, move money, delist a service, call externally, write Production or adopt policy." : "RafiQi may detect, assign and verify in synthetic shadow state. It cannot change price, contact a supplier or Member, sign a contract, move money, delist a service, call externally, write Production or adopt policy."}</p></section>
      </div>
    </details>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>{isLive && !liveDecisionRequired ? "Decision status" : "Decision required"}</span>
        <strong>{decisionHeading}</strong>
        <p>{decisionDetail}</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{decisionOwner}</dd></div>
        <div><dt>By</dt><dd>{decisionDueAt ? <time dateTime={decisionDueAt}>{date(decisionDueAt)}</time> : <span>{isLive ? "No governed deadline" : "No task due date"}</span>}</dd></div>
      </dl>
    </section>

    <footer className={styles.sourceNote}><FileCheck2 aria-hidden /><span>{isLive ? `${connectedSourceNames} · as of ${date(liveFreshness!.asOf)} · protected references only` : `${preview.source.name} · as of ${date(preview.source.asOf)} · protected references only`}</span><Clock3 aria-hidden /><span>{sourceHealthDetail}</span></footer>
  </DashboardSectionAccordion>
}
