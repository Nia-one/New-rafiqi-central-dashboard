"use client"

// The Decide lens landing surface: one screen that answers, in order,
// "What needs my decision?" then "Where does each loop stand?".
// Every figure is read directly from the existing loop previews passed to
// the dashboard; nothing here computes new domain state or contacts a backend.

import { ChevronRight, ShieldCheck } from "lucide-react"
import { ContextStrip, DecisionBand, type OperatingTone } from "@/components/operating-ui"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"
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

function healthTone(health: LoopHealth): OperatingTone {
  if (health.state === "Cannot confirm") return "critical"
  if (health.state === "Attention") return "attention"
  return "verified"
}

function healthLabel(health: LoopHealth) {
  if (health.state === "Confirmed") return "On track"
  if (health.state === "Attention") return "Attention"
  return "Cannot confirm"
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
    },
  ]
  const behindLoops = loops.filter((loop) => loop.health.state !== "Confirmed")

  return <div className="decision-room" aria-label="Decision Room">
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
      <header><div><span>Loop scoreboard</span><h2>Where each loop stands</h2></div><p>Target · verified · gap come from each loop&apos;s governed preview. Open a loop for its evidence.</p></header>
      <ol>
        {loops.map((loop) => <li key={loop.tab}>
          <button type="button" onClick={() => onOpenLoop(loop.tab)} aria-label={`Open ${loop.label}`}>
            <span className="decision-room-state" data-tone={healthTone(loop.health)}>{healthLabel(loop.health)}</span>
            <span className="decision-room-loop"><strong>{loop.label}</strong><small>{loop.headline}</small></span>
            <span className="decision-room-score"><em><b>{loop.current}</b><i>of {loop.target}</i></em><em data-gap="true"><b>{loop.gap}</b><i>gap</i></em><em><b>{loop.escalations}</b><i>escalations</i></em></span>
            <ChevronRight aria-hidden />
          </button>
        </li>)}
      </ol>
    </section>

    {pendingDecisions.length > 1 ? <section className="decision-room-queue" aria-label="Remaining decisions">
      <header><div><span>Also waiting</span><h2>{pendingDecisions.length - 1} more decision{pendingDecisions.length - 1 === 1 ? "" : "s"}</h2></div></header>
      <OperationalCardStack label="Decisions waiting on you">
        {pendingDecisions.slice(1).map((decision) => <OperationalCard key={decision.id} title={decision.decision} domain={decision.loopLabel} status="Pending human approval" progress="evidence" fields={[{ label: "Owner", value: decision.owner }]} story={[{ label: "Why it matters", value: decision.impact }, { label: "What happens next", value: "Approve or decline; nothing commits automatically." }]} />)}
      </OperationalCardStack>
    </section> : null}

    <footer className="decision-room-footnote">
      <ShieldCheck aria-hidden />
      <span>{signOffCount > 0 ? `${signOffCount} learning proposal${signOffCount === 1 ? "" : "s"} also waiting in Your Sign-Off.` : "No learning proposals waiting in Your Sign-Off."}</span>
      <button type="button" onClick={onOpenSignOff}>Open Your Sign-Off</button>
    </footer>
  </div>
}
