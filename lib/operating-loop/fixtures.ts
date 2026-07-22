import type { OperatingIntakeTab } from "@/lib/operating-loop/contracts"
import type { SheetImportInput, SheetSourceRow } from "@/lib/operating-loop/ingestion"

export const SYNTHETIC_SOURCE_ID = "SRC-SYNTHETIC-CLOSED-LOOP"
export const SYNTHETIC_AS_OF = "2026-07-17T08:00:00+05:30"

export const SYNTHETIC_OPERATING_ROWS: readonly SheetSourceRow[] = [
  {
    tab: "Theatre_Master", rowNumber: 2, values: {
      theatre_id: "TH-COROMANDEL", theatre_name: "Coromandel (Tamil Nadu)", theatre_code: "COR", active: true,
      lead_actor_id: "ACT-THEATRE", geography: "Sriperumbudur industrial corridor", updated_at: "2026-07-17T07:35:00+05:30", source_id: SYNTHETIC_SOURCE_ID,
    },
  },
  {
    tab: "Studio_Master", rowNumber: 2, values: {
      studio_id: "ST-SIP-02", theatre_id: "TH-COROMANDEL", studio_name: "Sriperumbudur 02", address: "Synthetic planning coordinate · Sriperumbudur",
      latitude: 12.9672, longitude: 79.9412, operating_model: "Partner Studio", supply_model: "SP", studio_partner_id: "PARTNER-02", contract_status: "Contracted", readiness_status: "Activation ready",
      contracted_nests: 160, activation_ready_nests: 132, monthly_partner_cost_inr: 560_000, refundable_deposit_inr: 900_000,
      nonrefundable_deposit_inr: 0, nia_capex_inr: 240_000, launch_working_capital_inr: 120_000, capital_per_ready_nest_inr: 9_545.45,
      available_at: "2026-07-19T09:00:00+05:30", active: true, updated_at: "2026-07-17T07:40:00+05:30", source_id: SYNTHETIC_SOURCE_ID,
    },
  },
  {
    tab: "Studio_Master", rowNumber: 3, values: {
      studio_id: "ST-ORA-01", theatre_id: "TH-COROMANDEL", studio_name: "Oragadam 01", address: "Synthetic planning coordinate · Oragadam",
      latitude: 12.8496, longitude: 80.0068, operating_model: "Partner Studio", supply_model: "FONO", studio_partner_id: "PARTNER-03", contract_status: "Commercial review", readiness_status: "Physical readiness",
      contracted_nests: 320, activation_ready_nests: 260, monthly_partner_cost_inr: 720_000, refundable_deposit_inr: 1_200_000,
      nonrefundable_deposit_inr: 150_000, nia_capex_inr: 360_000, launch_working_capital_inr: 160_000, capital_per_ready_nest_inr: 12_635.14,
      available_at: "2026-07-21T09:00:00+05:30", active: true, updated_at: "2026-07-17T07:38:00+05:30", source_id: SYNTHETIC_SOURCE_ID,
    },
  },
  {
    tab: "Studio_Master", rowNumber: 4, values: {
      studio_id: "ST-MAM-01", theatre_id: "TH-COROMANDEL", studio_name: "Mambakkam 01", address: "Synthetic planning coordinate · Mambakkam",
      latitude: 12.8934, longitude: 79.8921, operating_model: "New supply option", supply_model: "SP", studio_partner_id: "PARTNER-04", contract_status: "Terms proposed", readiness_status: "Compliance readiness",
      contracted_nests: 260, activation_ready_nests: 180, monthly_partner_cost_inr: 780_000, refundable_deposit_inr: 600_000,
      nonrefundable_deposit_inr: 0, nia_capex_inr: 600_000, launch_working_capital_inr: 200_000, capital_per_ready_nest_inr: 7_777.78,
      available_at: "2026-07-23T09:00:00+05:30", active: true, updated_at: "2026-07-17T07:36:00+05:30", source_id: SYNTHETIC_SOURCE_ID,
    },
  },
  {
    tab: "People_Roster", rowNumber: 2, values: {
      actor_id: "ACT-DEMAND", display_name: "Meera Nair", whatsapp_phone_hash: "sha256:synthetic-demand", role: "Demand JCO", theatre_id: "TH-COROMANDEL", studio_id: null,
      manager_actor_id: "ACT-THEATRE", active_shift: true, shift_start_at: "2026-07-17T07:00:00+05:30", shift_end_at: "2026-07-17T15:00:00+05:30",
      language: "English", last_heartbeat_at: "2026-07-17T07:45:00+05:30", next_heartbeat_due_at: "2026-07-17T08:45:00+05:30", updated_at: "2026-07-17T07:45:00+05:30",
    },
  },
  {
    tab: "People_Roster", rowNumber: 3, values: {
      actor_id: "ACT-SUPPLY", display_name: "Leena Das", whatsapp_phone_hash: "sha256:synthetic-supply", role: "Supply JCO", theatre_id: "TH-COROMANDEL", studio_id: "ST-SIP-02",
      manager_actor_id: "ACT-THEATRE", active_shift: true, shift_start_at: "2026-07-17T07:00:00+05:30", shift_end_at: "2026-07-17T15:00:00+05:30",
      language: "English", last_heartbeat_at: "2026-07-17T07:40:00+05:30", next_heartbeat_due_at: "2026-07-17T08:40:00+05:30", updated_at: "2026-07-17T07:40:00+05:30",
    },
  },
  {
    tab: "People_Roster", rowNumber: 4, values: {
      actor_id: "ACT-VERIFY", display_name: "Theatre verification desk", whatsapp_phone_hash: "sha256:synthetic-verifier", role: "Theatre lead", theatre_id: "TH-COROMANDEL", studio_id: null,
      manager_actor_id: "ACT-COO", active_shift: true, shift_start_at: "2026-07-17T07:00:00+05:30", shift_end_at: "2026-07-17T15:00:00+05:30",
      language: "English", last_heartbeat_at: "2026-07-17T07:50:00+05:30", next_heartbeat_due_at: "2026-07-17T08:50:00+05:30", updated_at: "2026-07-17T07:50:00+05:30",
    },
  },
  {
    tab: "Enterprise_Demand", rowNumber: 2, values: {
      demand_id: "DEM-SIP-240", enterprise_id: "ENT-SIP", enterprise_name: "SIP Industrial", plant_id: "PLANT-SIP-01", plant_name: "SIP Industrial · Plant 01",
      latitude: 12.9738, longitude: 79.9559, role_required: "Assembly operator", skill_required: "Line assembly", shift: "A and B",
      headcount_required: 240, headcount_matched: 0, headcount_remaining: 240, wage_inr: 18_500, activation_required_at: "2026-07-23T09:00:00+05:30",
      certainty: "Confirmed", status: "Open", owner_actor_id: "ACT-DEMAND", opened_at: "2026-07-17T07:30:00+05:30", age_hours: 0.5,
      source_submission_id: "SUB-SYNTHETIC-DEMAND", updated_at: "2026-07-17T07:45:00+05:30",
    },
  },
  {
    tab: "Member_Activation", rowNumber: 2, values: {
      activation_id: "ACTIVATION-001", member_token: "MEM-TOKEN-001", activated_at: "2026-07-22T08:30:00+05:30", theatre_id: "TH-COROMANDEL",
      studio_id: "ST-SIP-02", nest_id: "NEST-SIP-0201", demand_id: "DEM-SIP-240", enterprise_id: "ENT-SIP", work_assignment_id: "WORK-001",
      membership_billed_inr: 5_000, membership_collected_inr: 5_000, collection_leakage_inr: 0,
      activation_evidence_url: "protected://evidence/synthetic-activation-001", verified_at: null, verified_by: null, verification_status: "Pending", source_submission_id: "SUB-SYNTHETIC-ACTIVATION-001",
    },
  },
]

export function syntheticImportInput(): SheetImportInput {
  return {
    batchId: "BATCH-SYNTHETIC-20260717-0800",
    sourceId: SYNTHETIC_SOURCE_ID,
    sourceName: "Closed-loop branch Preview fixture",
    googleSheetId: "SYNTHETIC-NOT-A-LIVE-SHEET",
    importedAt: SYNTHETIC_AS_OF,
    synthetic: true,
    rows: SYNTHETIC_OPERATING_ROWS,
  }
}

export function createFixtureOperatingDataAdapter(rows: readonly SheetSourceRow[] = SYNTHETIC_OPERATING_ROWS) {
  return Object.freeze({
    mode: "synthetic-fixture" as const,
    async readTab(tab: OperatingIntakeTab) {
      return { tab, range: `${tab}!fixture`, rows: rows.filter((row) => row.tab === tab).map((row) => structuredClone(row)) }
    },
  })
}
