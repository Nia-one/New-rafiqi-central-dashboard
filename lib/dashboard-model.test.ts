import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { dashboardDisplayLabel, DASHBOARD_TABS, FONO_FUNNEL_STAGES, LEGACY_DASHBOARD_TABS, LIVING_SECTIONS, OPERATIONS_TABS, OVERVIEW_ROUTES, POST_LOGIN_DASHBOARD_STATE, RECONCILIATION_LABELS, SELF_LEARN_TABS, SHRAM_PARK_FUNNEL_STAGES, THEATRES, VISIBLE_DASHBOARD_COPY, WORK_EMPTY_STATE, workspaceLandingTab } from "./dashboard-model"

const bannedTerms = ["resident", "tenant", "PG", "hostel", "bed", "rent"]
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")
const dashboardShell = readFileSync(new URL("../components/nia-dashboard.tsx", import.meta.url), "utf8")
const flywheelOverview = readFileSync(new URL("../components/overview/flywheel-overview.tsx", import.meta.url), "utf8")
const todayMtdFunnel = readFileSync(new URL("../components/today-mtd-funnel.tsx", import.meta.url), "utf8")
const nextConfig = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8")
const approvedTokens = {
  canvas: "#12110E", bg: "#12110E", surface: "#1B1915",
  ink: "#F5F2EB", muted: "#8C8574", faint: "#6F6858", border: "#2F2B23",
}

test("visual system uses the approved font stack and semantic tokens", () => {
  assert.match(css, /--font-ui:\s*-apple-system,\s*BlinkMacSystemFont,\s*"SF Pro Text",\s*Inter/)
  assert.doesNotMatch(layout, /Geist|IBM_Plex|Arial|serif|mono/i)
  for (const [name, value] of Object.entries(approvedTokens)) assert.match(css, new RegExp(`--${name}:\\s*${value}`, "i"))
  assert.match(css, /--accent:\s*var\(--interactive\)/)
  assert.match(css, /--interactive:\s*var\(--nia-blue\)/)
})

test("visual system uses semantic tones and reserves blue for interaction", () => {
  for (const tone of ["critical", "breach", "attention", "verified", "neutral"]) assert.match(css, new RegExp(`--tone-${tone}:`))
  assert.doesNotMatch(css, /font-weight:\s*(700|800|900)/)
  assert.match(css, /\.nav > button\.despatch-nav[^}]*color:\s*var\(--clay\)/)
  assert.match(css, /\.add,[\s\S]*?background:\s*var\(--clay\)/)
  assert.match(css, /\.heartbeat-priority[^}]*border-left-color:\s*var\(--clay\)/)
  assert.match(css, /\.spine-link\.broken,[\s\S]*?color:\s*var\(--clay\)/)
  assert.doesNotMatch(css, /--clay\)[^}]*}\s*\.queue-gap|\.queue-gap\s*{[^}]*var\(--clay\)/)
})

test("top navigation uses exact business-model order without former screens", () => {
  assert.deepEqual(DASHBOARD_TABS, ["Overview", "Living", "Work", "Essentials", "People", "Member Feedback", "Economics", "Definitions", "Despatch"])
  assert.equal(DASHBOARD_TABS.at(-1), "Despatch")
  for (const former of ["Shram Park", "FONO", "Demand"]) assert.equal((DASHBOARD_TABS as readonly string[]).includes(former), false)
})

test("release-off navigation preserves the exact legacy tabs and landing route", () => {
  assert.deepEqual(LEGACY_DASHBOARD_TABS, ["Overview", "Operations Mandate", "Living", "Work", "Essentials", "People", "Member Feedback", "Economics", "Definitions", "Despatch"])
  assert.equal(LEGACY_DASHBOARD_TABS[1], "Operations Mandate")
})

test("Self Drive exposes the complete command-to-sign-off operating arc", () => {
  assert.deepEqual(OPERATIONS_TABS, ["Cash & Control", "Enterprise Demand", "New Adds", "Member Engagement", "Member Savings", "Nia Margins", "Nia Growth", "Despatch", "Your Sign-Off"])
  assert.equal(OPERATIONS_TABS[0], "Cash & Control")
  assert.equal(OPERATIONS_TABS.at(-1), "Your Sign-Off")
})

test("Self Drive preserves internal routes while presenting Member Adds", () => {
  assert.equal(OPERATIONS_TABS[2], "New Adds")
  assert.deepEqual(OPERATIONS_TABS.map(dashboardDisplayLabel), ["Cash & Control", "Enterprise Demand", "Member Adds", "Member Engagement", "Member Savings", "Nia Margins", "Nia Growth", "Despatch", "Your Sign-Off"])
  assert.equal(workspaceLandingTab("self-drive"), "Cash & Control")
  assert.equal(workspaceLandingTab("self-learn"), "Overview")
  assert.equal(workspaceLandingTab("finance"), "Finance control")
})

test("platform shell uses a top workspace switch with no permanent rail", () => {
  assert.match(dashboardShell, /className="platform-utility"/)
  assert.match(dashboardShell, /<ModeSelect/)
  assert.match(css, /\.mode-select-trigger/)
  assert.match(dashboardShell, /Self Drive/)
  assert.match(dashboardShell, /Self Learn/)
  assert.doesNotMatch(dashboardShell, /<aside className="central-rail"/)
  assert.doesNotMatch(css, /grid-template-columns:\s*216px/)
})

test("post-login starts directly in Self Drive instead of the obsolete chooser", () => {
  assert.deepEqual(POST_LOGIN_DASHBOARD_STATE, { workspace: "self-drive", active: "Cash & Control" })
  assert.notEqual(POST_LOGIN_DASHBOARD_STATE.workspace, "chooser")
})

test("Self Learn puts Member NPS before People and ends with learning history", () => {
  assert.deepEqual(SELF_LEARN_TABS, ["Overview", "Living", "Work", "Essentials", "Member Feedback", "People", "Definitions"])
})

test("local previews allow both supported development hosts", () => {
  assert.match(nextConfig, /allowedDevOrigins:\s*\["127\.0\.0\.1",\s*"localhost"\]/)
})

test("product naming uses Rafiqi Central consistently", () => {
  const productCopy = `${layout}\n${dashboardShell}`
  assert.match(productCopy, /Rafiqi Central/)
  assert.doesNotMatch(productCopy, /\bNIA\b/)
  assert.doesNotMatch(productCopy, /Operating System/i)
})

test("Overview presents one continuity platform with three connected pillars", () => {
  assert.match(dashboardShell, /Nia is the Migrant Worker Continuity Platform/)
  assert.match(dashboardShell, /Living, Work and Essentials operate as one flywheel/)
  assert.match(flywheelOverview, /One system\. Three connected pillars\./)
  for (const stage of ["Community Living", "Access to work", "Lower-cost Essentials", "Greater stability", "Stronger Living demand"]) assert.match(flywheelOverview, new RegExp(stage))
})

test("Today and MTD use tapered funnel segments rather than progress bars", () => {
  assert.match(todayMtdFunnel, /className="funnel-shape"/)
  assert.match(todayMtdFunnel, /className="funnel-segment"/)
  assert.match(todayMtdFunnel, /clipPath/)
  assert.match(todayMtdFunnel, /is the slowest step at/)
  assert.match(todayMtdFunnel, /How to read it/)
  assert.doesNotMatch(todayMtdFunnel, /funnel-bar-track|funnel-bar-fill/)
})

test("Living exposes all required subsections and Overview routes", () => {
  assert.deepEqual(LIVING_SECTIONS, ["FONO", "Shram Park demand", "Shram Park supply", "Reconciliation"])
  assert.deepEqual(OVERVIEW_ROUTES.contracted, { screen: "Living", subsection: "demand" })
  assert.deepEqual(OVERVIEW_ROUTES.capacity, { screen: "Living", subsection: "supply" })
  assert.deepEqual(OVERVIEW_ROUTES.active, { screen: "Living", subsection: "fono" })
})

test("Living funnels and reconciliation retain approved stage order and labels", () => {
  assert.deepEqual(FONO_FUNNEL_STAGES, ["Studios visited", "Agreed", "Contracted", "KYC", "Live"])
  assert.deepEqual(SHRAM_PARK_FUNNEL_STAGES, ["Need named", "Terms agreed", "Contracted", "Live"])
  assert.deepEqual(RECONCILIATION_LABELS, ["Live demand", "Live capacity", "Occupied Nests"])
})

test("Work empty state names future output and required source fields", () => {
  assert.match(WORK_EMPTY_STATE.description, /ARPU \(average revenue per Member\) by Studio/)
  assert.match(WORK_EMPTY_STATE.description, /enterprise or employer/)
  for (const field of ["Studio ID", "Theatre", "active Members", "Work revenue"]) assert.ok(WORK_EMPTY_STATE.fields.includes(field))
})

test("visible model uses canonical Theatre names and excludes banned housing terms", () => {
  assert.deepEqual(THEATRES, ["Rajputana (NCR)", "Deccan (Pune)", "Wellington (Karnataka)", "Coromandel (Tamil Nadu)"])
  for (const term of bannedTerms) assert.equal(new RegExp(`\\b${term}\\b`, "i").test(VISIBLE_DASHBOARD_COPY), false, `Found banned term: ${term}`)
})
