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
import { FinanceExpansionWorkspace } from "@/components/finance-expansion-workspace"
import { ControlledAutonomyWorkspace } from "@/components/controlled-autonomy-workspace"
import { MemberFeedbackScreen } from "@/components/member-feedback-screen"
import { OverviewStory, type OverviewMode } from "@/components/overview/overview-story"
import { WorkScreen } from "@/components/work-screen"
import { BusinessReportScreen } from "@/components/business-report-screen"
import { LiveOverviewWorkspace, LiveSheetWorkspace } from "@/components/live-sheet-workspace"
import { EnterpriseLeadWorkspace } from "@/components/enterprise-lead-workspace"
import { NiaMarginsWorkspace } from "@/components/nia-margins-workspace"
import { NewAddsWorkspace } from "@/components/new-adds-workspace"
import { MemberEngagementWorkspace } from "@/components/member-engagement-workspace"
import { MemberSavingsWorkspace } from "@/components/member-savings-workspace"
import { NiaGrowthWorkspace } from "@/components/nia-growth-workspace"
import { CashControlWorkspace } from "@/components/cash-control-workspace"
import { LearningHistoryWorkspace, type LearningHistoryEntry } from "@/components/learning-history-workspace"
import { ContextStrip, SegmentedControl } from "@/components/operating-ui"
import { dashboardDisplayLabel, FINANCE_TABS, POST_LOGIN_DASHBOARD_STATE, SELF_LEARN_TABS, TABLE_SCREENS, workspaceLandingTab, type DashboardRoute, type DashboardTab, type DashboardWorkspace, type LivingSection } from "@/lib/dashboard-model"
import { executionActions } from "@/lib/execution-data"
import { memberFeedbackActions } from "@/lib/member-feedback-data"
import type { MemberFeedbackItem, NpsResponse } from "@/lib/member-feedback"
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
  "Cash & Control": { title: "Set the destination. Let Nia run the month.", subtitle: "Approve the goal once; Nia allocates, recovers and verifies the work while protecting cash.", view: "Governed live data" },
  "Enterprise Demand": { title: "Enterprise Demand", subtitle: "Turn every signed arrival into a verified 2 km, then 5 km capacity loop.", view: "Governed live data" },
  "New Adds": { title: "Fill every FONO vacancy with verified billing-live Members.", subtitle: "Detect vacancies, choose the lowest-cost eligible channel, assign the fill and verify billing.", view: "Governed live data" },
  "Member Engagement": { title: "Keep Members by removing the friction that makes them leave.", subtitle: "Detect risk early, repair the cause and count only verified recovery.", view: "Governed live data" },
  "Member Savings": { title: "Every service must save the Member and pay Nia.", subtitle: "Protect the dual gate, repair attach and repeat gaps, and keep savings claims verified.", view: "Governed live data" },
  "Nia Growth": { title: "Add capacity where demand supports it.", subtitle: "Keep FONO and Śram Park separate and expose capital risk before any commitment.", view: "Governed live data" },
  "Your Sign-Off": { title: "Your Sign-Off", subtitle: "Only material changes and unresolved exceptions wait here for a human decision.", view: "Pending decisions" },
  "Finance control": { title: "Control capital before expansion commits it.", subtitle: "Compare Studio economics, enforce cash and opex guardrails, route exceptions, and close War Room cases only after independent verification.", view: "Governed live data" },
  "Nia Margins": { title: "Nia Margins", subtitle: "Protect the margin behind every verified Member outcome.", view: "Governed live data" },
  Overview: { title: "Making Leaving Home Worth It.", subtitle: "Nia is the Migrant Worker Continuity Platform. Living, Work and Essentials operate as one flywheel for people who leave home for work.", view: "This month · every 2 hours" },
  Living: { title: "Community Living and Well-Being.", subtitle: "Create a safe, connected community where Members can live well and thrive.", view: "This month · every 2 hours" },
  Work: { title: "Enable upskilling and higher incomes.", subtitle: "Connect Members to skills, better work, and sustained income growth.", view: "Data needed" },
  Essentials: TABLE_SCREENS.Essentials,
  "Business Report": { title: "Business Report", subtitle: "One live board view across occupancy, contribution, FONO, Enterprise Demand and Essentials.", view: "Live · governed sources" },
  Economics: TABLE_SCREENS.Economics,
  People: TABLE_SCREENS.People,
  "Member Feedback": { title: "Fix the signal before a Member exits.", subtitle: "Turn feedback and monthly NPS into named actions, proof and verified closure.", view: "Governed live data" },
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
  "Business Report": ["Board summary", "Occupancy", "Contribution margin", "FONO pipeline", "Enterprise Demand", "Essentials", "Sources"],
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
  "Overview",
  "Cash & Control", "Enterprise Demand", "New Adds", "Member Engagement",
  "Member Savings", "Nia Margins", "Nia Growth", "Your Sign-Off",
  "Finance control", "Living", "Work", "Essentials", "Economics", "People",
  "Member Feedback", "Definitions", "Despatch",
  "Business Report",
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

export function NiaDashboard({ liveOpsData, memberFeedbackItems = [], memberNpsResponses = [], enterpriseDemandPreview = null, financeExpansionPreview = null, controlledAutonomyPreview = null, niaMarginsPreview, newAddsPreview, memberEngagementPreview = null, memberSavingsPreview, niaGrowthPreview, cashControlPreview = null, financeAllowed = false, initialActive = "Despatch", restoreStoredPage = true, onControlTower }: { liveOpsData: any; memberFeedbackItems?: readonly MemberFeedbackItem[]; memberNpsResponses?: NpsResponse[]; enterpriseDemandPreview?: EnterpriseDemandLoopPreview | null; financeExpansionPreview?: FinanceExpansionPreview | null; controlledAutonomyPreview?: ControlledAutonomyPreview | null; niaMarginsPreview: NiaMarginsPreview; newAddsPreview: NewAddsPreview; memberEngagementPreview?: MemberEngagementPreview | null; memberSavingsPreview: MemberSavingsPreview; niaGrowthPreview: NiaGrowthPreview; cashControlPreview?: CashControlPreview | null; financeAllowed?: boolean; initialActive?: DashboardTab; restoreStoredPage?: boolean; onControlTower?: () => void }) {
  const dashboardPeriod = liveOpsData?.meta?.month || (liveOpsData?.meta?.updatedAt ? new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(liveOpsData.meta.updatedAt)) : "Current period")
  const dataAsOf = liveOpsData?.meta?.updatedAt ?? liveOpsData?.fetchedAt ?? "Not recorded"
  const registryValue = (row: Record<string, unknown>, key: string) => {
    const normalized = key.toLowerCase().replaceAll("_", " ")
    const match = Object.keys(row).find((candidate) => candidate.toLowerCase().replaceAll("_", " ") === normalized)
    return String(match ? row[match] ?? "" : "").trim()
  }
  const registeredSavingsOwner = (liveOpsData?.ownerRegistry ?? []).find((row: Record<string, unknown>) => {
    const identity = ["assignment id", "vertical", "scope", "business responsibility"].map((key) => registryValue(row, key)).join(" ").toLowerCase()
    return registryValue(row, "status").toLowerCase() === "active" && registryValue(row, "role type").toLowerCase().includes("owner") && identity.includes("essential") && identity.includes("supply")
  })
  const registeredSavingsOwnerName = registeredSavingsOwner ? registryValue(registeredSavingsOwner, "owner name") : ""
  const savingsOwner = memberSavingsPreview.summary.owner && memberSavingsPreview.summary.owner.toLowerCase() !== "unassigned" ? memberSavingsPreview.summary.owner : registeredSavingsOwnerName || "Unassigned"
  const memberSavingsDisplay = savingsOwner === memberSavingsPreview.summary.owner ? memberSavingsPreview : { ...memberSavingsPreview, summary: { ...memberSavingsPreview.summary, owner: savingsOwner } }
  const registeredFinanceRow = (liveOpsData?.ownerRegistry ?? []).find((row: Record<string, unknown>) => registryValue(row, "status").toLowerCase() === "active" && registryValue(row, "role type").toLowerCase().includes("owner") && registryValue(row, "vertical").toLowerCase() === "finance")
  const registeredFinanceOwner = registeredFinanceRow ? registryValue(registeredFinanceRow, "owner name") : ""
  const [active, setActive] = useState<DashboardTab>(initialActive)
  const [workspace, setWorkspace] = useState<DashboardWorkspace>(POST_LOGIN_DASHBOARD_STATE.workspace)
  const [lens, setLens] = useState<OperatingLens>("operate")
  const [decisionRoomOpen, setDecisionRoomOpen] = useState(false)
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("reporting")
  const [livingFocus, setLivingFocus] = useState<LivingSection>()
  const [allocationFocus, setAllocationFocus] = useState<string>()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [commitments, setCommitments] = useState<ExecutionAction[]>([])
  useEffect(() => {
    const storedActive = window.sessionStorage.getItem("rafiqi-dashboard-page") as DashboardTab | null
    const storedWorkspace = window.sessionStorage.getItem("rafiqi-dashboard-workspace") as DashboardWorkspace | null
    // A direct launch from Control Tower is an explicit navigation request and
    // must not be overwritten by the page visited in an earlier dashboard
    // session. Standalone dashboard reloads still restore their last page.
    const restoredActive = restoreStoredPage ? storedActive || initialActive : initialActive
    const inferredWorkspace: DashboardWorkspace = (SELF_LEARN_TABS as readonly string[]).includes(restoredActive)
      ? "self-learn"
      : (FINANCE_TABS as readonly string[]).includes(restoredActive) ? "finance" : "self-drive"
    setActive(restoredActive)
    setWorkspace(storedWorkspace === inferredWorkspace ? storedWorkspace : inferredWorkspace)
  }, [initialActive, restoreStoredPage])
  useEffect(() => {
    window.sessionStorage.setItem("rafiqi-dashboard-page", active)
    window.sessionStorage.setItem("rafiqi-dashboard-workspace", workspace)
  }, [active, workspace])
  // Keep the page shell stable while the Overview mode changes. The mode bar
  // and the report body already explain the active operating view.
  const meta = decisionRoomOpen
    ? { title: "Decision Room", subtitle: "Every decision waiting for you first, then the verified state of every loop.", view: "Decide lens · shadow preview" }
    : screenMeta[active]
  const sectionTitle = decisionRoomOpen ? "Decision Room" : active === "Member Feedback" ? "Member NPS" : active === "Definitions" ? "Learning history" : dashboardDisplayLabel(active)
  const learningHistory: readonly LearningHistoryEntry[] = (controlledAutonomyPreview?.learningQueue ?? []).map((entry) => ({
    domain: entry.domain || "Operations",
    observed: entry.observed || "Governed observation recorded",
    proposedChange: entry.proposedChange,
    expectedEffect: entry.expectedEffect,
    attribution: entry.evaluation.attributionLabel || "Observed",
    confidence: entry.evaluation.confidence || "Unconfirmed",
    disposition: entry.evaluation.requiredDisposition,
  }))
  const platformLoopHealth = useMemo(() => aggregateLoopHealth([
    ...(enterpriseDemandPreview ? [{ domain: "Enterprise Demand" as const, health: enterpriseDemandPreview.loopHealth }] : []),
    { domain: "New Adds" as const, health: newAddsPreview.loopHealth },
    ...(memberEngagementPreview ? [{ domain: "Member Engagement" as const, health: memberEngagementPreview.loopHealth }] : []),
    { domain: "Member Savings" as const, health: memberSavingsPreview.loopHealth },
    { domain: "Nia Margins" as const, health: niaMarginsPreview.loopHealth },
    { domain: "Nia Growth" as const, health: niaGrowthPreview.loopHealth },
    ...(cashControlPreview ? [{ domain: "Cash & Control" as const, health: cashControlPreview.loopHealth }] : []),
  ]), [cashControlPreview, enterpriseDemandPreview, memberEngagementPreview, memberSavingsPreview.loopHealth, newAddsPreview.loopHealth, niaGrowthPreview.loopHealth, niaMarginsPreview.loopHealth])
  const platformDespatchQueue = useMemo(() => buildDespatchQueue([
    ...(enterpriseDemandPreview?.despatchEscalations ?? []),
    ...newAddsPreview.despatchEscalations,
    ...(memberEngagementPreview?.despatchEscalations ?? []),
    ...memberSavingsPreview.despatchEscalations,
    ...niaMarginsPreview.despatchEscalations,
    ...niaGrowthPreview.despatchEscalations,
    ...(cashControlPreview?.despatchEscalations ?? []),
  ], Number.MAX_SAFE_INTEGER), [cashControlPreview, enterpriseDemandPreview, memberEngagementPreview, memberSavingsPreview.despatchEscalations, newAddsPreview.despatchEscalations, niaGrowthPreview.despatchEscalations, niaMarginsPreview.despatchEscalations])
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
    // In the Control Tower shell the Decide lens is the MANNED overview,
    // matching the approved navigation flow. The standalone dashboard keeps
    // its explicit Decision Room destination below.
    if (next === "decide" && onControlTower) {
      onControlTower()
      return
    }
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
      ["self-learn", "Business Report", "business report board summary enterprise occupancy fono cm"],
      ["self-learn", "Member Feedback", "member nps feedback"],
      ["self-learn", "People", "people owner person"],
      ["self-learn", "Definitions", "learning history definitions"],
    ]
    const match = destinations.find(([, , keywords]) => keywords.includes(query) || query.split(/\s+/).every((term) => keywords.includes(term)))
    if (match) navigateFromRail(match[0], match[1])
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
    navigateFromRail("self-drive", "Despatch")
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", redirect: "follow" })
    window.location.assign("/login")
  }

  return <main className="central-shell">
    <CentralSidebar active={active} workspace={workspace} lens={lens} decisionRoomActive={decisionRoomOpen} financeAllowed={financeAllowed} enterpriseAllowed={true} signOffAllowed={controlledAutonomyPreview !== null} open={railOpen} onClose={() => setRailOpen(false)} onWorkspace={openWorkspace} onNavigate={navigateFromRail} onDecisionRoom={openDecisionRoom} onLens={switchLens} onControlTower={onControlTower} onSignOut={signOut} />
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
        <button type="button" className="utility-icon" title="Governed live data" aria-label="Governed live data"><ShieldCheck aria-hidden /></button>
        <button type="button" className="utility-button period"><CalendarDays aria-hidden /><span>{dashboardPeriod}</span></button>
        <button type="button" className="utility-icon" title="Refresh data" aria-label="Refresh data" onClick={() => window.dispatchEvent(new Event("rafiqi:sync-now"))}><RefreshCw aria-hidden /></button>
        <button type="button" className="utility-primary" onClick={() => navigateFromRail("self-drive", "Despatch")}><Truck aria-hidden /><span>Open Despatch</span></button>
      </div>
      </>}
    </header>
    {decisionRoomOpen ? null : <section className="platform-heading"><div><h1>{sectionTitle}</h1><p className="subtitle">{meta.title === sectionTitle ? meta.subtitle : `${meta.title} ${meta.subtitle}`}</p></div><span>{meta.view}</span></section>}
    {!decisionRoomOpen && filtersOpen ? <Filters className="platform-filters" /> : null}
    <div className="platform-workspace x-page-workspace">
    <section className={`content platform-content ${active === "Overview" ? "overview-content" : ""} pillar-${active.toLowerCase().replaceAll(" ", "-")}`}>
      {decisionRoomOpen ? <h1 className="sr-only">Decision Room</h1> : null}
      {!decisionRoomOpen ? active !== "Enterprise Demand" ? <PageContextHeader active={active} /> : null : null}
      {!decisionRoomOpen ? <ContextStrip label={`${sectionTitle} context`} items={[{ label: "Workspace", value: workspace === "self-drive" ? "Self Drive" : workspace === "self-learn" ? "Self Learn" : "Finance" }, { label: "Page", value: sectionTitle }, { label: "Period / state", value: meta.view }]} /> : null}
      <div className="x-page-body">
      {decisionRoomOpen ? <DecisionRoom
        enterpriseDemandPreview={enterpriseDemandPreview}
        cashControlPreview={cashControlPreview}
        newAddsPreview={newAddsPreview}
        memberEngagementPreview={memberEngagementPreview}
        memberSavingsPreview={memberSavingsDisplay}
        niaMarginsPreview={niaMarginsPreview}
        niaGrowthPreview={niaGrowthPreview}
        signOffCount={learningHistory.length}
        period={dashboardPeriod}
        onOpenLoop={(tab) => navigateFromRail("self-drive", tab)}
        onOpenSignOff={() => navigateFromRail("self-drive", "Your Sign-Off")}
      /> : <LensProvider lens={lens}>
      {active === "Overview" && <OverviewStory mode={overviewMode} commitments={commitments} loopHealth={platformLoopHealth} liveOpsData={liveOpsData} onModeChange={setOverviewMode} onNavigate={navigate} />}
      {active === "Cash & Control" && (cashControlPreview ? <CashControlWorkspace preview={cashControlPreview} /> : <section className="restricted-control" aria-label="Restricted Cash and Control"><LockKeyhole aria-hidden /><p className="eyebrow">RESTRICTED CONTROL</p><h2>Cash &amp; Control is available to authorised Finance users.</h2><p>Operating teams can continue through the remaining Self Drive tabs. Financial goals, cash, opex and leakage remain protected.</p></section>)}
      {active === "Enterprise Demand" && <EnterpriseLeadWorkspace rows={liveOpsData?.enterpriseWorkspaceDemand ?? []} asOf={dataAsOf} />}
      {active === "New Adds" && <NewAddsWorkspace preview={newAddsPreview} />}
      {active === "Member Engagement" && (memberEngagementPreview ? <MemberEngagementWorkspace preview={memberEngagementPreview} /> : <LiveSheetWorkspace kind="Member Feedback" rows={(liveOpsData?.incidentLog ?? []).filter((row: any) => String(row.domain ?? "").toLowerCase().includes("engagement"))} secondaryRows={liveOpsData?.memberNpsResponses ?? []} asOf={dataAsOf} />)}
      {active === "Member Savings" && <MemberSavingsWorkspace preview={memberSavingsDisplay} />}
      {active === "Nia Growth" && <NiaGrowthWorkspace preview={niaGrowthPreview} />}
      {active === "Finance control" && financeExpansionPreview && <FinanceExpansionWorkspace preview={financeExpansionPreview} />}
      {active === "Your Sign-Off" && controlledAutonomyPreview && <ControlledAutonomyWorkspace preview={controlledAutonomyPreview} />}
      {active === "Nia Margins" && <NiaMarginsWorkspace preview={niaMarginsPreview} owner={registeredFinanceOwner || "Finance JCO"} />}
      {active === "Living" && <LivingScreen focus={livingFocus} allocationFocus={allocationFocus} liveOpsData={liveOpsData} />}
      {active === "Work" && <WorkScreen liveRows={liveOpsData?.work ?? []} />}
      {active === "Essentials" && <EssentialsScreen allocationFocus={allocationFocus} liveData={{ dashboard: liveOpsData?.essentialsDashboard ?? [], hourly: liveOpsData?.essentials ?? [], cohorts: liveOpsData?.essentialsCohorts ?? [], inventory: liveOpsData?.essentialsInventory ?? [] }} />}
      {active === "Business Report" && <BusinessReportScreen liveOpsData={liveOpsData} />}
      {active === "People" && <PeopleScreen commitments={commitments} liveData={{ dashboard: liveOpsData?.peopleDashboard ?? [], performance: liveOpsData?.peoplePerformance ?? [], followThrough: liveOpsData?.peopleFollowThrough ?? [], roster: liveOpsData?.people ?? [] }} />}
      {active === "Member Feedback" && <MemberFeedbackScreen actions={commitments} items={memberFeedbackItems} responses={memberNpsResponses} sourceAsOf={String(liveOpsData?.fetchedAt ?? "")} onOpenExecution={openFeedbackExecution} onOpenDespatch={openFeedbackDespatch} />}
      {active === "Definitions" && <LearningHistoryWorkspace entries={learningHistory} />}
      {active === "Despatch" && <DespatchScreen commitments={commitments} escalations={platformDespatchQueue.visible} escalationTotal={platformDespatchQueue.totalOpen} loopHealth={platformLoopHealth} onValidateAction={validateExecutionAction} />}
      {active === "Economics" && <LiveSheetWorkspace kind="Economics" rows={liveOpsData?.finance ?? []} secondaryRows={liveOpsData?.essentialsInventory ?? []} asOf={dataAsOf} allocationFocus={allocationFocus} />}
      </LensProvider>}
      </div>
    </section></div>
    </div></main>
}
