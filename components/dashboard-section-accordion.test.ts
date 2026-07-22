import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"

const sections = [
  { title: "First", summary: "Primary status remains visible." },
  { title: "Second", summary: "Secondary status remains visible." },
] as const

function renderAccordion() {
  return renderToStaticMarkup(createElement(DashboardSectionAccordion, { sections, ariaLabel: "Test sections" },
    createElement("div", null, "First body"),
    createElement("div", null, "Second body"),
  ))
}

test("dashboard accordion opens only the first section by default", () => {
  const html = renderAccordion()
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 1)
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 1)
  assert.match(html, /role="region"[^>]+aria-labelledby=/)
  assert.match(html, /hidden=""/)
})

test("dashboard accordion keeps summaries and accessible relationships visible", () => {
  const html = renderAccordion()
  assert.match(html, /Primary status remains visible\./)
  assert.match(html, /Secondary status remains visible\./)
  assert.equal((html.match(/aria-controls=/g) ?? []).length, 2)
  assert.match(html, /aria-label="Test sections"/)
})
