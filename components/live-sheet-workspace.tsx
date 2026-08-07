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
