"use client"

import { ArrowRight, ArrowUpRight, BadgeIndianRupee, Building2, ChartNoAxesCombined, CheckCircle2, ChevronRight, Clock3, Gauge, HeartHandshake, Pause, RefreshCw, RotateCcw, Send, ShieldAlert, ShieldCheck, TrendingUp, UserCheck, UserPlus, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { EnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import type { ControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import type { NiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import type { NewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import type { MemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import type { MemberSavingsPreview } from "@/lib/operating-loop/member-savings-loop"
import type { NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import { buildLivingScreenData } from "@/lib/live-mappers/living-screen"

const consoleDefinitions = [
  { name: "All consoles", icon: Gauge },
  { name: "Enterprise Demand", icon: Building2 },
  { name: "Member Adds", icon: UserPlus },
  { name: "Member Engagement", icon: HeartHandshake },
  { name: "Member Savings", icon: BadgeIndianRupee },
  { name: "Living", icon: Building2 },
  { name: "Nia Margins", icon: ChartNoAxesCombined },
  { name: "Nia Growth", icon: TrendingUp },
] as const

/*
const fixtureConsoleViews = {
  "All consoles": { alarmConsole: null, title: "Underwriting coverage response", state: "Approval blocks others", prescription: "Capital remains exposed; no park release", owner: "CEO/COO", due: "17 Jul, 06:00 pm", metric: "Activation-ready Nests", verified: 79, current: "FONO 126 · SP 240", target: "FONO 160 · SP 360", by: "17 Jul", verifier: "Independent Growth Verifier", evidence: ["Protected capacity evidence", "Independent supply-model verification"] },
  "Enterprise Demand": { alarmConsole: "Enterprise Demand", title: "Commercial terms deviation · Sundaram Fasteners", state: "Approval blocks others", prescription: "Human approval required · never auto-resolved", owner: "Pushkar", due: "01 Aug, 09:00 am", metric: "Verified-ready Nests", verified: 25, current: "140 Nests", target: "180 Nests", by: "01 Aug", verifier: "Independent Readiness Verifier", evidence: ["Protected capacity confirmation", "Independent readiness check"] },
  "Member Adds": { alarmConsole: "New Adds", title: "Two cycles below the verified base commitment.", state: "Action now", prescription: "Two cycles below the verified base commitment.", owner: "Franchise review", due: "17 Jul, 12:30 pm", metric: "Billing-live fills", verified: 63, current: "15", target: "24", by: "17 Jul", verifier: "Independent Billing Verifier", evidence: ["Protected Member activation proof", "Billing-live confirmation"] },
  "Member Engagement": { alarmConsole: "Member Engagement", title: "Studio cohort is below the 65% M6 floor.", state: "Action now", prescription: "Studio cohort is below the 65% M6 floor.", owner: "Theatre lead", due: "17 Jul, 03:00 pm", metric: "Verified recovered Members", verified: 64, current: "64% M6", target: "65% M6", by: "17 Jul", verifier: "Independent Retention Verifier", evidence: ["Protected recovery evidence", "Resolved source-signal record"] },
  "Member Savings": { alarmConsole: "Member Savings", title: "Repeated dual-gate failure requires supplier/service review.", state: "Action now", prescription: "Repeated dual-gate failure requires supplier/service review.", owner: "Pushkar", due: "17 Jul, 06:00 pm", metric: "Services passing both gates", verified: 0, current: "3/4 services pass", target: "Both gates > ₹0", by: "17 Jul", verifier: "Independent Savings Verifier", evidence: ["Fresh market-reference evidence", "Verified unit-margin evidence"] },
  "Nia Margins": { alarmConsole: "Nia Margins", title: "Sriperumbudur 02 margin recovery failed twice", state: "Action now", prescription: "Occupied Nests as a share of contracted Nests has not recovered to target. SP occupancy missed the target for a second verified cycle.", owner: "Enterprise Demand JCO", due: "18 Jul, 02:00 pm", metric: "Full-use CM2", verified: 96, current: "₹1435", target: "₹1500", by: "18 Jul", verifier: "Independent Margin Verifier", evidence: ["Protected billed-revenue reference", "Protected direct-cost reference", "Later contribution observation"] },
  "Nia Growth": { alarmConsole: "Nia Growth", title: "Underwriting coverage response", state: "Approval blocks others", prescription: "Capital remains exposed; no park release", owner: "CEO/COO", due: "17 Jul, 06:00 pm", metric: "Activation-ready Nests", verified: 79, current: "FONO 126 · SP 240", target: "FONO 160 · SP 360", by: "17 Jul", verifier: "Independent Growth Verifier", evidence: ["Protected capacity evidence", "Independent supply-model verification"] },
} as const

const fixtureLoops = [
  { name: "Enterprise demand", current: "140 Nests", target: "180 Nests", gap: "40 Nests", due: "26 Jul, 09:00 am", verified: "17 Jul, 08:00 am" },
  { name: "Member adds", current: "15", target: "24", gap: "9", due: "Governed action clocks", verified: "17 Jul, 01:45 pm" },
  { name: "Member engagement", current: "64% M6", target: "65% M6", gap: "1 pp", due: "Governed action clocks", verified: "17 Jul, 11:45 am" },
  { name: "Member savings", current: "3/4 services pass", target: "Both gates > ₹0", gap: "1 service", due: "Governed action clocks", verified: "17 Jul, 02:45 pm" },
  { name: "Nia margins", current: "₹1435", target: "₹1500", gap: "₹65", due: "Next verified cycle", verified: "17 Jul, 02:00 pm" },
  { name: "Nia growth", current: "FONO 126 · SP 240", target: "FONO 160 · SP 360", gap: "FONO 34 · SP 120", due: "Governed action clocks", verified: "17 Jul, 11:45 am" },
] as const

const fixtureEnterpriseStages = [
  [180, "Campaign", "Entry · floor 70%", 0], [180, "Response", "100% conversion · floor 70%", 0],
  [180, "Qualified", "100% conversion · floor 70%", 1], [140, "Site visit", "78% conversion · floor 70%", 2],
  [140, "Proposal", "100% conversion · floor 70%", 0], [140, "Negotiation", "100% conversion · floor 70%", 1],
  [140, "Contracted", "100% conversion · floor 70%", 0],
] as const

const fixtureMemberStages = [
  [24, "Sourced", "Entry · floor 75%", 0], [24, "Screened", "100% conversion · floor 75%", 0],
  [24, "Nest offered", "100% conversion · floor 75%", 0], [24, "Offer accepted", "100% conversion · floor 75%", 0],
  [15, "Activated", "63% conversion · floor 75%", 4], [15, "Billing live", "100% conversion · floor 75%", 0],
  [15, "Verified fill", "100% conversion · floor 75%", 0],
] as const

const fixtureAlarms = [
  ["Underwriting coverage response", "SIGN-SP-COVERAGE · Capital remains exposed; no park release", "Nia Growth", "CEO/COO", "17 Jul, 06:00 pm", "Escalated"],
  ["Franchise review only if two governed cycles fail", "SIGN-FONO-REVIEW · No contract or people decision is automatic", "Nia Growth", "Pushkar", "17 Jul, 06:00 pm", "Escalated"],
  ["Commercial terms deviation · Sundaram Fasteners", "NODE-SUNDARAM-0108-terms · Human approval required · never auto-resolved", "Enterprise Demand", "Pushkar", "01 Aug, 09:00 am", "New"],
  ["Enterprise arrival moved · Vikram Solar", "NODE-VIKRAM-ORA-2607-arrival · Journey plan reprioritised", "Enterprise Demand", "Coromandel Demand JCO", "17 Jul, 10:00 am", "New"],
  ["Two cycles below the verified base commitment.", "ESC-BASE-EVT-NEW-ADDS-SRI-02 · Two cycles below the verified base commitment.", "New Adds", "Franchise review", "17 Jul, 12:30 pm", "New"],
  ["Actual loaded CAC ₹104 is above ₹100.", "ESC-CAC-EVT-NEW-ADDS-SRI-02 · Actual loaded CAC ₹104 is above ₹100.", "New Adds", "Pushkar / Finance", "17 Jul, 12:30 pm", "New"],
  ["Studio occupancy 74% is below 78%.", "ESC-OCC-EVT-NEW-ADDS-SRI-02 · Studio occupancy 74% is below 78%.", "New Adds", "Studio Health", "17 Jul, 12:30 pm", "New"],
  ["Fill task is overdue.", "ESC-OVERDUE-EVT-NEW-ADDS-SRI-02 · Fill task is overdue.", "New Adds", "Theatre lead", "17 Jul, 02:00 pm", "New"],
  ["Studio cohort is below the 65% M6 floor.", "esc-1kk84fa-1 · Studio cohort is below the 65% M6 floor.", "Member Engagement", "Theatre lead", "17 Jul, 03:00 pm", "New"],
  ["Studio cohort is below the 65% M6 floor.", "esc-1x0t16s-1 · Studio cohort is below the 65% M6 floor.", "Member Engagement", "Theatre lead", "17 Jul, 04:00 pm", "New"],
  ["Studio cohort is below the 65% M6 floor.", "esc-1tudgtr-1 · Studio cohort is below the 65% M6 floor.", "Member Engagement", "Theatre lead", "17 Jul, 05:00 pm", "New"],
  ["Repeated dual-gate failure requires supplier/service review.", "ESC-DUAL-evt-savings-laundry-margin · Repeated dual-gate failure requires supplier/service review.", "Member Savings", "Pushkar", "17 Jul, 06:00 pm", "New"],
  ["Sriperumbudur 02 margin recovery failed twice", "DESPATCH-MARGIN-ST-SIP-02-OCCUPANCY · Occupied Nests as a share of contracted Nests has not recovered to target. SP occupancy missed the target for a second verified cycle.", "Nia Margins", "Enterprise Demand JCO", "18 Jul, 02:00 pm", "New"],
  ["40 verified-ready Nests short · Vikram Solar", "NODE-VIKRAM-ORA-2607-shortfall · 140/180 independently verified", "Enterprise Demand", "Coromandel Demand JCO", "26 Jul, 09:00 am", "New"],
  ["Contracted spec deviation · Hyundai Mobis", "NODE-HYUNDAI-SIP-3007-spec · Evidence and corrective plan pending", "Enterprise Demand", "Coromandel Supply JCO", "30 Jul, 09:00 am", "New"],
] as const
*/

function Funnel({ title, weak, stages, source }: { title: string; weak: string; stages: readonly (readonly [number, string, string, number])[]; source: string }) {
  const [selected, setSelected] = useState(weak)
  return <section className="tower-section">
    <header className="tower-section-heading"><div><span className="tower-kicker">Stage control</span><h2>{title}</h2></div><p>Weak stage · {weak}</p></header>
    <div className="tower-funnel">{stages.map(([count, label, note, alarmCount], index) => <div className="tower-stage-wrap" key={label}>
      <button type="button" className="tower-stage" data-weak={label === weak || undefined} aria-pressed={selected === label} onClick={() => setSelected(label)}>
        <span className="tower-stage-top"><b>{String(index + 1).padStart(2, "0")}</b>{alarmCount ? <i aria-label={`${alarmCount} alarms`}>{alarmCount}</i> : null}</span>
        <strong>{count}</strong><span>{label}</span><small>{note}</small>
      </button>{index < stages.length - 1 ? <ChevronRight className="tower-stage-arrow" aria-hidden /> : null}
    </div>)}</div>
    <p className="tower-source">Source · {source}</p>
  </section>
}

type ControlTowerProps = {
  liveOpsData: any
  enterpriseDemandPreview: EnterpriseDemandLoopPreview | null
  controlledAutonomyPreview: ControlledAutonomyPreview
  niaMarginsPreview: NiaMarginsPreview
  newAddsPreview: NewAddsPreview
  memberEngagementPreview: MemberEngagementPreview | null
  memberSavingsPreview: MemberSavingsPreview
  niaGrowthPreview: NiaGrowthPreview
  onOpenWorkspace?: (workspace: string) => void
}

const displayDate = (value: unknown) => {
  const date = new Date(String(value ?? ""))
  if (!Number.isFinite(date.getTime())) return "Not recorded"
  const ist = new Date(date.getTime() + 330 * 60 * 1000)
  const day = String(ist.getUTCDate()).padStart(2, "0")
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][ist.getUTCMonth()]
  const hour24 = ist.getUTCHours()
  const hour = String(hour24 % 12 || 12).padStart(2, "0")
  const minute = String(ist.getUTCMinutes()).padStart(2, "0")
  return `${day} ${month}, ${hour}:${minute} ${hour24 >= 12 ? "pm" : "am"}`
}

export function buildControlTowerLivingLoop(liveOpsData: any) {
  const living = buildLivingScreenData(liveOpsData)
  return {
    name: "Living occupancy",
    current: `${living.existingOccupied.toLocaleString("en-IN")} occupied`,
    target: `${living.existingContracted.toLocaleString("en-IN")} contracted`,
    gap: `${living.existingVacant.toLocaleString("en-IN")} vacant · ${living.existingOccupancyPercent}% occupancy`,
    due: "Live monitoring",
    verified: displayDate(liveOpsData?.meta?.updatedAt ?? liveOpsData?.fetchedAt),
  }
}

export function ControlTower({ liveOpsData, enterpriseDemandPreview, controlledAutonomyPreview, niaMarginsPreview, newAddsPreview, memberEngagementPreview, memberSavingsPreview, niaGrowthPreview, onOpenWorkspace }: ControlTowerProps) {
  const livePreviews = { enterpriseDemandPreview, controlledAutonomyPreview, niaMarginsPreview, newAddsPreview, memberEngagementPreview, memberSavingsPreview, niaGrowthPreview } as any
  const livingLoop = buildControlTowerLivingLoop(liveOpsData)
  const loops = [
    enterpriseDemandPreview
      ? { name: "Enterprise demand", current: `${Math.max(0, enterpriseDemandPreview.activeNode.committedNests - enterpriseDemandPreview.activeNode.readinessGap)} Nests`, target: `${enterpriseDemandPreview.activeNode.committedNests} Nests`, gap: `${enterpriseDemandPreview.activeNode.readinessGap} Nests`, due: displayDate(enterpriseDemandPreview.activeNode.arrivalAt), verified: displayDate(enterpriseDemandPreview.source.lastRefreshAt) }
      : { name: "Enterprise demand", current: "No data", target: "No data", gap: "0 open", due: "No open action", verified: "Not recorded" },
    { name: "Member adds", current: String(livePreviews.newAddsPreview.taskSummary.current), target: String(livePreviews.newAddsPreview.taskSummary.target), gap: String(livePreviews.newAddsPreview.taskSummary.gap), due: livePreviews.newAddsPreview.actions[0]?.dueAt ? displayDate(livePreviews.newAddsPreview.actions[0].dueAt) : "No open action", verified: displayDate(livePreviews.newAddsPreview.source.lastRefreshAt) },
    memberEngagementPreview
      ? { name: "Member engagement", current: String(memberEngagementPreview.summary.current), target: String(memberEngagementPreview.summary.target), gap: String(memberEngagementPreview.summary.gap), due: memberEngagementPreview.tasks[0]?.dueAt ? displayDate(memberEngagementPreview.tasks[0].dueAt) : "No open action", verified: displayDate(memberEngagementPreview.source.lastRefreshAt) }
      : { name: "Member engagement", current: "No data", target: "No data", gap: "0 open", due: "No open action", verified: "Not recorded" },
    { name: "Member savings", current: String(livePreviews.memberSavingsPreview.summary.current), target: String(livePreviews.memberSavingsPreview.summary.target), gap: String(livePreviews.memberSavingsPreview.summary.gap), due: livePreviews.memberSavingsPreview.tasks[0]?.dueAt ? displayDate(livePreviews.memberSavingsPreview.tasks[0].dueAt) : "No open action", verified: displayDate(livePreviews.memberSavingsPreview.source.lastRefreshAt) },
    livingLoop,
    { name: "Nia margins", current: `₹${niaMarginsPreview.measures.fullUseCm2Inr.toLocaleString("en-IN")}`, target: (niaMarginsPreview as NiaMarginsPreview & { liveTargetRecorded?: boolean }).liveTargetRecorded ? `₹${niaMarginsPreview.measures.fullUseTargetInr.toLocaleString("en-IN")}` : "Not recorded", gap: (niaMarginsPreview as NiaMarginsPreview & { liveTargetRecorded?: boolean }).liveTargetRecorded ? `₹${Math.max(0, niaMarginsPreview.measures.fullUseTargetInr - niaMarginsPreview.measures.fullUseCm2Inr).toLocaleString("en-IN")}` : "Not calculable", due: "No sheet action", verified: "Calculated from backend" },
    { name: "Nia growth", current: String(livePreviews.niaGrowthPreview.summary.current), target: String(livePreviews.niaGrowthPreview.summary.target), gap: String(livePreviews.niaGrowthPreview.summary.gap), due: livePreviews.niaGrowthPreview.tasks[0]?.dueAt ? displayDate(livePreviews.niaGrowthPreview.tasks[0].dueAt) : "No open action", verified: displayDate(livePreviews.niaGrowthPreview.source.lastRefreshAt) },
  ]
  const governanceRecords = (controlledAutonomyPreview.routineLoop.records ?? []) as any[]
  const alarms: readonly (readonly [string, string, string, string, string, string])[] = governanceRecords.map((record) => [
    String(record.title || record.exceptionId), String(record.exceptionId), String(record.domain || "Operations"), String(record.ownerActorId || "Unassigned"), "Governed clock", String(record.state || "Detected"),
  ])
  const memberAddsOpenTheatres = newAddsPreview.theatres.filter((theatre) => theatre.vacantNests > 0).length
  const consoles = consoleDefinitions.map((definition) => ({
    ...definition,
    open: definition.name === "All consoles"
      ? alarms.length + memberAddsOpenTheatres
      : definition.name === "Member Adds"
        ? memberAddsOpenTheatres
        : alarms.filter((alarm) => alarm[2].toLowerCase().includes(definition.name.toLowerCase().replace("member adds", "new adds"))).length,
  }))
  const enterpriseStages: readonly (readonly [number, string, string, number])[] = enterpriseDemandPreview?.supplyLanes.flatMap((lane) => lane.stages.map((stage) => [stage.count, `${lane.supplyModel} ${stage.label}`, "Governed backend stage", 0] as const)) ?? []
  const memberStages: readonly (readonly [number, string, string, number])[] = [[Number(livePreviews.newAddsPreview.taskSummary.target) || 0, "Target fills", "Governed target", 0], [Number(livePreviews.newAddsPreview.taskSummary.current) || 0, "Verified billing-live", "Independent verification", Number(livePreviews.newAddsPreview.taskSummary.gap) || 0]]
  const viewFor = (consoleName: string) => {
    const loopName = consoleName === "All consoles" ? "nia growth" : consoleName === "Living" ? "living occupancy" : consoleName.toLowerCase()
    const loop = loops.find((candidate) => candidate.name.toLowerCase() === loopName) ?? loops[0]
    const alarmConsole = consoleName === "All consoles" ? null : consoleName === "Member Adds" ? "New Adds" : consoleName
    const alarm = (alarmConsole ? alarms.find((candidate) => candidate[2].toLowerCase().includes(alarmConsole.toLowerCase())) : alarms[0])
    const numericCurrent = Number(String(loop.current).replace(/[^0-9.-]/g, "")) || 0
    const numericTarget = Number(String(loop.target).replace(/[^0-9.-]/g, "")) || 0
    const memberAddsGap = consoleName === "Member Adds" ? Number(newAddsPreview.taskSummary.gap) || 0 : 0
    return { alarmConsole, title: alarm?.[0] || (memberAddsGap > 0 ? `${memberAddsGap} contracted FONO Nests require member adds` : `${loop.name} has no open governed alarm`), state: alarm || memberAddsGap > 0 ? "Action required" : "No open alarm", prescription: alarm?.[1] || (memberAddsGap > 0 ? "Recover the FONO member-add gap" : "Continue governed monitoring"), owner: alarm?.[3] || (memberAddsGap > 0 ? newAddsPreview.taskSummary.owner : "Unassigned"), due: alarm?.[4] || loop.due, metric: loop.name, verified: numericTarget > 0 ? Math.min(100, Math.round(numericCurrent / numericTarget * 100)) : 0, current: loop.current, target: loop.target, by: loop.due, verifier: "Independent verifier", evidence: ["Protected source record", "Independent verification record"] }
  }
  const [activeConsole, setActiveConsole] = useState("All consoles")
  const [held, setHeld] = useState(false)
  const [feedHeld, setFeedHeld] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [focusedAlarm, setFocusedAlarm] = useState<string>(alarms[0]?.[0] ?? "")
  const [consoleEvents, setConsoleEvents] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    const autoSync = async () => {
      const now = Date.now()
      const last = Number(window.sessionStorage.getItem("rafiqi-auto-sync-at") || 0)
      if (now - last < 45_000) return
      window.sessionStorage.setItem("rafiqi-auto-sync-at", String(now))
      try {
        const response = await fetch("/api/ops-data?live=1", { method: "POST", cache: "no-store" })
        if (!cancelled && response.ok) window.location.reload()
      } catch {
        // The daily Vercel reconciliation remains the durable fallback.
      }
    }
    void autoSync()
    const timer = window.setInterval(() => void autoSync(), 45_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [mounted])
  const visibleLoops = useMemo(() => activeConsole === "All consoles" ? loops : loops.filter((loop) => loop.name.toLowerCase() === (activeConsole === "Living" ? "living occupancy" : activeConsole.toLowerCase())), [activeConsole])
  const view = viewFor(activeConsole)
  const visibleAlarms = useMemo(() => view.alarmConsole === null ? alarms : alarms.filter((alarm) => alarm[2] === view.alarmConsole), [view])
  const approvalAlarms = (activeConsole === "All consoles" ? [alarms[0], alarms[1], alarms[2]] : activeConsole === "Enterprise Demand" ? [alarms[2]] : activeConsole === "Nia Growth" ? [alarms[0], alarms[1]] : []).filter((alarm): alarm is (typeof alarms)[number] => Boolean(alarm))
  const handedOver = (activeConsole === "All consoles" || activeConsole === "Nia Growth" ? [alarms[0], alarms[1]] : []).filter((alarm): alarm is (typeof alarms)[number] => Boolean(alarm))
  const refreshDashboard = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const response = await fetch("/api/ops-data", { method: "POST", cache: "no-store" })
      if (!response.ok) throw new Error(`Refresh failed (${response.status})`)
      window.location.reload()
    } catch (error) {
      setRefreshing(false)
      window.alert(error instanceof Error ? error.message : "Dashboard refresh failed")
    }
  }

  // The tower contains browser-local interaction state and locale-sensitive
  // presentation. Rendering its full body only after hydration keeps the
  // production DOM identical to the client's first render.
  if (!mounted) return <main className="control-tower" aria-label="Loading Control Tower" />

  return <main className="control-tower">
    <aside className="tower-rail" aria-label="Control Tower consoles">
      <div className="tower-brand"><span>R</span><div><strong>RafiQi Central</strong><small>Control Tower</small></div></div>
      <section className="tower-state"><span className="tower-kicker">System state</span><strong>{held ? "HELD" : "MANNED"}</strong><small>{held ? "Execution routes frozen" : "Shadow routes under watch"}</small></section>
      <nav className="tower-console-list" aria-label="Operating consoles"><p>Consoles</p>{consoles.map(({ name, open, icon: Icon }) => <button type="button" key={name} aria-current={activeConsole === name ? "page" : undefined} onClick={() => { setActiveConsole(name); setConsoleEvents((events) => [...events, name]) }}><Icon aria-hidden /><span><strong>{name}</strong><small>{open} open</small></span><i /></button>)}</nav>
      <section className="tower-hold"><span className="tower-kicker">Execution control</span><button className="tower-hold-button" type="button" aria-pressed={held} onClick={() => setHeld((value) => !value)}><Pause aria-hidden /><span><strong>{held ? "Release execution" : "Hold execution"}</strong><small>{held ? "Return routes to shadow watch" : "Freeze every running route"}</small></span></button></section>
    </aside>

    <div className="tower-right-column">
      <header className="tower-header"><div><span className="tower-kicker">RafiQi Central · Shadow control</span><h1>Control Tower</h1><p>{activeConsole === "All consoles" ? "All operating loops, one governed queue." : `${activeConsole} console isolated for action.`}</p></div><div className="tower-header-controls"><span className="tower-system-pill" data-state={held ? "ALARM" : "ALARM"}><i />{held ? "HELD" : "ALARM"}</span><button type="button" onClick={() => setFeedHeld((value) => !value)}><Pause aria-hidden />{feedHeld ? "Resume feed" : "Hold feed"}</button><button type="button" disabled={refreshing} onClick={() => void refreshDashboard()}><RefreshCw aria-hidden />{refreshing ? "Refreshing…" : "Refresh"}</button></div></header>
      <div className="tower-scroll-plane">
        <div className="tower-content-row">
          <div className="tower-canvas">
            {feedHeld ? <div className="tower-feed-notice"><ShieldAlert aria-hidden />Live refresh is held. The loaded governed snapshot remains visible.</div> : null}
            <section className="tower-fix" aria-label={view.title}>
              <header className="tower-fix-heading"><div><span className="tower-kicker">Slot 1 · Fix</span><h2>{view.title}</h2></div><span className="tower-fix-state">{view.state}</span></header>
              <div className="tower-fix-grid">
                <div className="tower-fix-action"><span className="tower-kicker">Prescription</span><strong>{view.prescription}</strong><p><UserRound aria-hidden />{view.owner} · <Clock3 aria-hidden />{view.due}</p></div>
                <div className="tower-metric"><span><strong>{view.metric}</strong><small>{view.verified}% verified</small></span><div className="tower-metric-bar"><i style={{ width: `${view.verified}%` }} /><span /></div><p className="tower-metric-key"><span data-state="verified"><i />{view.verified}% verified</span><span><i />{100 - view.verified}% still open</span></p><p className="tower-metric-values"><strong>{view.current}</strong><ArrowRight aria-hidden /><strong>{view.target}</strong><small>by {view.by}</small></p></div>
              </div>
              <details className="tower-evidence"><summary>View evidence and recovery detail</summary><div className="tower-evidence-body"><div><span className="tower-kicker">Evidence to close</span>{view.evidence.map((item) => <p key={item}><CheckCircle2 aria-hidden />{item}</p>)}<p><ShieldCheck aria-hidden />Verifier · {view.verifier}</p></div><div className="tower-fix-options"><article data-chosen="true"><span>Governed route</span><strong>{view.title}</strong><small>Highest eligible route within the current control boundary.</small></article></div></div></details>
            </section>

            <section className="tower-section" aria-label="Operating board"><header className="tower-section-heading"><div><span className="tower-kicker">Live control</span><h2>Operating board</h2></div><div className="tower-board-heading-meta"><p>{visibleLoops.length} {visibleLoops.length === 1 ? "loop" : "loops"} in view</p><ul className="tower-state-key" aria-label="Operating state key"><li>Verified current</li><li>Still open</li></ul></div></header><div className="tower-board">{visibleLoops.map((loop) => <article className="tower-board-tile" data-state="unconfirmed" key={loop.name}><button className="tower-tile-focus" type="button" aria-label={`Focus ${loop.name}`}><span>{loop.name}</span><ShieldAlert aria-hidden /></button><dl><div data-measure="verified"><dt>Verified current</dt><dd>{loop.current}</dd></div><div><dt>Target</dt><dd>{loop.target}</dd></div><div data-measure="unresolved"><dt>Still open</dt><dd>{loop.gap}</dd></div></dl><div className="tower-tile-meta"><span><Clock3 aria-hidden />Due · {loop.due}</span><span><ShieldCheck aria-hidden />Data updated · {loop.verified}</span></div><button className="tower-open-workspace" type="button" onClick={() => onOpenWorkspace?.(loop.name)}>Open workspace<ArrowUpRight aria-hidden /></button></article>)}</div></section>

            {activeConsole === "All consoles" || activeConsole === "Enterprise Demand" ? <Funnel title="Enterprise demand funnel" weak="Site visit" stages={enterpriseStages} source="Enterprise_Demand governed rows" /> : null}
            {activeConsole === "All consoles" || activeConsole === "Member Adds" ? <Funnel title="Member-adds funnel" weak="Filled" stages={memberStages} source="FONO + Shrampark + Enterprise via Enterprise_Demand" /> : null}

            <section className="tower-section" aria-label="Alarm queue"><header className="tower-section-heading"><div><span className="tower-kicker">Owned exceptions</span><h2>Alarm queue</h2></div><p>{visibleAlarms.length} records · source IDs retained</p></header><div className="tower-alarm-table" role="table" aria-label="Alarm queue"><div className="tower-alarm-head" role="row"><span>Alarm</span><span>Console</span><span>Owner / due</span><span>State</span><span>Next control</span></div>{visibleAlarms.map((alarm, index) => <div className="tower-alarm-row" role="row" data-focused={focusedAlarm === alarm[0]} key={`${alarm[0]}-${index}`}><button className="tower-alarm-title" type="button" aria-pressed={focusedAlarm === alarm[0]} onClick={() => setFocusedAlarm(alarm[0])}><i data-severity="breach" /><span><strong>{alarm[0]}</strong><small>{alarm[1]}</small></span></button><span className="tower-alarm-console">{alarm[2]}</span><span className="tower-alarm-owner"><strong>{alarm[3]}</strong><small>{alarm[4]}</small></span><span className="tower-lifecycle">{alarm[5]}</span><span className="tower-row-actions">{alarm[5] === "Escalated" ? <button type="button"><RotateCcw aria-hidden />Recall</button> : <><button type="button"><UserCheck aria-hidden />Assign</button><button type="button" aria-label={`Escalate ${alarm[0]}`}><Send aria-hidden /></button></>}</span></div>)}</div></section>
          </div>
          <aside className="tower-aside" aria-label="Human controls">
            <section><span className="tower-kicker">Approvals</span><h2>Waiting on a person</h2>
              {approvalAlarms.length ? approvalAlarms.map((alarm) => <button type="button" key={alarm[0]}><ShieldCheck aria-hidden /><span><strong>{alarm[3]}</strong><small>{alarm[0]}</small></span></button>) : <p>No approval in this view.</p>}
            </section>
            <section><span className="tower-kicker">Verification chain</span><h2>{view.verifier}</h2><ol>{view.evidence.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}<li><span>{view.evidence.length + 1}</span>Verified outcome moves the real metric</li></ol></section>
            <section><span className="tower-kicker">Escalated to a person</span><h2>{handedOver.length} handed over</h2>
              {handedOver.length ? handedOver.map((alarm) => <button type="button" key={alarm[0]}><span><strong>{alarm[3]}</strong><small>{alarm[0]}</small></span></button>) : <p>No lifecycle handover in this view.</p>}
            </section>
          </aside>
        </div>
        <footer className="tower-log" aria-label="Append-only tower log"><div className="tower-log-title"><span className="tower-kicker">Append-only log</span><strong>{1 + consoleEvents.length} events</strong></div><ol><li><time>Ready</time><span>RafiQi Central</span><strong>Tower manned</strong><small>{alarms.length} governed alarms loaded from Action_Log records with source lineage</small></li>{consoleEvents.map((name, index) => <li key={`${name}-${index}`}><time>{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><span>Nia operator</span><strong>Console focused</strong><small>{name}</small></li>)}</ol></footer>
      </div>
    </div>
  </main>
}
