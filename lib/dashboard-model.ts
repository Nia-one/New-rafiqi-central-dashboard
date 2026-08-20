export const DASHBOARD_TABS = ["Overview", "Living", "Work", "Essentials", "Business Report", "People", "Member Feedback", "Economics", "Definitions", "Despatch"] as const
export const LEGACY_DASHBOARD_TABS = ["Overview", "Operations Mandate", "Living", "Work", "Essentials", "People", "Member Feedback", "Economics", "Definitions", "Despatch"] as const
export const SELF_LEARN_TABS = ["Overview", "Living", "Work", "Essentials", "Business Report", "Member Feedback", "People", "Definitions"] as const
export const OPERATIONS_TABS = ["Cash & Control", "Enterprise Demand", "Enterprise Demand vs Supply", "New Adds", "Member Engagement", "Member Savings", "Nia Margins", "Nia Growth", "Despatch", "Your Sign-Off"] as const
export const FINANCE_TABS = ["Finance control"] as const
export type DashboardTab = (typeof DASHBOARD_TABS)[number] | (typeof OPERATIONS_TABS)[number] | (typeof FINANCE_TABS)[number]
export type LegacyDashboardTab = (typeof LEGACY_DASHBOARD_TABS)[number]
export type LegacyDashboardRoute = { screen: LegacyDashboardTab; subsection?: LivingSection }
export type DashboardWorkspace = "self-drive" | "self-learn" | "finance"
export const POST_LOGIN_DASHBOARD_STATE = Object.freeze({ workspace: "self-drive" as const, active: "Cash & Control" as const })

export function dashboardDisplayLabel(label: string) {
  return label
    .replaceAll("New Adds", "Member Adds")
    .replaceAll("Member Feedback", "Member NPS")
    .replaceAll("Definitions", "Learning History")
}

export function workspaceLandingTab(workspace: DashboardWorkspace): DashboardTab {
  return workspace === "self-learn" ? "Overview" : workspace === "finance" ? "Finance control" : "Cash & Control"
}
export type LivingSection = "fono" | "demand" | "supply" | "reconciliation"
export type DashboardRoute = { screen: DashboardTab; subsection?: LivingSection }

export const THEATRES = ["Rajputana (NCR)", "Deccan (Pune)", "Wellington (Karnataka)", "Coromandel (Tamil Nadu)"] as const
export const LIVING_SECTIONS = ["FONO", "Śram Park demand", "Śram Park supply", "Reconciliation"] as const
export const FONO_FUNNEL_STAGES = ["Studios visited", "Agreed", "Contracted", "KYC", "Live"] as const
export const SHRAM_PARK_FUNNEL_STAGES = ["Need named", "Terms agreed", "Contracted", "Live"] as const
export const RECONCILIATION_LABELS = ["Live demand", "Live capacity", "Occupied Nests"] as const
export const WORK_EMPTY_STATE = {
  title: "The Work data feed is not connected yet.",
  description: "When connected, this page will show ARPU (average revenue per Member) by Studio. It will also show each enterprise or employer's share. Missing data will stay blank, not become zero.",
  fields: ["Studio ID", "Theatre", "enterprise or employer", "active Members", "Work revenue", "period start", "period end"],
}

export const OVERVIEW_ROUTES: Record<string, DashboardRoute> = {
  contracted: { screen: "Living", subsection: "demand" },
  capacity: { screen: "Living", subsection: "supply" },
  active: { screen: "Living", subsection: "fono" },
  attach: { screen: "Essentials" },
  arpu: { screen: "Economics" },
  cm: { screen: "Economics" },
  Demand: { screen: "Living", subsection: "demand" },
  "Śram Park": { screen: "Living", subsection: "supply" },
  FONO: { screen: "Living", subsection: "fono" },
  Essentials: { screen: "Essentials" },
  Economics: { screen: "Economics" },
}

export type Metric = { label: string; value: string; note: string }
export type TableScreen = {
  title: string; subtitle: string; view: string; section: string; metrics: Metric[]
  panelTitle: string; columns: string[]; rows: string[][]; footer: string
}

export const TABLE_SCREENS: Record<"Essentials" | "Economics" | "People" | "Definitions", TableScreen> = {
  Essentials: {
    title: "Members save more and order again.", subtitle: "See who buys, what they buy, stock levels, and CM (contribution margin).", view: "Every 2 hours and daily", section: "MEMBER BUYING JOURNEY",
    metrics: [
      { label: "ELIGIBLE MEMBERS", value: "3,760", note: "Eligible Member denominator" },
      { label: "PURCHASING MEMBERS", value: "1,542", note: "Members purchasing in period" },
      { label: "ATTACH RATE", value: "41%", note: "Purchasing / eligible Members" },
      { label: "REVENUE / MEMBER", value: "₹118", note: "Essentials revenue / eligible Members" },
      { label: "INVESTORS ONBOARDED", value: "18", note: "Supplier-investor relationships" },
      { label: "ONLINE TRANSACTIONS", value: "2,806", note: "Completed digital transactions" },
      { label: "ORDERS", value: "3,118", note: "Completed Member orders" },
      { label: "UNITS", value: "5,604", note: "Units fulfilled" },
    ],
    panelTitle: "STUDIO × SKU ISSUES",
    columns: ["THEATRE", "STUDIO", "SKU", "SUPPLY MODEL", "AVAILABLE UNITS", "DAYS COVER", "FILL RATE", "ATTACH"],
    rows: [
      ["Wellington (Karnataka)", "Hosur 01", "Shampoo sachet", "Consigned", "42", "0.8", "81%", "9%"],
      ["Coromandel (Tamil Nadu)", "Sriperumbudur 02", "Mobile recharge", "Digital", "∞", "∞", "100%", "18%"],
      ["Deccan (Pune)", "Chakan 04", "Work footwear", "Demand pooled", "18", "5.0", "92%", "2%"],
    ], footer: "Track supplier stock, grouped demand, orders filled, repeat purchases and CM."
  },
  Economics: {
    title: "Build a strong Unit Economics Engine.", subtitle: "Use ARPU and contribution margin to strengthen value creation at every Theatre.", view: "Daily and monthly", section: "ARPU AND CM SUMMARY",
    metrics: [
      { label: "ARPU", value: "₹1,742", note: "Owner: Amrita Prasad" },
      { label: "CM1", value: "₹16.1L", note: "Owner: Finance · after Membership fee" },
      { label: "CM2", value: "₹13.6L", note: "Owner: Finance · after utilities" },
      { label: "CM2 / MEMBER", value: "₹588", note: "Owner: Finance · active Members" },
    ],
    panelTitle: "ARPU AND CM BY STUDIO", columns: ["THEATRE", "STUDIO", "ACTIVE MEMBERS", "ARPU", "CM1", "CM2"],
    rows: [["Rajputana (NCR)", "Gurgaon 05", "612", "₹1,806", "₹4.6L", "₹3.9L"], ["Wellington (Karnataka)", "Hosur 01", "504", "₹1,688", "₹3.8L", "₹3.1L"], ["Coromandel (Tamil Nadu)", "Sriperumbudur 02", "466", "₹1,721", "₹3.4L", "₹2.9L"]],
    footer: "CM1 = revenue − effective Membership fee. CM2 = CM1 − utilities."
  },
  People: {
    title: "Make everyone do their bit.", subtitle: "Give every person clear ownership, a measurable outcome, and a review rhythm.", view: "This month · weekly", section: "PEOPLE SUMMARY",
    metrics: [{ label: "PEOPLE", value: "10", note: "Named people in this list" }, { label: "STALE", value: "2", note: "No update in four hours" }, { label: "STALLED", value: "3", note: "No stage movement" }],
    panelTitle: "THEATRE → STUDIO → PERSON", columns: ["PERSON", "THEATRE", "ROLE", "STUDIO", "PRIMARY KPI", "ACTUAL", "FLAG"],
    rows: [["Aarav Mehta", "Wellington (Karnataka)", "JCO", "Hosur 01", "On-time readiness", "97%", "Current"], ["Rohan Iyer", "Coromandel (Tamil Nadu)", "EAE", "Sriperumbudur 02", "Fill rate", "92%", "Stale"], ["Vikram Singh", "Deccan (Pune)", "RM", "Chakan 04", "Demand coverage", "61%", "Stalled"], ["Karthik Rao", "Rajputana (NCR)", "JCO", "Gurgaon 05", "Actual vs plan", "101%", "Current"]],
    footer: "Every issue has one named person, one next step and one review time."
  },
  Definitions: {
    title: "Use one meaning for each number.", subtitle: "Find what each number means and where it comes from.", view: "Reference", section: "METRIC MEANINGS",
    metrics: [{ label: "EVERY 2 HOURS", value: "Field work", note: "Movement between steps and current problems" }, { label: "DAILY / MONTH TO DATE", value: "Daily progress", note: "Coverage, Attach, ARPU and CM" }, { label: "MEMBER GROUP", value: "Repeat buying", note: "Repeat purchases, active Members and products bought" }],
    panelTitle: "DEFINITIONS", columns: ["METRIC", "DEFINITION", "LEVEL USED", "SOURCE"],
    rows: [["Demand coverage", "Contracted Member demand / capacity ready.", "Location × date", "Demand CRM + property ledger"], ["Attach rate", "Eligible Members purchasing in period / eligible Members.", "Studio × period", "Transaction ledger"], ["CM1 / CM2", "CM1 deducts effective Membership fee; CM2 also deducts utilities.", "Studio × month", "Finance actuals"]],
    footer: "Give every number one meaning, level, source and owner."
  }
}

export const VISIBLE_DASHBOARD_COPY = JSON.stringify({ tabs: DASHBOARD_TABS, theatres: THEATRES, living: LIVING_SECTIONS, work: WORK_EMPTY_STATE, screens: TABLE_SCREENS })
