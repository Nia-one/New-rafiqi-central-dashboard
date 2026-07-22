import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { GET as financePreview } from "@/app/api/finance-expansion/preview/route"
import { GET as locations } from "@/app/api/locations/route"
import { GET as operatingPreview } from "@/app/api/operating-loop/preview/route"
import { AUTH_COOKIE, createSessionToken } from "@/lib/auth"

const sessionSecret = "synthetic-release-gate-session-secret"

async function request(url: string, email?: string) {
  const headers = new Headers()
  if (email) headers.set("cookie", `${AUTH_COOKIE}=${await createSessionToken(email, sessionSecret)}`)
  return new NextRequest(url, { headers })
}

async function withEnvironment(run: () => Promise<void>) {
  const previous = {
    platform: process.env.RAFIQI_SELF_DRIVE_PLATFORM,
    finance: process.env.RAFIQI_FINANCE_EXPANSION_CONTROL,
    secret: process.env.RAFIQI_SESSION_SECRET,
    roles: process.env.RAFIQI_ROLE_ASSIGNMENTS,
  }
  process.env.RAFIQI_SESSION_SECRET = sessionSecret
  process.env.RAFIQI_ROLE_ASSIGNMENTS = "operator@example.com:operator,finance@example.com:finance,admin@example.com:administrator"
  try {
    await run()
  } finally {
    if (previous.platform === undefined) delete process.env.RAFIQI_SELF_DRIVE_PLATFORM
    else process.env.RAFIQI_SELF_DRIVE_PLATFORM = previous.platform
    if (previous.finance === undefined) delete process.env.RAFIQI_FINANCE_EXPANSION_CONTROL
    else process.env.RAFIQI_FINANCE_EXPANSION_CONTROL = previous.finance
    if (previous.secret === undefined) delete process.env.RAFIQI_SESSION_SECRET
    else process.env.RAFIQI_SESSION_SECRET = previous.secret
    if (previous.roles === undefined) delete process.env.RAFIQI_ROLE_ASSIGNMENTS
    else process.env.RAFIQI_ROLE_ASSIGNMENTS = previous.roles
  }
}

test("platform preview APIs fail closed while the top-level release is off", async () => withEnvironment(async () => {
  delete process.env.RAFIQI_SELF_DRIVE_PLATFORM
  process.env.RAFIQI_FINANCE_EXPANSION_CONTROL = "true"
  assert.equal((await operatingPreview(await request("http://localhost/api/operating-loop/preview", "operator@example.com"))).status, 404)
  assert.equal((await financePreview(await request("http://localhost/api/finance-expansion/preview", "finance@example.com"))).status, 404)
}))

test("finance requires platform, finance sub-gate and finance or administrator role", async () => withEnvironment(async () => {
  process.env.RAFIQI_SELF_DRIVE_PLATFORM = "true"
  process.env.RAFIQI_FINANCE_EXPANSION_CONTROL = "true"
  const operator = await financePreview(await request("http://localhost/api/finance-expansion/preview", "operator@example.com"))
  assert.equal(operator.status, 403)
  assert.doesNotMatch(await operator.text(), /6000000|15000000|monthlyOpexCapInr|minCashGuardrailInr/)
  assert.equal((await financePreview(await request("http://localhost/api/finance-expansion/preview", "finance@example.com"))).status, 200)
  assert.equal((await financePreview(await request("http://localhost/api/finance-expansion/preview", "admin@example.com"))).status, 200)
  process.env.RAFIQI_FINANCE_EXPANSION_CONTROL = "false"
  assert.equal((await financePreview(await request("http://localhost/api/finance-expansion/preview", "finance@example.com"))).status, 404)
}))

test("locations never call a provider while off and require authentication when on", async () => withEnvironment(async () => {
  const originalFetch = globalThis.fetch
  let providerCalls = 0
  globalThis.fetch = async () => {
    providerCalls += 1
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
  }
  try {
    delete process.env.RAFIQI_SELF_DRIVE_PLATFORM
    assert.equal((await locations(await request("http://localhost/api/locations?q=oragadam", "operator@example.com"))).status, 404)
    assert.equal(providerCalls, 0)
    process.env.RAFIQI_SELF_DRIVE_PLATFORM = "true"
    assert.equal((await locations(await request("http://localhost/api/locations?q=oragadam"))).status, 401)
    assert.equal(providerCalls, 0)
    const authorised = await locations(await request("http://localhost/api/locations?q=oragadam", "operator@example.com"))
    assert.equal(authorised.status, 200)
    assert.equal(providerCalls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
}))
