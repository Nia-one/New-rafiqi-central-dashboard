"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronDown, Clock3, FileCheck2, Landmark, LockKeyhole, ShieldCheck } from "lucide-react"
import { recoverNiaGrowthAction, verifyNiaGrowthReadiness, type GrowthTaskPreview, type NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import styles from "./nia-growth-workspace.module.css"

type Props = { preview: NiaGrowthPreview }
type ShadowOutcome = "Unresolved" | "Evidence received" | "Failed evidence" | "Human sign-off required"

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function GrowthLane({ lane }: { lane: NiaGrowthPreview["lanes"][number] }) {
  const isFono = lane.supplyModel === "FONO"
  return <article className={styles.lane} data-supply-model={lane.supplyModel}>
    <header>
      <div className={isFono ? styles.fonoMark : styles.spMark}>{isFono ? <Building2 aria-hidden /> : <Landmark aria-hidden />}</div>
      <div><span>{lane.supplyModel === "FONO" ? "FONO" : "SP · Śram Park"}</span><strong>{lane.capacityLabel}</strong></div>
      <b>{lane.progressPct}% ready</b>
    </header>
    <div className={styles.capacityTrack} aria-label={`${lane.supplyModel}: ${lane.activationReadyNests} of ${lane.plannedNests} Nests activation-ready`}>
      <i style={{ width: `${lane.progressPct}%` }} />
    </div>
    <dl className={styles.laneMetrics}>
      <div><dt>Capacity</dt><dd>{lane.activationReadyNests} / {lane.plannedNests}</dd><small>{lane.gapNests} Nest gap</small></div>
      <div><dt>Time to ready</dt><dd>{lane.timeToReadyLabel}</dd><small>SLA pending approval</small></div>
      <div><dt>{isFono ? "Base / Nia fill" : "Contract coverage"}</dt><dd>{lane.coverageLabel}</dd><small>{lane.coverageDetail}</small></div>
    </dl>
    <div className={styles.stageRail}>{lane.stages.map((stage) => <div data-stage-state={stage.state} key={stage.label}><i /><span>{stage.label}</span><strong>{stage.value}</strong></div>)}</div>
  </article>
}

export function NiaGrowthWorkspace({ preview }: Props) {
  const [tasks, setTasks] = useState<readonly GrowthTaskPreview[]>(preview.tasks)
  const [selected, setSelected] = useState<Record<string, ShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, ShadowOutcome>)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; supplyModel: "FONO" | "SP"; outcome: ShadowOutcome; route: string; at: string }[]>([])

  function recordShadowOutcome(task: GrowthTaskPreview) {
    const outcome = selected[task.actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const recovered = outcome === "Unresolved" ? task.engineAction : recoverNiaGrowthAction(task.engineAction, outcome)
    const verificationInput = outcome === "Failed evidence" ? { ...task.verificationInput, evidenceRef: null, capacityReadyToSpec: false } : task.verificationInput
    const verification = verifyNiaGrowthReadiness(recovered, verificationInput)
    const route = `${recovered.nextAction} ${verification.reasons[0] ?? "Independent readiness verification passed."}`
    setTasks((current) => current.map((row) => row.actionId !== task.actionId ? row : {
      ...row,
      progress: outcome,
      verifiedResult: verification.status,
      state: verification.canClose ? "Verified ready" : outcome === "Evidence received" ? "Awaiting verification" : recovered.state,
      recommendationOnly: recovered.recommendationOnly,
      engineAction: recovered,
    }))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${task.actionId}-${Date.parse(at)}`, actionId: task.actionId, supplyModel: task.supplyModel, outcome, route, at })])
  }

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Nia Growth sections" sections={[
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} verified` },
    { title: "Data freshness", summary: `Last refresh ${date(preview.source.lastRefreshAt)} · ${preview.quarantineCount} quarantined` },
    { title: "Growth command", summary: `${preview.summary.gap} capacity gap · owner ${preview.summary.owner}` },
    { title: "Growth vs plan", summary: `${preview.summary.current} current · ${preview.summary.target} target` },
    { title: "Headline measures", summary: `${preview.measures.length} readiness controls at a glance`, lens: "decide" },
    { title: "Capacity implication", summary: "Close readiness and coverage gaps before new capital.", lens: "decide" },
    { title: "Growth by channel", summary: "FONO and Śram Park remain separately governed.", lens: "decide" },
    { title: "Open opportunities", summary: `${tasks.length} opportunities need verified action`, lens: "operate" },
    { title: "Human decisions", summary: `${preview.signOffs.length} growth decisions waiting`, lens: "decide" },
    { title: "Background record", summary: `${audit.length} local shadow events · governed controls retained`, lens: "operate" },
    { title: "Closure rule", summary: "Only independently verified ready capacity closes." },
    { title: "Decision required", summary: `Owner ${preview.summary.owner} · ${preview.summary.gap} gap` },
    { title: "Source and confidence", summary: `${preview.source.name} · Production confidence Low` },
  ]}>
    <LoopHealthStrip health={preview.loopHealth} />
    <div className={styles.freshness} role="status">
      <AlertTriangle aria-hidden />
      <strong>Governed source snapshot</strong>
      <span>Last refresh {date(preview.source.lastRefreshAt)} · no live connection</span>
      <b>{preview.quarantineCount} supply-model or protected-input rows quarantined</b>
    </div>

    <section className={styles.taskBand} aria-labelledby="nia-growth-heading">
      <div>
        <span>{preview.fixtureLabel} · {preview.mode}</span>
        <h2 id="nia-growth-heading">{preview.headline}</h2>
        <p>{preview.question}</p>
      </div>
      <div className={styles.ownerSummary}><b className={styles.verdictPill} data-state="behind">Behind plan · {preview.summary.gap} to add</b><span>Current owner</span><strong>{preview.summary.owner}</strong><small>Property, finance and expansion decisions stay human-approved</small></div>
    </section>

    <section className={styles.flow} aria-label="Growth vs plan">
      {([
        ["Target", preview.summary.target], ["Current", preview.summary.current], ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner], ["Progress", preview.summary.progress], ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.value}</strong><MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} /><small>{measure.detail}</small></article>)}
    </section>
    <p className={styles.soWhat}>So what: the capacity gap is a readiness-and-coverage problem, so it closes by verifying activation-ready Nests, not by committing new capital.</p>

    <section className={styles.lanesPanel} aria-label="Growth by channel">
      <header><div><span>Growth by Channel</span><strong>FONO and Śram Park stay separate</strong></div><p>Capacity · readiness · coverage</p></header>
      <div className={styles.lanes}><GrowthLane lane={preview.lanes[0]} /><GrowthLane lane={preview.lanes[1]} /></div>
      <p className={styles.soWhat}>So what: FONO and Śram Park have different readiness and coverage gates, so each channel needs its own decision; SP additionally cannot proceed without signed contract coverage.</p>
    </section>

    <section className={styles.workPanel} aria-label="Opportunities needing action">
      <header><div><span>Opportunities needing action</span><strong>{tasks.length} opportunities need action</strong></div><p>Preview only</p></header>
      <OperationalCardStack label="Nia Growth channel-correct work">{tasks.map((task) => <OperationalCard key={task.actionId} title={task.issue} domain={`${task.supplyModel} · ${task.location} · ${task.actionId}`} status={task.state} progress={actionStageFromStatus(task.state)} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Progress", value: task.progress }, { label: "Expected verified result", value: task.expectedVerifiedResult }, { label: "Verified result", value: task.verifiedResult }]}><div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.supplyModel} ${task.location}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Evidence received", "Failed evidence", "Human sign-off required"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task)}>Record locally</button><small>No property, contract, capital or external action</small></div></OperationalCard>)}</OperationalCardStack>
      <p className={styles.soWhat}>So what: each opportunity closes only on independently verified readiness evidence, so recorded activity without proof does not add capacity.</p>
    </section>

    <section className={styles.signOffPanel} aria-label="Growth decisions waiting">
      <header><div><span>Growth decisions waiting</span><strong>{preview.signOffs.length} growth decisions waiting</strong></div><p>Human approval required</p></header>
      <OperationalCardStack label="Growth decisions waiting">{preview.signOffs.map((row) => <OperationalCard key={row.id} title={row.decision} domain={row.supplyModel} status={row.status} fields={[{ label: "Owner", value: row.owner }, { label: "Due", value: "Before commitment" }]} progress="evidence" story={[{ label: "Why it matters", value: row.impact }, { label: "What Nia already did", value: "Prepared a recommendation using the verified growth and capital evidence." }, { label: "What happens next", value: `${row.owner} approves or declines. No contract, property or capital action occurs automatically.` }]} />)}</OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Versioned controls and pending approvals</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Status</th></tr></thead><tbody>{preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.name}</td><td>{policy.value === null ? "No value approved" : `${policy.value} ${policy.unit}`}</td><td>v{policy.version}</td><td>{policy.status}</td></tr>)}</tbody></table></div></section>
        <section><strong>Shared learning-control inputs</strong>{preview.learningInputs.map((input) => <dl className={styles.learningGrid} key={input.action_id}><div><dt>Channel / proposal</dt><dd>{input.supply_model} · {input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Approved boundary</dt><dd>{String(input.inside_approved_boundary)} · reverses human decision {String(input.reverses_human_decision)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ") || "No category changed"}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Confidence / adoption</dt><dd>{input.production_confidence} · auto-adopt {String(input.auto_adopt)}</dd></div><div><dt>Rollback</dt><dd>{input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>Append-only local shadow audit</strong>{audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.supplyModel} · {entry.outcome}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Structural action boundary</strong><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>RafiQi may detect, recommend, assign and verify in synthetic shadow state. It cannot contact anyone, sign a contract or lease, commit capex, release a Studio or park, move money, write Production or adopt policy.</p></section>
      </div>
    </details>

    <div className={styles.closureRule}><ShieldCheck aria-hidden /><span><strong>Closure rule</strong>Capacity must be independently verified ready to its channel-specific spec. SP also requires signed contract coverage and contracted build, hardware and service evidence. Activity claims do not close.</span></div>
    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Close the {preview.summary.gap} capacity gap by approving the {preview.signOffs.length} channel-correct growth decisions waiting.</strong>
        <p>No contract, property or capital action happens automatically; accountability sits with {preview.summary.owner} until verified activation-ready capacity meets plan.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{preview.summary.owner}</dd></div>
        <div><dt>By</dt><dd><time dateTime={preview.tasks[0].dueAt}>{date(preview.tasks[0].dueAt)}</time></dd></div>
      </dl>
    </section>

    <footer className={styles.sourceNote}><FileCheck2 aria-hidden /><span>{preview.source.name} · as of {date(preview.source.asOf)} · protected references only</span><Clock3 aria-hidden /><span>Production confidence Low · pending thresholds do not block shadow progress</span></footer>
  </DashboardSectionAccordion>
}
