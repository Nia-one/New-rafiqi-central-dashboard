"use client"

import { useMemo, useState } from "react"
import { ArrowUpRight, BellRing, CheckCircle2, CircleDashed, FileCheck2, UsersRound, type LucideIcon } from "lucide-react"
import { buildActionChaseQueue, buildExecutionReport, type ActionWithResult, type CommitmentSource } from "@/lib/execution-control"
import type { DashboardRoute } from "@/lib/dashboard-model"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"

type ActionFilter = "All" | "Carry-forward" | "Not executed" | "Verification overdue" | "Outcome pending" | "Closed but not resolved"

const filters: ActionFilter[] = ["All", "Carry-forward", "Not executed", "Verification overdue", "Outcome pending", "Closed but not resolved"]

function filterActions(actions: ActionWithResult[], filter: ActionFilter) {
  if (filter === "Carry-forward") return actions.filter((action) => action.carryForward)
  if (filter === "Not executed") return actions.filter((action) => action.result === "Not executed")
  if (filter === "Verification overdue") return actions.filter((action) => action.result === "Verification overdue")
  if (filter === "Outcome pending") return actions.filter((action) => action.outcome === "Pending" && action.status !== "Dismissed")
  if (filter === "Closed but not resolved") return actions.filter((action) => action.outcome === "Closed but not resolved")
  return actions
}

function dueLabel(timestamp: string | null) {
  if (!timestamp) return "Not recorded"
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date(timestamp))
}

function sourceLabel(source: CommitmentSource) {
  if (source === "meeting_commitment") return "Meeting commitment"
  if (source === "member_feedback") return "Member feedback"
  return "System detected"
}

function previousReportLabel(action: ActionWithResult) {
  if (action.source === "meeting_commitment") return action.meetingLabel
  return action.source === "member_feedback" ? "Member Feedback" : "Reporting & Insights"
}

function latestStep(action: ActionWithResult) {
  return [...action.actionLog].sort((a, b) => Date.parse(a.executed_at) - Date.parse(b.executed_at)).at(-1) ?? null
}

function chaseAge(action: ActionWithResult, asOf: string) {
  const chaseStartedAt = action.result === "Verification overdue" && action.closedAt
    ? Date.parse(action.closedAt) + 72 * 3_600_000
    : Date.parse(action.dueAt)
  const hours = Math.max(0, Math.floor((Date.parse(asOf) - chaseStartedAt) / 3_600_000))
  if (hours < 24) return `${hours}h overdue`
  const days = Math.floor(hours / 24)
  const remainder = hours % 24
  return remainder === 0 ? `${days}d overdue` : `${days}d ${remainder}h overdue`
}

function sourceNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[,%]/g, "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function sourcePercentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

function ResultLabel({ result }: { result: ActionWithResult["result"] }) {
  return <span className={`execution-result execution-result-${result.toLowerCase().replaceAll(" ", "-")}`}>{result}</span>
}

function ActionRegister({ actions, onNavigate }: { actions: ActionWithResult[]; onNavigate: (route: DashboardRoute, mismatchId?: string) => void }) {
  const [filter, setFilter] = useState<ActionFilter>("All")
  const visible = filterActions(actions, filter)

  return <section className="execution-section" aria-labelledby="execution-register-title">
    <header className="execution-section-heading">
      <div><p className="story-kicker">06 · SHARED ACTION REGISTER</p><h2 id="execution-register-title">Every commitment keeps one execution trail.</h2></div>
      <p>Closed and Verified have separate timestamps. A result is checked only after its stated window.</p>
    </header>
    <div className="execution-filters" aria-label="Filter action register">
      {filters.map((item) => <button type="button" key={item} className={filter === item ? "is-active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}<span>{filterActions(actions, item).length}</span></button>)}
    </div>
    <OperationalCardStack label={`${filter} action register`}>{visible.map((action) => <OperationalCard key={action.id} title={action.title} domain={`${sourceLabel(action.source)} · ${action.theatre}`} status={action.result} fields={[{ label: "Owner", value: `${action.owner} · ${action.team}` }, { label: "Due", value: dueLabel(action.dueAt) }, { label: "Outcome", value: action.outcome }, { label: "Closed / verified", value: `Closed ${dueLabel(action.closedAt)} · Verified ${dueLabel(action.verifiedAt)}` }, { label: "Expected result", value: `${action.expectedMetric.label}: ${action.expectedMetric.direction === "up" ? "Increase" : "Decrease"} from ${action.expectedMetric.baselineValue}${action.expectedMetric.unit}; check after ${action.expectedMetric.checkWindowDays} day${action.expectedMetric.checkWindowDays === 1 ? "" : "s"}` }, { label: "Measured", value: action.expectedMetric.actualValue === null ? "Result not yet available" : `${action.expectedMetric.actualValue}${action.expectedMetric.unit}` }]}><button type="button" className="execution-open" onClick={() => onNavigate(action.route, action.mismatchId)}>Open details <ArrowUpRight aria-hidden /></button></OperationalCard>)}</OperationalCardStack>
    <p className="execution-row-count">Showing {visible.length} of {actions.length} Google Sheet action records.</p>
  </section>
}

export function ExecutionControlPanel({ liveOpsData, onNavigate }: { liveOpsData?: any; onNavigate: (route: DashboardRoute, mismatchId?: string) => void }) {
  const commitments = liveOpsData?.executionActions ?? []
  const snapshotAt = String(liveOpsData?.meta?.snapshotAt ?? "1970-01-01T00:00:00.000Z")
  const report = useMemo(() => buildExecutionReport(commitments, snapshotAt), [commitments, snapshotAt])
  const peopleFromSheet = useMemo(() => (liveOpsData?.peopleFollowThrough ?? []).map((row: Record<string, unknown>) => {
    const commitments = sourceNumber(row.commitments)
    const verified = sourceNumber(row.verified)
    const closed = row.closed === undefined || row.closed === "" ? verified : sourceNumber(row.closed)
    const carriedForward = sourceNumber(row["carried forward"])
    const closedButNotResolved = sourceNumber(row["closed but not resolved"])
    return {
      owner: String(row["display name"] || row["actor id"] || "Unassigned"),
      team: String(row.team || "Unassigned"),
      period: String(row["updated at"] || snapshotAt),
      commitments,
      closed,
      verified,
      carriedForward,
      closureRate: sourcePercentage(verified, commitments),
      closedButNotResolvedRate: sourcePercentage(closedButNotResolved, commitments),
    }
  }).filter((person: { owner: string }) => person.owner !== "Unassigned"), [liveOpsData, snapshotAt])
  const people = peopleFromSheet.length > 0 ? peopleFromSheet : report.people.map((person) => ({ ...person, period: "Current report" }))
  const chase = buildActionChaseQueue(report.actions)
  const evaluated = report.resolvedOutcomes + report.closedButNotResolved
  const loopStages: Array<{ number: string; label: string; value: number; note: string; icon: LucideIcon }> = [
    { number: "01", label: "Root cause", value: report.actions.length, note: "Action generated", icon: CircleDashed },
    { number: "02", label: "Owner alert", value: report.agreed, note: "Owner tagged", icon: BellRing },
    { number: "03", label: "Proof", value: report.closed, note: "Owner marked complete", icon: FileCheck2 },
    { number: "04", label: "Despatch", value: report.verified, note: "Proof validated", icon: CheckCircle2 },
    { number: "05", label: "Member result", value: evaluated, note: "Outcome checked", icon: UsersRound },
  ]

  return <div className="execution-control">
    <section className="execution-lede" aria-labelledby="execution-title">
      <div><p className="story-kicker">EXECUTION CONTROL &amp; MEMBER SATISFACTION</p><h2 id="execution-title">From root cause to validated closure.</h2><p>Reports stay read-only. The system generates the action, tags the owner and sends the alert. The owner submits proof. Despatch validates it.</p></div>
      <p className="execution-data-note"><strong>Google Sheet action register</strong><span>Source snapshot {dueLabel(snapshotAt)}</span><span>Action records are read from Action_Log. External alerts remain pending.</span></p>
    </section>

    {report.carryForward.length > 0 ? <section className="execution-carry-forward" aria-labelledby="carry-forward-title">
      <header><div><p className="story-kicker">NEXT MEETING · CARRY-FORWARD</p><h2 id="carry-forward-title">Start with commitments that were not Verified.</h2></div><strong>{report.carryForward.length} carried forward</strong></header>
      <ol>{report.carryForward.map((action) => <li key={action.id}><span className="commitment-source commitment-source-meeting_commitment">Meeting commitment</span><div><strong>{action.title}</strong><p>{action.owner} · agreed {dueLabel(action.meetingDate)} · due {dueLabel(action.dueAt)}</p></div><ResultLabel result={action.result} /></li>)}</ol>
    </section> : null}

    <section className="execution-loop" aria-label="Recommendation to Member result loop">
      {loopStages.map(({ number, label, value, note, icon: Icon }, index) => <article key={label}><div><span>{number}</span><Icon aria-hidden /></div><strong>{value}</strong><h3>{label}</h3><p>{note}</p>{index < loopStages.length - 1 ? <i aria-hidden>→</i> : null}</article>)}
    </section>

    <section className="execution-section" aria-labelledby="execution-score-title">
      <header className="execution-section-heading"><div><p className="story-kicker">01 · FOLLOW-THROUGH SCORE</p><h2 id="execution-score-title">{report.verified} of {report.agreed} commitments are Verified.</h2></div><p>Closed work waits for verification. Unverified closures older than 72 hours are escalated.</p></header>
      <div className="execution-score-grid" data-kpi-group>
        {[
          ["Commitments", report.agreed, "Action_Log"],
          ["Closed", report.closed, `${report.awaitingVerification} awaiting verification`],
          ["Verified", report.verified, `${report.verifiedOnTime} on time · ${report.verifiedLate} late`],
          ["Closure rate", `${report.closureRate}%`, "Verified ÷ commitments"],
          ["Verification overdue", report.verificationOverdue, "Closed for more than 72 hours"],
          ["Rejected", report.rejected, "Recorded · not executed"],
        ].map(([label, value, note]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong><p>{note}</p></article>)}
      </div>
    </section>

    <section className="execution-section" aria-labelledby="person-compliance-title">
      <header className="execution-section-heading"><div><p className="story-kicker">02 · PERSON FOLLOW-THROUGH</p><h2 id="person-compliance-title">Name the owner. Separate closure from result.</h2></div><p>Closure rate counts Verified commitments. “Closed, not resolved” shows actions that were done but did not move the expected metric.</p></header>
      <OperationalCardStack label="Person follow-through">{people.map((person) => <OperationalCard key={person.owner} title={person.owner} domain={person.team} status={person.closedButNotResolvedRate > 0 ? "Attention" : "On track"} fields={[{ label: "Owner", value: person.owner }, { label: "Period", value: person.period }, { label: "Closure rate", value: `${person.closureRate}%` }, { label: "Committed / closed / verified", value: `${person.commitments} / ${person.closed} / ${person.verified}` }, { label: "Carried", value: person.carriedForward }, { label: "Closed, not resolved", value: `${person.closedButNotResolvedRate}%` }]} />)}</OperationalCardStack>
    </section>

    <section className="execution-section" aria-labelledby="meeting-closure-title">
      <header className="execution-section-heading"><div><p className="story-kicker">03 · MEETING CLOSURE</p><h2 id="meeting-closure-title">Measure each meeting by what was Verified before the next one.</h2></div><p>Open items return automatically at the top of the next agenda.</p></header>
      <div className="meeting-closure-grid">{report.meetings.map((meeting) => <article key={meeting.meetingId}><span>{meeting.meetingLabel}</span><strong>{meeting.closureRate}%</strong><p>{meeting.verifiedBeforeNextMeeting} of {meeting.commitments} Verified · {meeting.carriedForward} carried forward</p></article>)}</div>
    </section>

    <section className="execution-section" aria-labelledby="missed-actions-title">
      <header className="execution-section-heading"><div><p className="story-kicker">04 · PERSON CHASE</p><h2 id="missed-actions-title">{chase.length} previous-report actions need a named chase.</h2></div><p>Owner non-execution and checker delay are separate. Both remain open until evidence is independently Verified.</p></header>
      <OperationalCardStack label="People to chase for previous-report actions">
        {chase.map((action) => {
            const last = latestStep(action)
            const checkerDelay = action.result === "Verification overdue"
            return <OperationalCard key={action.id} title={action.title} domain={`${sourceLabel(action.source)} · ${previousReportLabel(action)} · ${action.theatre}`} status={action.result} description={<p>{checkerDelay ? "Assign a checker and verify the evidence." : "Get execution proof from the named owner."}</p>} fields={[{ label: "Owner", value: checkerDelay ? "Checker not named" : action.owner }, { label: "Due", value: dueLabel(action.dueAt) }, { label: "Open for", value: chaseAge(action, snapshotAt) }, { label: "Expected result", value: action.expectedMetric.label }, { label: "Last step", value: `${last?.new_status ?? "No update"} · ${dueLabel(last?.executed_at ?? null)}` }]}><button type="button" className="execution-open" onClick={() => onNavigate(action.route, action.mismatchId)}>Open details <ArrowUpRight aria-hidden /></button></OperationalCard>
          })}
      </OperationalCardStack>
      <p className="execution-row-count">Every row remains in the shared Action_Log until its source status changes.</p>
    </section>

    <section className="execution-section member-outcome-section" aria-labelledby="member-outcome-title">
      <header className="execution-section-heading"><div><p className="story-kicker">05 · MEMBER SATISFACTION</p><h2 id="member-outcome-title">An executed action is not automatically a solved problem.</h2></div><p>Check the primary metric after its stated window. Keep the Member signal beside it as a second test.</p></header>
      <div className="member-outcome-grid">
        <article><span>Resolved</span><strong>{report.resolvedOutcomes}</strong><p>Expected metric moved in the right direction</p></article>
        <article><span>Closed but not resolved</span><strong>{report.closedButNotResolved}</strong><p>Action happened, but the expected metric did not improve</p></article>
        <article><span>Pending</span><strong>{report.pendingOutcomes}</strong><p>Waiting for verification, measurement, or the check window</p></article>
      </div>
    </section>

    <ActionRegister actions={report.actions} onNavigate={onNavigate} />
  </div>
}
