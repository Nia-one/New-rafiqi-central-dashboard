import { BriefcaseBusiness, ChevronDown, Database } from "lucide-react"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { WORK_EMPTY_STATE } from "@/lib/dashboard-model"

type WorkRow = Record<string, unknown>

const workText = (row: WorkRow, ...keys: string[]) => {
  for (const key of keys) {
    const normalized = key.toLowerCase().replaceAll("_", " ")
    const found = Object.keys(row).find((candidate) => candidate.toLowerCase().replaceAll("_", " ") === normalized)
    if (found && String(row[found] ?? "").trim()) return String(row[found]).trim()
  }
  return ""
}

const workNumber = (row: WorkRow, ...keys: string[]) => {
  const parsed = Number(workText(row, ...keys).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)

export function WorkScreen({ liveRows = [] }: { liveRows?: readonly WorkRow[] }) {
  if (liveRows.length) {
    const latestById = new Map<string, WorkRow>()
    liveRows.forEach((row, index) => {
      const id = workText(row, "work hourly id") || `work-${index + 1}`
      const previous = latestById.get(id)
      const currentAt = Date.parse(workText(row, "captured at", "updated at")) || 0
      const previousAt = previous ? Date.parse(workText(previous, "captured at", "updated at")) || 0 : -1
      if (!previous || currentAt >= previousAt) latestById.set(id, row)
    })
    const current = [...latestById.values()]
    const employers = new Map<string, { members: number; revenue: number; rows: number }>()
    current.forEach((row) => {
      const employer = workText(row, "enterprise or employer", "enterprise id") || "Employer not recorded"
      const prior = employers.get(employer) ?? { members: 0, revenue: 0, rows: 0 }
      employers.set(employer, {
        members: prior.members + workNumber(row, "active Members", "matched headcount"),
        revenue: prior.revenue + workNumber(row, "Work revenue", "work billed inr"),
        rows: prior.rows + 1,
      })
    })
    const employerRows = [...employers.entries()].map(([employer, values]) => ({ employer, ...values, arpu: values.members > 0 ? Math.round(values.revenue / values.members) : null })).sort((a, b) => b.revenue - a.revenue)
    const members = employerRows.reduce((sum, row) => sum + row.members, 0)
    const revenue = employerRows.reduce((sum, row) => sum + row.revenue, 0)
    const completeStudioRows = current.filter((row) => workText(row, "Studio ID") && workText(row, "Theatre"))
    return <DashboardSectionAccordion className="work-screen pillar-screen" ariaLabel="Work sections" sections={[
      { title: "Main point", summary: `${current.length} current Work records across ${employerRows.length} employers` },
      { title: "Work measures", summary: `${members.toLocaleString("en-IN")} active Members · ${inr(revenue)} billed` },
      { title: "Employer share", summary: `${employerRows.length} governed employers` },
      { title: "Studio ARPU", summary: completeStudioRows.length ? `${completeStudioRows.length} Studio records` : "Studio and Theatre fields are not yet populated" },
      { title: "Source and coverage", summary: `${liveRows.length} source rows · ${current.length} latest records` },
    ]}>
      <div className="decision-bar"><div><span>MAIN POINT</span><strong>Work revenue and active Members are connected by employer.</strong></div><p>Studio ARPU stays unavailable until Studio ID and Theatre are recorded; missing fields are not converted to zero.</p></div>
      <section className="people-headline" data-kpi-group><article><span>CURRENT RECORDS</span><strong>{current.length}</strong><small>Latest row per Work heartbeat</small></article><article><span>ACTIVE MEMBERS</span><strong>{members.toLocaleString("en-IN")}</strong><small>Matched headcount where Member field is blank</small></article><article><span>WORK REVENUE</span><strong>{inr(revenue)}</strong><small>Governed billed value</small></article><article><span>NETWORK ARPU</span><strong>{members ? inr(Math.round(revenue / members)) : "—"}</strong><small>Revenue divided by active Members</small></article></section>
      <section className="operating-section"><h2>Employer share</h2><DataTable caption="Work revenue and active Members by employer" columns={["ENTERPRISE / EMPLOYER", "ACTIVE MEMBERS", "WORK REVENUE", "ARPU", "CURRENT RECORDS"]} rows={employerRows.map((row) => [row.employer, row.members.toLocaleString("en-IN"), inr(row.revenue), row.arpu === null ? "Not available" : inr(row.arpu), String(row.rows)])} /></section>
      <section className="operating-section"><h2>Studio ARPU</h2>{completeStudioRows.length ? <DataTable caption="Work ARPU by Studio" columns={["STUDIO", "THEATRE", "EMPLOYER", "ACTIVE MEMBERS", "WORK REVENUE", "PERIOD"]} rows={completeStudioRows.map((row) => [workText(row, "Studio ID"), workText(row, "Theatre"), workText(row, "enterprise or employer", "enterprise id"), workText(row, "active Members", "matched headcount") || "Not recorded", workText(row, "Work revenue", "work billed inr") || "Not recorded", [workText(row, "period start"), workText(row, "period end")].filter(Boolean).join(" to ") || "Not recorded"])} /> : <div className="work-empty"><BriefcaseBusiness aria-hidden /><h2>Studio ARPU is not yet confirmable.</h2><p>All current bot rows omit Studio ID and Theatre. Employer-level values remain visible, while the unsupported Studio cut stays blank.</p></div>}</section>
      <section className="operating-section"><h2>Required-field coverage</h2><DataTable caption="Work source field coverage" columns={["FIELD", "POPULATED ROWS", "SOURCE"]} rows={WORK_EMPTY_STATE.fields.map((field) => [field, String(liveRows.filter((row) => Boolean(workText(row, field))).length), field === "enterprise or employer" ? "Enterprise ID accepted as governed fallback" : field === "active Members" ? "Matched headcount accepted as governed fallback" : field === "Work revenue" ? "Work billed INR accepted as governed fallback" : "User Input field"])} /><p className="footer-note">Source: Work_Hourly. Repeated heartbeat IDs are reduced to their latest captured record before totals are calculated.</p></section>
    </DashboardSectionAccordion>
  }
  return <DashboardSectionAccordion className="work-screen" ariaLabel="Work sections" sections={[{ title: "Work data requirement", summary: WORK_EMPTY_STATE.title }]}><div className="work-empty"><BriefcaseBusiness aria-hidden /><h2 id="work-title">{WORK_EMPTY_STATE.title}</h2><p>{WORK_EMPTY_STATE.description}</p><details className="required-fields"><summary><Database aria-hidden /><strong>Required source fields</strong><ChevronDown aria-hidden /></summary><ul>{WORK_EMPTY_STATE.fields.map((field) => <li key={field}>{field}</li>)}</ul></details></div></DashboardSectionAccordion>
}
