import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { LivingSupplyModelReport } from "@/components/living-supply-model-report"

const liveOpsData = {
  livingSummary: {
    fono: { contracted: 100, activationReady: 80, occupied: 70, occupancy: 0.7, billed: 70000, leakage: 1000 },
    sp: { contracted: 50, activationReady: 40, occupied: 30, occupancy: 0.6, billed: 30000, leakage: 500 },
    combined: { contracted: 150, activationReady: 120, occupied: 100, occupancy: 2 / 3, billed: 100000, leakage: 1500 },
  },
  livingDashboard: [
    { key: "living_report_kicker", "value text": "LIVING REPORT · GOVERNED SUPPLY VIEW", "updated at": "2026-07-27T10:00:00+05:30" },
    { key: "living_report_title", "value text": "FONO first. Shram Park second. Then the combined Living view." },
    { key: "living_report_description", "value text": "Studio Master is authoritative before any combined roll-up." },
    { key: "living_report_fono_description", "value text": "Read the FONO channel first." },
    { key: "living_report_sp_description", "value text": "Read Shram Park second." },
    { key: "living_report_combined_description", "value text": "Combine only after channel review." },
    { key: "living_report_fono_detail_title", "value text": "FONO source and fill detail" },
    { key: "living_report_sp_detail_title", "value text": "Shram Park readiness detail" },
    { key: "living_report_source_note", "value text": "Connected operating sources" },
    ...["cm1_fono", "cm2_fono", "cm1_sp", "cm2_sp", "franchisee_sourced", "nia_filled", "vacant_cycle_start", "nia_fill_rate", "coverage", "sp_capex"].map((key, index) => ({ key, "value number": index + 1 })),
    { key: "hardware", "value text": "Ready" },
    { key: "sukh", "value text": "Ready" },
    { key: "ufd", "value text": "Ready" },
  ],
  studios: [{ "studio id": "SP-1", "studio name": "Shram Park Test", "supply model": "SP", "readiness status": "Ready" }],
  fonoOccupancy: [{}],
}

const renderReport = () => renderToStaticMarkup(createElement(LivingSupplyModelReport, { liveOpsData }))

test("the Living UI visibly renders FONO, SP, and then the combined roll-up", () => {
  const html = renderReport()
  // The governed data key stays "SP" (CSS + lineage still bind to it) even though the
  // human-facing label reads "Shram Park".
  const fono = html.indexOf('data-supply-model="FONO"')
  const sp = html.indexOf('data-supply-model="SP"')
  const combined = html.indexOf('data-supply-model="Combined"')
  assert.ok(fono >= 0 && sp > fono && combined > sp)
  assert.match(html, /BILLED ARPU/)
  assert.match(html, /COLLECTION LEAKAGE/)
  assert.match(html, /Studio Master is authoritative/)
  assert.equal(html.includes("Float"), false)
})

test("the opaque 'SP' code is shown to people as 'Shram Park'", () => {
  const html = renderReport()
  // New joiners must not have to decode "SP": the label, refresh-order step, channel
  // detail kicker, and combined caption all spell out Shram Park.
  assert.match(html, /<strong>Shram Park<\/strong>/)
  assert.match(html, /FONO first\. Shram Park second\./)
  assert.match(html, /FONO \+ Shram Park, shown last/)
  // The bare two-letter code must not survive as a standalone visible word.
  assert.equal(/>SP</.test(html), false)
})

test("the contracted-to-paying funnel renders as shrinking bars alongside the counts", () => {
  const html = renderReport()
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
  const html = renderReport()
  // Bar + accessible label must be present so the weak channel is visible at a glance.
  assert.match(html, /living-occupancy-bar/)
  assert.match(html, /aria-label="Occupancy \d+ percent"/)
  // Every rendered occupancy carries a health band for colour coding.
  assert.match(html, /data-band="(healthy|watch|low)"/)
  // The fill width is driven by the percentage value.
  assert.match(html, /living-occupancy-bar[^>]*>\s*<i style="width:\d+%/)
})
