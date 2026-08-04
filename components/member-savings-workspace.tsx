"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react"
import { recoverMemberSavingsTask, type MemberSavingsPreview, type MemberSavingsShadowOutcome, type SavingsTaskPreview, type SavingsVerification } from "@/lib/operating-loop/member-savings-loop"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { compactAge } from "@/lib/operating-loop/loop-health"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import styles from "./member-savings-workspace.module.css"

type Props = { preview: MemberSavingsPreview }

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function DualGateMatrix({ preview }: Props) {
  const maxValue = Math.max(...preview.services.flatMap((service) => [service.memberSavingsInr, Math.max(0, service.niaMarginInr)]), 1)
  return <div className={styles.matrix} role="img" aria-label="Paired bars comparing verified Member savings and Nia unit margin by synthetic service and Studio">
    <div className={styles.matrixLegend}><span><i className={styles.savingsKey} />Verified Member saving</span><span><i className={styles.marginKey} />Verified Nia margin</span><small>₹ per fulfilled unit · prices hidden</small></div>
    <div className={styles.zeroRule}><span>Both values must be above ₹0</span></div>
    {preview.services.map((service) => <article className={styles.serviceRow} data-gate-status={service.status} key={service.serviceId}>
      <div className={styles.serviceIdentity}><strong>{service.serviceName}</strong><span>{service.studio}</span></div>
      <div className={styles.barPair}>
        <div><span>Member</span><i className={styles.savingsBar} style={{ width: `${Math.max(2, service.memberSavingsInr / maxValue * 100)}%` }} /><b>₹{service.memberSavingsInr}</b></div>
        <div><span>Nia</span>{service.niaMarginInr > 0 ? <i className={styles.marginBar} style={{ width: `${Math.max(2, service.niaMarginInr / maxValue * 100)}%` }} /> : <i className={styles.failedBar} /> }<b>{service.niaMarginInr > 0 ? `₹${service.niaMarginInr}` : `−₹${Math.abs(service.niaMarginInr)}`}</b></div>
      </div>
      <div className={service.status === "Pass" ? styles.passLabel : styles.exceptionLabel}><span>{service.status}</span><small>{service.statusReason}</small></div>
    </article>)}
  </div>
}

export function MemberSavingsWorkspace({ preview }: Props) {
  const [tasks, setTasks] = useState<readonly SavingsTaskPreview[]>(preview.tasks)
  const [selected, setSelected] = useState<Record<string, MemberSavingsShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, MemberSavingsShadowOutcome>)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; outcome: MemberSavingsShadowOutcome; verification: SavingsVerification["status"]; route: string; at: string }[]>([])
  const nextDueAt = preview.tasks[0]?.dueAt

  function recordShadowOutcome(actionId: string) {
    const outcome = selected[actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const task = tasks.find((candidate) => candidate.actionId === actionId)
    if (!task) return
    const transition = recoverMemberSavingsTask(task, outcome)
    setTasks((current) => current.map((candidate) => candidate.actionId === actionId ? transition.task : candidate))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${actionId}-${Date.parse(at)}`, actionId, outcome, verification: transition.verification.status, route: transition.route, at })])
  }

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Member Savings sections" sections={[
    { title: "Data freshness", summary: `Last refresh ${date(preview.source.lastRefreshAt)} · ${preview.quarantineCount} quarantined` },
    { title: "Savings command", summary: `${preview.summary.gap} failing the dual gate · owner ${preview.summary.owner}` },
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} confirmed` },
    { title: "Savings vs goal", summary: `${preview.summary.current} current · ${preview.summary.target} target` },
    { title: "Headline measures", summary: `${preview.measures.length} dual-gate controls at a glance`, lens: "decide" },
    { title: "Dual-gate implication", summary: "Recovery belongs on the single failing service.", lens: "decide" },
    { title: "Savings, margin and repeat", summary: `${preview.services.filter((service) => service.status === "Pass").length}/${preview.services.length} services pass`, lens: "decide" },
    { title: "Service implication", summary: "Fix cost or attach without withdrawing Member savings.", lens: "decide" },
    { title: "Services needing action", summary: `${tasks.length} service actions open`, lens: "operate" },
    { title: "Issues needing review", summary: `${preview.despatchEscalations.length} repeated failures need help` },
    { title: "Background record", summary: `${audit.length} local shadow events · governed controls retained`, lens: "operate" },
    { title: "Decision required", summary: `Recover ${preview.summary.gap} dual-gate failure` },
    { title: "Source and confidence", summary: `${preview.source.name} · Production confidence Low` },
  ]}>
    <div className={styles.freshness} role="status">
      <AlertTriangle aria-hidden />
      <strong>Governed source snapshot</strong>
      <span>Last refresh {date(preview.source.lastRefreshAt)} · no live connection</span>
      <b>{preview.quarantineCount} protected-input rows quarantined</b>
    </div>

    <section className={styles.taskBand} aria-labelledby="member-savings-heading">
      <div>
        <span>{preview.fixtureLabel} · {preview.mode}</span>
        <h2 id="member-savings-heading">{preview.headline}</h2>
        <p>{preview.question}</p>
      </div>
      <div className={styles.ownerSummary}><b className={styles.verdictPill} data-state="behind">Dual-gate breach · {preview.summary.gap} failing</b><span>Current owner</span><strong>{preview.summary.owner}</strong><small>Human approval retained for price and supplier decisions</small></div>
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

    <section className={styles.flow} aria-label="Savings vs monthly goal">
      {([
        ["Target", preview.summary.target], ["Current", preview.summary.current], ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner], ["Progress", preview.summary.progress], ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.value}</strong><MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} /><small>{measure.detail}</small></article>)}
    </section>
    <p className={styles.soWhat}>So what: 3 of 4 services clear both gates, so the single failing service is where recovery effort belongs, not a category-wide reprice.</p>

    <div className={styles.primaryGrid}>
      <section className={styles.panel} aria-label="Savings and profit check">
        <header><div><span>Savings and profit check</span><strong>1 service fails the margin test</strong></div><p>Confirmed outcomes · synthetic</p></header>
        <DualGateMatrix preview={preview} />
      </section>

      <section className={`${styles.panel} ${styles.healthPanel}`} aria-label="Usage and repeat trends">
        <header><div><span>Usage and repeat trends</span><strong>Attach and repeat tracked locally</strong></div><p>Studio baselines only</p></header>
        <div className={styles.usageList}>{preview.services.map((service) => <article key={service.serviceId}><div><strong>{service.serviceName}</strong><span>{service.studio}</span></div><dl><div><dt>Attach</dt><dd>{service.attachPct}%</dd></div><div><dt>Repeat</dt><dd>{service.repeatPct}%</dd></div></dl><small>Peer: {service.peerBandLabel} · own baseline {service.repeatBaselinePct}%</small></article>)}</div>
        <div className={styles.rule}><ShieldCheck aria-hidden /><span><strong>Recovery rule</strong>Actual attach or repeat must recover against current governed evidence. A visit does not close.</span></div>
      </section>
    </div>
    <p className={styles.soWhat}>So what: the failing service loses Nia margin while still saving the Member, so it needs a cost or attach fix, not withdrawal of the saving.</p>

    <section className={styles.workPanel} aria-label="Services needing action now">
      <header><div><span>Services needing action now</span><strong>{tasks.length} service actions open</strong></div><p>Preview only</p></header>
      <OperationalCardStack label="Member Savings action work">{tasks.map((task) => <OperationalCard key={task.actionId} title={task.issue} domain={`${task.service} · ${task.actionId}`} status={task.state} progress={actionStageFromStatus(task.state)} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Expected metric", value: task.expectedMetric }, { label: "Progress", value: task.progress }, { label: "Verified result", value: task.verifiedResult }]}><div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.service}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Evidence received", "Failed evidence", "Systemic pattern"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task.actionId)}>Record locally</button><small>No price, supplier or external action</small></div></OperationalCard>)}</OperationalCardStack>
      <p className={styles.soWhat}>So what: each action closes only on verified attach or repeat evidence, so a Member visit alone does not count as recovery.</p>
    </section>

    <section className={styles.exceptions} aria-label="Issues needing your review">
      <header><div><span>Issues needing your review</span><strong>{preview.despatchEscalations.length} repeated failures need help</strong></div><p>Evidence retained</p></header>
      <OperationalCardStack label="Issues needing your review">{preview.despatchEscalations.map((row) => <OperationalCard key={row.escalationId} title={row.title} status={row.severity} domain="Member Savings" fields={[{ label: "Owner", value: row.ownerRole }, { label: "Due", value: <time dateTime={row.dueAt}>{date(row.dueAt)}</time> }, { label: "Despatch", value: row.status }]} progress={row.status === "Acknowledged" ? "working" : "assigned"} story={[{ label: "Why it matters", value: row.reason }, { label: "What Nia already did", value: `Confirmed the repeated dual-gate failure and routed it to ${row.ownerRole}.` }, { label: "What happens next", value: "Recover both Member savings and Nia margin, then submit verified evidence." }]} />)}<OperationalCard title="Repricing proposal" status="Recommendation only" domain="Member Savings" fields={[{ label: "Owner", value: "Pushkar" }]} story={[{ label: "Why it matters", value: "Price changes affect both Member savings and Nia margin." }, { label: "What Nia already did", value: "Prepared an evidence-backed recommendation without changing the price." }, { label: "What happens next", value: "Pushkar reviews and approves or declines the proposal." }]} progress="evidence" /></OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Versioned controls and pending approvals</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Status</th></tr></thead><tbody>{preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.name}</td><td>{policy.value === null ? "No value approved" : `${policy.value} ${policy.unit}`}</td><td>v{policy.version}</td><td>{policy.status}</td></tr>)}</tbody></table></div></section>
        <section><strong>Weekly savings-message inputs</strong>{preview.weeklyMessageInputs.map((input) => <dl key={input.serviceRef}><div><dt>Service</dt><dd>Protected service reference</dd></div><div><dt>Verified saving</dt><dd>{input.verifiedSavingsInr === null ? "Unavailable" : `₹${input.verifiedSavingsInr}`}</dd></div><div><dt>Freshness</dt><dd>{input.dataFreshness}</dd></div><div><dt>Mode</dt><dd>{input.mode} · sent {String(input.sent)}</dd></div></dl>)}</section>
        <section><strong>Shared learning-control inputs</strong>{preview.learningInputs.map((input) => <dl className={styles.learningGrid} key={input.action_id}><div><dt>Proposed change</dt><dd>{input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Approved boundary</dt><dd>{String(input.inside_approved_boundary)} · reverses human decision {String(input.reverses_human_decision)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ") || "No category changed"}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Confidence / adoption</dt><dd>{input.production_confidence} · auto-adopt {String(input.auto_adopt)}</dd></div><div><dt>Rollback</dt><dd>{input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>Append-only local shadow audit</strong>{audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.outcome} · {entry.verification}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Structural action boundary</strong><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>RafiQi may detect, assign and verify in synthetic shadow state. It cannot change price, contact a supplier or Member, sign a contract, move money, delist a service, call externally, write Production or adopt policy.</p></section>
      </div>
    </details>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Recover the {preview.summary.gap} failing the dual gate so both Member savings and Nia margin clear ₹0.</strong>
        <p>Repricing stays a recommendation only; accountability sits with {preview.summary.owner} until verified attach or margin evidence closes the gate.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{preview.summary.owner}</dd></div>
        <div><dt>By</dt><dd>{nextDueAt ? <time dateTime={nextDueAt}>{date(nextDueAt)}</time> : "No open task"}</dd></div>
      </dl>
    </section>

    <footer className={styles.sourceNote}><FileCheck2 aria-hidden /><span>{preview.source.name} · as of {date(preview.source.asOf)} · protected references only</span><Clock3 aria-hidden /><span>Production confidence Low · pending thresholds do not block shadow progress</span></footer>
  </DashboardSectionAccordion>
}
