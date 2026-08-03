export const OPERATING_INTAKE_TABS = [
  "Policy_Registry",
  "Source_Registry",
  "Theatre_Master",
  "Studio_Master",
  "People_Roster",
  "Enterprise_Demand",
  "Hourly_Heartbeat",
  "Incident_Log",
  "Action_Log",
  "Evidence_Log",
  "Approval_Log",
  "Living_Hourly",
  "Work_Hourly",
  "Essentials_Hourly",
  "Finance_Daily",
  "Member_Activation",
] as const

export type OperatingIntakeTab = (typeof OPERATING_INTAKE_TABS)[number]

export const WORKBOOK_FIELD_COUNTS: Record<OperatingIntakeTab, number> = {
  Policy_Registry: 9,
  Source_Registry: 10,
  Theatre_Master: 8,
  Studio_Master: 22,
  People_Roster: 14,
  Enterprise_Demand: 22,
  Hourly_Heartbeat: 33,
  Incident_Log: 30,
  Action_Log: 29,
  Evidence_Log: 15,
  Approval_Log: 15,
  Living_Hourly: 26,
  Work_Hourly: 21,
  Essentials_Hourly: 26,
  Finance_Daily: 31,
  Member_Activation: 17,
}

export type FieldType = "text" | "integer" | "decimal" | "boolean" | "date" | "datetime" | "formula:text" | "formula:number"

export const SUPPLY_MODELS = ["FONO", "SP"] as const
export type SupplyModel = (typeof SUPPLY_MODELS)[number]

export type IntakeField = {
  name: string
  required: boolean
  type: FieldType
  restricted?: boolean
}

export type IntakeTabContract = {
  tab: OperatingIntakeTab
  identityField: string
  fields: readonly IntakeField[]
}

export const PHASE_ONE_TAB_CONTRACTS: readonly IntakeTabContract[] = [
  {
    tab: "Source_Registry",
    identityField: "source_id",
    fields: [
      { name: "source_id", required: true, type: "text" },
      { name: "source_name", required: true, type: "text" },
      { name: "google_sheet_id", required: true, type: "text", restricted: true },
      { name: "tab_name", required: true, type: "text" },
      { name: "owner_role", required: true, type: "text" },
      { name: "expected_cadence_minutes", required: true, type: "integer" },
      { name: "last_source_update_at", required: false, type: "datetime" },
      { name: "last_ingested_at", required: false, type: "datetime" },
      { name: "freshness_status", required: false, type: "formula:text" },
      { name: "notes", required: false, type: "text" },
    ],
  },
  {
    tab: "Policy_Registry",
    identityField: "policy_id",
    fields: [
      { name: "policy_id", required: true, type: "text" },
      { name: "policy_name", required: true, type: "text" },
      { name: "policy_value", required: true, type: "text" },
      { name: "unit", required: false, type: "text" },
      { name: "effective_from", required: true, type: "date" },
      { name: "approved_by", required: true, type: "text" },
      { name: "status", required: true, type: "text" },
      { name: "source_note", required: false, type: "text" },
      { name: "updated_at", required: true, type: "datetime" },
    ],
  },
  {
    tab: "Theatre_Master",
    identityField: "theatre_id",
    fields: [
      { name: "theatre_id", required: true, type: "text" },
      { name: "theatre_name", required: true, type: "text" },
      { name: "theatre_code", required: true, type: "text" },
      { name: "active", required: true, type: "boolean" },
      { name: "lead_actor_id", required: false, type: "text" },
      { name: "geography", required: false, type: "text" },
      { name: "updated_at", required: true, type: "datetime" },
      { name: "source_id", required: true, type: "text" },
    ],
  },
  {
    tab: "Studio_Master",
    identityField: "studio_id",
    fields: [
      { name: "studio_id", required: true, type: "text" },
      { name: "theatre_id", required: true, type: "text" },
      { name: "studio_name", required: true, type: "text" },
      { name: "address", required: true, type: "text", restricted: true },
      { name: "latitude", required: true, type: "decimal" },
      { name: "longitude", required: true, type: "decimal" },
      { name: "operating_model", required: true, type: "text" },
      { name: "supply_model", required: true, type: "text" },
      { name: "studio_partner_id", required: false, type: "text" },
      { name: "contract_status", required: true, type: "text" },
      { name: "readiness_status", required: true, type: "text" },
      { name: "contracted_nests", required: true, type: "integer" },
      { name: "activation_ready_nests", required: true, type: "integer" },
      { name: "monthly_partner_cost_inr", required: true, type: "decimal" },
      { name: "refundable_deposit_inr", required: false, type: "decimal" },
      { name: "nonrefundable_deposit_inr", required: false, type: "decimal" },
      { name: "nia_capex_inr", required: false, type: "decimal" },
      { name: "launch_working_capital_inr", required: false, type: "decimal" },
      { name: "capital_per_ready_nest_inr", required: false, type: "formula:number" },
      { name: "active", required: true, type: "boolean" },
      { name: "updated_at", required: true, type: "datetime" },
      { name: "source_id", required: true, type: "text" },
    ],
  },
  {
    tab: "People_Roster",
    identityField: "actor_id",
    fields: [
      { name: "actor_id", required: true, type: "text" },
      { name: "display_name", required: true, type: "text" },
      { name: "whatsapp_phone_hash", required: true, type: "text", restricted: true },
      { name: "role", required: true, type: "text" },
      { name: "theatre_id", required: false, type: "text" },
      { name: "studio_id", required: false, type: "text" },
      { name: "manager_actor_id", required: false, type: "text" },
      { name: "active_shift", required: true, type: "boolean" },
      { name: "shift_start_at", required: false, type: "datetime" },
      { name: "shift_end_at", required: false, type: "datetime" },
      { name: "language", required: true, type: "text" },
      { name: "last_heartbeat_at", required: false, type: "datetime" },
      { name: "next_heartbeat_due_at", required: false, type: "datetime" },
      { name: "updated_at", required: true, type: "datetime" },
    ],
  },
  {
    tab: "Enterprise_Demand",
    identityField: "demand_id",
    fields: [
      { name: "demand_id", required: true, type: "text" },
      { name: "enterprise_id", required: true, type: "text" },
      { name: "enterprise_name", required: true, type: "text" },
      { name: "plant_id", required: true, type: "text" },
      { name: "plant_name", required: true, type: "text" },
      { name: "latitude", required: true, type: "decimal" },
      { name: "longitude", required: true, type: "decimal" },
      { name: "role_required", required: true, type: "text" },
      { name: "skill_required", required: false, type: "text" },
      { name: "shift", required: false, type: "text" },
      { name: "headcount_required", required: true, type: "integer" },
      { name: "headcount_matched", required: true, type: "integer" },
      { name: "headcount_remaining", required: false, type: "formula:number" },
      { name: "wage_inr", required: false, type: "decimal", restricted: true },
      { name: "activation_required_at", required: true, type: "datetime" },
      { name: "certainty", required: true, type: "text" },
      { name: "status", required: true, type: "text" },
      { name: "owner_actor_id", required: true, type: "text" },
      { name: "opened_at", required: true, type: "datetime" },
      { name: "age_hours", required: false, type: "formula:number" },
      { name: "source_submission_id", required: false, type: "text" },
      { name: "updated_at", required: true, type: "datetime" },
    ],
  },
  {
    tab: "Member_Activation",
    identityField: "activation_id",
    fields: [
      { name: "activation_id", required: true, type: "text" },
      { name: "member_token", required: true, type: "text", restricted: true },
      { name: "activated_at", required: true, type: "datetime" },
      { name: "theatre_id", required: true, type: "text" },
      { name: "studio_id", required: true, type: "text" },
      { name: "nest_id", required: true, type: "text" },
      { name: "demand_id", required: false, type: "text" },
      { name: "enterprise_id", required: false, type: "text" },
      { name: "work_assignment_id", required: false, type: "text" },
      { name: "membership_billed_inr", required: true, type: "decimal" },
      { name: "membership_collected_inr", required: true, type: "decimal" },
      { name: "collection_leakage_inr", required: false, type: "formula:number" },
      { name: "activation_evidence_url", required: true, type: "text", restricted: true },
      { name: "verified_at", required: false, type: "datetime" },
      { name: "verified_by", required: false, type: "text" },
      { name: "verification_status", required: true, type: "text" },
      { name: "source_submission_id", required: true, type: "text" },
    ],
  },
] as const

export type SourceRegistryRecord = {
  sourceId: string
  sourceName: string
  googleSheetId: string
  tabName: OperatingIntakeTab
  ownerRole: string
  expectedCadenceMinutes: number
  lastSourceUpdateAt: string | null
  lastIngestedAt: string | null
  freshnessStatus: "Current" | "Stale" | "Missing" | "Unknown"
  notes?: string
}

export type MetricDefinition = {
  metricId: string
  name: string
  formula: string
  unit: string
  dimensions: readonly string[]
  owner: string
  sourceTabs: readonly OperatingIntakeTab[]
  effectiveFrom: string
  version: number
}

export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  { metricId: "MET-DEMAND-OPEN", name: "Open enterprise demand", formula: "sum(headcount_required - headcount_matched) for open demand", unit: "Members", dimensions: ["Theatre", "Enterprise", "Demand"], owner: "Work and Enterprise Demand", sourceTabs: ["Enterprise_Demand"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-NESTS-READY", name: "Activation-ready Nests", formula: "sum(activation_ready_nests)", unit: "Nests", dimensions: ["Supply model", "Theatre", "Studio"], owner: "Living Operations", sourceTabs: ["Studio_Master"], effectiveFrom: "2026-07-17", version: 2 },
  { metricId: "MET-ACTIVATIONS-VERIFIED", name: "Verified Member activations", formula: "count(distinct activation_id) where verification_status = Verified", unit: "Members", dimensions: ["Supply model", "Theatre", "Studio", "Enterprise", "Demand"], owner: "Living Operations", sourceTabs: ["Member_Activation", "Studio_Master"], effectiveFrom: "2026-07-17", version: 2 },
  { metricId: "MET-INGESTION-QUARANTINE", name: "Quarantined source rows", formula: "count(distinct raw_row_identity) where validation_status = Quarantined", unit: "Rows", dimensions: ["Source", "Tab", "Reason"], owner: "Governance", sourceTabs: ["Source_Registry"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-VERIFICATION-LATENCY", name: "Proof-to-verification time", formula: "verified_at - proof_submitted_at", unit: "Hours", dimensions: ["Theatre", "Owner", "Verifier"], owner: "People and Execution", sourceTabs: ["Action_Log", "Evidence_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-OPEX-FORECAST", name: "Monthly opex forecast", formula: "approved month-to-date opex + governed remaining-month forecast", unit: "INR/month", dimensions: ["Month", "Cost class"], owner: "Finance and Unit Economics", sourceTabs: ["Finance_Daily"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-CASH-AFTER-COMMITMENT", name: "Projected cash after commitment", formula: "current cash - pending commitments - proposed upfront capital", unit: "INR", dimensions: ["Forecast", "Commitment", "Studio"], owner: "Finance and Unit Economics", sourceTabs: ["Finance_Daily", "Approval_Log", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-STUDIO-HEALTH", name: "Governed Studio health", formula: "versioned occupancy, gross-margin, contribution-margin and completeness policy", unit: "Status", dimensions: ["Theatre", "Studio", "Policy version"], owner: "Living Operations", sourceTabs: ["Studio_Master", "Living_Hourly", "Finance_Daily"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-WAR-ROOM-VERIFIED", name: "Verified War Room closure", formula: "count(distinct case_id) where state = Closed after independent verification", unit: "Cases", dimensions: ["Priority", "Trigger", "Owner", "Verifier"], owner: "Operations Orchestrator", sourceTabs: ["Action_Log", "Evidence_Log", "Approval_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-LIVING-OCCUPANCY", name: "Living occupancy", formula: "occupied_nests / contracted_nests", unit: "ratio", dimensions: ["Supply model", "Theatre", "Studio"], owner: "Living Operations", sourceTabs: ["Living_Hourly", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-LIVING-BILLED-ARPU", name: "Living billed ARPU", formula: "total billed Living revenue / occupied Nests", unit: "INR/occupied Nest", dimensions: ["Supply model", "Theatre", "Studio"], owner: "Finance and Unit Economics", sourceTabs: ["Living_Hourly", "Finance_Daily", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-LIVING-COLLECTION-LEAKAGE", name: "Living collection leakage", formula: "billed Living revenue - verified Living collections", unit: "INR", dimensions: ["Supply model", "Theatre", "Studio"], owner: "Finance and Unit Economics", sourceTabs: ["Living_Hourly", "Finance_Daily", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-LIVING-CM1", name: "Living CM1", formula: "consume the current governed CM1 definition; return No data when its definition or source coverage is absent", unit: "INR", dimensions: ["Supply model", "Theatre", "Studio", "Definition version"], owner: "Finance and Unit Economics", sourceTabs: ["Finance_Daily", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-LIVING-CM2", name: "Living CM2", formula: "consume the current governed CM2 definition; return No data when its definition or source coverage is absent", unit: "INR", dimensions: ["Supply model", "Theatre", "Studio", "Definition version"], owner: "Finance and Unit Economics", sourceTabs: ["Finance_Daily", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-FONO-NIA-FILL", name: "FONO Nia fill rate", formula: "Nia-filled Members / vacant FONO Nests at operating-cycle start", unit: "ratio", dimensions: ["Theatre", "Studio", "Operating cycle"], owner: "Living Operations", sourceTabs: ["Living_Hourly", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-SP-CONTRACT-COVERAGE", name: "SP enterprise contract coverage", formula: "enterprise-contracted Nests / governed SP capacity", unit: "ratio", dimensions: ["Theatre", "Studio", "Enterprise"], owner: "Living Operations", sourceTabs: ["Enterprise_Demand", "Living_Hourly", "Studio_Master"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-ESSENTIALS-MEMBER-SAVINGS", name: "Essentials Member savings", formula: "MRP - Member selling price for fulfilled Essentials units", unit: "INR", dimensions: ["Theatre", "Studio", "Service", "SKU"], owner: "Essentials", sourceTabs: ["Essentials_Hourly"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-ESSENTIALS-NIA-MARGIN", name: "Essentials Nia margin", formula: "Member selling price - governed direct supplier cost", unit: "INR", dimensions: ["Theatre", "Studio", "Service", "SKU"], owner: "Essentials", sourceTabs: ["Essentials_Hourly", "Finance_Daily"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-PEOPLE-RESOLVED-OUTCOME", name: "Resolved-outcome rate", formula: "independently verified resolved outcomes / assigned actions", unit: "ratio", dimensions: ["Theatre", "Studio", "Role", "Owner"], owner: "People and Execution", sourceTabs: ["People_Roster", "Action_Log", "Evidence_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-MEMBER-RETENTION-M6", name: "Member retention at M6", formula: "verified Members active at M6 / verified M6 cohort Members", unit: "ratio", dimensions: ["Cohort", "Theatre", "Studio"], owner: "Member Continuity", sourceTabs: ["Member_Activation", "Living_Hourly", "Work_Hourly", "Essentials_Hourly"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-GOV-VERIFIED-REPORTING", name: "Verified facts admitted to governed reporting", formula: "count(distinct fact_id) where verification_status = Verified and analytics_allowed = true and classification is not restricted payroll", unit: "Facts", dimensions: ["Report", "Metric version", "Source"], owner: "Governance and IR", sourceTabs: ["Source_Registry", "Action_Log", "Evidence_Log", "Approval_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-AUTONOMY-DETECTION-PRECISION", name: "Autonomy detection precision", formula: "recommendations matched to independently labelled expected signals / all recommendations", unit: "ratio", dimensions: ["Agent version", "Domain", "Risk class"], owner: "Governance and IR", sourceTabs: ["Action_Log", "Evidence_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-AUTONOMY-MISSED-EVENT", name: "Autonomy missed-event rate", formula: "independently labelled expected signals without a recommendation / all independently labelled expected signals", unit: "ratio", dimensions: ["Agent version", "Domain", "Signal"], owner: "Governance and IR", sourceTabs: ["Action_Log", "Evidence_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-AUTONOMY-DECISION-ALIGNMENT", name: "Recommendation acceptance and override", formula: "human decisions grouped as Accepted, Rejected or Overridden / all reviewed recommendations", unit: "ratio", dimensions: ["Agent version", "Domain", "Human decision"], owner: "Governance and IR", sourceTabs: ["Action_Log", "Approval_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-AUTONOMY-REVERSAL", name: "Human reversal rate", formula: "actioned recommendations reversed after the human decision / all actioned recommendations", unit: "ratio", dimensions: ["Agent version", "Domain", "Risk class"], owner: "Governance and IR", sourceTabs: ["Action_Log", "Evidence_Log", "Approval_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-AUTONOMY-AUDIT-COMPLETENESS", name: "Autonomy audit completeness", formula: "reviewed recommendations with recommendation, human decision and final disposition evidence / all reviewed recommendations", unit: "ratio", dimensions: ["Agent version", "Domain", "Risk class"], owner: "Governance and IR", sourceTabs: ["Action_Log", "Evidence_Log", "Approval_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-AUTONOMY-ROUTINE-SELF-CLOSURE", name: "System-owned routine exception closure", formula: "routine exceptions independently verified and closed by the governed system loop / all routine exceptions", unit: "ratio", dimensions: ["Agent version", "Domain", "Final state"], owner: "Operations Orchestrator", sourceTabs: ["Action_Log", "Evidence_Log"], effectiveFrom: "2026-07-17", version: 1 },
  { metricId: "MET-AUTONOMY-PEOPLE-EXCEPTION", name: "Verified recurring people exceptions", formula: "people with repeated independently verified non-performance after the prior intervention / governed actor and goal", unit: "People", dimensions: ["Role", "Metric", "Escalation stage"], owner: "People and Execution", sourceTabs: ["People_Roster", "Action_Log", "Evidence_Log", "Approval_Log"], effectiveFrom: "2026-07-17", version: 1 },
] as const

export type PolicyValue = string | number | boolean

export type PolicyDefinition = {
  policyId: string
  name: string
  value: PolicyValue
  unit: string
  effectiveFrom: string
  approvedBy: "Sachin" | "Pushkar"
  status: "Active" | "Retired"
  source: string
  version: number
}

export const POLICY_REGISTRY: readonly PolicyDefinition[] = [
  { policyId: "POL-HEARTBEAT-CADENCE", name: "Active-shift heartbeat cadence", value: 60, unit: "minutes", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "WhatsApp operating data bot v1.0", version: 1 },
  { policyId: "POL-HEARTBEAT-REMINDER", name: "Unanswered heartbeat reminder", value: 10, unit: "minutes", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "WhatsApp operating data bot v1.0", version: 1 },
  { policyId: "POL-HEARTBEAT-ESCALATION", name: "Missed heartbeat manager escalation", value: 20, unit: "minutes from first message", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "WhatsApp operating data bot v1.0", version: 1 },
  { policyId: "POL-OPEX-CAP", name: "Monthly opex cap", value: 6_000_000, unit: "INR/month", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-CASH-GUARD", name: "Minimum cash guardrail", value: 15_000_000, unit: "INR", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-FIN-APPROVER", name: "Pricing and financial approver", value: "Pushkar", unit: "actor", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-HIRING", name: "Hiring state", value: "Frozen", unit: "state", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-BREAKEVEN-OCCUPANCY", name: "Studio breakeven occupancy", value: 0.78, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-STUDIO-GM", name: "Studio GM target", value: 0.2, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-STUDIO-OCCUPANCY-AMBER", name: "Studio Amber occupancy floor", value: 0.6, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-STUDIO-GM-AMBER", name: "Studio Amber GM floor", value: 0.1, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-STUDIO-AMBER-REVIEW", name: "Amber Theatre review deadline", value: 24, unit: "hours", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-STUDIO-AMBER-ACTION", name: "Amber action-plan deadline", value: 48, unit: "hours", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-STUDIO-RED-DECISION", name: "Red Studio decision deadline", value: 7, unit: "days", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-LIVING-OPERATING-CYCLE", name: "Living supply operating cycle", value: "Incident trigger or hourly heartbeat, whichever occurs first", unit: "cycle", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 3.1 Living supply-model addendum", version: 1 },
  { policyId: "POL-SP-ESCALATION-CYCLES", name: "SP unresolved-cycle escalation", value: 1, unit: "unresolved cycles", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 3.1 provisional shadow default; calibrate after the first real SP", version: 1 },
  { policyId: "POL-FONO-ESCALATION-CYCLES", name: "FONO below-breakeven escalation", value: 2, unit: "consecutive cycles", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 3.1 provisional shadow default; calibrate after the first real SP", version: 1 },
  { policyId: "POL-ESSENTIALS-SAVINGS-FLOOR", name: "Minimum Essentials Member savings", value: 0, unit: "INR; must be greater than", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-ESSENTIALS-MARGIN-FLOOR", name: "Minimum sustainable Nia margin", value: 0, unit: "INR; must be greater than", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-RETENTION-M6-REFERENCE", name: "M6 retention operating reference", value: 0.69, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief; approximately 69%", version: 1 },
  { policyId: "POL-RETENTION-M6-WARNING", name: "M6 retention warning floor", value: 0.65, unit: "ratio; warn below", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-MONTHLY-CHURN-REFERENCE", name: "Monthly churn operating reference", value: 0.06, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-EXTERNAL-REPORT-APPROVER", name: "External board, investor and capital communication approver", value: "CEO", unit: "role", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief", version: 1 },
  { policyId: "POL-AUTONOMY-MODE", name: "Controlled autonomy operating mode", value: "Shadow only", unit: "mode", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief Phase 5", version: 1 },
  { policyId: "POL-AUTONOMY-PRECISION-GATE", name: "Minimum detection precision for low-risk automation", value: "Not agreed", unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 5 requires an agreed threshold; no value is locked in the brief", version: 1 },
  { policyId: "POL-AUTONOMY-REVERSAL-GATE", name: "Maximum reversal rate for low-risk automation", value: "Not agreed", unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 5 requires an agreed threshold; no value is locked in the brief", version: 1 },
  { policyId: "POL-AUTONOMY-AUDIT-GATE", name: "Minimum audit completeness for low-risk automation", value: "Not agreed", unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 5 requires an agreed threshold; no value is locked in the brief", version: 1 },
  { policyId: "POL-AUTONOMY-HIGH-RISK", name: "High-risk autonomy rule", value: "Human approval permanently required", unit: "approval rule", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Rafiqi Central build brief Phase 5", version: 1 },
  { policyId: "POL-AUTONOMY-KILL-SWITCH", name: "Automatic execution kill switch", value: "Engaged", unit: "state", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 5 shadow-mode default", version: 1 },
  { policyId: "POL-AUTONOMY-PEOPLE-ESCALATION", name: "Exception-only people escalation sequence", value: "Verified recurrence only: Coach / Counsel → Performance review → Exit review", unit: "stage sequence", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 5 product correction", version: 1 },
  { policyId: "POL-AUTONOMY-EMPLOYMENT-DECISION", name: "Employment decision control", value: "Named HR/management approval plus legal/process checks", unit: "approval rule", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Phase 5 product correction", version: 1 },
  { policyId: "POL-SP-SCOUT-TRIGGER-STAGE", name: "Śram Park scout activation stage", value: "Negotiation", unit: "funnel stage", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Śram Park Scout Route Plan locked product decision", version: 1 },
  { policyId: "POL-SP-SCOUT-RING-1-MAX", name: "Śram Park Ring 1 maximum", value: 2, unit: "km inclusive", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Śram Park Scout Route Plan locked product decision", version: 1 },
  { policyId: "POL-SP-SCOUT-RING-2-MAX", name: "Śram Park Ring 2 maximum", value: 5, unit: "km inclusive", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Śram Park Scout Route Plan locked product decision", version: 1 },
  { policyId: "POL-SP-SCOUT-WEDGES", name: "Required wedges per scout ring", value: 8, unit: "wedges/ring", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Śram Park Scout Route Plan source brief", version: 1 },
  { policyId: "POL-SP-SCOUT-SHARED-CATCHMENT-GATES", name: "Minimum SP gates for shared-catchment review", value: 2, unit: "verified SP gates", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Śram Park Scout Route Plan locked product decision", version: 1 },
  { policyId: "POL-SP-SCOUT-WEDGE-MINUTES", name: "Synthetic half-day wedge duration", value: 210, unit: "minutes", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional shadow calibration; not approved for live routing", version: 1 },
  { policyId: "POL-SP-SCOUT-TARGET-RENT", name: "Synthetic target rent per Nest", value: 2500, unit: "INR/Nest/month", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture; calibrate before any live use", version: 1 },
  { policyId: "POL-SP-SCOUT-TARGET-CAPACITY", name: "Synthetic target candidate capacity", value: 250, unit: "Nests", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture; calibrate before any live use", version: 1 },
  { policyId: "POL-SP-SCOUT-BILLED-ARPU", name: "Synthetic billed Living ARPU", value: 4500, unit: "INR/occupied Nest/month", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture; billed revenue / occupied Nests; collection leakage separate", version: 1 },
  { policyId: "POL-SP-SCOUT-SHUTTLE-CEILING", name: "Synthetic Ring 2 shuttle-cost ceiling", value: 800, unit: "INR/Nest/month", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture; calibrate before any live use", version: 1 },
  { policyId: "POL-SP-SCOUT-STALL-DAYS", name: "Synthetic stalled-negotiation interval", value: 2, unit: "operating days", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional shadow calibration", version: 1 },
  { policyId: "POL-SP-SCOUT-NEGOTIATION-CERTAINTY", name: "Synthetic Negotiation contract certainty", value: 0.6, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture; calibrate against governed conversion history", version: 1 },
  { policyId: "POL-SP-SCOUT-SHIFT-SINGLE", name: "Synthetic single-shift factor", value: 1, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture", version: 1 },
  { policyId: "POL-SP-SCOUT-SHIFT-TWO", name: "Synthetic two-shift factor", value: 0.9, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture", version: 1 },
  { policyId: "POL-SP-SCOUT-SHIFT-THREE", name: "Synthetic three-shift factor", value: 0.8, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture", version: 1 },
  { policyId: "POL-SP-SCOUT-SHIFT-CONTINUOUS", name: "Synthetic continuous-shift factor", value: 0.85, unit: "ratio", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional synthetic fixture", version: 1 },
  { policyId: "POL-SP-SCOUT-APPROVED-HOURS", name: "Synthetic approved daylight scout window", value: "08:00–18:00", unit: "local time", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional shadow safety window; field-safety review required", version: 1 },
  { policyId: "POL-SP-SCOUT-CHECKINS", name: "Required field-session check-ins", value: 3, unit: "start/midpoint/end", effectiveFrom: "2026-07-17", approvedBy: "Sachin", status: "Active", source: "Provisional shadow safety control; field-safety review required", version: 1 },
] as const

function policyEffectiveTimestamp(value: string) {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+05:30` : value)
}

export function policyAt(policyId: string, at: string, registry: readonly PolicyDefinition[] = POLICY_REGISTRY) {
  return registry
    .filter((policy) => policy.policyId === policyId && policy.status === "Active" && policyEffectiveTimestamp(policy.effectiveFrom) <= Date.parse(at))
    .toSorted((a, b) => b.version - a.version || policyEffectiveTimestamp(b.effectiveFrom) - policyEffectiveTimestamp(a.effectiveFrom))[0] ?? null
}

export type SourceLineage = {
  sourceId: string
  sourceName: string
  tab: OperatingIntakeTab
  rowNumber: number
  sourceUpdatedAt: string | null
  importedAt: string
  batchId: string
  rowIdentity: string
  rowChecksum: string
  synthetic: boolean
}

export type CanonicalTheatre = {
  theatreId: string
  name: string
  code: string
  active: boolean
  leadActorId: string | null
  geography: string | null
  updatedAt: string
  lineage: SourceLineage
}

export type CanonicalStudio = {
  studioId: string
  theatreId: string
  name: string
  address: string
  latitude: number
  longitude: number
  operatingModel: string
  supplyModel: SupplyModel
  studioPartnerId: string | null
  contractStatus: string
  readinessStatus: string
  contractedNests: number
  activationReadyNests: number
  monthlyPartnerCostInr: number
  refundableDepositInr: number
  nonrefundableDepositInr: number
  niaCapexInr: number
  launchWorkingCapitalInr: number
  availableAt: string
  active: boolean
  updatedAt: string
  lineage: SourceLineage
}

export type CanonicalDemand = {
  demandId: string
  enterpriseId: string
  enterpriseName: string
  plantId: string
  plantName: string
  latitude: number
  longitude: number
  roleRequired: string
  skillRequired: string | null
  shift: string | null
  headcountRequired: number
  headcountMatched: number
  activationRequiredAt: string
  certainty: string
  status: string
  ownerActorId: string
  openedAt: string
  updatedAt: string
  lineage: SourceLineage
}

export type CanonicalPerson = {
  actorId: string
  displayName: string
  whatsappPhoneHash: string
  role: string
  theatreId: string | null
  studioId: string | null
  managerActorId: string | null
  activeShift: boolean
  shiftStartAt: string | null
  shiftEndAt: string | null
  language: string
  updatedAt: string
  lineage: SourceLineage
}

export type CanonicalActivation = {
  activationId: string
  memberToken: string
  activatedAt: string
  theatreId: string
  studioId: string
  nestId: string
  demandId: string | null
  enterpriseId: string | null
  workAssignmentId: string | null
  membershipBilledInr: number
  membershipCollectedInr: number
  activationEvidenceUrl: string
  verifiedAt: string | null
  verifiedBy: string | null
  verificationStatus: string
  sourceSubmissionId: string
  lineage: SourceLineage
}
