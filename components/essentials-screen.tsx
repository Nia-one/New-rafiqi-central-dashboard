"use client"

import { useEffect, useState } from "react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import type { FunnelStage } from "@/lib/operating-data"

type SheetRow = Record<string, unknown>

function field(row: SheetRow, ...names: string[]) {
  for (const name of names) {
    const match = Object.entries(row).find(([key]) => key.trim().toLowerCase() === name.toLowerCase())?.[1]
    if (match !== undefined && match !== null && String(match).trim() !== "") return String(match).trim()
  }
  return ""
}
function number(value: string) { const parsed = Number(value.replace(/[^0-9.-]/g, "")); return Number.isFinite(parsed) ? parsed : 0 }
function money(value: number) { return `₹${Math.round(value).toLocaleString("en-IN")}` }
function percentage(value: number) { return `${Math.round(value)}%` }

export function EssentialsScreen({ allocationFocus, allocationData, liveOpsData }: { allocationFocus?: string; allocationData?: unknown; liveOpsData?: { essentials?: SheetRow[]; essentialsDashboard?: SheetRow[]; essentialsCohorts?: SheetRow[]; essentialsInventory?: SheetRow[] } | null }) {
  const hourly = liveOpsData?.essentials ?? []
  const dashboard = liveOpsData?.essentialsDashboard ?? []
  const cohorts = liveOpsData?.essentialsCohorts ?? []
  const inventory = liveOpsData?.essentialsInventory ?? []
  const [pricingIssuesOpen, setPricingIssuesOpen] = useState(false)
  const [openIndex, setOpenIndex] = useState(-1)

  useEffect(() => {
    if (allocationFocus) setOpenIndex(1)
  }, [allocationFocus])
  const raw = hourly.reduce((total, row) => ({
    eligible: total.eligible + number(field(row, "eligible members")), buyers: total.buyers + number(field(row, "buying members")), orders: total.orders + number(field(row, "orders placed")), fulfilled: total.fulfilled + number(field(row, "orders fulfilled")), billed: total.billed + number(field(row, "essentials billed inr")), collected: total.collected + number(field(row, "essentials collected inr")), savings: total.savings + number(field(row, "member savings inr")), margin: total.margin + number(field(row, "nia margin inr")), stockouts: total.stockouts + number(field(row, "current stockouts")), zeroSales: total.zeroSales + number(field(row, "zero sale skus")),
  }), { eligible: 0, buyers: 0, orders: 0, fulfilled: 0, billed: 0, collected: 0, savings: 0, margin: 0, stockouts: 0, zeroSales: 0 })
  const attach = raw.eligible ? raw.buyers / raw.eligible * 100 : 0
  const marginPct = raw.billed ? raw.margin / raw.billed * 100 : 0
  const savingPct = raw.billed + raw.savings ? raw.savings / (raw.billed + raw.savings) * 100 : 0
  const metric = (key: string, fallback = 0) => { const row = dashboard.find((item) => field(item, "key") === key); const value = row ? number(field(row, "value number")) : 0; return value || fallback }
  const actionProducts = inventory.filter((row) => ["yes", "true", "1"].includes(field(row, "stockout", "action required").toLowerCase()))
  const actionProductCount = actionProducts.length || raw.stockouts
  const copy = (key: string, fallback: string) => { const row = dashboard.find((item) => field(item, "key") === key); const template = field(row ?? {}, "value text") || fallback; return template.replaceAll("{eligible}", raw.eligible.toLocaleString("en-IN")).replaceAll("{buyers}", raw.buyers.toLocaleString("en-IN")).replaceAll("{attachPct}", percentage(attach)).replaceAll("{billed}", money(raw.billed)).replaceAll("{savings}", money(raw.savings)).replaceAll("{margin}", money(raw.margin)).replaceAll("{marginPct}", percentage(marginPct)).replaceAll("{stockouts}", String(actionProductCount)).replaceAll("{zeroSales}", String(raw.zeroSales)).replaceAll("{cohortCount}", String(cohorts.length)).replaceAll("{inventoryCount}", String(inventory.length)).replaceAll("{ownedInventory}", money(metric("essentials_owned_inventory"))).replaceAll("{dio}", String(metric("essentials_dio"))) }
  const funnelCopy = (key: string, fallback: string) => copy(`essentials_funnel_${key}`, fallback)
  const stage = (label: string, value: number, next: number | null): FunnelStage => ({ label, today: value, mtd: value, todayConversion: next === null || value === 0 ? null : Math.round(next / value * 100), mtdConversion: next === null || value === 0 ? null : Math.round(next / value * 100), delta: "Live sheet" })
  const demandStages = [stage(copy("essentials_demand_stage_1", "Eligible Members"), raw.eligible, raw.buyers), stage(copy("essentials_demand_stage_2", "Buying Members"), raw.buyers, raw.fulfilled), stage(copy("essentials_demand_stage_3", "Orders fulfilled"), raw.fulfilled, null)]
  const supplyAvailable = metric("essentials_supply_available", raw.orders)
  const supplyStages = [stage(copy("essentials_supply_stage_1", "Available units"), supplyAvailable, raw.fulfilled), stage(copy("essentials_supply_stage_2", "Orders fulfilled"), raw.fulfilled, null)]
  const headline = [
    [copy("essentials_headline_eligible_label", "Eligible Members"), raw.eligible.toLocaleString("en-IN"), copy("essentials_headline_eligible_note", "Essentials Demand · Marketing")],
    [copy("essentials_headline_attach_label", "Attach rate"), percentage(attach), copy("essentials_headline_attach_note", "Buying Members / eligible Members")],
    [copy("essentials_headline_gmv_label", "GMV"), money(raw.billed), copy("essentials_headline_gmv_note", "Essentials billed · live sheet")],
    [copy("essentials_headline_arpu_label", "ARPU"), money(raw.buyers ? raw.billed / raw.buyers : 0), copy("essentials_headline_arpu_note", "Essentials billed / buying Members")],
    [copy("essentials_headline_cm_label", "CM%"), percentage(marginPct), copy("essentials_headline_cm_note", "Nia margin / billed")],
    [copy("essentials_headline_savings_label", "Member savings"), percentage(savingPct), copy("essentials_headline_savings_note", "Member savings · live sheet")],
    [copy("essentials_headline_wc_label", "Working capital"), money(metric("essentials_owned_inventory")), copy("essentials_headline_wc_note", "Owned inventory · Finance")],
  ]
  const cohortRows = cohorts.map((row) => [field(row, "member group"), field(row, "eligible"), field(row, "buyers"), field(row, "attach"), field(row, "gmv"), field(row, "aov"), field(row, "frequency"), field(row, "d30"), field(row, "d60"), field(row, "d90"), field(row, "churn"), field(row, "products per member")])
  const inventoryRows = inventory.map((row) => [field(row, "sku"), field(row, "studio"), field(row, "supply model"), field(row, "mrp"), field(row, "selling"), field(row, "savings"), field(row, "fill"), field(row, "stockout"), field(row, "days cover"), field(row, "zero sale"), field(row, "owner")])
  return <DashboardSectionAccordion className="pillar-screen essentials-screen" ariaLabel="Essentials sections" openIndex={openIndex} onOpenIndexChange={setOpenIndex} sections={[
    { title: copy("essentials_accordion_main_title", "Main point"), summary: copy("essentials_accordion_main_summary", "Member buying is healthy; CM is {marginPct}.") },
    { title: copy("essentials_accordion_context_title", "Allocation context"), summary: copy("essentials_accordion_context_summary", "Review the active allocation mismatch and evidence.") },
    { title: copy("essentials_accordion_journey_title", "Member buying journey"), summary: copy("essentials_accordion_journey_summary", "7 stages from eligibility to repeat purchase") },
    { title: copy("essentials_accordion_demand_title", "Demand"), summary: copy("essentials_accordion_demand_summary", "{cohortCount} Member groups tracked") },
    { title: copy("essentials_accordion_supply_title", "Supply"), summary: copy("essentials_accordion_supply_summary", "{inventoryCount} Studio and SKU inventory records") },
    { title: copy("essentials_accordion_savings_title", "Savings and pricing"), summary: copy("essentials_accordion_savings_summary", "Members save {attachPct} on average · {stockouts} products need action.") },
    { title: copy("essentials_accordion_stock_title", "Money in stock"), summary: copy("essentials_accordion_stock_summary", `${money(metric("essentials_owned_inventory"))} Nia capital · ${metric("essentials_dio")} days inventory.`) },
  ]}><div className="decision-bar"><div><span>{copy("essentials_main_kicker", "MAIN POINT")}</span><strong>{copy("essentials_main_headline", "Member buying has {buyers} buyers from {eligible} eligible Members and {marginPct} CM.")}</strong></div><p>{copy("essentials_main_explanation", "Marketing brings in Member demand. EAE and Merchandising manage stock, filled orders, and money tied up in stock.")}</p></div><AllocationContextStrip mismatchId={allocationFocus} allocationData={allocationData} />
    <section><p className="pillar-kicker">{copy("essentials_journey_kicker", "MEMBER BUYING JOURNEY")}</p><div className="essentials-spine">{headline.map(([label, value, note], index) => <article key={label}><span>{String(index + 1).padStart(2,"0")} · {label}</span><strong>{value}</strong><small>{note}</small></article>)}</div></section>
    <section className="operating-section semantic-demand"><header><p className="pillar-kicker">{copy("essentials_demand_kicker", "DEMAND · MARKETING TEAM")}</p><h2>{copy("essentials_demand_heading", "Purchases by Member group")}</h2><p>{copy("essentials_demand_intro", "We track repeat purchases for each Member group.")}</p></header><TodayMtdFunnel stages={demandStages} copy={funnelCopy} /><DataTable caption={copy("essentials_demand_caption", "Essentials purchases and repeat purchases by Member group")} columns={["MEMBER GROUP","ELIGIBLE","BUYERS","ATTACH","GMV","AOV","FREQUENCY","D30","D60","D90","CHURN","PRODUCTS / MEMBER"]} rows={cohortRows} /></section>
    <section className="operating-section semantic-supply"><header><p className="pillar-kicker">{copy("essentials_supply_kicker", "SUPPLY · EAE / MERCHANDISING")}</p><h2>{copy("essentials_supply_heading", "Stock and Member savings by Studio and product")}</h2><p>{copy("essentials_supply_intro", "List price and selling price show each Member's savings.")}</p></header><TodayMtdFunnel stages={supplyStages} copy={funnelCopy} /><DataTable caption={copy("essentials_supply_caption", "Essentials stock by Studio and SKU")} columns={["SKU","STUDIO","SUPPLY MODEL","MRP","SELLING","SAVINGS","FILL","STOCKOUT","DAYS COVER","ZERO SALE","OWNER"]} rows={inventoryRows} /></section>
    <section className="two-panel-grid"><article className="analysis-card"><p className="pillar-kicker">{copy("essentials_savings_kicker", "LIST PRICE & SAVINGS")}</p><h2>{copy("essentials_savings_heading", "Members save {savings} this period.")}</h2><dl><div><dt>{copy("essentials_savings_month_label", "Per Member · current period")}</dt><dd>{money(metric("essentials_savings_per_member_month"))} · {percentage(metric("essentials_savings_month_pct", savingPct))}</dd></div><div><dt>{copy("essentials_savings_cumulative_label", "Per Member · cumulative")}</dt><dd>{money(metric("essentials_savings_per_member_cumulative"))} · {percentage(metric("essentials_savings_cumulative_pct", savingPct))}</dd></div><div><dt>{copy("essentials_savings_network_label", "Network")}</dt><dd>{money(metric("essentials_savings_network", raw.savings))} · {percentage(metric("essentials_savings_network_pct", savingPct))}</dd></div></dl><p className="target-note">{copy("essentials_savings_target_note", "Target: at least 10% · Owner: Merchandising")}</p></article><article className="analysis-card tension-card"><p className="pillar-kicker">{copy("essentials_pricing_kicker", "PRICING ISSUE")}</p><button type="button" className="pricing-issue-trigger" onClick={() => setPricingIssuesOpen((open) => !open)} aria-expanded={pricingIssuesOpen}><h2>{copy("essentials_pricing_heading", "{stockouts} products need action")}</h2><span>{pricingIssuesOpen ? "Hide affected products" : "View affected products"}</span></button><p>{copy("essentials_pricing_detail", "Review each product’s buy price, selling price and Member savings target.")}</p><small>{copy("essentials_pricing_owner", "Owner: Merchandising")}</small>{pricingIssuesOpen && <ul className="pricing-issue-list">{actionProducts.length ? actionProducts.map((row) => <li key={`${field(row, "sku")}-${field(row, "studio")}`}><strong>{field(row, "sku")}</strong><span>{field(row, "studio")} · {field(row, "stockout") || "Action required"} · {field(row, "owner") || "Unassigned"}</span></li>) : <li><strong>No product row is marked for action.</strong><span>Update the Stockout or action-required field in Essentials_Inventory.</span></li>}</ul>}</article></section>
    <section className="operating-section"><header><p className="pillar-kicker">{copy("essentials_stock_kicker", "MONEY IN STOCK · FINANCE")}</p><h2>{copy("essentials_stock_heading", `${money(metric("essentials_owned_inventory"))} of Nia's money is tied up in stock.`)}</h2></header><div className="wc-grid"><article><span>{copy("essentials_owned_label", "OWNED INVENTORY")}</span><strong>{money(metric("essentials_owned_inventory"))}</strong><small>{copy("essentials_owned_note", "Nia capital")}</small></article><article><span>{copy("essentials_consigned_label", "CONSIGNED INVENTORY")}</span><strong>{money(metric("essentials_consigned_inventory"))}</strong><small>{copy("essentials_consigned_note", "Supplier capital · excluded")}</small></article><article><span>{copy("essentials_dio_label", "DIO")}</span><strong>{metric("essentials_dio")} days</strong><small>{copy("essentials_dio_note", "Finance")}</small></article><article><span>{copy("essentials_dpo_label", "DPO")}</span><strong>{metric("essentials_dpo")} days</strong><small>{copy("essentials_dpo_note", "Where terms exist")}</small></article><article><span>{copy("essentials_zero_sale_label", "ZERO-SALE CAPITAL")}</span><strong>{money(metric("essentials_zero_sale_capital"))}</strong><small>{copy("essentials_zero_sale_note", "Stock with no sales")}</small></article><article><span>{copy("essentials_wc_gmv_label", "WC / GMV")}</span><strong>{percentage(metric("essentials_wc_gmv_pct"))}</strong><small>{copy("essentials_wc_gmv_note", "Owned inventory / GMV")}</small></article></div></section>
  </DashboardSectionAccordion>
}
