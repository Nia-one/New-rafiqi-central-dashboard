begin;

-- Phase 2 only: shadow-mode demand activation, governed action lifecycle,
-- append-only proof and verified operational events. Additive and not
-- authorised for Production writes.

create table if not exists nia.operating_actions (
  action_id uuid primary key,
  demand_id text not null references nia.demand_requirements(demand_id),
  studio_id text not null references nia.operating_studios(studio_id),
  title text not null,
  owner_actor_id uuid not null references nia.operator_profiles(actor_id),
  verifier_actor_id uuid references nia.operator_profiles(actor_id),
  due_at timestamptz not null,
  action_state text not null check (action_state in ('Detected', 'Proposed', 'Approved', 'Auto-approved', 'Assigned', 'In progress', 'Proof submitted', 'Verified', 'Closed', 'Reopened', 'Escalated')),
  approval_tier text not null check (approval_tier in ('None', 'Sachin', 'Pushkar')),
  governed_changes text[] not null default '{}',
  metric_id text not null,
  expected_impact text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verifier_actor_id is null or verifier_actor_id <> owner_actor_id)
);
create index if not exists operating_actions_queue_idx on nia.operating_actions(action_state, due_at);

create table if not exists nia.operating_action_events (
  action_event_id uuid primary key,
  action_id uuid not null references nia.operating_actions(action_id),
  prior_state text,
  next_state text not null,
  actor_id uuid not null references nia.operator_profiles(actor_id),
  action_version bigint not null check (action_version > 0),
  note text not null,
  occurred_at timestamptz not null,
  unique (action_id, action_version)
);

create table if not exists nia.operating_evidence (
  evidence_id uuid primary key,
  action_id uuid not null references nia.operating_actions(action_id),
  protected_reference text not null check (protected_reference like 'protected://%'),
  evidence_type text not null,
  submitted_by uuid not null references nia.operator_profiles(actor_id),
  submitted_at timestamptz not null,
  source_raw_row_id uuid references nia.operating_raw_import_rows(raw_row_id),
  unique (action_id, protected_reference)
);

create table if not exists nia.operating_approvals (
  approval_id uuid primary key,
  action_id uuid not null references nia.operating_actions(action_id),
  approval_tier text not null check (approval_tier in ('Sachin', 'Pushkar')),
  approved_by uuid not null references nia.operator_profiles(actor_id),
  decision text not null check (decision in ('Approved', 'Rejected')),
  note text not null,
  approved_at timestamptz not null
);

create table if not exists nia.member_activation_batches (
  activation_batch_id uuid primary key,
  demand_id text not null references nia.demand_requirements(demand_id),
  studio_id text not null references nia.operating_studios(studio_id),
  action_id uuid not null references nia.operating_actions(action_id),
  owner_actor_id uuid not null references nia.operator_profiles(actor_id),
  verifier_actor_id uuid references nia.operator_profiles(actor_id),
  protected_evidence_reference text not null check (protected_evidence_reference like 'protected://%'),
  verification_status text not null default 'Pending' check (verification_status in ('Pending', 'Verified', 'Rejected')),
  submitted_at timestamptz not null,
  verified_at timestamptz,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  check (verifier_actor_id is null or verifier_actor_id <> owner_actor_id),
  check ((verification_status = 'Verified') = (verified_at is not null and verifier_actor_id is not null))
);

create table if not exists nia.member_activation_records (
  activation_id uuid primary key,
  activation_batch_id uuid not null references nia.member_activation_batches(activation_batch_id),
  member_token text not null,
  nest_id text not null,
  activated_at timestamptz not null,
  protected_evidence_reference text not null check (protected_evidence_reference like 'protected://%'),
  unique (activation_batch_id, member_token),
  unique (activation_batch_id, nest_id)
);

create table if not exists nia.operating_verified_events (
  operating_event_id uuid primary key,
  event_type text not null check (event_type in ('member.activation.verified')),
  occurred_at timestamptz not null,
  demand_id text not null references nia.demand_requirements(demand_id),
  studio_id text not null references nia.operating_studios(studio_id),
  action_id uuid not null references nia.operating_actions(action_id),
  activation_batch_id uuid not null references nia.member_activation_batches(activation_batch_id),
  verified_activation_count integer not null check (verified_activation_count > 0),
  verified_by uuid not null references nia.operator_profiles(actor_id),
  verification_status text not null check (verification_status = 'Verified'),
  analytics_allowed boolean not null default false,
  data_classification text not null check (data_classification in ('Internal', 'Confidential', 'Restricted payroll')),
  synthetic boolean not null default false,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  unique (event_type, activation_batch_id)
);

create or replace view nia.insights_verified_activation_events as
select
  event_type,
  occurred_at,
  demand_id,
  studio_id,
  verified_activation_count,
  verification_status,
  synthetic,
  source_raw_row_id
from nia.operating_verified_events
where verification_status = 'Verified'
  and analytics_allowed
  and data_classification <> 'Restricted payroll';

drop trigger if exists operating_action_events_immutable on nia.operating_action_events;
create trigger operating_action_events_immutable before update or delete on nia.operating_action_events for each row execute function nia.reject_immutable_mutation();
drop trigger if exists operating_evidence_immutable on nia.operating_evidence;
create trigger operating_evidence_immutable before update or delete on nia.operating_evidence for each row execute function nia.reject_immutable_mutation();
drop trigger if exists operating_approvals_immutable on nia.operating_approvals;
create trigger operating_approvals_immutable before update or delete on nia.operating_approvals for each row execute function nia.reject_immutable_mutation();
drop trigger if exists member_activation_records_immutable on nia.member_activation_records;
create trigger member_activation_records_immutable before update or delete on nia.member_activation_records for each row execute function nia.reject_immutable_mutation();
drop trigger if exists operating_verified_events_immutable on nia.operating_verified_events;
create trigger operating_verified_events_immutable before update or delete on nia.operating_verified_events for each row execute function nia.reject_immutable_mutation();

alter table nia.operating_actions enable row level security;
alter table nia.operating_actions force row level security;
create policy operating_actions_read_policy on nia.operating_actions for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy operating_actions_write_policy on nia.operating_actions for all using (nia.current_actor_role() = 'administrator') with check (nia.current_actor_role() = 'administrator');

alter table nia.operating_action_events enable row level security;
alter table nia.operating_action_events force row level security;
create policy operating_action_events_read_policy on nia.operating_action_events for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy operating_action_events_insert_policy on nia.operating_action_events for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.operating_evidence enable row level security;
alter table nia.operating_evidence force row level security;
create policy operating_evidence_read_policy on nia.operating_evidence for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy operating_evidence_insert_policy on nia.operating_evidence for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.operating_approvals enable row level security;
alter table nia.operating_approvals force row level security;
create policy operating_approvals_read_policy on nia.operating_approvals for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy operating_approvals_insert_policy on nia.operating_approvals for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.member_activation_batches enable row level security;
alter table nia.member_activation_batches force row level security;
create policy member_activation_batches_read_policy on nia.member_activation_batches for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy member_activation_batches_write_policy on nia.member_activation_batches for all using (nia.current_actor_role() = 'administrator') with check (nia.current_actor_role() = 'administrator');

alter table nia.member_activation_records enable row level security;
alter table nia.member_activation_records force row level security;
create policy member_activation_records_read_policy on nia.member_activation_records for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy member_activation_records_insert_policy on nia.member_activation_records for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.operating_verified_events enable row level security;
alter table nia.operating_verified_events force row level security;
create policy operating_verified_events_read_policy on nia.operating_verified_events for select using (nia.current_actor_role() in ('operator', 'finance', 'administrator'));
create policy operating_verified_events_insert_policy on nia.operating_verified_events for insert with check (nia.current_actor_role() = 'administrator');

commit;

-- Non-production rollback order:
-- drop view insights_verified_activation_events; then drop triggers and tables
-- operating_verified_events, member_activation_records,
-- member_activation_batches, operating_approvals, operating_evidence,
-- operating_action_events, operating_actions. Do not remove the shared
-- nia.reject_immutable_mutation function.
