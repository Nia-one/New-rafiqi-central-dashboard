import assert from "node:assert/strict"
import test from "node:test"
import { heartbeatRulesFromPolicies } from "./heartbeat-rules"
import { heartbeatAcknowledgmentsFromRows } from "./durable-heartbeat"

const policy = (kind: string, suffix: string, value: string) => ({ "policy id": `DISPATCH-${kind}-${suffix}`, "policy value": value, status: "Approved" })

test("Dispatch rules are entirely projected from approved policy rows", () => {
  const rows = ["SUPPLY-JCO", "DEMAND-JCO", "ESSENTIALS-CATEGORY", "OTHER"].flatMap((kind) => [policy(kind, "THRESHOLD", "9"), policy(kind, "ESCALATION", "3"), policy(kind, "LABEL", `${kind} label`), policy(kind, "DESCRIPTION", `${kind} description`), policy(kind, "ACTION", `${kind} action`), policy(kind, "DUE", `${kind} due`), policy(kind, "CHECKLIST", "One|Two")])
  const rules = heartbeatRulesFromPolicies(rows)
  assert.equal(rules[0].threshold_minutes, 9)
  assert.equal(rules[0].escalation_multiplier, 3)
  assert.equal(rules[0].action_label, "SUPPLY-JCO action")
  assert.deepEqual(rules[0].checklist, ["One", "Two"])
})

test("missing governed policies fail closed instead of using a hidden fallback", () => {
  assert.throws(() => heartbeatRulesFromPolicies([]), /Approved Dispatch policies are missing/)
})

test("acknowledgments are reconstructed from governed Action_Log rows", () => {
  const rows = [{ "action id": "ACK-1", "operating objective": "HEARTBEAT_ACK:live-person-1", "owner actor id": "operator-1", state: "Acknowledged", "updated at": "2026-08-12T08:00:00.000Z" }]
  assert.deepEqual(heartbeatAcknowledgmentsFromRows(rows).map((row) => [row.id, row.heartbeat_id, row.actor_id]), [["ACK-1", "live-person-1", "operator-1"]])
})
