begin;

-- Phase 1 only: read-only intake, lineage, quarantine, registries and canonical
-- master data. This migration is additive and is not authorised for Production.

create table if not exists nia.operating_sources (
  source_id text primary key,
  source_name text not null,
  google_sheet_id text not null,
  tab_name text not null,
  owner_role text not null,
  expected_cadence_minutes integer not null check (expected_cadence_minutes > 0),
  last_source_update_at timestamptz,
  last_ingested_at timestamptz,
  freshness_status text not null default 'Unknown' check (freshness_status in ('Current', 'Stale', 'Missing', 'Unknown')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (google_sheet_id, tab_name)
);

create table if not exists nia.operating_import_batches (
  batch_id uuid primary key,
  source_id text not null references nia.operating_sources(source_id),
  imported_at timestamptz not null default now(),
  source_updated_at timestamptz,
  row_count integer not null check (row_count >= 0),
  imported_count integer not null check (imported_count >= 0),
  quarantined_count integer not null check (quarantined_count >= 0),
  duplicate_count integer not null check (duplicate_count >= 0),
  synthetic boolean not null default false,
  checksum text not null,
  unique (source_id, checksum)
);
create index if not exists operating_import_batches_source_time_idx on nia.operating_import_batches(source_id, imported_at desc);

create table if not exists nia.operating_raw_import_rows (
  raw_row_id uuid primary key,
  batch_id uuid not null references nia.operating_import_batches(batch_id),
  source_id text not null references nia.operating_sources(source_id),
  tab_name text not null,
  source_row_number integer not null check (source_row_number >= 2),
  row_identity text not null,
  row_checksum text not null,
  source_updated_at timestamptz,
  ingested_at timestamptz not null,
  validation_status text not null check (validation_status in ('Imported', 'Quarantined')),
  synthetic boolean not null default false,
  raw_values jsonb not null,
  unique (source_id, tab_name, row_identity)
);
create index if not exists operating_raw_rows_batch_idx on nia.operating_raw_import_rows(batch_id, source_row_number);
create index if not exists operating_raw_rows_quarantine_idx on nia.operating_raw_import_rows(source_id, tab_name, ingested_at desc) where validation_status = 'Quarantined';

create table if not exists nia.operating_quarantine_reasons (
  quarantine_reason_id uuid primary key,
  raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  reason_code text not null check (reason_code in ('missing_column', 'missing_value', 'invalid_type', 'invalid_value', 'duplicate_identity', 'privacy_boundary')),
  field_name text,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists operating_quarantine_raw_row_idx on nia.operating_quarantine_reasons(raw_row_id);

create table if not exists nia.metric_registry (
  metric_id text not null,
  version integer not null check (version > 0),
  metric_name text not null,
  formula text not null,
  unit text not null,
  dimensions text[] not null default '{}',
  owner_role text not null,
  source_tabs text[] not null,
  effective_from date not null,
  approved_by uuid references nia.operator_profiles(actor_id),
  status text not null default 'Active' check (status in ('Active', 'Retired')),
  created_at timestamptz not null default now(),
  primary key (metric_id, version)
);
create index if not exists metric_registry_active_idx on nia.metric_registry(metric_id, effective_from desc) where status = 'Active';

create table if not exists nia.policy_registry (
  policy_id text not null,
  version integer not null check (version > 0),
  policy_name text not null,
  policy_value jsonb not null,
  unit text not null,
  effective_from date not null,
  approved_by uuid references nia.operator_profiles(actor_id),
  source_note text not null,
  status text not null default 'Active' check (status in ('Active', 'Retired')),
  created_at timestamptz not null default now(),
  primary key (policy_id, version)
);
create index if not exists policy_registry_active_idx on nia.policy_registry(policy_id, effective_from desc) where status = 'Active';

create table if not exists nia.operating_theatres (
  theatre_id text primary key,
  theatre_name text not null,
  theatre_code text not null unique,
  active boolean not null,
  lead_actor_id uuid references nia.operator_profiles(actor_id),
  geography text,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  source_updated_at timestamptz not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  check (valid_to is null or valid_to > valid_from)
);

create table if not exists nia.operating_studios (
  studio_id text primary key,
  theatre_id text not null references nia.operating_theatres(theatre_id),
  studio_name text not null,
  address text not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  operating_model text not null,
  studio_partner_id uuid references nia.organisations(organisation_id),
  contract_status text not null,
  readiness_status text not null,
  contracted_nests integer not null check (contracted_nests >= 0),
  activation_ready_nests integer not null check (activation_ready_nests between 0 and contracted_nests),
  monthly_partner_cost_inr numeric(14,2) not null check (monthly_partner_cost_inr >= 0),
  refundable_deposit_inr numeric(14,2) not null default 0 check (refundable_deposit_inr >= 0),
  nonrefundable_deposit_inr numeric(14,2) not null default 0 check (nonrefundable_deposit_inr >= 0),
  nia_capex_inr numeric(14,2) not null default 0 check (nia_capex_inr >= 0),
  launch_working_capital_inr numeric(14,2) not null default 0 check (launch_working_capital_inr >= 0),
  available_at timestamptz,
  active boolean not null,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  source_updated_at timestamptz not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  check (valid_to is null or valid_to > valid_from)
);
create index if not exists operating_studios_theatre_readiness_idx on nia.operating_studios(theatre_id, readiness_status, available_at);

create table if not exists nia.operating_enterprises (
  enterprise_id text primary key,
  enterprise_name text not null,
  plant_id text not null unique,
  plant_name text not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  source_updated_at timestamptz not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  check (valid_to is null or valid_to > valid_from)
);

create table if not exists nia.demand_requirements (
  demand_id text primary key,
  enterprise_id text not null references nia.operating_enterprises(enterprise_id),
  plant_id text not null,
  role_required text not null,
  skill_required text,
  shift text,
  headcount_required integer not null check (headcount_required > 0),
  headcount_matched integer not null default 0 check (headcount_matched >= 0 and headcount_matched <= headcount_required),
  wage_inr numeric(14,2),
  activation_required_at timestamptz not null,
  certainty text not null,
  status text not null,
  owner_actor_id uuid not null references nia.operator_profiles(actor_id),
  opened_at timestamptz not null,
  source_submission_id text,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  source_updated_at timestamptz not null,
  version bigint not null default 1
);
create index if not exists demand_requirements_open_queue_idx on nia.demand_requirements(activation_required_at, opened_at) where status not in ('Closed', 'Cancelled');

create table if not exists nia.operating_staff_roster (
  actor_id uuid primary key references nia.operator_profiles(actor_id),
  whatsapp_phone_hash text not null unique,
  role_label text not null,
  theatre_id text references nia.operating_theatres(theatre_id),
  studio_id text references nia.operating_studios(studio_id),
  manager_actor_id uuid references nia.operator_profiles(actor_id),
  active_shift boolean not null default false,
  shift_start_at timestamptz,
  shift_end_at timestamptz,
  preferred_language text not null,
  last_heartbeat_at timestamptz,
  next_heartbeat_due_at timestamptz,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  source_updated_at timestamptz not null
);
create index if not exists operating_staff_shift_idx on nia.operating_staff_roster(active_shift, next_heartbeat_due_at) where active_shift;

drop trigger if exists operating_raw_import_rows_immutable on nia.operating_raw_import_rows;
create trigger operating_raw_import_rows_immutable before update or delete on nia.operating_raw_import_rows for each row execute function nia.reject_immutable_mutation();
drop trigger if exists operating_quarantine_reasons_immutable on nia.operating_quarantine_reasons;
create trigger operating_quarantine_reasons_immutable before update or delete on nia.operating_quarantine_reasons for each row execute function nia.reject_immutable_mutation();

alter table nia.operating_sources enable row level security;
alter table nia.operating_sources force row level security;
create policy operating_sources_read_policy on nia.operating_sources for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy operating_sources_write_policy on nia.operating_sources for all using (nia.current_actor_role() = 'administrator') with check (nia.current_actor_role() = 'administrator');

alter table nia.operating_raw_import_rows enable row level security;
alter table nia.operating_raw_import_rows force row level security;
create policy operating_raw_rows_read_policy on nia.operating_raw_import_rows for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy operating_raw_rows_insert_policy on nia.operating_raw_import_rows for insert with check (nia.current_actor_role() = 'administrator');

commit;

-- Non-production rollback order:
-- operating_staff_roster, demand_requirements, operating_enterprises,
-- operating_studios, operating_theatres, policy_registry, metric_registry,
-- operating_quarantine_reasons, operating_raw_import_rows,
-- operating_import_batches, operating_sources.
-- Drop the two Phase 1 immutable triggers before their tables. Do not remove
-- nia.reject_immutable_mutation because migration 001 also uses it.
