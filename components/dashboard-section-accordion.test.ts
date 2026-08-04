import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

const sections = [
  { title: "First", summary: "Primary status remains visible.", visual: { kind: "progress" as const, value: 7, max: 10, label: "7 of 10 complete" } },
  { title: "Second", summary: "Secondary status remains visible." },
] as const

function renderAccordion() {
  return renderToStaticMarkup(
    createElement(
      DashboardSectionAccordion,
      { sections, ariaLabel: "Test sections", children: [createElement("div", { key: 0 }, "First body"), createElement("div", { key: 1 }, "Second body")] }
    )
  )
}

test("dashboard section layout renders every section behind a persistent outline with one focused card", () => {
  const html = renderAccordion()
  // No accordion disclosure state: sections are never collapsed behind expanders.
  assert.doesNotMatch(html, /aria-expanded=|aria-controls=/)
  // The outline pane lists every section; the canvas keeps all sections mounted
  // but shows exactly one focused card at a time.
  assert.match(html, /dashboard-outline-pane/)
  assert.match(html, /aria-current="true"/)
  assert.equal((html.match(/data-dashboard-section-index=/g) ?? []).length, 2)
  assert.equal((html.match(/<section[^>]+hidden=""/g) ?? []).length, 1)
  assert.match(html, /role="region"[^>]+aria-labelledby=/)
  assert.match(html, /First body/)
  assert.match(html, /Second body/)
})

test("dashboard section layout keeps summaries and accessible relationships visible", () => {
  const html = renderAccordion()
  assert.match(html, /Primary status remains visible\./)
  assert.match(html, /Secondary status remains visible\./)
  assert.equal((html.match(/aria-labelledby=/g) ?? []).length, 2)
  assert.match(html, /aria-label="Test sections"/)
  assert.match(html, /role="img" aria-label="7 of 10 complete"/)
  assert.match(html, /dashboard-summary-chart-primary/)
})

test("dashboard section layout preserves the declared section order", () => {
  const html = renderAccordion()
  assert.ok(html.indexOf("First body") < html.indexOf("Second body"))
  assert.ok(html.indexOf("First") < html.indexOf("Primary status remains visible."))
})

test("declared tabs stay visible when a runtime source does not render its panel", () => {
  const html = renderToStaticMarkup(
    createElement(DashboardSectionAccordion, {
      sections: [...sections, { title: "Source dependent", summary: "Waiting for governed source." }],
      ariaLabel: "Source-aware sections",
      children: [createElement("div", { key: 0 }, "First body"), createElement("div", { key: 1 }, "Second body")],
    })
  )

  assert.equal((html.match(/data-dashboard-section-index=/g) ?? []).length, 3)
  assert.match(html, /Source dependent/)
  assert.match(html, /No governed data is available for this section/)
})

test("outline stays a bounded horizontal scroller across desktop and mobile", () => {
  assert.match(css, /\.dashboard-outline-pane \{[^}]*overflow-x:\s*auto/)
  assert.match(css, /\.dashboard-outline-pane ol \{[^}]*grid-auto-flow:\s*column/)
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*?\.dashboard-outline-pane ol \{[^}]*grid-auto-columns:\s*minmax\(190px, 1fr\)/)
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.central-rail\.open \{[^}]*translateX\(0\)/)
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.platform-utility \.mobile-rail-trigger \{[^}]*display:\s*inline-flex/)
})
