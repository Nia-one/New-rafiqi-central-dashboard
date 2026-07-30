"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, BellRing, Check, Clock3, Pause, Play, RefreshCw, ShieldCheck } from "lucide-react"
import { HEARTBEAT_POLL_INTERVAL_SECONDS, type EvaluatedHeartbeat, type HeartbeatSnapshot } from "@/lib/heartbeat-control"
import { heartbeatRules, initialHeartbeatSnapshot } from "@/lib/heartbeat-data"
import { EXECUTION_REPORT_AS_OF } from "@/lib/execution-data"
import { buildDespatchValidationQueue, type ExecutionAction } from "@/lib/execution-control"
import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import type { DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { OperationalCard, OperationalCardStack, type OperationalOptic, type OperationalTone } from "@/components/operational-card"
import { dashboardDisplayLabel } from "@/lib/dashboard-model"

const rosterLabels = {
  active_shift: "Active shift",
  approved_break: "Approved break",
  off_shift: "Off shift",
  rest_day: "Rest day",
}

const statusLabels = {
  healthy: "Signal current",
  breached: "First breach",
  escalated: "Escalated",
  not_monitored: "Not evaluated",
}

const auditLabels = {
  alert_raised: "Alert raised",
  alert_escalated: "Escalated",
  alert_acknowledged: "Acknowledged",
}

type DespatchOwnerItem =
  | { kind: "live-action"; id: string; owner: string; tone: OperationalTone; record: LiveDespatchAction }
  | { kind: "escalation"; id: string; owner: string; tone: OperationalTone; record: DespatchEscalationRecord }
  | { kind: "heartbeat"; id: string; owner: string; tone: OperationalTone; record: EvaluatedHeartbeat }
  | { kind: "verification"; id: string; owner: string; tone: OperationalTone; record: ReturnType<typeof buildDespatchValidationQueue>[number] }

type SheetRow = Record<string, unknown>
type LiveHeartbeatStream = Readonly<{ id: string; name: string; role: string; theatre: string; studio: string; shift: string; lastAt: string; nextDueAt: string; updatedAt: string; active: boolean; overdueMinutes: number; status: "Current" | "Overdue" | "Escalated" | "Not evaluated" }>
type LiveDespatchAction = Readonly<{ id: string; owner: string; objective: string; metric: string; baseline: string; target: string; dueAt: string; requiredEvidence: string; state: string; nextAction: string; source: string; context: string; rootCause: string; evidenceStatus: string; approvalStatus: string }>
const sheetText = (row: SheetRow, key: string) => String(row[key] ?? "").trim()
const humanActor = (actorId: string) => actorId
  ? actorId.replace(/^ACT-/i, "").split(/[-_]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ")
  : "Owner not recorded"

export function buildLiveDespatchActions(liveData?: { actions?: readonly SheetRow[]; incidents?: readonly SheetRow[]; people?: readonly SheetRow[]; evidence?: readonly SheetRow[]; approvals?: readonly SheetRow[] }): LiveDespatchAction[] {
  if (!liveData) return []
  const terminal = new Set(["verified", "closed", "resolved", "completed", "dismissed", "rejected"])
  const incidents = new Map((liveData.incidents ?? []).map((row) => [sheetText(row, "incident id"), row]))
  const people = new Map((liveData.people ?? []).map((row) => [sheetText(row, "actor id"), row]))
  const evidence = new Map((liveData.evidence ?? []).map((row) => [sheetText(row, "linked id"), row]))
  const approvals = new Map((liveData.approvals ?? []).map((row) => [sheetText(row, "linked action id"), row]))
  return (liveData.actions ?? []).filter((row) => !terminal.has(sheetText(row, "state").toLowerCase())).map((row) => {
    const incident = incidents.get(sheetText(row, "incident id"))
    const actionId = sheetText(row, "action id")
    const actor = people.get(sheetText(row, "owner actor id"))
    const proof = evidence.get(actionId)
    const approval = approvals.get(actionId)
    const state = sheetText(row, "state") || "Open"
    const requiredEvidence = sheetText(row, "required evidence") || "Required evidence not recorded in Action_Log"
    const recordedNext = sheetText(row, "next action")
    const calculatedNext = state.toLowerCase() === "proof submitted"
      ? `Independently verify ${requiredEvidence}`
      : state.toLowerCase() === "proposed" && approval
        ? `Record authorised ${sheetText(approval, "decision type")} decision in Approval_Log`
        : state.toLowerCase() === "reopened"
          ? `Correct and resubmit ${requiredEvidence}`
          : `Complete action and submit ${requiredEvidence}`
    return {
      id: actionId,
      owner: actor ? sheetText(actor, "display name") : humanActor(sheetText(row, "owner actor id")),
      objective: sheetText(row, "operating objective") || "Operating objective not recorded in Action_Log",
      metric: sheetText(row, "expected metric"), baseline: sheetText(row, "baseline value"), target: sheetText(row, "target value"),
      dueAt: sheetText(row, "due at"), requiredEvidence, state, nextAction: recordedNext || calculatedNext,
      source: ["Action_Log", incident && "Incident_Log", approval && "Approval_Log", proof && "Evidence_Log"].filter(Boolean).join(" + "),
      context: incident ? sheetText(incident, "short description") : approval ? sheetText(approval, "business reason") : requiredEvidence,
      rootCause: sheetText(row, "reopen reason") || (incident ? sheetText(incident, "severity reason") : ""),
      evidenceStatus: proof ? sheetText(proof, "verification status") : "No linked Evidence_Log record",
      approvalStatus: approval ? sheetText(approval, "decision") : "No linked Approval_Log record",
    }
  }).sort((left, right) => {
    const reopened = Number(right.state.toLowerCase() === "reopened") - Number(left.state.toLowerCase() === "reopened")
    if (reopened) return reopened
    const leftDue = Date.parse(left.dueAt), rightDue = Date.parse(right.dueAt)
    return (Number.isFinite(leftDue) ? leftDue : Number.MAX_SAFE_INTEGER) - (Number.isFinite(rightDue) ? rightDue : Number.MAX_SAFE_INTEGER)
  })
}

export function buildLiveHeartbeatProjection(liveData?: { asOf?: string; people?: readonly SheetRow[]; theatres?: readonly SheetRow[]; studios?: readonly SheetRow[]; policies?: readonly SheetRow[] }) {
  const asOf = liveData?.asOf && Number.isFinite(Date.parse(liveData.asOf)) ? liveData.asOf : new Date().toISOString()
  const theatreNames = new Map((liveData?.theatres ?? []).map((row) => [sheetText(row, "theatre id"), sheetText(row, "theatre name")]))
  const studioNames = new Map((liveData?.studios ?? []).map((row) => [sheetText(row, "studio id"), sheetText(row, "studio name")]))
  const escalationPolicy = (liveData?.policies ?? []).find((row) => /heartbeat.*escalation/i.test(`${sheetText(row, "policy id")} ${sheetText(row, "name")}`))
  const recordedEscalationText = sheetText(escalationPolicy ?? {}, "value")
  const recordedEscalation = Number(recordedEscalationText)
  const escalationMinutes = recordedEscalationText && Number.isFinite(recordedEscalation) && recordedEscalation >= 0 ? recordedEscalation : null
  const streams: LiveHeartbeatStream[] = (liveData?.people ?? []).filter((row) => sheetText(row, "actor id")).map((row) => {
    const shift = sheetText(row, "active shift") || "Not recorded"
    const shiftStart = Date.parse(sheetText(row, "shift start at")), shiftEnd = Date.parse(sheetText(row, "shift end at")), now = Date.parse(asOf)
    const activeLabel = !/(off|rest|break|leave)/i.test(shift)
    const activeWindow = Number.isFinite(shiftStart) && Number.isFinite(shiftEnd) ? now >= shiftStart && now <= shiftEnd : activeLabel
    const active = activeLabel && activeWindow
    const nextDueAt = sheetText(row, "next heartbeat due at")
    const due = Date.parse(nextDueAt)
    const overdueMinutes = active && Number.isFinite(due) ? Math.max(0, Math.floor((now - due) / 60_000)) : 0
    const status: LiveHeartbeatStream["status"] = !active ? "Not evaluated" : escalationMinutes !== null && overdueMinutes > escalationMinutes ? "Escalated" : overdueMinutes > 0 ? "Overdue" : "Current"
    return { id: sheetText(row, "actor id"), name: sheetText(row, "display name") || sheetText(row, "actor id"), role: sheetText(row, "role") || "Role not recorded", theatre: theatreNames.get(sheetText(row, "theatre id")) || sheetText(row, "theatre id") || "Theatre not recorded", studio: studioNames.get(sheetText(row, "studio id")) || sheetText(row, "studio id") || "Studio not recorded", shift, lastAt: sheetText(row, "last heartbeat at"), nextDueAt, updatedAt: sheetText(row, "updated at"), active, overdueMinutes, status }
  }).sort((left, right) => ({ Escalated: 4, Overdue: 3, Current: 2, "Not evaluated": 1 }[right.status] - ({ Escalated: 4, Overdue: 3, Current: 2, "Not evaluated": 1 }[left.status])))
  return { asOf, escalationMinutes, streams, active: streams.filter((stream) => stream.active), alerts: streams.filter((stream) => stream.status === "Overdue" || stream.status === "Escalated") }
}

function LiveHeartbeatPanel({ liveData }: { liveData: { asOf?: string; people?: readonly SheetRow[]; theatres?: readonly SheetRow[]; studios?: readonly SheetRow[]; policies?: readonly SheetRow[] } }) {
  const projection = useMemo(() => buildLiveHeartbeatProjection(liveData), [liveData])
  const current = projection.active.filter((stream) => stream.status === "Current").length
  const escalated = projection.alerts.filter((stream) => stream.status === "Escalated").length
  const highest = projection.alerts[0]
  return <details className="system-monitoring-details">
    <summary>Who has gone quiet</summary><div className="system-monitoring-body">
      <section className="heartbeat-status-band" aria-label="Live Sheet check-in status"><div><Activity aria-hidden /><p><strong>Connected Google Sheet · read-only</strong><span>People roster evaluated as of {formatDateTime(projection.asOf)}</span></p></div></section>
      {highest ? <section className="heartbeat-priority" aria-live="assertive"><div className="heartbeat-priority-icon"><BellRing aria-hidden /></div><div><p className="heartbeat-kicker">HIGHEST-PRIORITY RECORDED HEARTBEAT GAP</p><strong>{highest.name}</strong><p className="heartbeat-fact">{highest.overdueMinutes} minutes past the recorded next heartbeat due time.</p></div></section> : <section className="heartbeat-clear"><ShieldCheck aria-hidden /><div><strong>No active-shift heartbeat breach is recorded.</strong><span>People outside their recorded shift window are not evaluated.</span></div></section>}
      <section className="heartbeat-metrics" data-kpi-group aria-label="Who has gone quiet"><article><span>ACTIVE STREAMS</span><strong>{projection.active.length}</strong><p>Inside recorded shift windows</p></article><article><span>SIGNALS CURRENT</span><strong>{current}</strong><p>Before recorded next due time</p></article><article><span>ACTIVE BREACHES</span><strong>{projection.alerts.length}</strong><p>Past recorded next due time</p></article><article><span>ESCALATED</span><strong>{escalated}</strong><p>Past governed escalation window</p></article><article><span>NOT EVALUATED</span><strong>{projection.streams.length - projection.active.length}</strong><p>Outside recorded shift window</p></article></section>
      <section className="heartbeat-section"><header><div><p className="heartbeat-kicker">ACTIVE ALERTS</p><h2>Silence that needs a check now</h2></div><p>{projection.alerts.length} live Sheet alert{projection.alerts.length === 1 ? "" : "s"}</p></header>{projection.alerts.length ? <div className="heartbeat-alert-list">{projection.alerts.map((stream, index) => <article key={stream.id}><div className="heartbeat-alert-rank">{String(index + 1).padStart(2, "0")}</div><div className="heartbeat-alert-main"><strong>{stream.name}</strong><p>{stream.role} · {stream.theatre} · {stream.studio}</p><p>{stream.overdueMinutes} min overdue · next heartbeat was due {formatDateTime(stream.nextDueAt)}</p></div><div className="heartbeat-alert-state"><span>{stream.status}</span><small>People</small></div></article>)}</div> : <p className="illustrative-note">No active alert row is derived from the current People Sheet.</p>}</section>
      <section className="heartbeat-section"><header><div><p className="heartbeat-kicker">ALL MONITORED STREAMS</p><h2>Recorded people heartbeat status</h2></div><p>{projection.streams.length} People row{projection.streams.length === 1 ? "" : "s"}</p></header><OperationalCardStack label="Live People heartbeat streams">{projection.streams.map((stream) => <OperationalCard key={stream.id} title={stream.name} domain={`${stream.role} · ${stream.theatre} · ${stream.studio}`} status={stream.status} fields={[{ label: "Shift", value: stream.shift }, { label: "Last signal", value: formatDateTime(stream.lastAt || null) }, { label: "Next due", value: formatDateTime(stream.nextDueAt || null) }, { label: "Source updated", value: formatDateTime(stream.updatedAt || null) }]} action={stream.active ? "Follow the recorded heartbeat control" : "No action outside recorded shift"} showProgress={false} />)}</OperationalCardStack></section>
      <div className="heartbeat-lower-grid"><section className="heartbeat-section heartbeat-rules"><header><div><p className="heartbeat-kicker">GOVERNED RULE</p><h2>What counts as a heartbeat</h2></div></header><p>Next heartbeat due time comes from People. {projection.escalationMinutes === null ? "An escalation threshold is not recorded in Policy_Registry, so no escalation is inferred." : `Escalation occurs ${projection.escalationMinutes} minutes after that recorded deadline.`}</p></section><section className="heartbeat-section heartbeat-audit"><header><div><p className="heartbeat-kicker">GOVERNED AUDIT</p><h2>Alert and acknowledgment log</h2></div></header><p>No local acknowledgment is written. Acknowledgments appear only when a governed Sheet log is connected.</p></section></div>
    </div></details>
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp)) + " IST"
}

function formatDateTime(timestamp: string | null) {
  if (!timestamp) return "Not recorded"
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp)) + " IST"
}

function plainEscalationError(escalation: DespatchEscalationRecord) {
  const source = `${escalation.title} ${escalation.reason}`.toLowerCase()
  if (source.includes("margin") && (source.includes("failed") || source.includes("not recovered"))) return "Margin failed twice"
  if (source.includes("base commitment")) return "Franchise promise missed twice"
  if (source.includes("loaded cac") || source.includes("cost per new member")) return "Member cost over limit"
  if (source.includes("occupancy") && source.includes("below")) return "Studio too empty"
  if (source.includes("fill") && source.includes("overdue")) return "Fill task overdue"
  if ((source.includes("cohort") || source.includes("retention")) && source.includes("65%")) return "Member group leaving fast"
  if (source.includes("dual-gate") || source.includes("service") && source.includes("failure")) return "Service loses money"
  if (source.includes("arrival") && source.includes("moved")) return "Enterprise arrival moved"
  return escalation.title
    .replace(/billing-live/gi, "billing")
    .replace(/dual-gate/gi, "savings and profit")
    .replace(/[.]+$/, "")
}

function escalationAction(escalation: DespatchEscalationRecord) {
  const source = `${escalation.title} ${escalation.reason}`.toLowerCase()
  if (source.includes("margin") && (source.includes("failed") || source.includes("not recovered"))) return "Submit verified proof"
  if (source.includes("base commitment")) return "Start franchise review"
  if (source.includes("loaded cac") || source.includes("cost per new member")) return "Review cost exception"
  if (source.includes("occupancy") && source.includes("below")) return "Restore occupancy"
  if (source.includes("fill") && source.includes("overdue")) return "Escalate overdue fill"
  if ((source.includes("cohort") || source.includes("retention")) && source.includes("65%")) return "Recover member group"
  if (source.includes("dual-gate") || source.includes("supplier") || source.includes("service review")) return "Order supplier review"
  if (source.includes("arrival") && source.includes("moved")) return "Rework the plan"
  return "Recover and submit proof"
}

function escalationOptic(escalation: DespatchEscalationRecord): OperationalOptic {
  const source = `${escalation.title} ${escalation.reason}`
  const money = source.match(/₹\s?([\d.]+).*?(?:above|over|limit|cap).*?₹\s?([\d.]+)/i)
  if (money) {
    const actual = Number(money[1])
    const target = Number(money[2])
    const scale = Math.max(actual, target) * 1.08
    return { label: `₹${actual} · cap ₹${target}`, percent: actual / scale * 100, markerPercent: target / scale * 100 }
  }
  const percent = source.match(/([\d.]+)%.*?(?:below|floor|target).*?([\d.]+)%/i)
  if (percent) {
    const actual = Number(percent[1])
    const target = Number(percent[2])
    if (actual === target && source.toLowerCase().includes("below")) return { label: `Below ${target}% floor`, percent: 78, markerPercent: 99 }
    return { label: `${actual}% · floor ${target}%`, percent: target > 0 ? actual / target * 100 : 0, markerPercent: 99 }
  }
  const lower = source.toLowerCase()
  if (lower.includes("twice") || lower.includes("two cycles")) return { label: "2 of 2 cycles missed", percent: 100, markerPercent: 50 }
  if (lower.includes("overdue")) return { label: "Deadline passed", percent: 100, markerPercent: 72 }
  if (lower.includes("arrival") && lower.includes("moved")) return { label: "Arrival date moved", percent: 78, markerPercent: 50 }
  if (lower.includes("repeated") || lower.includes("failure")) return { label: "Repeated failure", percent: 100, markerPercent: 50 }
  return { label: `${escalation.severity} exception`, percent: escalation.severity === "Critical" ? 100 : escalation.severity === "Breach" ? 82 : 62 }
}

function ownerGroupTone(items: readonly { tone: OperationalTone }[]): OperationalTone {
  const rank: Readonly<Record<OperationalTone, number>> = { critical: 5, breach: 4, attention: 3, neutral: 2, verified: 1 }
  return [...items].sort((left, right) => rank[right.tone] - rank[left.tone])[0]?.tone ?? "neutral"
}

function SignalIdentity({ stream }: { stream: EvaluatedHeartbeat }) {
  return <div className="heartbeat-identity"><strong>{stream.name}</strong><span>{stream.role} · {stream.theatre} · {stream.location}</span></div>
}

export function DespatchScreen({ commitments, escalations = [], escalationTotal = 0, loopHealth, onValidateAction, liveData }: { commitments: ExecutionAction[]; escalations?: readonly DespatchEscalationRecord[]; escalationTotal?: number; loopHealth?: LoopHealth; onValidateAction: (actionId: string) => void; liveData?: { asOf?: string; actions?: readonly SheetRow[]; incidents?: readonly SheetRow[]; people?: readonly SheetRow[]; evidence?: readonly SheetRow[]; approvals?: readonly SheetRow[]; theatres?: readonly SheetRow[]; studios?: readonly SheetRow[]; policies?: readonly SheetRow[] } }) {
  const [snapshot, setSnapshot] = useState<HeartbeatSnapshot>(initialHeartbeatSnapshot)
  const [paused, setPaused] = useState(false)
  const [polling, setPolling] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState("")
  const [pollError, setPollError] = useState("")
  const [actionError, setActionError] = useState("")
  const [validatingId, setValidatingId] = useState("")
  const [validationMessage, setValidationMessage] = useState("")

  const poll = useCallback(async () => {
    setPolling(true)
    try {
      const response = await fetch("/api/heartbeats", { cache: "no-store" })
      if (!response.ok) throw new Error("Heartbeat poll failed.")
      setSnapshot(await response.json() as HeartbeatSnapshot)
      setPollError("")
    } catch {
      setPollError("The latest poll could not be loaded. The last snapshot remains visible.")
    } finally {
      setPolling(false)
    }
  }, [])

  useEffect(() => {
    if (liveData) return
    void poll()
  }, [liveData, poll])

  useEffect(() => {
    if (liveData || paused) return
    const timer = window.setInterval(() => void poll(), HEARTBEAT_POLL_INTERVAL_SECONDS * 1000)
    return () => window.clearInterval(timer)
  }, [liveData, paused, poll])

  const acknowledgedIds = useMemo(() => new Set(snapshot.action_log.filter((entry) => entry.action_type === "alert_acknowledged").map((entry) => entry.heartbeat_id)), [snapshot.action_log])
  const openAlerts = snapshot.alerts.filter((alert) => !acknowledgedIds.has(alert.id))
  const highestAlert = openAlerts[0]
  const actionLog = snapshot.action_log
  const validationQueue = useMemo(() => buildDespatchValidationQueue(commitments, EXECUTION_REPORT_AS_OF), [commitments])
  const liveActions = useMemo(() => buildLiveDespatchActions(liveData), [liveData])
  const liveHeartbeat = useMemo(() => buildLiveHeartbeatProjection(liveData), [liveData])
  const ownerItems: readonly DespatchOwnerItem[] = liveData ? liveActions.map((record): DespatchOwnerItem => ({ kind: "live-action", id: record.id, owner: record.owner, tone: record.state.toLowerCase() === "reopened" ? "critical" : Date.parse(record.dueAt) < Date.now() ? "breach" : "attention", record })) : [
    ...escalations.map((record): DespatchOwnerItem => ({ kind: "escalation", id: record.escalationId, owner: record.ownerRole, tone: record.severity === "Critical" ? "critical" : record.severity === "Breach" ? "breach" : "attention", record })),
    ...openAlerts.map((record): DespatchOwnerItem => ({ kind: "heartbeat", id: record.id, owner: record.role, tone: record.status === "escalated" ? "critical" : "breach", record })),
    ...validationQueue.map((record): DespatchOwnerItem => ({ kind: "verification", id: record.id, owner: record.owner, tone: "attention", record })),
  ]
  const ownerClusters = [...ownerItems.reduce((groups, item) => {
    const current = groups.get(item.owner) ?? []
    current.push(item)
    groups.set(item.owner, current)
    return groups
  }, new Map<string, DespatchOwnerItem[]>()).entries()]
    .map(([owner, items]) => ({ owner, items, tone: ownerGroupTone(items) }))
    .sort((left, right) => {
      const rank: Readonly<Record<OperationalTone, number>> = { critical: 5, breach: 4, attention: 3, neutral: 2, verified: 1 }
      return rank[right.tone] - rank[left.tone] || left.owner.localeCompare(right.owner)
    })

  async function acknowledge(heartbeatId: string) {
    setAcknowledgingId(heartbeatId)
    try {
      const response = await fetch("/api/heartbeats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heartbeat_id: heartbeatId }),
      })
      const result = await response.json() as { snapshot?: HeartbeatSnapshot; error?: string }
      if (!response.ok || !result.snapshot) throw new Error(result.error || "The acknowledgment could not be recorded.")
      setSnapshot(result.snapshot)
      setActionError("")
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The acknowledgment could not be recorded.")
    } finally {
      setAcknowledgingId("")
    }
  }

  function validateProof(actionId: string) {
    setValidatingId(actionId)
    setValidationMessage("")
    onValidateAction(actionId)
    setValidationMessage("Proof validated. The action now has a separate Despatch timestamp.")
    setValidatingId("")
  }

  return <DashboardSectionAccordion className="despatch-screen" ariaLabel="Despatch sections" sections={[
    { title: "What needs doing next", summary: `${ownerItems.length} live Sheet actions ordered by urgency` },
    ...(loopHealth ? [{ title: "Loop health", summary: `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` }] : []),
    { title: "Who has gone quiet", summary: liveData ? `${liveHeartbeat.alerts.length} live Sheet breaches · ${liveHeartbeat.alerts.filter((stream) => stream.status === "Escalated").length} escalated` : `${snapshot.summary.active_breaches} active breaches · ${snapshot.summary.escalated} escalated` },
  ]}>
    <section className="heartbeat-section despatch-escalation-section" aria-labelledby="despatch-escalation-title">
      <header><div><p className="heartbeat-kicker">NEXT ACTIONS</p><h2 id="despatch-escalation-title">What needs doing next</h2></div><p>{ownerItems.length} live Sheet action{ownerItems.length === 1 ? "" : "s"} · ordered by urgency</p></header>
      {ownerClusters.length > 0 ? <div className={`despatch-verdict is-${ownerClusters[0].tone}`} data-tone={ownerClusters[0].tone} role="status">
        <b className="despatch-verdict-pill">{ownerClusters[0].tone === "critical" ? "Act now" : ownerClusters[0].tone === "breach" ? "Breach open" : "Needs attention"}</b>
        <span><strong>{ownerClusters[0].owner}</strong> owns the most urgent action of {ownerClusters.length} owner{ownerClusters.length === 1 ? "" : "s"} waiting.</span>
        <small>So what: each item below closes only on independently verified proof, so start at the top and work down until every owner clears.</small>
      </div> : null}
      <div className="despatch-owner-clusters" aria-label="Actions grouped by owner">
        {ownerClusters.map((cluster) => <section className={`despatch-owner-cluster is-${cluster.tone}`} data-tone={cluster.tone} data-count={cluster.items.length} key={cluster.owner}>
          <header><div><strong>{cluster.owner}</strong><span>{cluster.items.length} action{cluster.items.length === 1 ? "" : "s"}</span></div><i aria-hidden /></header>
          <OperationalCardStack label={`${cluster.owner} actions`}>{cluster.items.map((item) => {
            if (item.kind === "live-action") {
              const action = item.record
              const baseline = Number(action.baseline), target = Number(action.target)
              const hasScale = Number.isFinite(baseline) && Number.isFinite(target) && Math.max(Math.abs(baseline), Math.abs(target)) > 0
              const scale = Math.max(Math.abs(baseline), Math.abs(target), 1)
              return <OperationalCard key={item.id} title={action.objective} subtitle={action.context} status={action.state} tone={item.tone} domain={action.source}
                fields={[{ label: "Owner", value: action.owner }, { label: "Due", value: <time dateTime={action.dueAt}>{formatDateTime(action.dueAt || null)}</time> }]}
                progress={action.state.toLowerCase() === "proof submitted" ? "evidence" : "working"}
                optic={hasScale ? { label: `${action.metric}: ${action.baseline} → ${action.target}`, percent: Math.abs(baseline) / scale * 100, markerPercent: Math.abs(target) / scale * 100 } : undefined}
                action={action.nextAction} cause={action.rootCause || undefined} description={<p>{action.source} · {action.id}</p>} story={[
                  { label: "Why it matters", value: action.metric ? `${action.metric}: recorded baseline ${action.baseline || "not recorded"}; recorded target ${action.target || "not recorded"}.` : action.context },
                  { label: "What Nia already did", value: `Action_Log state: ${action.state}. Evidence_Log: ${action.evidenceStatus}. Approval_Log: ${action.approvalStatus}.` },
                  { label: "What happens next", value: action.nextAction },
                ]} />
            }
            if (item.kind === "escalation") {
              const escalation = item.record
              return <OperationalCard
                key={item.id}
                title={item.owner}
                subtitle={plainEscalationError(escalation)}
                status={escalation.severity}
                tone={item.tone}
                domain={dashboardDisplayLabel(escalation.domain)}
                fields={[{ label: "Due", value: <time dateTime={escalation.dueAt}>{formatDateTime(escalation.dueAt)}</time> }]}
                progress={escalation.severity === "Attention" ? "assigned" : "working"}
                optic={escalationOptic(escalation)}
                action={escalationAction(escalation)}
                description={<p>{escalation.reason}</p>}
                story={[
                  { label: "Why it matters", value: plainEscalationError(escalation) },
                  { label: "What Nia already did", value: `Detected the exception and assigned ${escalation.ownerRole}.` },
                  { label: "What happens next", value: escalationAction(escalation) },
                ]}
              />
            }
            if (item.kind === "heartbeat") {
              const alert = item.record
              const scale = Math.max(alert.rule.threshold_minutes * 2, alert.minutes_since_heartbeat)
              return <OperationalCard
                key={item.id}
                title={item.owner}
                subtitle={`${alert.name} went silent`}
                status={statusLabels[alert.status]}
                tone={item.tone}
                domain={`${alert.theatre} · ${alert.location}`}
                fields={[{ label: "Due", value: "Now" }]}
                progress="assigned"
                optic={{ label: `${alert.minutes_since_heartbeat} min · limit ${alert.rule.threshold_minutes}`, percent: alert.minutes_since_heartbeat / scale * 100, markerPercent: alert.rule.threshold_minutes / scale * 100 }}
                action="Check safety, then confirm"
                story={[
                  { label: "Why it matters", value: `${alert.minutes_since_heartbeat} minutes have passed since the last qualifying signal.` },
                  { label: "What Nia already did", value: alert.status === "escalated" ? "Raised the alert and escalated it after the first response window passed." : "Raised an alert under the configured heartbeat rule." },
                  { label: "What happens next", value: "Check safety, then confirm." },
                ]}
              ><button onClick={() => void acknowledge(alert.id)} disabled={acknowledgingId === alert.id}><Check aria-hidden />{acknowledgingId === alert.id ? "Recording" : "Confirm checked"}</button></OperationalCard>
            }
            const action = item.record
            return <OperationalCard
              key={item.id}
              title={item.owner}
              subtitle="Proof needs checking"
              domain={`${action.team} · ${action.theatre}`}
              status="Evidence received"
              tone={item.tone}
              fields={[{ label: "Received", value: formatDateTime(action.closedAt) }]}
              progress="evidence"
              optic={{ label: `${action.evidence.length} proof submission${action.evidence.length === 1 ? "" : "s"}`, percent: 82, markerPercent: 100 }}
              action="Validate submitted proof"
              story={[
                { label: "Why it matters", value: "The result cannot be counted until someone independent checks the proof." },
                { label: "What Nia already did", value: `Collected ${action.evidence.length} protected proof submission${action.evidence.length === 1 ? "" : "s"}.` },
                { label: "What happens next", value: "Validate submitted proof" },
              ]}
              description={<p>{action.evidence.join(" · ")}</p>}
            ><button onClick={() => validateProof(action.id)} disabled={validatingId === action.id}><Check aria-hidden />{validatingId === action.id ? "Validating" : "Validate proof"}</button></OperationalCard>
          })}</OperationalCardStack>
        </section>)}
      </div>
      {ownerItems.length === 0 ? <div className="despatch-validation-empty"><ShieldCheck aria-hidden /><div><strong>No action needs attention.</strong><span>Nia will place new work here automatically.</span></div></div> : null}
      {validationMessage ? <p className="despatch-validation-message" role="status">{validationMessage}</p> : null}
    </section>

    {loopHealth ? <LoopHealthStrip health={loopHealth} /> : null}

    {liveData ? <LiveHeartbeatPanel liveData={liveData} /> : <details className="system-monitoring-details">
      <summary>Who has gone quiet</summary>
      <div className="system-monitoring-body">
    <section className="heartbeat-status-band" aria-label="Live check-in status">
      <div><Activity aria-hidden /><p><strong>Live check-in status</strong><span>{pollError || `Last poll ${formatTime(snapshot.computed_at)} · next check within ${snapshot.poll_interval_seconds} seconds`}</span></p></div>
      <div className="heartbeat-controls">
        <button onClick={() => void poll()} disabled={polling}><RefreshCw className={polling ? "is-spinning" : ""} aria-hidden />{polling ? "Polling" : "Poll now"}</button>
        <button onClick={() => setPaused((value) => !value)}>{paused ? <Play aria-hidden /> : <Pause aria-hidden />}{paused ? "Resume" : "Pause"}</button>
      </div>
    </section>

    <p className="illustrative-note">Illustrative control data. Live roster, property-visit, gate-visit, and order feeds are not connected yet.</p>

    {highestAlert ? <section className="heartbeat-priority" aria-live="assertive">
      <div className="heartbeat-priority-icon"><BellRing aria-hidden /></div>
      <div>
        <p className="heartbeat-kicker">HIGHEST-PRIORITY UNACKNOWLEDGED ALERT</p>
        <SignalIdentity stream={highestAlert} />
        <p className="heartbeat-fact">{highestAlert.minutes_since_heartbeat} minutes since the last qualifying signal. Rule: {highestAlert.rule_text}.</p>
        {highestAlert.status === "escalated" && <p className="heartbeat-escalation">Unacknowledged past 2× threshold. Escalated to manager / Theatre Head.</p>}
      </div>
      <button onClick={() => void acknowledge(highestAlert.id)} disabled={acknowledgingId === highestAlert.id}><Check aria-hidden />{acknowledgingId === highestAlert.id ? "Recording" : "Acknowledge"}</button>
    </section> : <section className="heartbeat-clear" aria-live="polite"><ShieldCheck aria-hidden /><div><strong>No unacknowledged alerts.</strong><span>Monitoring continues. Acknowledgment does not turn off a rule.</span></div></section>}

    <section className="heartbeat-metrics" data-kpi-group aria-label="Who has gone quiet">
      <article><span>ACTIVE STREAMS</span><strong>{snapshot.summary.active_streams}</strong><p>People and categories in active shifts</p></article>
      <article><span>SIGNALS CURRENT</span><strong>{snapshot.summary.signals_current}</strong><p>Inside the configured heartbeat</p></article>
      <article><span>ACTIVE BREACHES</span><strong>{snapshot.summary.active_breaches}</strong><p>Including acknowledged alerts</p></article>
      <article><span>ESCALATED</span><strong>{snapshot.summary.escalated}</strong><p>Past 2× their threshold</p></article>
      <article><span>NOT EVALUATED</span><strong>{snapshot.summary.outside_active_shift}</strong><p>Break, off shift, or rest day</p></article>
    </section>

    <section className="heartbeat-section">
      <header><div><p className="heartbeat-kicker">ACTIVE ALERTS</p><h2>Silence that needs a check now</h2></div><p>{openAlerts.length} unacknowledged · {snapshot.alerts.length} total</p></header>
      <div className="heartbeat-alert-list">
        {snapshot.alerts.map((alert, index) => {
          const acknowledged = acknowledgedIds.has(alert.id)
          return <article key={alert.id} className={alert.id === highestAlert?.id ? "is-priority" : ""}>
            <div className="heartbeat-alert-rank">{String(index + 1).padStart(2, "0")}</div>
            <div className="heartbeat-alert-main"><SignalIdentity stream={alert} /><p>{alert.minutes_since_heartbeat} min since signal · {alert.rule_text}</p>{alert.checklist && <ul>{alert.checklist.map((item) => <li key={item}><Check aria-hidden />{item}</li>)}</ul>}</div>
            <div className="heartbeat-alert-state"><span>{statusLabels[alert.status]}</span><small>{alert.rule.source_system === "action_log" ? "Action log" : "Order system"}</small></div>
            {acknowledged ? <span className="heartbeat-acknowledged"><Check aria-hidden />Acknowledged</span> : <button onClick={() => void acknowledge(alert.id)} disabled={acknowledgingId === alert.id}>{acknowledgingId === alert.id ? "Recording" : "Acknowledge"}</button>}
          </article>
        })}
      </div>
    </section>

    <section className="heartbeat-section">
      <header><div><p className="heartbeat-kicker">ALL MONITORED STREAMS</p><h2>Who is producing a qualifying signal</h2></div><p>Shift-aware view</p></header>
      <OperationalCardStack label="All monitored heartbeat streams">{snapshot.streams.map((stream) => <OperationalCard key={stream.id} title={stream.name} domain={`${stream.role} · ${stream.theatre} · ${stream.location}`} status={statusLabels[stream.status]} fields={[{ label: "Owner", value: stream.role }, { label: "Last signal", value: `${stream.minutes_since_heartbeat} min ago` }, { label: "Roster", value: rosterLabels[stream.roster_state] }, { label: "Rule", value: `${stream.rule.threshold_minutes} min` }]} />)}</OperationalCardStack>
    </section>

    <div className="heartbeat-lower-grid">
      <section className="heartbeat-section heartbeat-rules">
        <header><div><p className="heartbeat-kicker">CONFIGURED RULES</p><h2>What counts as a heartbeat</h2></div></header>
        <div>{heartbeatRules.map((rule) => <article key={rule.kind}><Clock3 aria-hidden /><div><strong>{rule.label}</strong><p>{rule.definition}</p><p><code>{rule.event_type}</code> · breach after {rule.threshold_minutes} min · escalate after {rule.threshold_minutes * rule.escalation_multiplier} min</p></div><span>{rule.source_system === "action_log" ? "Action log" : "Order system"}</span></article>)}</div>
      </section>

      <section className="heartbeat-section heartbeat-audit">
        <header><div><p className="heartbeat-kicker">APPEND-ONLY AUDIT</p><h2>Alert and acknowledgment log</h2></div><p>Illustrative server log · resets with preview</p></header>
        {actionError && <p className="heartbeat-action-error" role="alert">{actionError}</p>}
        <ol>{actionLog.map((entry) => <li key={entry.id}><span>{formatTime(entry.occurred_at)}</span><div><strong>{auditLabels[entry.action_type]}</strong><p>{entry.actor_id} · {entry.note}</p></div></li>)}</ol>
      </section>
    </div>
      </div>
    </details>}
  </DashboardSectionAccordion>
}
