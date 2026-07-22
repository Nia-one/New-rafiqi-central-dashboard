import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { LivingSupplyModelReport } from "@/components/living-supply-model-report"

test("the Living UI visibly renders FONO, SP, and then the combined roll-up", () => {
  const html = renderToStaticMarkup(createElement(LivingSupplyModelReport))
  // The governed data key stays "SP" (CSS + lineage still bind to it) even though the
  // human-facing label reads "Śram Park".
  const fono = html.indexOf('data-supply-model="FONO"')
  const sp = html.indexOf('data-supply-model="SP"')
  const combined = html.indexOf('data-supply-model="Combined"')
  assert.ok(fono >= 0 && sp > fono && combined > sp)
  assert.match(html, /BILLED ARPU/)
  assert.match(html, /COLLECTION LEAKAGE/)
  assert.match(html, /Studio Master is authoritative/)
  assert.equal(html.includes("Float"), false)
})

test("the opaque 'SP' code is shown to people as 'Śram Park'", () => {
  const html = renderToStaticMarkup(createElement(LivingSupplyModelReport))
  // New joiners must not have to decode "SP": the label, refresh-order step, channel
  // detail kicker, and combined caption all spell out Śram Park.
  assert.match(html, /<strong>Śram Park<\/strong>/)
  assert.match(html, /FONO first\. Śram Park second\./)
  assert.match(html, /FONO \+ Śram Park, shown last/)
  // The bare two-letter code must not survive as a standalone visible word.
  assert.equal(/>SP</.test(html), false)
})

test("the contracted-to-paying funnel renders as shrinking bars alongside the counts", () => {
  const html = renderToStaticMarkup(createElement(LivingSupplyModelReport))
  // One consolidated funnel column replaces the four numeric columns so the table fits
  // and the drop-off is visible.
  assert.match(html, /SUPPLY FUNNEL/)
  assert.equal(html.includes(">CONTRACTED<"), false)
  assert.match(html, /living-funnel-bars/)
  assert.match(html, /living-funnel-track/)
  // Bars are width-driven per stage and carry an accessible summary.
  assert.match(html, /data-stage="paying" style="width:\d+%/)
  assert.match(html, /aria-label="Supply funnel: [^"]*contracted[^"]*paying[^"]*"/)
  // The worst stage-to-stage loss is flagged so the leak is obvious at a glance.
  assert.match(html, /living-funnel-row"[^>]*data-leak/)
})

test("occupancy renders as a threshold-banded progress bar alongside the number", () => {
  const html = renderToStaticMarkup(createElement(LivingSupplyModelReport))
  // Bar + accessible label must be present so the weak channel is visible at a glance.
  assert.match(html, /living-occupancy-bar/)
  assert.match(html, /aria-label="Occupancy \d+ percent"/)
  // Every rendered occupancy carries a health band for colour coding.
  assert.match(html, /data-band="(healthy|watch|low)"/)
  // The fill width is driven by the percentage value.
  assert.match(html, /living-occupancy-bar[^>]*>\s*<i style="width:\d+%/)
})
