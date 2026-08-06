import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { essentialsCohorts, essentialsHeadline, essentialsInventory, teamBlocks } from "@/lib/operating-data"

type LiveRow = Record<string, unknown>

function LiveTable({ title, rows }: { title: string; rows: readonly LiveRow[] }) {
  if (!rows.length) return <section className="operating-section"><h2>{title}</h2><p className="footer-note">No verified records are available in the backend sheet.</p></section>
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => !key.startsWith("__"))
  return <section className="operating-section"><h2>{title}</h2><DataTable caption={title} columns={columns} rows={rows.map((row) => columns.map((key) => String(row[key] ?? "")))} /></section>
}

function liveValue(row: LiveRow | undefined, ...keys: string[]) {
  for (const key of keys) {
    const normalized = key.toLowerCase().replaceAll("_", " ")
    const found = Object.keys(row ?? {}).find((candidate) => candidate.toLowerCase().replaceAll("_", " ") === normalized)
    if (found && String(row?.[found] ?? "").trim()) return row?.[found]
  }
  return undefined
}

function liveNumber(row: LiveRow | undefined, ...keys: string[]) {
  const parsed = Number(String(liveValue(row, ...keys) ?? "").replace(/[₹,%\s,]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function EssentialsScreen({ allocationFocus, liveData = null }: { allocationFocus?: string; liveData?: { dashboard: readonly LiveRow[]; hourly?: readonly LiveRow[]; cohorts: readonly LiveRow[]; inventory: readonly LiveRow[] } | null }) {
  if (liveData !== undefined) {
    const dashboard = liveData?.dashboard ?? [], hourly = liveData?.hourly ?? [], cohorts = liveData?.cohorts ?? [], inventory = liveData?.inventory ?? []
    const firstDashboard = dashboard[0], firstInventory = inventory[0]
    const metric = (key: string) => dashboard.find((row) => String(liveValue(row, "key") ?? "") === key)
    const hourlySum = (key: string) => hourly.reduce((sum, row) => sum + liveNumber(row, key), 0)
    const eligible = hourlySum("eligible members")
    const buyers = hourlySum("buying members")
    const billed = hourlySum("essentials billed inr")
    const margin = hourlySum("nia margin inr")
    const templateValues: Record<string, string> = {
      buyers: buyers.toLocaleString("en-IN"),
      eligible: eligible.toLocaleString("en-IN"),
      marginPct: billed > 0 ? `${Math.round(margin / billed * 1_000) / 10}%` : "Not recorded",
      cohortCount: String(cohorts.length),
      inventoryCount: String(inventory.length),
      savings: `₹${hourlySum("member savings inr").toLocaleString("en-IN")}`,
      stockouts: String(hourlySum("current stockouts") || inventory.filter((row) => liveNumber(row, "stockout") > 0).length),
      ownedInventory: "Not recorded",
      dio: String(liveNumber(firstInventory, "days cover", "dio") || "Not recorded"),
    }
    const renderTemplate = (input: string) => Object.entries(templateValues).reduce((output, [key, replacement]) => output.replaceAll(`{${key}}`, replacement), input)
    const metricText = (key: string, fallback = "") => renderTemplate(String(liveValue(metric(key), "value text") ?? fallback))
    const metricDisplay = (key: string, fallback = "—") => String(liveValue(metric(key), "value text", "value number") ?? fallback)
    const journey = [
      ["essentials_headline_eligible_label", "Eligible Members", metricDisplay("essentials_headline_eligible", hourlySum("eligible members").toLocaleString("en-IN")), "essentials_headline_eligible_note"],
      ["essentials_headline_attach_label", "Attach rate", metricDisplay("essentials_headline_attach", hourlySum("eligible members") ? `${Math.round(hourlySum("buying members") / hourlySum("eligible members") * 100)}%` : "—"), "essentials_headline_attach_note"],
      ["essentials_headline_gmv_label", "GMV", metricDisplay("essentials_headline_gmv", `₹${hourlySum("essentials billed inr").toLocaleString("en-IN")}`), "essentials_headline_gmv_note"],
      ["essentials_headline_arpu_label", "ARPU", metricDisplay("essentials_headline_arpu"), "essentials_headline_arpu_note"],
      ["essentials_headline_cm_label", "CM", metricDisplay("essentials_headline_cm", `₹${hourlySum("nia margin inr").toLocaleString("en-IN")}`), "essentials_headline_cm_note"],
      ["essentials_headline_savings_label", "Member savings", metricDisplay("essentials_headline_savings", `₹${hourlySum("member savings inr").toLocaleString("en-IN")}`), "essentials_headline_savings_note"],
      ["essentials_headline_wc_label", "Working capital", metricDisplay("essentials_headline_wc"), "essentials_headline_wc_note"],
    ] as const
    const selling = inventory.reduce((sum, row) => sum + liveNumber(row, "selling price", "selling", "gmv inr"), 0)
    const mrp = inventory.reduce((sum, row) => sum + liveNumber(row, "mrp", "list price"), 0)
    const savingsPct = mrp > 0 ? Math.round((mrp - selling) / mrp * 1_000) / 10 : 0
    const ownedCapital = inventory.reduce((sum, row) => sum + liveNumber(row, "owned inventory value", "inventory value inr", "stock value"), 0)
    const daysCover = liveNumber(firstInventory, "days cover", "dio")
    return <DashboardSectionAccordion className="pillar-screen essentials-screen" ariaLabel="Essentials sections" sections={[
      { title: "Main point", summary: liveData ? "Live Essentials bot and backend records" : "Live snapshot unavailable" },
      { title: "Allocation context", summary: "Review the active allocation mismatch and evidence." },
      { title: "Member buying journey", summary: `${dashboard.length} verified dashboard records` },
      { title: "Demand", summary: `${cohorts.length} Member groups tracked` },
      { title: "Supply", summary: `${inventory.length} Studio and SKU inventory records` },
      { title: "Savings and pricing", summary: mrp ? `${savingsPct}% recorded Member savings` : "No governed pricing values available" },
      { title: "Money in stock", summary: ownedCapital ? `₹${ownedCapital.toLocaleString("en-IN")} recorded inventory capital` : "No governed inventory-capital value" },
    ]}>
      <div className="decision-bar"><div><span>{metricText("essentials_main_kicker", "MAIN POINT")}</span><strong>{metricText("essentials_main_headline", "Member buying, supply, savings and stock are driven by governed Essentials records.")}</strong></div><p>{metricText("essentials_main_explanation", "Orders and inventory remain bot-owned. Missing records stay missing.")}</p></div>
      <AllocationContextStrip mismatchId={allocationFocus} />
      <section><p className="pillar-kicker">{metricText("essentials_journey_kicker", "MEMBER BUYING JOURNEY")}</p><div className="essentials-spine">{journey.map(([labelKey, fallbackLabel, display, noteKey], index) => <article key={labelKey}><span>{String(index + 1).padStart(2, "0")} · {metricText(labelKey, fallbackLabel)}</span><strong>{display}</strong><small>{metricText(noteKey, "Governed Essentials data")}</small></article>)}</div></section>
      <section className="operating-section semantic-demand"><header><p className="pillar-kicker">DEMAND · MARKETING TEAM</p><h2>Purchases by Member group</h2><p>Repeat purchases remain grouped by the governed cohort rows.</p></header><LiveTable title="Essentials purchases and repeat purchases by Member group" rows={cohorts} /></section>
      <section className="operating-section semantic-supply"><header><p className="pillar-kicker">SUPPLY · EAE / MERCHANDISING</p><h2>Stock and Member savings by Studio and product</h2><p>Recorded list price and selling price drive Member savings.</p></header><LiveTable title="Essentials stock by Studio and SKU" rows={inventory} /></section>
      <section className="two-panel-grid"><article className="analysis-card"><p className="pillar-kicker">LIST PRICE &amp; SAVINGS</p><h2>{mrp ? `Members save ${savingsPct}% on recorded value.` : "No governed pricing value is available."}</h2><dl><div><dt>Recorded MRP</dt><dd>{mrp ? `₹${mrp.toLocaleString("en-IN")}` : "Not recorded"}</dd></div><div><dt>Recorded selling value</dt><dd>{selling ? `₹${selling.toLocaleString("en-IN")}` : "Not recorded"}</dd></div></dl></article><article className="analysis-card tension-card"><p className="pillar-kicker">PRICING CONTROL</p><h2>Only recorded bot pricing is evaluated.</h2><p>Missing buy price, selling price or Member-saving values remain unavailable and are never inferred.</p></article></section>
      <section className="operating-section"><header><p className="pillar-kicker">MONEY IN STOCK · FINANCE</p><h2>{ownedCapital ? `₹${ownedCapital.toLocaleString("en-IN")} recorded inventory capital.` : "No governed inventory-capital value is available."}</h2></header><div className="wc-grid"><article><span>OWNED INVENTORY</span><strong>{ownedCapital ? `₹${ownedCapital.toLocaleString("en-IN")}` : "—"}</strong><small>Recorded Nia capital</small></article><article><span>DAYS COVER</span><strong>{daysCover ? `${daysCover} days` : "—"}</strong><small>Recorded inventory cover</small></article><article><span>INVENTORY ROWS</span><strong>{inventory.length}</strong><small>Bot-owned records</small></article></div></section>
    </DashboardSectionAccordion>
  }
  const demand = teamBlocks.find((team) => team.name === "Essentials Demand")!
  const supply = teamBlocks.find((team) => team.name === "Essentials Supply")!
  return <DashboardSectionAccordion className="pillar-screen essentials-screen" ariaLabel="Essentials sections" sections={[
    { title: "Main point", summary: "Member buying is healthy; CM is 1.4 points below target." },
    { title: "Allocation context", summary: "Review the active allocation mismatch and evidence." },
    { title: "Member buying journey", summary: `${essentialsHeadline.length} stages from eligibility to repeat purchase` },
    { title: "Demand", summary: `${essentialsCohorts.length} Member groups tracked` },
    { title: "Supply", summary: `${essentialsInventory.length} Studio and SKU inventory records` },
    { title: "Savings and pricing", summary: "Members save 11.4% on average · 2 products need action." },
    { title: "Money in stock", summary: "₹6.8L Nia capital · 18 days inventory." },
  ]}><div className="decision-bar"><div><span>MAIN POINT</span><strong>Member buying is healthy. CM is 1.4 points below target. Nia must sell owned stock faster.</strong></div><p>Marketing brings in Member demand. EAE and Merchandising manage stock, filled orders, and money tied up in stock.</p></div><AllocationContextStrip mismatchId={allocationFocus} />
    <section><p className="pillar-kicker">MEMBER BUYING JOURNEY</p><div className="essentials-spine">{essentialsHeadline.map(([label, value, note], index) => <article key={label}><span>{String(index + 1).padStart(2,"0")} · {label}</span><strong>{value}</strong><small>{note}</small></article>)}</div></section>
    <section className="operating-section semantic-demand"><header><p className="pillar-kicker">DEMAND · MARKETING TEAM</p><h2>Purchases by Member group</h2><p>We track repeat purchases for each Member group.</p></header><TodayMtdFunnel stages={demand.stages} /><DataTable caption="Essentials purchases and repeat purchases by Member group" columns={["MEMBER GROUP","ELIGIBLE","BUYERS","ATTACH","GMV","AOV","FREQUENCY","D30","D60","D90","CHURN","PRODUCTS / MEMBER"]} rows={essentialsCohorts} /></section>
    <section className="operating-section semantic-supply"><header><p className="pillar-kicker">SUPPLY · EAE / MERCHANDISING</p><h2>Stock and Member savings by Studio and product</h2><p>List price and selling price show each Member's savings.</p></header><TodayMtdFunnel stages={supply.stages} /><DataTable caption="Essentials stock by Studio and SKU" columns={["SKU","STUDIO","SUPPLY MODEL","MRP","SELLING","SAVINGS","FILL","STOCKOUT","DAYS COVER","ZERO SALE","OWNER"]} rows={essentialsInventory} /></section>
    <section className="two-panel-grid"><article className="analysis-card"><p className="pillar-kicker">LIST PRICE & SAVINGS</p><h2>Members save 11.4% on average.</h2><dl><div><dt>Per Member · July</dt><dd>₹182 · 11.2%</dd></div><div><dt>Per Member · cumulative</dt><dd>₹684 · 10.8%</dd></div><div><dt>Network</dt><dd>₹3.4L · 11.4%</dd></div></dl><p className="target-note">Target: at least 10% · Owner: Merchandising</p></article><article className="analysis-card tension-card"><p className="pillar-kicker">PRICING ISSUE</p><h2>2 products cannot meet both promises</h2><p>Work footwear and detergent bar need either a lower buy price or a smaller range. Current pricing cannot deliver 20% CM and 10% Member savings together.</p><small>Owner: Amrita Prasad + Merchandising</small></article></section>
    <section className="operating-section"><header><p className="pillar-kicker">MONEY IN STOCK · FINANCE</p><h2>₹6.8L of Nia&apos;s money is tied up in stock.</h2></header><div className="wc-grid"><article><span>OWNED INVENTORY</span><strong>₹6.8L</strong><small>Nia capital</small></article><article><span>CONSIGNED INVENTORY</span><strong>₹11.4L</strong><small>Supplier capital · excluded</small></article><article><span>DIO</span><strong>18 days</strong><small>Finance</small></article><article><span>DPO</span><strong>23 days</strong><small>Where terms exist</small></article><article><span>ZERO-SALE CAPITAL</span><strong>₹1.9L</strong><small>28% of owned stock</small></article><article><span>WC / GMV</span><strong>25.9%</strong><small>₹6.8L / ₹26.3L</small></article></div></section>
  </DashboardSectionAccordion>
}
