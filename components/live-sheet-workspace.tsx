import { Database, RefreshCw } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"

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

export type LiveWorkspaceKind = "Living" | "Work" | "Essentials" | "People" | "Economics" | "Member Feedback" | "Actions" | "Enterprise Demand"

export function LiveSheetWorkspace({ kind, rows, secondaryRows = [], asOf, allocationFocus }: { kind: LiveWorkspaceKind; rows: readonly Row[]; secondaryRows?: readonly Row[]; asOf: string; allocationFocus?: string }) {
  const primary = table(rows)
  const secondary = table(secondaryRows)
  const units = total(rows, ["members", "occupied nests", "activation ready nests", "orders", "units", "headcount"])
  const value = total(rows, ["gmv", "gmv inr", "cm2 inr", "revenue", "value", "monthly income"])
  const sectionNames = kind === "Enterprise Demand"
    ? ["Do this now", "Today's work", "Exceptions", "Supporting detail", "Proof & health"]
    : kind === "Work"
      ? ["Main point", "Today's work", "Exceptions", "Supporting detail", "Source and health"]
      : kind === "Member Feedback"
        ? ["Retention command", "Headline measures", "Members needing action", "Repeat issues", "Source and confidence"]
        : [`${kind} source`, `${kind} measures`, `${kind} records`, `${kind} supporting source`, "Source and health"]
  const sections = [
    { title: sectionNames[0], summary: rows.length ? `${rows.length} governed rows available` : `No governed ${kind.toLowerCase()} rows` },
    { title: sectionNames[1], summary: `${units || 0} operational units recorded` },
    { title: sectionNames[2], summary: rows.length ? `${rows.length} records to review` : "No verified records are open" },
    { title: sectionNames[3], summary: `${secondaryRows.length} supporting rows` },
    { title: sectionNames[4], summary: `Backend snapshot · ${clean(asOf)}` },
  ]
  return <DashboardSectionAccordion className={`pillar-screen ${kind.toLowerCase()}-screen live-sheet-workspace`} ariaLabel={`${kind} live sections`} sections={sections}>
    <div className="decision-bar"><div><span>LIVE GOVERNED DATA</span><strong>{kind} is rendered from the current backend-sheet snapshot.</strong></div><p>Last refreshed: {clean(asOf)}</p></div>
    {allocationFocus && <p className="target-note">Active allocation reference: {allocationFocus}</p>}
    <section className="people-headline" data-kpi-group>
      <article><span>Source rows</span><strong>{rows.length}</strong><small>Current governed records</small></article>
      <article><span>Supporting rows</span><strong>{secondaryRows.length}</strong><small>Linked by the backend model</small></article>
      <article><span>Operational units</span><strong>{units || "No data"}</strong><small>Sum of the available unit field</small></article>
      <article><span>Recorded value</span><strong>{value ? value.toLocaleString("en-IN") : "No data"}</strong><small>Sum of the available value field</small></article>
    </section>
    {rows.length ? <section className="operating-section"><h2>{kind} records</h2><DataTable caption={`${kind} governed records`} columns={primary.columns} rows={primary.rows} /></section> : <section className="work-empty"><Database aria-hidden /><h2>No governed {kind.toLowerCase()} rows</h2><p>Add data through the approved User Input or bot source; this screen does not invent fallback values.</p></section>}
    <section className="operating-section">{secondaryRows.length > 0 ? <><h2>Supporting records</h2><DataTable caption={`${kind} supporting records`} columns={secondary.columns} rows={secondary.rows} /></> : <><h2>No separate supporting records</h2><p className="footer-note">This page currently uses only its governed primary source.</p></>}</section>
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
