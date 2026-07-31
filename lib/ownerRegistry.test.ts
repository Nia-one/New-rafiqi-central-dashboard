import assert from "node:assert/strict";
import test from "node:test";
import { OWNER_ASSIGNMENTS, ownerFor } from "./ownerRegistry";

test("final supplied owner assignments are centralized", () => {
  assert.equal(OWNER_ASSIGNMENTS.length, 16);
  assert.equal(ownerFor("Occupancy"), "Prashant Waghire");
  assert.equal(ownerFor("Essential Supply"), "Manikya Dahed");
  assert.equal(ownerFor("Essential Demand"), "Satish Sanghey");
  assert.equal(ownerFor("FONO Demand"), "Srinivasan RG");
  assert.equal(ownerFor("Finance", { role: "Approver" }), "Yoshit");
  assert.equal(ownerFor("Collection", { scope: "Finance", role: "Finance owner" }), "Bidhyadhar Nayak");
});

test("SP Demand Bot mapping is scoped and supports theatre aliases", () => {
  assert.equal(ownerFor("SP Demand", { scope: "SP Demand Bot", theatre: "Decaan" }), "Prashant Waghire");
  assert.equal(ownerFor("SP Demand", { scope: "SP Demand Bot", theatre: "Commandal" }), "Satish Sanghey");
  assert.equal(ownerFor("SP Demand", { theatre: "Rajputana" }), "");
});
