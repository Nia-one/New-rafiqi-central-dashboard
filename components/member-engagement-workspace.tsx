"use client"

import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react"
import { type MemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { MeasureViz } from "@/components/measure-viz"
import { compactAge } from "@/lib/operating-loop/loop-health"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { approvalsForDomain } from "@/lib/live-approvals"
import { buildLiveMemberEngagementActions, buildLiveMemberEngagementBackground, buildLiveMemberEngagementCommand, buildLiveMemberEngagementFreshness, buildLiveMemberEngagementHeadlineMeasures, buildLiveMemberEngagementLoopHealth, buildLiveMemberEngagementRepeatIssues } from "@/lib/live-mappers/self-drive"
import styles from "./member-engagement-workspace.module.css"

type Props = { preview: MemberEngagementPreview; liveData?: any }

const months = ["M0", "M1", "M2", "M3", "M4", "M5", "M6"]
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function curvePath(values: readonly (number | null)[]) {
  const points = values.flatMap((value, index) => value === null ? [] : [{ x: 28 + index * 73, y: 22 + (100 - value) * 2.65 }])
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
}

function RetentionCurve({ preview, floor, live = false }: Props & { floor?: number | null; live?: boolean }) {
  const gridValues = floor === null || floor === undefined ? [100, 85] : [100, 85, floor]
  return <div className={styles.chartWrap}>
    <svg viewBox="0 0 500 235" role="img" aria-label={`${live ? "Sheet-backed" : "Synthetic"} retention curves by named Member cohort from M0 to M6${floor === null || floor === undefined ? "; no governed floor is recorded" : `, compared with the ${floor} percent floor`}`}>
      <title>{floor === null || floor === undefined ? "Retention curve by named cohort; no governed M6 floor is recorded." : `Retention curve by named cohort with the approved ${floor}% M6 floor.`}</title>
      {gridValues.map((value) => {
        const y = 22 + (100 - value) * 2.65
        return <g key={value} className={styles.gridLine}><line x1="28" x2="466" y1={y} y2={y} /><text x="4" y={y + 4}>{value}%</text></g>
      })}
      {floor === null || floor === undefined ? null : <><line className={styles.floorLine} x1="28" x2="466" y1={22 + (100 - floor) * 2.65} y2={22 + (100 - floor) * 2.65} /><text className={styles.floorLabel} x="462" y={22 + (100 - floor) * 2.65 - 7} textAnchor="end">{floor}% M6 floor</text></>}
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

export function MemberEngagementWorkspace({ preview: fixturePreview, liveData }: Props) {
  const isLive = Boolean(liveData)
  const openIncidents = liveData?.summary?.openIncidents ?? 0
  const openActions = liveData?.summary?.openActions ?? 0
  const owner = liveData?.incidents?.[0]?.["owner actor id"] || liveData?.actions?.[0]?.["owner actor id"] || (isLive ? "Unassigned" : fixturePreview.summary.owner)
  const livePolicyApprovals = approvalsForDomain(liveData, "member-engagement")
  const liveFreshness = liveData ? buildLiveMemberEngagementFreshness(liveData) : null
  const liveCommand = liveData ? buildLiveMemberEngagementCommand(liveData) : null
  const liveLoopHealth = liveData ? buildLiveMemberEngagementLoopHealth(liveData) : null
  const liveHeadlineMeasures = liveData ? buildLiveMemberEngagementHeadlineMeasures(liveData) : null
  const liveActions = liveData ? buildLiveMemberEngagementActions(liveData) : null
  const liveRepeatIssues = liveData ? buildLiveMemberEngagementRepeatIssues(liveData) : null
  const liveBackground = liveData ? buildLiveMemberEngagementBackground(liveData) : null
  const preview: MemberEngagementPreview = {
    ...fixturePreview,
    loopHealth: isLive ? liveLoopHealth! : fixturePreview.loopHealth,
    measures: isLive ? liveHeadlineMeasures!.measures : fixturePreview.measures,
    retentionCurves: isLive ? liveHeadlineMeasures!.retentionCurves : fixturePreview.retentionCurves,
    headline: isLive
      ? liveCommand!.hasData
        ? `${liveCommand!.openSignals} open Member-impacting signals need verified recovery.`
        : "No Member-impacting recovery command is recorded."
      : fixturePreview.headline,
    summary: {
      ...fixturePreview.summary,
      target: isLive ? liveCommand!.hasData ? `${liveCommand!.targetRecovered} recovered Members` : "Not recorded" : `${openActions} actions due`,
      current: isLive ? liveCommand!.hasData ? `${liveCommand!.baselineRecovered} recovered Members` : "Not recorded" : `${openIncidents} incidents open`,
      gap: isLive ? liveCommand!.hasData ? String(liveCommand!.recoveryGap) : "Not recorded" : String(Math.max(0, openIncidents - openActions)),
      owner: isLive ? liveCommand!.owner : owner,
      progress: isLive ? liveCommand!.hasData ? `${liveCommand!.targetRecovered === 0 ? 0 : Math.min(100, Math.round(liveCommand!.baselineRecovered / liveCommand!.targetRecovered * 100))}%` : "Not recorded" : `${openActions === 0 ? 100 : Math.min(100, Math.round((openActions - openIncidents) / openActions * 100))}%`,
      verifiedResult: isLive ? `${liveLoopHealth!.verification.verified} independently verified recoveries` : `${liveData?.summary?.verifiedActivations ?? 0} verified activations`,
    },
  }
  const tasks = liveActions ?? preview.tasks
  const repeatIssues = liveRepeatIssues ?? preview.despatchEscalations
  const audit: readonly { id: string; actionId: string; outcome: string; verification: string; route: string; at: string }[] = []

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Member Engagement sections" sections={[
    { title: "Data freshness", summary: isLive ? `Google Sheet refresh ${date(liveFreshness!.asOf)} · ${liveFreshness!.feeds.length} connected feeds${liveFreshness!.staleFeedCount ? ` · ${liveFreshness!.staleFeedCount} stale` : ""}` : `Last refresh ${date(preview.source.lastRefreshAt)} · ${preview.quarantinedCount} quarantined` },
    { title: "Retention command", summary: `${preview.summary.gap} gap to recover · owner ${preview.summary.owner}` },
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} confirmed` },
    { title: "Members saved vs goal", summary: `${preview.summary.current} current · ${preview.summary.target} target` },
    { title: "Headline measures", summary: `${preview.measures.length} retention controls at a glance` },
    { title: "Retention implication", summary: liveHeadlineMeasures?.retentionImplicationSummary ?? "Verified exit-reason recovery is incomplete." },
    { title: "Cohorts and recovery", summary: liveHeadlineMeasures?.cohortSummary ?? "January is 1 point below the approved floor." },
    { title: "Recovery implication", summary: liveHeadlineMeasures ? `${Math.max(0, liveHeadlineMeasures.recovery.total - liveHeadlineMeasures.recovery.verified)} at-risk Members remain against the recorded recovery target.` : "The remaining at-risk Members determine floor recovery." },
    { title: "Members needing action", summary: `${tasks.length} Member actions open` },
    { title: "Repeat issues", summary: `${repeatIssues.length} repeated issues need help` },
    { title: "Background record", summary: liveBackground ? `${liveBackground.eventCount} Sheet audit events · governed controls retained` : `${audit.length} local shadow events · governed controls retained` },
    { title: "Decision required", summary: `Recover the ${preview.summary.gap} retention gap` },
    { title: "Source and confidence", summary: isLive ? `${liveBackground!.source.count} connected Sheet sources · confidence ${liveBackground!.source.confidence}` : `${preview.source.name} · Production confidence Low` },
  ]}>
    <div className={styles.freshness} role="status">
      <AlertTriangle aria-hidden />
      <strong>{isLive ? liveFreshness!.connected ? liveFreshness!.staleFeedCount ? `${liveFreshness!.staleFeedCount} connected source${liveFreshness!.staleFeedCount === 1 ? " is" : "s are"} stale` : "Google Sheet sources current" : "No Member Engagement source rows recorded" : "Stale synthetic fixture"}</strong>
      <span>{isLive ? `Sheet snapshot ${date(liveFreshness!.asOf)} · ${liveFreshness!.feeds.length} configured feeds${liveFreshness!.feeds.length ? ` · oldest ${[...liveFreshness!.feeds].sort((left, right) => right.ageMinutes - left.ageMinutes)[0].label} ${[...liveFreshness!.feeds].sort((left, right) => right.ageMinutes - left.ageMinutes)[0].ageLabel}` : ""}` : `Last refresh ${date(preview.source.lastRefreshAt)} · no live connection`}</span>
      <b>{isLive ? liveFreshness!.quarantinedRecords : preview.quarantinedCount} protected-input rows quarantined</b>
    </div>

    <section className={styles.taskBand} aria-labelledby="member-engagement-heading">
      <div>
        <span>{isLive ? "Google Sheet · live read-only" : `${preview.fixtureLabel} · ${preview.mode}`}</span>
        <h2 id="member-engagement-heading">{preview.headline}</h2>
        <p>{isLive ? liveCommand!.hasData ? `${liveCommand!.baselineRecovered} recovered Members are recorded against a target of ${liveCommand!.targetRecovered}; every remaining signal needs independently verified recovery.` : "No recovery target or baseline is recorded in the connected Sheet sources." : preview.question}</p>
      </div>
      <div className={styles.ownerSummary}>
        <b className={styles.verdictPill} data-state="behind">{isLive ? liveCommand!.hasData ? `Recovery target · ${preview.summary.gap} to recover` : "Recovery target · not recorded" : `Below 65% floor · ${preview.summary.gap} to recover`}</b>
        <span>Current owner</span>
        <strong>{preview.summary.owner}</strong>
        <small>{isLive ? liveCommand!.hasData ? `${liveCommand!.state}${liveCommand!.dueAt ? ` · due ${date(liveCommand!.dueAt)}` : ""}` : "No governed recovery action recorded" : "Role only · Member identity protected"}</small>
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
    <p className={styles.soWhat}>{liveHeadlineMeasures?.implication ?? "So what: retention sits 1 pp under the floor because verified exit-reason recovery is incomplete, not because churn is broadly rising."}</p>

    <div className={styles.primaryGrid}>
      <section className={styles.panel} aria-label="Who is staying, by group">
        <header><div><span>Who is staying, by group</span><strong>{liveHeadlineMeasures?.cohortSummary ?? "January is 1 point below target"}</strong></div><p>{isLive ? liveHeadlineMeasures!.retentionCurves.length ? "Google Sheet cohort observations" : "No Sheet cohort observations recorded" : "Independent billing outcomes · synthetic"}</p></header>
        <RetentionCurve preview={preview} floor={isLive ? liveHeadlineMeasures!.retentionFloor : 65} live={Boolean(liveHeadlineMeasures?.retentionCurves.length)} />
      </section>

      <section className={`${styles.panel} ${styles.recoveryPanel}`} aria-label="Members won back">
        <header><div><span>Members won back</span><strong>{isLive ? `${liveHeadlineMeasures!.recovery.verified} of ${liveHeadlineMeasures!.recovery.total} Members recovered` : "7 of 18 Members recovered"}</strong></div><p>Confirmed outcomes only</p></header>
        <div className={styles.recoveryGauge}>
          <svg viewBox="0 0 120 120" role="img" aria-label={`${isLive ? liveHeadlineMeasures!.recovery.verified : 7} of ${isLive ? liveHeadlineMeasures!.recovery.total : 18} at-risk Members have verified recovery`}><circle className={styles.gaugeTrack} cx="60" cy="60" r="48" /><circle className={styles.gaugeValue} cx="60" cy="60" r="48" pathLength="100" strokeDasharray={`${isLive ? liveHeadlineMeasures!.recovery.total ? Math.round(liveHeadlineMeasures!.recovery.verified / liveHeadlineMeasures!.recovery.total * 100) : 0 : 39} ${100 - (isLive ? liveHeadlineMeasures!.recovery.total ? Math.round(liveHeadlineMeasures!.recovery.verified / liveHeadlineMeasures!.recovery.total * 100) : 0 : 39)}`} /><text x="60" y="57" textAnchor="middle">{isLive ? `${liveHeadlineMeasures!.recovery.verified}/${liveHeadlineMeasures!.recovery.total}` : "7/18"}</text><text x="60" y="75" textAnchor="middle">verified</text></svg>
          <dl><div><dt>Intervention assigned</dt><dd>{isLive ? liveHeadlineMeasures!.recovery.interventions : 14}</dd></div><div><dt>Awaiting verification</dt><dd>{isLive ? liveHeadlineMeasures!.recovery.awaiting : 4}</dd></div><div><dt>Reopened</dt><dd>{isLive ? liveHeadlineMeasures!.recovery.reopened : 3}</dd></div></dl>
        </div>
        <div className={styles.rule}><ShieldCheck aria-hidden /><span><strong>Closure rule</strong>{liveHeadlineMeasures?.recovery.closureRule ?? "Source signal recovered, a resolved request stays closed, or billing continuity is evidenced."}</span></div>
      </section>
    </div>
    <p className={styles.soWhat}>{liveHeadlineMeasures ? `So what: ${liveHeadlineMeasures.recovery.verified} of ${liveHeadlineMeasures.recovery.total} at-risk Members are recovered; ${Math.max(0, liveHeadlineMeasures.recovery.total - liveHeadlineMeasures.recovery.verified)} remain against the recorded recovery target.` : "So what: 7 of 18 at-risk Members are verified-recovered, so the remaining 11 recoveries are what actually lifts the cohort back above the floor."}</p>

    <section className={styles.workPanel} aria-label="Members needing action now">
      <header><div><span>Members needing action now</span><strong>{tasks.length} Member actions open</strong></div><p>{liveActions ? "Google Sheet · live read-only" : "Preview only"}</p></header>
      <OperationalCardStack label="Member Engagement recovery work">{tasks.map((task) => {
        const liveTask = "category" in task
        const owner = liveTask ? task.owner : task.ownerRole
        const action = liveTask ? task.action : task.cause
        return <OperationalCard key={task.actionId} title={task.memberLabel} domain={`${liveTask ? task.category : "Protected Member"} · ${task.actionId}`} status={task.state} progress={actionStageFromStatus(task.state)} description={<p>{action}</p>} fields={[{ label: "Owner", value: owner }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Progress", value: task.progress }, { label: "Verified result", value: task.verifiedResult }]}>{liveTask ? <small>Read-only · status advances from Action_Log and Evidence_Log.</small> : null}</OperationalCard>
      })}</OperationalCardStack>
      <p className={styles.soWhat}>{liveActions ? `So what: ${tasks.length} Sheet-backed Member recovery action${tasks.length === 1 ? " remains" : "s remain"} open; only independently verified evidence can close ${tasks.length === 1 ? "it" : "them"}.` : "So what: each open action must close on verified evidence, not contact attempts, so effort without proof does not move the recovery count."}</p>
    </section>

    <section className={styles.exceptions} aria-label="Repeat issues needing help">
      <header><div><span>Repeat issues needing help</span><strong>{repeatIssues.length} repeated issues need help</strong></div><p>{liveRepeatIssues ? "Google Sheet · live read-only" : "Confirmed evidence only"}</p></header>
      <OperationalCardStack label="Repeat issues needing help">{repeatIssues.map((row) => {
        const liveIssue = "incidentId" in row
        const id = liveIssue ? row.incidentId : row.escalationId
        const owner = liveIssue ? row.owner : row.ownerRole
        const state = liveIssue ? row.state : row.status
        const action = liveIssue ? row.action : "Resolve the Member issue"
        const why = liveIssue ? row.whyItMatters : row.reason
        const already = liveIssue ? row.alreadyDid : `Verified the recurrence and routed the exception to ${row.ownerRole}.`
        const next = liveIssue ? row.whatHappensNext : "Resolve the Member issue and submit evidence that the service outcome recovered."
        return <OperationalCard key={id} title={row.title} status={liveIssue ? state : row.severity} domain={`Member Engagement · ${id}`} action={action} fields={[{ label: "Owner", value: owner }, { label: "Due", value: <time dateTime={row.dueAt}>{date(row.dueAt)}</time> }, { label: "Despatch", value: state }]} progress={actionStageFromStatus(state)} story={[{ label: "Why it matters", value: why }, { label: "What Nia already did", value: already }, { label: "What happens next", value: next }]} />
      })}</OperationalCardStack>
      {liveRepeatIssues ? <p className={styles.soWhat}>So what: {repeatIssues.length} recurring Member issue{repeatIssues.length === 1 ? " remains" : "s remain"} open; verified evidence automatically removes resolved issues from this escalation view.</p> : null}
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Survey and behavioural NPS</strong><dl><div><dt>Survey NPS</dt><dd>{liveBackground?.nps.survey.score ?? preview.npsDrilldown.survey.score} · {liveBackground?.nps.survey.method ?? preview.npsDrilldown.survey.method}<small>{liveBackground?.nps.survey.inputs ?? preview.npsDrilldown.survey.inputs}</small></dd></div><div><dt>Behavioural NPS</dt><dd>{liveBackground?.nps.behavioural.score ?? preview.npsDrilldown.behavioural.score} · {liveBackground?.nps.behavioural.method ?? preview.npsDrilldown.behavioural.method}<small>{liveBackground?.nps.behavioural.inputs ?? preview.npsDrilldown.behavioural.inputs}</small></dd></div><div><dt>Gap</dt><dd>{liveBackground?.nps.gap ?? `${preview.npsDrilldown.gap} points`}<small>Drill-down only; neither score independently closes an action.</small></dd></div></dl></section>
        <section><strong>Verified exit-reason movement</strong><div className={styles.movementList}>{(liveBackground?.exitMovements ?? preview.exitReasonMovements).length ? (liveBackground?.exitMovements ?? preview.exitReasonMovements).map((movement) => <div key={movement.reason}><span>{movement.reason}</span><b>{movement.current}</b><small>Baseline {movement.baseline}</small></div>) : <p>No exit-reason movement is recorded.</p>}</div></section>
        <section><strong>Versioned domain controls</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Approval</th></tr></thead><tbody>{liveData ? (livePolicyApprovals.length ? livePolicyApprovals.map((approval) => <tr key={approval.approvalId}><td>{approval.title}</td><td>{approval.proposedTerms || approval.expectedResult || "No value recorded"}</td><td>{approval.approvalId}</td><td>{approval.decision} · {approval.owner}</td></tr>) : <tr><td>No linked approval</td><td>No Approval_Log record</td><td>—</td><td>Not recorded</td></tr>) : preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.policyId}</td><td>{policy.value} {policy.unit}</td><td>v{policy.version}</td><td>{policy.approvedBy}</td></tr>)}</tbody></table></div></section>
        <section><strong>Shared learning-gate inputs</strong>{liveBackground ? <dl className={styles.learningGrid}><div><dt>Proposed change</dt><dd>{liveBackground.learning.proposedChange}</dd></div><div><dt>Expected effect</dt><dd>{liveBackground.learning.expectedEffect}</dd></div><div><dt>Attribution</dt><dd>{liveBackground.learning.attribution}</dd></div><div><dt>Evidence</dt><dd>{liveBackground.learning.evidence}</dd></div><div><dt>Forecast error</dt><dd>{liveBackground.learning.forecastError}</dd></div><div><dt>Fresh / reversible</dt><dd>{liveBackground.learning.freshReversible}</dd></div><div><dt>Human controls</dt><dd>{liveBackground.learning.humanControls}</dd></div><div><dt>Confidence / adoption</dt><dd>{liveBackground.learning.confidenceAdoption}</dd></div><div><dt>Effects</dt><dd>{liveBackground.learning.effects}</dd></div><div><dt>Rollback</dt><dd>{liveBackground.learning.rollback}</dd></div></dl> : preview.learningInputs.map((input) => <dl key={input.action_id} className={styles.learningGrid}><div><dt>Proposed change</dt><dd>{input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ") || "No human-controlled category changed"}</dd></div><div><dt>Confidence / adoption</dt><dd>{input.production_confidence} · auto-adopt {String(input.auto_adopt)}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Rollback</dt><dd>{input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>{liveBackground ? "Append-only Sheet audit" : "Append-only local shadow audit"}</strong>{liveBackground ? (liveBackground.auditEvents.length ? <ol>{liveBackground.auditEvents.map((entry) => <li key={`${entry.type}-${entry.id}`}><CheckCircle2 aria-hidden /><span><b>{entry.type} · {entry.status}</b>{entry.detail}</span><time dateTime={entry.at}>{entry.at ? date(entry.at) : "No timestamp"}</time></li>)}</ol> : <p>No linked Sheet audit event is recorded.</p>) : audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.outcome} · {entry.verification}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Weekly message and action boundary</strong><p>{liveBackground?.boundary.summary ?? "Approved template, consent, language, opt-out and quiet hours remain required."}</p><p>{liveBackground?.boundary.detail ?? Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p></section>
      </div>
    </details>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Recover the {liveCommand?.hasData ? liveCommand.recoveryGap : preview.summary.gap} retention gap by verifying the remaining at-risk Member recoveries.</strong>
        <p>{liveCommand?.hasData && liveHeadlineMeasures?.hasData
          ? `Only independently verified recoveries count; accountability sits with ${liveCommand.owner} until the recorded Member cohorts meet ${liveHeadlineMeasures.retentionFloor === null ? "the governed M6 floor once recorded" : `the ${liveHeadlineMeasures.retentionFloor}% M6 floor`}. ${liveHeadlineMeasures.cohortSummary}`
          : `Only independently verified recoveries count; accountability sits with ${preview.summary.owner} until the recorded Member cohort meets its governed M6 floor.`}</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{isLive ? liveCommand!.owner : preview.summary.owner}</dd></div>
        <div><dt>By</dt><dd>{isLive ? liveCommand!.dueAt ? <time dateTime={liveCommand!.dueAt}>{date(liveCommand!.dueAt)}</time> : "Not recorded" : <time dateTime={preview.tasks[0].dueAt}>{date(preview.tasks[0].dueAt)}</time>}</dd></div>
      </dl>
    </section>

    <footer className={styles.sourceNote}><ShieldCheck aria-hidden /><span>{isLive ? liveBackground!.source.connected ? `${liveBackground!.source.names} · as of ${date(liveBackground!.source.asOf)}` : `No Member Engagement Sheet sources recorded · as of ${date(liveBackground!.source.asOf)}` : `${preview.source.name} · as of ${date(preview.source.asOf)} · protected role-gated references only`}</span><Clock3 aria-hidden /><span>{isLive ? `Confidence ${liveBackground!.source.confidence} · ${liveBackground!.source.adoption} · no automatic adoption` : "Production confidence Low · no domain-side auto-adoption"}</span></footer>
  </DashboardSectionAccordion>
}
