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

function SignalIdentity({ stream }: { stream: EvaluatedHeartbeat }) {
  return <div className="heartbeat-identity"><strong>{stream.name}</strong><span>{stream.role} · {stream.theatre} · {stream.location}</span></div>
}

export function DespatchScreen({ commitments, escalations = [], escalationTotal = 0, loopHealth, onValidateAction }: { commitments: ExecutionAction[]; escalations?: readonly DespatchEscalationRecord[]; escalationTotal?: number; loopHealth?: LoopHealth; onValidateAction: (actionId: string) => void }) {
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
    void poll()
  }, [poll])

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => void poll(), HEARTBEAT_POLL_INTERVAL_SECONDS * 1000)
    return () => window.clearInterval(timer)
  }, [paused, poll])

  const acknowledgedIds = useMemo(() => new Set(snapshot.action_log.filter((entry) => entry.action_type === "alert_acknowledged").map((entry) => entry.heartbeat_id)), [snapshot.action_log])
  const openAlerts = snapshot.alerts.filter((alert) => !acknowledgedIds.has(alert.id))
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
    { title: "What needs doing next", summary: `${escalationTotal + openAlerts.length + validationQueue.length} active actions ordered by urgency` },
    ...(loopHealth ? [{ title: "Loop health", summary: `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` }] : []),
    { title: "Who has gone quiet", summary: `${snapshot.summary.active_breaches} active breaches · ${snapshot.summary.escalated} escalated` },
  ]}>
    <section className="heartbeat-section despatch-escalation-section" aria-labelledby="despatch-escalation-title">
      <header><div><p className="heartbeat-kicker">NEXT ACTIONS</p><h2 id="despatch-escalation-title">What needs doing next</h2></div><p>{escalationTotal + openAlerts.length + validationQueue.length} active · ordered by urgency</p></header>
      {ownerClusters.length > 0 ? <div className={`despatch-verdict is-${ownerClusters[0].tone}`} data-tone={ownerClusters[0].tone} role="status">
        <b className="despatch-verdict-pill">{ownerClusters[0].tone === "critical" ? "Act now" : ownerClusters[0].tone === "breach" ? "Breach open" : "Needs attention"}</b>
        <span><strong>{ownerClusters[0].owner}</strong> owns the most urgent action of {ownerClusters.length} owner{ownerClusters.length === 1 ? "" : "s"} waiting.</span>
        <small>So what: each item below closes only on independently verified proof, so start at the top and work down until every owner clears.</small>
      </div> : null}
      <div className="despatch-owner-clusters" aria-label="Actions grouped by owner">
        {ownerClusters.map((cluster) => <section className={`despatch-owner-cluster is-${cluster.tone}`} data-tone={cluster.tone} data-count={cluster.items.length} key={cluster.owner}>
          <header><div><strong>{cluster.owner}</strong><span>{cluster.items.length} action{cluster.items.length === 1 ? "" : "s"}</span></div><i aria-hidden /></header>
          <OperationalCardStack label={`${cluster.owner} actions`}>{cluster.items.map((item) => {
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

    <details className="system-monitoring-details">
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
    </details>
  </DashboardSectionAccordion>
}
