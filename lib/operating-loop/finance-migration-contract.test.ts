import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(new URL("../../db/migrations/004_finance_expansion_control.sql", import.meta.url), "utf8")

const financeControlTables = [
  "financial_guardrail_evaluations",
  "financial_guardrail_breaches",
  "financial_approval_requests",
  "financial_approval_events",
  "studio_health_assessments",
  "war_room_cases",
  "war_room_case_approvals",
  "war_room_events",
  "war_room_evidence",
  "finance_control_verified_events",
] as const

test("migration 004 finance-control reads exclude operators and retain finance and administrator access", () => {
  for (const table of financeControlTables) {
    const policyName = `${table}_read_policy`
    const policyPattern = new RegExp(`create policy ${policyName} on nia\\.${table} for select using \\(nia\\.current_actor_role\\(\\) in \\(([^;]+)\\)\\);`)
    const policy = migration.match(policyPattern)
    assert.ok(policy, `Missing read policy for nia.${table}.`)
    assert.doesNotMatch(policy[0], /'operator'/, `Operator must not read nia.${table}.`)
    assert.match(policy[0], /'finance'/, `Finance must retain read access to nia.${table}.`)
    assert.match(policy[0], /'administrator'/, `Administrator must retain read access to nia.${table}.`)
  }
})

test("migration 004 contains no explicit operator grant on finance-control tables", () => {
  for (const table of financeControlTables) {
    const operatorGrant = new RegExp(`grant\\s+[^;]+\\s+on\\s+(?:table\\s+)?nia\\.${table}\\s+to\\s+[^;]*\\boperator\\b`, "i")
    assert.doesNotMatch(migration, operatorGrant, `Operator grant found for nia.${table}.`)
  }
})
