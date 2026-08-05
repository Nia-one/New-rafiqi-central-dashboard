import assert from "node:assert/strict";
import test from "node:test";
import { resolveRegistryOwner, verticalForObjective } from "./ownerRegistrySync";

const base = { assignmentId: "A", scope: "All", theatre: "All", role: "Owner", responsibility: "", effectiveFrom: "", effectiveTo: "", status: "Active", reportingMonth: "" };
const assignments = [
  { ...base, vertical: "Finance", ownerName: "Shrey" },
  { ...base, assignmentId: "B", vertical: "Essential Supply", ownerName: "Manikya Dahed" },
  { ...base, assignmentId: "C", vertical: "SP Demand", scope: "SP Demand Bot", theatre: "Coromandel|Wellington", ownerName: "Satish Sanghey" },
];

test("dynamic registry resolves active owners and theatre aliases", () => {
  assert.equal(resolveRegistryOwner(assignments, "Finance"), "Shrey");
  assert.equal(resolveRegistryOwner(assignments, "SP Demand", { scope: "SP Demand Bot", theatre: "Commandal" }), "Satish Sanghey");
});

test("governed action objectives map to supplied verticals", () => {
  assert.equal(verticalForObjective("Recover Nia Margins full-use CM2"), "Finance");
  assert.equal(verticalForObjective("Restore Essentials stock availability"), "Essential Supply");
  assert.equal(verticalForObjective("Improve Essentials demand conversion"), "Essential Demand");
  assert.equal(verticalForObjective("Resolve Living occupancy gap"), "Occupancy");
});
