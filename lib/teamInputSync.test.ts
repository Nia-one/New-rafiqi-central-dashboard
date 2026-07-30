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
