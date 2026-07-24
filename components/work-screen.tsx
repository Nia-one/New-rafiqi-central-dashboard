import { BriefcaseBusiness, Database } from "lucide-react"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { WORK_EMPTY_STATE } from "@/lib/dashboard-model"

type SheetRow = Record<string, unknown>

function field(row: SheetRow, ...names: string[]) {
  for (const name of names) {
    const match = Object.entries(row).find(([key]) => key.trim().toLowerCase() === name.toLowerCase())?.[1]
    if (match !== undefined && match !== null && String(match).trim() !== "") return String(match).trim()
  }
  return ""
}

function amount(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}

type WorkRecord = {
  studio: string
  theatre: string
  employer: string
  members: number
  revenue: number
  periodStart: string
  periodEnd: string
}

function emptyState() {
  return <div className="work-empty"><BriefcaseBusiness aria-hidden /><p className="pillar-kicker">WORK · DATA REQUIREMENT</p><h2 id="work-title">{WORK_EMPTY_STATE.title}</h2><p>{WORK_EMPTY_STATE.description}</p><div className="required-fields"><div><Database aria-hidden /><strong>Required source fields</strong></div><ul>{WORK_EMPTY_STATE.fields.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
}

export function WorkScreen({ liveOpsData }: { liveOpsData?: { work?: SheetRow[]; enterpriseDemand?: SheetRow[]; workDashboard?: SheetRow[] } | null }) {
  const demandRows = liveOpsData?.enterpriseDemand ?? []
  const dashboardRows = liveOpsData?.workDashboard ?? []
  const copy = (key: string, fallback: string, tokens: Record<string, string | number> = {}) => {
    const template = field(dashboardRows.find((row) => field(row, "key") === key) ?? {}, "value text") || fallback
    return Object.entries(tokens).reduce((text, [token, value]) => text.replaceAll(`{${token}}`, String(value)), template)
  }
  const records: WorkRecord[] = (liveOpsData?.work ?? []).map((row) => {
    const enterpriseId = field(row, "enterprise id")
    const demand = demandRows.find((item) => field(item, "enterprise id") === enterpriseId)
    return {
      studio: field(row, "studio id"),
      theatre: field(row, "theatre", "theatre id"),
      employer: field(row, "enterprise or employer") || field(demand ?? {}, "enterprise or employer", "enterprise name", "enterprise") || enterpriseId,
      members: amount(field(row, "active members")),
      revenue: amount(field(row, "work revenue", "work billed inr")),
      periodStart: field(row, "period start"),
      periodEnd: field(row, "period end"),
    }
  }).filter((record) => record.studio && record.theatre && record.employer && record.members > 0 && record.revenue > 0 && record.periodStart && record.periodEnd)

  if (!records.length) {
    return <DashboardSectionAccordion className="work-screen" ariaLabel="Work sections" sections={[{ title: copy("work_empty_accordion_title", "Work data requirement"), summary: copy("work_empty_accordion_summary", WORK_EMPTY_STATE.title) }]}><div className="work-empty"><BriefcaseBusiness aria-hidden /><p className="pillar-kicker">{copy("work_empty_kicker", "WORK · DATA REQUIREMENT")}</p><h2 id="work-title">{copy("work_empty_title", WORK_EMPTY_STATE.title)}</h2><p>{copy("work_empty_description", WORK_EMPTY_STATE.description)}</p><div className="required-fields"><div><Database aria-hidden /><strong>{copy("work_required_fields_title", "Required source fields")}</strong></div><ul>{WORK_EMPTY_STATE.fields.map((item) => <li key={item}>{item}</li>)}</ul></div></div></DashboardSectionAccordion>
  }

  const revenue = records.reduce((sum, record) => sum + record.revenue, 0)
  const members = records.reduce((sum, record) => sum + record.members, 0)
  const arpu = members ? revenue / members : 0
  const employerRevenue = new Map<string, number>()
  records.forEach((record) => employerRevenue.set(record.employer, (employerRevenue.get(record.employer) ?? 0) + record.revenue))

  return <DashboardSectionAccordion className="work-screen work-live-screen" ariaLabel="Work sections" sections={[{ title: copy("work_live_accordion_title", "Work performance"), summary: copy("work_live_accordion_summary", "{recordCount} live Studio record(s) loaded from Work_Hourly.", { recordCount: records.length }) }]}>
    <section className="work-live" aria-labelledby="work-title">
      <BriefcaseBusiness aria-hidden />
      <p className="pillar-kicker">{copy("work_live_kicker", "WORK · LIVE PERFORMANCE")}</p>
      <h2 id="work-title">{copy("work_live_title", "ARPU by Studio and employer revenue share.")}</h2>
      <p className="section-intro">{copy("work_live_intro", "All measures below are calculated from the connected Work_Hourly rows for the selected period.")}</p>
      <div className="metric-grid work-metrics">
        <article className="metric clay"><p>{copy("work_active_members_label", "ACTIVE MEMBERS")}</p><strong>{members.toLocaleString("en-IN")}</strong><span>{copy("work_active_members_detail", "Across {recordCount} live Studio record(s)", { recordCount: records.length })}</span></article>
        <article className="metric blue"><p>{copy("work_revenue_label", "WORK REVENUE")}</p><strong>{formatMoney(revenue)}</strong><span>{copy("work_revenue_detail", "Reported for the selected period")}</span></article>
        <article className="metric navy"><p>{copy("work_arpu_label", "AVERAGE ARPU")}</p><strong>{formatMoney(arpu)}</strong><span>{copy("work_arpu_detail", "Work revenue ÷ active Members")}</span></article>
      </div>
      <DataTable caption={copy("work_table_caption", "Live Work revenue by Studio")} columns={["STUDIO ID", "THEATRE", "ENTERPRISE OR EMPLOYER", "ACTIVE MEMBERS", "WORK REVENUE", "ARPU", "EMPLOYER SHARE", "PERIOD START", "PERIOD END"]} rows={records.map((record) => [record.studio, record.theatre, record.employer, record.members.toLocaleString("en-IN"), formatMoney(record.revenue), formatMoney(record.revenue / record.members), `${Math.round((record.revenue / revenue) * 100)}%`, record.periodStart, record.periodEnd])} />
    </section>
  </DashboardSectionAccordion>
}
