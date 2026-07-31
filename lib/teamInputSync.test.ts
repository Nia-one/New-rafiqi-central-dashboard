import assert from "node:assert/strict";
import test from "node:test";
import { headerRow } from "./teamInputSync";

test("headerRow selects the machine-header row in multi-row input sheets", () => {
  const targetHeaders = ["finance daily id", "business date", "theatre id", "studio id", "cm1 inr", "cm2 inr", "updated at"];
  const rows = [
    ["Date\nFINANCE INPUT", "Theatre\nFINANCE INPUT", "updated at", "studio id"],
    ["REQUIRED — Finance snapshot date", "REQUIRED — Theatre identifier"],
    ["business_date", "theatre_id", "studio_id", "cm1_inr", "cm2_inr", "finance_daily_id", "updated_at"],
  ];

  assert.equal(headerRow(rows, targetHeaders), 2);
});

test("headerRow recognises user-input aliases used by policy and action tabs", () => {
  assert.equal(headerRow([
    ["Required: Policy/targets"],
    ["policy_id", "metric_name", "threshold_value", "unit", "status", "approved_by_actor_id", "updated_at"],
  ], ["policy id", "policy name", "policy value", "unit", "status", "approved by", "updated at"]), 1);

  assert.equal(headerRow([
    ["Required: Action log"],
    ["action_id", "objective", "expected_metric", "financial_impact", "owner_actor_id", "state", "updated_at"],
  ], ["action id", "operating objective", "expected metric", "expected financial impact inr", "owner actor id", "state", "updated at"]), 1);
});
