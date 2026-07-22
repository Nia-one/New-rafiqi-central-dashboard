import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { essentialsCohorts, essentialsHeadline, essentialsInventory, teamBlocks } from "@/lib/operating-data"

export function EssentialsScreen({ allocationFocus }: { allocationFocus?: string }) {
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
