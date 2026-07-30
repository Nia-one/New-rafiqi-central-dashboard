"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, FileCheck2, LockKeyhole, MessageSquareDashed, ShieldCheck } from "lucide-react"
import { resolveNewAddsShadowOutcome, type FillTask, type NewAddsMeasureChart, type NewAddsPreview, type RecoveryOutcome, type VerificationStatus } from "@/lib/operating-loop/new-adds-loop"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { approvalsForDomain } from "@/lib/live-approvals"
import { buildLiveNewAddsFillStatus, buildLiveNewAddsFillTasks, buildLiveNewAddsProof, buildLiveNewAddsTheatreProgress, buildLiveNewAddsVacancyGroups } from "@/lib/live-mappers/self-drive"
import styles from "./new-adds-workspace.module.css"

type Props = { preview: NewAddsPreview; liveData?: any }

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
const outcomes: readonly RecoveryOutcome[] = ["No answer", "Failed evidence", "Billing-live evidence received"]

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function displayLabel(value: string) {
  return value.replaceAll("New Adds", "Member Adds")
}

function percent(value: number, total: number) {
  return `${Math.min(100, Math.max(0, total === 0 ? 0 : value / total * 100)).toFixed(1)}%`
}

function TaskSummary({ preview }: Props) {
  const items = [
    ["Contracted", `${preview.taskSummary.target} Nests`],
    ["Occupied", `${preview.taskSummary.current} Nests`],
    ["Vacant", `${preview.taskSummary.gap} Nests`],
    ["Owner", preview.taskSummary.owner],
    ["Progress", `${preview.taskSummary.progressPercent}%`],
    ["Source result", preview.taskSummary.verifiedResult],
  ] as const
  const behind = preview.taskSummary.gap > 0
  return <section className={styles.summaryFlow} aria-label="Today's target vs actual">
    {items.map(([label, value], index) => <div className={styles.summaryItem} data-metric={label} data-behind={label === "Vacant" && behind ? "true" : undefined} key={label}>
      <span>{label}</span><strong>{value}</strong>
      {label === "Progress" ? <div className={styles.summaryBar} aria-hidden><i style={{ width: `${Math.min(100, Math.max(0, preview.taskSummary.progressPercent))}%` }} /></div> : null}
      {index < items.length - 1 ? <ChevronRight aria-hidden /> : null}
    </div>)}
  </section>
}

function TheatreVisual({ preview }: Props) {
  const belowTarget = preview.theatres.filter((theatre) => theatre.dailyTarget > theatre.verifiedBillingLiveFills)
  const theatreCountLabel = `${belowTarget.length || "No"} Theatre${belowTarget.length === 1 ? " has" : "s have"} vacant Nests.`
  return <section className={styles.theatrePanel} aria-label="Empty spots by location">
    <div className={styles.sectionHeader}>
      <div><span>Empty spots by location</span><strong>{theatreCountLabel}</strong></div>
      <p><i className={styles.fillKey} />Occupied Nests <i className={styles.targetKey} />Contracted Nests</p>
    </div>
    <div className={styles.theatreCards}>
      {preview.theatres.map((theatre) => {
        const remainingToday = Math.max(0, theatre.dailyTarget - theatre.verifiedBillingLiveFills)
        const variables = { "--fills": percent(theatre.verifiedBillingLiveFills, theatre.dailyTarget), "--target": "100%" } as CSSProperties
        return <article data-theatre={theatre.theatre} key={theatre.theatre}>
          <header className={styles.theatreIdentity}><strong>{theatre.theatre} has {remainingToday} vacant Nest{remainingToday === 1 ? "" : "s"}</strong><span>Owner · {theatre.ownerRole}</span></header>
          <div className={styles.barCell} style={variables}>
            <div className={styles.barLabels}><span>{theatre.verifiedBillingLiveFills} occupied</span><b>{theatre.dailyTarget} contracted</b></div>
            <div className={styles.barTrack} aria-label={`${theatre.theatre}: ${theatre.verifiedBillingLiveFills} occupied Nests of ${theatre.dailyTarget} contracted; ${remainingToday} vacant`}>
              <i className={styles.fillBar} /><i className={styles.targetLine} />
            </div>
          </div>
          <dl className={styles.theatreStats}>
            <div><dt>Vacancy gap</dt><dd>{remainingToday} <small>Nests</small></dd></div>
            <div><dt>Vacant Nests</dt><dd>{theatre.vacantNests}</dd></div>
            <div><dt>Average fill time</dt><dd>{theatre.averageFillTimeLabel ?? theatre.daysToFill} {!theatre.averageFillTimeLabel ? <small>days</small> : null}</dd></div>
          </dl>
        </article>
      })}
    </div>
  </section>
}

function Gauge({ progressPercent, current, target, gap }: { progressPercent: number; current: number; target: number; gap: number }) {
  const r = 56
  const circumference = 2 * Math.PI * r
  const dash = Math.min(100, Math.max(0, progressPercent)) / 100 * circumference
  return <div className={styles.gauge} role="img" aria-label={`${current} of ${target} contracted Nests occupied, ${progressPercent}% occupancy, ${gap} vacant`}>
    <svg viewBox="0 0 140 140" className={styles.gaugeSvg} aria-hidden>
      <circle cx="70" cy="70" r={r} className={styles.gaugeTrack} />
      <circle cx="70" cy="70" r={r} className={styles.gaugeValue} strokeDasharray={`${dash} ${circumference - dash}`} />
    </svg>
    <div className={styles.gaugeCenter}><strong>{current}<span>/{target}</span></strong><small>{progressPercent}%</small></div>
  </div>
}

function MeasureChart({ chart }: { chart: NewAddsMeasureChart }) {
  if (chart.kind === "progress") {
    const pct = Math.min(100, Math.round((chart.value / chart.max) * 100))
    return <div className={styles.miniChart}>
      <div className={styles.progTrack} role="img" aria-label={`${chart.value} of ${chart.max}, ${pct}%`}><i style={{ width: `${pct}%` }} /></div>
      <div className={styles.chartScale}><b>{pct}%</b><span>of {chart.max} target</span></div>
    </div>
  }
  if (chart.kind === "segments") {
    const total = chart.parts.reduce((sum, part) => sum + part.value, 0) || 1
    const tones = ["c1", "c2", "c3", "c4"]
    return <div className={styles.miniChart}>
      <div className={styles.segBar} role="img" aria-label={chart.parts.map((part) => `${part.label} ${part.value}`).join(", ")}>
        {chart.parts.map((part, index) => <i key={part.label} data-tone={tones[index] ?? "c4"} style={{ width: `${(part.value / total) * 100}%` }} />)}
      </div>
      <ul className={styles.segLegend}>
        {chart.parts.map((part, index) => <li key={part.label}><i data-tone={tones[index] ?? "c4"} /><span>{part.label}</span><b>{part.value}</b></li>)}
      </ul>
    </div>
  }
  const domain = Math.max(chart.value, chart.target) * 1.1
  const good = chart.goodWhenUnder ? chart.value <= chart.target : chart.value >= chart.target
  return <div className={styles.miniChart}>
    <div className={styles.threshBar} role="img" aria-label={`${chart.value}${chart.unit} against ${chart.target}${chart.unit} target`}>
      <i className={styles.threshFill} data-good={good} style={{ width: `${(chart.value / domain) * 100}%` }} />
      <i className={styles.threshTick} style={{ left: `${(chart.target / domain) * 100}%` }} />
    </div>
    <div className={styles.chartScale}><b data-good={good}>{good ? "Within" : "Over"} target</b><span>{chart.value}{chart.unit} vs {chart.target}{chart.unit}</span></div>
  </div>
}

function LoopBar({ parts, label }: { parts: readonly { label: string; value: number; tone: string }[]; label: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1
  return <div className={styles.loopVisual}>
    <div className={styles.loopBar} role="img" aria-label={label}>{parts.filter((part) => part.value > 0).map((part) => <i key={part.label} data-tone={part.tone} style={{ width: `${(part.value / total) * 100}%` }} />)}</div>
    <ul className={styles.loopLegend}>{parts.map((part) => <li key={part.label} data-tone={part.tone}><i />{part.label} {part.value}</li>)}</ul>
  </div>
}

function FeedFreshness({ feeds }: { feeds: readonly { label: string; ageLabel: string; stale: boolean }[] }) {
  return <ul className={styles.feedList}>
    {feeds.map((feed) => <li key={feed.label} data-stale={feed.stale}>
      <i aria-hidden />
      <span>{feed.label}</span>
      <b>{feed.ageLabel}</b>
    </li>)}
  </ul>
}

export function NewAddsWorkspace({ preview: fixturePreview, liveData }: Props) {
  const fillStatus = liveData ? buildLiveNewAddsFillStatus(liveData) : null
  const liveProof = liveData ? buildLiveNewAddsProof(liveData) : null
  const liveTheatres = liveData ? buildLiveNewAddsTheatreProgress(liveData) : fixturePreview.theatres
  const vacancyGroups = liveData ? buildLiveNewAddsVacancyGroups(liveData) : []
  const vacancyStudioCount = vacancyGroups.reduce((sum, group) => sum + group.studios.length, 0)
  const netPendingNests = vacancyGroups.reduce((sum, group) => sum + group.pendingNests, 0)
  const grossVacantNests = vacancyGroups.reduce((sum, group) => sum + group.studios.reduce((studioSum, studio) => studioSum + studio.pendingNests, 0), 0)
  const liveTarget = fillStatus?.target ?? fixturePreview.taskSummary.target
  const liveCurrent = fillStatus?.verified ?? fixturePreview.taskSummary.current
  const liveGap = fillStatus?.gap ?? fixturePreview.taskSummary.gap
  const liveOwner = fillStatus?.owner ?? fixturePreview.taskSummary.owner
  const liveApprovals = approvalsForDomain(liveData, "new-adds")
  const liveMemberAddsPolicies = liveData?.policies.filter((row) => String(row["policy id"] ?? "").startsWith("POL-NEW-ADDS-") && String(row.status ?? "").toLowerCase() === "active") ?? []
  const liveControlPolicies = liveMemberAddsPolicies.filter((row) => !String(row["policy id"] ?? "").includes("-BLOCK-"))
  const liveSafetyPolicies = liveMemberAddsPolicies.filter((row) => String(row["policy id"] ?? "").includes("-BLOCK-"))
  const liveGovernanceRows = [
    ...liveControlPolicies.map((row) => ({ policy: String(row["policy name"] ?? row["policy id"] ?? "Policy"), value: `${String(row["policy value"] ?? "Not recorded")} ${String(row.unit ?? "")}`.trim(), version: String(row["policy id"] ?? "—"), approver: `${String(row["approved by"] ?? "Not recorded")} · ${String(row.status ?? "Not recorded")}` })),
    ...liveApprovals.map((approval) => ({ policy: String(approval.approvalRow["decision type"] || approval.title), value: approval.currentTerms && approval.proposedTerms ? `${approval.currentTerms} → ${approval.proposedTerms}` : approval.proposedTerms || approval.expectedResult || "No value recorded", version: approval.approvalId, approver: `${approval.owner} · ${approval.decision}` })),
  ]
  const liveSignOffs = liveApprovals.filter((approval) => approval.pending)
  const derivedRecoverySignOffs = liveData
    ? vacancyGroups.filter((group) => group.pendingNests > 0).map((group) => ({
        id: `AUTO-FILL-${group.theatre}`,
        theatre: group.theatre,
        title: `Recover ${group.pendingNests} vacant Nests in ${group.theatre}`,
        owner: liveTheatres.find((row) => row.theatre === group.theatre)?.ownerRole || "Unassigned",
        studioCount: group.studios.length,
      }))
    : []
  const preview: NewAddsPreview = {
    ...fixturePreview,
    question: liveData
      ? fillStatus?.hasData
        ? `Are ${liveGap} vacant contracted FONO and SP Nests filling against their total potential?`
        : "No contracted or onboarded FONO/SP data is available for the selected filters."
      : fixturePreview.question,
    headline: liveData ? `${liveCurrent} occupied of ${liveTarget} contracted/onboarded FONO and SP Nests; ${liveGap} remain vacant.` : fixturePreview.headline,
    taskSummary: {
      ...fixturePreview.taskSummary,
      target: liveTarget,
      current: liveCurrent,
      gap: liveGap,
      owner: liveOwner,
      progressPercent: fillStatus?.progressPercent ?? fixturePreview.taskSummary.progressPercent,
      verifiedResult: `${liveCurrent} occupied Nests recorded against FONO/SP contracted potential`,
    },
    measures: liveProof?.measures ?? fixturePreview.measures,
    loopHealth: liveProof?.loopHealth ?? fixturePreview.loopHealth,
    theatres: liveTheatres,
    quarantineCount: liveProof?.loopHealth.quarantinedRecords ?? fixturePreview.quarantineCount,
  }
  const projectedTasks = useMemo<readonly FillTask[]>(() => liveData ? buildLiveNewAddsFillTasks(liveData) : preview.actions, [liveData, preview.actions])
  const [tasks, setTasks] = useState<readonly FillTask[]>(() => projectedTasks)
  const [selected, setSelected] = useState<Record<string, RecoveryOutcome>>(() => Object.fromEntries(projectedTasks.map((task) => [task.actionId, "No answer"])) as Record<string, RecoveryOutcome>)
  const [audit, setAudit] = useState<readonly { eventId: string; actionId: string; outcome: RecoveryOutcome; verification: VerificationStatus | "Not submitted"; route: string; occurredAt: string }[]>([])

  useEffect(() => {
    setTasks(projectedTasks)
    setSelected(Object.fromEntries(projectedTasks.map((task) => [task.actionId, "No answer"])) as Record<string, RecoveryOutcome>)
  }, [projectedTasks])

  function recordShadowOutcome(actionId: string) {
    const outcome = selected[actionId] ?? "No answer"
    const occurredAt = new Date().toISOString()
    const task = tasks.find((candidate) => candidate.actionId === actionId)
    if (!task) return
    const transition = resolveNewAddsShadowOutcome(task, outcome, occurredAt)
    setTasks((current) => current.map((candidate) => candidate.actionId === actionId ? transition.task : candidate))
    setAudit((current) => [...current, Object.freeze({ eventId: `AUDIT-${actionId}-${Date.parse(occurredAt)}`, actionId, outcome, verification: transition.verification?.status ?? "Not submitted", route: transition.route, occurredAt })])
  }

  const { target, current, gap, progressPercent, owner } = preview.taskSummary
  const hasLiveData = !liveData || Boolean(fillStatus?.hasData)
  const behind = hasLiveData && gap > 0
  const verdictState = behind ? "behind" : "on-track"
  const verdictLabel = !hasLiveData ? "No contracted FONO/SP data" : behind ? `Behind · ${gap} to go` : "On track"
  const openSignOff = liveData ? liveSignOffs.length + derivedRecoverySignOffs.length : preview.despatchEscalations.length
  const theatresBehind = preview.theatres.filter((theatre) => theatre.dailyTarget > theatre.verifiedBillingLiveFills)
  const theatreRecoveryScope = theatresBehind.length === 0
    ? "the selected FONO/SP scope"
    : theatresBehind.length === 1
      ? theatresBehind[0].theatre
      : theatresBehind.map((row) => row.theatre).join(" and ")
  const theatreProgressImplication = theatresBehind.length === 0
    ? "So what: no contracted FONO/SP vacancy is currently recorded for the selected filters."
    : theatresBehind.length === 1
      ? `So what: the ${theatresBehind[0].vacantNests}-Nest gap is in ${theatresBehind[0].theatre}, so recovery effort belongs there.`
      : `So what: the gap is concentrated in ${theatresBehind.map((row) => row.theatre).join(" and ")}, so recovery effort belongs there first, not spread evenly.`
  const fillTaskCountLabel = liveData
    ? `${netPendingNests} Nests pending across ${vacancyStudioCount} Studios`
    : `${tasks.length} fill${tasks.length === 1 ? "" : "s"} awaiting verified billing`
  const signOffCountLabel = openSignOff === 0
    ? "No decisions are blocked"
    : `${openSignOff} decision${openSignOff === 1 ? " is" : "s are"} blocked`
  const signOffImplication = openSignOff === 0
    ? "So what: no Member Adds approval currently blocks the verified-fill plan."
    : openSignOff === 1
      ? `So what: ${liveData ? (liveSignOffs[0]?.title || derivedRecoverySignOffs[0]?.title) : "this decision"} needs ownership; ${liveData ? (liveSignOffs[0]?.owner || derivedRecoverySignOffs[0]?.owner) : owner} must close the recovery gap.`
      : `So what: ${openSignOff} governed decisions are holding the fill plan; their named owners must record the decisions before the blocked work can advance.`
  const unconfirmedOutcomes = preview.loopHealth.verification.awaiting + preview.loopHealth.verification.reopened
  const proofImplication = `So what: ${preview.loopHealth.verification.verified} of ${preview.loopHealth.verification.claimed} recorded outcomes are independently confirmed; ${unconfirmedOutcomes} unconfirmed outcome${unconfirmedOutcomes === 1 ? " does" : "s do"} not close the ${gap}-fill gap.`
  const decisionActions = [
    openSignOff > 0 ? `clear ${openSignOff} blocked sign-off${openSignOff === 1 ? "" : "s"}` : null,
    gap > 0 ? `recover ${gap} verified fill${gap === 1 ? "" : "s"} in ${theatreRecoveryScope}` : null,
  ].filter(Boolean)
  const decisionHeadline = decisionActions.length > 0
    ? `${decisionActions.join(" and ").replace(/^./, (value) => value.toUpperCase())}.`
    : "Maintain the independently verified billing-live target."
  const staleLiveFeeds = liveProof?.loopHealth.feeds.filter((feed) => feed.stale).length ?? 0
  const sourceConfidenceSummary = liveData
    ? `${staleLiveFeeds > 0 ? `${staleLiveFeeds} stale` : `${liveProof?.loopHealth.feeds.length ?? 0} current`} feeds · ${preview.quarantineCount} quarantined`
    : `${preview.source.freshness} inputs · ${preview.quarantineCount} quarantined`

  return <DashboardSectionAccordion className={styles.workspace} data-domain="new-adds" data-source-scope="FONO Funnel and Shram Park" ariaLabel="Member Adds sections" sections={[
    { title: "Fill status", summary: verdictLabel },
    { title: "Theatre progress", summary: `${current}/${target} occupied · ${gap} vacant` },
    { title: "Spots to fill", summary: fillTaskCountLabel },
    { title: "Your sign-off", summary: `${openSignOff} blocked decision${openSignOff === 1 ? "" : "s"}` },
    { title: "Proof and controls", summary: `${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} outcomes confirmed` },
    { title: "Decision required", summary: `${gap} verified fill${gap === 1 ? "" : "s"} to recover · owner ${owner}` },
    { title: "Source and confidence", summary: sourceConfidenceSummary },
  ]}>
    <section className={styles.questionBand} data-state={verdictState}>
      <div className={styles.questionMain}>
        <p className={styles.stepLabel}><span>01</span>Fill Status</p>
        <h2 id="new-adds-question">{preview.question}</h2>
        <b className={styles.verdictPill} data-state={verdictState}>{verdictLabel}</b>
      </div>
      <div className={styles.questionGauge}>
        <Gauge progressPercent={progressPercent} current={current} target={target} gap={gap} />
        <ul className={styles.gaugeLegend}>
          <li data-key="verified"><i /><span>Occupied</span><b>{current}</b></li>
          <li data-key="gap"><i /><span>Gap</span><b>{gap}</b></li>
          <li data-key="target"><i /><span>Contracted</span><b>{target}</b></li>
        </ul>
      </div>
    </section>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>02</span>Theatre Progress</p>
      <TaskSummary preview={preview} />
      <TheatreVisual preview={preview} />
      <p className={styles.soWhat}>{theatreProgressImplication}</p>
    </div>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>03</span>Studios with vacant Nests</p>
      <section className={styles.workPanel} aria-label="Spots to fill today">
        <div className={styles.sectionHeader}>
          <div><span>Spots to fill today</span><strong>{fillTaskCountLabel}</strong></div>
          <p><MessageSquareDashed aria-hidden />{liveData ? "Fono Funnel + Shram Park · read-only" : "WhatsApp stays shadow-only"}</p>
        </div>
        {liveData ? <div className={styles.vacancyGroups}>{vacancyGroups.map((group) => <section className={styles.vacancyGroup} key={group.theatre}>
          <header><div><strong>{group.theatre}</strong><span>{group.studios.length} Studio{group.studios.length === 1 ? "" : "s"} need filling</span></div><b>{group.pendingNests}<small> pending Nests</small></b></header>
          <div className={styles.vacancyTable}><table><thead><tr><th>Studio</th><th>Contracted</th><th>Occupied</th><th>Occupancy</th><th>Pending to fill</th></tr></thead><tbody>{group.studios.map((studio) => <tr key={studio.studioId}><td><strong>{studio.studioName}</strong><span>{studio.studioId}</span></td><td>{studio.contractedNests}</td><td>{studio.occupiedNests}</td><td>{studio.occupancyPercent}%</td><td><b>{studio.pendingNests}</b></td></tr>)}</tbody></table></div>
        </section>)}<p className={styles.vacancyNote}><strong>{netPendingNests} net pending Nests</strong> come from total Contracted/Onboarded potential minus current Occupancy across FONO and SP. Existing Studios are excluded.</p></div> : <OperationalCardStack label="Member Adds fill tasks">{tasks.map((task) => <OperationalCard key={task.actionId} title={task.studioId} domain={`${task.theatre} · FONO/SP`} status={task.state} progress={actionStageFromStatus(task.state)} description={<p>{task.nextAction}</p>} fields={[{ label: "Owner", value: task.ownerRole }, { label: "Due", value: task.dueAt ? <time dateTime={task.dueAt}>{date(task.dueAt)}</time> : "No deadline recorded" }, { label: "Expected outcome", value: task.expectedOutcome }]}><div className={styles.shadowControls}><TokenSelect ariaLabel={`Shadow outcome for ${task.studioId}`} value={selected[task.actionId] ?? "No answer"} options={outcomes} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task.actionId)}>Record locally</button><small>No message or Production write</small></div></OperationalCard>)}</OperationalCardStack>}
      </section>
    </div>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>04</span>Your Sign-Off{openSignOff > 0 ? ` · ${openSignOff} open` : ""}</p>
      <section className={styles.exceptionPanel} aria-label="Decisions blocking progress">
        <div className={styles.sectionHeader}><div><span>Decisions blocking progress</span><strong>{signOffCountLabel}</strong></div><p>Human decision</p></div>
        <OperationalCardStack label="Decisions blocking progress">{liveData ? <>{liveSignOffs.map((approval) => <OperationalCard key={approval.approvalId} title={approval.title} status="Pending human approval" domain={approval.approvalId} action={approval.action} fields={[{ label: "Owner", value: approval.owner }, { label: "Due", value: approval.dueAt ? <time dateTime={approval.dueAt}>{date(approval.dueAt)}</time> : "No deadline recorded" }, { label: "Amount", value: approval.amountInr ? `₹${approval.amountInr.toLocaleString("en-IN")}` : "No amount" }, { label: "Expected result", value: approval.expectedResult || "Not recorded" }]} />)}{derivedRecoverySignOffs.map((decision) => <OperationalCard key={decision.id} title={decision.title} status="Recovery decision required" domain={`${decision.theatre ?? "Member Adds"} · Auto-derived from Studios`} action={`Assign and recover the Theatre vacancy across ${decision.studioCount} Studios.`} fields={[{ label: "Owner", value: decision.owner }, { label: "Source", value: "Studios · Contracted minus Occupied" }, { label: "Approval_Log", value: "Not required to generate" }, { label: "Expected result", value: "Vacancy gap reduced to zero" }]} />)}</> : preview.despatchEscalations.map((row) => <OperationalCard key={row.escalationId} title={row.title} status={row.severity} domain="Member Adds" fields={[{ label: "Owner", value: row.ownerRole }, { label: "Due", value: <time dateTime={row.dueAt}>{date(row.dueAt)}</time> }, { label: "Despatch", value: row.status }]} progress={row.status === "Acknowledged" ? "working" : "assigned"} story={[{ label: "Why it matters", value: row.reason }, { label: "What Nia already did", value: `Detected the repeated failure and routed it to ${row.ownerRole}.` }, { label: "What happens next", value: "Recover the fill outcome and submit billing-live proof for independent verification." }]} />)}</OperationalCardStack>
      </section>
      <p className={styles.soWhat}>{signOffImplication}</p>
    </div>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>05</span>Proof</p>
      <p className={styles.subLabel}>Data and check status</p>
      <section className={styles.loopHealthStrip} data-health-state={preview.loopHealth.state} aria-label="Data and check status">
        <article data-status={preview.loopHealth.feeds.some((feed) => feed.stale) ? "bad" : "ok"}><span>Data freshness</span><strong>{preview.loopHealth.feeds.some((feed) => feed.stale) ? `${preview.loopHealth.feeds.filter((feed) => feed.stale).length} stale feeds` : "All feeds current"}</strong><FeedFreshness feeds={preview.loopHealth.feeds} /></article>
        <article data-status={preview.loopHealth.clocks.some((clock) => clock.breached) ? "bad" : "ok"}><span>Clocks running</span><strong>{preview.loopHealth.clocks.filter((clock) => clock.state === "Running").length} running · {preview.loopHealth.clocks.filter((clock) => clock.breached).length} breached</strong><LoopBar label="Clocks on track versus breached" parts={[{ label: "On track", value: preview.loopHealth.clocks.filter((clock) => clock.state === "Running" && !clock.breached).length, tone: "ok" }, { label: "Breached", value: preview.loopHealth.clocks.filter((clock) => clock.breached).length, tone: "bad" }]} /><small>{preview.loopHealth.clocks.find((clock) => clock.breached)?.ownerRole ?? "No breached owner wait"}</small></article>
        <article data-status={preview.loopHealth.verification.reopened > 0 ? "bad" : preview.loopHealth.verification.awaiting > 0 ? "warn" : "ok"}><span>Outcome checks</span><strong>{preview.loopHealth.verification.verified} of {preview.loopHealth.verification.claimed} confirmed</strong><LoopBar label="Confirmed, waiting and reopened outcomes" parts={[{ label: "Confirmed", value: preview.loopHealth.verification.verified, tone: "ok" }, { label: "Waiting", value: preview.loopHealth.verification.awaiting, tone: "warn" }, { label: "Reopened", value: preview.loopHealth.verification.reopened, tone: "bad" }]} /><small>{preview.loopHealth.verification.awaiting} waiting · {preview.loopHealth.verification.reopened} reopened</small></article>
      </section>
      <p className={styles.subLabel}>Four key numbers</p>
      <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
        {preview.measures.map((measure) => <article data-measure={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.primary}</strong><MeasureChart chart={measure.chart} /><small>{measure.secondary}</small></article>)}
      </section>
      <p className={styles.soWhat}>{proofImplication}</p>

    <details className={styles.auditDetails}>
      <summary><FileCheck2 aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Governed cost rules and approvals</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Approver</th></tr></thead><tbody>{liveData ? (liveGovernanceRows.length ? liveGovernanceRows.map((row) => <tr key={row.version}><td>{row.policy}</td><td>{row.value}</td><td>{row.version}</td><td>{row.approver}</td></tr>) : <tr><td>No linked policy or approval</td><td>No Policy_Registry or Approval_Log record</td><td>—</td><td>Not recorded</td></tr>) : preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.policyId}</td><td>{policy.value} {policy.unit}</td><td>v{policy.version}</td><td>{policy.approver}</td></tr>)}</tbody></table></div></section>
        <section><strong>Behind-the-scenes setup</strong><p>{liveProof ? liveProof.feedInputCount : preview.loopHealthInputs.feeds.length} feed inputs · {liveProof ? liveProof.clockInputCount : preview.loopHealthInputs.clocks.length} action clocks · {liveProof ? liveProof.governedActionCount : preview.despatchEscalations.length} governed actions. Shared R-0 projection state: {preview.loopHealth.state}.</p></section>
        <section><strong>{liveData ? "Append-only Sheet audit" : "Append-only local preview audit"}</strong>{liveData ? <p>{liveProof?.auditEventCount ?? 0} linked Action_Log, Evidence_Log and Approval_Log records are included; no duplicate Operations entry is required.</p> : audit.length > 0 ? <ol>{audit.map((event) => <li key={event.eventId}><b>{event.outcome} · {event.verification}</b><span>{event.actionId} · {event.route}</span><time dateTime={event.occurredAt}>{date(event.occurredAt)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Safety boundary</strong><p>{liveData ? (liveSafetyPolicies.length ? liveSafetyPolicies.map((row) => `${String(row["policy name"] ?? row["policy id"])}: ${String(row["policy value"] ?? "Not recorded")}`).join(" · ") : "No active Member Adds capability boundary is recorded in Policy_Registry.") : Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>{liveData ? `${liveSafetyPolicies.length} active Member Adds capability boundaries are registered in Policy_Registry; changes still require governed approval.` : "Policy calibration may be proposed from verified outcomes, but CAC controls, pricing, commercial terms, templates, people decisions and safety changes remain human-approved."}</p></section>
      </div>
    </details>
    </div>

    <section className={styles.askBand} aria-label="Decision required" data-state={verdictState}>
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>{decisionHeadline}</strong>
        <p>Each recovery needs billing-live proof before it closes; accountability sits with {owner} until the verified gap reaches zero.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{owner}</dd></div>
        <div><dt>Done when</dt><dd>Verified gap reaches 0</dd></div>
      </dl>
    </section>

    <footer className={styles.footer} aria-label="Member Adds source status"><CheckCircle2 aria-hidden /><span>{liveData ? `Google Sheet live · refresh ${date(liveData.asOf)} · FONO/SP contracted supply · ${preview.quarantineCount} quarantined` : `${preview.source.freshness} synthetic inputs · refresh ${date(preview.source.lastRefreshAt)} · no live connection · FONO/SP contracted supply · ${preview.quarantineCount} rows quarantined`}</span><ShieldCheck aria-hidden /><span>{liveData ? "Fono Funnel · TEAM_SHRAMPARK_DEMAND · Enterprise_Demand · Action_Log · Evidence_Log · Approval_Log · People_Roster" : `${displayLabel(preview.source.name)} · protected synthetic references · billing-live outcomes only`}</span><Clock3 aria-hidden /><span>{liveData ? `${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} outcomes independently confirmed` : `${preview.learningProjection.accepted.length} verified learning chain accepted · no policy auto-change`}</span><LockKeyhole aria-hidden /><span>No automatic approval, external action or Production write</span></footer>
  </DashboardSectionAccordion>
}
