"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronDown, LockKeyhole, LogOut, Paperclip, UserPlus } from "lucide-react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { AttachSlopeChart } from "@/components/charts/attach-slope-chart"
import { CmBridgeChart } from "@/components/charts/cm-bridge-chart"
import { PeopleInterventionChart } from "@/components/charts/people-intervention-chart"
import { StudioArpuChart } from "@/components/charts/studio-arpu-chart"
import { DataTable } from "@/components/data-table"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { ModeSelect } from "@/components/mode-select"
import { ThemeToggle } from "@/components/theme-toggle"
import { LivingScreen } from "@/components/living-screen"
import { EssentialsScreen } from "@/components/essentials-screen"
import { PeopleScreen } from "@/components/people-screen"
import { DespatchScreen } from "@/components/despatch-screen"
import { EnterpriseDemandWorkspace } from "@/components/enterprise-demand-workspace"
import { FinanceExpansionWorkspace } from "@/components/finance-expansion-workspace"
import { ControlledAutonomyWorkspace } from "@/components/controlled-autonomy-workspace"
import { MemberFeedbackScreen } from "@/components/member-feedback-screen"
import { OverviewStory, type OverviewMode } from "@/components/overview/overview-story"
import { WorkScreen } from "@/components/work-screen"
import { NiaMarginsWorkspace } from "@/components/nia-margins-workspace"
import { NewAddsWorkspace } from "@/components/new-adds-workspace"
import { MemberEngagementWorkspace } from "@/components/member-engagement-workspace"
import { MemberSavingsWorkspace } from "@/components/member-savings-workspace"
import { NiaGrowthWorkspace } from "@/components/nia-growth-workspace"
import { CashControlWorkspace } from "@/components/cash-control-workspace"
import { LearningHistoryWorkspace, type LearningHistoryEntry } from "@/components/learning-history-workspace"
import { dashboardDisplayLabel, OPERATIONS_TABS, POST_LOGIN_DASHBOARD_STATE, SELF_LEARN_TABS, TABLE_SCREENS, workspaceLandingTab, type DashboardRoute, type DashboardTab, type DashboardWorkspace, type LivingSection } from "@/lib/dashboard-model"
import { executionActions } from "@/lib/execution-data"
import { memberFeedbackActions } from "@/lib/member-feedback-data"
import { validateActionProof, type ExecutionAction } from "@/lib/execution-control"
import { laneHeadline } from "@/lib/ops-data"
import type { EnterpriseDemandLoopPreview } from "@/lib/operating-loop/enterprise-demand-loop"
import type { FinanceExpansionPreview } from "@/lib/operating-loop/finance-expansion-preview"
import type { ControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import type { NiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import type { NewAddsPreview } from "@/lib/operating-loop/new-adds-loop"
import type { MemberEngagementPreview } from "@/lib/operating-loop/member-engagement-loop"
import type { MemberSavingsPreview } from "@/lib/operating-loop/member-savings-loop"
import type { NiaGrowthPreview } from "@/lib/operating-loop/nia-growth-loop"
import type { CashControlPreview } from "@/lib/operating-loop/cash-control-loop"
import { aggregateLoopHealth, buildDespatchQueue } from "@/lib/operating-loop/runtime-contracts"

const screenMeta: Record<DashboardTab, { title: string; subtitle: string; view: string }> = {
  "Cash & Control": { title: "Set the destination. Let Nia run the month.", subtitle: "Approve the goal once; Nia allocates, recovers and verifies the work while protecting cash.", view: "Shadow mode Â· synthetic fixture" },
  "Enterprise Demand": { title: "Enterprise Demand", subtitle: "Turn every signed arrival into a verified 2 km, then 5 km capacity loop.", view: "Shadow mode Â· synthetic fixture" },
  "New Adds": { title: "Fill every FONO vacancy with verified billing-live Members.", subtitle: "Detect vacancies, choose the lowest-cost eligible channel, assign the fill and verify billing.", view: "Shadow mode Â· synthetic fixture" },
  "Member Engagement": { title: "Keep Members by removing the friction that makes them leave.", subtitle: "Detect risk early, repair the cause and count only verified recovery.", view: "Shadow mode Â· synthetic fixture" },
  "Member Savings": { title: "Every service must save the Member and pay Nia.", subtitle: "Protect the dual gate, repair attach and repeat gaps, and keep savings claims verified.", view: "Shadow mode Â· synthetic fixture" },
  "Nia Growth": { title: "Add capacity where demand supports it.", subtitle: "Keep FONO and Åšram Park separate and expose capital risk before any commitment.", view: "Shadow mode Â· synthetic fixture" },
  "Your Sign-Off": { title: "Your Sign-Off", subtitle: "Only material changes and unresolved exceptions wait here for a human decision.", view: "Pending decisions" },
  "Finance control": { title: "Control capital before expansion commits it.", subtitle: "Compare Studio economics, enforce cash and opex guardrails, route exceptions, and close War Room cases only after independent verification.", view: "Shadow mode Â· synthetic Preview" },
  "Nia Margins": { title: "Nia Margins", subtitle: "Protect the margin behind every verified Member outcome.", view: "Shadow preview" },
  Overview: { title: "Making Leaving Home Worth It.", subtitle: "Nia is the Migrant Worker Continuity Platform. Living, Work and Essentials operate as one flywheel for people who leave home for work.", view: "This month Â· every 2 hours" },
  Living: { title: "Community Living and Well-Being.", subtitle: "Create a safe, connected community where Members can live well and thrive.", view: "This month Â· every 2 hours" },
  Work: { title: "Enable upskilling and higher incomes.", subtitle: "Connect Members to skills, better work, and sustained income growth.", view: "Data needed" },
  Essentials: TABLE_SCREENS.Essentials,
  Economics: TABLE_SCREENS.Economics,
  People: TABLE_SCREENS.People,
  "Member Feedback": { title: "Fix the signal before a Member exits.", subtitle: "Turn feedback and monthly NPS into named actions, proof and verified closure.", view: "Illustrative Â· connector pending" },
  Definitions: TABLE_SCREENS.Definitions,
  Despatch: { title: "Catch silence before it becomes delay.", subtitle: "Live heartbeat monitoring for active shifts, people, and categories.", view: "Live Â· every 45 seconds" },
}

function Filters({ className = "" }: { className?: string }) {
  return <div className={`filters ${className}`.trim()} aria-label="Dashboard filters">{["Theatre: All", "Location: All", "Studio: All", "Person: All"].map((label) => <button key={label}>{label}<ChevronDown aria-hidden /></button>)}</div>
}

function TableScreen({ tab, allocationFocus }: { tab: keyof typeof TABLE_SCREENS; allocationFocus?: string }) {
  const data = TABLE_SCREENS[tab]
  return <DashboardSectionAccordion ariaLabel={`${tab} sections`} sections={[
    { title: "Main point", summary: laneHeadline(tab) },
    ...(tab === "Essentials" ? [{ title: "Allocation context", summary: "Review the current allocation mismatch and evidence." }] : []),
    { title: data.section, summary: `${data.metrics.length} headline measures` },
    ...(tab === "Essentials" ? [{ title: "Attach slope", summary: "Current attach performance against the governed range." }] : []),
    ...(tab === "Economics" ? [{ title: "Contribution bridge", summary: "Contribution movement and Studio ARPU evidence." }] : []),
    ...(tab === "People" ? [{ title: "People interventions", summary: "Interventions and verified outcomes by owner." }] : []),
    { title: data.panelTitle, summary: `${data.rows.length} records available for review` },
    { title: "Source note", summary: data.footer },
  ]}>
    <div className="decision-bar"><div><span>MAIN POINT</span><strong>{laneHeadline(tab)}</strong></div><p>{data.footer}</p></div>
    {tab === "Essentials" && <AllocationContextStrip mismatchId={allocationFocus} />}
    <div className="section-heading"><h2>{data.section}</h2>{tab === "People" && <button className="add"><UserPlus aria-hidden />Add person</button>}</div>
    <div className={`metric-grid ${tab === "Definitions" ? "definitions" : ""}`}>{data.metrics.map((metric, index) => <article className="metric" key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.note}</span>{index < data.metrics.length - 1 && <i aria-hidden>â†’</i>}</article>)}</div>
    {tab === "Essentials" && <AttachSlopeChart />}
    {tab === "Economics" && <><CmBridgeChart /><StudioArpuChart /></>}
    {tab === "People" && <PeopleInterventionChart />}
    <h2>{data.panelTitle}</h2>
    <DataTable caption={data.panelTitle} columns={data.columns} rows={data.rows} />
    <p className="footer-note">{data.footer}</p>
  </DashboardSectionAccordion>
}

export function NiaDashboard({ enterpriseDemandPreview = null, financeExpansionPreview = null, controlledAutonomyPreview = null, niaMarginsPreview, newAddsPreview, memberEngagementPreview, memberSavingsPreview, niaGrowthPreview, cashControlPreview = null, financeAllowed = false, liveOpsData, allocationData }: { enterpriseDemandPreview?: EnterpriseDemandLoopPreview | null; financeExpansionPreview?: FinanceExpansionPreview | null; controlledAutonomyPreview?: ControlledAutonomyPreview | null; niaMarginsPreview: NiaMarginsPreview; newAddsPreview: NewAddsPreview; memberEngagementPreview: MemberEngagementPreview; memberSavingsPreview: MemberSavingsPreview; niaGrowthPreview: NiaGrowthPreview; cashControlPreview?: CashControlPreview | null; financeAllowed?: boolean; liveOpsData?: any; allocationData?: any }) {
  const [active, setActive] = useState<DashboardTab>(POST_LOGIN_DASHBOARD_STATE.active)
  const [workspace, setWorkspace] = useState<DashboardWorkspace>(POST_LOGIN_DASHBOARD_STATE.workspace)
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("reporting")
  const [livingFocus, setLivingFocus] = useState<LivingSection>()
  const [allocationFocus, setAllocationFocus] = useState<string>()
  const [commitments, setCommitments] = useState<ExecutionAction[]>(() => [...executionActions, ...memberFeedbackActions])
  // Keep the page shell stable while the Overview mode changes. The mode bar
  // and the report body already explain the active operating view.
  const meta = screenMeta[active]
  const sectionTitle = active === "Member Feedback" ? "Member NPS" : active === "Definitions" ? "Learning history" : dashboardDisplayLabel(active)
  const learningHistory: readonly LearningHistoryEntry[] = (controlledAutonomyPreview?.learningQueue ?? []).map((entry) => ({
    domain: entry.domain,
    observed: entry.observed,
    proposedChange: entry.proposedChange,
    expectedEffect: entry.expectedEffect,
    attribution: entry.evaluation.attributionLabel,
    confidence: entry.evaluation.confidence,
    disposition: entry.evaluation.requiredDisposition,
  }))
  const platformLoopHealth = useMemo(() => aggregateLoopHealth([
    ...(enterpriseDemandPreview ? [{ domain: "Enterprise Demand" as const, health: enterpriseDemandPreview.loopHealth }] : []),
    { domain: "New Adds" as const, health: newAddsPreview.loopHealth },
    { domain: "Member Engagement" as const, health: memberEngagementPreview.loopHealth },
    { domain: "Member Savings" as const, health: memberSavingsPreview.loopHealth },
    { domain: "Nia Margins" as const, health: niaMarginsPreview.loopHealth },
    { domain: "Nia Growth" as const, health: niaGrowthPreview.loopHealth },
    ...(cashControlPreview ? [{ domain: "Cash & Control" as const, health: cashControlPreview.loopHealth }] : []),
  ]), [cashControlPreview, enterpriseDemandPreview, memberEngagementPreview.loopHealth, memberSavingsPreview.loopHealth, newAddsPreview.loopHealth, niaGrowthPreview.loopHealth, niaMarginsPreview.loopHealth])
  const platformDespatchQueue = useMemo(() => buildDespatchQueue([
    ...(enterpriseDemandPreview?.despatchEscalations ?? []),
    ...newAddsPreview.despatchEscalations,
    ...memberEngagementPreview.despatchEscalations,
    ...memberSavingsPreview.despatchEscalations,
    ...niaMarginsPreview.despatchEscalations,
    ...niaGrowthPreview.despatchEscalations,
    ...(cashControlPreview?.despatchEscalations ?? []),
  ], Number.MAX_SAFE_INTEGER), [cashControlPreview, enterpriseDemandPreview, memberEngagementPreview.despatchEscalations, memberSavingsPreview.despatchEscalations, newAddsPreview.despatchEscalations, niaGrowthPreview.despatchEscalations, niaMarginsPreview.despatchEscalations])
  const workspaceTabs: readonly DashboardTab[] = workspace === "self-drive"
    ? OPERATIONS_TABS.filter((tab) => (tab !== "Enterprise Demand" || enterpriseDemandPreview !== null) && (tab !== "Your Sign-Off" || controlledAutonomyPreview !== null))
    : workspace === "self-learn"
      ? SELF_LEARN_TABS
      : ["Finance control", "Nia Margins", "Cash & Control"]

  useEffect(() => {
    if (active === "Living" && livingFocus) requestAnimationFrame(() => document.getElementById(livingFocus)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [active, livingFocus])

  function navigate(route: DashboardRoute, mismatchId?: string) {
    setActive(route.screen)
    setLivingFocus(route.subsection)
    setAllocationFocus(mismatchId)
  }

  function openWorkspace(next: DashboardWorkspace) {
    setWorkspace(next)
    setActive(workspaceLandingTab(next))
  }

  function validateExecutionAction(actionId: string) {
    setCommitments((current) => current.map((action) => action.id === actionId
      ? validateActionProof(action, "despatch-validation-team", new Date().toISOString(), `log-${action.id}-despatch-${Date.now()}`)
      : action))
  }

  function openFeedbackExecution() {
    setActive("Overview")
    setOverviewMode("execution")
  }

  function openFeedbackDespatch() {
    setActive("Despatch")
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", redirect: "follow" })
    window.location.assign("/login")
  }

  return <main className="central-shell">
    <div className="central-main">
    <header className="platform-utility"><div className="central-brand">Rafiqi <span>Central</span></div><ModeSelect value={workspace} onChange={openWorkspace} options={financeAllowed ? [{ value: "self-drive", label: "Self Drive" }, { value: "self-learn", label: "Self Learn" }, { value: "finance", label: "Finance" }] : [{ value: "self-drive", label: "Self Drive" }, { value: "self-learn", label: "Self Learn" }]} /><div className="controls platform-controls"><div className="freshness"><span>DATA UPDATED</span><strong><i /> 14:00 IST</strong></div><button className="view"><small>PERIOD</small><strong>{meta.view}</strong><ChevronDown aria-hidden /></button><button className="date"><CalendarDays aria-hidden />Jul 2026<ChevronDown aria-hidden /></button><button className="upload"><Paperclip aria-hidden />Data refresh</button><ThemeToggle /><button className="upload" onClick={signOut}><LogOut aria-hidden />Sign out</button></div></header>
    <nav id="dashboard-navigation" className="platform-domain-nav" aria-label={`${workspace} navigation`}><div className="platform-domain-tabs">{workspaceTabs.map((item) => <button key={item} className={`${active === item ? "active" : ""}${item === "Despatch" ? " despatch-nav" : ""}`} aria-current={active === item ? "page" : undefined} onClick={() => navigate({ screen: item })}><span>{item === "Member Feedback" ? "Member NPS" : item === "Definitions" ? "Learning history" : dashboardDisplayLabel(item)}</span></button>)}</div></nav>
    <section className="platform-heading"><h1>{sectionTitle}</h1><p className="subtitle">{meta.title === sectionTitle ? meta.subtitle : `${meta.title} ${meta.subtitle}`}</p></section>
    <Filters className="platform-filters" />
    <section className={`content platform-content ${active === "Overview" ? "overview-content" : ""} pillar-${active.toLowerCase().replaceAll(" ", "-")}`}>
      {active === "Overview" && <OverviewStory mode={overviewMode} commitments={commitments} loopHealth={platformLoopHealth} liveOpsData={liveOpsData} allocationData={allocationData} onModeChange={setOverviewMode} onNavigate={navigate} />}
      {active === "Cash & Control" && (cashControlPreview ? <CashControlWorkspace preview={cashControlPreview} /> : <section className="restricted-control" aria-label="Restricted Cash and Control"><LockKeyhole aria-hidden /><p className="eyebrow">RESTRICTED CONTROL</p><h2>Cash &amp; Control is available to authorised Finance users.</h2><p>Operating teams can continue through the remaining Self Drive tabs. Financial goals, cash, opex and leakage remain protected.</p></section>)}
      {active === "Enterprise Demand" && enterpriseDemandPreview && <EnterpriseDemandWorkspace preview={enterpriseDemandPreview} />}
      {active === "New Adds" && <NewAddsWorkspace preview={newAddsPreview} />}
      {active === "Member Engagement" && <MemberEngagementWorkspace preview={memberEngagementPreview} />}
      {active === "Member Savings" && <MemberSavingsWorkspace preview={memberSavingsPreview} />}
      {active === "Nia Growth" && <NiaGrowthWorkspace preview={niaGrowthPreview} />}
      {active === "Finance control" && financeExpansionPreview && <FinanceExpansionWorkspace preview={financeExpansionPreview} />}
      {active === "Your Sign-Off" && controlledAutonomyPreview && <ControlledAutonomyWorkspace preview={controlledAutonomyPreview} />}
      {active === "Nia Margins" && <NiaMarginsWorkspace preview={niaMarginsPreview} />}
      {active === "Living" && <LivingScreen focus={livingFocus} allocationFocus={allocationFocus} />}
      {active === "Work" && <WorkScreen />}
      {active === "Essentials" && <EssentialsScreen allocationFocus={allocationFocus} />}
      {active === "People" && <PeopleScreen commitments={commitments} />}
      {active === "Member Feedback" && <MemberFeedbackScreen actions={commitments} onOpenExecution={openFeedbackExecution} onOpenDespatch={openFeedbackDespatch} />}
      {active === "Definitions" && <LearningHistoryWorkspace entries={learningHistory} />}
      {active === "Despatch" && <DespatchScreen commitments={commitments} escalations={platformDespatchQueue.visible} escalationTotal={platformDespatchQueue.totalOpen} loopHealth={platformLoopHealth} onValidateAction={validateExecutionAction} />}
      {active === "Economics" && <TableScreen tab={active} allocationFocus={allocationFocus} />}
    </section>
    </div></main>
}



