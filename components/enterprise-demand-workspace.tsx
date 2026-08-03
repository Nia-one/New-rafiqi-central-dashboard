"use client"

import { useState, type CSSProperties } from "react"
import { Clock3, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react"
import {
  ENTERPRISE_DEMAND_DISPOSITIONS,
  recordJourneyDisposition,
  type EnterpriseDemandLoopPreview,
  type EnterpriseDisposition,
  type JourneyStep,
} from "@/lib/operating-loop/enterprise-demand-loop"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { actionStageFromStatus, type ActionSegmentKey, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { ChartPanel, CompactDisclosure, ContextStrip, DecisionBand, MetricStrip, ReadonlyMetricRow, SegmentedControl } from "@/components/operating-ui"
import { TokenSelect } from "@/components/token-select"

type Props = { preview: EnterpriseDemandLoopPreview }
type SecondaryView = "nearby" | "activity" | "controls"

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function percent(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(Math.max((value / max) * 100, 0), 100)
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
      <span><i className="is-fono" />FONO call</span><span><i className="is-sp" />SP visit</span><span><LockKeyhole aria-hidden />Beyond 5 km on hold</span>
    </div>
  </div>
}

function ReadinessBridge({ ready, target }: { ready: number; target: number }) {
  const gap = Math.max(target - ready, 0)
  const style = { "--enterprise-ready": `${percent(ready, target)}%` } as CSSProperties
  return <div className="enterprise-readiness-bridge" role="img" aria-label={`${ready} verified ready and ${gap} remaining against a target of ${target}`} style={style}>
    <div><i /><b aria-hidden /></div>
    <span><em>Verified {ready}</em><em>Remaining {gap}</em><em>Target {target}</em></span>
  </div>
}

function CurrentMix({ fono, shramPark }: { fono: number; shramPark: number }) {
  const total = fono + shramPark
  const style = {
    "--enterprise-fono-share": `${percent(fono, total)}%`,
    "--enterprise-sp-share": `${percent(shramPark, total)}%`,
  } as CSSProperties
  return <div className="enterprise-current-mix" style={style}>
    <div role="img" aria-label={`Verified capacity mix: FONO ${fono} Nests and Śram Park ${shramPark} Nests`}><i /><b /></div>
    <dl><div><dt>FONO</dt><dd>{fono} Nests</dd></div><div><dt>Śram Park</dt><dd>{shramPark} Nests</dd></div><div><dt>Total verified</dt><dd>{total} Nests</dd></div></dl>
  </div>
}

function ArrivalReadiness({ preview }: { preview: EnterpriseDemandLoopPreview }) {
  const completed = preview.progress.filter((stage) => stage.complete).length
  const lapsed = Date.parse(preview.activeNode.arrivalAt) < Date.now()
  return <section className="enterprise-arrival-readiness" aria-labelledby="enterprise-arrival-title">
    <header><div><span>Arrival readiness</span><h2 id="enterprise-arrival-title">{lapsed ? `Arrival lapsed with ${preview.activeNode.readinessGap} Nests unverified` : `${preview.activeNode.daysToArrival} days to verify ${preview.activeNode.readinessGap} Nests`}</h2></div><p>{completed}/{preview.progress.length} stages complete</p></header>
    <div className="enterprise-arrival-stage-chart" role="img" aria-label={`${completed} of ${preview.progress.length} stages complete${lapsed ? "; signed arrival has lapsed" : ` with ${preview.activeNode.daysToArrival} days remaining`}`}>
      {preview.progress.map((stage, index) => <div data-complete={stage.complete ? "true" : "false"} key={stage.stage}><i aria-hidden>{index + 1}</i><span>{stage.stage}</span><b>{stage.count}/{stage.target}</b></div>)}
    </div>
    <p className="enterprise-so-what">{preview.progress.length - completed} stages remain; the signed arrival has {lapsed ? "already passed" : "not yet occurred"}.</p>
  </section>
}

function ChannelFunnel({ lane }: { lane: EnterpriseDemandLoopPreview["supplyLanes"][number] }) {
  const maximum = Math.max(...lane.stages.map((stage) => stage.count), 1)
  const description = lane.stages.map((stage) => `${stage.label} ${stage.count}`).join(", ")
  return <article className="enterprise-channel-funnel" data-supply-lane={lane.supplyModel}>
    <header><strong>{lane.supplyModel === "SP" ? "Śram Park" : lane.supplyModel}</strong><span>{lane.stages[0]?.count ?? 0} start · {lane.stages.at(-1)?.count ?? 0} billing</span></header>
    <ol role="img" aria-label={`${lane.supplyModel} readiness funnel: ${description}`}>
      {lane.stages.map((stage, index) => {
        const width = percent(stage.count, maximum)
        const previous = lane.stages[index - 1]?.count
        const conversion = previous && previous > 0 ? Math.round((stage.count / previous) * 100) : null
        return <li data-zero={stage.count === 0 ? "true" : "false"} key={stage.label}>
          <div><span>{stage.label}</span><b>{stage.count}</b>{index === 0 ? <small>Starting pool</small> : conversion !== null ? <small>{conversion}% of prior</small> : <small>Awaiting flow</small>}</div>
          <i aria-hidden style={{ width: stage.count === 0 ? "2px" : `${Math.max(width, 4)}%` }} />
        </li>
      })}
    </ol>
  </article>
}

function ActionReadinessChart({ actionable, gated }: { actionable: number; gated: number }) {
  const total = actionable + gated
  const style = { "--enterprise-actionable": `${percent(actionable, total)}%` } as CSSProperties
  return <div className="enterprise-action-readiness" role="img" aria-label={`${actionable} actions ready now and ${gated} planned for later`} style={style}>
    <div><i /><b /></div><span><em>Ready now <strong>{actionable}</strong></em><em>Planned later <strong>{gated}</strong></em></span>
  </div>
}

function ExceptionOwnerChart({ exceptions }: { exceptions: EnterpriseDemandLoopPreview["exceptions"] }) {
  const owners = Object.entries(exceptions.reduce<Record<string, number>>((counts, exception) => {
    counts[exception.owner] = (counts[exception.owner] ?? 0) + 1
    return counts
  }, {})).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  const maximum = Math.max(...owners.map(([, count]) => count), 1)
  const description = owners.length > 0 ? owners.map(([owner, count]) => `${owner} ${count}`).join(", ") : "No assigned exceptions"
  return <div className="enterprise-owner-load" role="img" aria-label={`Exceptions by owner: ${description}`}>
    {owners.length > 0 ? owners.map(([owner, count]) => <div key={owner}><span>{owner}</span><i><b style={{ width: `${percent(count, maximum)}%` }} /></i><strong>{count}</strong></div>) : <p>No exception workload to chart.</p>}
  </div>
}

const JOURNEY_SEGMENT_ORDER: readonly ActionSegmentKey[] = ["fix-now", "due-today", "nia-recovering", "waiting-sign-off", "verified"]
const JOURNEY_SEGMENT_LABELS: Readonly<Record<ActionSegmentKey, string>> = Object.freeze({
  "fix-now": "Fix now",
  "due-today": "Due today",
  "nia-recovering": "Nia is recovering",
  "waiting-sign-off": "Waiting for sign-off",
  verified: "Verified and closed",
})

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
  const [secondaryView, setSecondaryView] = useState<SecondaryView>("nearby")
  const nextStep = steps.find((step) => step.state === "Next") ?? steps.find((step) => step.state !== "Ring 2 gated") ?? null
  const behind = preview.activeNode.readinessGap > 0
  const lapsed = Date.parse(preview.activeNode.arrivalAt) < Date.now()
  const completedStages = preview.progress.filter((stage) => stage.complete).length
  const actionableSteps = steps.filter((step) => step.state !== "Ring 2 gated" && !step.humanApprovalRequired).length
  const gatedSteps = steps.length - actionableSteps

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
    return <OperationalCard key={step.stepId} title={`${index + 1}. ${step.actionKind} · ${step.candidateName}`} domain={`${step.supplyModel} · ${step.playbook} · ${step.distanceKm} km · ${step.ring}`} status={step.state} progress={actionStageFromStatus(step.state)} description={<p>{step.history.at(-1)?.nextAction ?? `Record ${step.actionKind.toLowerCase()} outcome`}</p>} fields={[{ label: "Capacity", value: `${step.capacityNests} Nests` }, { label: "Owner", value: step.ownerActorId }, { label: "Due", value: <time dateTime={step.dueAt}>{date(step.dueAt)}</time> }, { label: "Latest disposition", value: step.history.at(-1)?.outcome ?? "No disposition yet" }]}><div className="enterprise-shadow-control"><TokenSelect ariaLabel={`Disposition for ${step.candidateName}`} disabled={step.state === "Ring 2 gated" || step.humanApprovalRequired} value={selectedOutcomes[step.stepId] ?? "No answer"} options={ENTERPRISE_DEMAND_DISPOSITIONS} onChange={(outcome) => setSelectedOutcomes((current) => ({ ...current, [step.stepId]: outcome }))} /><button type="button" disabled={step.state === "Ring 2 gated" || step.humanApprovalRequired} onClick={() => recordShadowOutcome(step.stepId)}>Record</button><small>{step.state === "Ring 2 gated" ? "Ring 1 must close first" : step.humanApprovalRequired ? "Human sign-off needed" : "Local preview only"}</small></div></OperationalCard>
  }

  const journeyBySegment = JOURNEY_SEGMENT_ORDER.map((segment) => ({
    segment,
    entries: steps.map((step, index) => ({ step, index })).filter((entry) => segmentForStep(entry.step) === segment),
  })).filter((group) => group.entries.length > 0)
  const fonoLane = preview.supplyLanes.find((lane) => lane.supplyModel === "FONO")
  const spLane = preview.supplyLanes.find((lane) => lane.supplyModel === "SP")

  return <div className="enterprise-demand-loop enterprise-form-workspace" aria-label="Enterprise Demand workspace">
    <ContextStrip label="Enterprise Demand plan context" items={[
      { label: "Enterprise", value: `${preview.activeNode.enterpriseName} — ${preview.activeNode.plantName}` },
      { label: "Arrival plan", value: <time dateTime={preview.activeNode.arrivalAt}>{date(preview.activeNode.arrivalAt)}</time> },
      { label: "Plan state", value: lapsed ? "Lapsed · recovery required" : "Active", tone: lapsed ? "critical" : "neutral" },
      { label: "Scope", value: `${preview.activeNode.committedNests} contracted Nests` },
    ]} />

    <DashboardSectionAccordion className="enterprise-outline" ariaLabel="Enterprise Demand sections" sections={[
      { title: "Do this now", summary: nextStep ? `${nextStep.actionKind} · ${nextStep.candidateName}` : "Hold for verified evidence", status: lapsed ? "bad" : behind ? "warn" : "good" },
      { title: "Evidence", summary: `${preview.activeNode.verifiedReadyNests}/${preview.activeNode.committedNests} verified · gap ${preview.activeNode.readinessGap} Nests`, lens: "decide", status: behind ? "warn" : "good" },
      { title: "Today's work", summary: `${actionableSteps} governed actions · ${gatedSteps} gated`, lens: "operate", status: actionableSteps > 0 ? "warn" : "good" },
      { title: "Exceptions", summary: `${preview.exceptions.length} assigned · never auto-resolved`, status: preview.exceptions.length > 0 ? "warn" : "good" },
      { title: "Supporting detail", summary: "Nearby supply · activity record · controls & audit", lens: "operate" },
      { title: "Proof & health", summary: `${preview.loopHealth.verification.verified} of ${preview.loopHealth.verification.claimed} outcomes confirmed` },
    ]}>
    <div id="enterprise-demand-overview">
      <DecisionBand
        tone={lapsed ? "critical" : behind ? "attention" : "verified"}
        title={nextStep ? `${lapsed ? "Recover the lapsed plan: " : ""}${nextStep.actionKind} ${nextStep.candidateName}` : "Hold for verified evidence"}
        description={lapsed ? "The signed arrival has passed. Reconfirm the plan, complete the governed Ring 1 action and submit contract-matched proof." : "Complete the next governed action and submit contract-matched proof for independent verification."}
        owner={nextStep?.ownerActorId ?? preview.activeNode.ownerActorId}
        due={nextStep ? <><time dateTime={nextStep.dueAt}>{date(nextStep.dueAt)}</time>{lapsed ? " · overdue" : ""}</> : "Waiting for evidence"}
        progress={`${completedStages} of ${preview.progress.length} stages cleared`}
        progressValue={preview.progressPercent}
        outcome={nextStep ? `${nextStep.capacityNests} Nests to independent verification` : `${preview.activeNode.readinessGap} Nest gap held open`}
      />
    <MetricStrip label="Enterprise Demand score" items={[
      { label: "Verified capacity", value: `${preview.activeNode.verifiedReadyNests} / ${preview.activeNode.committedNests} Nests`, tone: behind ? "attention" : "verified" },
      { label: "Remaining gap", value: `${preview.activeNode.readinessGap} Nests`, tone: behind ? "critical" : "verified" },
      { label: "Arrival stages", value: `${completedStages} of ${preview.progress.length} cleared` },
      { label: "Nearby identified", value: `${preview.journeyPlan.ring1PotentialNests} Nests`, note: "Not yet verified against the gap" },
      { label: "Work queue", value: `${actionableSteps} actions · ${preview.exceptions.length} exceptions` },
    ]} />
    </div>

    <div className="enterprise-evidence-grid">
      <ChartPanel title="Verified capacity vs target" takeaway={`${preview.activeNode.readinessGap} Nests remain independently unverified.`} className="enterprise-capacity-panel">
        <ReadinessBridge ready={preview.activeNode.verifiedReadyNests} target={preview.activeNode.committedNests} />
        <ReadonlyMetricRow label="Target" value={`${preview.activeNode.committedNests} Nests`} />
        <ReadonlyMetricRow label="Verified" value={`${preview.activeNode.verifiedReadyNests} Nests`} tone="verified" />
        <ReadonlyMetricRow label="Gap" value={`${preview.activeNode.readinessGap} Nests`} tone={behind ? "critical" : "verified"} />
        <CurrentMix fono={preview.activeNode.verifiedReadyBySupply.FONO} shramPark={preview.activeNode.verifiedReadyBySupply.SP} />
      </ChartPanel>
      <ChartPanel title="Arrival evidence" takeaway={`${completedStages} of ${preview.progress.length} stages are cleared.`}><ArrivalReadiness preview={preview} /></ChartPanel>
      {fonoLane ? <ChartPanel title="FONO conversion" takeaway="Vacant Nest readiness stays separate from Member arrival and billing." className="enterprise-funnel-panel" ><div id="enterprise-demand-fono"><ChannelFunnel lane={fonoLane} /></div></ChartPanel> : null}
      {spLane ? <ChartPanel title="Śram Park conversion" takeaway="Contract, build, services and specification evidence clear in order." className="enterprise-funnel-panel"><div id="enterprise-demand-sp"><ChannelFunnel lane={spLane} /></div></ChartPanel> : null}
    </div>

    <section className="enterprise-operations" id="enterprise-demand-actions" aria-labelledby="enterprise-actions-title">
      <header><div><span>Today&apos;s work</span><h2 id="enterprise-actions-title">{actionableSteps} governed actions · {gatedSteps} gated</h2></div><ActionReadinessChart actionable={actionableSteps} gated={gatedSteps} /></header>
      <div className="enterprise-operations-detail"><section><div className="enterprise-journey-segments">{journeyBySegment.map((group) => <section className="enterprise-action-group" data-action-segment={group.segment} key={group.segment}><header><h3>{JOURNEY_SEGMENT_LABELS[group.segment]}</h3><span>{group.entries.length}</span></header><OperationalCardStack label={`${JOURNEY_SEGMENT_LABELS[group.segment]} actions`}>{group.entries.map((entry) => renderStepCard(entry.step, entry.index))}</OperationalCardStack></section>)}</div></section></div>
    </section>

    <section className="enterprise-exceptions" aria-label="Enterprise Demand exceptions"><header className="enterprise-support-heading"><div><span>Assigned support</span><h2>{preview.exceptions.length} exceptions</h2></div><ExceptionOwnerChart exceptions={preview.exceptions} /></header><OperationalCardStack label="All Enterprise Demand exceptions">{preview.exceptions.map((exception) => <OperationalCard key={exception.exceptionId} title={exception.issue} status={exception.progress} domain="Enterprise Demand" fields={[{ label: "Owner", value: exception.owner }, { label: "Due", value: <time dateTime={exception.dueAt}>{date(exception.dueAt)}</time> }]} progress="assigned" story={[{ label: "Why it matters", value: "The signed enterprise arrival cannot be counted as ready while this exception remains open." }, { label: "What Nia already did", value: `Created the exception and assigned ${exception.owner}.` }, { label: "What happens next", value: "Close the readiness gap and submit contract-matched proof for independent verification." }]} />)}</OperationalCardStack></section>

    <section className="enterprise-secondary" aria-label="Supporting Enterprise Demand detail">
      <SegmentedControl label="Supporting view" value={secondaryView} onChange={setSecondaryView} options={[{ value: "nearby", label: "Nearby supply" }, { value: "activity", label: "Activity record" }, { value: "controls", label: "Controls & audit" }]} />
      <div className="enterprise-secondary-panel enterprise-nearby-panel" role="tabpanel" hidden={secondaryView !== "nearby"}>
        <div><h2>{preview.journeyPlan.ring1PotentialNests} nearby Nests identified</h2><p>Ring 1 is worked before the search moves outward. Identified capacity is not counted as verified and is not assumed to close the {preview.activeNode.readinessGap}-Nest gap.</p></div><RingPlan steps={steps} />
      </div>
      <div className="enterprise-secondary-panel" role="tabpanel" hidden={secondaryView !== "activity"}>
        <section className="enterprise-change-record" id="enterprise-demand-record" aria-labelledby="enterprise-change-title"><header><div><span>Shadow updates</span><h2 id="enterprise-change-title">{shadowAudit.length === 0 ? "No local changes recorded" : `${shadowAudit.length} local change${shadowAudit.length === 1 ? "" : "s"} recorded`}</h2></div><p>Append-only preview</p></header>{shadowAudit.length > 0 ? <ol className="enterprise-change-timeline" aria-label="Recorded shadow updates">{shadowAudit.map((event) => <li key={event.eventId}><i aria-hidden /><b>{event.outcome}</b><span>{event.stepId} · {event.nextAction}</span><time dateTime={event.occurredAt}>{date(event.occurredAt)}</time></li>)}</ol> : <div className="enterprise-change-empty"><span>0</span><p>The first recorded disposition will appear here as a timeline event.</p></div>}</section>
      </div>
      <div className="enterprise-secondary-panel" role="tabpanel" hidden={secondaryView !== "controls"}>
        <CompactDisclosure className="enterprise-audit-details" summary={<><FileCheck2 aria-hidden />Full background record</>}><div className="enterprise-audit-body">
        <section><h2>Contract-specific readiness</h2><dl><div><dt>Enterprise / plant</dt><dd>{preview.activeNode.enterpriseName} · {preview.activeNode.plantName}</dd></div><div><dt>Signed contract</dt><dd>{preview.activeNode.contractId}</dd></div><div><dt>Services</dt><dd>{preview.activeNode.contractedServices.join(", ") || "No additional contracted services"}</dd></div><div><dt>Spec / terms</dt><dd>{preview.activeNode.specStatus} / {preview.activeNode.termsStatus}</dd></div><div><dt>Plant reference</dt><dd>{preview.activeNode.plantReference}</dd></div><div><dt>Arrival</dt><dd>{date(preview.activeNode.arrivalAt)}</dd></div></dl></section>
        <section><h2>Priority overrides and field safety</h2><ol>{preview.protectedPriorities.map((priority, index) => <li key={priority}><b>{index + 1}</b><span>{priority}</span></li>)}<li><b>5</b><span>Enterprise Demand journey plan</span></li></ol><p>Approved daylight hours · three check-ins · no trespass · consent before non-public access · hazard controls · no unsafe solo visit · emergency stop-work path.</p></section>
        <section><h2>Governed registry</h2><div className="enterprise-audit-table"><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Source</th></tr></thead><tbody>{preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.policyId}</td><td>{policy.value} {policy.unit}</td><td>v{policy.version}</td><td>{policy.source}</td></tr>)}</tbody></table></div></section>
        <section><h2>Structural action boundary</h2><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>Pricing and terms deviations route to Pushkar. RafiQi Central identifies, assigns, follows up and verifies in shadow state; it cannot message, call, contract, pay, commit capital, assign live routes, track GPS or write Production.</p></section>
        </div></CompactDisclosure>
      </div>
    </section>

    <div className="enterprise-proof">
      <LoopHealthStrip health={preview.loopHealth} id="enterprise-demand-health" />
      <footer className="enterprise-source-note"><ShieldCheck aria-hidden /><span>{preview.source.name} · as of {date(preview.source.asOf)} · protected references only · synthetic/shadow</span><Clock3 aria-hidden /><span>RafiQi Central may summarise later; Ops Control owns execution and verified closure.</span></footer>
    </div>
    </DashboardSectionAccordion>
  </div>
}
