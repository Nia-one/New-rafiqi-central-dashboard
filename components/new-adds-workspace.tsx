"use client"

import { useState, type CSSProperties } from "react"
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, FileCheck2, LockKeyhole, MessageSquareDashed, ShieldCheck } from "lucide-react"
import { resolveNewAddsShadowOutcome, type FillTask, type NewAddsMeasureChart, type NewAddsPreview, type RecoveryOutcome, type VerificationStatus } from "@/lib/operating-loop/new-adds-loop"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import styles from "./new-adds-workspace.module.css"

type Props = { preview: NewAddsPreview }

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
    ["Target", `${preview.taskSummary.target} today`],
    ["Current", `${preview.taskSummary.current} billing-live`],
    ["Gap", `${preview.taskSummary.gap} fills`],
    ["Owner", preview.taskSummary.owner],
    ["Progress", `${preview.taskSummary.progressPercent}%`],
    ["Verified result", preview.taskSummary.verifiedResult],
  ] as const
  const behind = preview.taskSummary.gap > 0
  return <section className={styles.summaryFlow} aria-label="Today's target vs actual">
    {items.map(([label, value], index) => <div className={styles.summaryItem} data-metric={label} data-behind={label === "Gap" && behind ? "true" : undefined} key={label}>
      <span>{label}</span><strong>{value}</strong>
      {label === "Progress" ? <div className={styles.summaryBar} aria-hidden><i style={{ width: `${Math.min(100, Math.max(0, preview.taskSummary.progressPercent))}%` }} /></div> : null}
      {index < items.length - 1 ? <ChevronRight aria-hidden /> : null}
    </div>)}
  </section>
}

function TheatreVisual({ preview }: Props) {
  const belowTarget = preview.theatres.filter((theatre) => theatre.verifiedBillingLiveFills < theatre.dailyTarget).length
  return <section className={styles.theatrePanel} aria-label="Empty spots by location">
    <div className={styles.sectionHeader}>
      <div><span>Empty spots by location</span><strong>{belowTarget ? `${belowTarget} governed channel${belowTarget === 1 ? " is" : "s are"} below the recorded target.` : "No governed channel is below the recorded target."}</strong></div>
      <p><i className={styles.fillKey} />Members billing <i className={styles.targetKey} />Today’s target</p>
    </div>
    <div className={styles.theatreCards}>
      {preview.theatres.map((theatre) => {
        const remainingToday = Math.max(0, theatre.dailyTarget - theatre.verifiedBillingLiveFills)
        const variables = { "--fills": percent(theatre.verifiedBillingLiveFills, theatre.dailyTarget), "--target": "100%" } as CSSProperties
        return <article data-theatre={theatre.theatre} key={theatre.theatre}>
          <header className={styles.theatreIdentity}><strong>{theatre.theatre} needs {remainingToday} more Member{remainingToday === 1 ? "" : "s"} today</strong><span>Owner · {theatre.ownerRole}</span></header>
          <div className={styles.barCell} style={variables}>
            <div className={styles.barLabels}><span>{theatre.verifiedBillingLiveFills} Members billing</span><b>Target {theatre.dailyTarget}</b></div>
            <div className={styles.barTrack} aria-label={`${theatre.theatre}: ${theatre.verifiedBillingLiveFills} Members billing against today’s target of ${theatre.dailyTarget}; ${remainingToday} more needed`}>
              <i className={styles.fillBar} /><i className={styles.targetLine} />
            </div>
          </div>
          <dl className={styles.theatreStats}>
            <div><dt>Still needed</dt><dd>{remainingToday} <small>Members</small></dd></div>
            <div><dt>Vacant Nests</dt><dd>{theatre.vacantNests}</dd></div>
            <div><dt>Average fill time</dt><dd>{theatre.averageFillTimeLabel}</dd></div>
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
  return <div className={styles.gauge} role="img" aria-label={`${current} of ${target} verified, ${progressPercent}% of target, ${gap} remaining`}>
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
  if (chart.target <= 0) return <div className={styles.miniChart}><div className={styles.chartScale}><b>No governed target</b><span>Record an approved policy before comparison.</span></div></div>
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

export function NewAddsWorkspace({ preview }: Props) {
  const [tasks, setTasks] = useState<readonly FillTask[]>(() => preview.actions)
  const [selected, setSelected] = useState<Record<string, RecoveryOutcome>>(() => Object.fromEntries(preview.actions.map((task) => [task.actionId, "No answer"])) as Record<string, RecoveryOutcome>)
  const [audit, setAudit] = useState<readonly { eventId: string; actionId: string; outcome: RecoveryOutcome; verification: VerificationStatus | "Not submitted"; route: string; occurredAt: string }[]>([])

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
  const behind = gap > 0
  const verdictState = behind ? "behind" : "on-track"
  const verdictLabel = behind ? `Behind · ${gap} to go` : "On track"
  const openSignOff = preview.despatchEscalations.length

  return <DashboardSectionAccordion className={styles.workspace} data-domain="new-adds" data-supply-model="FONO" ariaLabel="Member Adds sections" sections={[
    { title: "Fill status", summary: verdictLabel },
    { title: "Theatre progress", summary: `${current}/${target} verified · ${gap} still needed`, lens: "decide" },
    { title: "Spots to fill", summary: `${preview.taskSummary.gap} Nests awaiting verified billing`, lens: "operate" },
    { title: "Your sign-off", summary: `${openSignOff} blocked decision${openSignOff === 1 ? "" : "s"}`, lens: "decide" },
    { title: "Proof and controls", summary: `${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} outcomes confirmed` },
    { title: "Decision required", summary: `${gap} verified fill${gap === 1 ? "" : "s"} to recover · owner ${owner}` },
    { title: "Source and confidence", summary: `${preview.source.freshness} inputs · ${preview.quarantineCount} quarantined` },
  ]}>
    <section className={styles.questionBand} data-state={verdictState}>
      <div className={styles.questionMain}>
        <p className={styles.stepLabel}><span>01</span>Fill Status</p>
        <h2 id="new-adds-question">{preview.question}</h2>
        <b className={styles.verdictPill} data-state={verdictState}>{verdictLabel}</b>
      </div>
      <div className={styles.questionGauge}>
        <Gauge progressPercent={progressPercent} current={current} target={target} gap={gap} />
        <ul className={`ds-status-key ${styles.gaugeLegend}`}>
          <li className="ds-status-key-item" data-state="verified"><i className="ds-status-key-swatch" /><span>Verified</span><b>{current}</b></li>
          <li className="ds-status-key-item" data-state="unresolved"><i className="ds-status-key-swatch" /><span>Gap</span><b>{gap}</b></li>
          <li className="ds-status-key-item" data-state="neutral"><i className="ds-status-key-swatch" /><span>Target</span><b>{target}</b></li>
        </ul>
      </div>
    </section>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>02</span>Theatre Progress</p>
      <TaskSummary preview={preview} />
      <TheatreVisual preview={preview} />
      <p className={styles.soWhat}>So what: the gap is concentrated in the two Theatres below target, so recovery effort belongs there first, not spread evenly.</p>
    </div>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>03</span>Spots to fill today · {owner}</p>
      <section className={styles.workPanel} aria-label="Spots to fill today">
        <div className={styles.sectionHeader}>
          <div><span>Spots to fill today</span><strong>{preview.taskSummary.gap} Nests awaiting verified billing</strong></div>
          <p><MessageSquareDashed aria-hidden />WhatsApp stays shadow-only</p>
        </div>
        <OperationalCardStack label="Member Adds synthetic fill tasks">{tasks.map((task) => <OperationalCard key={task.actionId} title={task.studioId} domain={`${task.theatre} · ${task.channel} · FONO`} status={task.state} progress={actionStageFromStatus(task.state)} description={<p>{task.nextAction}</p>} fields={[{ label: "Owner", value: task.ownerRole }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Expected outcome", value: task.expectedOutcome }]}><div className={styles.shadowControls}><TokenSelect ariaLabel={`Shadow outcome for ${task.studioId}`} value={selected[task.actionId] ?? "No answer"} options={outcomes} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task.actionId)}>Record locally</button><small>No message or Production write</small></div></OperationalCard>)}</OperationalCardStack>
      </section>
    </div>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>04</span>Your Sign-Off{openSignOff > 0 ? ` · ${openSignOff} open` : ""}</p>
      <section className={styles.exceptionPanel} aria-label="Decisions blocking progress">
        <div className={styles.sectionHeader}><div><span>Decisions blocking progress</span><strong>{preview.despatchEscalations.length} decisions are blocked</strong></div><p>Human decision</p></div>
        <OperationalCardStack label="Decisions blocking progress">{preview.despatchEscalations.map((row) => <OperationalCard key={row.escalationId} title={row.title} status={row.severity} domain="Member Adds" fields={[{ label: "Owner", value: row.ownerRole }, { label: "Due", value: <time dateTime={row.dueAt}>{date(row.dueAt)}</time> }, { label: "Despatch", value: row.status }]} progress={row.status === "Acknowledged" ? "working" : "assigned"} story={[{ label: "Why it matters", value: row.reason }, { label: "What Nia already did", value: `Detected the repeated failure and routed it to ${row.ownerRole}.` }, { label: "What happens next", value: "Recover the fill outcome and submit billing-live proof for independent verification." }]} />)}</OperationalCardStack>
      </section>
      <p className={styles.soWhat}>So what: these blocked decisions cap today&apos;s recoverable fills, so clearing them is the fastest way to close the gap.</p>
    </div>

    <div className={styles.zone}>
      <p className={styles.stepLabel}><span>05</span>Proof</p>
      <p className={styles.subLabel}>Data and check status</p>
      <section className={styles.loopHealthStrip} data-health-state={preview.loopHealth.state} aria-label="Data and check status">
        <article data-status={preview.loopHealth.feeds.some((feed) => feed.stale) ? "bad" : "ok"}><span>Data freshness</span><strong>{preview.loopHealth.feeds.some((feed) => feed.stale) ? `${preview.loopHealth.feeds.filter((feed) => feed.stale).length} stale feeds` : "All feeds current"}</strong><FeedFreshness feeds={preview.loopHealth.feeds} /></article>
        <article data-status={preview.loopHealth.clocks.some((clock) => clock.breached) ? "bad" : "ok"}><span>Clocks running</span><strong>{preview.loopHealth.clocks.filter((clock) => clock.state === "Running").length} active · {preview.loopHealth.clocks.filter((clock) => clock.breached).length} breached</strong><LoopBar label="Clocks on track versus breached" parts={[{ label: "On track", value: preview.loopHealth.clocks.filter((clock) => clock.state === "Running" && !clock.breached).length, tone: "ok" }, { label: "Breached", value: preview.loopHealth.clocks.filter((clock) => clock.breached).length, tone: "bad" }]} /><small>{preview.loopHealth.clocks.find((clock) => clock.breached)?.ownerRole ?? "No breached owner wait"}</small></article>
        <article data-status={preview.loopHealth.verification.reopened > 0 ? "bad" : preview.loopHealth.verification.awaiting > 0 ? "warn" : "ok"}><span>Outcome checks</span><strong>{preview.loopHealth.verification.verified} of {preview.loopHealth.verification.claimed} confirmed</strong><LoopBar label="Confirmed, waiting and reopened outcomes" parts={[{ label: "Confirmed", value: preview.loopHealth.verification.verified, tone: "ok" }, { label: "Waiting", value: preview.loopHealth.verification.awaiting, tone: "warn" }, { label: "Reopened", value: preview.loopHealth.verification.reopened, tone: "bad" }]} /><small>{preview.loopHealth.verification.awaiting} waiting · {preview.loopHealth.verification.reopened} reopened</small></article>
      </section>
      <p className={styles.subLabel}>Four key numbers</p>
      <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
        {preview.measures.map((measure) => <article data-measure={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.primary}</strong><MeasureChart chart={measure.chart} /><small>{measure.secondary}</small></article>)}
      </section>
      <p className={styles.soWhat}>So what: only billing-live, independently verified fills count toward target, so claimed-but-unverified activity does not close the gap.</p>

    <details className={styles.auditDetails}>
      <summary><FileCheck2 aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Approved cost rules</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Approver</th></tr></thead><tbody>{preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.policyId}</td><td>{policy.value} {policy.unit}</td><td>v{policy.version}</td><td>{policy.approver}</td></tr>)}</tbody></table></div></section>
        <section><strong>Behind-the-scenes setup</strong><p>{preview.loopHealthInputs.feeds.length} feed inputs · {preview.loopHealthInputs.clocks.length} action clocks · {preview.despatchEscalations.length} governed Despatch emissions. Shared R-0 projection state: {preview.loopHealth.state}.</p></section>
        <section><strong>Append-only local preview audit</strong>{audit.length > 0 ? <ol>{audit.map((event) => <li key={event.eventId}><b>{event.outcome} · {event.verification}</b><span>{event.actionId} · {event.route}</span><time dateTime={event.occurredAt}>{date(event.occurredAt)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Safety boundary</strong><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>Policy calibration may be proposed from verified outcomes, but CAC controls, pricing, commercial terms, templates, people decisions and safety changes remain human-approved.</p></section>
      </div>
    </details>
    </div>

    <section className={styles.askBand} aria-label="Decision required" data-state={verdictState}>
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Clear the {openSignOff} blocked sign-off{openSignOff === 1 ? "" : "s"} and recover {gap} verified fill{gap === 1 ? "" : "s"} in the two Theatres below target.</strong>
        <p>Each recovery needs billing-live proof before it closes; accountability sits with {owner} until the gap is verified to zero.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{owner}</dd></div>
        <div><dt>Done when</dt><dd>{gap} gap reaches 0 verified</dd></div>
      </dl>
    </section>

    <footer className={styles.footer} aria-label="Member Adds source status"><CheckCircle2 aria-hidden /><span>{preview.source.freshness} governed inputs · refresh {date(preview.source.lastRefreshAt)} · FONO + Shrampark + Enterprise · {preview.quarantineCount} rows quarantined</span><ShieldCheck aria-hidden /><span>{displayLabel(preview.source.name)} · protected governed references · verified additions only</span><Clock3 aria-hidden /><span>{preview.learningProjection.accepted.length} verified learning chain accepted · no policy auto-change</span><LockKeyhole aria-hidden /><span>No live WhatsApp, external action or Production write</span></footer>
  </DashboardSectionAccordion>
}
