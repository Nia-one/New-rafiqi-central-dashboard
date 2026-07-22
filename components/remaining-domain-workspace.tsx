import { Activity, BadgeIndianRupee, CircleAlert, Database, FileCheck2, FileLock2, HeartHandshake, PackageCheck, ShieldCheck, UsersRound } from "lucide-react"
import type { RemainingDomainPreview } from "@/lib/operating-loop/remaining-domain-preview"

type Props = { preview: RemainingDomainPreview }

const inrFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function inr(value: number) {
  return inrFormatter.format(value)
}

function percentage(value: number | null) {
  return value === null ? "No data" : `${(value * 100).toFixed(1)}%`
}

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

export function RemainingDomainWorkspace({ preview }: Props) {
  const verifiedFacts = preview.governance.reports[0]?.verifiedFacts.length ?? 0
  const continuityAtRisk = preview.continuity.records.filter((record) => record.livingState !== "Stable" || record.workState !== "Placed").length
  const activeExceptions = preview.actions.filter((action) => action.state !== "Closed").length

  return <div className="domain-control-workspace">
    <section className="closed-loop-status-band" aria-label="Phase 4 control status">
      <div>
        <span className="status-badge"><ShieldCheck aria-hidden />{preview.phase} · {preview.mode}</span>
        <h2>Four domain loops. One governed outcome ledger.</h2>
        <p>Essentials, people execution, Member continuity and reporting share verified sources and append-only actions. This fixture-only Preview cannot send a message, move money, mutate a report or release external material.</p>
      </div>
      <dl>
        <div><dt>Source</dt><dd><Database aria-hidden />Synthetic fixture</dd></div>
        <div><dt>As of</dt><dd>{date(preview.source.asOf)}</dd></div>
        <div><dt>Execution</dt><dd><FileLock2 aria-hidden />Live writes off</dd></div>
      </dl>
    </section>

    <nav className="domain-jump-rail" aria-label="Phase 4 domain sections">
      <a href="#essentials-control"><PackageCheck aria-hidden /><span>01</span><strong>Essentials</strong><small>Savings + margin</small></a>
      <a href="#people-control"><UsersRound aria-hidden /><span>02</span><strong>People</strong><small>Resolved outcomes</small></a>
      <a href="#continuity-control"><HeartHandshake aria-hidden /><span>03</span><strong>Continuity</strong><small>Cross-pillar M6</small></a>
      <a href="#governance-control"><FileCheck2 aria-hidden /><span>04</span><strong>Governance &amp; IR</strong><small>Verified drafts</small></a>
    </nav>

    <section className="closed-loop-metrics" aria-label="Phase 4 summary">
      <article><span>Accepted Essentials records</span><strong>{preview.essentials.accepted.length}</strong><p>Curry, Save and Remit · {preview.essentials.quarantined.length} quarantined</p><small><PackageCheck aria-hidden />Positive savings + Nia margin</small></article>
      <article><span>Resolved-outcome rate</span><strong>{percentage(preview.people.totals.resolvedOutcomeRate)}</strong><p>{preview.people.totals.resolved} verified outcomes · {preview.people.totals.closed} closed actions</p><small><Activity aria-hidden />Activity stays separate</small></article>
      <article><span>M6 retention</span><strong>{percentage(preview.continuity.m6Retention)}</strong><p>{continuityAtRisk} cross-pillar signals need review · warning below {percentage(preview.continuity.policyValues.warning)}</p><small><HeartHandshake aria-hidden />Existing Member tokens only</small></article>
      <article><span>Verified report facts</span><strong>{verifiedFacts}</strong><p>{preview.governance.reports.length} drafts · {activeExceptions} active governed actions</p><small><FileLock2 aria-hidden />External release blocked</small></article>
    </section>

    <section id="essentials-control" className="closed-loop-panel domain-section" aria-labelledby="essentials-control-title">
      <header><div><p className="section-kicker">01 · Essentials loop</p><h3 id="essentials-control-title">Member savings and sustainable margin gate every record.</h3></div><span>Catalogue → stock → order → fulfilment → repeat</span></header>
      <div className="domain-economics-rail">
        {preview.essentials.accepted.map((record) => <article key={record.recordId}>
          <span>{record.service}</span><strong>{record.skuName}</strong><p>{record.inventoryOwnership} · {record.supplierName}</p>
          <dl><div><dt>Member saves</dt><dd>{inr(record.memberSavingsInr)}</dd></div><div><dt>Nia margin</dt><dd>{inr(record.niaMarginInr)}</dd></div><div><dt>Fill</dt><dd>{percentage(record.fillRate)}</dd></div></dl>
        </article>)}
      </div>
      <div className="closed-loop-table-wrap domain-table-wrap" tabIndex={0} role="region" aria-label="Governed Essentials records">
        <table><caption className="sr-only">Curry, Save and Remit records with supplier, inventory, savings, margin and Member behaviour.</caption><thead><tr><th>Service / SKU</th><th>Supplier &amp; purchase terms</th><th>Inventory</th><th className="number">MRP</th><th className="number">Member price</th><th className="number">Savings</th><th className="number">Nia margin</th><th className="number">Stock</th><th className="number">Attach</th><th className="number">Repeat</th><th>Control</th></tr></thead>
          <tbody>{preview.essentials.accepted.map((record) => <tr key={record.recordId}><td><strong>{record.service}</strong><small>{record.skuName} · {record.skuId}</small></td><td><strong>{record.supplierName}</strong><small>{record.purchaseTerms}</small></td><td>{record.inventoryOwnership}</td><td className="number">{inr(record.mrpInr)}</td><td className="number">{inr(record.memberPriceInr)}</td><td className="number">{inr(record.memberSavingsInr)}</td><td className="number">{inr(record.niaMarginInr)}</td><td className="number">{record.availableUnits}</td><td className="number">{percentage(record.attachRate)}</td><td className="number">{percentage(record.repeatRate)}</td><td><span className="written-status">{record.stockout ? "Stockout routed" : "Eligible"}</span></td></tr>)}</tbody>
        </table>
      </div>
      <div className="domain-quarantine"><CircleAlert aria-hidden /><div><strong>{preview.essentials.quarantined.length} record quarantined before reporting or action.</strong><p>{preview.essentials.quarantined.map((record) => `${record.recordId}: ${record.reasons.join(" ")}`).join(" · ")}</p><small>Lineage: {preview.essentials.quarantined.map((record) => record.sourceRowIdentity).join(", ")}</small></div></div>
    </section>

    <section id="people-control" className="closed-loop-panel domain-section" aria-labelledby="people-control-title">
      <header><div><p className="section-kicker">02 · People and execution loop</p><h3 id="people-control-title">Activity, closure and resolved outcome remain separate.</h3></div><span>JCO · EAE · Theatre · function</span></header>
      <div className="domain-rate-strip">
        <article><span>Activity updates</span><strong>{preview.people.totals.activity}</strong><small>Work recorded; not a closure claim</small></article>
        <article><span>Closure rate</span><strong>{percentage(preview.people.totals.closureRate)}</strong><small>{preview.people.totals.closed} closed / {preview.people.totals.assigned} assigned</small></article>
        <article><span>Resolved-outcome rate</span><strong>{percentage(preview.people.totals.resolvedOutcomeRate)}</strong><small>{preview.people.totals.resolved} independently resolved / {preview.people.totals.assigned}</small></article>
      </div>
      <div className="closed-loop-table-wrap domain-table-wrap" tabIndex={0} role="region" aria-label="People execution control">
        <table><caption className="sr-only">Named people, reporting, activity, closures, resolved outcomes and payout controls.</caption><thead><tr><th>Owner</th><th>Scope</th><th className="number">Assigned</th><th className="number">Activity</th><th className="number">Closed</th><th className="number">Resolved</th><th className="number">Closure</th><th className="number">Outcome</th><th>Reporting</th><th>Control flags</th><th className="number">Eligible incentive</th></tr></thead>
          <tbody>{preview.people.people.map((person) => <tr key={person.actorId}><td><strong>{person.displayName}</strong><small>{person.actorId} · {person.role}</small></td><td><strong>{person.theatreId}</strong><small>{person.studioId ?? "Theatre / function"}</small></td><td className="number">{person.assignedActions}</td><td className="number">{person.activityUpdates}</td><td className="number">{person.closedActions}</td><td className="number">{person.resolvedOutcomes}</td><td className="number">{percentage(person.closureRate)}</td><td className="number">{percentage(person.resolvedOutcomeRate)}</td><td>{date(person.lastReportedAt)}</td><td>{person.flags.length ? person.flags.map((flag) => <span className="domain-flag" key={flag}>{flag}</span>) : <span className="written-status">Current</span>}</td><td className="number">{inr(person.incentiveEligibleInr)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="readonly-note"><FileLock2 aria-hidden />Incentive eligibility consumes approved outcome definitions only. Raw payroll and individual payout records remain outside general analytics; every exception stays human-reviewed.</p>
    </section>

    <section id="continuity-control" className="closed-loop-panel domain-section" aria-labelledby="continuity-control-title">
      <header><div><p className="section-kicker">03 · Member continuity and retention</p><h3 id="continuity-control-title">One Member signal across Living, Work and Essentials.</h3></div><span>No duplicate Member master</span></header>
      <div className="continuity-control-band">
        <div><HeartHandshake aria-hidden /><span>M6 retention</span><strong>{percentage(preview.continuity.m6Retention)}</strong><small>{preview.continuity.verifiedCohortSize} verified cohort Members · {preview.continuity.pendingSignals} pending excluded</small></div>
        <div className="continuity-meter" aria-label={`M6 retention ${percentage(preview.continuity.m6Retention)}, warning below ${percentage(preview.continuity.policyValues.warning)}`}><span style={{ width: `${(preview.continuity.m6Retention ?? 0) * 100}%` }} /><i style={{ left: `${preview.continuity.policyValues.warning * 100}%` }} /><b style={{ left: `${preview.continuity.policyValues.reference * 100}%` }} /></div>
        <dl><div><dt>Warning</dt><dd>{percentage(preview.continuity.policyValues.warning)}</dd></div><div><dt>Approx. reference</dt><dd>{percentage(preview.continuity.policyValues.reference)}</dd></div><div><dt>Monthly churn ref.</dt><dd>{percentage(preview.continuity.policyValues.churn)}</dd></div></dl>
      </div>
      <div className="closed-loop-table-wrap domain-table-wrap" tabIndex={0} role="region" aria-label="Cross-pillar Member continuity signals">
        <table><caption className="sr-only">Anonymised Member continuity signals from existing pillar sources.</caption><thead><tr><th>Member token</th><th>Cohort</th><th>Living</th><th>Work</th><th>Essentials</th><th>M6</th><th>Monthly churn</th><th>Verification</th><th>Source coverage</th></tr></thead>
          <tbody>{preview.continuity.records.map((record) => <tr key={record.memberToken}><td><strong>{record.memberToken}</strong><small>Anonymised existing token</small></td><td>{record.cohort}</td><td><span className="written-status">{record.livingState}</span></td><td><span className="written-status">{record.workState}</span></td><td><span className="written-status">{record.essentialsState}</span></td><td>{record.activeAtM6 ? "Retained" : "Not retained"}</td><td>{record.churnedThisMonth ? "Churned" : "No"}</td><td>{record.verificationStatus}</td><td>{record.sourceRefs.length} governed refs</td></tr>)}</tbody>
        </table>
      </div>
      <p className="readonly-note"><Database aria-hidden />This projection joins anonymised existing Member tokens and preserves every pillar source reference. It creates no disconnected continuity database and admits only verified cohort records to the metric.</p>
    </section>

    <section className="closed-loop-panel domain-action-ledger" aria-labelledby="domain-action-ledger-title">
      <header><div><p className="section-kicker">Shared action ledger</p><h3 id="domain-action-ledger-title">Owners, evidence and independent verification.</h3></div><span>Append-only · optimistic versioning</span></header>
      <div className="closed-loop-table-wrap domain-table-wrap" tabIndex={0} role="region" aria-label="Phase 4 action ledger"><table><caption className="sr-only">Governed actions for the remaining domain agents.</caption><thead><tr><th>Domain / action</th><th>Objective</th><th>Owner</th><th>Verifier</th><th>Due</th><th>Evidence</th><th>State</th><th className="number">Audit events</th></tr></thead><tbody>{preview.actions.map((action) => <tr key={action.actionId}><td><strong>{action.domain}</strong><small>{action.actionId} · {action.title}</small></td><td>{action.objective}</td><td>{action.ownerActorId}</td><td>{action.verifierActorId}</td><td>{date(action.dueAt)}</td><td>{action.evidence.length} protected / {action.requiredEvidence.length} required</td><td><span className="written-status">{action.state}</span></td><td className="number">{action.history.length}</td></tr>)}</tbody></table></div>
    </section>

    <section id="governance-control" className="closed-loop-panel domain-section" aria-labelledby="governance-control-title">
      <header><div><p className="section-kicker">04 · Governance and IR verified reporting</p><h3 id="governance-control-title">Verified facts enter drafts. Nothing leaves without CEO approval.</h3></div><span>Read-only projections</span></header>
      <div className="governance-draft-grid">
        {preview.governance.reports.map((report) => <article key={report.reportId}><FileCheck2 aria-hidden /><span>{report.reportType}</span><strong>{report.audience}</strong><p>{report.verifiedFacts.length} verified facts · {report.excludedFacts.length} excluded</p><small><FileLock2 aria-hidden />{report.status} · CEO approval required</small></article>)}
      </div>
      <div className="closed-loop-table-wrap domain-table-wrap" tabIndex={0} role="region" aria-label="Verified facts admitted to governed reporting">
        <table><caption className="sr-only">Verified, allowlisted, non-payroll facts with metric and source lineage.</caption><thead><tr><th>Fact</th><th>Metric definition</th><th>Value</th><th>Source</th><th>As of</th><th>Verifier</th><th>State</th></tr></thead><tbody>{preview.governance.reports[0]?.verifiedFacts.map((fact) => <tr key={fact.factId}><td><strong>{fact.factId}</strong><small>Synthetic · internal</small></td><td><strong>{fact.metric.name}</strong><small>{fact.metric.metricId}@v{fact.metric.version}</small></td><td>{fact.value}</td><td>{fact.sourceRowIdentity}</td><td>{date(fact.asOf)}</td><td>{fact.verifiedBy}</td><td><span className="written-status">Verified</span></td></tr>)}</tbody></table>
      </div>
      <div className="governance-source-grid">
        <div><p className="section-kicker">Source lineage &amp; freshness</p>{preview.governance.sourceCoverage.map((source) => <p key={source.source}><strong>{source.source}</strong><span>{source.status} · {source.lineage}</span></p>)}</div>
        <div><p className="section-kicker">Excluded from every draft</p>{preview.governance.reports[0]?.excludedFacts.map((fact) => <p key={fact.factId}><strong>{fact.factId}</strong><span>{fact.reason}</span></p>)}</div>
        <aside><BadgeIndianRupee aria-hidden /><strong>Release controls stay locked.</strong><p>Reports cannot mutate operating records. Board, investor or external capital material remains a draft until CEO approval; this Preview has no send or publish capability.</p><small>External release permitted: No</small></aside>
      </div>
    </section>
  </div>
}
