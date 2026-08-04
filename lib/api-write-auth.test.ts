import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { POST as writeAction } from "@/app/api/action-log/route"
import { POST as acknowledgeHeartbeat } from "@/app/api/heartbeats/route"
import { AUTH_COOKIE, createSessionToken } from "@/lib/auth"

const sessionSecret = "synthetic-session-secret-for-route-tests"
const actorEmail = "operator@example.com"

async function authenticatedRequest(url: string, body: Record<string, unknown>) {
  const token = await createSessionToken(actorEmail, sessionSecret)
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${AUTH_COOKIE}=${token}` },
    body: JSON.stringify(body),
  })
}

test("action-log writes reject anonymous callers and ignore a spoofed body actor", async () => {
  const previousSecret = process.env.RAFIQI_SESSION_SECRET
  const previousRoles = process.env.RAFIQI_ROLE_ASSIGNMENTS
  process.env.RAFIQI_SESSION_SECRET = sessionSecret
  process.env.RAFIQI_ROLE_ASSIGNMENTS = `${actorEmail}:operator`
  try {
    const anonymous = await writeAction(new NextRequest("http://localhost/api/action-log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ queue_item_id: "m-ess-dataquality-sriperumbudur", action_type: "note" }) }))
    assert.equal(anonymous.status, 401)

    const response = await writeAction(await authenticatedRequest("http://localhost/api/action-log", { queue_item_id: "m-ess-dataquality-sriperumbudur", action_type: "note", actor_id: "request-body-impostor", note: "Authenticated route test" }))
    assert.equal(response.status, 201)
    const payload = await response.json() as { entry: { actor_id: string } }
    assert.equal(payload.entry.actor_id, actorEmail)
    assert.notEqual(payload.entry.actor_id, "request-body-impostor")
  } finally {
    if (previousSecret === undefined) delete process.env.RAFIQI_SESSION_SECRET
    else process.env.RAFIQI_SESSION_SECRET = previousSecret
    if (previousRoles === undefined) delete process.env.RAFIQI_ROLE_ASSIGNMENTS
    else process.env.RAFIQI_ROLE_ASSIGNMENTS = previousRoles
  }
})

test("heartbeat writes reject anonymous callers before reading governed live data", async () => {
  const previousSecret = process.env.RAFIQI_SESSION_SECRET
  const previousRoles = process.env.RAFIQI_ROLE_ASSIGNMENTS
  process.env.RAFIQI_SESSION_SECRET = sessionSecret
  process.env.RAFIQI_ROLE_ASSIGNMENTS = `${actorEmail}:operator`
  try {
    const anonymous = await acknowledgeHeartbeat(new NextRequest("http://localhost/api/heartbeats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ heartbeat_id: "live-alert" }) }))
    assert.equal(anonymous.status, 401)
  } finally {
    if (previousSecret === undefined) delete process.env.RAFIQI_SESSION_SECRET
    else process.env.RAFIQI_SESSION_SECRET = previousSecret
    if (previousRoles === undefined) delete process.env.RAFIQI_ROLE_ASSIGNMENTS
    else process.env.RAFIQI_ROLE_ASSIGNMENTS = previousRoles
  }
})
