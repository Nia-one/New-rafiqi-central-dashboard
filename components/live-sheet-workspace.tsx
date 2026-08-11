import { Database, RefreshCw } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { ENTERPRISE_PIPELINE_STAGES, enterprisePipelineStage } from "@/lib/enterprise-pipeline-stage"

type Row = Record<string, unknown>

const clean = (value: unknown) => value === null || value === undefined || String(value).trim() === "" ? "No data" : String(value)

function table(rows: readonly Row[]) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 12)
  return { columns: columns.map((column) => column.replaceAll("_", " ").toUpperCase()), rows: rows.map((row) => columns.map((column) => clean(row[column]))) }
}

function total(rows: readonly Row[], candidates: readonly string[]) {
  return rows.reduce((sum, row) => {
    const entry = Object.entries(row).find(([key]) => candidates.includes(key.trim().toLowerCase()))?.[1]
    const parsed = Number(String(entry ?? "").replace(/[^0-9.-]/g, ""))
    return sum + (Number.isFinite(parsed) ? parsed : 0)
  }, 0)
}

const text = (row: Row, key: string) => String(row[key] ?? "").trim()
const amount = (row: Row, key: string) => {
  const parsed = Number(String(row[key] ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}
const inr = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`

function CollectionsControl({ rows }: { rows: readonly Row[] }) {
  const collections = rows.filter((row) => text(row, "finance daily id").toUpperCase().startsWith("UI-COLL") && amount(row, "total billed inr") > 0)
  if (!collections.length) return <section className="operating-section" aria-label="Collections control"><h2>Collections control</h2><p className="footer-note">No billed collection rows are recorded yet. Blank template rows are excluded from every total and escalation.</p></section>
  const billed = collections.reduce((sum, row) => sum + amount(row, "total billed inr"), 0)
  const rawCollected = collections.reduce((sum, row) => sum + amount(row, "total collected inr"), 0)
  const collected = collections.reduce((sum, row) => sum + Math.min(Math.max(0, amount(row, "total collected inr")), Math.max(0, amount(row, "total billed inr"))), 0)
  const due = collections.reduce((sum, row) => sum + Math.max(0, amount(row, "total billed inr") - amount(row, "total collected inr")), 0)
  const advance = collections.reduce((sum, row) => sum + Math.max(0, amount(row, "total collected inr") - amount(row, "total billed inr")), 0)
  const open = collections.filter((row) => /open|partial|overdue/i.test(text(row, "reconciliation status")))
  const overdue = open.filter((row) => /overdue/i.test(text(row, "reconciliation status")))
  const grouped = (key: string) => [...new Set(collections.map((row) => text(row, key) || "Unassigned"))].map((label) => {
    const group = collections.filter((row) => (text(row, key) || "Unassigned") === label)
    return [label, String(group.length), inr(group.reduce((sum, row) => sum + amount(row, "total billed inr"), 0)), inr(group.reduce((sum, row) => sum + Math.min(Math.max(0, amount(row, "total collected inr")), Math.max(0, amount(row, "total billed inr"))), 0)), inr(group.reduce((sum, row) => sum + Math.max(0, amount(row, "total billed inr") - amount(row, "total collected inr")), 0))]
  }).sort((a, b) => Number(b[4].replace(/[^0-9.-]/g, "")) - Number(a[4].replace(/[^0-9.-]/g, "")))
  return <>
    <section className="operating-section" aria-label="Collections control"><h2>Collections control</h2><div className="people-headline" data-kpi-group>
      <article><span>Billed</span><strong>{inr(billed)}</strong><small>{collections.length} genuine invoices</small></article>
      <article><span>Applied collection</span><strong>{inr(collected)}</strong><small>{inr(rawCollected)} raw cash · {inr(advance)} advance</small></article>
      <article><span>Actual dues</span><strong>{inr(due)}</strong><small>{open.length} pending studios</small></article>
      <article><span>Overdue</span><strong>{overdue.length}</strong><small>Governed recovery required</small></article>
    </div></section>
    <section className="operating-section"><h2>Invoice-wise collection balance</h2><DataTable caption="Invoice-wise collection balance" columns={["INVOICE", "MEMBER / CUSTOMER", "STUDIO", "THEATRE", "BILLED", "COLLECTED", "ACTUAL DUE", "DUE DATE", "STATUS"]} rows={collections.map((row) => [text(row, "invoice id") || text(row, "finance daily id"), text(row, "customer or member ref") || "No data", text(row, "studio name") || text(row, "studio id") || "No data", text(row, "theatre name") || text(row, "theatre id") || "No data", inr(amount(row, "total billed inr")), inr(amount(row, "total collected inr")), inr(Math.max(0, amount(row, "total billed inr") - amount(row, "total collected inr"))), text(row, "due date") || "No data", text(row, "reconciliation status") || "Open"])} /></section>
    <section className="operating-section"><h2>Studio-wise pending collection</h2><DataTable caption="Studio-wise pending collection" columns={["STUDIO", "INVOICES", "BILLED", "COLLECTED", "PENDING"]} rows={grouped("studio name")} /></section>
    <section className="operating-section"><h2>Theatre-wise pending collection</h2><DataTable caption="Theatre-wise pending collection" columns={["THEATRE", "INVOICES", "BILLED", "COLLECTED", "PENDING"]} rows={grouped("theatre name")} /></section>
    <section className="operating-section"><h2>Due and overdue recovery queue</h2>{open.length ? <DataTable caption="Due and overdue collection recovery queue" columns={["PRIORITY", "INVOICE", "OWNER", "DUE", "PENDING", "NEXT CONTROL"]} rows={open.sort((a, b) => Number(/overdue/i.test(text(b, "reconciliation status"))) - Number(/overdue/i.test(text(a, "reconciliation status")))).map((row) => [/overdue/i.test(text(row, "reconciliation status")) ? "OVERDUE" : "DUE", text(row, "invoice id") || text(row, "finance daily id"), text(row, "finance reviewer") || text(row, "business owner") || "Unassigned", text(row, "due date") || "No date", inr(Math.max(0, amount(row, "total billed inr") - amount(row, "total collected inr"))), /overdue/i.test(text(row, "reconciliation status")) ? "Escalate to Finance reviewer" : "Collect before due date"])} /> : <p className="footer-note">No due or overdue collection is open.</p>}</section>
  </>
}

export type LiveWorkspaceKind = "Living" | "Work" | "Essentials" | "People" | "Economics" | "Member Feedback" | "Actions" | "Enterprise Demand"

const rowValue = (row: Row, ...keys: string[]) => {
  const wanted = new Set(keys.map((key) => key.toLowerCase()))
  return Object.entries(row).find(([key]) => wanted.has(key.trim().toLowerCase().replaceAll("_", " ")))?.[1]
}

export function EnterpriseStageWorkspace({ rows, asOf }: { rows: readonly Row[]; asOf: string }) {
  const staged = rows.map((row) => ({
    row,
    stage: enterprisePipelineStage(rowValue(row, "stage", "certainty"), rowValue(row, "status")),
  }))
  const counts = Object.fromEntries(ENTERPRISE_PIPELINE_STAGES.map((stage) => [stage, staged.filter((entry) => entry.stage === stage).length])) as Record<(typeof ENTERPRISE_PIPELINE_STAGES)[number], number>
  const approved = ENTERPRISE_PIPELINE_STAGES.reduce((sum, stage) => sum + counts[stage], 0)
  const excluded = rows.length - approved
  const maximum = Math.max(1, ...ENTERPRISE_PIPELINE_STAGES.map((stage) => counts[stage]))
  const theatres = [...new Set(rows.map((row) => String(rowValue(row, "theatre name", "theatre", "theatre id") ?? "Unassigned").trim() || "Unassigned"))]
    .map((theatre) => {
      const entries = staged.filter(({ row }) => (String(rowValue(row, "theatre name", "theatre", "theatre id") ?? "Unassigned").trim() || "Unassigned") === theatre)
      return { theatre, counts: Object.fromEntries(ENTERPRISE_PIPELINE_STAGES.map((stage) => [stage, entries.filter((entry) => entry.stage === stage).length])) as Record<(typeof ENTERPRISE_PIPELINE_STAGES)[number], number> }
    })
    .sort((a, b) => ENTERPRISE_PIPELINE_STAGES.reduce((sum, stage) => sum + b.counts[stage] - a.counts[stage], 0))

  const tabs = [
    { title: "Stage-wise leads", summary: `${approved} active lead records` },
    { title: "Theatre performance", summary: `${theatres.length} theatres · stage-wise` },
    { title: "Lead records", summary: `${rows.length} live sheet rows` },
    { title: "Supporting detail", summary: "Source mapping & exclusions" },
    { title: "Proof & health", summary: `Last refreshed · ${clean(asOf)}` },
  ]
  return <section className="pillar-screen enterprise-stage-workspace" aria-label="Enterprise Demand stage-wise lead counts">
    <div className="decision-bar"><div><span>LIVE ENTERPRISE DEMAND</span><strong>Lead records by current pipeline stage</strong></div><p>Last refreshed: {clean(asOf)}</p></div>
    <DashboardSectionAccordion className="enterprise-outline" ariaLabel="Enterprise Demand sections" sections={tabs}>
    <section className="operating-section enterprise-stage-summary">
      <div className="enterprise-stage-heading"><div><p className="pillar-kicker">STAGE-WISE LEAD COUNT</p><h2>{approved} active lead records</h2></div><p>{rows.length} live sheet rows{excluded > 0 ? ` · ${excluded} Drop/invalid excluded` : ""}</p></div>
      <div className="enterprise-record-funnel">
        {ENTERPRISE_PIPELINE_STAGES.map((stage, index) => <article key={stage} style={{ "--stage-delay": `${index * 70}ms` } as React.CSSProperties}>
          <div><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage}</strong><b>{counts[stage]}</b></div>
          <i><b style={{ width: `${counts[stage] ? Math.max(3, counts[stage] / maximum * 100) : 0}%` }} /></i>
          <small>{counts[stage]} lead record{counts[stage] === 1 ? "" : "s"}</small>
        </article>)}
      </div>
    </section>
    <section className="operating-section enterprise-theatre-performance">
      <div className="enterprise-stage-heading"><div><p className="pillar-kicker">THEATRE PERFORMANCE</p><h2>Theatre-wise stage distribution</h2></div><p>Record counts, not Nest potential</p></div>
      <div className="enterprise-theatre-table-wrap"><table><thead><tr><th>Theatre</th>{ENTERPRISE_PIPELINE_STAGES.map((stage) => <th key={stage}>{stage}</th>)}<th>Total</th></tr></thead><tbody>
        {theatres.map(({ theatre, counts: theatreCounts }, rowIndex) => { const total = ENTERPRISE_PIPELINE_STAGES.reduce((sum, stage) => sum + theatreCounts[stage], 0); return <tr key={theatre} style={{ "--stage-delay": `${rowIndex * 90}ms` } as React.CSSProperties}><th>{theatre}</th>{ENTERPRISE_PIPELINE_STAGES.map((stage) => <td key={stage}><span style={{ "--cell-width": `${total ? theatreCounts[stage] / total * 100 : 0}%` } as React.CSSProperties}>{theatreCounts[stage]}</span></td>)}<td><strong>{total}</strong></td></tr> })}
      </tbody></table></div>
    </section>
    <section className="operating-section"><h2>Live Enterprise lead records</h2>{rows.length ? <DataTable caption="Enterprise Demand live lead records" columns={table(rows).columns} rows={table(rows).rows} /> : <p className="footer-note">No current live rows are available.</p>}</section>
    <section className="operating-section"><h2>Source mapping</h2><p className="footer-note">Counts use one row per live Enterprise Demand record. Headcount and Nest-potential fields do not affect any stage total. Drop and unknown stages are excluded.</p></section>
    <section className="operating-section"><h2>Proof &amp; health</h2><p className="footer-note"><RefreshCw aria-hidden /> Governed source: UI_Enterprise_Demand · last refreshed {clean(asOf)}.</p></section>
    </DashboardSectionAccordion>
  </section>
}

export function LiveSheetWorkspace({ kind, rows, secondaryRows = [], asOf, allocationFocus }: { kind: LiveWorkspaceKind; rows: readonly Row[]; secondaryRows?: readonly Row[]; asOf: string; allocationFocus?: string }) {
  const primary = table(rows)
  const secondary = table(secondaryRows)
  const enterpriseRequired = total(rows, ["headcount required"])
  const enterpriseMatched = total(rows, ["headcount matched"])
  const enterpriseOpen = Math.max(0, enterpriseRequired - enterpriseMatched)
  const units = kind === "Enterprise Demand" ? enterpriseRequired : total(rows, ["members", "occupied nests", "activation ready nests", "orders", "units", "headcount"])
  const value = total(rows, ["gmv", "gmv inr", "cm2 inr", "revenue", "value", "monthly income"])
  const sectionNames = kind === "Enterprise Demand"
    ? ["Do this now", "Today's work", "Exceptions", "Supporting detail", "Proof & health"]
    : kind === "Work"
      ? ["Main point", "Today's work", "Exceptions", "Supporting detail", "Source and health"]
      : kind === "Member Feedback"
        ? ["Retention command", "Headline measures", "Members needing action", "Repeat issues", "Source and confidence"]
        : [`${kind} source`, `${kind} measures`, `${kind} records`, `${kind} supporting source`, "Source and health"]
  const sections = [
    { title: sectionNames[0], summary: kind === "Enterprise Demand" && rows.length ? `${rows.length} demands · ${enterpriseOpen} Nests still open` : rows.length ? `${rows.length} governed rows available` : `No governed ${kind.toLowerCase()} rows` },
    { title: sectionNames[1], summary: kind === "Enterprise Demand" ? `${enterpriseRequired} required · ${enterpriseMatched} matched` : `${units || 0} operational units recorded` },
    { title: sectionNames[2], summary: rows.length ? `${rows.length} records to review` : "No verified records are open" },
    { title: sectionNames[3], summary: kind === "Enterprise Demand" && secondaryRows.length === 0 ? "No Enterprise supply matched yet" : `${secondaryRows.length} supporting rows` },
    { title: sectionNames[4], summary: `Backend snapshot · ${clean(asOf)}` },
  ]
  return <DashboardSectionAccordion className={`pillar-screen ${kind.toLowerCase()}-screen live-sheet-workspace`} ariaLabel={`${kind} live sections`} sections={sections}>
    <div className="decision-bar"><div><span>LIVE GOVERNED DATA</span><strong>{kind} is rendered from the current backend-sheet snapshot.</strong></div><p>Last refreshed: {clean(asOf)}</p></div>
    {allocationFocus && <p className="target-note">Active allocation reference: {allocationFocus}</p>}
    <section className="people-headline" data-kpi-group>
      <article><span>Source rows</span><strong>{rows.length}</strong><small>Current governed records</small></article>
      <article><span>Supporting rows</span><strong>{secondaryRows.length}</strong><small>Linked by the backend model</small></article>
      <article><span>{kind === "Enterprise Demand" ? "Required Nests" : "Operational units"}</span><strong>{units || "No data"}</strong><small>{kind === "Enterprise Demand" ? "Confirmed Enterprise demand" : "Sum of the available unit field"}</small></article>
      <article><span>{kind === "Enterprise Demand" ? "Matched Nests" : "Recorded value"}</span><strong>{kind === "Enterprise Demand" ? enterpriseMatched : value ? value.toLocaleString("en-IN") : "No data"}</strong><small>{kind === "Enterprise Demand" ? `${enterpriseOpen} Nests remain open` : "Sum of the available value field"}</small></article>
    </section>
    {rows.length ? <section className="operating-section"><h2>{kind} records</h2>{kind === "Economics" && <CollectionsControl rows={rows} />}<DataTable caption={`${kind} governed records`} columns={primary.columns} rows={primary.rows} /></section> : <section className="work-empty"><Database aria-hidden /><h2>No governed {kind.toLowerCase()} rows</h2><p>Add data through the approved User Input or bot source; this screen does not invent fallback values.</p></section>}
    <section className="operating-section">{secondaryRows.length > 0 ? <><h2>Supporting records</h2><DataTable caption={`${kind} supporting records`} columns={secondary.columns} rows={secondary.rows} /></> : kind === "Enterprise Demand" ? <><h2>No Enterprise supply matched yet</h2><p className="footer-note">The confirmed demand remains open. It is not counted as supply, occupied capacity, or a completed contract.</p></> : <><h2>No separate supporting records</h2><p className="footer-note">This page currently uses only its governed primary source.</p></>}</section>
    <section className="operating-section"><h2>Source and health</h2><p className="footer-note"><RefreshCw aria-hidden /> One backend refresh updates every page that reuses these records. Last refreshed: {clean(asOf)}.</p></section>
  </DashboardSectionAccordion>
}

export function LiveOverviewWorkspace({ liveOpsData }: { liveOpsData: any }) {
  const groups: Array<[string, readonly Row[]]> = [
    ["Living", liveOpsData?.living ?? []], ["Work", liveOpsData?.work ?? []], ["Essentials", liveOpsData?.essentials ?? []],
    ["People", liveOpsData?.people ?? []], ["Enterprise demand", liveOpsData?.enterpriseDemand ?? []], ["Actions", liveOpsData?.actionLog ?? []],
  ]
  return <section className="pillar-screen live-overview"><div className="decision-bar"><div><span>MASTER DASHBOARD</span><strong>One live snapshot links source pages to the master view.</strong></div><p>Last refreshed: {clean(liveOpsData?.meta?.updatedAt ?? liveOpsData?.fetchedAt)}</p></div><section className="people-headline" data-kpi-group>{groups.map(([label, group]) => <article key={label}><span>{label}</span><strong>{group.length}</strong><small>Governed source rows</small></article>)}</section><section className="operating-section"><h2>Live source coverage</h2><DataTable caption="Live source coverage" columns={["DOMAIN", "ROWS", "SOURCE"]} rows={groups.map(([label, group]) => [label, String(group.length), group.length ? "Backend sheet" : "No data"])} /></section></section>
}
