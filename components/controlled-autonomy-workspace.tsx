"use client"

import { useState } from "react"
import { BadgeCheck, Ban, Bot, BriefcaseBusiness, CircleGauge, ClipboardCheck, Database, FileLock2, MessageSquare, RotateCcw, ShieldCheck, UserCheck, UsersRound } from "lucide-react"
import type { AutonomyFeedbackLabel } from "@/lib/operating-loop/autonomy-control"
import type { ControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { ActionSegment, OperationalCard, OperationalCardStack, type ActionStage } from "@/components/operational-card"
import { dashboardDisplayLabel } from "@/lib/dashboard-model"

type Props = { preview: ControlledAutonomyPreview }
type FeedbackFilter = "All feedback" | AutonomyFeedbackLabel
type ShadowDecisionOutcome = "Approved" | "Declined"
type ShadowDecisionAudit = Readonly<{ auditId: string; decisionId: string; outcome: ShadowDecisionOutcome; recordedAt: string }>

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

export function ControlledAutonomyWorkspace({ preview }: Props) {
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
  const waitingDecisions = preview.learningQueue
    .filter((entry) => entry.evaluation.requiredDisposition === "Human sign-off")
    .map((entry) => ({
      decisionId: entry.recommendationId,
      decisionRequired: entry.proposedChange,
      why: entry.evaluation.materialityReasons[0] ?? entry.evaluation.confidenceReasons[0] ?? "A governed human decision is required.",
      impact: entry.expectedEffect,
      deadline: `Before adoption · ${entry.authority}`,
      owner: entry.authority,
    }))

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

  return <DashboardSectionAccordion className="autonomy-workspace self-drive-workspace" ariaLabel="Your Sign-Off sections" sections={[
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} verified` },
    { title: "Decision status", summary: `${waitingDecisions.length} material decisions · ${fixNowRoutine.length} failed recoveries` },
    { title: "Decisions by urgency", summary: `${waitingDecisions.length + fixNowRoutine.length + recoveringRoutine.length} items need review or recovery` },
    { title: "Governance and background", summary: `${shadowDecisionAudit.length} local decisions · automatic execution locked` },
  ]}>
    <LoopHealthStrip health={preview.loopHealth} />
    <div className={`self-drive-verdict is-${waitingDecisions.length + fixNowRoutine.length > 0 ? "action" : "clear"}`} role="status">
      <b className="self-drive-verdict-pill">{waitingDecisions.length > 0 ? "Your decision needed" : fixNowRoutine.length > 0 ? "Recovery failing" : "Nothing waiting"}</b>
      <span>{waitingDecisions.length > 0 ? <><strong>{waitingDecisions.length} material decision{waitingDecisions.length === 1 ? "" : "s"}</strong> need your sign-off{fixNowRoutine.length > 0 ? <>, and <strong>{fixNowRoutine.length}</strong> routine action{fixNowRoutine.length === 1 ? " is" : "s are"} failing recovery.</> : "."}</> : fixNowRoutine.length > 0 ? <><strong>{fixNowRoutine.length}</strong> routine action{fixNowRoutine.length === 1 ? " is" : "s are"} failing recovery and need you now.</> : "Routine work is running itself; no material decision is waiting for you."}</span>
      <small>So what: nothing below changes money, contracts, people or systems until you decide, so each item stays open until you approve or decline it.</small>
    </div>
    <section className="action-board" aria-label="Decisions ranked by urgency">
      <ActionSegment segment="fix-now" count={fixNowRoutine.length}>
        {fixNowRoutine.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={dashboardDisplayLabel(record.domain)} status="Recovery failed" tone="critical" fields={[{ label: "Owner", value: OWNER_LABELS[record.ownerActorId] ?? record.ownerActorId }, { label: "Due", value: "Now" }]} progress={routineProgress(record.state)} story={[{ label: "Why it matters", value: record.history.at(-1)?.note ?? "The expected result was not verified." }, { label: "What Nia already did", value: `Assigned the owner, sent ${record.botReminderCount} governed reminder${record.botReminderCount === 1 ? "" : "s"} and collected ${record.evidenceCount} protected proof reference${record.evidenceCount === 1 ? "" : "s"}.` }, { label: "What happens next", value: expectedCompletion(record.state) }]} />)}
      </ActionSegment>

      <ActionSegment segment="nia-recovering" count={recoveringRoutine.length}>
        {recoveringRoutine.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={dashboardDisplayLabel(record.domain)} status="Reopened" tone="attention" fields={[{ label: "Owner", value: OWNER_LABELS[record.ownerActorId] ?? record.ownerActorId }, { label: "Expected", value: expectedCompletion(record.state) }]} progress={routineProgress(record.state)} story={[{ label: "Why it matters", value: record.history.at(-1)?.note ?? "A verified result did not hold." }, { label: "What Nia already did", value: "Reopened the same action instead of counting the earlier closure as a lasting result." }, { label: "What happens next", value: "The named owner is chased again until new proof passes independent verification." }]} />)}
      </ActionSegment>

      <ActionSegment segment="waiting-sign-off" count={waitingDecisions.length}>
        {waitingDecisions.map((decision) => {
          const localDecision = shadowDecisionAudit.filter((item) => item.decisionId === decision.decisionId).at(-1)
          return <OperationalCard key={decision.decisionId} title={decision.decisionRequired} domain="Material target change" status={localDecision ? `${localDecision.outcome} locally` : "Your sign-off"} tone={localDecision ? "verified" : "breach"} fields={[{ label: "Owner", value: decision.owner }, { label: "Due", value: decision.deadline }]} progress="evidence" story={[{ label: "Why it matters", value: decision.why }, { label: "What Nia already did", value: `Prepared the recommendation and quantified the expected effect: ${decision.impact}` }, { label: "What happens next", value: "Approve or decline. Nothing changes outside this shadow preview." }]}>
            <div className="self-drive-approval-controls"><button type="button" onClick={() => recordShadowDecision(decision.decisionId, "Approved")}>Approve</button><button type="button" onClick={() => recordShadowDecision(decision.decisionId, "Declined")}>Decline</button></div>
            <p className="self-drive-shadow-note"><FileLock2 aria-hidden />Shadow decision only · {localDecision ? `${localDecision.outcome} locally` : "no external effect"}</p>
          </OperationalCard>
        })}
      </ActionSegment>

      <ActionSegment segment="verified" count={verifiedRoutine.length}>
        {verifiedRoutine.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={dashboardDisplayLabel(record.domain)} status="Verified" tone="verified" fields={[{ label: "Owner", value: OWNER_LABELS[record.ownerActorId] ?? record.ownerActorId }, { label: "Result", value: "Closed" }]} progress="verified" story={[{ label: "Why it matters", value: "Only independently verified outcomes count toward performance." }, { label: "What Nia already did", value: `Collected ${record.evidenceCount} protected proof references and used a separate verifier.` }, { label: "What happens next", value: "No action. The verified result remains in the audit history." }]} />)}
      </ActionSegment>
    </section>

    <details className="self-drive-audit-details">
      <summary>Full background record</summary>
      <div className="self-drive-audit-body">
        <section className="closed-loop-panel self-drive-local-audit" aria-label="Your recent decisions log">
          <header><div><p className="section-kicker">Your recent decisions log</p><h3>Recent decisions</h3></div><span>{shadowDecisionAudit.length} entries · no external effect</span></header>
          {shadowDecisionAudit.length === 0
            ? <p className="readonly-note"><FileLock2 aria-hidden />No local shadow decision recorded.</p>
            : <ol>{shadowDecisionAudit.map((entry) => <li key={entry.auditId}><strong>{entry.outcome}</strong><span>{entry.decisionId}</span><small>{date(entry.recordedAt)}</small></li>)}</ol>}
        </section>
        <section className="closed-loop-panel" aria-label="Always your call">
          <header><div><p className="section-kicker">Always your call</p><h3>Decisions Nia never makes alone</h3></div></header>
          <div className="self-drive-authority-list">{HUMAN_AUTHORITIES.map((item) => <article key={item.authority}><h3>{item.authority}</h3><p>{item.role}</p></article>)}</div>
        </section>
    <section className="closed-loop-status-band autonomy-status-band" aria-label="How much runs itself">
      <div>
        <span className="status-badge"><ShieldCheck aria-hidden />{preview.phase} · {preview.mode}</span>
        <h2>Routine work runs itself</h2>
        <p>The system detects, routes, chases, collects proof, verifies, closes, reopens and escalates routine work. A person appears only after repeated, independently verified non-performance survives data-quality and prior-intervention checks.</p>
      </div>
      <dl>
        <div><dt>Source</dt><dd><Database aria-hidden />Governed live records</dd></div>
        <div><dt>As of</dt><dd>{date(preview.source.asOf)}</dd></div>
        <div><dt>Execution</dt><dd><FileLock2 aria-hidden />Kill switch engaged</dd></div>
      </dl>
    </section>

    <section className="closed-loop-metrics autonomy-metrics" data-kpi-group aria-label="Overall performance summary">
      <article><span>Routine exceptions</span><strong>{preview.routineLoop.records.length}</strong><p>System-owned · 0 routed to central management</p><small><Bot aria-hidden />Shadow bot routes · no message sent</small></article>
      <article><span>System outcomes</span><strong>{closedRoutine} / {reopenedRoutine} / {escalatedRoutine}</strong><p>Closed / reopened / escalated by governed state</p><small><RotateCcw aria-hidden />Append-only lifecycle</small></article>
      <article><span>People exceptions</span><strong>{preview.peopleExceptions.surfaced.length}</strong><p>Repeated verified non-performance only</p><small><UsersRound aria-hidden />Named human review · not a work queue</small></article>
      <article><span>Protected from escalation</span><strong>{preview.peopleExceptions.withheld.length}</strong><p>Single-event and poor-data records withheld</p><small><ShieldCheck aria-hidden />No inference from weak evidence</small></article>
    </section>

    <section className="closed-loop-panel autonomy-routine-loop" aria-labelledby="autonomy-routine-title">
      <header><div><p className="section-kicker">Routine Recovery</p><h3 id="autonomy-routine-title">The system owns routine exceptions</h3></div><span>0 management interventions · governed routes</span></header>
      <ol className="autonomy-lifecycle" aria-label="Routine exception lifecycle">
        {preview.routineLoop.stateCoverage.map((item, index) => <li key={item.state}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.state}</strong><small>{item.count} governed {item.count === 1 ? "path" : "paths"}</small></li>)}
      </ol>
      <OperationalCardStack label="System-owned routine exceptions">{preview.routineLoop.records.map((record) => <OperationalCard key={record.exceptionId} title={record.title} domain={`${dashboardDisplayLabel(record.domain)} · ${record.exceptionId}`} status={record.state} fields={[{ label: "Owner", value: record.ownerActorId }, { label: "Verifier", value: record.verifierActorId }, { label: "Evidence", value: `${record.evidenceCount} protected refs` }, { label: "Bot chase", value: `${record.botReminderCount} governed reminders · no external message` }, { label: "Audit", value: `${record.history.length} append-only events` }, { label: "Management", value: "None · system continues the loop" }]} />)}</OperationalCardStack>
    </section>

    <section className="closed-loop-panel autonomy-people-exceptions" aria-labelledby="autonomy-people-title">
      <header><div><p className="section-kicker">People Exceptions</p><h3 id="autonomy-people-title">{preview.peopleExceptions.surfaced.length} repeated failures need review</h3></div><span>{preview.peopleExceptions.withheld.length} weak signals withheld</span></header>
      <ol className="autonomy-stage-path" aria-label="Governed people escalation path">
        <li data-state="complete"><span>01</span><strong>Coach / Counsel</strong><small>Evidence-led human support</small></li>
        <li data-state="current"><span>02</span><strong>Performance review</strong><small>Named human review</small></li>
        <li data-state="locked"><span>03</span><strong>Exit review</strong><small>HR/management + legal checks</small></li>
      </ol>
      {peopleException ? <article className="autonomy-person-exception">
        <div className="autonomy-person-heading"><BriefcaseBusiness aria-hidden /><div><span>{peopleException.stage}</span><h4>{peopleException.displayName} · {peopleException.role}</h4><p>{peopleException.metricId} · {peopleException.governedGoal}</p></div><strong>{peopleException.recurrenceCount} verified recurrences</strong></div>
        <dl><div><dt>Governed SLA</dt><dd>{peopleException.governedSla}</dd></div><div><dt>Prior bot reminders</dt><dd>{peopleException.priorBotReminders.length} retained</dd></div><div><dt>Prior counselling</dt><dd>{peopleException.priorCounselling.length} retained</dd></div><div><dt>Impact</dt><dd>{peopleException.impact}</dd></div></dl>
        <div className="autonomy-person-evidence"><div><ClipboardCheck aria-hidden /><span>Evidence history</span><strong>{peopleException.evidenceHistory.length} independently verified records</strong>{peopleException.evidenceHistory.map((ref) => <small key={ref}>{ref}</small>)}</div><div><MessageSquare aria-hidden /><span>Recommended next step</span><strong>{peopleException.recommendedNextStep}</strong><small>Named human approval required · no automatic discipline, termination, external message or employment decision</small></div></div>
      </article> : null}
      <div className="autonomy-withheld"><ShieldCheck aria-hidden /><div><strong>Single events and poor data stay out of the human surface.</strong><p>{preview.peopleExceptions.withheld.map((item) => `${item.reason}: ${item.recordedSignals}`).join(" · ")}</p><small>Names are intentionally suppressed here. The system keeps chasing source quality and routine proof without creating central work.</small></div></div>
    </section>

    <section className="closed-loop-panel autonomy-comparison" aria-labelledby="autonomy-comparison-title">
      <header><div><p className="section-kicker">Decision Accuracy</p><h3 id="autonomy-comparison-title">Recommendations compared with outcomes</h3></div><span>{evaluation.metrics.reviewedCount} reviews · agent {evaluation.comparisons[0]?.recommendation.agentVersion}</span></header>
      <div className="autonomy-calibration-strip" aria-label="Shadow model quality"><span>Precision <strong>{percentage(evaluation.metrics.detectionPrecision)}</strong></span><span>Missed events <strong>{percentage(evaluation.metrics.missedEventRate)}</strong></span><span>Accepted / overridden <strong>{percentage(evaluation.metrics.acceptanceRate)} / {percentage(evaluation.metrics.overrideRate)}</strong></span><span>Median decision <strong>{minutes(evaluation.metrics.medianDecisionMinutes)}</strong></span><span>Audit complete <strong>{percentage(evaluation.metrics.auditCompleteness)}</strong></span></div>
      <OperationalCardStack label="Recommendations compared with actual human decisions">{evaluation.comparisons.map((item) => <OperationalCard key={item.recommendation.recommendationId} title={item.recommendation.title} domain={`${dashboardDisplayLabel(item.recommendation.domain)} · ${item.recommendation.recommendationId}`} status={item.disposition?.outcome ?? item.decision?.outcome ?? "Pending"} description={<p>{item.recommendation.rationale}</p>} fields={[{ label: "Owner", value: item.decision?.decidedBy ?? "No decision" }, { label: "Period", value: date(item.recommendation.recommendedAt) }, { label: "Actual outcome", value: item.disposition?.actualOutcome ?? "No final disposition" }, { label: "Human decision", value: item.decision?.actualDecision ?? "Awaiting human review" }, { label: "Risk / approval", value: `${item.riskClass} risk · ${item.requiredHumanApprover === "None" ? "No bypass requested" : `${item.requiredHumanApprover} required`}` }, { label: "Evidence", value: item.disposition?.independentlyVerified ? `Verified by ${item.disposition.verifiedBy}` : `${item.recommendation.sourceRefs.length} source ref retained` }]} />)}</OperationalCardStack>
    </section>

    <section className="closed-loop-panel autonomy-readiness" aria-labelledby="autonomy-readiness-title">
      <header><div><p className="section-kicker">Autonomy Gate</p><h3 id="autonomy-readiness-title">Automatic execution is locked</h3></div><span>Registry v{preview.policies.mode.version}</span></header>
      <div className="autonomy-gate-grid">
        <article><CircleGauge aria-hidden /><span>Accuracy threshold</span><strong>{String(preview.policies.minimumPrecision.value)}</strong><small>{preview.policies.minimumPrecision.policyId}@v{preview.policies.minimumPrecision.version}</small></article>
        <article><RotateCcw aria-hidden /><span>Reversal threshold</span><strong>{String(preview.policies.maximumReversal.value)}</strong><small>{preview.policies.maximumReversal.policyId}@v{preview.policies.maximumReversal.version}</small></article>
        <article><BadgeCheck aria-hidden /><span>Audit threshold</span><strong>{String(preview.policies.minimumAuditCompleteness.value)}</strong><small>{preview.policies.minimumAuditCompleteness.policyId}@v{preview.policies.minimumAuditCompleteness.version}</small></article>
        <article><FileLock2 aria-hidden /><span>Operating mode</span><strong>{String(preview.policies.mode.value)}</strong><small>Kill switch: {String(preview.policies.killSwitch.value)}</small></article>
      </div>
      <div className="autonomy-lock-grid">
        <div><Ban aria-hidden /><span>Low risk</span><strong>Automatic execution blocked</strong><p>{preview.readiness.lowRisk.reasons.join(" ")}</p><small>Policy evaluator only · execution adapter available: No</small></div>
        <div><UserCheck aria-hidden /><span>High risk</span><strong>Permanent human approval</strong><p>{preview.readiness.highRisk.reasons[0]} Financial and commercial changes route to Pushkar; external, configuration and irreversible changes route to Sachin.</p><small>{preview.policies.highRiskRule.policyId}@v{preview.policies.highRiskRule.version}</small></div>
      </div>
    </section>

    <section className="closed-loop-panel autonomy-feedback" aria-labelledby="autonomy-feedback-title">
      <header><div><p className="section-kicker">Learning Feedback</p><h3 id="autonomy-feedback-title">Disagreements and verification gaps</h3></div><span>{filteredFeedback.length} of {evaluation.feedback.length} shown</span></header>
      <div className="autonomy-feedback-filters" role="group" aria-label="Filter labelled feedback">
        {filters.map((filter) => <button key={filter} type="button" aria-pressed={feedbackFilter === filter} onClick={() => setFeedbackFilter(filter)}>{filter}<span>{filter === "All feedback" ? evaluation.feedback.length : evaluation.feedback.filter((item) => item.label === filter).length}</span></button>)}
      </div>
      <OperationalCardStack label="Filtered autonomy feedback">{filteredFeedback.map((item) => <OperationalCard key={item.feedbackId} title={item.summary} domain={dashboardDisplayLabel(item.domain)} status={item.label} fields={[{ label: "Recorded", value: date(item.recordedAt) }, { label: "Recommendation", value: item.recommendationId ?? "No recommendation" }, { label: "Signal", value: item.signalId ?? "False-positive review" }, { label: "Evidence", value: item.evidenceRef }]} />)}</OperationalCardStack>
    </section>

    <section className="closed-loop-panel autonomy-effectiveness" aria-labelledby="autonomy-effectiveness-title">
      <header><div><p className="section-kicker">System Performance</p><h3 id="autonomy-effectiveness-title">Verified outcomes and missing definitions</h3></div><span>Read-only</span></header>
      <div className="autonomy-scorecard-grid">{preview.systemScorecard.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.source}</p><small className="written-status">{metric.status}</small></article>)}</div>
      <p className="readonly-note"><FileLock2 aria-hidden />Task and message counts are not primary success metrics. No metric on this screen can mutate an operating record, approve a high-risk action or enable automatic execution.</p>
    </section>
      </div>
    </details>
  </DashboardSectionAccordion>
}
