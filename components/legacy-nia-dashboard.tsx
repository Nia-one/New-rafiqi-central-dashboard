"use client"

import { useEffect, useState } from "react"
import { CalendarDays, ChevronDown, LogOut, Menu, Paperclip, UserPlus, X } from "lucide-react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { AttachSlopeChart } from "@/components/charts/attach-slope-chart"
import { CmBridgeChart } from "@/components/charts/cm-bridge-chart"
import { PeopleInterventionChart } from "@/components/charts/people-intervention-chart"
import { StudioArpuChart } from "@/components/charts/studio-arpu-chart"
import { DataTable } from "@/components/data-table"
import { LivingScreen } from "@/components/living-screen"
import { EssentialsScreen } from "@/components/essentials-screen"
import { PeopleScreen } from "@/components/people-screen"
import { LegacyScoutersJourneyPlan } from "@/components/legacy-scouters-journey-plan"
import { DespatchScreen } from "@/components/despatch-screen"
import { MemberFeedbackScreen } from "@/components/member-feedback-screen"
import { OverviewStory, type OverviewMode } from "@/components/overview/overview-story"
import { WorkScreen } from "@/components/work-screen"
import { LEGACY_DASHBOARD_TABS, TABLE_SCREENS, type DashboardRoute, type LegacyDashboardRoute, type LegacyDashboardTab, type LivingSection } from "@/lib/dashboard-model"
import { executionActions } from "@/lib/execution-data"
import { memberFeedbackActions } from "@/lib/member-feedback-data"
import { validateActionProof, type ExecutionAction } from "@/lib/execution-control"
import { laneHeadline } from "@/lib/ops-data"

const screenMeta: Record<LegacyDashboardTab, { title: string; subtitle: string; view: string }> = {
  "Operations Mandate": { title: "Turn insight into a field route.", subtitle: "Scouter’s Journey Plan turns demand, supply and location context into named actions with verified closure.", view: "Today · live mandate" },
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

function Filters() {
  return <div className="filters" aria-label="Dashboard filters">{["Theatre: All", "Location: All", "Studio: All", "Person: All"].map((label) => <button key={label}>{label}<ChevronDown aria-hidden /></button>)}</div>
}

function TableScreen({ tab, allocationFocus }: { tab: keyof typeof TABLE_SCREENS; allocationFocus?: string }) {
  const data = TABLE_SCREENS[tab]
  return <>
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
  </>
}

export function LegacyNiaDashboard() {
  const [active, setActive] = useState<LegacyDashboardTab>("Operations Mandate")
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("reporting")
  const [livingFocus, setLivingFocus] = useState<LivingSection>()
  const [allocationFocus, setAllocationFocus] = useState<string>()
  const [open, setOpen] = useState(false)
  const [commitments, setCommitments] = useState<ExecutionAction[]>(() => [...executionActions, ...memberFeedbackActions])
  // Keep the page shell stable while the Overview mode changes. The mode bar
  // and the report body already explain the active operating view.
  const meta = screenMeta[active]

  useEffect(() => {
    if (active === "Living" && livingFocus) requestAnimationFrame(() => document.getElementById(livingFocus)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [active, livingFocus])

  function navigate(route: DashboardRoute | LegacyDashboardRoute, mismatchId?: string) {
    if (!(LEGACY_DASHBOARD_TABS as readonly string[]).includes(route.screen)) return
    setActive(route.screen as LegacyDashboardTab)
    setLivingFocus(route.subsection)
    setAllocationFocus(mismatchId)
    setOpen(false)
  }

  function validateExecutionAction(actionId: string) {
    setCommitments((current) => current.map((action) => action.id === actionId
      ? validateActionProof(action, "despatch-validation-team", new Date().toISOString(), `log-${action.id}-despatch-${Date.now()}`)
      : action))
  }

  function openFeedbackExecution() {
    setActive("Overview")
    setOverviewMode("execution")
    setOpen(false)
  }

  function openFeedbackDespatch() {
    setActive("Despatch")
    setOpen(false)
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", redirect: "follow" })
    window.location.assign("/login")
  }

  return <main>
    <header className="hero"><div><p className="eyebrow">Nia Control Center</p><h1>{meta.title}</h1><p className="subtitle">{meta.subtitle}</p></div><div className="controls"><div className="freshness"><span>DATA UPDATED</span><strong><i /> 14:00 IST</strong></div><button className="view"><small>PERIOD</small><strong>{meta.view}</strong><ChevronDown aria-hidden /></button><button className="date"><CalendarDays aria-hidden />Jul 2026<ChevronDown aria-hidden /></button><button className="upload"><Paperclip aria-hidden />Data refresh</button><button className="upload" onClick={signOut}><LogOut aria-hidden />Sign out</button></div></header>
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="dashboard-navigation">{open ? <X aria-hidden /> : <Menu aria-hidden />}<span>Navigate</span></button>
    <nav id="dashboard-navigation" className={open ? "nav open" : "nav"} aria-label="Dashboard screens">{LEGACY_DASHBOARD_TABS.map((item) => <button key={item} className={`${active === item ? "active" : ""}${item === "Despatch" ? " despatch-nav" : ""}`} aria-current={active === item ? "page" : undefined} onClick={() => navigate({ screen: item })}><span>{item}</span></button>)}<Filters /></nav>
    <section className={`content ${active === "Overview" ? "overview-content" : ""} pillar-${active.toLowerCase().replaceAll(" ", "-")}`}>
      {active === "Overview" && <OverviewStory mode={overviewMode} commitments={commitments} onModeChange={setOverviewMode} onNavigate={navigate} />}
      {active === "Operations Mandate" && <LegacyScoutersJourneyPlan />}
      {active === "Living" && <LivingScreen focus={livingFocus} allocationFocus={allocationFocus} />}
      {active === "Work" && <WorkScreen />}
      {active === "Essentials" && <EssentialsScreen allocationFocus={allocationFocus} />}
      {active === "People" && <PeopleScreen commitments={commitments} />}
      {active === "Member Feedback" && <MemberFeedbackScreen actions={commitments} onOpenExecution={openFeedbackExecution} onOpenDespatch={openFeedbackDespatch} />}
      {active === "Despatch" && <DespatchScreen commitments={commitments} onValidateAction={validateExecutionAction} />}
      {(active === "Economics" || active === "Definitions") && <TableScreen tab={active} allocationFocus={allocationFocus} />}
    </section>
    <button className="nia-mark" aria-label="Nia home" onClick={() => navigate({ screen: "Overview" })}>N</button>
  </main>
}
