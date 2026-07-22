begin;

-- Phase 3 only: finance guardrails, Pushkar approval workflow, Studio health,
-- War Room routing and verified read-only control outcomes. Additive review
-- artifact only. It does not authorise Production writes or execution.

create table if not exists nia.financial_guardrail_evaluations (
  evaluation_id uuid primary key,
  period_start date not null,
  current_monthly_opex_inr numeric(14,2) not null check (current_monthly_opex_inr >= 0),
  forecast_monthly_opex_inr numeric(14,2) not null check (forecast_monthly_opex_inr >= 0),
  current_cash_inr numeric(14,2) not null check (current_cash_inr >= 0),
  pending_commitments_inr numeric(14,2) not null check (pending_commitments_inr >= 0),
  proposed_upfront_capital_inr numeric(14,2) not null check (proposed_upfront_capital_inr >= 0),
  projected_cash_after_commitment_inr numeric(14,2) not null,
  proposed_new_hires integer not null default 0 check (proposed_new_hires >= 0),
  opex_policy_id text not null,
  opex_policy_version integer not null check (opex_policy_version > 0),
  cash_policy_id text not null,
  cash_policy_version integer not null check (cash_policy_version > 0),
  hiring_policy_id text not null,
  hiring_policy_version integer not null check (hiring_policy_version > 0),
  evaluated_at timestamptz not null,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  synthetic boolean not null default false,
  unique (period_start, source_raw_row_id, evaluated_at)
);

create table if not exists nia.financial_guardrail_breaches (
  breach_id uuid primary key,
  evaluation_id uuid not null references nia.financial_guardrail_evaluations(evaluation_id),
  breach_type text not null check (breach_type in ('Opex forecast breach', 'Cash guardrail breach', 'Hiring freeze breach')),
  policy_id text not null,
  policy_version integer not null check (policy_version > 0),
  observed_value numeric(14,2) not null,
  threshold_value numeric(14,2) not null,
  variance numeric(14,2) not null check (variance > 0),
  required_response text not null check (required_response in ('Escalate before month close', 'Immediate escalation', 'Blocked until policy changes')),
  created_at timestamptz not null,
  unique (evaluation_id, breach_type)
);

create table if not exists nia.financial_approval_requests (
  approval_request_id uuid primary key,
  category text not null check (category in ('Pricing exception', 'Studio commercial terms', 'Deposit', 'Nia-funded capex', 'Financial commitment', 'Payout exception', 'Studio release', 'Forecast guardrail breach')),
  studio_id text references nia.operating_studios(studio_id),
  amount_inr numeric(14,2) check (amount_inr is null or amount_inr >= 0),
  requested_by uuid not null references nia.operator_profiles(actor_id),
  requested_at timestamptz not null,
  required_approver text not null default 'Pushkar' check (required_approver = 'Pushkar'),
  status text not null check (status in ('Requested', 'Approved', 'Rejected')),
  reason text not null,
  version bigint not null default 1 check (version > 0),
  synthetic boolean not null default false,
  check (status = 'Requested' or version > 1)
);
create index if not exists financial_approval_queue_idx on nia.financial_approval_requests(status, requested_at);

create table if not exists nia.financial_approval_events (
  approval_event_id uuid primary key,
  approval_request_id uuid not null references nia.financial_approval_requests(approval_request_id),
  event_kind text not null check (event_kind in ('Requested', 'Evidence added', 'Decision')),
  prior_status text,
  next_status text not null check (next_status in ('Requested', 'Approved', 'Rejected')),
  actor_id uuid not null references nia.operator_profiles(actor_id),
  protected_evidence_reference text check (protected_evidence_reference is null or protected_evidence_reference like 'protected://%'),
  note text not null,
  approval_version bigint not null check (approval_version > 0),
  occurred_at timestamptz not null,
  unique (approval_request_id, approval_version)
);

create table if not exists nia.studio_health_assessments (
  health_assessment_id uuid primary key,
  studio_id text not null references nia.operating_studios(studio_id),
  health_status text not null check (health_status in ('Green', 'Amber', 'Red', 'No data')),
  contracted_nests integer,
  occupied_nests integer,
  occupancy_ratio numeric(7,6),
  gross_margin_ratio numeric(7,6),
  contribution_margin_inr numeric(14,2),
  data_complete boolean not null,
  required_response text not null,
  owner_actor_id uuid not null references nia.operator_profiles(actor_id),
  review_due_at timestamptz,
  action_plan_due_at timestamptz,
  decision_due_at timestamptz,
  policy_versions jsonb not null,
  assessed_at timestamptz not null,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  synthetic boolean not null default false,
  check (contracted_nests is null or contracted_nests >= 0),
  check (occupied_nests is null or occupied_nests >= 0),
  check (occupancy_ratio is null or occupancy_ratio >= 0),
  unique (studio_id, assessed_at, source_raw_row_id)
);
create index if not exists studio_health_exception_idx on nia.studio_health_assessments(health_status, review_due_at) where health_status <> 'Green';

create table if not exists nia.war_room_cases (
  war_room_case_id uuid primary key,
  studio_id text references nia.operating_studios(studio_id),
  title text not null,
  priority text not null check (priority in ('Priority', 'Critical', 'Maximum')),
  case_state text not null check (case_state in ('Open', 'Assigned', 'In progress', 'Evidence submitted', 'Verified', 'Closed', 'Reopened', 'Escalated')),
  owner_actor_id uuid not null references nia.operator_profiles(actor_id),
  verifier_actor_id uuid references nia.operator_profiles(actor_id),
  response_due_at timestamptz not null,
  decision_due_at timestamptz,
  trigger_summary text[] not null,
  required_evidence text[] not null,
  version bigint not null default 1 check (version > 0),
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  synthetic boolean not null default false,
  check (cardinality(trigger_summary) > 0),
  check (cardinality(required_evidence) > 0),
  check (verifier_actor_id is null or verifier_actor_id <> owner_actor_id)
);
create index if not exists war_room_queue_idx on nia.war_room_cases(case_state, priority, response_due_at);

create table if not exists nia.war_room_case_approvals (
  war_room_case_id uuid not null references nia.war_room_cases(war_room_case_id),
  approval_request_id uuid not null references nia.financial_approval_requests(approval_request_id),
  primary key (war_room_case_id, approval_request_id)
);

create table if not exists nia.war_room_events (
  war_room_event_id uuid primary key,
  war_room_case_id uuid not null references nia.war_room_cases(war_room_case_id),
  prior_state text,
  next_state text not null,
  actor_id uuid not null references nia.operator_profiles(actor_id),
  case_version bigint not null check (case_version > 0),
  note text not null,
  occurred_at timestamptz not null,
  unique (war_room_case_id, case_version)
);

create table if not exists nia.war_room_evidence (
  war_room_evidence_id uuid primary key,
  war_room_case_id uuid not null references nia.war_room_cases(war_room_case_id),
  protected_reference text not null check (protected_reference like 'protected://%'),
  description text not null,
  submitted_by uuid not null references nia.operator_profiles(actor_id),
  submitted_at timestamptz not null,
  unique (war_room_case_id, protected_reference)
);

create table if not exists nia.finance_control_verified_events (
  finance_control_event_id uuid primary key,
  event_type text not null check (event_type = 'finance.war-room-closure.verified'),
  war_room_case_id uuid not null references nia.war_room_cases(war_room_case_id),
  studio_id text references nia.operating_studios(studio_id),
  result text not null check (result = 'Verified closure'),
  verified_by uuid not null references nia.operator_profiles(actor_id),
  verified_at timestamptz not null,
  analytics_allowed boolean not null default false,
  source_raw_row_id uuid not null references nia.operating_raw_import_rows(raw_row_id),
  synthetic boolean not null default false,
  unique (event_type, war_room_case_id)
);

create or replace view nia.insights_verified_finance_control_events as
select event_type, war_room_case_id, studio_id, result, verified_at, source_raw_row_id, synthetic
from nia.finance_control_verified_events
where analytics_allowed;

drop trigger if exists financial_guardrail_evaluations_immutable on nia.financial_guardrail_evaluations;
create trigger financial_guardrail_evaluations_immutable before update or delete on nia.financial_guardrail_evaluations for each row execute function nia.reject_immutable_mutation();
drop trigger if exists financial_guardrail_breaches_immutable on nia.financial_guardrail_breaches;
create trigger financial_guardrail_breaches_immutable before update or delete on nia.financial_guardrail_breaches for each row execute function nia.reject_immutable_mutation();
drop trigger if exists financial_approval_events_immutable on nia.financial_approval_events;
create trigger financial_approval_events_immutable before update or delete on nia.financial_approval_events for each row execute function nia.reject_immutable_mutation();
drop trigger if exists studio_health_assessments_immutable on nia.studio_health_assessments;
create trigger studio_health_assessments_immutable before update or delete on nia.studio_health_assessments for each row execute function nia.reject_immutable_mutation();
drop trigger if exists war_room_events_immutable on nia.war_room_events;
create trigger war_room_events_immutable before update or delete on nia.war_room_events for each row execute function nia.reject_immutable_mutation();
drop trigger if exists war_room_evidence_immutable on nia.war_room_evidence;
create trigger war_room_evidence_immutable before update or delete on nia.war_room_evidence for each row execute function nia.reject_immutable_mutation();
drop trigger if exists finance_control_verified_events_immutable on nia.finance_control_verified_events;
create trigger finance_control_verified_events_immutable before update or delete on nia.finance_control_verified_events for each row execute function nia.reject_immutable_mutation();

alter table nia.financial_guardrail_evaluations enable row level security;
alter table nia.financial_guardrail_evaluations force row level security;
create policy financial_guardrail_evaluations_read_policy on nia.financial_guardrail_evaluations for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy financial_guardrail_evaluations_insert_policy on nia.financial_guardrail_evaluations for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.financial_guardrail_breaches enable row level security;
alter table nia.financial_guardrail_breaches force row level security;
create policy financial_guardrail_breaches_read_policy on nia.financial_guardrail_breaches for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy financial_guardrail_breaches_insert_policy on nia.financial_guardrail_breaches for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.financial_approval_requests enable row level security;
alter table nia.financial_approval_requests force row level security;
create policy financial_approval_requests_read_policy on nia.financial_approval_requests for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy financial_approval_requests_write_policy on nia.financial_approval_requests for all using (nia.current_actor_role() = 'administrator') with check (nia.current_actor_role() = 'administrator');

alter table nia.financial_approval_events enable row level security;
alter table nia.financial_approval_events force row level security;
create policy financial_approval_events_read_policy on nia.financial_approval_events for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy financial_approval_events_insert_policy on nia.financial_approval_events for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.studio_health_assessments enable row level security;
alter table nia.studio_health_assessments force row level security;
create policy studio_health_assessments_read_policy on nia.studio_health_assessments for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy studio_health_assessments_insert_policy on nia.studio_health_assessments for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.war_room_cases enable row level security;
alter table nia.war_room_cases force row level security;
create policy war_room_cases_read_policy on nia.war_room_cases for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy war_room_cases_write_policy on nia.war_room_cases for all using (nia.current_actor_role() = 'administrator') with check (nia.current_actor_role() = 'administrator');

alter table nia.war_room_case_approvals enable row level security;
alter table nia.war_room_case_approvals force row level security;
create policy war_room_case_approvals_read_policy on nia.war_room_case_approvals for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy war_room_case_approvals_insert_policy on nia.war_room_case_approvals for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.war_room_events enable row level security;
alter table nia.war_room_events force row level security;
create policy war_room_events_read_policy on nia.war_room_events for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy war_room_events_insert_policy on nia.war_room_events for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.war_room_evidence enable row level security;
alter table nia.war_room_evidence force row level security;
create policy war_room_evidence_read_policy on nia.war_room_evidence for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy war_room_evidence_insert_policy on nia.war_room_evidence for insert with check (nia.current_actor_role() = 'administrator');

alter table nia.finance_control_verified_events enable row level security;
alter table nia.finance_control_verified_events force row level security;
create policy finance_control_verified_events_read_policy on nia.finance_control_verified_events for select using (nia.current_actor_role() in ('finance', 'administrator'));
create policy finance_control_verified_events_insert_policy on nia.finance_control_verified_events for insert with check (nia.current_actor_role() = 'administrator');

commit;

-- Non-production rollback order:
-- drop view nia.insights_verified_finance_control_events; drop Phase 3
-- immutable triggers; then drop finance_control_verified_events,
-- war_room_evidence, war_room_events, war_room_case_approvals,
-- war_room_cases, studio_health_assessments, financial_approval_events,
-- financial_approval_requests, financial_guardrail_breaches and
-- financial_guardrail_evaluations. Do not remove shared Phase 1–2 tables,
-- policies, functions or data. This migration has not been applied.
