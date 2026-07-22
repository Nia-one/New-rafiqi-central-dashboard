import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Page from "@/app/page"
import { LegacyNiaDashboard } from "@/components/legacy-nia-dashboard"
import { LEGACY_DASHBOARD_TABS } from "@/lib/dashboard-model"

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")

function legacyMarkup() {
  return renderToStaticMarkup(createElement(LegacyNiaDashboard))
}

test("legacy dashboard renders the exact single-workspace navigation and Operations Mandate landing", () => {
  const html = legacyMarkup()
  for (const tab of LEGACY_DASHBOARD_TABS) assert.match(html, new RegExp(`>${tab.replaceAll("&", "&amp;")}<`))
  assert.match(html, /aria-current="page"><span>Operations Mandate<\/span>/)
  assert.match(html, /Turn insight into a field route\./)
  assert.doesNotMatch(html, /central-rail|Rafiqi Self Drive|Rafiqi Self Learn|Enterprise Demand|Your Sign-Off/)
})

test("release-off page branches before request context and emits no platform payload", async () => {
  const previous = process.env.RAFIQI_SELF_DRIVE_PLATFORM
  const previousLoginEmail = process.env.RAFIQI_LOGIN_EMAIL
  try {
    process.env.RAFIQI_LOGIN_EMAIL = "configured@nia.one"
    for (const value of [undefined, "false"]) {
      if (value === undefined) delete process.env.RAFIQI_SELF_DRIVE_PLATFORM
      else process.env.RAFIQI_SELF_DRIVE_PLATFORM = value
      const html = renderToStaticMarkup(await Page())
      assert.match(html, /Operations Mandate/)
      assert.doesNotMatch(html, /central-rail|Enterprise Demand|Your Sign-Off|SYNTHETIC FIXTURE|₹60L|₹150L/)
    }
  } finally {
    if (previous === undefined) delete process.env.RAFIQI_SELF_DRIVE_PLATFORM
    else process.env.RAFIQI_SELF_DRIVE_PLATFORM = previous
    if (previousLoginEmail === undefined) delete process.env.RAFIQI_LOGIN_EMAIL
    else process.env.RAFIQI_LOGIN_EMAIL = previousLoginEmail
  }
})

test("root route is always dynamic so one build can evaluate the release flag per request", () => {
  assert.match(pageSource, /export const dynamic = ["']force-dynamic["']/)
})
