"use client"

import { useState } from "react"
import { Building2, CheckCircle2, Clock3, Database, Eye, FileCheck2, Landmark, LockKeyhole, Scale, ShieldAlert, ShieldCheck } from "lucide-react"
import type { FinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { buildLiveApprovals } from "@/lib/live-approvals"
import { aggregateLatestFinanceSnapshots, latestFinanceSnapshots, optionalSheetNumber } from "@/lib/live-mappers/cash-control-finance"

type Props = { preview: FinanceExpansionPreview; liveData?: any }

const inrFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function inr(value: number | null) {
  return value === null ? "Not monetary" : inrFormatter.format(value)
}

function date(value: string | null) {
  return value ? `${dateFormatter.format(new Date(value))} IST` : "Not required"
}

function percentage(value: number | null) {
  return value === null ? "Missing" : `${(value * 100).toFixed(1)}%`
}

function rowText(row: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!row) return ""
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function liveFinanceControlStatus(liveData: any, liveApprovals: ReturnType<typeof buildLiveApprovals>) {
  const policies = Array.isArray(liveData?.policies) ? liveData.policies as Record<string, unknown>[] : []
  const policy = (pattern: RegExp) => policies.find((row) => pattern.test([
    rowText(row, "policy id"),
    rowText(row, "policy name", "name"),
  ].join(" ").toLowerCase()))
  const modePolicy = policy(/(?:finance|autonomy|operating).*mode|mode.*(?:finance|autonomy|operating)/)
  const approverPolicy = policy(/financial approver|finance approver|money approver/)
  const mode = rowText(modePolicy, "policy value", "value") || "Mode not recorded"
  const pendingApprover = liveApprovals.find((approval) => approval.pending)?.owner
  const approver = pendingApprover || rowText(approverPolicy, "policy value", "value", "approved by") || "No pending approver"
  const sources = [
    Array.isArray(liveData?.approvals) && "Approval_Log",
    Array.isArray(liveData?.actions) && "Action_Log",
    Array.isArray(liveData?.policies) && "Policy_Registry",
  ].filter(Boolean).join(" + ") || "Connected Sheet source not recorded"
  return { mode, approver, sources, asOf: typeof liveData?.asOf === "string" ? liveData.asOf : null }
}

export function liveFinanceGuardrails(liveData: any, liveApprovals: ReturnType<typeof buildLiveApprovals>) {
  const financeRows = Array.isArray(liveData?.finance) ? liveData.finance as Record<string, unknown>[] : []
  const finance = aggregateLatestFinanceSnapshots(financeRows)
  const policies = Array.isArray(liveData?.policies) ? liveData.policies as Record<string, unknown>[] : []
  const findPolicy = (pattern: RegExp) => policies.find((row) => pattern.test([
    rowText(row, "policy id"), rowText(row, "policy name", "name"),
  ].join(" ").toLowerCase()))
  const opexPolicy = findPolicy(/opex.*cap|cap.*opex/)
  const cashPolicy = findPolicy(/minimum.*cash|cash.*minimum|cash.*guardrail/)
  const hiringPolicy = findPolicy(/hiring.*state|employment.*state|hiring.*policy/)
  const proposedHiresPolicy = findPolicy(/proposed.*hires|hires.*proposed/)
  const policyNumber = (row: Record<string, unknown> | undefined) => optionalSheetNumber(rowText(row, "policy value", "value"))
  const policyRef = (row: Record<string, unknown> | undefined) => {
    const id = rowText(row, "policy id")
    const version = rowText(row, "version")
    return id ? `${id}${version ? `@v${version}` : ""}` : "Policy not recorded"
  }
  const policyResponse = (row: Record<string, unknown> | undefined, fallback: string) => rowText(row, "required response", "response", "escalation action", "action") || fallback
  const forecastOpex = optionalSheetNumber(finance?.["opex forecast inr"])
  const opexCap = policyNumber(opexPolicy) ?? optionalSheetNumber(finance?.["opex cap inr"])
  const cashBalance = optionalSheetNumber(finance?.["cash balance inr"])
  const pendingCommitments = liveApprovals.filter((approval) => approval.pending).reduce((sum, approval) => sum + Math.max(0, approval.amountInr), 0)
  const projectedCash = cashBalance === null ? null : cashBalance - pendingCommitments
  const minimumCash = policyNumber(cashPolicy)
  const hiringState = rowText(hiringPolicy, "policy value", "value") || "Not recorded"
  const recordedHireValues = latestFinanceSnapshots(financeRows).map((row) => optionalSheetNumber(row["proposed new hires"])).filter((value): value is number => value !== null)
  const proposedHires = recordedHireValues.length
    ? recordedHireValues.reduce((sum, value) => sum + value, 0)
    : policyNumber(proposedHiresPolicy)
  const breaches: Array<{ kind: string; response: string; variance: number; policyId: string }> = []
  if (forecastOpex !== null && opexCap !== null && forecastOpex > opexCap) breaches.push({
    kind: "Opex forecast breach", response: policyResponse(opexPolicy, "Escalate before month close"), variance: forecastOpex - opexCap, policyId: policyRef(opexPolicy),
  })
  if (projectedCash !== null && minimumCash !== null && projectedCash < minimumCash) breaches.push({
    kind: "Cash guardrail breach", response: policyResponse(cashPolicy, "Immediate escalation"), variance: minimumCash - projectedCash, policyId: policyRef(cashPolicy),
  })
  if (proposedHires !== null && proposedHires > 0 && /frozen|blocked|closed/i.test(hiringState)) breaches.push({
    kind: "Hiring freeze breach", response: policyResponse(hiringPolicy, "Human approval required"), variance: proposedHires, policyId: policyRef(hiringPolicy),
  })
  return { forecastOpex, opexCap, opexPolicyRef: policyRef(opexPolicy), projectedCash, minimumCash, hiringState, hiringPolicyRef: policyRef(hiringPolicy), proposedHires, breaches }
}

export function FinanceExpansionWorkspace({ preview, liveData }: Props) {
  const [selectedStudioId, setSelectedStudioId] = useState(preview.selectedStudioId)
  const [selectedCaseId, setSelectedCaseId] = useState(preview.warRoomCases[0]?.caseId ?? "")
  const [auditOpen, setAuditOpen] = useState(false)
  const selectedOption = preview.options.find((option) => option.studioId === selectedStudioId) ?? preview.options[0]
  const selectedCase = preview.warRoomCases.find((warRoomCase) => warRoomCase.caseId === selectedCaseId) ?? preview.warRoomCases[0]
  const liveApprovals = buildLiveApprovals(liveData).filter((approval) => approval.amountInr > 0 || ["cash-control", "nia-margins", "nia-growth"].includes(approval.domain))
  const liveStatus = liveData ? liveFinanceControlStatus(liveData, liveApprovals) : null
  const liveGuardrails = liveData ? liveFinanceGuardrails(liveData, liveApprovals) : null
  const pendingApprovals = liveData ? liveApprovals.filter((approval) => approval.pending).length : preview.approvals.filter((approval) => approval.status === "Requested").length
  const approvalTotal = liveData ? liveApprovals.length : preview.approvals.length

  return <DashboardSectionAccordion className="finance-control-workspace" ariaLabel="Finance control sections" sections={[
    { title: "Finance control status", summary: `${liveStatus?.mode ?? preview.mode} · approver ${liveStatus?.approver ?? preview.policies.financialApprover.value}` },
    { title: "Financial guardrails", summary: `${pendingApprovals} approvals requested · cash and opex protected` },
    { title: "Guardrail exceptions", summary: `${liveGuardrails ? liveGuardrails.breaches.length : preview.guardrails.breaches.length} forecast exceptions require a decision` },
    { title: "Expansion options", summary: `${preview.options.length} Studios compared · ${selectedOption.studioName} selected` },
    { title: "Approval ledger", summary: `${pendingApprovals}/${approvalTotal} categories requested` },
    { title: "Studio health", summary: `${preview.studioHealth.length} required responses` },
    { title: "War Room", summary: `${preview.warRoomCases.length} cases · ${selectedCase.state}` },
  ]}>
    <section className="closed-loop-status-band" aria-label="Finance control status">
      <div>
        <span className="status-badge"><Eye aria-hidden />{liveStatus?.mode ?? preview.mode}</span>
        <h2>Govern expansion capital before it becomes a commitment.</h2>
        <p>Studio economics, policy versions, approvals and War Room decisions remain explicit. This read-only projection cannot move money, accept terms, release a Studio or write to Production.</p>
      </div>
      <dl>
        <div><dt>Source</dt><dd><Database aria-hidden />{liveStatus?.sources ?? "Synthetic finance fixture"}</dd></div>
        <div><dt>As of</dt><dd>{date(liveStatus?.asOf ?? preview.source.asOf)}</dd></div>
        <div><dt>Approver</dt><dd><ShieldCheck aria-hidden />{liveStatus?.approver ?? preview.policies.financialApprover.value}</dd></div>
      </dl>
    </section>

    <section className="closed-loop-metrics" data-kpi-group aria-label="Financial guardrails">
      <article><span>Forecast monthly opex</span><strong>{inr(liveGuardrails ? liveGuardrails.forecastOpex : preview.guardrails.forecast.forecastMonthlyOpexInr)}</strong><p>Cap {inr(liveGuardrails ? liveGuardrails.opexCap : preview.policies.monthlyOpexCap.value)} · {liveGuardrails?.opexPolicyRef ?? `${preview.policies.monthlyOpexCap.policyId}@v${preview.policies.monthlyOpexCap.version}`}</p><small><ShieldAlert aria-hidden />Review before month close</small></article>
      <article><span>Projected cash</span><strong>{inr(liveGuardrails ? liveGuardrails.projectedCash : preview.guardrails.projectedCashAfterCommitmentInr)}</strong><p>Minimum {inr(liveGuardrails ? liveGuardrails.minimumCash : preview.policies.minimumCash.value)} · after pending recorded commitments</p><small><ShieldAlert aria-hidden />Immediate escalation</small></article>
      <article><span>Hiring state</span><strong>{liveGuardrails?.hiringState ?? preview.policies.hiringState.value}</strong><p>{liveGuardrails?.hiringPolicyRef ?? `${preview.policies.hiringState.policyId}@v${preview.policies.hiringState.version}`} · proposed hires {liveGuardrails ? liveGuardrails.proposedHires ?? "Not recorded" : preview.guardrails.forecast.proposedNewHires}</p><small><LockKeyhole aria-hidden />Policy-locked</small></article>
      <article><span>Financial approval queue</span><strong>{pendingApprovals}</strong><p>of {approvalTotal} governed categories remain requested</p><small><FileCheck2 aria-hidden />No auto-approval</small></article>
    </section>

    <section className="finance-guardrail-band" aria-label="Guardrail exceptions">
      <div><p className="section-kicker">Locked financial control</p><h3>{liveGuardrails ? liveGuardrails.breaches.length : preview.guardrails.breaches.length} forecast exceptions require a human decision.</h3></div>
      <ol>{(liveGuardrails ? liveGuardrails.breaches : preview.guardrails.breaches).map((breach) => <li key={breach.kind}><ShieldAlert aria-hidden /><div><strong>{breach.kind}</strong><span>{breach.response} · variance {inr(breach.variance)} · {breach.policyId}</span></div></li>)}</ol>
    </section>

    <div className="finance-option-grid">
      <section className="closed-loop-panel finance-option-ranking">
        <header><div><p className="section-kicker">Governed comparison</p><h3>Studio expansion options</h3></div><span>Capital remains separate from CM</span></header>
        <div className="closed-loop-table-wrap" tabIndex={0}>
          <table>
            <caption className="sr-only">Governed Studio expansion comparison</caption>
            <thead><tr><th>Rank</th><th>Studio</th><th>Demand fit</th><th className="number">Refundable deposit</th><th className="number">Non-refundable</th><th className="number">Nia capex</th><th className="number">Launch capital</th><th className="number">Capital / ready Nest</th><th className="number">Recurring / occupied Nest</th><th className="number">Friction</th><th className="number">90-day CM</th></tr></thead>
            <tbody>{preview.options.map((option) => <tr key={option.studioId} className={selectedOption.studioId === option.studioId ? "selected" : undefined}>
              <td><button type="button" onClick={() => setSelectedStudioId(option.studioId)} aria-label={`Inspect ${option.studioName}`} aria-pressed={selectedOption.studioId === option.studioId}>{option.rank}</button></td>
              <td><strong>{option.studioName}</strong><small>{option.studioId}</small></td>
              <td><span className="written-status">{option.canMeetDemand ? "Meets demand" : "Does not meet"}</span></td>
              <td className="number">{inr(option.refundableDepositInr)}</td><td className="number">{inr(option.nonrefundableDepositInr)}</td><td className="number">{inr(option.niaFundedCapexInr)}</td><td className="number">{inr(option.launchWorkingCapitalInr)}</td><td className="number">{inr(option.capitalPerReadyNestInr)}</td><td className="number">{inr(option.recurringCostPerExpectedOccupiedNestInr)}</td><td className="number">{option.activationFriction.totalDays} days</td><td className="number">{inr(option.projected90DayContributionMarginInr)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <aside className="closed-loop-panel finance-option-detail">
        <header><div><p className="section-kicker">Selected assumptions</p><h3>{selectedOption.studioName}</h3></div><Scale aria-hidden /></header>
        <dl>
          <div><dt>Upfront capital</dt><dd>{inr(selectedOption.upfrontCapitalInr)}</dd></div><div><dt>Monthly partner cost</dt><dd>{inr(selectedOption.monthlyPartnerCostInr)}</dd></div>
          <div><dt>Expected occupied</dt><dd>{selectedOption.expectedOccupiedNests} Nests</dd></div><div><dt>Activation-ready</dt><dd>{selectedOption.activationReadyNests} Nests</dd></div>
        </dl>
        <div className="finance-formula"><strong>{selectedOption.contributionMarginAssumption.scope}</strong><p>{selectedOption.contributionMarginAssumption.formula}</p><span>{selectedOption.contributionMarginAssumption.exclusions}</span></div>
        <ol className="finance-friction-list">
          <li><span>Commercial agreement</span><strong>{selectedOption.activationFriction.commercialAgreementDays} days</strong></li><li><span>Compliance readiness</span><strong>{selectedOption.activationFriction.complianceReadinessDays} days</strong></li><li><span>Physical readiness</span><strong>{selectedOption.activationFriction.physicalReadinessDays} days</strong></li><li><span>Unresolved dependencies</span><strong>{selectedOption.activationFriction.unresolvedDependencyDays} days</strong></li>
        </ol>
        <p className="lineage-note"><Database aria-hidden />Synthetic · {selectedOption.source.rowIdentity}</p>
      </aside>
    </div>

    <section className="closed-loop-panel finance-approval-queue">
      <header><div><p className="section-kicker">Append-only approval ledger</p><h3>Financial approvals</h3></div><span>{liveData ? "Google Sheet · read-only" : "Eight locked categories · shadow decisions only"}</span></header>
      <OperationalCardStack label="Financial approval queue">{liveData ? liveApprovals.map((approval) => <OperationalCard key={approval.approvalId} title={approval.title} domain={`${approval.domain.replaceAll("-", " ")} · ${approval.approvalId}`} status={approval.decision} action={approval.action} fields={[{ label: "Owner", value: approval.owner }, { label: "Amount", value: inr(approval.amountInr || null) }, { label: "Due", value: date(approval.dueAt || null) }, { label: "Expected result", value: approval.expectedResult || "Not recorded" }]} />) : preview.approvals.map((approval) => <OperationalCard key={approval.requestId} title={approval.category} domain={`${approval.studioId ?? "Company control"} · ${approval.requestId} · v${approval.version}`} status={approval.status} description={<p>{approval.reason}</p>} fields={[{ label: "Owner", value: approval.approver }, { label: "Amount", value: inr(approval.amountInr) }, { label: "Evidence", value: `${approval.protectedEvidenceRefs.length} protected` }]} />)}</OperationalCardStack>
    </section>

    <div className="finance-health-grid">
      <section className="closed-loop-panel finance-health-table">
        <header><div><p className="section-kicker">Versioned Studio health</p><h3>Required response by Studio</h3></div><Building2 aria-hidden /></header>
        <OperationalCardStack label="Studio health required responses">{preview.studioHealth.map((health) => <OperationalCard key={health.assessmentId} title={health.studioName} domain={`${health.studioId} · ${health.assessmentId}`} status={health.status} description={<p>{health.requiredResponse}</p>} fields={[{ label: "Owner", value: health.ownerActorId }, { label: "Review due", value: date(health.reviewDueAt) }, { label: "Occupancy", value: percentage(health.occupancyRatio) }, { label: "Gross margin", value: percentage(health.grossMarginRatio) }, { label: "Contribution margin", value: inr(health.contributionMarginInr) }]} />)}</OperationalCardStack>
      </section>
    </div>

    <div className="finance-war-room-grid">
      <section className="closed-loop-panel finance-war-room-list">
        <header><div><p className="section-kicker">Exception routing</p><h3>War Room queue</h3></div><Landmark aria-hidden /></header>
        <div className="war-room-case-list">{preview.warRoomCases.map((warRoomCase) => <button key={warRoomCase.caseId} type="button" className={selectedCase.caseId === warRoomCase.caseId ? "selected" : undefined} aria-pressed={selectedCase.caseId === warRoomCase.caseId} onClick={() => { setSelectedCaseId(warRoomCase.caseId); setAuditOpen(false) }}>
          <span className="written-status">{warRoomCase.priority}</span><strong>{warRoomCase.title}</strong><small>{warRoomCase.state} · {warRoomCase.ownerActorId}</small><em><Clock3 aria-hidden />Response {date(warRoomCase.responseDueAt)}</em>
        </button>)}</div>
      </section>

      <section className="closed-loop-panel finance-war-room-detail">
        <header><div><p className="section-kicker">Case · {selectedCase.caseId}</p><h3>{selectedCase.title}</h3></div><span className="status-badge"><CheckCircle2 aria-hidden />{selectedCase.state}</span></header>
        <div className="war-room-facts"><div><span>Owner</span><strong>{selectedCase.ownerActorId}</strong></div><div><span>Verifier</span><strong>{selectedCase.verifierActorId}</strong></div><div><span>Decision due</span><strong>{date(selectedCase.decisionDueAt)}</strong></div><div><span>Evidence</span><strong>{selectedCase.evidence.length} protected</strong></div></div>
        <div className="war-room-proof"><div><p className="section-kicker">Triggers</p><ul>{selectedCase.triggers.map((trigger) => <li key={trigger}>{trigger}</li>)}</ul></div><div><p className="section-kicker">Required proof</p><ul>{selectedCase.requiredEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></div></div>
        <button className="audit-toggle" type="button" onClick={() => setAuditOpen((value) => !value)} aria-expanded={auditOpen}><FileCheck2 aria-hidden />{auditOpen ? "Hide immutable case history" : "Show immutable case history"}</button>
        {auditOpen ? <ol className="closed-loop-timeline">{selectedCase.history.map((event) => <li key={event.eventId}><span>v{event.version}</span><div><strong>{event.to}</strong><p>{event.note}</p><small>{event.actorId} · {date(event.occurredAt)}</small></div></li>)}</ol> : null}
        <div className="finance-readonly-projection"><LockKeyhole aria-hidden /><div><strong>{preview.projection.eventType}</strong><span>{preview.projection.result} · {preview.projection.verifiedBy} · read-only allowlist</span></div></div>
      </section>
    </div>
  </DashboardSectionAccordion>
}
