import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { DASHBOARD_TABS, FINANCE_TABS, OPERATIONS_TABS, SELF_LEARN_TABS } from "@/lib/dashboard-model"

const dashboard = readFileSync(new URL("./nia-dashboard.tsx", import.meta.url), "utf8")
const rail = readFileSync(new URL("./central-sidebar.tsx", import.meta.url), "utf8")
const sections = readFileSync(new URL("./dashboard-section-accordion.tsx", import.meta.url), "utf8")
const primitives = readFileSync(new URL("./operating-ui.tsx", import.meta.url), "utf8")
const login = readFileSync(new URL("./login-screen.tsx", import.meta.url), "utf8")
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

test("the route inventory remains complete and unchanged by the presentation redesign", () => {
  assert.deepEqual(OPERATIONS_TABS, ["Cash & Control", "Enterprise Demand", "New Adds", "Member Engagement", "Member Savings", "Nia Margins", "Nia Growth", "Despatch", "Your Sign-Off"])
  assert.deepEqual(SELF_LEARN_TABS, ["Overview", "Living", "Work", "Essentials", "Member Feedback", "People", "Definitions"])
  assert.deepEqual(FINANCE_TABS, ["Finance control"])
  assert.deepEqual(DASHBOARD_TABS, ["Overview", "Living", "Work", "Essentials", "People", "Member Feedback", "Economics", "Definitions", "Despatch"])
})

test("all current workspaces share exactly one global rail and a compact context strip", () => {
  assert.equal((dashboard.match(/<CentralSidebar\b/g) ?? []).length, 1)
  assert.doesNotMatch(dashboard, /EnterpriseContextRail|task-context-rail|x-page-details/)
  assert.match(dashboard, /<ContextStrip/)
  assert.match(css, /\.operating-context-strip/)
  assert.match(css, /\.central-shell[^}]+grid-template-columns/)
})

test("shared operating primitives cover context action evidence ownership metrics and disclosure", () => {
  for (const name of ["ContextStrip", "DecisionBand", "OwnerDueRow", "MetricStrip", "ChartPanel", "ReadonlyMetricRow", "SegmentedControl", "CompactDisclosure"]) assert.match(primitives, new RegExp(`export function ${name}`))
  assert.match(primitives, /Expected verified outcome/)
  assert.match(primitives, /role="tablist"/)
  assert.match(primitives, /aria-selected=/)
})

test("workspace sections are directly rendered and action-first without full-screen disclosures", () => {
  assert.match(sections, /actionFirstTitles/)
  assert.match(sections, /data-dashboard-decision=/)
  assert.doesNotMatch(sections, /<details|<summary|aria-expanded/)
  assert.match(css, /\.x-page-body \.dashboard-accordion \{[^}]*grid-template-columns:\s*1fr/)
  assert.match(css, /\.x-page-body \.dashboard-section-header[^}]*min-height:\s*46px/)
})

test("outline-managed pages do not duplicate section navigation in the horizontal header", () => {
  assert.match(dashboard, /const OUTLINE_MANAGED_TABS = new Set<DashboardTab>/)
  assert.match(dashboard, /if \(OUTLINE_MANAGED_TABS\.has\(active\)\) return null/)
  assert.match(dashboard, /enterpriseDemandPreview && !OUTLINE_MANAGED_TABS\.has\(active\)/)
})

test("the utility chip and Decision Room share one presentation period", () => {
  assert.equal((dashboard.match(/"Jul 2026"/g) ?? []).length, 1)
  assert.match(dashboard, /<span>\{DASHBOARD_PERIOD\}<\/span>/)
  assert.match(dashboard, /period=\{DASHBOARD_PERIOD\}/)
})

test("Self Drive has symmetric Decide and Operate landing surfaces", () => {
  assert.match(rail, /<p>Decide<\/p>[\s\S]*?<span>Decision Room<\/span>/)
  assert.match(rail, /<p>Operate<\/p>[\s\S]*?item=\{DESPATCH_ITEM\}/)
  assert.match(dashboard, /workspace === "self-drive" && next === "operate"\) setActive\("Despatch"\)/)
  assert.match(dashboard, /setActive\(next === "self-drive" \? "Despatch" : workspaceLandingTab\(next\)\)/)
  assert.match(dashboard, /nextWorkspace === "self-drive" && tab === "Despatch"/)
})

test("the mixed shell has no blue interaction accent and reserves colour for status", () => {
  assert.match(css, /--nia-blue:\s*#303438/i)
  assert.match(css, /--accent:\s*#111214/i)
  assert.match(css, /--status-bad:\s*#C9362B/i)
  assert.match(css, /--status-good:\s*#227A52/i)
  assert.match(css, /\.central-rail[^}]+background:\s*#0(?:9090a|b0b0c)/)
})

test("RafiQi Central casing is locked on metadata login navigation and accessibility surfaces", () => {
  for (const source of [layout, login, rail, dashboard]) assert.doesNotMatch(source, /Rafiqi Central/)
  assert.match(layout, /title: "RafiQi Central"/)
  assert.match(login, />RafiQi Central</)
  assert.match(rail, /aria-label="RafiQi Central navigation"/)
  assert.match(dashboard, /aria-label="Search RafiQi Central"/)
})
