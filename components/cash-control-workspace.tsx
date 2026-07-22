"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, FileCheck2, Landmark, LockKeyhole, RefreshCcw, ShieldCheck, WalletCards } from "lucide-react"
import { recoverCashControlAction, verifyCashControlClosure, type CashControlPreview, type CashControlTaskPreview } from "@/lib/operating-loop/cash-control-loop"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import styles from "./cash-control-workspace.module.css"

type Props = { preview: CashControlPreview }
type ShadowOutcome = "Unresolved" | "Evidence received" | "Failed evidence" | "Human approval required" | "Missed hour"

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function ControlPath({ path }: { path: CashControlPreview["controlPath"] }) {
  return <ol className={styles.controlPath} aria-label="Cash and Control monthly command path">
    {path.map((step, index) => <li data-control-state={step.state} key={step.id}>
      <span>{index + 1}</span>
      <div><strong>{step.label}</strong><small>{step.value}</small></div>
    </li>)}
  </ol>
}

function FinancialRail({ rail }: { rail: CashControlPreview["financialRails"][number] }) {
  return <article className={styles.financialRail} data-rail-id={rail.id}>
    <header><div><span>{rail.label}</span><strong>{rail.value}</strong></div><b>{rail.state}</b></header>
    <div className={styles.railTrack} aria-label={`${rail.label}: ${rail.value}; control ${rail.threshold}`}><i style={{ width: `${rail.progressPct}%` }} /></div>
    <small>{rail.threshold}</small>
  </article>
}

export function CashControlWorkspace({ preview }: Props) {
  const [tasks, setTasks] = useState<readonly CashControlTaskPreview[]>(preview.tasks)
  const [selected, setSelected] = useState<Record<string, ShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, ShadowOutcome>)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; outcome: ShadowOutcome; route: string; at: string }[]>([])

  function recordShadowOutcome(task: CashControlTaskPreview) {
    const outcome = selected[task.actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const recovered = outcome === "Unresolved" ? task.engineAction : recoverCashControlAction(task.engineAction, outcome)
    const verificationInput = outcome === "Failed evidence"
      ? { ...task.verificationInput, evidenceRef: null, measuredOutcomeVerified: false, sourceMetricRecovered: false }
      : task.verificationInput
    const verification = verifyCashControlClosure(verificationInput)
    const route = outcome === "Unresolved" ? recovered.nextAction : `${recovered.nextAction} ${verification.reasons[0] ?? "Independent verification passed."}`
    setTasks((current) => current.map((row) => row.actionId !== task.actionId ? row : {
      ...row,
      progress: outcome,
      verifiedResult: verification.canClose ? "Independently verified" : verification.status,
      state: outcome === "Evidence received" ? "Awaiting verification" : recovered.state,
      recommendationOnly: recovered.recommendationOnly,
      engineAction: recovered,
    }))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${task.actionId}-${Date.parse(at)}`, actionId: task.actionId, outcome, route, at })])
  }

  const cashProtected = preview.financialRails.find((rail) => rail.id === "cash")?.state === "Protected"
  const verdictLabel = cashProtected ? "Cash protected · destination needs approval" : "Cash at risk · destination needs approval"
  const decisionDue = date(preview.tasks[0].dueAt)

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Cash and Control sections" sections={[
    { title: "Recommendation", summary: verdictLabel },
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} verified` },
    { title: "Data freshness", summary: `Last refresh ${date(preview.source.lastRefreshAt)} · financial actions blocked` },
    { title: "Monthly command", summary: `${preview.summary.owner} owns the destination decision` },
    { title: "Target to result", summary: `${preview.summary.current} current · ${preview.summary.gap} gap` },
    { title: "Headline measures", summary: `${preview.measures.length} financial controls at a glance` },
    { title: "Control implication", summary: "Cash is protected; destination approval still blocks the cascade." },
    { title: "Monthly control path", summary: `${preview.closureCounts.verified}/${preview.closureCounts.claimed} closures verified` },
    { title: "Control path implication", summary: "The approved target cannot fall silently." },
    { title: "Channel recommendation", summary: `${preview.channelRecommendations.length} evidence-ranked options · recommendation only` },
    { title: "Channel implication", summary: "No allocation is imposed before approval." },
    { title: "Open work", summary: `${tasks.length} owned command tasks remain open` },
    { title: "Human approvals", summary: `${preview.approvals.length} financial decisions require named authority` },
    { title: "Background record", summary: `${audit.length} local shadow events · governed controls retained` },
    { title: "Decision required", summary: `Owner ${preview.summary.owner} · due ${decisionDue}` },
    { title: "Recovery rule", summary: "Missed work rolls forward; claimed activity never closes without evidence." },
    { title: "Source and confidence", summary: `${preview.source.name} · Production confidence Low` },
  ]}>
    <section className={styles.decision} data-state={cashProtected ? "protected" : "at-risk"} aria-label="Cash and Control recommendation">
      <div className={styles.decisionMain}>
        <p className={styles.stepLabel}><span>Recommendation</span>Cash &amp; Control · {preview.summary.owner}</p>
        <p className={styles.governing}>{preview.headline}</p>
        <dl className={styles.scqa}>
          <div><dt>Why you&apos;re here</dt><dd>Decide the monthly CM destination and collected-cash target so RafiQi can compute the remaining gap and cascade.</dd></div>
          <div><dt>Where we are</dt><dd>{preview.summary.current} · opex {preview.measures[1].value} vs {preview.measures[1].target}.</dd></div>
          <div><dt>What changed</dt><dd>No approved destination exists, so {preview.measures[3].value}, {preview.closureCounts.awaitingVerification} awaiting and {preview.closureCounts.reopened} reopened closures stay unresolved and every financial action is blocked.</dd></div>
        </dl>
      </div>
      <div className={styles.decisionAside}>
        <b className={styles.verdictPill} data-state={cashProtected ? "protected" : "at-risk"}>{verdictLabel}</b>
        <p className={styles.askInline}>Approve both today and the gap and cascade unlock; leave them pending and they stay locked.</p>
        <dl className={styles.askMetaTop}><div><dt>Decision by</dt><dd><time dateTime={preview.tasks[0].dueAt}>{decisionDue}</time></dd></div></dl>
      </div>
    </section>

    <LoopHealthStrip health={preview.loopHealth} />
    <div className={styles.freshness} role="status"><AlertTriangle aria-hidden /><strong>Stale synthetic fixture</strong><span>Last refresh {date(preview.source.lastRefreshAt)} · no live connection</span><b>All financial actions blocked</b></div>

    <section className={styles.taskBand} aria-labelledby="cash-control-heading">
      <div><span>{preview.fixtureLabel} · {preview.mode}</span><h2 id="cash-control-heading">{preview.headline}</h2><p>{preview.question}</p></div>
      <div className={styles.ownerSummary}><span>Current owner</span><strong>{preview.summary.owner}</strong><small>Targets, finance and guardrail exceptions remain human-approved</small></div>
    </section>

    <section className={styles.flow} aria-label="Cash and Control target to verified result">
      {([
        ["Target", preview.summary.target], ["Current", preview.summary.current], ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner], ["Progress", preview.summary.progress], ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Cash and Control four headline measures">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.value}</strong><MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} /><small>{measure.detail}</small></article>)}
    </section>
    <p className={styles.soWhat}>So what: cash sits above the ₹150L floor and opex under the ₹60L cap, but leakage and reopened closures still erode verified CM until the destination is approved.</p>

    <section className={styles.controlPanel} aria-label="Monthly control path">
      <header><div><span>Monthly control path</span><strong>Approve the destination, protect cash, then verify every outcome.</strong></div><p>No silent target reduction</p></header>
      <div className={styles.controlBody}>
        <ControlPath path={preview.controlPath} />
        <aside className={styles.protectionPanel}>
          <div className={styles.protectionHeading}><ShieldCheck aria-hidden /><div><span>Cash feasibility</span><strong>Locked controls are protected.</strong></div></div>
          <div className={styles.financialRails}>{preview.financialRails.map((rail) => <FinancialRail key={rail.id} rail={rail} />)}</div>
          <div className={styles.closureSummary}><span>System work</span><strong>{preview.closureCounts.verified}/{preview.closureCounts.claimed} verified</strong><dl><div><dt>Awaiting</dt><dd>{preview.closureCounts.awaitingVerification}</dd></div><div><dt>Reopened</dt><dd>{preview.closureCounts.reopened}</dd></div></dl></div>
        </aside>
      </div>
    </section>
    <p className={styles.soWhat}>So what: the destination and remaining gap stay pending, so the cascade is blocked and cannot start until a human approves the monthly target.</p>

    <section className={styles.mixPanel} aria-label="Evidence-ranked channel recommendation">
      <header><div><span>Evidence-ranked channel recommendation</span><strong>Recommend the mix; never impose a fixed split.</strong></div><p>Recommendation only</p></header>
      <div className={styles.mixRows}>{preview.channelRecommendations.map((row) => <article key={row.candidateId}><span className={styles.rank}>{row.rank}</span><div><strong>{row.channel}</strong><small>Protected evidence · current · independently verified</small></div><dl><div><dt>Expected CM</dt><dd>₹{(row.expectedVerifiedCmInr / 100_000).toFixed(1)}L</dd></div><div><dt>Cash needed</dt><dd>₹{(row.requiredCashInr / 100_000).toFixed(1)}L</dd></div><div><dt>Outcome</dt><dd>{row.expectedHoursToOutcome}h</dd></div></dl><b>No allocation set</b></article>)}</div>
    </section>
    <p className={styles.soWhat}>So what: the top-ranked channel is the most cash-efficient verified path, but no split is imposed; you approve the destination first, then choose the mix.</p>

    <section className={styles.workPanel} aria-label="Open Cash and Control work">
      <header><div><span>Owned command work</span><strong>Every miss stays open until independently verified.</strong></div><p>Local shadow outcomes only</p></header>
      <OperationalCardStack label="Cash and Control command work">{tasks.map((task) => <OperationalCard key={task.actionId} title={task.issue} domain={task.actionId} status={task.state} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Progress", value: task.progress }, { label: "Expected verified result", value: task.expectedVerifiedResult }, { label: "Verified result", value: task.verifiedResult }]}><div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.issue}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Evidence received", "Failed evidence", "Human approval required", "Missed hour"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task)}>Record locally</button><small>No approval, payment, message or Production write</small></div></OperationalCard>)}</OperationalCardStack>
    </section>

    <section className={styles.approvalPanel} aria-label="Pending human approvals">
      <header><div><span>Named human authority</span><strong>Financial controls cannot approve themselves.</strong></div><p>No automatic exception</p></header>
      <OperationalCardStack label="Pending human approvals">{preview.approvals.map((approval) => <OperationalCard key={approval.id} title={approval.decision} status={approval.status} description={<p>{approval.impact}</p>} fields={[{ label: "Owner", value: approval.owner }]} />)}</OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Versioned controls and pending approvals</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Status</th></tr></thead><tbody>{preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.name}</td><td>{policy.value === null ? "No value approved" : `₹${new Intl.NumberFormat("en-IN").format(policy.value)}`}</td><td>v{policy.version}</td><td>{policy.status}</td></tr>)}</tbody></table></div></section>
        <section><strong>Shared learning-control inputs</strong>{preview.learningInputs.map((input) => <dl className={styles.learningGrid} key={input.action_id}><div><dt>Proposal</dt><dd>{input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Approved boundary</dt><dd>{String(input.inside_approved_boundary)} · reverses human decision {String(input.reverses_human_decision)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ")}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Materiality / confidence</dt><dd>{input.materiality_status} · {input.production_confidence}</dd></div><div><dt>Adoption / rollback</dt><dd>Auto-adopt {String(input.auto_adopt)} · {input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>Append-only local shadow audit</strong>{audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.outcome}</b>{entry.actionId} �� {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Structural action boundary</strong><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>RafiQi may detect, rank, recommend, re-slot and verify in synthetic shadow state. It cannot approve a target or exception, change pricing, move money, sign a contract, contact anyone, write Production or adopt policy.</p></section>
      </div>
    </details>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Approve the monthly CM destination and the collected-cash target.</strong>
        <p>Cash is protected today, but the remaining gap and cascade stay locked and accountability sits with Finance until both are approved.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{preview.summary.owner}</dd></div>
        <div><dt>By</dt><dd><time dateTime={preview.tasks[0].dueAt}>{decisionDue}</time></dd></div>
      </dl>
    </section>

    <div className={styles.closureRule}><RefreshCcw aria-hidden /><span><strong>Recovery rule</strong>Missed hourly work moves into the remaining run rate; monthly target unchanged. The approved monthly destination never falls silently. Claimed activity never closes without independent evidence.</span></div>
    <footer className={styles.sourceNote}><FileCheck2 aria-hidden /><span>{preview.source.name} · as of {date(preview.source.asOf)} · protected references only</span><Clock3 aria-hidden /><span>Production confidence Low · unresolved controls remain pending human approval</span><WalletCards aria-hidden /><span>No live financial action</span></footer>
  </DashboardSectionAccordion>
}
