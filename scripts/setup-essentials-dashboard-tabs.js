/* Creates the Sheets tabs used by the live Essentials screen and seeds safe test rows. */
require("dotenv").config({ path: ".env.local" })
const fs = require("fs"), path = require("path"), { google } = require("googleapis")
const now = "2026-07-24T19:00:00+05:30"
const dashboardHeaders = ["section", "key", "label", "value number", "value text", "owner actor id", "studio id", "supply model", "updated at", "notes"]
const dashboardRows = [
  ["Accordion", "essentials_accordion_main_title", "Main accordion title", 0, "Main point", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_main_summary", "Main accordion summary", 0, "{buyers} buying Members · CM {marginPct}.", "ACT-PRIYA", "", "", now, "Tokens available"],
  ["Accordion", "essentials_accordion_context_title", "Context accordion title", 0, "Allocation context", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_context_summary", "Context accordion summary", 0, "Review the active allocation mismatch and evidence.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_journey_title", "Journey accordion title", 0, "Member buying journey", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_journey_summary", "Journey accordion summary", 0, "7 live measures from eligibility to working capital.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_demand_title", "Demand accordion title", 0, "Demand", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_demand_summary", "Demand accordion summary", 0, "{cohortCount} Member groups tracked", "ACT-PRIYA", "", "", now, "Token: cohortCount"],
  ["Accordion", "essentials_accordion_supply_title", "Supply accordion title", 0, "Supply", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_supply_summary", "Supply accordion summary", 0, "{inventoryCount} Studio and SKU inventory records", "ACT-PRIYA", "", "", now, "Token: inventoryCount"],
  ["Accordion", "essentials_accordion_savings_title", "Savings accordion title", 0, "Savings and pricing", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_savings_summary", "Savings accordion summary", 0, "Member savings and stock actions are live.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Accordion", "essentials_accordion_stock_title", "Stock accordion title", 0, "Money in stock", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Main point", "essentials_main_kicker", "Main kicker", 0, "MAIN POINT", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Main point", "essentials_main_headline", "Main headline", 0, "{buyers} Members bought Essentials from {eligible} eligible Members; CM is {marginPct}.", "ACT-PRIYA", "", "", now, "Tokens available"],
  ["Main point", "essentials_main_explanation", "Main explanation", 0, "Marketing brings Member demand. EAE and Merchandising manage stock, fulfilled orders, and working capital.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_journey_kicker", "Journey kicker", 0, "MEMBER BUYING JOURNEY", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_eligible_label", "Eligible Members label", 0, "Eligible Members", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_eligible_note", "Eligible Members note", 0, "Essentials Demand · Marketing", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_attach_label", "Attach rate label", 0, "Attach rate", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_attach_note", "Attach rate note", 0, "Buying Members / eligible Members", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_gmv_label", "GMV label", 0, "GMV", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_gmv_note", "GMV note", 0, "Essentials billed · live sheet", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_arpu_label", "ARPU label", 0, "ARPU", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_arpu_note", "ARPU note", 0, "Essentials billed / buying Members", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_cm_label", "CM label", 0, "CM%", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_cm_note", "CM note", 0, "Nia margin / billed", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_savings_label", "Member savings label", 0, "Member savings", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_savings_note", "Member savings note", 0, "Member savings · live sheet", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_wc_label", "Working capital label", 0, "Working capital", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Journey", "essentials_headline_wc_note", "Working capital note", 0, "Owned inventory · Finance", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Demand", "essentials_demand_kicker", "Demand kicker", 0, "DEMAND · MARKETING TEAM", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Demand", "essentials_demand_heading", "Demand heading", 0, "Purchases by Member group", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Demand", "essentials_demand_intro", "Demand intro", 0, "We track repeat purchases for each Member group.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Demand", "essentials_demand_caption", "Demand table caption", 0, "Essentials purchases and repeat purchases by Member group", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Demand", "essentials_demand_stage_1", "Demand stage 1", 0, "Eligible Members", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Demand", "essentials_demand_stage_2", "Demand stage 2", 0, "Buying Members", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Demand", "essentials_demand_stage_3", "Demand stage 3", 0, "Orders fulfilled", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Supply", "essentials_supply_kicker", "Supply kicker", 0, "SUPPLY · EAE / MERCHANDISING", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Supply", "essentials_supply_heading", "Supply heading", 0, "Stock and Member savings by Studio and product", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Supply", "essentials_supply_intro", "Supply intro", 0, "List price and selling price show each Member's savings.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Supply", "essentials_supply_caption", "Supply table caption", 0, "Essentials stock by Studio and SKU", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Supply", "essentials_supply_stage_1", "Supply stage 1", 0, "Available units", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Supply", "essentials_supply_stage_2", "Supply stage 2", 0, "Orders fulfilled", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Supply", "essentials_supply_available", "Available supply units", 60, "", "ACT-PRIYA", "", "", now, "Operations enters available units"],
  ["Funnel copy", "essentials_funnel_today_label", "Funnel today label", 0, "Today", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_month_label", "Funnel month label", 0, "This month", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_how_to_read", "Funnel guide label", 0, "How to read it", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_how_to_read_explanation", "Funnel guide text", 0, "Wider shapes mean more remains from the first stage.", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_no_slow_step", "No slow step text", 0, "no slow step is visible.", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_end_stage", "End stage text", 0, "is the end stage.", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_slowest_step", "Slowest step text", 0, "is the slowest step at", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_slowest_badge", "Slowest badge", 0, "Slowest step", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_remains", "Remains text", 0, "remains", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_to_next", "To next text", 0, "to next step", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_from_last", "From last text", 0, "from last step", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Funnel copy", "essentials_funnel_last_step", "Last step text", 0, "Last step", "ACT-PRIYA", "", "", now, "Editable funnel copy"],
  ["Savings", "essentials_savings_kicker", "Savings kicker", 0, "LIST PRICE & SAVINGS", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Savings", "essentials_savings_heading", "Savings heading", 0, "Members save {savings} this period.", "ACT-PRIYA", "", "", now, "Token: savings"],
  ["Savings", "essentials_savings_month_label", "Current-period savings label", 0, "Per Member · current period", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Savings", "essentials_savings_cumulative_label", "Cumulative savings label", 0, "Per Member · cumulative", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Savings", "essentials_savings_network_label", "Network savings label", 0, "Network", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Savings", "essentials_savings_per_member_month", "Current-period savings per Member", 77, "", "ACT-PRIYA", "", "", now, "Operations enters INR per Member"],
  ["Savings", "essentials_savings_month_pct", "Current-period savings percentage", 20, "", "ACT-PRIYA", "", "", now, "Operations enters percentage"],
  ["Savings", "essentials_savings_per_member_cumulative", "Cumulative savings per Member", 540, "", "ACT-PRIYA", "", "", now, "Operations enters INR per Member"],
  ["Savings", "essentials_savings_cumulative_pct", "Cumulative savings percentage", 19, "", "ACT-PRIYA", "", "", now, "Operations enters percentage"],
  ["Savings", "essentials_savings_network", "Network savings", 2400, "", "ACT-PRIYA", "", "", now, "Operations enters total INR"],
  ["Savings", "essentials_savings_network_pct", "Network savings percentage", 20, "", "ACT-PRIYA", "", "", now, "Operations enters percentage"],
  ["Savings", "essentials_savings_target_note", "Savings target note", 0, "Target: at least 10% · Owner: Merchandising", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Pricing", "essentials_pricing_kicker", "Pricing kicker", 0, "PRICING ISSUE", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Pricing", "essentials_pricing_heading", "Pricing heading", 0, "{stockouts} products need action", "ACT-PRIYA", "", "", now, "Token: stockouts"],
  ["Pricing", "essentials_pricing_detail", "Pricing detail", 0, "Review each product’s buy price, selling price and Member savings target.", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Pricing", "essentials_pricing_owner", "Pricing owner", 0, "Owner: Merchandising", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_stock_kicker", "Stock kicker", 0, "MONEY IN STOCK · FINANCE", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_accordion_stock_summary", "Stock accordion summary", 0, "{ownedInventory} Nia capital · {dio} days inventory.", "ACT-PRIYA", "", "", now, "Tokens: ownedInventory, dio"],
  ["Stock", "essentials_stock_heading", "Stock heading", 0, "{ownedInventory} of Nia's money is tied up in stock.", "ACT-PRIYA", "", "", now, "Token: ownedInventory"],
  ["Stock", "essentials_owned_label", "Owned inventory label", 0, "OWNED INVENTORY", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_owned_note", "Owned inventory note", 0, "Nia capital", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_consigned_label", "Consigned inventory label", 0, "CONSIGNED INVENTORY", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_consigned_note", "Consigned inventory note", 0, "Supplier capital · excluded", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_dio_label", "DIO label", 0, "DIO", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_dio_note", "DIO note", 0, "Finance", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_dpo_label", "DPO label", 0, "DPO", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_dpo_note", "DPO note", 0, "Where terms exist", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_zero_sale_label", "Zero-sale capital label", 0, "ZERO-SALE CAPITAL", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_zero_sale_note", "Zero-sale capital note", 0, "Stock with no sales", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_wc_gmv_label", "Working-capital GMV label", 0, "WC / GMV", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_wc_gmv_note", "Working-capital GMV note", 0, "Owned inventory / GMV", "ACT-PRIYA", "", "", now, "Editable copy"],
  ["Stock", "essentials_owned_inventory", "Owned inventory", 680000, "", "ACT-PRIYA", "", "", now, "Operations enters current owned inventory INR"],
  ["Stock", "essentials_consigned_inventory", "Consigned inventory", 1140000, "", "ACT-PRIYA", "", "", now, "Operations enters current consigned inventory INR"],
  ["Stock", "essentials_dio", "Days inventory outstanding", 18, "", "ACT-PRIYA", "", "", now, "Operations enters days"],
  ["Stock", "essentials_dpo", "Days payable outstanding", 23, "", "ACT-PRIYA", "", "", now, "Operations enters days"],
  ["Stock", "essentials_zero_sale_capital", "Zero sale capital", 190000, "", "ACT-PRIYA", "", "", now, "Operations enters INR"],
  ["Stock", "essentials_wc_gmv_pct", "Working capital / GMV", 25.9, "", "ACT-PRIYA", "", "", now, "Operations enters percentage"],
]
const cohortHeaders = ["member group", "eligible", "buyers", "attach", "gmv", "aov", "frequency", "d30", "d60", "d90", "churn", "products per member"]
const cohortRows = [["Test Members", 72, 31, "43%", 9500, 306, "1.2", "36%", "24%", "18%", "12%", "1.4"]]
const inventoryHeaders = ["sku", "studio", "supply model", "mrp", "selling", "savings", "fill", "stockout", "days cover", "zero sale", "owner"]
const inventoryRows = [["ESS-TEST-001", "STU-SRI-01", "FONO", 320, 280, 40, "92%", "No", 18, "No", "Priya Rao (Test)"], ["ESS-TEST-STOCKOUT", "STU-SRI-01", "FONO", 410, 350, 60, "0%", "Yes", 0, "No", "Priya Rao (Test)"]]
async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"), "utf8"))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  const sheets = google.sheets({ version: "v4", auth }), spreadsheetId = process.env.GOOGLE_SHEET_ID
  let metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  for (const title of ["Essentials_Dashboard", "Essentials_Cohorts", "Essentials_Inventory"]) if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === title)) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } })
  const ensure = async (title, headers, rows) => { const current = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:Z` })).data.values || []; if (!current.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers, ...rows] } }); else { const keyIndex = title === "Essentials_Dashboard" ? 1 : 0; const existing = new Set(current.slice(1).map((row) => row[keyIndex])); const missing = rows.filter((row) => !existing.has(row[keyIndex])); if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A:Z`, valueInputOption: "USER_ENTERED", requestBody: { values: missing } }) } }
  await ensure("Essentials_Dashboard", dashboardHeaders, dashboardRows)
  await ensure("Essentials_Cohorts", cohortHeaders, cohortRows)
  await ensure("Essentials_Inventory", inventoryHeaders, inventoryRows)
  console.log("Essentials live-source tabs are ready.")
}
main().catch((error) => { console.error(error.message); process.exit(1) })
