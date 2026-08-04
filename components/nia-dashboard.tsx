"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, LockKeyhole, Menu, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Truck, UserPlus } from "lucide-react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { AttachSlopeChart } from "@/components/charts/attach-slope-chart"
import { CmBridgeChart } from "@/components/charts/cm-bridge-chart"
import { PeopleInterventionChart } from "@/components/charts/people-intervention-chart"
import { StudioArpuChart } from "@/components/charts/studio-arpu-chart"
import { DataTable } from "@/components/data-table"
import { DashboardSectionAccordion, requestOutlineFocus } from "@/components/dashboard-section-accordion"
import { CentralSidebar } from "@/components/central-sidebar"
import { DecisionRoom } from "@/components/decision-room"
import { LensProvider, persistOperatingLens, readStoredOperatingLens, type OperatingLens } from "@/components/lens"
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
import { ContextStrip, SegmentedControl } from "@/components/operating-ui"
import { dashboardDisplayLabel, POST_LOGIN_DASHBOARD_STATE, TABLE_SCREENS, workspaceLandingTab, type DashboardRoute, type DashboardTab, type DashboardWorkspace, type LivingSection } from "@/lib/dashboard-model"
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
import { aggregateLoopHealth, buildDespatchQueue, type DespatchEscalationRecord } from "@/lib/operating-loop/runtime-contracts"

const DASHBOARD_PERIOD = "Jul 2026"

function liveRows(snapshot: unknown, key: string): readonly Record<string, unknown>[] {
  if (!snapshot || typeof snapshot !== "object") return []
  const value = (snapshot as Record<string, unknown>)[key]
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : []
}

function LiveBackendTables({ title, groups }: { title: string; groups: readonly { label: string; rows: readonly Record<string, unknown>[] }[] }) {
  const total = groups.reduce((count, group) => count + group.rows.length, 0)
  return <DashboardSectionAccordion ariaLabel={`${title} live sections`} sections={[
    { title: "Data status", summary: total ? `${total} normalized backend records` : "No verified records available" },
    ...groups.map((group) => ({ title: group.label, summary: `${group.rows.length} records` })),
  ]}><div className="decision-bar"><div><span>DATA STATUS</span><strong>{total ? `${title} is driven by normalized backend records.` : `${title} has no verified backend data; no synthetic values are shown.`}</strong></div><p>Missing source values remain blank.</p></div>{groups.map((group) => {
    const columns = [...new Set(group.rows.flatMap((row) => Object.keys(row)))].filter((key) => !key.startsWith("__"))
    return <section className="operating-section" key={group.label}><h2>{group.label}</h2>{group.rows.length ? <DataTable caption={group.label} columns={columns} rows={group.rows.map((row) => columns.map((key) => String(row[key] ?? "")))} /> : <p className="footer-note">No verified records are available in this backend tab.</p>}</section>
  })}</DashboardSectionAccordion>
}

const screenMeta: Record<DashboardTab, { title: string; subtitle: string; view: string }> = {
  "Cash & Control": { title: "Set the destination. Let Nia run the month.", subtitle: "Approve the goal once; Nia allocates, recovers and verifies the work while protecting cash.", view: "Shadow mode · synthetic fixture" },
  "Enterprise Demand": { title: "Enterprise Demand", subtitle: "Turn every signed arrival into a verified 2 km, then 5 km capacity loop.", view: "Shadow mode · synthetic fixture" },
  "New Adds": { title: "Fill every FONO vacancy with verified billing-live Members.", subtitle: "Detect vacancies, choose the lowest-cost eligible channel, assign the fill and verify billing.", view: "Shadow mode · synthetic fixture" },
  "Member Engagement": { title: "Keep Members by removing the friction that makes them leave.", subtitle: "Detect risk early, repair the cause and count only verified recovery.", view: "Shadow mode · synthetic fixture" },
  "Member Savings": { title: "Every service must save the Member and pay Nia.", subtitle: "Protect the dual gate, repair attach and repeat gaps, and keep savings claims verified.", view: "Shadow mode · synthetic fixture" },
  "Nia Growth": { title: "Add capacity where demand supports it.", subtitle: "Keep FONO and Śram Park separate and expose capital risk before any commitment.", view: "Shadow mode · synthetic fixture" },
  "Your Sign-Off": { title: "Your Sign-Off", subtitle: "Only material changes and unresolved exceptions wait here for a human decision.", view: "Pending decisions" },
  "Finance control": { title: "Control capital before expansion commits it.", subtitle: "Compare Studio economics, enforce cash and opex guardrails, route exceptions, and close War Room cases only after independent verification.", view: "Shadow mode · synthetic Preview" },
  "Nia Margins": { title: "Nia Margins", subtitle: "Protect the margin behind every verified Member outcome.", view: "Shadow preview" },
  Overview: { title: "Making Leaving Home Worth It.", subtitle: "Nia is the Migrant Worker Continuity Platform. Living, Work and Essentials operate as one flywheel for people who leave home for work.", view: "This month · every 2 hours" },
  Living: { title: "Community Living and Well-Being.", subtitle: "Create a safe, connected community where Members can live well and thrive.", view: "This month · every 2 hours" },
  Work: { title: "Enable upskilling and higher incomes.", subtitle: "Connect Members to skills, better work, and sustained income growth.", view: "Data needed" },
  Essentials: TABLE_SCREENS.Essentials,
  Economics: TABLE_SCREENS.Economics,
  People: TABLE_SCREENS.People,
  "Member Feedback": { title: "Fix the signal before a Member exits.", subtitle: "Turn feedback and monthly NPS into named actions, proof and verified closure.", view: "Illustrative · connector pending" },
  Definitions: TABLE_SCREENS.Definitions,
  Despatch: { title: "Catch silence before it becomes delay.", subtitle: "Live heartbeat monitoring for active shifts, people, and categories.", view: "Live · every 45 seconds" },
}

const PAGE_CONTEXT_ITEMS: Record<DashboardTab, readonly string[]> = {
  "Cash & Control": ["Recommendation", "Monthly path", "Financial controls", "Channel mix", "Open work", "Approvals"],
  "Enterprise Demand": ["Summary", "Arrival stages", "Nearby supply", "FONO", "Śram Park", "Actions & exceptions"],
  "New Adds": ["Decision", "Fill status", "Theatre progress", "Spots to fill", "Sign-off", "Proof"],
  "Member Engagement": ["Decision", "Retention status", "Cohort curve", "Recovery work", "Proof"],
  "Member Savings": ["Decision", "Dual gate", "Service economics", "Recovery work", "Proof"],
  "Nia Margins": ["Decision", "Margin status", "Contribution bridge", "Recovery work", "Proof"],
  "Nia Growth": ["Decision", "Capacity status", "Channel paths", "Stage readiness", "Growth work"],
  "Your Sign-Off": ["Decision queue", "Material changes", "Evidence", "Learning controls", "Audit record"],
  "Finance control": ["Capital decision", "Studio economics", "Guardrails", "War Room", "Decision"],
  Overview: ["Current position", "Living", "Work", "Essentials", "Execution"],
  Living: ["FONO", "Demand", "Supply", "Reconciliation"],
  Work: ["Data requirement"],
  Essentials: ["Main point", "Buying journey", "Demand", "Supply", "Savings", "Working capital"],
  Economics: ["Main point", "Headline measures", "Contribution bridge", "Studio economics", "Source"],
  People: ["Main point", "People summary", "Follow-through", "Demand teams", "Supply teams"],
  "Member Feedback": ["Connection status", "Closure loop", "Summary", "Member signals", "Privacy"],
  Definitions: ["Learning summary", "Verified outcomes", "Recommendations", "Controls", "History"],
  Despatch: ["Next actions", "Owner queues", "Exceptions", "Validation", "Heartbeat", "Data status"],
}

// Outline-managed pages already expose their complete section navigation next
// to the focused canvas. Keep the horizontal header only on the one remaining
// non-outline landing so the same sections are never presented twice.
const OUTLINE_MANAGED_TABS = new Set<DashboardTab>([
  "Cash & Control", "Enterprise Demand", "New Adds", "Member Engagement",
  "Member Savings", "Nia Margins", "Nia Growth", "Your Sign-Off",
  "Finance control", "Living", "Work", "Essentials", "Economics", "People",
  "Member Feedback", "Definitions", "Despatch",
])

function Filters({ className = "" }: { className?: string }) {
  return <div className={`filters ${className}`.trim()} aria-label="Dashboard filters">{["Theatre: All", "Location: All", "Studio: All", "Person: All"].map((label) => <button key={label}>{label}</button>)}</div>
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
    <div className={`metric-grid ${tab === "Definitions" ? "definitions" : ""}`}>{data.metrics.map((metric, index) => <article className="metric" key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.note}</span>{index < data.metrics.length - 1 && <i aria-hidden>→</i>}</article>)}</div>
    {tab === "Essentials" && <AttachSlopeChart />}
    {tab === "Economics" && <><CmBridgeChart /><StudioArpuChart /></>}
    {tab === "People" && <PeopleInterventionChart />}
    <h2>{data.panelTitle}</h2>
    <DataTable caption={data.panelTitle} columns={data.columns} rows={data.rows} />
    <p className="footer-note">{data.footer}</p>
  </DashboardSectionAccordion>
}

function EnterpriseContextHeader({ preview }: { preview: EnterpriseDemandLoopPreview }) {
  const [selected, setSelected] = useState("enterprise-demand-overview")
  const items = [
    { id: "enterprise-demand-overview", label: "Overview" },
    { id: "enterprise-demand-fono", label: "FONO" },
    { id: "enterprise-demand-sp", label: "Śram Park" },
    { id: "enterprise-demand-actions", label: "Actions" },
    { id: "enterprise-demand-health", label: "Evidence" },
  ] as const

  function focus(id: string) {
    setSelected(id)
    requestOutlineFocus(id)
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return <nav className="page-context-header enterprise-page-header" aria-label="Enterprise Demand context"><div className="page-context-header-inner">
    <div className="page-context-identity"><span>Enterprise Demand</span><strong>{preview.activeNode.enterpriseName} — {preview.activeNode.plantName}</strong></div>
    <div className="page-context-tabs" aria-label="Enterprise Demand sections">
      {items.map((item) => <button type="button" className={selected === item.id ? "active" : undefined} onClick={() => focus(item.id)} key={item.id}>{item.label}</button>)}
    </div>
  </div></nav>
}

function PageContextHeader({ active }: { active: DashboardTab }) {
  const [selected, setSelected] = useState(0)
  const items = PAGE_CONTEXT_ITEMS[active]

  useEffect(() => setSelected(0), [active])

  function focus(index: number) {
    setSelected(index)
    const content = document.querySelector<HTMLElement>(".platform-content")
    const body = content?.querySelector<HTMLElement>(".x-page-body")
    const accordionTarget = content?.querySelector<HTMLElement>(`[data-dashboard-section-index="${index}"]`)
    if (accordionTarget) {
      const child = accordionTarget.querySelector<HTMLElement>("[id]")
      if (child) requestOutlineFocus(child.id)
    }
    const directTargets = body?.querySelectorAll<HTMLElement>(":scope > section, :scope > article, :scope > div > section, :scope > div > article")
    const target = accordionTarget ?? directTargets?.item(index)
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" })
    else content?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (OUTLINE_MANAGED_TABS.has(active)) return null

  return <nav className="page-context-header" aria-label={`${dashboardDisplayLabel(active)} context`}><div className="page-context-header-inner">
    <div className="page-context-identity"><span>Page</span><strong>{dashboardDisplayLabel(active)}</strong></div>
    <div className="page-context-tabs" aria-label={`${dashboardDisplayLabel(active)} views`}>{items.map((item, index) => <button type="button" className={selected === index ? "active" : undefined} onClick={() => focus(index)} key={item}>{item}</button>)}</div>
    <div className="page-context-actions"><button type="button" onClick={() => focus(Math.max(items.length - 1, 0))}>Source &amp; controls</button></div>
  </div></nav>
}

export function NiaDashboard({ enterpriseDemandPreview = null, financeExpansionPreview = null, controlledAutonomyPreview = null, niaMarginsPreview, newAddsPreview, memberEngagementPreview, memberSavingsPreview, niaGrowthPreview, cashControlPreview = null, financeAllowed = false, liveOpsData, allocationData, liveDespatchEscalations = [], liveDespatchCommitments = [] }: { enterpriseDemandPreview?: EnterpriseDemandLoopPreview | null; financeExpansionPreview?: FinanceExpansionPreview | null; controlledAutonomyPreview?: ControlledAutonomyPreview | null; niaMarginsPreview: NiaMarginsPreview; newAddsPreview: NewAddsPreview; memberEngagementPreview: MemberEngagementPreview; memberSavingsPreview: MemberSavingsPreview; niaGrowthPreview: NiaGrowthPreview; cashControlPreview?: CashControlPreview | null; financeAllowed?: boolean; liveOpsData?: unknown; allocationData?: unknown; liveDespatchEscalations?: readonly DespatchEscalationRecord[]; liveDespatchCommitments?: ExecutionAction[] }) {
  const [active, setActive] = useState<DashboardTab>("Despatch")
  const [workspace, setWorkspace] = useState<DashboardWorkspace>(POST_LOGIN_DASHBOARD_STATE.workspace)
  const [lens, setLens] = useState<OperatingLens>("operate")
  const [decisionRoomOpen, setDecisionRoomOpen] = useState(false)
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("reporting")
  const [livingFocus, setLivingFocus] = useState<LivingSection>()
  const [allocationFocus, setAllocationFocus] = useState<string>()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [commitments, setCommitments] = useState<ExecutionAction[]>(() => [...executionActions, ...memberFeedbackActions])
  // Keep the page shell stable while the Overview mode changes. The mode bar
  // and the report body already explain the active operating view.
  const meta = decisionRoomOpen
    ? { title: "Decision Room", subtitle: "Every decision waiting for you first, then the verified state of every loop.", view: "Decide lens · shadow preview" }
    : screenMeta[active]
  const sectionTitle = decisionRoomOpen ? "Decision Room" : active === "Member Feedback" ? "Member NPS" : active === "Definitions" ? "Learning history" : dashboardDisplayLabel(active)
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
  const platformDespatchQueue = useMemo(() => buildDespatchQueue(liveDespatchEscalations, Number.MAX_SAFE_INTEGER), [liveDespatchEscalations])
  useEffect(() => {
    const storedLens = readStoredOperatingLens()
    if (storedLens === null) return
    setLens(storedLens)
    setDecisionRoomOpen(storedLens === "decide" && workspace === "self-drive")
  }, [workspace])
  useEffect(() => {
    if (active === "Living" && livingFocus) requestAnimationFrame(() => document.getElementById(livingFocus)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [active, livingFocus])

  function navigate(route: DashboardRoute, mismatchId?: string) {
    setDecisionRoomOpen(false)
    setActive(route.screen)
    setLivingFocus(route.subsection)
    setAllocationFocus(mismatchId)
  }

  function switchLens(next: OperatingLens) {
    setLens(next)
    persistOperatingLens(next)
    // Each Self Drive lens owns one explicit landing surface.
    if (workspace === "self-drive" && next === "decide") {
      setDecisionRoomOpen(true)
      return
    }
    setDecisionRoomOpen(false)
    if (workspace === "self-drive" && next === "operate") setActive("Despatch")
  }

  function openDecisionRoom() {
    setLens("decide")
    persistOperatingLens("decide")
    setWorkspace("self-drive")
    setDecisionRoomOpen(true)
  }

  function openWorkspace(next: DashboardWorkspace) {
    setWorkspace(next)
    if (next === "self-drive" && lens === "decide") {
      setDecisionRoomOpen(true)
      return
    }
    setDecisionRoomOpen(false)
    setActive(next === "self-drive" ? "Despatch" : workspaceLandingTab(next))
  }

  function navigateFromRail(nextWorkspace: DashboardWorkspace, tab: DashboardTab) {
    if (nextWorkspace === "self-drive" && tab === "Despatch") {
      setLens("operate")
      persistOperatingLens("operate")
    }
    setWorkspace(nextWorkspace)
    navigate({ screen: tab })
  }

  function submitSearch() {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return
    const destinations: Array<[DashboardWorkspace, DashboardTab, string]> = [
      ["self-drive", "Cash & Control", "cash control collections buffer opex"],
      ["self-drive", "Enterprise Demand", "enterprise demand arrivals capacity"],
      ["self-drive", "New Adds", "member adds vacancy billing"],
      ["self-drive", "Member Engagement", "member engagement retention risk"],
      ["self-drive", "Member Savings", "member savings service margin"],
      ["self-drive", "Nia Margins", "nia margins contribution"],
      ["self-drive", "Nia Growth", "nia growth capacity"],
      ["self-drive", "Despatch", "despatch exceptions actions"],
      ["self-learn", "Overview", "overview continuity"],
      ["self-learn", "Living", "living studio"],
      ["self-learn", "Work", "work income"],
      ["self-learn", "Essentials", "essentials orders stock"],
      ["self-learn", "Member Feedback", "member nps feedback"],
      ["self-learn", "People", "people owner person"],
      ["self-learn", "Definitions", "learning history definitions"],
    ]
    const match = destinations.find(([, , keywords]) => keywords.includes(query) || query.split(/\s+/).every((term) => keywords.includes(term)))
    if (match) navigateFromRail(match[0], match[1])
  }

  async function validateExecutionAction(actionId: string) {
    const response = await fetch("/api/action-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue_item_id: actionId, action_type: "verify", note: "Verified from Despatch" }),
    })
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Action could not be recorded")
    setCommitments((current) => current.map((action) => action.id === actionId
      ? validateActionProof(action, "despatch-validation-team", new Date().toISOString(), `log-${action.id}-despatch-${Date.now()}`)
      : action))
  }

  async function refreshLiveData() {
    if (syncing) return
    setSyncing(true)
    try {
      const response = await fetch("/api/ops-data", { method: "POST", cache: "no-store" })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Source sync failed")
      window.location.reload()
    } catch (error) {
      setSyncing(false)
      window.alert(error instanceof Error ? error.message : "Source sync failed")
    }
  }

  function openFeedbackExecution() {
    setActive("Overview")
    setOverviewMode("execution")
  }

  function openFeedbackDespatch() {
    navigateFromRail("self-drive", "Despatch")
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", redirect: "follow" })
    window.location.assign("/login")
  }

  return <main className="central-shell" data-live-connected={Boolean(liveOpsData)} data-allocation-connected={Boolean(allocationData)}>
    <CentralSidebar active={active} workspace={workspace} lens={lens} decisionRoomActive={decisionRoomOpen} financeAllowed={financeAllowed} enterpriseAllowed={enterpriseDemandPreview !== null} signOffAllowed={controlledAutonomyPreview !== null} open={railOpen} onClose={() => setRailOpen(false)} onWorkspace={openWorkspace} onNavigate={navigateFromRail} onDecisionRoom={openDecisionRoom} onLens={switchLens} onSignOut={signOut} />
    {railOpen ? <button type="button" className="rail-scrim" aria-label="Close navigation" onClick={() => setRailOpen(false)} /> : null}
    <div className={`central-main x-page-shell${active === "Enterprise Demand" ? " enterprise-form-shell" : ""}`}>
    <header className="platform-utility">
      <button type="button" className="mobile-rail-trigger" aria-label="Open navigation" aria-expanded={railOpen} onClick={() => setRailOpen(true)}><Menu aria-hidden /></button>
      {decisionRoomOpen ? null : <>
      <label className="platform-search"><Search aria-hidden /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch() }} placeholder="Search actions, studios or members" aria-label="Search RafiQi Central" /></label>
      <div className="utility-lens" data-lens={lens}>
        <SegmentedControl label="Operating lens" value={lens} onChange={switchLens} options={[{ value: "decide", label: "Decide" }, { value: "operate", label: "Operate" }]} />
      </div>
      <div className="utility-actions">
        <button type="button" className={filtersOpen ? "utility-button active" : "utility-button"} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}><SlidersHorizontal aria-hidden /><span>Filters</span></button>
        <button type="button" className="utility-icon" title="Synthetic shadow preview" aria-label="Synthetic shadow preview"><ShieldCheck aria-hidden /></button>
        <button type="button" className="utility-button period"><CalendarDays aria-hidden /><span>{DASHBOARD_PERIOD}</span></button>
        <button type="button" className="utility-icon" title="Sync all source sheets" aria-label="Sync all source sheets" disabled={syncing} onClick={refreshLiveData}><RefreshCw aria-hidden className={syncing ? "spin" : undefined} /></button>
        <button type="button" className="utility-primary" onClick={() => navigateFromRail("self-drive", "Despatch")}><Truck aria-hidden /><span>Open Despatch</span></button>
      </div>
      </>}
    </header>
    {decisionRoomOpen ? null : <section className="platform-heading"><div><h1>{sectionTitle}</h1><p className="subtitle">{meta.title === sectionTitle ? meta.subtitle : `${meta.title} ${meta.subtitle}`}</p></div><span>{meta.view}</span></section>}
    {!decisionRoomOpen && filtersOpen ? <Filters className="platform-filters" /> : null}
    <div className="platform-workspace x-page-workspace">
    <section className={`content platform-content ${active === "Overview" ? "overview-content" : ""} pillar-${active.toLowerCase().replaceAll(" ", "-")}`}>
      {decisionRoomOpen ? <h1 className="sr-only">Decision Room</h1> : null}
      {!decisionRoomOpen && active !== "Enterprise Demand" ? <PageContextHeader active={active} /> : null}
      {!decisionRoomOpen && active === "Enterprise Demand" && enterpriseDemandPreview && !OUTLINE_MANAGED_TABS.has(active) ? <EnterpriseContextHeader preview={enterpriseDemandPreview} /> : null}
      {!decisionRoomOpen && active !== "Enterprise Demand" ? <ContextStrip label={`${sectionTitle} context`} items={[{ label: "Workspace", value: workspace === "self-drive" ? "Self Drive" : workspace === "self-learn" ? "Self Learn" : "Finance" }, { label: "Page", value: sectionTitle }, { label: "Period / state", value: meta.view }]} /> : null}
      <div className="x-page-body">
      {decisionRoomOpen ? <DecisionRoom
        enterpriseDemandPreview={enterpriseDemandPreview}
        cashControlPreview={cashControlPreview}
        newAddsPreview={newAddsPreview}
        memberEngagementPreview={memberEngagementPreview}
        memberSavingsPreview={memberSavingsPreview}
        niaMarginsPreview={niaMarginsPreview}
        niaGrowthPreview={niaGrowthPreview}
        signOffCount={learningHistory.length}
        period={DASHBOARD_PERIOD}
        onOpenLoop={(tab) => navigateFromRail("self-drive", tab)}
        onOpenSignOff={() => navigateFromRail("self-drive", "Your Sign-Off")}
      /> : <LensProvider lens={lens}>
      {active === "Overview" && <OverviewStory mode={overviewMode} commitments={commitments} loopHealth={platformLoopHealth} onModeChange={setOverviewMode} onNavigate={navigate} />}
      {active === "Cash & Control" && (cashControlPreview ? <CashControlWorkspace preview={cashControlPreview} /> : <section className="restricted-control" aria-label="Restricted Cash and Control"><LockKeyhole aria-hidden /><p className="eyebrow">RESTRICTED CONTROL</p><h2>Cash &amp; Control is available to authorised Finance users.</h2><p>Operating teams can continue through the remaining Self Drive tabs. Financial goals, cash, opex and leakage remain protected.</p></section>)}
      {active === "Enterprise Demand" && enterpriseDemandPreview && <EnterpriseDemandWorkspace preview={enterpriseDemandPreview} />}
      {active === "New Adds" && <NewAddsWorkspace preview={newAddsPreview} />}
      {active === "Member Engagement" && <MemberEngagementWorkspace preview={memberEngagementPreview} />}
      {active === "Member Savings" && <MemberSavingsWorkspace preview={memberSavingsPreview} />}
      {active === "Nia Growth" && <NiaGrowthWorkspace preview={niaGrowthPreview} />}
      {active === "Finance control" && financeExpansionPreview && <FinanceExpansionWorkspace preview={financeExpansionPreview} />}
      {active === "Your Sign-Off" && controlledAutonomyPreview && <ControlledAutonomyWorkspace preview={controlledAutonomyPreview} />}
      {active === "Nia Margins" && <NiaMarginsWorkspace preview={niaMarginsPreview} />}
      {active === "Living" && <LivingScreen focus={livingFocus} allocationFocus={allocationFocus} liveOpsData={liveOpsData} />}
      {active === "Work" && <WorkScreen />}
      {active === "Essentials" && <EssentialsScreen allocationFocus={allocationFocus} liveData={liveOpsData ? { dashboard: liveRows(liveOpsData, "essentialsDashboard"), cohorts: liveRows(liveOpsData, "essentialsCohorts"), inventory: liveRows(liveOpsData, "essentialsInventory") } : null} />}
      {active === "People" && <PeopleScreen commitments={commitments} liveData={liveOpsData ? { dashboard: liveRows(liveOpsData, "peopleDashboard"), performance: liveRows(liveOpsData, "peoplePerformance"), followThrough: liveRows(liveOpsData, "peopleFollowThrough"), roster: liveRows(liveOpsData, "people") } : null} />}
      {active === "Member Feedback" && (liveOpsData ? <LiveBackendTables title="Member NPS" groups={[{ label: "NPS dashboard", rows: liveRows(liveOpsData, "memberNpsDashboard") }, { label: "Member feedback", rows: liveRows(liveOpsData, "memberNpsFeedback") }, { label: "NPS responses", rows: liveRows(liveOpsData, "memberNpsResponses") }]} /> : <LiveBackendTables title="Member NPS" groups={[]} />)}
      {active === "Definitions" && <LearningHistoryWorkspace entries={learningHistory} />}
      {active === "Despatch" && <DespatchScreen commitments={liveDespatchCommitments} escalations={platformDespatchQueue.visible} escalationTotal={platformDespatchQueue.totalOpen} onValidateAction={validateExecutionAction} />}
      {active === "Economics" && (liveOpsData ? <LiveBackendTables title="Economics" groups={[{ label: "Finance daily", rows: liveRows(liveOpsData, "finance") }, { label: "Studio master", rows: liveRows(liveOpsData, "studios") }]} /> : <LiveBackendTables title="Economics" groups={[]} />)}
      </LensProvider>}
      </div>
    </section></div>
    </div></main>
}
