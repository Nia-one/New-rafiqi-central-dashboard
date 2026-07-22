"use client"

import { useState } from "react"
import { AlertTriangle, Check, ChevronRight, Clock3, FileCheck2, LockKeyhole, MapPin, ShieldCheck } from "lucide-react"
import {
  ENTERPRISE_DEMAND_DISPOSITIONS,
  recordJourneyDisposition,
  type EnterpriseDemandLoopPreview,
  type EnterpriseDisposition,
  type JourneyStep,
} from "@/lib/operating-loop/enterprise-demand-loop"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { actionStageFromStatus, ActionSegment, type ActionSegmentKey, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"

type Props = { preview: EnterpriseDemandLoopPreview }

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function slicePath(index: number, total = 8) {
  const start = (index / total) * Math.PI * 2 - Math.PI / 2
  const end = ((index + 1) / total) * Math.PI * 2 - Math.PI / 2
  const point = (angle: number) => ({ x: 50 + Math.cos(angle) * 42, y: 50 + Math.sin(angle) * 42 })
  const first = point(start)
  const last = point(end)
  return `M 50 50 L ${first.x.toFixed(2)} ${first.y.toFixed(2)} A 42 42 0 0 1 ${last.x.toFixed(2)} ${last.y.toFixed(2)} Z`
}

function RingPlan({ steps }: { steps: readonly JourneyStep[] }) {
  return <div className="enterprise-ring-visual">
    <svg viewBox="0 0 420 238" role="img" aria-label="Synthetic demand-node plan with Ring 1 from zero to two kilometres and Ring 2 from two to five kilometres">
      <title>Enterprise plant at the centre; Ring 1 is exhausted before Ring 2.</title>
      <circle className="enterprise-ring-two" cx="210" cy="119" r="96" />
      <circle className="enterprise-ring-one" cx="210" cy="119" r="43" />
      <text className="enterprise-ring-label" x="210" y="17" textAnchor="middle">Ring 2 · 2–5 km</text>
      <text className="enterprise-ring-label" x="210" y="69" textAnchor="middle">Ring 1 · 0–2 km</text>
      <g className="enterprise-plant-node"><circle cx="210" cy="119" r="25" /><text x="210" y="116" textAnchor="middle">PLANT</text><text x="210" y="130" textAnchor="middle">GATE</text></g>
      {steps.filter((step) => step.ring !== "Beyond 5 km").map((step, index) => {
        const radius = Math.min(step.distanceKm, 5) / 5 * 91
        const radians = step.bearing * Math.PI / 180 - Math.PI / 2
        const x = 210 + Math.cos(radians) * radius
        const y = 119 + Math.sin(radians) * radius
        return <g className={`enterprise-plan-point is-${step.supplyModel.toLowerCase()}`} key={step.stepId} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
          {step.supplyModel === "SP" ? <rect x="-9" y="-9" width="18" height="18" rx="2" /> : <circle r="9" />}
          <text x="0" y="3" textAnchor="middle">{index + 1}</text>
        </g>
      })}
    </svg>
    <div className="enterprise-ring-legend" aria-label="Demand plan legend">
      <span><i className="is-fono" />FONO call</span><span><i className="is-sp" />SP visit</span><span><LockKeyhole aria-hidden />Beyond 5 km blocked</span>
    </div>
  </div>
}

function PizzaProgress({ preview }: { preview: EnterpriseDemandLoopPreview }) {
  return <div className="enterprise-pizza-layout">
    <div className="enterprise-pizza-chart">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${preview.progressPercent}% of steps to completion finished`}>
        <title>{`${preview.progressPercent}% of steps to completion finished`}</title>
        {preview.progress.map((stage, index) => <path className={stage.complete ? "is-complete" : "is-open"} d={slicePath(index)} key={stage.stage} />)}
        <circle cx="50" cy="50" r="19" />
        <text x="50" y="48" textAnchor="middle">{preview.progress.filter((stage) => stage.complete).length}/8</text>
        <text x="50" y="60" textAnchor="middle">{preview.progressPercent}%</text>
      </svg>
    </div>
    <ol className="enterprise-stage-counts">
      {preview.progress.map((stage, index) => <li className={stage.complete ? "is-complete" : undefined} key={stage.stage}><b>{index + 1}</b><span><strong>{stage.stage}</strong><small>{stage.count}/{stage.target}</small></span></li>)}
    </ol>
  </div>
}

const JOURNEY_SEGMENT_ORDER: readonly ActionSegmentKey[] = ["fix-now", "due-today", "nia-recovering", "waiting-sign-off", "verified"]

function segmentForStep(step: JourneyStep): ActionSegmentKey {
  if (step.state === "Verified ready" || step.state === "Closed") return "verified"
  if (step.humanApprovalRequired || step.state === "Human-approved exception") return "waiting-sign-off"
  if (step.state === "Reopened" || step.state === "Retry scheduled" || step.state === "Evidence pending") return "nia-recovering"
  return "due-today"
}

function defaultNextAction(outcome: EnterpriseDisposition) {
  if (outcome === "No answer") return "Retry scheduled in two hours"
  if (outcome === "Verified ready" || outcome === "Evidence pending") return "Independent verification queued"
  if (outcome === "Commercial exception") return "Route to Pushkar for approval"
  if (outcome === "Spec mismatch") return "Collect corrective spec evidence"
  if (outcome === "Unsuitable") return "Close candidate and continue ordered plan"
  return "Continue the governed next step"
}

export function EnterpriseDemandWorkspace({ preview }: Props) {
  const [steps, setSteps] = useState<readonly JourneyStep[]>(() => preview.journeyPlan.steps)
  const [selectedOutcomes, setSelectedOutcomes] = useState<Record<string, EnterpriseDisposition>>(() => Object.fromEntries(preview.journeyPlan.steps.map((step) => [step.stepId, "No answer"])) as Record<string, EnterpriseDisposition>)
  const [shadowAudit, setShadowAudit] = useState<readonly { eventId: string; stepId: string; outcome: EnterpriseDisposition; occurredAt: string; nextAction: string }[]>([])
  const nextStep = steps.find((step) => step.state === "Next") ?? steps.find((step) => step.state !== "Ring 2 gated") ?? null
  const behind = preview.activeNode.readinessGap > 0
  const verdictLabel = behind ? `Behind · ${preview.activeNode.readinessGap} Nests to close` : "On track for arrival"

  function recordShadowOutcome(stepId: string) {
    const outcome = selectedOutcomes[stepId] ?? "No answer"
    const occurredAt = new Date().toISOString()
    const dueAt = new Date(Date.parse(occurredAt) + 2 * 60 * 60 * 1000).toISOString()
    const nextAction = defaultNextAction(outcome)
    setSteps((current) => current.map((step) => step.stepId === stepId ? recordJourneyDisposition(step, {
      outcome,
      evidenceRef: `protected://shadow-disposition/${stepId}/${Date.parse(occurredAt)}`,
      nextAction,
      ownerActorId: step.ownerActorId,
      dueAt,
      capacityAffected: step.capacityNests,
      readinessProbability: outcome === "Verified ready" ? 0.9 : outcome === "No answer" ? 0.35 : 0.55,
      occurredAt,
    }) : step))
    setShadowAudit((current) => [...current, Object.freeze({ eventId: `shadow-${stepId}-${Date.parse(occurredAt)}`, stepId, outcome, occurredAt, nextAction })])
  }

  function renderStepCard(step: JourneyStep, index: number) {
    return <OperationalCard key={step.stepId} title={`${index + 1}. ${step.actionKind} · ${step.candidateName}`} domain={`${step.supplyModel} · ${step.playbook} · ${step.distanceKm} km · ${step.ring}`} status={step.state} progress={actionStageFromStatus(step.state)} description={<p>{step.history.at(-1)?.nextAction ?? `Record ${step.actionKind.toLowerCase()} outcome`}</p>} fields={[{ label: "Capacity", value: `${step.capacityNests} Nests` }, { label: "Owner", value: step.ownerActorId }, { label: "Due", value: <time dateTime={step.dueAt}>{date(step.dueAt)}</time> }, { label: "Latest disposition", value: step.history.at(-1)?.outcome ?? "No disposition yet" }]}><div className="enterprise-shadow-control"><TokenSelect ariaLabel={`Disposition for ${step.candidateName}`} disabled={step.state === "Ring 2 gated" || step.humanApprovalRequired} value={selectedOutcomes[step.stepId] ?? "No answer"} options={ENTERPRISE_DEMAND_DISPOSITIONS} onChange={(outcome) => setSelectedOutcomes((current) => ({ ...current, [step.stepId]: outcome }))} /><button type="button" disabled={step.state === "Ring 2 gated" || step.humanApprovalRequired} onClick={() => recordShadowOutcome(step.stepId)}>Record</button><small>{step.state === "Ring 2 gated" ? "Ring 1 must close first" : step.humanApprovalRequired ? "Human approval required" : "Local preview only"}</small></div></OperationalCard>
  }

  const journeyBySegment = JOURNEY_SEGMENT_ORDER.map((segment) => ({
    segment,
    entries: steps.map((step, index) => ({ step, index })).filter((entry) => segmentForStep(entry.step) === segment),
  })).filter((group) => group.entries.length > 0)

  return <DashboardSectionAccordion className="enterprise-demand-loop" ariaLabel="Enterprise Demand sections" sections={[
    { title: "Today’s task", summary: verdictLabel },
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} verified` },
    { title: "Key numbers", summary: `${preview.activeNode.verifiedReadyNests}/${preview.activeNode.committedNests} Nests verified ready` },
    { title: "Arrival implication", summary: `${preview.activeNode.readinessGap} Nests must close before arrival` },
    { title: "Nearby plan and next action", summary: `Ring 1 has ${preview.journeyPlan.ring1PotentialNests} Nests · ${nextStep?.actionKind ?? "waiting"}` },
    { title: "Progress by channel", summary: "FONO and SP are tracked separately." },
    { title: "Calls and visits", summary: `${steps.length} ordered steps · 2 km first` },
    { title: "Issues needing help", summary: `${preview.exceptions.length} human-owned exceptions` },
    { title: "Background record", summary: `${shadowAudit.length} local dispositions · policies retained` },
    { title: "Decision required", summary: `Close the ${preview.activeNode.readinessGap}-Nest Ring 1 gap` },
    { title: "Source and confidence", summary: `${preview.source.name} · synthetic shadow` },
  ]}>
    <section className="enterprise-today-task" aria-labelledby="enterprise-today-title">
      <div>
        <span>{preview.fixtureLabel} · {preview.mode}</span>
        <h2 id="enterprise-today-title">{preview.headline}</h2>
        <p className="enterprise-governing">Work Ring 1 (0–2 km) to exhaustion before opening the 5 km search; recover verified-ready capacity, then submit contract-matched proof.</p>
      </div>
      <b className="enterprise-verdict" data-state={behind ? "behind" : "on-track"}>{verdictLabel}</b>
      <dl>
        <div><dt>Owner</dt><dd>{preview.activeNode.ownerActorId}</dd></div>
        <div><dt>Progress</dt><dd>{preview.progressPercent}% · {preview.activeNode.state}</dd></div>
        <div><dt>Verified result</dt><dd>{preview.activeNode.verifiedReadyNests}/{preview.activeNode.committedNests} Nests</dd></div>
      </dl>
    </section>

    <LoopHealthStrip health={preview.loopHealth} />

    <section className={`enterprise-headline-measures${preview.loopHealth.feeds.some((feed) => feed.stale) ? " has-stale-input" : ""}`} aria-label="Key numbers at glance">
      <article><span>Signed target</span><strong>{preview.activeNode.committedNests}</strong><small>Nests · {preview.activeNode.contractId}</small></article>
      <ChevronRight aria-hidden />
      <article><span>Verified ready</span><strong>{preview.activeNode.verifiedReadyNests}</strong><small>FONO {preview.activeNode.verifiedReadyBySupply.FONO} · SP {preview.activeNode.verifiedReadyBySupply.SP}</small></article>
      <ChevronRight aria-hidden />
      <article className="is-gap"><span>Gap to close</span><strong>{preview.activeNode.readinessGap}</strong><small>{preview.activeNode.daysToArrival} days to arrival</small></article>
      <ChevronRight aria-hidden />
      <article><span>Required run rate</span><strong>{Math.ceil((preview.activeNode.dailyPlan.plannedStops + preview.activeNode.dailyPlan.missedStopsCarried - preview.activeNode.dailyPlan.completedStops) / 6)}/hr</strong><small>{preview.activeNode.dailyPlan.missedStopsCarried} missed follow-ups rolled forward</small></article>
    </section>
    <p className="enterprise-so-what">So what: the gap must clear at the required hourly rate before the arrival date, or the signed capacity misses the committed date.</p>

    <div className="enterprise-first-viewport">
      <section className="enterprise-primary-panel enterprise-plan-panel" aria-labelledby="enterprise-plan-title">
        <header><div><span>Space available nearby</span><h2 id="enterprise-plan-title">{preview.journeyPlan.ring1PotentialNests} Nests available within 2 km</h2></div><p>Gap {preview.activeNode.readinessGap} · 5 km search {preview.journeyPlan.ring2Unlocked ? "open" : "closed"}</p></header>
        <RingPlan steps={steps} />
        <p className="enterprise-so-what">So what: nearby Ring 1 capacity covers the gap, so no 5 km expansion is needed or permitted yet.</p>
      </section>

      <section className="enterprise-primary-panel enterprise-progress-panel" aria-labelledby="enterprise-progress-title">
        <header><div><span>Do this next</span><h2 id="enterprise-progress-title">{nextStep ? `${nextStep.actionKind} ${nextStep.candidateName}` : "No action ready"}</h2></div><p>{nextStep ? `${nextStep.ownerActorId} · due ${date(nextStep.dueAt)}` : "Waiting for evidence"}</p></header>
        <PizzaProgress preview={preview} />
        <p className="enterprise-so-what">So what: only verified-and-billing stages count as done, so early-stage progress does not yet reduce the arrival risk.</p>
      </section>
    </div>

    <section className="enterprise-supply-lanes" aria-labelledby="enterprise-lanes-title">
      <header><div><span>Progress by channel</span><h2 id="enterprise-lanes-title">FONO and SP tracked separately</h2></div><p>Contract readiness by channel</p></header>
      {preview.supplyLanes.map((lane) => <article data-supply-lane={lane.supplyModel} key={lane.supplyModel}>
        <strong>{lane.supplyModel}</strong>
        <ol>{lane.stages.map((stage, index) => <li key={stage.label}><span>{stage.label}</span><b>{stage.count}</b>{index < lane.stages.length - 1 ? <ChevronRight aria-hidden /> : null}</li>)}</ol>
      </article>)}
      <p className="enterprise-so-what">So what: FONO and SP progress on different stage sequences, so each channel needs its own follow-up, not one blended number.</p>
    </section>

    <section className="enterprise-work-panel" aria-labelledby="enterprise-work-title">
      <header><div><span>Calls and visits today</span><h2 id="enterprise-work-title">{steps.length} calls and visits scheduled</h2></div><p>2 km first · preview only</p></header>
      {steps.length > 0 ? <div className="enterprise-journey-segments">{journeyBySegment.map((group) => <ActionSegment key={group.segment} segment={group.segment} count={group.entries.length}>{group.entries.map((entry) => renderStepCard(entry.step, entry.index))}</ActionSegment>)}</div> : <div className="enterprise-empty-state"><LockKeyhole aria-hidden /><strong>No eligible calls or stops.</strong><span>Quarantine, evidence and safety reasons remain visible in audit details.</span></div>}
    </section>

    <section className="enterprise-exceptions" aria-labelledby="enterprise-exceptions-title">
      <header><div><span>Issues needing your help</span><h2 id="enterprise-exceptions-title">{preview.exceptions.length} issues need human help</h2></div><p>Ops Control owns closure</p></header>
      <OperationalCardStack label="All Enterprise Demand exceptions">{preview.exceptions.map((exception) => <OperationalCard key={exception.exceptionId} title={exception.issue} status={exception.progress} domain="Enterprise Demand" fields={[{ label: "Owner", value: exception.owner }, { label: "Due", value: <time dateTime={exception.dueAt}>{date(exception.dueAt)}</time> }]} progress="assigned" story={[{ label: "Why it matters", value: "The signed enterprise arrival cannot be counted as ready while this exception remains open." }, { label: "What Nia already did", value: `Created the exception and assigned ${exception.owner}.` }, { label: "What happens next", value: "Close the readiness gap and submit contract-matched proof for independent verification." }]} />)}</OperationalCardStack>
    </section>

    <details className="enterprise-audit-details">
      <summary><FileCheck2 aria-hidden />Full background record</summary>
      <div className="enterprise-audit-body">
        <section><h2>Contract-specific readiness</h2><dl><div><dt>Enterprise / plant</dt><dd>{preview.activeNode.enterpriseName} �� {preview.activeNode.plantName}</dd></div><div><dt>Signed contract</dt><dd>{preview.activeNode.contractId}</dd></div><div><dt>Services</dt><dd>{preview.activeNode.contractedServices.join(", ") || "No additional contracted services"}</dd></div><div><dt>Spec / terms</dt><dd>{preview.activeNode.specStatus} / {preview.activeNode.termsStatus}</dd></div><div><dt>Plant reference</dt><dd>{preview.activeNode.plantReference}</dd></div><div><dt>Arrival</dt><dd>{date(preview.activeNode.arrivalAt)}</dd></div></dl></section>
        <section><h2>Priority overrides and field safety</h2><ol>{preview.protectedPriorities.map((priority, index) => <li key={priority}><b>{index + 1}</b><span>{priority}</span></li>)}<li><b>5</b><span>Enterprise Demand journey plan</span></li></ol><p>Approved daylight hours · three check-ins · no trespass · consent before non-public access · hazard controls · no unsafe solo visit · emergency stop-work path.</p></section>
        <section><h2>Governed registry</h2><div className="enterprise-audit-table"><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Source</th></tr></thead><tbody>{preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.policyId}</td><td>{policy.value} {policy.unit}</td><td>v{policy.version}</td><td>{policy.source}</td></tr>)}</tbody></table></div></section>
        <section><h2>Append-only synthetic audit</h2>{shadowAudit.length > 0 ? <ol>{shadowAudit.map((event) => <li key={event.eventId}><b>{event.outcome}</b><span>{event.stepId} · {event.nextAction}</span><time dateTime={event.occurredAt}>{date(event.occurredAt)}</time></li>)}</ol> : <p>No local shadow disposition recorded.</p>}</section>
        <section><h2>Structural action boundary</h2><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>Pricing and terms deviations route to Pushkar. RafiQi identifies, assigns, follows up and verifies in shadow state; it cannot message, call, contract, pay, commit capital, assign live routes, track GPS or write Production.</p></section>
      </div>
    </details>

    <section className="enterprise-ask" aria-label="Decision required">
      <div>
        <span>Decision required</span>
        <strong>Close the {preview.activeNode.readinessGap}-Nest readiness gap from Ring 1 and submit contract-matched proof.</strong>
        <p>Approve the ordered 2 km plan; the 5 km search stays closed and accountability sits with Ops Control until verified capacity is confirmed.</p>
      </div>
      <dl>
        <div><dt>Owner</dt><dd>{preview.activeNode.ownerActorId}</dd></div>
        <div><dt>By</dt><dd><time dateTime={preview.activeNode.arrivalAt}>{date(preview.activeNode.arrivalAt)}</time></dd></div>
      </dl>
    </section>

    <footer className="enterprise-source-note"><ShieldCheck aria-hidden /><span>{preview.source.name} · as of {date(preview.source.asOf)} · protected references only · synthetic/shadow</span><Clock3 aria-hidden /><span>RafiQi Inside may summarise later; Ops Control owns execution and verified closure.</span></footer>
  </DashboardSectionAccordion>
}
