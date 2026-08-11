import { RefreshCw } from "lucide-react"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { ENTERPRISE_PIPELINE_STAGES, enterprisePipelineStage } from "@/lib/enterprise-pipeline-stage"

type Row = Record<string, unknown>
type Stage = (typeof ENTERPRISE_PIPELINE_STAGES)[number]
const clean = (v: unknown) => v == null || String(v).trim() === "" ? "No data" : String(v)
const rowValue = (row: Row, ...keys: string[]) => { const wanted = new Set(keys.map((key) => key.toLowerCase())); return Object.entries(row).find(([key]) => wanted.has(key.trim().toLowerCase().replaceAll("_", " ")))?.[1] }
const value = (row: Row, ...keys: string[]) => String(rowValue(row, ...keys) ?? "").trim()
const theatreOf = (row: Row) => value(row, "theatre name", "theatre", "theatre id") || "Unassigned"
const SHEET_JCO_BY_THEATRE: Record<string, string> = { "TH-DCN": "Sachit Mathur", "TH-CORO": "Satish Sanghey", "TH-WLG": "Satish Sanghey" }
const jcoOf = (row: Row) => value(row, "business owner", "jco") || SHEET_JCO_BY_THEATRE[theatreOf(row).toUpperCase()] || value(row, "owner actor id") || "Unassigned"
const companyOf = (row: Row) => value(row, "enterprise name", "company", "plant name", "studio name") || "Unassigned"
const emptyCounts = () => Object.fromEntries(ENTERPRISE_PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<Stage, number>

export function EnterpriseLeadWorkspace({ rows, asOf }: { rows: readonly Row[]; asOf: string }) {
  const staged = rows.map((row) => ({ row, stage: enterprisePipelineStage(rowValue(row, "stage", "certainty"), rowValue(row, "status")) }))
  const active = staged.filter((entry): entry is { row: Row; stage: Stage } => entry.stage !== null)
  const excluded = staged.filter((entry) => entry.stage === null)
  const counts = emptyCounts(); active.forEach(({ stage }) => { counts[stage] += 1 })
  const maximum = Math.max(1, ...Object.values(counts))
  const group = (keyOf: (row: Row) => string) => { const groups = new Map<string, Record<Stage, number>>(); active.forEach(({ row, stage }) => { const key = keyOf(row); const bucket = groups.get(key) ?? emptyCounts(); bucket[stage] += 1; groups.set(key, bucket) }); return [...groups].map(([label, stageCounts]) => ({ label, counts: stageCounts, total: Object.values(stageCounts).reduce((sum, count) => sum + count, 0) })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)) }
  const jcos = group(jcoOf)
  const theatreJcos = group((row) => `${theatreOf(row)}\u0000${jcoOf(row)}`).map(({ label, ...entry }) => { const [theatre, jco] = label.split("\u0000"); return { theatre, jco, ...entry } }).sort((a, b) => a.theatre.localeCompare(b.theatre) || b.total - a.total)
  const companies = staged.map(({ row, stage }) => ({ company: companyOf(row), theatre: theatreOf(row), jco: jcoOf(row), stage: stage ?? (value(row, "stage", "certainty", "status") || "Drop / invalid") })).sort((a, b) => a.stage.localeCompare(b.stage) || a.company.localeCompare(b.company))
  const companyStageGroups = [
    ...ENTERPRISE_PIPELINE_STAGES.map((stage) => ({ stage, companies: active.filter((entry) => entry.stage === stage).map(({ row }) => companyOf(row)).sort((a, b) => a.localeCompare(b)) })),
    { stage: "Drop", companies: excluded.map(({ row }) => companyOf(row)).sort((a, b) => a.localeCompare(b)) },
  ]
  const sections = [{ title: "Do this now", summary: `${active.length} active leads · stage-wise` }, { title: "Today's work", summary: `${jcos.length} JCOs · live performance` }, { title: "Exceptions", summary: `${excluded.length} Drop / invalid records` }, { title: "Supporting detail", summary: `${theatreJcos.length} Theatre × JCO groups` }, { title: "Proof & health", summary: `${companies.length} company records` }]
  const stageCells = (stageCounts: Record<Stage, number>, total: number) => ENTERPRISE_PIPELINE_STAGES.map((stage) => <td key={stage}><span style={{ "--cell-width": `${total ? stageCounts[stage] / total * 100 : 0}%` } as React.CSSProperties}>{stageCounts[stage]}</span></td>)
  return <section className="pillar-screen enterprise-stage-workspace enterprise-lead-workspace" aria-label="Enterprise Demand stage-wise lead records">
    <div className="enterprise-context-bar"><span>Enterprise <b>{active.length} active lead records</b></span><span>Source <b>UI_Enterprise_Demand</b></span><span>Measure <b>Record count, not Nest potential</b></span><span>Updated <b>{clean(asOf)}</b></span></div>
    <DashboardSectionAccordion className="enterprise-outline" ariaLabel="Enterprise Demand sections" sections={sections}>
      <section className="operating-section enterprise-original-panel"><div className="enterprise-stage-heading"><div><p className="pillar-kicker">LIVE ENTERPRISE DEMAND</p><h2>Lead records by current pipeline stage</h2></div><p>{rows.length} source rows · {excluded.length} excluded</p></div><div className="enterprise-record-funnel">{ENTERPRISE_PIPELINE_STAGES.map((stage, index) => <article key={stage} style={{ "--stage-delay": `${index * 70}ms` } as React.CSSProperties}><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage}</strong><b>{counts[stage]}</b></div><i><b style={{ width: `${counts[stage] ? Math.max(3, counts[stage] / maximum * 100) : 0}%` }} /></i><small>{counts[stage]} lead record{counts[stage] === 1 ? "" : "s"}</small></article>)}</div></section>
      <section className="operating-section enterprise-theatre-performance enterprise-original-panel"><div className="enterprise-stage-heading"><div><p className="pillar-kicker">JCO PERFORMANCE</p><h2>JCO-wise stage performance</h2></div><p>Every number is one lead record</p></div><div className="enterprise-theatre-table-wrap"><table><thead><tr><th>JCO</th>{ENTERPRISE_PIPELINE_STAGES.map((stage) => <th key={stage}>{stage}</th>)}<th>Total</th></tr></thead><tbody>{jcos.map((entry, index) => <tr key={entry.label} style={{ "--stage-delay": `${index * 90}ms` } as React.CSSProperties}><th>{entry.label}</th>{stageCells(entry.counts, entry.total)}<td><strong>{entry.total}</strong></td></tr>)}</tbody></table></div></section>
      <section className="operating-section enterprise-original-panel"><div className="enterprise-stage-heading"><div><p className="pillar-kicker">EXCLUDED FROM ACTIVE PIPELINE</p><h2>Drop and invalid-stage records</h2></div><p>{excluded.length} records</p></div>{excluded.length ? <DataTable caption="Enterprise Demand excluded records" columns={["COMPANY", "THEATRE", "JCO", "SOURCE STAGE"]} rows={excluded.map(({ row }) => [companyOf(row), theatreOf(row), jcoOf(row), value(row, "stage", "certainty", "status") || "Invalid / blank"])} /> : <p className="footer-note">No Drop or invalid-stage record is present.</p>}</section>
      <section className="operating-section enterprise-theatre-performance enterprise-original-panel"><div className="enterprise-stage-heading"><div><p className="pillar-kicker">THEATRE × JCO PERFORMANCE</p><h2>Which JCO owns leads in each theatre and stage</h2></div><p>{theatreJcos.length} groups</p></div><div className="enterprise-theatre-table-wrap"><table><thead><tr><th>Theatre</th><th>JCO</th>{ENTERPRISE_PIPELINE_STAGES.map((stage) => <th key={stage}>{stage}</th>)}<th>Total</th></tr></thead><tbody>{theatreJcos.map((entry, index) => <tr key={`${entry.theatre}-${entry.jco}`} style={{ "--stage-delay": `${index * 80}ms` } as React.CSSProperties}><th>{entry.theatre}</th><th>{entry.jco}</th>{stageCells(entry.counts, entry.total)}<td><strong>{entry.total}</strong></td></tr>)}</tbody></table></div></section>
      <section className="operating-section enterprise-original-panel"><div className="enterprise-stage-heading"><div><p className="pillar-kicker">COMPANY PIPELINE REGISTER</p><h2>Companies grouped by current stage</h2></div><p>{companies.length} live sheet records</p></div><div className="enterprise-company-stage-list">{companyStageGroups.map((entry, index) => <article key={entry.stage} style={{ "--stage-delay": `${index * 70}ms` } as React.CSSProperties}><header><span>{String(index + 1).padStart(2, "0")}</span><h3>{entry.stage}</h3><b>{entry.companies.length}</b></header><div className="enterprise-company-name-box">{entry.companies.length ? entry.companies.join(", ") : <em>No companies</em>}</div></article>)}</div><p className="footer-note"><RefreshCw aria-hidden /> Source: UI_Enterprise_Demand · last refreshed {clean(asOf)}. One sheet row equals one lead record; Headcount and Nest potential are never summed.</p></section>
    </DashboardSectionAccordion>
  </section>
}
