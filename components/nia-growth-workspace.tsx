"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronDown, Clock3, FileCheck2, Landmark, LockKeyhole, ShieldCheck } from "lucide-react"
import { recoverNiaGrowthAction, verifyNiaGrowthReadiness, type GrowthTaskPreview, type NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { approvalsForDomain } from "@/lib/live-approvals"
import { buildLiveNiaGrowthProjection } from "@/lib/live-mappers/self-drive"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"
import styles from "./nia-growth-workspace.module.css"

type Props = { preview: NiaGrowthPreview; liveData?: any }
type ShadowOutcome = "Unresolved" | "Evidence received" | "Failed evidence" | "Human sign-off required"

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function rowText(row: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function latestTimestamp(rows: readonly Record<string, unknown>[], ...keys: string[]) {
  return rows.flatMap((row) => keys.map((key) => rowText(row, key)))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || ""
}

function earliestTimestamp(rows: readonly Record<string, unknown>[], ...keys: string[]) {
  return rows.flatMap((row) => keys.map((key) => rowText(row, key)))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] || ""
}

function isNiaGrowthAction(row: Record<string, unknown>) {
  const descriptor = `${rowText(row, "action id", "id")} ${rowText(row, "operating objective", "title")} ${rowText(row, "expected metric")}`.toLowerCase()
  return /nia growth|nia-growth|action-grw|growth commitment|fono expansion|shram park|capacity expansion/.test(descriptor)
}

function growthChannel(row: Record<string, unknown>) {
  const ids = `${rowText(row, "demand id")} ${rowText(row, "source submission id")}`.toLowerCase()
  if (ids.includes("ops-rpt-fono") || rowText(row, "role required").toLowerCase() === "living supply") return "FONO"
  if (ids.includes("sp-bot")) return "SP"
  return ""
}

function GrowthLane({ lane, live = false, slaLabel }: { lane: NiaGrowthPreview["lanes"][number]; live?: boolean; slaLabel?: string }) {
  const isFono = lane.supplyModel === "FONO"
  const hasLiveData = !live || lane.plannedNests > 0
  return <article className={styles.lane} data-supply-model={lane.supplyModel}>
    <header>
      <div className={isFono ? styles.fonoMark : styles.spMark}>{isFono ? <Building2 aria-hidden /> : <Landmark aria-hidden />}</div>
      <div><span>{lane.supplyModel === "FONO" ? "FONO" : "SP · Shram Park"}</span><strong>{lane.capacityLabel}</strong></div>
      <b>{hasLiveData ? `${lane.progressPct}% ready` : "No data"}</b>
    </header>
    <div className={styles.capacityTrack} aria-label={`${lane.supplyModel}: ${lane.activationReadyNests} of ${lane.plannedNests} Nests activation-ready`}>
      <i style={{ width: `${lane.progressPct}%` }} />
    </div>
    <dl className={styles.laneMetrics}>
      <div><dt>Capacity</dt><dd>{hasLiveData ? `${lane.activationReadyNests} / ${lane.plannedNests}` : "No data"}</dd><small>{hasLiveData ? `${lane.gapNests} Nest gap` : "No governed channel row"}</small></div>
      <div><dt>Time to ready</dt><dd>{lane.timeToReadyLabel}</dd><small>{live ? slaLabel || "Approved readiness SLA not recorded" : "SLA pending approval"}</small></div>
      <div><dt>{isFono ? "Base / Nia fill" : "Contract coverage"}</dt><dd>{lane.coverageLabel}</dd><small>{lane.coverageDetail}</small></div>
    </dl>
    <div className={styles.stageRail}>{lane.stages.map((stage) => <div data-stage-state={stage.state} key={stage.label}><i /><span>{stage.label}</span><strong>{stage.value}</strong></div>)}</div>
  </article>
}

export function NiaGrowthWorkspace({ preview: fixturePreview, liveData }: Props) {
  const liveProjection = liveData ? buildLiveNiaGrowthProjection(liveData) : null
  const demandRows = Array.isArray(liveData?.enterpriseDemand) ? liveData.enterpriseDemand as Record<string, unknown>[] : []
  const actionRows = Array.isArray(liveData?.actions) ? liveData.actions as Record<string, unknown>[] : []
  const evidenceRows = Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : []
  const approvalRows = Array.isArray(liveData?.approvals) ? liveData.approvals as Record<string, unknown>[] : []
  const growthActions = actionRows.filter(isNiaGrowthAction)
  const growthActionIds = new Set(growthActions.map((row) => rowText(row, "action id", "id")).filter(Boolean))
  const growthEvidence = evidenceRows.filter((row) => growthActionIds.has(rowText(row, "linked id")))
  const verifiedGrowth = growthEvidence.filter((row) => ["verified", "approved", "accepted"].includes(rowText(row, "verification status", "status").toLowerCase())).length
  const reopenedGrowth = growthEvidence.filter((row) => ["reopened", "rejected", "failed"].includes(rowText(row, "verification status", "status").toLowerCase())).length
  const claimedGrowth = Math.max(growthActions.length, growthEvidence.length)
  const awaitingGrowth = Math.max(0, claimedGrowth - verifiedGrowth - reopenedGrowth)
  const growthCandidates = demandRows.filter((row) => growthChannel(row))
  const validLivingRows = growthCandidates.filter((row) => rowText(row, "demand id") && latestTimestamp([row], "updated at", "opened at", "activation required at"))
  const growthRefreshAt = latestTimestamp(validLivingRows, "updated at", "opened at", "activation required at") || rowText(liveData, "asOf")
  const growthQuarantineCount = Math.max(0, growthCandidates.length - validLivingRows.length)
  const hasGovernedFono = validLivingRows.some((row) => growthChannel(row) === "FONO")
  const hasGovernedSp = validLivingRows.some((row) => growthChannel(row) === "SP")
  const liveLoopHealth = liveData ? buildLoopHealth({
    asOf: rowText(liveData, "asOf") || new Date().toISOString(),
    feeds: validLivingRows.length ? [{ feedId: "LIVE-NIA-GROWTH-DEMAND", label: "FONO and Shram Park demand ledger", lastUpdatedAt: latestTimestamp(validLivingRows, "updated at", "opened at", "activation required at"), cadenceMinutes: 60, critical: true, affectedClaims: ["Matched pipeline capacity", "Growth gap"] }] : [],
    clocks: growthActions.filter((row) => Number.isFinite(Date.parse(rowText(row, "due at")))).map((row) => ({ clockId: `LIVE-NIA-GROWTH-${rowText(row, "action id", "id")}`, label: rowText(row, "operating objective", "title") || "Growth readiness", ownerRole: rowText(row, "owner actor id") || "No owner recorded", dueAt: rowText(row, "due at"), state: ["verified", "closed", "resolved"].includes(rowText(row, "state", "status").toLowerCase()) ? "Recovered" as const : "Running" as const })),
    verification: { claimed: claimedGrowth, verified: verifiedGrowth, awaiting: awaitingGrowth, reopened: reopenedGrowth, oldestAwaitingAt: awaitingGrowth ? earliestTimestamp([...growthEvidence, ...growthActions], "uploaded at", "proposed at", "assigned at", "updated at") || rowText(liveData, "asOf") : null },
    quarantinedRecords: growthQuarantineCount,
  }) : null
  const target = liveProjection ? Number((liveProjection.summary.target.match(/\d+/) ?? [0])[0]) : 0
  const current = liveProjection ? Number((liveProjection.summary.current.match(/\d+/) ?? [0])[0]) : 0
  const gap = liveProjection ? Number((liveProjection.summary.gap.match(/\d+/) ?? [0])[0]) : Math.max(0, target - current)
  const owner = liveProjection?.summary.owner || validLivingRows[0]?.["owner actor id"] || fixturePreview.summary.owner
  const growthBehind = gap > 0
  const commandLabel = liveData ? "LIVE GOOGLE SHEET" : fixturePreview.fixtureLabel
  const commandMode = liveData ? "READ-ONLY" : fixturePreview.mode
  const commandQuestion = liveData ? growthBehind ? "Which recorded FONO or Shram Park readiness gap should the accountable owner close next?" : "Does current activation-ready capacity remain at or above the recorded contracted plan?" : fixturePreview.question
  const capacityImplicationSummary = !liveData
    ? "Close readiness and coverage gaps before new capital."
    : !validLivingRows.length
      ? "Capacity implication cannot be confirmed from current governed rows."
      : !growthBehind
        ? "Current governed readiness meets the recorded contracted plan."
        : !hasGovernedSp
          ? "Close the recorded readiness gap; SP coverage cannot be assessed."
          : "Close the recorded channel readiness gap before considering new capital."
  const capacityImplication = !liveData
    ? "So what: the capacity gap is a readiness-and-coverage problem, so it closes by verifying activation-ready Nests, not by committing new capital."
    : !validLivingRows.length
      ? "So what: no current FONO Funnel or Shram Park demand row is available, so the page cannot claim a growth gap or recommend capital action."
      : !growthBehind
        ? "So what: activation-ready capacity currently meets the recorded contracted plan; continue governed monitoring without creating a new capital commitment."
        : !hasGovernedSp
          ? `So what: a ${gap}-Nest gap is recorded in current ${hasGovernedFono ? "FONO" : "channel"} readiness; SP readiness and capital coverage cannot be assessed until a governed SP record is available.`
          : `So what: a ${gap}-Nest readiness gap is recorded across the governed channel rows; close it with verified readiness evidence before any human-approved capital decision.`
  const liveLanes = (["FONO", "SP"] as const).map((supplyModel) => {
    const rows = validLivingRows.filter((row) => growthChannel(row) === supplyModel)
    const plannedNests = rows.reduce((sum, row) => sum + (Number(rowText(row, "headcount required")) || 0), 0)
    const activationReadyNests = rows.reduce((sum, row) => sum + (Number(rowText(row, "headcount matched")) || 0), 0)
    const gapNests = Math.max(0, plannedNests - activationReadyNests)
    const hasRows = rows.length > 0
    const growthApproval = approvalRows.find((row) => rowText(row, "linked action id") === `OPS-NIA-GROWTH-${supplyModel}`)
    const coverage = rowText(growthApproval, "current terms").split(";").slice(1).join(";").trim()
    return {
      supplyModel,
      capacityLabel: supplyModel === "FONO" ? "Franchise-operated, Nia-supported" : "Shram Park",
      plannedNests,
      activationReadyNests,
      gapNests,
      timeToReadyLabel: "Not recorded",
      coverageLabel: coverage || (supplyModel === "FONO" ? "Base / Nia-fill split not recorded" : "Signed contract coverage not recorded"),
      coverageDetail: coverage ? "TEAM_NIA_GROWTH user input · governed Approval_Log sync" : supplyModel === "FONO" ? "FONO Funnel required and matched capacity; complete the black Nia-filled Nests field in TEAM_NIA_GROWTH" : "Shram Park demand required and matched capacity; complete the black signed-contract-covered Nests field in TEAM_NIA_GROWTH",
      progressPct: plannedNests > 0 ? Math.min(100, Math.round(activationReadyNests / plannedNests * 100)) : 0,
      stages: [
        { label: "Required capacity", value: hasRows ? `${plannedNests} recorded` : "Not recorded", state: hasRows ? "Complete" as const : "Open" as const },
        { label: "Matched capacity", value: hasRows ? `${activationReadyNests} recorded` : "Not recorded", state: hasRows && gapNests === 0 ? "Complete" as const : "Open" as const },
        { label: "Channel source", value: supplyModel === "FONO" ? "FONO Funnel" : "Shram Park demand", state: hasRows ? "Complete" as const : "Open" as const },
      ],
    }
  }) as unknown as NiaGrowthPreview["lanes"]
  const growthApprovals = approvalsForDomain(liveData, "nia-growth", true)
  const liveSignOffs = growthApprovals.map((approval) => {
    const linkedEvidence = growthEvidence.filter((row) => rowText(row, "linked id") === approval.linkedActionId)
    const verifiedEvidence = linkedEvidence.filter((row) => ["verified", "approved", "accepted"].includes(rowText(row, "verification status", "status").toLowerCase())).length
    return {
      id: approval.approvalId,
      supplyModel: `${approval.title} ${approval.action}`.toLowerCase().includes("fono") ? "FONO" as const : "SP" as const,
      decision: approval.title,
      owner: approval.owner,
      dueAt: approval.dueAt,
      impact: approval.businessReason || approval.expectedResult || approval.action,
      evidenceState: verifiedEvidence ? `${verifiedEvidence} linked Evidence_Log record${verifiedEvidence === 1 ? "" : "s"} independently verified` : linkedEvidence.length ? `${linkedEvidence.length} linked Evidence_Log record${linkedEvidence.length === 1 ? "" : "s"} awaiting verification` : "No linked Evidence_Log record",
      status: "Pending human approval" as const,
    }
  })
  const liveGrowthTasks = growthActions.filter((action) => !["verified", "closed", "resolved", "complete", "completed"].includes(rowText(action, "state", "status").toLowerCase())).map((action) => {
    const actionId = rowText(action, "action id", "id")
    const ownerActorId = rowText(action, "owner actor id")
    const person = (Array.isArray(liveData?.people) ? liveData.people as Record<string, unknown>[] : []).find((row) => rowText(row, "actor id") === ownerActorId)
    const studioId = rowText(action, "studio id")
    const studio = (Array.isArray(liveData?.studios) ? liveData.studios as Record<string, unknown>[] : []).find((row) => rowText(row, "studio id") === studioId)
    const linkedEvidence = growthEvidence.filter((row) => rowText(row, "linked id") === actionId)
    const verifiedEvidence = linkedEvidence.find((row) => ["verified", "approved", "accepted"].includes(rowText(row, "verification status", "status").toLowerCase()))
    const rejectedEvidence = linkedEvidence.find((row) => ["rejected", "failed", "reopened"].includes(rowText(row, "verification status", "status").toLowerCase()))
    const descriptor = `${rowText(action, "operating objective", "title")} ${rowText(action, "expected metric")}`.toLowerCase()
    const supplyModel = descriptor.includes("fono") ? "FONO" : /shram park|\bsp\b/.test(descriptor) ? "SP" : "Growth"
    return {
      actionId,
      title: rowText(action, "operating objective", "title") || "Growth action not titled",
      domain: [supplyModel, rowText(studio, "studio name") || studioId, actionId].filter(Boolean).join(" · "),
      owner: rowText(person, "display name") || ownerActorId || "No owner recorded",
      dueAt: rowText(action, "due at"),
      state: rowText(action, "state", "status") || "State not recorded",
      progress: rowText(action, "next action") || rowText(action, "required evidence") || "Next action not recorded",
      expectedResult: [rowText(action, "target value"), rowText(action, "expected metric")].filter(Boolean).join(" ") || "Expected result not recorded",
      verifiedResult: verifiedEvidence ? `Verified · ${rowText(verifiedEvidence, "description") || rowText(verifiedEvidence, "evidence id")}` : rejectedEvidence ? `Rejected · ${rowText(rejectedEvidence, "rejected reason") || "Evidence failed"}` : linkedEvidence.length ? "Evidence awaiting independent verification" : "No linked Evidence_Log record",
    }
  })
  const growthLearningRows = (Array.isArray(liveData?.learningHistory) ? liveData.learningHistory as Record<string, unknown>[] : []).filter((row) => rowText(row, "domain").toLowerCase() === "nia growth")
  const growthPolicyRows = (Array.isArray(liveData?.policies) ? liveData.policies as Record<string, unknown>[] : []).filter((row) => /nia growth|growth readiness|capacity expansion/.test(`${rowText(row, "policy id")} ${rowText(row, "policy name", "name")} ${rowText(row, "source note")}`.toLowerCase()))
  const growthClosurePolicy = growthPolicyRows.find((row) => /closure|evidence|ready|readiness/.test(`${rowText(row, "policy name", "name")} ${rowText(row, "source note")}`.toLowerCase()) && ["approved", "active"].includes(rowText(row, "status").toLowerCase()))
  const closureSummary = !liveData ? "Only independently verified ready capacity closes." : growthClosurePolicy ? `Approved closure control · ${rowText(growthClosurePolicy, "policy name", "name")}` : "Approved Nia Growth closure rule not recorded."
  const liveAuditEvents = [
    ...growthActions.map((row) => ({ id: rowText(row, "action id", "id"), type: "Action", status: rowText(row, "state", "status") || "Not recorded", detail: rowText(row, "operating objective", "title") || "Action not titled", at: latestTimestamp([row], "updated at", "proof submitted at", "in progress at", "assigned at", "proposed at") })),
    ...growthEvidence.map((row) => ({ id: rowText(row, "evidence id", "id"), type: "Evidence", status: rowText(row, "verification status", "status") || "Not recorded", detail: rowText(row, "description") || "Evidence description not recorded", at: latestTimestamp([row], "updated at", "uploaded at") })),
    ...growthApprovals.map((row) => ({ id: row.approvalId, type: "Approval", status: row.decision, detail: row.title, at: row.decidedAt || row.dueAt })),
  ].filter((row) => row.id)
  const liveDecision = liveSignOffs[0]
  const decisionTitle = !liveData
    ? `Close the ${fixturePreview.summary.gap} capacity gap by approving the ${fixturePreview.signOffs.length} channel-correct growth decisions waiting.`
    : liveDecision
      ? liveDecision.decision
      : liveGrowthTasks.length
        ? `Review ${liveGrowthTasks.length} open Nia Growth action${liveGrowthTasks.length === 1 ? "" : "s"}.`
        : growthBehind
          ? `Record a governed decision for the ${gap}-Nest readiness gap.`
          : "No growth decision is currently required."
  const decisionDetail = !liveData
    ? `No contract, property or capital action happens automatically; accountability sits with ${fixturePreview.summary.owner} until verified activation-ready capacity meets plan.`
    : liveDecision
      ? `${liveDecision.impact}. ${liveDecision.owner} approves or declines in Approval_Log; no contract, property or capital action occurs automatically.`
      : growthBehind
        ? `The current governed readiness gap remains open; no contract, property or capital action occurs automatically.`
        : "Current governed readiness meets plan; continue read-only monitoring."
  const decisionDeadline = liveData ? liveDecision?.dueAt || liveGrowthTasks[0]?.dueAt || "" : fixturePreview.tasks[0]?.dueAt || ""
  const connectedGrowthSources = [
    validLivingRows.length ? "Enterprise_Demand" : "",
    growthActions.length ? "Action_Log" : "",
    growthEvidence.length ? "Evidence_Log" : "",
    growthApprovals.length ? "Approval_Log" : "",
    growthLearningRows.length ? "Learning_History" : "",
    growthPolicyRows.length ? "Policy_Registry" : "",
  ].filter(Boolean)
  const growthConfidence = rowText(growthLearningRows[0], "confidence") || "Cannot confirm"
  const sourceSummary = liveData ? `${connectedGrowthSources.length} connected Sheet source${connectedGrowthSources.length === 1 ? "" : "s"} · confidence ${growthConfidence}` : `${fixturePreview.source.name} · Production confidence Low`
  const sourceDetail = liveData ? `${connectedGrowthSources.join(" + ") || "No governed Nia Growth source connected"} · as of ${growthRefreshAt ? date(growthRefreshAt) : "not recorded"} · read-only` : `${fixturePreview.source.name} · as of ${date(fixturePreview.source.asOf)} · protected references only`
  const confidenceDetail = liveData ? `${growthConfidence} confidence · ${verifiedGrowth}/${claimedGrowth} outcomes verified · ${growthClosurePolicy ? "closure control recorded" : "closure control not recorded"}` : "Production confidence Low · pending thresholds do not block shadow progress"
  const preview: NiaGrowthPreview = {
    ...fixturePreview,
    loopHealth: liveLoopHealth ?? fixturePreview.loopHealth,
    headline: liveData ? `${current} matched Nests against ${target} required Nests.` : fixturePreview.headline,
    summary: {
      ...fixturePreview.summary,
      target: liveProjection?.summary.target ?? `${target} required Nests`,
      current: liveProjection?.summary.current ?? `${current} matched Nests`,
      gap: liveProjection?.summary.gap ?? `${gap} Nests`,
      owner,
      progress: liveProjection?.summary.progress ?? (target ? `${Math.round(current / target * 100)}%` : "No data"),
      verifiedResult: liveProjection?.summary.verifiedResult ?? `${current} matched Nests from FONO and Shram Park demand`,
    },
    measures: liveProjection?.measures ?? fixturePreview.measures,
    lanes: liveData ? liveLanes : fixturePreview.lanes,
    signOffs: liveData ? liveSignOffs : fixturePreview.signOffs,
  }
  const [tasks, setTasks] = useState<readonly GrowthTaskPreview[]>(preview.tasks)
  const [selected, setSelected] = useState<Record<string, ShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, ShadowOutcome>)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; supplyModel: "FONO" | "SP"; outcome: ShadowOutcome; route: string; at: string }[]>([])

  function recordShadowOutcome(task: GrowthTaskPreview) {
    const outcome = selected[task.actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const recovered = outcome === "Unresolved" ? task.engineAction : recoverNiaGrowthAction(task.engineAction, outcome)
    const verificationInput = outcome === "Failed evidence" ? { ...task.verificationInput, evidenceRef: null, capacityReadyToSpec: false } : task.verificationInput
    const verification = verifyNiaGrowthReadiness(recovered, verificationInput)
    const route = `${recovered.nextAction} ${verification.reasons[0] ?? "Independent readiness verification passed."}`
    setTasks((current) => current.map((row) => row.actionId !== task.actionId ? row : {
      ...row,
      progress: outcome,
      verifiedResult: verification.status,
      state: verification.canClose ? "Verified ready" : outcome === "Evidence received" ? "Awaiting verification" : recovered.state,
      recommendationOnly: recovered.recommendationOnly,
      engineAction: recovered,
    }))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${task.actionId}-${Date.parse(at)}`, actionId: task.actionId, supplyModel: task.supplyModel, outcome, route, at })])
  }

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Nia Growth sections" sections={[
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} verified` },
    { title: "Data freshness", summary: liveData ? `${growthRefreshAt ? `Last refresh ${date(growthRefreshAt)}` : "No valid refresh recorded"} · ${growthQuarantineCount} quarantined` : `Last refresh ${date(preview.source.lastRefreshAt)} · ${preview.quarantineCount} quarantined` },
    { title: "Growth command", summary: `${preview.summary.gap} capacity gap · owner ${preview.summary.owner}` },
    { title: "Growth vs plan", summary: `${preview.summary.current} current · ${preview.summary.target} target` },
    { title: "Headline measures", summary: `${preview.measures.length} readiness controls at a glance` },
    { title: "Capacity implication", summary: capacityImplicationSummary },
    { title: "Growth by channel", summary: "FONO and Shram Park remain separately governed." },
    { title: "Open opportunities", summary: `${liveData ? liveGrowthTasks.length : tasks.length} opportunities need verified action` },
    { title: "Human decisions", summary: `${preview.signOffs.length} growth decisions waiting` },
    { title: "Background record", summary: liveData ? `${liveAuditEvents.length} Sheet audit events · governed controls retained` : `${audit.length} local shadow events · governed controls retained` },
    { title: "Closure rule", summary: closureSummary },
    { title: "Decision required", summary: `Owner ${preview.summary.owner} · ${preview.summary.gap} gap` },
    { title: "Source and confidence", summary: sourceSummary },
  ]}>
    <LoopHealthStrip health={preview.loopHealth} />
    <div className={styles.freshness} role="status">
      <AlertTriangle aria-hidden />
      <strong>{liveData ? validLivingRows.length ? "Connected Google Sheet" : "Cannot confirm live readiness data" : "Stale synthetic fixture"}</strong>
      <span>{liveData ? growthRefreshAt ? `Last refresh ${date(growthRefreshAt)} · Enterprise_Demand read-only` : "No valid FONO or Shram Park refresh recorded" : `Last refresh ${date(preview.source.lastRefreshAt)} · no live connection`}</span>
      <b>{liveData ? growthQuarantineCount : preview.quarantineCount} invalid growth-demand rows quarantined</b>
    </div>

    <section className={styles.taskBand} aria-labelledby="nia-growth-heading">
      <div>
        <span>{commandLabel} · {commandMode}</span>
        <h2 id="nia-growth-heading">{preview.headline}</h2>
        <p>{commandQuestion}</p>
      </div>
      <div className={styles.ownerSummary}><b className={styles.verdictPill} data-state={growthBehind ? "behind" : "on-track"}>{growthBehind ? `Behind plan · ${preview.summary.gap} to add` : "At or above recorded plan"}</b><span>Current owner</span><strong>{preview.summary.owner}</strong><small>Property, finance and expansion decisions stay human-approved</small></div>
    </section>

    <section className={styles.flow} aria-label="Growth vs plan">
      {([
        ["Target", preview.summary.target], ["Current", preview.summary.current], ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner], ["Progress", preview.summary.progress], ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.value}</strong><MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} /><small>{measure.detail}</small></article>)}
    </section>
    <p className={styles.soWhat}>{capacityImplication}</p>

    <section className={styles.lanesPanel} aria-label="Growth by channel">
      <header><div><span>Growth by Channel</span><strong>FONO and Shram Park stay separate</strong></div><p>Capacity · readiness · coverage</p></header>
      <div className={styles.lanes}><GrowthLane lane={preview.lanes[0]} live={Boolean(liveData)} slaLabel={liveProjection?.measures[1].target} /><GrowthLane lane={preview.lanes[1]} live={Boolean(liveData)} slaLabel={liveProjection?.measures[1].target} /></div>
      <p className={styles.soWhat}>So what: FONO and Shram Park have different readiness and coverage gates, so each channel needs its own decision; SP additionally cannot proceed without signed contract coverage.</p>
    </section>

    <section className={styles.workPanel} aria-label="Opportunities needing action">
      <header><div><span>Opportunities needing action</span><strong>{liveData ? liveGrowthTasks.length : tasks.length} opportunities need action</strong></div><p>{liveData ? "Action_Log · read-only" : "Preview only"}</p></header>
      <OperationalCardStack label="Nia Growth channel-correct work">{liveData ? (liveGrowthTasks.length ? liveGrowthTasks.map((task) => <OperationalCard key={task.actionId} title={task.title} domain={task.domain} status={task.state} progress={actionStageFromStatus(task.state)} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: task.dueAt ? <time dateTime={task.dueAt}>{date(task.dueAt)}</time> : "Not recorded" }, { label: "Progress", value: task.progress }, { label: "Expected verified result", value: task.expectedResult }, { label: "Verified result", value: task.verifiedResult }]} />) : <p>No open Nia Growth action is recorded in Action_Log.</p>) : tasks.map((task) => <OperationalCard key={task.actionId} title={task.issue} domain={`${task.supplyModel} · ${task.location} · ${task.actionId}`} status={task.state} progress={actionStageFromStatus(task.state)} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Progress", value: task.progress }, { label: "Expected verified result", value: task.expectedVerifiedResult }, { label: "Verified result", value: task.verifiedResult }]}><div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.supplyModel} ${task.location}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Evidence received", "Failed evidence", "Human sign-off required"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task)}>Record locally</button><small>No property, contract, capital or external action</small></div></OperationalCard>)}</OperationalCardStack>
      <p className={styles.soWhat}>So what: each opportunity closes only on independently verified readiness evidence, so recorded activity without proof does not add capacity.</p>
    </section>

    <section className={styles.signOffPanel} aria-label="Growth decisions waiting">
      <header><div><span>Growth decisions waiting</span><strong>{preview.signOffs.length} growth decisions waiting</strong></div><p>Human approval required</p></header>
      <OperationalCardStack label="Growth decisions waiting">{liveData ? liveSignOffs.map((row) => <OperationalCard key={row.id} title={row.decision} domain={row.supplyModel} status={row.status} fields={[{ label: "Owner", value: row.owner }, { label: "Due", value: row.dueAt ? <time dateTime={row.dueAt}>{date(row.dueAt)}</time> : "Not recorded in linked Action_Log" }]} progress="evidence" story={[{ label: "Why it matters", value: row.impact }, { label: "What Nia already did", value: row.evidenceState }, { label: "What happens next", value: `${row.owner} approves or declines in Approval_Log. No contract, property or capital action occurs automatically.` }]} />) : preview.signOffs.map((row) => <OperationalCard key={row.id} title={row.decision} domain={row.supplyModel} status={row.status} fields={[{ label: "Owner", value: row.owner }, { label: "Due", value: "Before commitment" }]} progress="evidence" story={[{ label: "Why it matters", value: row.impact }, { label: "What Nia already did", value: "Prepared a recommendation using the verified growth and capital evidence." }, { label: "What happens next", value: `${row.owner} approves or declines. No contract, property or capital action occurs automatically.` }]} />)}</OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>{liveData ? "Pending approvals and recorded controls" : "Versioned controls and pending approvals"}</strong><div className={styles.auditTable}><table><thead><tr>{liveData ? <><th>Decision</th><th>Reason</th><th>Approval ID</th><th>Status</th></> : <><th>Policy</th><th>Value</th><th>Version</th><th>Status</th></>}</tr></thead><tbody>{liveData ? (liveSignOffs.length ? liveSignOffs.map((approval) => <tr key={approval.id}><td>{approval.decision}</td><td>{approval.impact}</td><td>{approval.id}</td><td>{approval.status}</td></tr>) : <tr><td>No linked growth approval</td><td>No Approval_Log record</td><td>—</td><td>Not recorded</td></tr>) : preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.name}</td><td>{policy.value === null ? "No value approved" : `${policy.value} ${policy.unit}`}</td><td>v{policy.version}</td><td>{policy.status}</td></tr>)}</tbody></table></div></section>
        <section><strong>Shared learning-control inputs</strong>{liveData ? (growthLearningRows.length ? growthLearningRows.map((input) => <dl className={styles.learningGrid} key={rowText(input, "id") || rowText(input, "updated at")}><div><dt>Observation / proposal</dt><dd>{rowText(input, "observed") || "Not recorded"} · {rowText(input, "proposed change") || "Not recorded"}</dd></div><div><dt>Expected effect</dt><dd>{rowText(input, "expected effect") || "Not recorded"}</dd></div><div><dt>Attribution</dt><dd>{rowText(input, "attribution") || "Not recorded"}</dd></div><div><dt>Confidence / disposition</dt><dd>{rowText(input, "confidence") || "Not recorded"} · {rowText(input, "disposition") || "Not recorded"}</dd></div><div><dt>Owner / updated</dt><dd>{rowText(input, "owner actor id") || "Not recorded"} · {rowText(input, "updated at") ? date(rowText(input, "updated at")) : "Not recorded"}</dd></div><div><dt>Notes</dt><dd>{rowText(input, "notes") || "Not recorded"}</dd></div></dl>) : <p>No Nia Growth record is present in Learning_History.</p>) : preview.learningInputs.map((input) => <dl className={styles.learningGrid} key={input.action_id}><div><dt>Channel / proposal</dt><dd>{input.supply_model} · {input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Approved boundary</dt><dd>{String(input.inside_approved_boundary)} · reverses human decision {String(input.reverses_human_decision)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ") || "No category changed"}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Confidence / adoption</dt><dd>{input.production_confidence} · auto-adopt {String(input.auto_adopt)}</dd></div><div><dt>Rollback</dt><dd>{input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>{liveData ? "Append-only Sheet audit" : "Append-only local shadow audit"}</strong>{liveData ? (liveAuditEvents.length ? <ol>{liveAuditEvents.map((entry) => <li key={`${entry.type}-${entry.id}`}><CheckCircle2 aria-hidden /><span><b>{entry.type} · {entry.status}</b>{entry.id} · {entry.detail}</span>{entry.at ? <time dateTime={entry.at}>{date(entry.at)}</time> : null}</li>)}</ol> : <p>No Nia Growth Action_Log, Evidence_Log or Approval_Log audit event is recorded.</p>) : audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.supplyModel} · {entry.outcome}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Structural action boundary</strong>{liveData ? <><p>{growthPolicyRows.length ? `${growthPolicyRows.length} Nia Growth Policy_Registry record${growthPolicyRows.length === 1 ? "" : "s"} retained.` : "No Nia Growth structural policy is recorded in Policy_Registry."}</p><p>This projection is read-only. It cannot contact anyone, sign a contract or lease, commit capex, release a Studio or park, move money, write Production or adopt policy.</p></> : <><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>RafiQi may detect, recommend, assign and verify in synthetic shadow state. It cannot contact anyone, sign a contract or lease, commit capex, release a Studio or park, move money, write Production or adopt policy.</p></>}</section>
      </div>
    </details>

    <div className={styles.closureRule}><ShieldCheck aria-hidden /><span><strong>Closure rule</strong>{liveData ? growthClosurePolicy ? `${rowText(growthClosurePolicy, "policy name", "name")}: ${rowText(growthClosurePolicy, "policy value", "value") || "control recorded"}${rowText(growthClosurePolicy, "unit") ? ` ${rowText(growthClosurePolicy, "unit")}` : ""}. Status ${rowText(growthClosurePolicy, "status")}.` : "Policy_Registry does not contain an approved Nia Growth closure rule. The read-only projection will not claim capacity closed automatically; evidence and authorised human approval remain required." : "Capacity must be independently verified ready to its channel-specific spec. SP also requires signed contract coverage and contracted build, hardware and service evidence. Activity claims do not close."}</span></div>
    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>{decisionTitle}</strong>
        <p>{decisionDetail}</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{preview.summary.owner}</dd></div>
        {decisionDeadline ? <div><dt>By</dt><dd><time dateTime={decisionDeadline}>{date(decisionDeadline)}</time></dd></div> : <div><dt>By</dt><dd>Not recorded</dd></div>}
      </dl>
    </section>

    <footer className={styles.sourceNote}><FileCheck2 aria-hidden /><span>{sourceDetail}</span><Clock3 aria-hidden /><span>{confidenceDetail}</span></footer>
  </DashboardSectionAccordion>
}
