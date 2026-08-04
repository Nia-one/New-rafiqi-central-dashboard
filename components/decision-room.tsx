"use client"

// The Decide lens landing surface: one screen that answers, in order,
// "What needs my decision?" then "Where does each loop stand?".
// Every figure is read directly from the existing loop previews passed to
// the dashboard; nothing here computes new domain state or contacts a backend.

import { ChevronRight, ShieldCheck } from "lucide-react"
import type { CSSProperties } from "react"
import { ContextStrip, DecisionBand } from "@/components/operating-ui"
import type { DashboardTab } from "@/lib/dashboard-model"
import type { EnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import type { CashControlPreview } from "@/lib/operating-loop/cash-control-loop"
import type { NewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import type { MemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import type { MemberSavingsPreview } from "@/lib/operating-loop/member-savings-loop"
import type { NiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import type { NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import type { LoopHealth } from "@/lib/operating-loop/loop-health"

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function firstNumber(value: string) {
  return Number(value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0)
}

function lastNumber(value: string) {
  const values = value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/g) ?? []
  return Number(values.at(-1) ?? 0)
}

function numberTotal(value: string) {
  return (value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/g) ?? []).reduce((total, item) => total + Number(item), 0)
}

function positionPercent(current: number, target: number) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0
  return Math.min(200, Math.max(0, (current / target) * 100))
}

type PendingDecision = {
  id: string
  decision: string
  loop: DashboardTab
  loopLabel: string
  owner: string
  impact: string
  dueAt: string | null
}

type LoopRow = {
  tab: DashboardTab
  label: string
  headline: string
  target: string
  current: string
  gap: string
  owner: string
  health: LoopHealth
  escalations: number
  position: number
}

export type DecisionRoomProps = {
  enterpriseDemandPreview: EnterpriseDemandLoopPreview | null
  cashControlPreview: CashControlPreview | null
  newAddsPreview: NewAddsPreview
  memberEngagementPreview: MemberEngagementPreview
  memberSavingsPreview: MemberSavingsPreview
  niaMarginsPreview: NiaMarginsPreview
  niaGrowthPreview: NiaGrowthPreview
  signOffCount: number
  period: string
  onOpenLoop: (tab: DashboardTab) => void
  onOpenSignOff: () => void
}

export function DecisionRoom({ enterpriseDemandPreview, cashControlPreview, newAddsPreview, memberEngagementPreview, memberSavingsPreview, niaMarginsPreview, niaGrowthPreview, signOffCount, period, onOpenLoop, onOpenSignOff }: DecisionRoomProps) {
  const pendingDecisions: PendingDecision[] = [
    ...niaGrowthPreview.signOffs.map((row) => ({ id: row.id, decision: row.decision, loop: "Nia Growth" as const, loopLabel: "Nia Growth", owner: row.owner, impact: row.impact, dueAt: null })),
    ...(cashControlPreview?.approvals ?? []).map((row) => ({ id: row.id, decision: row.decision, loop: "Cash & Control" as const, loopLabel: "Cash & Control", owner: row.owner, impact: row.impact, dueAt: null })),
  ].sort((left, right) => (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999") || left.id.localeCompare(right.id))
  const primaryDecision = pendingDecisions[0] ?? null

  const loops: LoopRow[] = [
    ...(cashControlPreview ? [{
      tab: "Cash & Control" as const,
      label: "Cash & Control",
      headline: cashControlPreview.headline,
      target: cashControlPreview.summary.target,
      current: cashControlPreview.summary.current,
      gap: cashControlPreview.summary.gap,
      owner: cashControlPreview.summary.owner,
      health: cashControlPreview.loopHealth,
      escalations: cashControlPreview.despatchEscalations.length,
      position: positionPercent(lastNumber(cashControlPreview.summary.current), lastNumber(cashControlPreview.summary.target)),
    }] : []),
    ...(enterpriseDemandPreview ? [{
      tab: "Enterprise Demand" as const,
      label: "Enterprise Demand",
      headline: Date.parse(enterpriseDemandPreview.activeNode.arrivalAt) < Date.now()
        ? `${enterpriseDemandPreview.activeNode.enterpriseName} arrival lapsed with ${enterpriseDemandPreview.activeNode.readinessGap} Nests unverified`
        : `${enterpriseDemandPreview.activeNode.enterpriseName} needs ${enterpriseDemandPreview.activeNode.readinessGap} more verified Nests before arrival`,
      target: `${enterpriseDemandPreview.activeNode.committedNests} Nests`,
      current: `${enterpriseDemandPreview.activeNode.verifiedReadyNests} verified`,
      gap: `${enterpriseDemandPreview.activeNode.readinessGap} Nests`,
      owner: enterpriseDemandPreview.activeNode.ownerActorId,
      health: enterpriseDemandPreview.loopHealth,
      escalations: enterpriseDemandPreview.exceptions.length,
      position: positionPercent(enterpriseDemandPreview.activeNode.verifiedReadyNests, enterpriseDemandPreview.activeNode.committedNests),
    }] : []),
    {
      tab: "New Adds" as const,
      label: "Member Adds",
      headline: newAddsPreview.headline,
      target: `${newAddsPreview.taskSummary.target} fills`,
      current: `${newAddsPreview.taskSummary.current} verified`,
      gap: `${newAddsPreview.taskSummary.gap} open`,
      owner: newAddsPreview.taskSummary.owner,
      health: newAddsPreview.loopHealth,
      escalations: newAddsPreview.despatchEscalations.length,
      position: positionPercent(newAddsPreview.taskSummary.current, newAddsPreview.taskSummary.target),
    },
    {
      tab: "Member Engagement" as const,
      label: "Member Engagement",
      headline: memberEngagementPreview.headline,
      target: memberEngagementPreview.summary.target,
      current: memberEngagementPreview.summary.current,
      gap: memberEngagementPreview.summary.gap,
      owner: memberEngagementPreview.summary.owner,
      health: memberEngagementPreview.loopHealth,
      escalations: memberEngagementPreview.despatchEscalations.length,
      position: positionPercent(firstNumber(memberEngagementPreview.summary.current), firstNumber(memberEngagementPreview.summary.target)),
    },
    {
      tab: "Member Savings" as const,
      label: "Member Savings",
      headline: memberSavingsPreview.headline,
      target: memberSavingsPreview.summary.target,
      current: memberSavingsPreview.summary.current,
      gap: memberSavingsPreview.summary.gap,
      owner: memberSavingsPreview.summary.owner,
      health: memberSavingsPreview.loopHealth,
      escalations: memberSavingsPreview.despatchEscalations.length,
      position: positionPercent(firstNumber(memberSavingsPreview.summary.current), 4),
    },
    {
      tab: "Nia Margins" as const,
      label: "Nia Margins",
      headline: niaMarginsPreview.answer,
      target: `₹${niaMarginsPreview.measures.fullUseTargetInr} full-use CM2`,
      current: `₹${Math.round(niaMarginsPreview.measures.fullUseCm2Inr)} today`,
      gap: `${niaMarginsPreview.measures.negativeContributionStudios} negative Studios`,
      owner: "Nia Margins loop",
      health: niaMarginsPreview.loopHealth,
      escalations: niaMarginsPreview.despatchEscalations.length,
      position: positionPercent(niaMarginsPreview.measures.fullUseCm2Inr, niaMarginsPreview.measures.fullUseTargetInr),
    },
    {
      tab: "Nia Growth" as const,
      label: "Nia Growth",
      headline: niaGrowthPreview.headline,
      target: niaGrowthPreview.summary.target,
      current: niaGrowthPreview.summary.current,
      gap: niaGrowthPreview.summary.gap,
      owner: niaGrowthPreview.summary.owner,
      health: niaGrowthPreview.loopHealth,
      escalations: niaGrowthPreview.despatchEscalations.length,
      position: positionPercent(numberTotal(niaGrowthPreview.summary.current), numberTotal(niaGrowthPreview.summary.target)),
    },
  ]
  const behindLoops = loops.filter((loop) => loop.health.state !== "Confirmed")
  const maximumEscalations = Math.max(1, ...loops.map((loop) => loop.escalations))

  return <div id="decision-room" className="decision-room" aria-label="Decision Room">
    <ContextStrip label="Decision Room context" items={[
      { label: "Lens", value: "Decide · management view" },
      { label: "Period", value: period },
      { label: "Loops behind", value: `${behindLoops.length} of ${loops.length}`, tone: behindLoops.length > 0 ? "attention" : "verified" },
      { label: "Decisions waiting", value: `${pendingDecisions.length + signOffCount}`, tone: pendingDecisions.length + signOffCount > 0 ? "attention" : "verified" },
    ]} />

    {primaryDecision ? <DecisionBand
      label="Decide this now"
      tone="attention"
      title={primaryDecision.decision}
      description={primaryDecision.impact}
      owner={primaryDecision.owner}
      due={primaryDecision.dueAt ? date(primaryDecision.dueAt) : "Before commitment"}
      progress={`${pendingDecisions.length + signOffCount} decisions waiting in total`}
      outcome="Nothing commits until this is approved or declined"
    /> : <DecisionBand
      label="Decide this now"
      tone="verified"
      title="No decision is blocking the loops"
      description="Every open item is inside governed operator work. Review the loop scoreboard below for state and variance."
      owner="—"
      due="—"
      progress="0 blocking decisions"
      outcome="Loops continue under governed automation"
    />}

    <section className="decision-room-scoreboard" aria-label="Loop scoreboard">
      <header><div><span>Loop scoreboard</span><h2>Where each loop stands</h2></div><p>Neutral comparisons from the governed view models. Open any loop to inspect its evidence.</p></header>
      <div className="decision-room-chart-grid">
        <figure className="decision-room-position-chart" aria-label="Current versus target by loop"><figcaption><strong>Current vs target</strong><span>Normalised to each loop&apos;s own target</span></figcaption><div className="decision-room-chart-axis" aria-hidden><span>0%</span><span>Target</span><span>200%</span></div><ol>{loops.map((loop) => <li key={loop.tab}><button type="button" onClick={() => onOpenLoop(loop.tab)} aria-label={`Inspect ${loop.label} evidence`}><span className="decision-room-chart-label"><strong>{loop.label}</strong><small>{Math.round(loop.position)}% of target</small></span><span className="decision-room-bullet" role="img" aria-label={`${loop.current}; target ${loop.target}`} style={{ "--decision-position": `${loop.position / 2}%` } as CSSProperties}><i /><b aria-hidden /></span><ChevronRight aria-hidden /></button></li>)}</ol></figure>
        <figure className="decision-room-escalation-chart" aria-label="Escalations by loop"><figcaption><strong>Escalations</strong><span>{loops.reduce((total, loop) => total + loop.escalations, 0)} across all loops</span></figcaption><ol>{loops.map((loop) => <li key={loop.tab}><span>{loop.label}</span><i aria-hidden><b style={{ "--decision-escalations": `${loop.escalations / maximumEscalations * 100}%` } as CSSProperties} /></i><strong>{loop.escalations}</strong></li>)}</ol></figure>
      </div>
      <div className="decision-room-evidence" aria-label="Loop evidence table"><div className="decision-room-evidence-head" aria-hidden><span>Loop</span><span>Current</span><span>Target</span><span>Gap</span><span /></div><ol>{loops.map((loop) => <li key={loop.tab}><button type="button" onClick={() => onOpenLoop(loop.tab)} aria-label={`Open ${loop.label}`}><span className="decision-room-loop"><strong>{loop.label}</strong><small>{loop.headline}</small></span><span><b>{loop.current}</b><small>Current</small></span><span><b>{loop.target}</b><small>Target</small></span><span><b>{loop.gap}</b><small>Gap</small></span><ChevronRight aria-hidden /></button></li>)}</ol></div>
    </section>

    {pendingDecisions.length > 1 ? <section className="decision-room-queue" aria-label="Remaining decisions">
      <header><div><span>Also waiting</span><h2>{pendingDecisions.length - 1} more decision{pendingDecisions.length - 1 === 1 ? "" : "s"}</h2></div></header>
      <div className="decision-room-queue-head" aria-hidden><span>Decision</span><span>Loop</span><span>Owner</span><span>Context</span><span /></div>
      <ol>{pendingDecisions.slice(1).map((decision) => <li key={decision.id}><button type="button" onClick={onOpenSignOff} aria-label={`Review ${decision.decision} in Your Sign-Off`}><strong>{decision.decision}</strong><span>{decision.loopLabel}</span><span>{decision.owner}</span><span>{decision.impact}</span><ChevronRight aria-hidden /></button></li>)}</ol>
    </section> : null}

    <footer className="decision-room-footnote">
      <ShieldCheck aria-hidden />
      <span>{signOffCount > 0 ? `${signOffCount} learning proposal${signOffCount === 1 ? "" : "s"} also waiting in Your Sign-Off.` : "No learning proposals waiting in Your Sign-Off."}</span>
      <button type="button" onClick={onOpenSignOff}>Open Your Sign-Off</button>
    </footer>
  </div>
}
