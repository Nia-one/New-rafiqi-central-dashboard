import { LoopHealthStrip } from "@/components/loop-health-strip"
import { MeasureViz } from "@/components/measure-viz"
import type { NiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import { dashboardDisplayLabel } from "@/lib/dashboard-model"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import styles from "@/components/nia-margins-workspace.module.css"

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

export function NiaMarginsWorkspace({ preview, owner = "Finance JCO" }: { preview: NiaMarginsPreview; owner?: string }) {
  const pillarRows = [
    { label: "Living", value: preview.measures.pillarCm2Inr.living, target: 300 },
    { label: "Work", value: preview.measures.pillarCm2Inr.work, target: 1_000 },
    { label: "Essentials", value: preview.measures.pillarCm2Inr.essentials, target: 200 },
  ]
  const behind = preview.measures.fullUseCm2Inr < preview.measures.fullUseTargetInr
  const gapInr = preview.measures.fullUseTargetInr - preview.measures.fullUseCm2Inr
  const verdictLabel = behind ? `Below control · ${inr(gapInr)}/unit to recover` : "At or above control"
  const decisionOwner = owner || (preview.diagnoses[0] ? dashboardDisplayLabel(preview.diagnoses[0].ownerRole) : "Finance JCO")
  const decisionDue = preview.actions[0]?.dueAt
  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Nia Margins sections" sections={[
    { title: "Margin verdict", summary: verdictLabel },
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} verified` },
    { title: "Headline measures", summary: `${inr(preview.measures.fullUseCm2Inr)} full-use CM2 · ${preview.measures.occupancyPct}% occupancy`, lens: "decide" },
    { title: "Margin implication", summary: "The gap is concentrated in measured Studio causes.", lens: "decide" },
    { title: "Profit drivers and learning", summary: `${preview.actions.length} governed actions · ${preview.despatchEscalations.length} escalations` },
    { title: "Decision required", summary: `Recover ${inr(gapInr)}/unit · owner ${decisionOwner}` },
  ]}>
    <header className={styles.headline}>
      <div><h2>{preview.answer}</h2><p>{preview.question}</p></div>
      <dl>
        <div className={styles.verdictCell}><dt>Verdict</dt><dd><b className={styles.verdictPill} data-state={behind ? "behind" : "on-track"}>{verdictLabel}</b></dd></div>
        <div><dt>Owner</dt><dd>{owner}</dd></div>
        <div><dt>Progress</dt><dd>{preview.loopHealth.verification.verified}/{preview.loopHealth.verification.claimed} verified</dd></div>
        <div><dt>Mode</dt><dd>{preview.mode}</dd></div>
      </dl>
    </header>
    <LoopHealthStrip health={preview.loopHealth} />
    <div className={styles.measures} data-kpi-group aria-label="Nia Margins measures">
      <article className={styles.measure}><span>Full-use CM2</span><strong>{inr(preview.measures.fullUseCm2Inr)}</strong><MeasureViz showCaption={false} value={inr(preview.measures.fullUseCm2Inr)} target={inr(preview.measures.fullUseTargetInr)} /><small>Target {inr(preview.measures.fullUseTargetInr)}</small></article>
      <article className={styles.measure}><span>Pillar CM2</span><strong>{inr(preview.measures.pillarCm2Inr.living + preview.measures.pillarCm2Inr.work + preview.measures.pillarCm2Inr.essentials)}</strong><small>Living · Work · Essentials</small></article>
      <article className={styles.measure}><span>Occupancy</span><strong>{preview.measures.occupancyPct}%</strong><MeasureViz showCaption={false} value={`${preview.measures.occupancyPct}%`} target={`${preview.measures.occupancyTargetPct}%`} /><small>Control {preview.measures.occupancyTargetPct}% · ramp separate</small></article>
      <article className={styles.measure}><span>Studio health</span><strong>{preview.measures.negativeContributionStudios}</strong><small>negative · GM {preview.measures.studioGrossMarginPct}%</small></article>
    </div>
    <p className={styles.soWhat}>So what: the full-use CM2 gap is driven by a small number of measured Studio operating causes, not a structural pricing problem, so it is recoverable through Studio actions.</p>
    <div className={styles.body}>
      <article className={styles.panel}>
        <h3>What’s moving profit</h3><p>Collection leakage stays in Cash &amp; Control.</p>
        <div className={styles.waterfall} aria-label="Billed CM2 waterfall by pillar">
          {pillarRows.map((row) => <div className={styles.barRow} key={row.label}><span>{row.label}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.min(100, Math.max(0, row.value / row.target * 100))}%` }} /></div><b>{inr(row.value)}</b></div>)}
        </div>
        <div className={styles.diagnoses} aria-label="Attributed Studio actions">
          {preview.diagnoses.map((item) => <div className={styles.diagnosis} key={item.studioId}>
            <div><strong>{item.studioName}</strong><span>{item.supplyModel} · {item.ramp ? `Ramp day` : `${item.occupancyPct}% occupied`}</span></div>
            <div><strong>{item.primaryCause}</strong><small>{inr(item.studioTotalCm2GapInr)} vs control</small></div>
            <div><strong>{dashboardDisplayLabel(item.ownerRole)}</strong><small>Route to {dashboardDisplayLabel(item.routeTo)}</small></div>
            <span className={styles.status}>{item.actionState}</span>
          </div>)}
        </div>
        <div className={styles.learning} aria-label="Margin recovery evidence">
          <div><span>Action chain</span><strong>{preview.actions.length} governed actions</strong><p>Each action requires protected billed-revenue and direct-cost proof before a different actor can verify it.</p></div>
          <div><span>Recovery</span><strong>{preview.actions.filter((action) => action.state === "Verified").length} verified · {preview.actions.filter((action) => action.state === "Reopened").length} reopened</strong><p>Claimed activity does not close a margin exception.</p></div>
          <div><span>Despatch</span><strong>{preview.despatchEscalations.length} sustained exception{preview.despatchEscalations.length === 1 ? "" : "s"}</strong><p>Only repeated or explicitly escalated failures are emitted to Despatch.</p></div>
        </div>
        <p className={styles.soWhat}>So what: each attributed action must close on protected billed-revenue and direct-cost proof, so claimed fixes do not recover the gap until independently verified.</p>
      </article>
      <aside className={styles.panel} aria-label="Self Learn recommendation">
        <h3>Early patterns to watch</h3><p>Recommendations only; definitions stay fixed.</p>
        <div className={styles.learning}>
          <div><span>Attribution</span><strong>{preview.learning.attributionLabel}</strong></div>
          <div><span>Confidence</span><strong>{preview.learning.confidence}</strong><p>{preview.learning.confidenceReasons.join(" · ")}</p></div>
          <div><span>Materiality</span><strong>{preview.learning.material ? "Material" : "Non-material"}</strong><p>{preview.learning.materialityReasons.join(" · ") || "Inside approved bounds"}</p></div>
          <div><span>Disposition</span><strong>{preview.learning.requiredDisposition}</strong><p>Self Learn cannot change CM definitions, prices, terms or Studio status.</p></div>
        </div>
        <p className={styles.soWhat}>So what: these are recommendations to watch, not adopted changes, so nothing here alters margin definitions until a human approves it.</p>
      </aside>
    </div>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Recover the {inr(gapInr)}/unit full-use CM2 gap by verifying the attributed Studio actions.</strong>
        <p>Recovery closes only on protected billed-revenue and direct-cost proof; accountability sits with {decisionOwner} until full-use CM2 clears the ₹{preview.measures.fullUseTargetInr} control.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{decisionOwner}</dd></div>
        {decisionDue ? <div><dt>By</dt><dd><time dateTime={decisionDue}>{date(decisionDue)}</time></dd></div> : <div><dt>Done when</dt><dd>Full-use CM2 ≥ control</dd></div>}
      </dl>
    </section>
  </DashboardSectionAccordion>
}
