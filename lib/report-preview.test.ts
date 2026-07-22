import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { reportPreviewEnabled } from "@/lib/report-preview"

test("report kit is available in local development and Vercel Preview", () => {
  assert.equal(reportPreviewEnabled({ NODE_ENV: "development" }), true)
  assert.equal(reportPreviewEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true)
})

test("report kit fails closed in Vercel Production and unclassified production runtimes", () => {
  assert.equal(reportPreviewEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false)
  assert.equal(reportPreviewEnabled({ NODE_ENV: "production" }), false)
})

test("both the report page and its polling API enforce the shared preview boundary", () => {
  const page = readFileSync(join(process.cwd(), "app/report-kit-preview/page.tsx"), "utf8")
  const api = readFileSync(join(process.cwd(), "app/report-kit-preview/api/pulse/route.ts"), "utf8")
  assert.match(page, /if \(!reportPreviewEnabled\(\)\) notFound\(\)/)
  assert.match(api, /if \(!reportPreviewEnabled\(\)\) return new NextResponse\(null, \{ status: 404 \}\)/)
})
