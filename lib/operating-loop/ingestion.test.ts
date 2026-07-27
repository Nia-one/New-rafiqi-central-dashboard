import assert from "node:assert/strict"
import test from "node:test"
import { createGoogleSheetsReadOnlyAdapter } from "@/lib/operating-loop/adapters/google-sheets"
import { METRIC_REGISTRY, OPERATING_INTAKE_TABS, PHASE_ONE_TAB_CONTRACTS, POLICY_REGISTRY, WORKBOOK_FIELD_COUNTS } from "@/lib/operating-loop/contracts"
import { createFixtureOperatingDataAdapter, syntheticImportInput } from "@/lib/operating-loop/fixtures"
import { importOperatingRows, type SheetImportInput } from "@/lib/operating-loop/ingestion"

const importedAt = "2026-07-17T08:00:00+05:30"

function validDemand() {
  return {
    demand_id: "DEM-001", enterprise_id: "ENT-001", enterprise_name: "Hosur Components", plant_id: "PLANT-001", plant_name: "Hosur plant",
    latitude: 12.7409, longitude: 77.8253, role_required: "Assembly operator", skill_required: "Assembly", shift: "A",
    headcount_required: 120, headcount_matched: 0, headcount_remaining: 120, wage_inr: 18_500,
    activation_required_at: "2026-07-22T09:00:00+05:30", certainty: "Confirmed", status: "Open", owner_actor_id: "ACT-DEMAND",
    opened_at: "2026-07-17T07:30:00+05:30", age_hours: 0.5, source_submission_id: "SUB-001", updated_at: "2026-07-17T07:45:00+05:30",
  }
}

function validStudio(overrides: Record<string, unknown> = {}) {
  return {
    studio_id: "ST-FONO-001", theatre_id: "TH-001", studio_name: "Neutral Studio Name", address: "Synthetic planning coordinate",
    latitude: 12.9716, longitude: 77.5946, operating_model: "Partner Studio", supply_model: "FONO", studio_partner_id: "PARTNER-001",
    contract_status: "Contracted", readiness_status: "Activation ready", contracted_nests: 200, activation_ready_nests: 180,
    monthly_partner_cost_inr: 500_000, refundable_deposit_inr: 800_000, nonrefundable_deposit_inr: 0, nia_capex_inr: 250_000,
    launch_working_capital_inr: 100_000, capital_per_ready_nest_inr: 6_388.89, active: true,
    updated_at: "2026-07-17T07:40:00+05:30", source_id: "SRC-STUDIO", ...overrides,
  }
}

function input(rows: SheetImportInput["rows"]): SheetImportInput {
  return { batchId: "BATCH-001", sourceId: "SRC-DEMAND", sourceName: "Synthetic branch fixture", googleSheetId: "SHEET-TEST", importedAt, synthetic: true, rows }
}

test("the workbook manifest preserves all 16 governed intake tabs and 332 fields", () => {
  assert.equal(OPERATING_INTAKE_TABS.length, 16)
  assert.equal(Object.values(WORKBOOK_FIELD_COUNTS).reduce((sum, count) => sum + count, 0), 332)
  assert.equal(PHASE_ONE_TAB_CONTRACTS.find((contract) => contract.tab === "Studio_Master")?.fields.length, 22)
  assert.equal(PHASE_ONE_TAB_CONTRACTS.find((contract) => contract.tab === "Enterprise_Demand")?.fields.length, 22)
  assert.ok(METRIC_REGISTRY.some((metric) => metric.metricId === "MET-ACTIVATIONS-VERIFIED"))
  assert.ok(POLICY_REGISTRY.some((policy) => policy.policyId === "POL-HEARTBEAT-CADENCE" && policy.value === 60))
})

test("Studio Master supplies the authoritative model and visible lineage", () => {
  const result = importOperatingRows(input([{ tab: "Studio_Master", rowNumber: 2, values: validStudio({ supply_model: "SP" }) }]))
  assert.equal(result.stats.imported, 1)
  assert.equal(result.canonical.studios[0].supplyModel, "SP")
  assert.equal(result.canonical.studios[0].lineage.rowIdentity, result.rawRows[0].lineage.rowIdentity)
})

test("missing capital inputs are quarantined while explicit zero remains a governed value", () => {
  const missing = importOperatingRows(input([{ tab: "Studio_Master", rowNumber: 2, values: validStudio({ nia_capex_inr: "" }) }]))
  assert.equal(missing.stats.quarantined, 1)
  assert.equal(missing.canonical.studios.length, 0)
  assert.ok(missing.quarantinedRows[0].reasons.some((reason) => reason.code === "missing_value" && reason.field === "nia_capex_inr" && reason.message.includes("never treated as zero")))

  const explicitZero = importOperatingRows(input([{ tab: "Studio_Master", rowNumber: 3, values: validStudio({ refundable_deposit_inr: 0, nonrefundable_deposit_inr: 0, nia_capex_inr: 0, launch_working_capital_inr: 0 }) }]))
  assert.equal(explicitZero.stats.imported, 1)
  assert.deepEqual({
    refundable: explicitZero.canonical.studios[0].refundableDepositInr,
    nonrefundable: explicitZero.canonical.studios[0].nonrefundableDepositInr,
    capex: explicitZero.canonical.studios[0].niaCapexInr,
    workingCapital: explicitZero.canonical.studios[0].launchWorkingCapitalInr,
  }, { refundable: 0, nonrefundable: 0, capex: 0, workingCapital: 0 })
})

test("missing, invalid, or conflicting supply models are quarantined and never inferred from names", () => {
  const withoutSupplyModel = Object.fromEntries(Object.entries(validStudio({ studio_name: "FONO-labelled name" })).filter(([field]) => field !== "supply_model"))
  const missing = importOperatingRows(input([{ tab: "Studio_Master", rowNumber: 2, values: withoutSupplyModel }]))
  assert.equal(missing.stats.quarantined, 1)
  assert.ok(missing.quarantinedRows[0].reasons.some((reason) => reason.field === "supply_model" && reason.code === "missing_column"))

  const invalid = importOperatingRows(input([{ tab: "Studio_Master", rowNumber: 3, values: validStudio({ supply_model: "fono" }) }]))
  assert.equal(invalid.stats.quarantined, 1)
  assert.match(invalid.quarantinedRows[0].reasons.find((reason) => reason.field === "supply_model")?.message ?? "", /exactly FONO or SP/)

  const conflicting = importOperatingRows(input([
    { tab: "Studio_Master", rowNumber: 4, values: validStudio({ supply_model: "FONO" }) },
    { tab: "Studio_Master", rowNumber: 5, values: validStudio({ supply_model: "SP", updated_at: "2026-07-17T07:41:00+05:30" }) },
  ]))
  assert.equal(conflicting.stats.quarantined, 2)
  assert.equal(conflicting.canonical.studios.length, 0)
  assert.ok(conflicting.quarantinedRows.every((row) => row.reasons.some((reason) => reason.message.includes("conflicting governed supply_model"))))
})

test("a supply-model conflict with previously imported Studio Master lineage is quarantined", () => {
  const first = importOperatingRows(input([{ tab: "Studio_Master", rowNumber: 6, values: validStudio({ supply_model: "FONO" }) }]))
  const changed = importOperatingRows({
    ...input([{ tab: "Studio_Master", rowNumber: 6, values: validStudio({ supply_model: "SP", updated_at: "2026-07-17T08:40:00+05:30" }) }]),
    batchId: "BATCH-002",
  }, first.rawRows)
  assert.equal(changed.stats.quarantined, 1)
  assert.ok(changed.quarantinedRows[0].reasons.some((reason) => reason.field === "supply_model" && reason.message.includes("conflicting governed supply_model")))
})

test("imports preserve immutable raw lineage and canonicalise valid enterprise demand", () => {
  const result = importOperatingRows(input([{ tab: "Enterprise_Demand", rowNumber: 2, values: validDemand() }]))
  assert.equal(result.stats.imported, 1)
  assert.equal(result.canonical.demands[0].demandId, "DEM-001")
  assert.equal(result.rawRows[0].lineage.rowIdentity, "SRC-DEMAND:Enterprise_Demand:2:2026-07-17T02:15:00.000Z")
  assert.equal(result.events.filter((event) => event.type === "enterprise.demand.ingested").length, 1)
  assert.equal(result.rawRows[0].lineage.synthetic, true)
})

test("the same source row is idempotent across import batches", () => {
  const first = importOperatingRows(input([{ tab: "Enterprise_Demand", rowNumber: 2, values: validDemand() }]))
  const second = importOperatingRows({ ...input([{ tab: "Enterprise_Demand", rowNumber: 2, values: validDemand() }]), batchId: "BATCH-002" }, first.rawRows)
  assert.equal(second.stats.duplicatesIgnored, 1)
  assert.equal(second.rawRows.length, 0)
})

test("invalid values are quarantined without silent coercion", () => {
  const result = importOperatingRows(input([{ tab: "Enterprise_Demand", rowNumber: 2, values: { ...validDemand(), latitude: 140, headcount_required: 100, headcount_matched: 110 } }]))
  assert.equal(result.stats.quarantined, 1)
  assert.equal(result.canonical.demands.length, 0)
  assert.ok(result.quarantinedRows[0].reasons.some((reason) => reason.field === "latitude"))
  assert.ok(result.quarantinedRows[0].reasons.some((reason) => reason.field === "headcount_matched"))
  assert.equal(result.rawRows[0].values.latitude, 140)
})

test("privacy boundaries reject raw phone numbers and prohibited columns", () => {
  const values = {
    actor_id: "ACT-001", display_name: "Synthetic operator", whatsapp_phone_hash: "+919876543210", role: "EAE", theatre_id: "TH-01", studio_id: "ST-01",
    manager_actor_id: "ACT-MGR", active_shift: true, shift_start_at: "2026-07-17T07:00:00+05:30", shift_end_at: "2026-07-17T15:00:00+05:30",
    language: "English", last_heartbeat_at: importedAt, next_heartbeat_due_at: "2026-07-17T09:00:00+05:30", updated_at: importedAt, raw_payroll: "never allowed",
  }
  const result = importOperatingRows(input([{ tab: "People_Roster", rowNumber: 2, values }]))
  assert.ok(result.quarantinedRows[0].reasons.some((reason) => reason.code === "privacy_boundary" && reason.field === "whatsapp_phone_hash"))
  assert.ok(result.quarantinedRows[0].reasons.some((reason) => reason.code === "privacy_boundary" && reason.field === "raw_payroll"))
})

test("the Google Sheets adapter exposes read-only GET access and no write surface", async () => {
  let method = ""
  const adapter = createGoogleSheetsReadOnlyAdapter({
    sheetId: "sheet-id",
    allowedTabs: ["Enterprise_Demand"],
    getAccessToken: async () => "token",
    fetchImplementation: async (_url, init) => {
      method = init?.method ?? ""
      return new Response(JSON.stringify({ range: "Enterprise_Demand!A1:B2", values: [["* Demand Id", "* Enterprise Id"], ["DEM-1", "ENT-1"]] }), { status: 200 })
    },
  })
  const result = await adapter.readTab("Enterprise_Demand", "A:B")
  assert.equal(method, "GET")
  assert.deepEqual(result.rows[0].values, { demand_id: "DEM-1", enterprise_id: "ENT-1" })
  assert.equal("writeTab" in adapter, false)
})

test("the branch fixture is labelled synthetic and never masquerades as a live source", async () => {
  const fixture = createFixtureOperatingDataAdapter()
  const demands = await fixture.readTab("Enterprise_Demand")
  const result = importOperatingRows(syntheticImportInput())
  assert.equal(fixture.mode, "synthetic-fixture")
  assert.equal(demands.rows.length, 1)
  assert.equal(result.stats.synthetic, true)
  assert.ok(result.rawRows.every((row) => row.lineage.synthetic))
})
