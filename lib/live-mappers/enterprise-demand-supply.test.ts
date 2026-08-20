import test from "node:test"
import assert from "node:assert/strict"
import { buildEnterpriseDemandSupplyStatus } from "./enterprise-demand-supply"

test("joins hunted FONO properties to Enterprise demand and aggregates hunter performance", () => {
  const result = buildEnterpriseDemandSupplyStatus([
    { "demand id": "DEM-1", "source submission id": "UI-ENTERPRISE-DEMAND-DEM-1", "enterprise id": "ENT-1", "enterprise name": "Acme", "theatre id": "South", status: "Negotiation" },
    { "demand id": "FONO-TRACKER-1", "source submission id": "FONO-TRACKER-1", "property for": "Enterprise", "linked demand id": "DEM-1", "enterprise id": "ENT-1", "plant name": "Green Residency", "property location": "Hosur", "hunter name": "Asha", "property status": "Shortlisted", "match status": "Mapped" },
  ])
  assert.equal(result.rows[0].company, "Acme")
  assert.equal(result.rows[0].property, "Green Residency")
  assert.deepEqual(result.performance[0], { theatre: "South", hunter: "Asha", hunted: 1, mapped: 1, contracted: 0 })
})

test("excludes FONO-purpose properties from the Enterprise match report", () => {
  const result = buildEnterpriseDemandSupplyStatus([{ "demand id": "FONO-TRACKER-2", "source submission id": "FONO-TRACKER-2", "property for": "FONO", "plant name": "FONO House" }])
  assert.equal(result.rows.length, 0)
})

test("keeps Enterprise demand visible when no property is linked", () => {
  const result = buildEnterpriseDemandSupplyStatus([{ "demand id": "DEM-2", "source submission id": "UI-ENTERPRISE-DEMAND-DEM-2", "enterprise name": "Beta", status: "Lead" }])
  assert.equal(result.rows[0].property, "No property linked")
  assert.equal(result.rows[0].matchStatus, "Unmapped")
})
