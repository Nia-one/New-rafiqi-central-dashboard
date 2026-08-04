"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react"
import { recoverMemberEngagementTask, type MemberEngagementPreview, type MemberEngagementShadowOutcome, type MemberEngagementTask, type VerificationResult } from "@/lib/operating-loop/member-engagement-loop"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { compactAge } from "@/lib/operating-loop/loop-health"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import styles from "./member-engagement-workspace.module.css"

type Props = { preview: MemberEngagementPreview }

const months = ["M0", "M1", "M2", "M3", "M4", "M5", "M6"]
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function curvePath(values: readonly (number | null)[]) {
  const points = values.flatMap((value, index) => value === null ? [] : [{ x: 28 + index * 73, y: 22 + (100 - value) * 2.65 }])
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
}

function RetentionCurve({ preview }: Props) {
  return <div className={styles.chartWrap}>
    <svg viewBox="0 0 500 235" role="img" aria-label="Synthetic retention curves by named Member cohort from M0 to M6, compared with the 65 percent floor">
      <title>Retention curve by named cohort with the approved M6 floor.</title>
      {[100, 85, 65].map((value) => {
        const y = 22 + (100 - value) * 2.65
        return <g key={value} className={styles.gridLine}><line x1="28" x2="466" y1={y} y2={y} /><text x="4" y={y + 4}>{value}%</text></g>
      })}
      <line className={styles.floorLine} x1="28" x2="466" y1={22 + 35 * 2.65} y2={22 + 35 * 2.65} />
      <text className={styles.floorLabel} x="462" y={22 + 35 * 2.65 - 7} textAnchor="end">65% M6 floor</text>
      {preview.retentionCurves.map((curve, index) => <g key={curve.cohort} className={styles[`curve${index + 1}`]}>
        <path d={curvePath(curve.values)} />
        {curve.values.map((value, pointIndex) => value === null ? null : <circle key={`${curve.cohort}-${pointIndex}`} cx={28 + pointIndex * 73} cy={22 + (100 - value) * 2.65} r="4" />)}
      </g>)}
      {months.map((month, index) => <text className={styles.axisLabel} x={28 + index * 73} y="225" textAnchor="middle" key={month}>{month}</text>)}
    </svg>
    <div className={styles.legend} aria-label="Retention cohort legend">
      {preview.retentionCurves.map((curve, index) => <span key={curve.cohort}><i className={styles[`legend${index + 1}`]} />{curve.cohort}<small>{curve.memberCount} Members</small></span>)}
    </div>
  </div>
}

export function MemberEngagementWorkspace({ preview }: Props) {
  const [selected, setSelected] = useState<Record<string, MemberEngagementShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, MemberEngagementShadowOutcome>)
  const [tasks, setTasks] = useState<readonly MemberEngagementTask[]>(preview.tasks)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; outcome: MemberEngagementShadowOutcome; verification: VerificationResult["status"]; route: string; at: string }[]>([])

  function recordShadowOutcome(actionId: string) {
    const outcome = selected[actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const task = tasks.find((candidate) => candidate.actionId === actionId)
    if (!task) return
    const transition = recoverMemberEngagementTask(task, outcome)
    setTasks((current) => current.map((candidate) => candidate.actionId === actionId ? transition.task : candidate))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${actionId}-${Date.parse(at)}`, actionId, outcome, verification: transition.verification.status, route: transition.route, at })])
  }

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Member Engagement sections" sections={[
    { title: "Data freshness", summary: `Last refresh ${date(preview.source.lastRefreshAt)} · ${preview.quarantinedCount} quarantined` },
    { title: "Retention command", summary: `${preview.summary.gap} gap to recover · owner ${preview.summary.owner}` },
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} confirmed` },
    { title: "Members saved vs goal", summary: `${preview.summary.current} current · ${preview.summary.target} target` },
    { title: "Headline measures", summary: `${preview.measures.length} retention controls at a glance`, lens: "decide" },
    { title: "Retention implication", summary: "Verified exit-reason recovery is incomplete.", lens: "decide" },
    { title: "Cohorts and recovery", summary: "January is 1 point below the approved floor.", lens: "decide" },
    { title: "Recovery implication", summary: "The remaining at-risk Members determine floor recovery.", lens: "decide" },
    { title: "Members needing action", summary: `${tasks.length} Member actions open`, lens: "operate" },
    { title: "Repeat issues", summary: `${preview.despatchEscalations.length} repeated issues need help` },
    { title: "Background record", summary: `${audit.length} local shadow events · governed controls retained`, lens: "operate" },
    { title: "Decision required", summary: `Recover the ${preview.summary.gap} retention gap` },
    { title: "Source and confidence", summary: `${preview.source.name} · Production confidence Low` },
  ]}>
    <div className={styles.freshness} role="status">
      <AlertTriangle aria-hidden />
      <strong>Governed source snapshot</strong>
      <span>Last refresh {date(preview.source.lastRefreshAt)} · no live connection</span>
      <b>{preview.quarantinedCount} protected-input rows quarantined</b>
    </div>

    <section className={styles.taskBand} aria-labelledby="member-engagement-heading">
      <div>
        <span>{preview.fixtureLabel} · {preview.mode}</span>
        <h2 id="member-engagement-heading">{preview.headline}</h2>
        <p>{preview.question}</p>
      </div>
      <div className={styles.ownerSummary}>
        <b className={styles.verdictPill} data-state="behind">Below 65% floor · {preview.summary.gap} to recover</b>
        <span>Current owner</span>
        <strong>{preview.summary.owner}</strong>
        <small>Role only · Member identity protected</small>
      </div>
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

    <section className={styles.flow} aria-label="Members saved vs goal">
      {([
        ["Target", preview.summary.target],
        ["Current", preview.summary.current],
        ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner],
        ["Progress", preview.summary.progress],
        ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}>
        <span>{measure.label}</span>
        <strong>{measure.value}</strong>
        <MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} />
        <small>{measure.detail}</small>
      </article>)}
    </section>
    <p className={styles.soWhat}>So what: retention sits 1 pp under the floor because verified exit-reason recovery is incomplete, not because churn is broadly rising.</p>

    <div className={styles.primaryGrid}>
      <section className={styles.panel} aria-label="Who is staying, by group">
        <header><div><span>Who is staying, by group</span><strong>January is 1 point below target</strong></div><p>Independent billing outcomes · synthetic</p></header>
        <RetentionCurve preview={preview} />
      </section>

      <section className={`${styles.panel} ${styles.recoveryPanel}`} aria-label="Members won back">
        <header><div><span>Members won back</span><strong>7 of 18 Members recovered</strong></div><p>Confirmed outcomes only</p></header>
        <div className={styles.recoveryGauge}>
          <svg viewBox="0 0 120 120" role="img" aria-label="7 of 18 at-risk Members have verified recovery"><circle className={styles.gaugeTrack} cx="60" cy="60" r="48" /><circle className={styles.gaugeValue} cx="60" cy="60" r="48" pathLength="100" strokeDasharray="39 61" /><text x="60" y="57" textAnchor="middle">7/18</text><text x="60" y="75" textAnchor="middle">verified</text></svg>
          <dl><div><dt>Intervention assigned</dt><dd>14</dd></div><div><dt>Awaiting verification</dt><dd>4</dd></div><div><dt>Reopened</dt><dd>3</dd></div></dl>
        </div>
        <div className={styles.rule}><ShieldCheck aria-hidden /><span><strong>Closure rule</strong>Source signal recovered, a resolved request stays closed, or billing continuity is evidenced.</span></div>
      </section>
    </div>
    <p className={styles.soWhat}>So what: 7 of 18 at-risk Members are verified-recovered, so the remaining 11 recoveries are what actually lifts the cohort back above the floor.</p>

    <section className={styles.workPanel} aria-label="Members needing action now">
      <header><div><span>Members needing action now</span><strong>{tasks.length} Member actions open</strong></div><p>Preview only</p></header>
      <OperationalCardStack label="Member Engagement recovery work">{tasks.map((task) => <OperationalCard key={task.actionId} title={task.memberLabel} domain={`Protected Member · ${task.actionId}`} status={task.state} progress={actionStageFromStatus(task.state)} description={<p>{task.cause}</p>} fields={[{ label: "Owner", value: task.ownerRole }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Progress", value: task.progress }, { label: "Verified result", value: task.verifiedResult }]}><div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.memberLabel}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Recurring request", "Systemic pattern", "Recovery evidence received"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task.actionId)}>Record locally</button><small>No contact or Production write</small></div></OperationalCard>)}</OperationalCardStack>
      <p className={styles.soWhat}>So what: each open action must close on verified evidence, not contact attempts, so effort without proof does not move the recovery count.</p>
    </section>

    <section className={styles.exceptions} aria-label="Repeat issues needing help">
      <header><div><span>Repeat issues needing help</span><strong>{preview.despatchEscalations.length} repeated issues need help</strong></div><p>Confirmed evidence only</p></header>
      <OperationalCardStack label="Repeat issues needing help">{preview.despatchEscalations.map((row) => <OperationalCard key={row.escalationId} title={row.title} status={row.severity} domain="Member Engagement" fields={[{ label: "Owner", value: row.ownerRole }, { label: "Due", value: <time dateTime={row.dueAt}>{date(row.dueAt)}</time> }, { label: "Despatch", value: row.status }]} progress={row.status === "Acknowledged" ? "working" : "assigned"} story={[{ label: "Why it matters", value: row.reason }, { label: "What Nia already did", value: `Verified the recurrence and routed the exception to ${row.ownerRole}.` }, { label: "What happens next", value: "Resolve the Member issue and submit evidence that the service outcome recovered." }]} />)}</OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Survey and behavioural NPS</strong><dl><div><dt>Survey NPS</dt><dd>{preview.npsDrilldown.survey.score} · {preview.npsDrilldown.survey.method}<small>{preview.npsDrilldown.survey.inputs}</small></dd></div><div><dt>Behavioural NPS</dt><dd>{preview.npsDrilldown.behavioural.score} · {preview.npsDrilldown.behavioural.method}<small>{preview.npsDrilldown.behavioural.inputs}</small></dd></div><div><dt>Gap</dt><dd>{preview.npsDrilldown.gap} points<small>Drill-down only; neither score independently closes an action.</small></dd></div></dl></section>
        <section><strong>Verified exit-reason movement</strong><div className={styles.movementList}>{preview.exitReasonMovements.map((movement) => <div key={movement.reason}><span>{movement.reason}</span><b>{movement.current}</b><small>Baseline {movement.baseline}</small></div>)}</div></section>
        <section><strong>Versioned domain controls</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Approval</th></tr></thead><tbody>{preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.policyId}</td><td>{policy.value} {policy.unit}</td><td>v{policy.version}</td><td>{policy.approvedBy}</td></tr>)}</tbody></table></div></section>
        <section><strong>Shared learning-gate inputs</strong>{preview.learningInputs.map((input) => <dl key={input.action_id} className={styles.learningGrid}><div><dt>Proposed change</dt><dd>{input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ") || "No human-controlled category changed"}</dd></div><div><dt>Confidence / adoption</dt><dd>{input.production_confidence} · auto-adopt {String(input.auto_adopt)}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Rollback</dt><dd>{input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>Append-only local shadow audit</strong>{audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.outcome} · {entry.verification}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Weekly message and action boundary</strong><p>Approved template, consent, language, opt-out and quiet hours remain required. Verified spend/savings or an approved non-numerical check only; no free-form text, promotions or offers.</p><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p></section>
      </div>
    </details>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Recover the {preview.summary.gap} retention gap by verifying the remaining at-risk Member recoveries.</strong>
        <p>Only independently verified recoveries count; accountability sits with {preview.summary.owner} until the Coromandel cohort is back above the 65% M6 floor.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{preview.summary.owner}</dd></div>
        <div><dt>By</dt><dd><time dateTime={preview.tasks[0].dueAt}>{date(preview.tasks[0].dueAt)}</time></dd></div>
      </dl>
    </section>

    <footer className={styles.sourceNote}><ShieldCheck aria-hidden /><span>{preview.source.name} · as of {date(preview.source.asOf)} · protected role-gated references only</span><Clock3 aria-hidden /><span>Production confidence Low · no domain-side auto-adoption</span></footer>
  </DashboardSectionAccordion>
}
