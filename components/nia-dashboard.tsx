"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { dashboardDisplayLabel, OPERATIONS_TABS, POST_LOGIN_DASHBOARD_STATE, SELF_LEARN_TABS, TABLE_SCREENS, workspaceLandingTab, type DashboardRoute, type DashboardTab, type DashboardWorkspace } from "@/lib/dashboard-model"
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
import { aggregateLoopHealth } from "@/lib/operating-loop/runtime-contracts"
import { buildLoopHealth, type LoopHealth, type LoopHealthFeedInput } from "@/lib/operating-loop/loop-health"
import { contentValue, type DashboardContent } from "@/lib/dashboard-content"
import { buildLiveSelfDriveSnapshot, filterLiveSelfDriveSnapshot, type LiveSelfDriveFilters } from "@/lib/live-mappers/self-drive"

const screenMeta: Record<DashboardTab, { title: string; subtitle: string; view: string }> = {
  "Cash & Control": { title: "Set the destination. Let Nia run the month.", subtitle: "Approve the goal once; Nia allocates, recovers and verifies the work while protecting cash.", view: "Shadow mode Â· synthetic fixture" },
  "Enterprise Demand": { title: "Enterprise Demand", subtitle: "Turn every signed arrival into a verified 2 km, then 5 km capacity loop.", view: "Shadow mode Â· synthetic fixture" },
  "New Adds": { title: "Fill contracted FONO and Shram Park Nest potential with Members.", subtitle: "Track contracted/onboarded supply against current occupancy; existing Studios remain separate.", view: "Shadow mode Â· synthetic fixture" },
  "Member Engagement": { title: "Keep Members by removing the friction that makes them leave.", subtitle: "Detect risk early, repair the cause and count only verified recovery.", view: "Shadow mode Â· synthetic fixture" },
  "Member Savings": { title: "Every service must save the Member and pay Nia.", subtitle: "Protect the dual gate, repair attach and repeat gaps, and keep savings claims verified.", view: "Shadow mode Â· synthetic fixture" },
  "Nia Growth": { title: "Add capacity where demand supports it.", subtitle: "Keep FONO and Shram Park separate and expose capital risk before any commitment.", view: "Shadow mode Â· synthetic fixture" },
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

type FilterOption = { value: string; label: string }

function DashboardFilter({ label, value, options, onChange }: { label: string; value: string; options: readonly FilterOption[]; onChange: (value: string) => void }) {
  const details = useRef<HTMLDetailsElement>(null)
  const selected = options.find((option) => option.value === value)?.label || "All"
  const choose = (nextValue: string) => {
    onChange(nextValue)
    details.current?.removeAttribute("open")
  }
  return <details className="dashboard-filter" ref={details}>
    <summary aria-label={`${label} filter`}><span>{label}:</span><strong>{selected}</strong><ChevronDown aria-hidden /></summary>
    <div className="dashboard-filter-menu" role="listbox" aria-label={`${label} options`}>
      <button type="button" className={!value ? "selected" : ""} role="option" aria-selected={!value} onClick={() => choose("")}>All</button>
      {options.map((option) => <button type="button" key={option.value} className={value === option.value ? "selected" : ""} role="option" aria-selected={value === option.value} onClick={() => choose(option.value)}>{option.label}</button>)}
    </div>
  </details>
}

function Filters({ className = "", value, options, onChange }: { className?: string; value: LiveSelfDriveFilters; options: Record<keyof LiveSelfDriveFilters, readonly FilterOption[]>; onChange: (key: keyof LiveSelfDriveFilters, value: string) => void }) {
  const labels: Record<keyof LiveSelfDriveFilters, string> = { theatre: "Theatre", location: "Location", studio: "Studio", person: "Person" }
  return <div className={`filters ${className}`.trim()} aria-label="Dashboard filters">{(Object.keys(labels) as (keyof LiveSelfDriveFilters)[]).map((key) => <DashboardFilter key={key} label={labels[key]} value={value[key]} options={options[key]} onChange={(nextValue) => onChange(key, nextValue)} />)}</div>
}

type LiveRow = Record<string, unknown>

const LIVE_OVERVIEW_CADENCE_MINUTES = 120

function liveValue(row: LiveRow, names: readonly string[]) {
  const normalised = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]))
  for (const name of names) {
    const value = normalised[name.toLowerCase()]
    if (value !== undefined && value !== null && String(value).trim()) return value
  }
  return ""
}

function validDate(value: unknown) {
  const date = String(value ?? "").trim()
  return date && Number.isFinite(Date.parse(date)) ? date : ""
}

function isInDashboardMonth(row: LiveRow, dashboardMonth: unknown) {
  const period = String(dashboardMonth ?? "").trim()
  const periodMatch = period.match(/^([A-Za-z]+)\s+(\d{4})$/)
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
  const expectedMonth = periodMatch ? monthNames.indexOf(periodMatch[1].toLowerCase()) : -1
  const expectedYear = periodMatch ? Number(periodMatch[2]) : Number.NaN
  const rowDate = validDate(liveValue(row, ["opened at", "updated at", "source updated at", "submitted at", "created at", "event at", "date", "period start", "timestamp", "month"]))
  if (expectedMonth < 0 || !Number.isFinite(expectedYear) || !rowDate) return false
  const actual = new Date(rowDate)
  return actual.getUTCFullYear() === expectedYear && actual.getUTCMonth() === expectedMonth
}

function filterRowsByPeriod(rows: readonly LiveRow[] | undefined, period: string) {
  if (!rows || period === "All") return rows
  return rows.filter((row) => {
    const dateValue = liveValue(row, ["opened at", "updated at", "source updated at", "submitted at", "created at", "event at", "date", "period start", "timestamp"])
    return Boolean(dateValue) && isInDashboardMonth(row, period)
  })
}

function periodOptions(rows: readonly LiveRow[]) {
  const months = new Set(rows.map((row) => validDate(liveValue(row, ["opened at", "updated at", "source updated at", "submitted at", "created at", "event at", "date", "period start", "timestamp", "month"])))
    .filter(Boolean)
    .map((date) => { const value = new Date(date); return `${value.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${value.getUTCFullYear()}` }));
  return ["All", ...Array.from(months).sort((left, right) => Date.parse(`1 ${right}`) - Date.parse(`1 ${left}`))];
}

function newestLiveTimestamp(rows: readonly LiveRow[]) {
  return rows
    .flatMap((row) => [
      liveValue(row, ["updated at", "captured at", "source updated at", "submitted at", "proposed at", "created at"]),
    ])
    .map(validDate)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? ""
}

/**
 * The Overview is a roll-up, not another manually maintained dashboard.  Its
 * health strip is calculated only from the data returned by the connected
 * Google Sheet tabs.  Preview loop health remains only as an offline fallback
 * when no Sheet dataset has loaded at all.
 */
export function liveOverviewLoopHealth(liveData: any, fallback: LoopHealth): LoopHealth {
  if (!liveData || typeof liveData !== "object") return fallback

  const sources: Array<{ id: string; label: string; rows: LiveRow[]; critical?: boolean }> = [
    { id: "enterprise-demand", label: "Enterprise Demand", rows: Array.isArray(liveData.enterpriseDemand) ? liveData.enterpriseDemand : [], critical: true },
    { id: "living", label: "Living", rows: Array.isArray(liveData.living) ? liveData.living : [], critical: true },
    { id: "work", label: "Work", rows: Array.isArray(liveData.work) ? liveData.work : [] },
    { id: "essentials", label: "Essentials", rows: Array.isArray(liveData.essentials) ? liveData.essentials : [], critical: true },
    { id: "finance", label: "Finance", rows: Array.isArray(liveData.finance) ? liveData.finance : [], critical: true },
    { id: "people", label: "People", rows: Array.isArray(liveData.people) ? liveData.people : Array.isArray(liveData.peopleFollowThrough) ? liveData.peopleFollowThrough : [] },
    { id: "member-feedback", label: "Member feedback", rows: Array.isArray(liveData.memberNpsFeedback) ? liveData.memberNpsFeedback : [] },
  ].filter((source) => source.rows.length > 0)

  const actionRows: LiveRow[] = (Array.isArray(liveData.actions) ? liveData.actions : Array.isArray(liveData.actionLog) ? liveData.actionLog : [])
    .filter((row: LiveRow) => String(liveValue(row, ["state", "status"])).trim().toLowerCase() !== "dismissed")
  const evidenceRows: LiveRow[] = Array.isArray(liveData.evidence) ? liveData.evidence : Array.isArray(liveData.evidenceLog) ? liveData.evidenceLog : []
  const approvalRows: LiveRow[] = Array.isArray(liveData.approvals) ? liveData.approvals : Array.isArray(liveData.approvalLog) ? liveData.approvalLog : []
  const asOf = validDate(liveData.asOf) || validDate(liveData.fetchedAt) || validDate(liveData?.meta?.snapshotAt)
    || newestLiveTimestamp([...sources.flatMap((source) => source.rows), ...actionRows, ...evidenceRows, ...approvalRows])

  if (!asOf || (sources.length === 0 && actionRows.length === 0 && evidenceRows.length === 0 && approvalRows.length === 0)) return fallback

  const feeds: LoopHealthFeedInput[] = sources.map((source) => ({
    feedId: source.id,
    label: source.label,
    lastUpdatedAt: newestLiveTimestamp(source.rows) || asOf,
    cadenceMinutes: LIVE_OVERVIEW_CADENCE_MINUTES,
    critical: Boolean(source.critical),
    affectedClaims: source.rows.map((row, index) => String(liveValue(row, ["id", "action id", "studio id", "demand id"]) || `${source.id}-${index + 1}`)),
  }))

  const actionState = (row: LiveRow) => String(liveValue(row, ["state", "status"])).trim().toLowerCase()
  const verifiedRows = actionRows.filter((row) => ["verified", "closed", "resolved"].includes(actionState(row)))
  const reopenedRows = actionRows.filter((row) => actionState(row) === "reopened")
  const awaitingRows = actionRows.filter((row) => !["verified", "closed", "resolved", "reopened"].includes(actionState(row)))
  const oldestAwaitingAt = awaitingRows
    .map((row) => validDate(liveValue(row, ["proposed at", "created at", "captured at", "updated at", "due at"])))
    .filter(Boolean)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? (awaitingRows.length ? asOf : null)
  const openClockRows = actionRows.filter((row) => !["verified", "closed", "resolved"].includes(actionState(row)))
  const clocks = openClockRows
    .map((row, index) => {
      const dueAt = validDate(liveValue(row, ["due at", "deadline at", "next action due at"]))
      if (!dueAt) return null
      return {
        clockId: String(liveValue(row, ["action id", "id"]) || `action-${index + 1}`),
        label: String(liveValue(row, ["operating objective", "title", "expected metric"]) || "Action awaiting closure"),
        ownerRole: String(liveValue(row, ["owner", "owner actor id", "next action owner actor id"]) || "Operations"),
        dueAt,
        state: "Running" as const,
      }
    })
    .filter((clock): clock is NonNullable<typeof clock> => clock !== null)
  const incidentRows: LiveRow[] = Array.isArray(liveData.incidents) ? liveData.incidents : Array.isArray(liveData.incidentLog) ? liveData.incidentLog : []
  const quarantinedRecords = incidentRows
    .filter((row: LiveRow) => String(liveValue(row, ["state", "status"])).trim().toLowerCase() === "quarantined").length

  return buildLoopHealth({
    asOf,
    feeds,
    clocks,
    verification: {
      claimed: actionRows.length,
      verified: verifiedRows.length,
      awaiting: awaitingRows.length,
      reopened: reopenedRows.length,
      oldestAwaitingAt,
    },
    quarantinedRecords,
  })
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
    <div className={`metric-grid ${tab === "Definitions" ? "definitions" : ""}`}>{data.metrics.map((metric, index) => <article className="metric" key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.note}</span>{index < data.metrics.length - 1 && <i aria-hidden>?</i>}</article>)}</div>
    {tab === "Essentials" && <AttachSlopeChart />}
    {tab === "Economics" && <><CmBridgeChart /><StudioArpuChart /></>}
    {tab === "People" && <PeopleInterventionChart />}
    <h2>{data.panelTitle}</h2>
    <DataTable caption={data.panelTitle} columns={data.columns} rows={data.rows} />
    <p className="footer-note">{data.footer}</p>
  </DashboardSectionAccordion>
}

export function NiaDashboard({ enterpriseDemandPreview = null, financeExpansionPreview = null, controlledAutonomyPreview = null, niaMarginsPreview, newAddsPreview, memberEngagementPreview, memberSavingsPreview, niaGrowthPreview, cashControlPreview = null, financeAllowed = false, liveOpsData, liveSelfDriveData, allocationData }: { enterpriseDemandPreview?: EnterpriseDemandLoopPreview | null; financeExpansionPreview?: FinanceExpansionPreview | null; controlledAutonomyPreview?: ControlledAutonomyPreview | null; niaMarginsPreview: NiaMarginsPreview; newAddsPreview: NewAddsPreview; memberEngagementPreview: MemberEngagementPreview; memberSavingsPreview: MemberSavingsPreview; niaGrowthPreview: NiaGrowthPreview; cashControlPreview?: CashControlPreview | null; financeAllowed?: boolean; liveOpsData?: any; liveSelfDriveData?: any; allocationData?: any }) {
  const [active, setActive] = useState<DashboardTab>(POST_LOGIN_DASHBOARD_STATE.active)
  const [workspace, setWorkspace] = useState<DashboardWorkspace>(POST_LOGIN_DASHBOARD_STATE.workspace)
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("reporting")
  const [overviewFocus, setOverviewFocus] = useState<DashboardRoute["subsection"]>()
  const [livingFocus, setLivingFocus] = useState<"fono" | "demand" | "supply" | "reconciliation">()
  const [allocationFocus, setAllocationFocus] = useState<string>()
  const [commitments, setCommitments] = useState<ExecutionAction[]>(() => [...executionActions, ...memberFeedbackActions])
  const [currentLiveOpsData, setCurrentLiveOpsData] = useState(liveOpsData)
  const currentLiveSelfDriveData = useMemo(() => currentLiveOpsData ? buildLiveSelfDriveSnapshot(currentLiveOpsData) : liveSelfDriveData, [currentLiveOpsData, liveSelfDriveData])
  const [filters, setFilters] = useState<LiveSelfDriveFilters>({ theatre: "", location: "", studio: "", person: "" })
  const [periodFilter, setPeriodFilter] = useState("All")
  const availablePeriods = useMemo(() => {
    if (!currentLiveSelfDriveData) return ["All"]
    const periodRows = [
      currentLiveSelfDriveData.enterpriseDemand,
      currentLiveSelfDriveData.activations,
      currentLiveSelfDriveData.incidents,
      currentLiveSelfDriveData.actions,
      currentLiveSelfDriveData.evidence,
      currentLiveSelfDriveData.approvals,
      currentLiveSelfDriveData.living,
      currentLiveSelfDriveData.work,
      currentLiveSelfDriveData.essentials,
      currentLiveSelfDriveData.finance,
      currentLiveSelfDriveData.learningHistory,
    ].flatMap((rows) => rows ?? [])
    const periods = periodOptions(periodRows)
    const metaMonth = String(currentLiveOpsData?.meta?.month ?? liveOpsData?.meta?.month ?? "").trim()
    if (/^[A-Za-z]+\s+\d{4}$/.test(metaMonth) && !periods.includes(metaMonth)) periods.splice(1, 0, metaMonth)
    return periods
  }, [currentLiveSelfDriveData])
  const filterOptions = useMemo<Record<keyof LiveSelfDriveFilters, readonly FilterOption[]>>(() => {
    const unique = (rows: readonly Record<string, unknown>[], valueKey: string, labelKey: string): FilterOption[] => Array.from(new Map(rows.map((row) => {
      const optionValue = String(row[valueKey] ?? "").trim()
      const label = String(row[labelKey] ?? optionValue).trim()
      return [optionValue, { value: optionValue, label }] as const
    }).filter(([key]) => key)).values()).sort((a, b) => a.label.localeCompare(b.label))
    const active = (row: Record<string, unknown>) => !String(row.active ?? "TRUE").trim() || ["true", "yes", "1", "active"].includes(String(row.active ?? "").trim().toLowerCase())
    const theatres = (currentLiveSelfDriveData?.theatres ?? []).filter(active)
    const theatreIds = new Set(theatres.map((row: Record<string, unknown>) => String(row["theatre id"] ?? "").trim()))
    const allStudios = (currentLiveSelfDriveData?.studios ?? []).filter(active).filter((row: Record<string, unknown>) => theatreIds.has(String(row["theatre id"] ?? "").trim()))
    const locationStudios = allStudios.filter((row: Record<string, unknown>) => !filters.theatre || String(row["theatre id"] ?? "").trim() === filters.theatre)
    const studios = locationStudios.filter((row: Record<string, unknown>) => !filters.location || String(row.address ?? "").trim() === filters.location)
    const eligibleStudioIds = new Set(studios.map((row: Record<string, unknown>) => String(row["studio id"] ?? "").trim()))
    const people = (currentLiveSelfDriveData?.people ?? []).filter(active).filter((row: Record<string, unknown>) => {
      const theatreId = String(row["theatre id"] ?? "").trim()
      const studioId = String(row["studio id"] ?? "").trim()
      if (filters.theatre && theatreId && theatreId !== filters.theatre) return false
      if ((filters.location || filters.studio) && studioId && (filters.studio ? studioId !== filters.studio : !eligibleStudioIds.has(studioId))) return false
      return true
    })
    return {
      theatre: unique(theatres, "theatre id", "theatre name"),
      location: unique(locationStudios, "address", "address"),
      studio: unique(studios, "studio id", "studio name"),
      person: unique(people, "actor id", "display name"),
    }
  }, [currentLiveSelfDriveData, filters.theatre, filters.location, filters.studio])
  const dimensionFilteredLiveSelfDriveData = useMemo(() => currentLiveSelfDriveData ? filterLiveSelfDriveSnapshot(currentLiveSelfDriveData, filters) : currentLiveSelfDriveData, [currentLiveSelfDriveData, filters])
  const filteredLiveSelfDriveData = useMemo(() => {
    if (!dimensionFilteredLiveSelfDriveData) return dimensionFilteredLiveSelfDriveData
    return {
      ...dimensionFilteredLiveSelfDriveData,
      enterpriseDemand: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.enterpriseDemand, periodFilter)
        .sort((left: LiveRow, right: LiveRow) => {
          const timestamp = (row: LiveRow) => Date.parse(validDate(liveValue(row, ["opened at", "updated at", "source updated at", "submitted at", "created at"]))) || 0
          return timestamp(right) - timestamp(left)
        }),
      activations: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.activations, periodFilter),
      incidents: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.incidents, periodFilter),
      actions: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.actions, periodFilter),
      evidence: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.evidence, periodFilter),
      approvals: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.approvals, periodFilter),
      living: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.living, periodFilter),
      work: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.work, periodFilter),
      essentials: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.essentials, periodFilter),
      finance: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.finance, periodFilter),
      learningHistory: filterRowsByPeriod(dimensionFilteredLiveSelfDriveData.learningHistory, periodFilter),
    }
  }, [dimensionFilteredLiveSelfDriveData, periodFilter])
  const filteredLiveOpsData = useMemo(() => !currentLiveOpsData || !filteredLiveSelfDriveData ? currentLiveOpsData : ({
    ...currentLiveOpsData,
    theatres: filteredLiveSelfDriveData.theatres,
    studios: filteredLiveSelfDriveData.studios,
    people: filteredLiveSelfDriveData.people,
    enterpriseDemand: filteredLiveSelfDriveData.enterpriseDemand,
    memberActivation: filteredLiveSelfDriveData.activations,
    incidentLog: filteredLiveSelfDriveData.incidents,
    actionLog: filteredLiveSelfDriveData.actions,
    evidenceLog: filteredLiveSelfDriveData.evidence,
    approvalLog: filteredLiveSelfDriveData.approvals,
    living: filteredLiveSelfDriveData.living,
    work: filteredLiveSelfDriveData.work,
    essentials: filteredLiveSelfDriveData.essentials,
    finance: filteredLiveSelfDriveData.finance,
    learningHistory: filteredLiveSelfDriveData.learningHistory,
  }), [currentLiveOpsData, filteredLiveSelfDriveData])
  // Keep the page shell stable while the Overview mode changes. The mode bar
  // and the report body already explain the active operating view.
  
console.log("ACTIVE SCREEN:", active)
console.log("AVAILABLE META:", Object.keys(screenMeta))

const baseMeta = screenMeta[active] ?? screenMeta.Overview
  const content = currentLiveOpsData?.dashboardContent as DashboardContent | undefined
  const meta = {
    title: contentValue(content, active, "page", "title", baseMeta.title),
    subtitle: contentValue(content, active, "page", "subtitle", baseMeta.subtitle),
    view: workspace === "self-drive" && active === "Nia Growth" && currentLiveSelfDriveData ? "Google Sheet · read-only" : contentValue(content, active, "page", "view", baseMeta.view),
  }
  const sectionTitle = active === "Member Feedback" ? "Member NPS" : active === "Definitions" ? "Learning history" : dashboardDisplayLabel(active)
  const liveLearningHistory: readonly LearningHistoryEntry[] = (filteredLiveOpsData?.learningHistory ?? []).map((entry: Record<string, unknown>) => ({
    domain: String(entry.domain ?? ""),
    observed: String(entry.observed ?? ""),
    proposedChange: String(entry.proposed_change ?? ""),
    expectedEffect: String(entry.expected_effect ?? ""),
    attribution: String(entry.attribution ?? ""),
    confidence: String(entry.confidence ?? ""),
    disposition: String(entry.disposition ?? ""),
  })).filter((entry: LearningHistoryEntry) => entry.domain && entry.observed)
  const learningHistory: readonly LearningHistoryEntry[] = filteredLiveOpsData !== undefined ? liveLearningHistory : (controlledAutonomyPreview?.learningQueue ?? []).map((entry) => ({
    domain: entry.domain,
    observed: entry.observed,
    proposedChange: entry.proposedChange,
    expectedEffect: entry.expectedEffect,
    attribution: entry.evidenceSummary,
    confidence: entry.evaluation.confidence,
    disposition: entry.evaluation.requiredDisposition,
  }))
  const previewPlatformLoopHealth = useMemo(() => aggregateLoopHealth([
    ...(enterpriseDemandPreview ? [{ domain: "Enterprise Demand" as const, health: enterpriseDemandPreview.loopHealth }] : []),
    { domain: "New Adds" as const, health: newAddsPreview.loopHealth },
    { domain: "Member Engagement" as const, health: memberEngagementPreview.loopHealth },
    { domain: "Member Savings" as const, health: memberSavingsPreview.loopHealth },
    { domain: "Nia Margins" as const, health: niaMarginsPreview.loopHealth },
    { domain: "Nia Growth" as const, health: niaGrowthPreview.loopHealth },
    ...(cashControlPreview ? [{ domain: "Cash & Control" as const, health: cashControlPreview.loopHealth }] : []),
  ]), [cashControlPreview, enterpriseDemandPreview, memberEngagementPreview.loopHealth, memberSavingsPreview.loopHealth, newAddsPreview.loopHealth, niaGrowthPreview.loopHealth, niaMarginsPreview.loopHealth])
  const platformLoopHealth = useMemo(() => liveOverviewLoopHealth(
    workspace === "self-drive" ? filteredLiveSelfDriveData : filteredLiveOpsData,
    previewPlatformLoopHealth,
  ), [filteredLiveOpsData, filteredLiveSelfDriveData, previewPlatformLoopHealth, workspace])
  const workspaceTabs: readonly DashboardTab[] = workspace === "self-drive"
    ? OPERATIONS_TABS.filter((tab) => (tab !== "Enterprise Demand" || enterpriseDemandPreview !== null) && (tab !== "Your Sign-Off" || controlledAutonomyPreview !== null))
    : workspace === "self-learn"
      ? SELF_LEARN_TABS
      : ["Finance control", "Nia Margins", "Cash & Control"]

  useEffect(() => {
    if (overviewFocus) {
  setTimeout(() => {
    document
      .getElementById(
        overviewFocus.toLowerCase().replaceAll(" ", "-")
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
  }, 300)
}
  }, [active, overviewFocus])

  useEffect(() => {
    setCurrentLiveOpsData(liveOpsData)
  }, [liveOpsData])

useEffect(() => {
  if (livingFocus) {
      setTimeout(() => {
        document
          .getElementById(livingFocus.toLowerCase())
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
      }, 300)
    }
}, [active, livingFocus])

useEffect(() => {
  if (!allocationFocus || (active !== "Living" && active !== "Work" && active !== "Essentials")) return

  const timer = window.setTimeout(() => {
    document.getElementById("allocation-context")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }, 350)

  return () => window.clearTimeout(timer)
}, [active, allocationFocus])

  function navigate(route: DashboardRoute, mismatchId?: string) {
    setActive(route.screen)

    if (route.screen === "Living") {
      setLivingFocus(route.subsection)
      setOverviewFocus(undefined)
    } else {
      setOverviewFocus(route.subsection)
      setLivingFocus(undefined)
    }

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

  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshLiveData = useCallback(async (refreshSources = false, automaticSourceSync = false) => {
    try {
      if (refreshSources) {
        setIsRefreshing(true)
        const syncResponse = await fetch(`/api/ops-data${automaticSourceSync ? "?auto=1" : ""}`, { method: "POST", cache: "no-store" })
        if (!syncResponse.ok) {
          const syncFailure = await syncResponse.json().catch(() => null)
          throw new Error(syncFailure?.error || "Source synchronization failed")
        }
      }
      const response = await fetch(`/api/ops-data?refresh=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      const payload = await response.json()
      if (response.ok && payload?.success && payload.data) {
        setCurrentLiveOpsData(payload.data)
      } else {
        console.warn("Dashboard data refresh was deferred; retaining the last dashboard snapshot.", payload?.error || response.statusText)
      }
    } catch (error) {
      console.warn("Dashboard refresh request was deferred; retaining the last dashboard snapshot.", error)
    } finally {
      if (refreshSources) setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refreshLiveData(true, true)
    const snapshotTimer = window.setInterval(() => void refreshLiveData(), 60_000)
    const sourceTimer = window.setInterval(() => void refreshLiveData(true, true), 900_000)
    return () => {
      window.clearInterval(snapshotTimer)
      window.clearInterval(sourceTimer)
    }
  }, [refreshLiveData])

  return <main className="central-shell">
    <div className="central-main">
    <header className="platform-utility"><div className="central-brand">Rafiqi <span>Central</span></div><ModeSelect value={workspace} onChange={openWorkspace} options={financeAllowed ? [{ value: "self-drive", label: "Self Drive" }, { value: "self-learn", label: "Self Learn" }, { value: "finance", label: "Finance" }] : [{ value: "self-drive", label: "Self Drive" }, { value: "self-learn", label: "Self Learn" }]} /><div className="controls platform-controls"><div className="freshness"><span>DATA UPDATED</span><strong><i /> {currentLiveOpsData?.meta?.updatedAt || "No data"}</strong></div><button className="view"><small>PERIOD</small><strong>{meta.view}</strong><ChevronDown aria-hidden /></button><details className="date period-picker"><summary aria-label="Reporting period"><CalendarDays aria-hidden /><strong>{periodFilter}</strong><ChevronDown aria-hidden /></summary><div className="period-menu" role="listbox" aria-label="Reporting period options">{availablePeriods.map((period) => <button type="button" role="option" aria-selected={periodFilter === period} className={periodFilter === period ? "selected" : ""} onClick={(event) => { setPeriodFilter(period); event.currentTarget.closest("details")?.removeAttribute("open") }} key={period}>{period}</button>)}</div></details><button className="upload" type="button" disabled={isRefreshing} onClick={() => void refreshLiveData(true)}><Paperclip aria-hidden />{isRefreshing ? "Syncing…" : "Refresh data"}</button><ThemeToggle /><button className="upload" onClick={signOut}><LogOut aria-hidden />Sign out</button></div></header>
    <nav id="dashboard-navigation" className="platform-domain-nav" aria-label={`${workspace} navigation`}><div className="platform-domain-tabs">{workspaceTabs.map((item) => <button key={item} className={`${active === item ? "active" : ""}${item === "Despatch" ? " despatch-nav" : ""}`} aria-current={active === item ? "page" : undefined} onClick={() => navigate({ screen: item })}><span>{item === "Member Feedback" ? "Member NPS" : item === "Definitions" ? "Learning history" : dashboardDisplayLabel(item)}</span></button>)}</div></nav>
    <section className="platform-heading"><h1>{sectionTitle}</h1><p className="subtitle">{meta.title === sectionTitle ? meta.subtitle : `${meta.title} ${meta.subtitle}`}</p></section>
    <Filters className="platform-filters" value={filters} options={filterOptions} onChange={(key, nextValue) => setFilters((current) => key === "theatre" ? { theatre: nextValue, location: "", studio: "", person: "" } : key === "location" ? { ...current, location: nextValue, studio: "", person: "" } : key === "studio" ? { ...current, studio: nextValue, person: "" } : { ...current, person: nextValue })} />
    <section className={`content platform-content ${active === "Overview" ? "overview-content" : ""} pillar-${active.toLowerCase().replaceAll(" ", "-")}`}>
      {active === "Overview" && <OverviewStory mode={overviewMode} loopHealth={platformLoopHealth} liveOpsData={filteredLiveOpsData} allocationData={allocationData} onModeChange={setOverviewMode} onNavigate={navigate} />}
      {active === "Cash & Control" && (cashControlPreview ? <CashControlWorkspace preview={cashControlPreview} liveData={filteredLiveSelfDriveData} /> : <section className="restricted-control" aria-label="Restricted Cash and Control"><LockKeyhole aria-hidden /><p className="eyebrow">RESTRICTED CONTROL</p><h2>Cash &amp; Control is available to authorised Finance users.</h2><p>Operating teams can continue through the remaining Self Drive tabs. Financial goals, cash, opex and leakage remain protected.</p></section>)}
      {active === "Enterprise Demand" && enterpriseDemandPreview && <EnterpriseDemandWorkspace preview={enterpriseDemandPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "New Adds" && <NewAddsWorkspace preview={newAddsPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "Member Engagement" && <MemberEngagementWorkspace preview={memberEngagementPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "Member Savings" && <MemberSavingsWorkspace preview={memberSavingsPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "Nia Growth" && <NiaGrowthWorkspace preview={niaGrowthPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "Finance control" && financeExpansionPreview && <FinanceExpansionWorkspace preview={financeExpansionPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "Your Sign-Off" && controlledAutonomyPreview && <ControlledAutonomyWorkspace preview={controlledAutonomyPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "Nia Margins" && <NiaMarginsWorkspace preview={niaMarginsPreview} liveData={filteredLiveSelfDriveData} />}
      {active === "Living" && <LivingScreen focus={livingFocus} allocationFocus={allocationFocus} liveOpsData={filteredLiveOpsData} allocationData={allocationData} /> }
      {active === "Work" && <WorkScreen liveOpsData={filteredLiveOpsData} allocationFocus={allocationFocus} allocationData={allocationData} />}
      {active === "Essentials" && <EssentialsScreen allocationFocus={allocationFocus} allocationData={allocationData} liveOpsData={filteredLiveOpsData} />}
      {active === "People" && <PeopleScreen liveOpsData={filteredLiveOpsData} />}
      {active === "Member Feedback" && <MemberFeedbackScreen actions={commitments} onOpenExecution={openFeedbackExecution} onOpenDespatch={openFeedbackDespatch} liveOpsData={filteredLiveOpsData} />}
        {active === "Definitions" && <LearningHistoryWorkspace
          entries={learningHistory}
          title={contentValue(content, "Definitions", "learning_history", "title", "What Nia learned from verified outcomes")}
          subtitle={contentValue(content, "Definitions", "learning_history", "subtitle", "Small, reversible improvements can be logged. Material changes always wait for sign-off.")}
          adoptionRule={contentValue(content, "Definitions", "learning_history", "adoption_rule", "No material target, channel, CM, cash, pricing or human-authority change is adopted automatically.")}
          summaryLabel={contentValue(content, "Definitions", "learning_history", "summary_label", "Learning summary")}
          verifiedLearningsLabel={contentValue(content, "Definitions", "learning_history", "verified_learnings_label", "Verified outcome learnings")}
          adoptionRuleLabel={contentValue(content, "Definitions", "learning_history", "adoption_rule_label", "Adoption rule")}
        />}
      {active === "Despatch" && <DespatchScreen commitments={commitments} loopHealth={platformLoopHealth} onValidateAction={validateExecutionAction} liveData={{ asOf: filteredLiveSelfDriveData.asOf, actions: filteredLiveSelfDriveData.actions, incidents: filteredLiveSelfDriveData.incidents, people: filteredLiveSelfDriveData.people, evidence: filteredLiveSelfDriveData.evidence, approvals: filteredLiveSelfDriveData.approvals, theatres: filteredLiveSelfDriveData.theatres, studios: filteredLiveSelfDriveData.studios, policies: filteredLiveSelfDriveData.policies }} />}
      {active === "Economics" && <TableScreen tab={active} allocationFocus={allocationFocus} />}
    </section>
    </div></main>
}

















