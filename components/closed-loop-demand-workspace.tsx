"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Check, CheckCircle2, Database, Eye, FileCheck2, LockKeyhole, MapPin, ShieldCheck, Sparkles } from "lucide-react"
import type { ClosedLoopPreview } from "@/lib/operating-loop/preview"

type Props = { preview: ClosedLoopPreview }

const loopSteps = ["Enterprise demand", "Studio capacity", "Action", "Evidence", "Independent verification", "Member activation", "Verified reporting"]
const inrFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function inr(value: number) {
  return inrFormatter.format(value)
}

function date(value: string) {
  return dateFormatter.format(new Date(value)) + " IST"
}

export function ClosedLoopDemandWorkspace({ preview }: Props) {
  const [selectedStudioId, setSelectedStudioId] = useState(preview.selectedStudioId)
  const [auditOpen, setAuditOpen] = useState(false)
  const selected = useMemo(() => preview.ranking.find((match) => match.studioId === selectedStudioId) ?? preview.ranking[0], [preview.ranking, selectedStudioId])

  return <div className="closed-loop-workspace">
    <section className="closed-loop-status-band" aria-label="Preview status">
      <div>
        <span className="status-badge"><Eye aria-hidden />{preview.mode}</span>
        <h2>Close enterprise demand with verified Member activation.</h2>
        <p>Every factor is visible. Every governed change waits for approval. Nothing in this Preview writes to a live provider.</p>
      </div>
      <dl>
        <div><dt>Source</dt><dd><Database aria-hidden />Synthetic Preview fixture</dd></div>
        <div><dt>As of</dt><dd>{date(preview.source.asOf)}</dd></div>
        <div><dt>Freshness</dt><dd><CheckCircle2 aria-hidden />{preview.source.freshness}</dd></div>
      </dl>
    </section>

    <section className="closed-loop-metrics" aria-label="Closed-loop metrics">
      <article><span>Open demand</span><strong>{preview.demand.remainingHeadcount}</strong><p>Members · Enterprise_Demand<br />As of {date(preview.source.asOf)}</p><small><ShieldCheck aria-hidden />Source-validated</small></article>
      <article><span>Selected capacity</span><strong>{selected.activationReadyNests}</strong><p>Nests · Studio_Master<br />As of {date(selected.source.updatedAt)}</p><small><ShieldCheck aria-hidden />Source-validated</small></article>
      <article><span>Verified activations</span><strong>{preview.activation.verifiedCount}</strong><p>Members · verified event<br />As of {date(preview.projection.occurredAt)}</p><small><CheckCircle2 aria-hidden />Independently verified</small></article>
      <article><span>Rows quarantined</span><strong>{preview.dataQuality.quarantined}</strong><p>of {preview.dataQuality.submitted} fixture rows<br />Immutable lineage retained</p><small><LockKeyhole aria-hidden />Privacy gate active</small></article>
    </section>

    <section className="closed-loop-stepper" aria-label="Demand activation loop">
      {loopSteps.map((step, index) => <div key={step}><span><Check aria-hidden /></span><strong>{step}</strong>{index < loopSteps.length - 1 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className="closed-loop-demand-summary">
      <div><p className="section-kicker">Demand master · {preview.demand.demandId}</p><h3>{preview.demand.enterpriseName} · {preview.demand.plantName}</h3><span>{preview.demand.roleRequired} · {preview.demand.certainty}</span></div>
      <dl><div><dt>Remaining</dt><dd>{preview.demand.remainingHeadcount} Members</dd></div><div><dt>Activate by</dt><dd>{date(preview.demand.activationRequiredAt)}</dd></div><div><dt>Selected Studio</dt><dd>{selected.studioName}</dd></div></dl>
    </section>

    <div className="closed-loop-master-detail">
      <section className="closed-loop-panel closed-loop-ranking">
        <header><div><p className="section-kicker">Deterministic option ranking</p><h3>Nearby Studio capacity</h3></div><span>Click a row to inspect factors</span></header>
        <div className="closed-loop-table-wrap" tabIndex={0}>
          <table>
            <thead><tr><th>Rank</th><th>Studio</th><th>Demand fit</th><th>Distance</th><th className="number">Ready Nests</th><th className="number">Capital / ready Nest</th><th className="number">Recurring / occupied Nest</th><th className="number">Friction</th></tr></thead>
            <tbody>{preview.ranking.map((match) => <tr key={match.studioId} className={selected.studioId === match.studioId ? "selected" : undefined}>
              <td><button type="button" onClick={() => setSelectedStudioId(match.studioId)} aria-label={`Inspect ${match.studioName}`}>{match.rank}</button></td>
              <td><strong>{match.studioName}</strong><small>{match.studioId}</small></td>
              <td><span className="written-status">{match.canMeetHeadcount && match.canMeetActivationDate ? "Meets both" : match.canMeetActivationDate ? "Date only" : "Gap"}</span></td>
              <td>{match.distanceKm} km {match.direction}</td><td className="number">{match.activationReadyNests}</td><td className="number">{inr(match.capitalPerReadyNestInr)}</td><td className="number">{inr(match.recurringCostPerExpectedOccupiedNestInr)}</td><td className="number">{match.activationFrictionDays} days</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <aside className="closed-loop-panel closed-loop-option-detail">
        <header><div><p className="section-kicker">Selected option</p><h3>{selected.studioName}</h3></div><MapPin aria-hidden /></header>
        <dl>
          <div><dt>Upfront capital</dt><dd>{inr(selected.upfrontCapitalInr)}</dd></div>
          <div><dt>Deposit + capex</dt><dd>{inr(selected.depositAndCapexInr)}</dd></div>
          <div><dt>90-day projected CM</dt><dd>{inr(selected.projected90DayContributionMarginInr)}</dd></div>
          <div><dt>Available</dt><dd>{date(selected.availableAt)}</dd></div>
        </dl>
        <h4>Why this rank</h4>
        <ol>{selected.why.map((reason) => <li key={reason}><Check aria-hidden />{reason}</li>)}</ol>
        <p className="lineage-note"><Database aria-hidden />{selected.source.synthetic ? "Synthetic" : "Source"} · {selected.source.rowIdentity}</p>
      </aside>
    </div>

    <div className="closed-loop-lower-grid">
      <section className="closed-loop-panel closed-loop-action">
        <header><div><p className="section-kicker">Action ledger · {preview.action.actionId}</p><h3>{preview.action.title}</h3></div><span className="status-badge"><CheckCircle2 aria-hidden />{preview.action.state}</span></header>
        <div className="closed-loop-action-facts">
          <div><span>Owner</span><strong>{preview.action.ownerActorId}</strong></div><div><span>Due</span><strong>{date(preview.action.dueAt)}</strong></div><div><span>Impact</span><strong>{preview.action.expectedImpact}</strong></div><div><span>Confidence</span><strong>{Math.round(preview.action.confidence * 100)}%</strong></div>
        </div>
        <div className="closed-loop-proof-grid">
          <article><p className="section-kicker">Approval</p><strong>{preview.action.approvals[0]?.approvedBy} · {preview.action.approvals[0]?.tier}</strong><span>{preview.action.approvals[0]?.note}</span></article>
          <article><p className="section-kicker">Evidence</p><strong>{preview.action.evidence.length} protected records</strong><span>{preview.action.evidence.map((item) => item.description).join(" · ")}</span></article>
          <article><p className="section-kicker">Verification</p><strong>{preview.action.verifierActorId}</strong><span>Independent from owner · proof before closure</span></article>
        </div>
        <button className="audit-toggle" type="button" onClick={() => setAuditOpen((value) => !value)} aria-expanded={auditOpen}><FileCheck2 aria-hidden />{auditOpen ? "Hide immutable audit trail" : "Show immutable audit trail"}</button>
        {auditOpen ? <ol className="closed-loop-timeline">{preview.action.history.map((event) => <li key={event.eventId}><span>v{event.version}</span><div><strong>{event.to}</strong><p>{event.note}</p><small>{event.actorId} · {date(event.occurredAt)}</small></div></li>)}</ol> : null}
      </section>

      <section className="closed-loop-panel closed-loop-reporting">
        <header><div><p className="section-kicker">Verified reporting gate</p><h3>Read-only Rafiqi Insights event</h3></div><Sparkles aria-hidden /></header>
        <div className="closed-loop-event"><span>{preview.projection.eventType}</span><strong>{preview.projection.verifiedActivationCount} verified Member activations</strong><p>{preview.projection.demandId} · {preview.projection.studioId}</p></div>
        <dl><div><dt>Verification</dt><dd>{preview.projection.verificationStatus}</dd></div><div><dt>Verifier</dt><dd>{preview.activation.verifiedBy}</dd></div><div><dt>Batch</dt><dd>{preview.activation.batchId}</dd></div><div><dt>Source</dt><dd>{preview.projection.synthetic ? "Synthetic Preview" : "Governed source"}</dd></div></dl>
        <div className="closed-loop-samples"><p className="section-kicker">Protected samples</p><code>{preview.activation.sampleMemberTokens.join(" · ")}</code><code>{preview.activation.sampleNestIds.join(" · ")}</code></div>
        <p className="readonly-note"><LockKeyhole aria-hidden />Only allowlisted, verified fields cross into reporting. Raw evidence, PII, payroll and write controls do not.</p>
      </section>
    </div>
  </div>
}
