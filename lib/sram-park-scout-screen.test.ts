import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { OPERATIONS_TABS } from "@/lib/dashboard-model"

const screen = readFileSync(new URL("../components/scouters-journey-plan.tsx", import.meta.url), "utf8")
const map = readFileSync(new URL("../components/demand-map-workspace.tsx", import.meta.url), "utf8")
const dashboard = readFileSync(new URL("../components/nia-dashboard.tsx", import.meta.url), "utf8")
const brief = readFileSync(new URL("../docs/operating-data/SRAM_PARK_SCOUT_ROUTE_PLAN.md", import.meta.url), "utf8")

test("the audited scout route remains available in code but no longer fragments Self Drive navigation", () => {
  assert.equal(OPERATIONS_TABS.filter((tab) => /Scout Route Plan/.test(tab)).length, 0)
  assert.equal(OPERATIONS_TABS.some((tab) => /Scouter.s Journey/.test(tab)), false)
  assert.equal((dashboard.match(/Shram Park Scout Route Plan/g) ?? []).length, 0)
  assert.doesNotMatch(screen, /15 km|15km|2 km and 5 km bands|Ready for field planning/)
  assert.equal(existsSync(new URL("../components/demand-leaflet-map.tsx", import.meta.url)), false)
  assert.equal(existsSync(new URL("./demand-map-data.ts", import.meta.url)), false)
})

test("the first viewport answers trigger, rings, return package and evidence blocks", () => {
  for (const required of [
    "What triggered the sweep?",
    "Where are Ring 1 and Ring 2?",
    "What must the scout return with?",
    "What is blocked pending evidence?",
    "SP ONLY",
    "SHADOW MODE",
    "SYNTHETIC",
    "READ ONLY",
  ]) assert.match(screen, new RegExp(required.replace(/[?]/g, "\\?")))
})

test("the replacement contains no live location connector or executable external action", () => {
  assert.doesNotMatch(`${screen}\n${map}`, /fetch\(|\/api\/locations|navigator\.geolocation|sendWhatsApp|lease\(|productionWrite\(/)
  assert.match(map, /normalized fixture positions/)
  assert.match(map, /Raw GPS, owner details and field photographs never enter this view/)
  assert.match(screen, /Cannot contact, message, lease, pay, commit capital, assign a live route, track GPS, take photographs or write Production/)
})

test("the audited operating brief preserves the locked safety and governance decisions", () => {
  for (const required of [
    "factory-gate coordinate",
    "Ring 1 is `[0, 2] km`",
    "More than 5 km is `Reject`",
    "safety incident or emergency response",
    "no trespass",
    "unsafe solo",
    "recommendation-only",
    "append-only",
    "Provisional shadow",
  ]) assert.ok(brief.toLowerCase().includes(required.toLowerCase()), `Missing brief contract: ${required}`)
})
