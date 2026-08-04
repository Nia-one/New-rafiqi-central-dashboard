"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { Activity, BellRing, Check, Clock3, Pause, Play, RefreshCw, ShieldCheck } from "lucide-react"
import { HEARTBEAT_POLL_INTERVAL_SECONDS, type EvaluatedHeartbeat, type HeartbeatSnapshot } from "@/lib/heartbeat-control"
import { heartbeatRules } from "@/lib/heartbeat-data"
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
  | { kind: "escalation"; id: string; owner: string; tone: OperationalTone; record: DespatchEscalationRecord }
  | { kind: "heartbeat"; id: string; owner: string; tone: OperationalTone; record: EvaluatedHeartbeat }
  | { kind: "verification"; id: string; owner: string; tone: OperationalTone; record: ReturnType<typeof buildDespatchValidationQueue>[number] }

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

function ownerItemSummary(item: DespatchOwnerItem) {
  if (item.kind === "escalation") return {
    issue: plainEscalationError(item.record), domain: dashboardDisplayLabel(item.record.domain),
    timingLabel: "Due", timing: formatDateTime(item.record.dueAt), action: escalationAction(item.record), optic: escalationOptic(item.record),
  }
  if (item.kind === "heartbeat") {
    const scale = Math.max(item.record.rule.threshold_minutes * 2, item.record.minutes_since_heartbeat)
    return {
      issue: `${item.record.name} went silent`, domain: `${item.record.theatre} · ${item.record.location}`,
      timingLabel: "Due", timing: "Now", action: "Check safety, then confirm",
      optic: { label: `${item.record.minutes_since_heartbeat} min · limit ${item.record.rule.threshold_minutes}`, percent: item.record.minutes_since_heartbeat / scale * 100 },
    }
  }
  return {
    issue: "Proof needs checking", domain: `${item.record.team} · ${item.record.theatre}`,
    timingLabel: "Received", timing: formatDateTime(item.record.closedAt), action: "Validate submitted proof",
    optic: { label: `${item.record.evidence.length} proof submission${item.record.evidence.length === 1 ? "" : "s"}`, percent: 82 },
  }
}

function SignalIdentity({ stream }: { stream: EvaluatedHeartbeat }) {
  return <div className="heartbeat-identity"><strong>{stream.name}</strong><span>{stream.role} · {stream.theatre} · {stream.location}</span></div>
}

export function DespatchScreen({ commitments, escalations = [], escalationTotal = 0, loopHealth, onValidateAction }: { commitments: ExecutionAction[]; escalations?: readonly DespatchEscalationRecord[]; escalationTotal?: number; loopHealth?: LoopHealth; onValidateAction: (actionId: string) => void }) {
  const heartbeatConnected = false
  const [snapshot, setSnapshot] = useState<HeartbeatSnapshot>({
    computed_at: new Date(0).toISOString(), poll_interval_seconds: HEARTBEAT_POLL_INTERVAL_SECONDS,
    persistence: "illustrative-local-server", streams: [], alerts: [], action_log: [],
    summary: { active_streams: 0, signals_current: 0, active_breaches: 0, escalated: 0, outside_active_shift: 0 },
  })
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
    if (!heartbeatConnected) return
    void poll()
  }, [heartbeatConnected, poll])

  useEffect(() => {
    if (!heartbeatConnected || paused) return
    const timer = window.setInterval(() => void poll(), HEARTBEAT_POLL_INTERVAL_SECONDS * 1000)
    return () => window.clearInterval(timer)
  }, [heartbeatConnected, paused, poll])

  const acknowledgedIds = useMemo(() => new Set(snapshot.action_log.filter((entry) => entry.action_type === "alert_acknowledged").map((entry) => entry.heartbeat_id)), [snapshot.action_log])
  const openAlerts = heartbeatConnected ? snapshot.alerts.filter((alert) => !acknowledgedIds.has(alert.id)) : []
  const highestAlert = openAlerts[0]
  const actionLog = snapshot.action_log
  const validationQueue = useMemo(() => buildDespatchValidationQueue(commitments, EXECUTION_REPORT_AS_OF), [commitments])
  const ownerItems: readonly DespatchOwnerItem[] = [
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
  const orderedItems = ownerClusters.flatMap((cluster) => cluster.items)
  const maximumOwnerActions = Math.max(1, ...ownerClusters.map((cluster) => cluster.items.length))
  const workTypes = [
    { label: "Loop exceptions", value: ownerItems.filter((item) => item.kind === "escalation").length },
    { label: "Missing signals", value: ownerItems.filter((item) => item.kind === "heartbeat").length },
    { label: "Proof checks", value: ownerItems.filter((item) => item.kind === "verification").length },
  ]
  const maximumWorkType = Math.max(1, ...workTypes.map((item) => item.value))
  const priority = orderedItems[0]

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

  return <div id="despatch-screen"><DashboardSectionAccordion className="despatch-screen" ariaLabel="Despatch sections" sections={[
    { title: "What needs doing next", summary: `${escalationTotal + openAlerts.length + validationQueue.length} active actions ordered by urgency` },
    { title: "Loop health", summary: loopHealth ? `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` : "Cannot confirm · verification source unavailable" },
    { title: "Who has gone quiet", summary: heartbeatConnected ? `${snapshot.summary.active_breaches} active breaches · ${snapshot.summary.escalated} escalated` : "No governed heartbeat source connected" },
  ]}>
    <section className="heartbeat-section despatch-escalation-section" aria-label="Operate action overview">
      {priority ? <div className="despatch-priority-line" role="status"><span>Start here</span><strong>{priority.owner}</strong><p>{ownerItemSummary(priority).action}</p><small>{ownerItemSummary(priority).issue}</small></div> : null}
      <div className="despatch-chart-grid">
        <figure aria-label="Actions by owner"><figcaption><strong>Actions by owner</strong><span>{ownerClusters.length} owners waiting</span></figcaption><ol>{ownerClusters.map((cluster) => <li key={cluster.owner}><span>{cluster.owner}</span><i aria-hidden><b style={{ "--despatch-bar": `${cluster.items.length / maximumOwnerActions * 100}%` } as CSSProperties} /></i><strong>{cluster.items.length}</strong></li>)}</ol></figure>
        <figure aria-label="Work type distribution"><figcaption><strong>Work needing response</strong><span>{ownerItems.length} visible actions</span></figcaption><ol>{workTypes.map((item) => <li key={item.label}><span>{item.label}</span><i aria-hidden><b style={{ "--despatch-bar": `${item.value / maximumWorkType * 100}%` } as CSSProperties} /></i><strong>{item.value}</strong></li>)}</ol></figure>
      </div>
      <div className="despatch-action-queue" aria-label="Action queue">
        <div className="despatch-action-head" aria-hidden><span>Owner and issue</span><span>Comparison</span><span>Next action</span><span>Timing</span><span /></div>
        <ol>{orderedItems.map((item) => { const summary = ownerItemSummary(item); return <li key={`${item.kind}-${item.id}`}><div className="despatch-action-row">
          <span className="despatch-action-owner"><strong>{item.owner}</strong><small>{summary.issue} · {summary.domain}</small></span>
          <span className="despatch-action-measure"><i aria-hidden><b style={{ "--despatch-bar": `${Math.min(100, summary.optic.percent)}%` } as CSSProperties} /></i><small>{summary.optic.label}</small></span>
          <strong className="despatch-action-next">{summary.action}</strong><span className="despatch-action-time"><small>{summary.timingLabel}</small><strong>{summary.timing}</strong></span>
          {item.kind === "heartbeat" ? <button onClick={() => void acknowledge(item.record.id)} disabled={acknowledgingId === item.record.id}>{acknowledgingId === item.record.id ? "Recording" : "Confirm"}</button> : item.kind === "verification" ? <button onClick={() => validateProof(item.record.id)} disabled={validatingId === item.record.id}>{validatingId === item.record.id ? "Validating" : "Validate"}</button> : <span aria-hidden />}
        </div></li> })}</ol>
      </div>
      {ownerItems.length === 0 ? <div className="despatch-validation-empty"><ShieldCheck aria-hidden /><div><strong>No action needs attention.</strong><span>Nia will place new work here automatically.</span></div></div> : null}
      {validationMessage ? <p className="despatch-validation-message" role="status">{validationMessage}</p> : null}
    </section>

    {loopHealth
      ? <LoopHealthStrip health={loopHealth} />
      : <section className="despatch-validation-empty" aria-label="Loop health unavailable">
          <ShieldCheck aria-hidden />
          <div><strong>Loop health cannot be confirmed.</strong><span>No governed verification source is connected.</span></div>
        </section>}

    {heartbeatConnected ? <details className="system-monitoring-details">
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
    </details> : <section className="despatch-validation-empty" aria-label="Who has gone quiet unavailable">
      <ShieldCheck aria-hidden />
      <div><strong>No governed heartbeat source is connected.</strong><span>The section will populate automatically when live heartbeat signals are available.</span></div>
    </section>}
  </DashboardSectionAccordion></div>
}
