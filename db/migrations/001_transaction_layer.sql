begin;

create schema if not exists nia;
create schema if not exists payroll_restricted;
create schema if not exists analytics_readonly;

revoke all on schema payroll_restricted from public;
revoke all on schema analytics_readonly from public;

create table if not exists nia.organisations (
  organisation_id uuid primary key,
  kind text not null check (kind in ('Nia', 'Employer', 'Vendor', 'Partner')),
  name text not null,
  status text not null default 'Active' check (status in ('Active', 'Suspended', 'Closed')),
  created_at timestamptz not null default now()
);

create table if not exists nia.sites (
  site_id uuid primary key,
  organisation_id uuid not null references nia.organisations(organisation_id),
  theatre text not null,
  location text not null,
  studio text not null,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now()
);
create index if not exists sites_organisation_id_idx on nia.sites(organisation_id);

create table if not exists nia.members (
  member_id uuid primary key,
  external_member_ref text not null unique,
  home_site_id uuid references nia.sites(site_id),
  display_label text not null,
  kyc_status text not null default 'Pending' check (kyc_status in ('Pending', 'Verified', 'Expired', 'Rejected')),
  consent_status text not null default 'Pending' check (consent_status in ('Pending', 'Granted', 'Revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists members_home_site_id_idx on nia.members(home_site_id);

create table if not exists nia.operator_profiles (
  actor_id uuid primary key,
  email text not null unique,
  role text not null check (role in ('member', 'operator', 'finance', 'partner', 'administrator', 'restricted-payroll')),
  member_id uuid references nia.members(member_id),
  organisation_id uuid references nia.organisations(organisation_id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists operator_profiles_member_id_idx on nia.operator_profiles(member_id);
create index if not exists operator_profiles_organisation_id_idx on nia.operator_profiles(organisation_id);

create table if not exists nia.service_catalog (
  service_code text primary key,
  cluster text not null check (cluster in ('Living', 'Work', 'Essentials')),
  service_name text not null,
  agent text not null check (agent in ('Infra & Community agent', 'Work agent', 'Save agent', 'Remit agent')),
  default_classification text not null check (default_classification in ('Operational', 'Sensitive', 'Restricted payroll')),
  requires_amount boolean not null default false,
  requires_settlement boolean not null default false,
  savings_margin_rule text,
  active boolean not null default true
);

create table if not exists nia.transactions (
  transaction_id uuid primary key,
  external_transaction_ref text not null unique,
  member_id uuid not null references nia.members(member_id),
  service_code text not null references nia.service_catalog(service_code),
  cluster text not null check (cluster in ('Living', 'Work', 'Essentials')),
  counterparty_id uuid not null references nia.organisations(organisation_id),
  site_id uuid references nia.sites(site_id),
  amount numeric(14,2) check (amount is null or amount >= 0),
  member_savings_amount numeric(14,2) check (member_savings_amount is null or member_savings_amount >= 0),
  nia_margin_amount numeric(14,2) check (nia_margin_amount is null or nia_margin_amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null check (status in ('Draft', 'Initiated', 'Under review', 'Approved', 'In progress', 'Fulfilled', 'Settling', 'Settled', 'Reconciled', 'Disputed', 'Closed', 'Cancelled', 'Reversed')),
  priority text not null default 'Routine' check (priority in ('Routine', 'Time sensitive', 'Critical')),
  owner_id uuid not null references nia.operator_profiles(actor_id),
  payment_method text,
  settlement_reference text,
  classification text not null check (classification in ('Operational', 'Sensitive', 'Restricted payroll')),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz,
  version bigint not null default 1,
  closed_at timestamptz,
  check (cluster <> 'Essentials' or (member_savings_amount > 0 and nia_margin_amount > 0))
);
create index if not exists transactions_member_id_idx on nia.transactions(member_id);
create index if not exists transactions_counterparty_id_idx on nia.transactions(counterparty_id);
create index if not exists transactions_site_id_idx on nia.transactions(site_id);
create index if not exists transactions_owner_id_idx on nia.transactions(owner_id);
create index if not exists transactions_queue_idx on nia.transactions(status, due_at) where status not in ('Closed', 'Cancelled', 'Reversed');
create index if not exists transactions_cluster_updated_idx on nia.transactions(cluster, updated_at desc);
create index if not exists transactions_settlement_idx on nia.transactions(settlement_reference) where settlement_reference is not null;

create table if not exists nia.transaction_evidence (
  evidence_id uuid primary key,
  transaction_id uuid not null references nia.transactions(transaction_id),
  kind text not null check (kind in ('Document', 'Photo', 'Confirmation', 'Provider reference', 'Ledger reference')),
  label text not null,
  object_key text,
  classification text not null check (classification in ('Operational', 'Sensitive', 'Restricted payroll')),
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references nia.operator_profiles(actor_id)
);
create index if not exists transaction_evidence_transaction_id_idx on nia.transaction_evidence(transaction_id);

create table if not exists nia.transaction_events (
  event_id uuid primary key,
  transaction_id uuid not null references nia.transactions(transaction_id),
  event_type text not null,
  from_state text,
  to_state text not null,
  actor_id uuid references nia.operator_profiles(actor_id),
  reason text,
  classification text not null check (classification in ('Operational', 'Sensitive', 'Restricted payroll')),
  analytics_allowed boolean not null default false,
  verified boolean not null default false,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists transaction_events_transaction_time_idx on nia.transaction_events(transaction_id, occurred_at desc);
create index if not exists transaction_events_projection_idx on nia.transaction_events(occurred_at, transaction_id) where verified and analytics_allowed and classification <> 'Restricted payroll';

create table if not exists nia.ledger_accounts (
  account_id uuid primary key,
  account_code text not null unique,
  account_name text not null,
  account_type text not null check (account_type in ('Asset', 'Liability', 'Income', 'Expense', 'Equity')),
  member_id uuid references nia.members(member_id),
  organisation_id uuid references nia.organisations(organisation_id),
  active boolean not null default true
);
create index if not exists ledger_accounts_member_id_idx on nia.ledger_accounts(member_id);
create index if not exists ledger_accounts_organisation_id_idx on nia.ledger_accounts(organisation_id);

create table if not exists nia.ledger_batches (
  batch_id uuid primary key,
  transaction_id uuid not null references nia.transactions(transaction_id),
  posted_at timestamptz not null default now(),
  posted_by uuid not null references nia.operator_profiles(actor_id),
  classification text not null check (classification in ('Operational', 'Sensitive', 'Restricted payroll')),
  unique (batch_id, transaction_id)
);
create index if not exists ledger_batches_transaction_id_idx on nia.ledger_batches(transaction_id);

create table if not exists nia.ledger_entries (
  entry_id uuid primary key,
  batch_id uuid not null references nia.ledger_batches(batch_id),
  account_id uuid not null references nia.ledger_accounts(account_id),
  side text not null check (side in ('Debit', 'Credit')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now()
);
create index if not exists ledger_entries_batch_id_idx on nia.ledger_entries(batch_id);
create index if not exists ledger_entries_account_id_idx on nia.ledger_entries(account_id);

create table if not exists nia.transaction_cases (
  case_id uuid primary key,
  transaction_id uuid not null references nia.transactions(transaction_id),
  kind text not null check (kind in ('Exception', 'Dispute', 'Welfare', 'Refund', 'Recovery')),
  status text not null check (status in ('Open', 'Investigating', 'Resolved', 'Closed')),
  owner_id uuid not null references nia.operator_profiles(actor_id),
  summary text not null,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  closed_at timestamptz
);
create index if not exists transaction_cases_transaction_id_idx on nia.transaction_cases(transaction_id);
create index if not exists transaction_cases_open_queue_idx on nia.transaction_cases(status, due_at) where status in ('Open', 'Investigating');

create table if not exists nia.settlements (
  settlement_id uuid primary key,
  transaction_id uuid not null references nia.transactions(transaction_id),
  counterparty_id uuid not null references nia.organisations(organisation_id),
  amount numeric(14,2) not null check (amount >= 0),
  status text not null check (status in ('Pending', 'Submitted', 'Settled', 'Failed', 'Reconciled', 'Reversed')),
  provider_reference text,
  due_at timestamptz,
  settled_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists settlements_transaction_id_idx on nia.settlements(transaction_id);
create index if not exists settlements_counterparty_id_idx on nia.settlements(counterparty_id);
create index if not exists settlements_open_queue_idx on nia.settlements(status, due_at) where status not in ('Reconciled', 'Reversed');

create table if not exists payroll_restricted.raw_payroll_rows (
  payroll_row_id uuid primary key,
  employer_id uuid not null references nia.organisations(organisation_id),
  member_id uuid not null references nia.members(member_id),
  pay_period_start date not null,
  pay_period_end date not null,
  encrypted_payload bytea not null,
  source_checksum text not null,
  ingested_at timestamptz not null default now(),
  ingested_by uuid not null references nia.operator_profiles(actor_id),
  unique (employer_id, pay_period_start, pay_period_end, source_checksum)
);
create index if not exists raw_payroll_rows_employer_period_idx on payroll_restricted.raw_payroll_rows(employer_id, pay_period_end desc);
create index if not exists raw_payroll_rows_member_period_idx on payroll_restricted.raw_payroll_rows(member_id, pay_period_end desc);

create table if not exists analytics_readonly.transaction_projections (
  projection_id uuid primary key,
  source_event_id uuid not null unique references nia.transaction_events(event_id),
  transaction_id uuid not null references nia.transactions(transaction_id),
  cluster text not null check (cluster in ('Living', 'Work', 'Essentials')),
  service_code text not null references nia.service_catalog(service_code),
  status text not null,
  amount numeric(14,2),
  theatre text,
  studio text,
  occurred_at timestamptz not null,
  projected_at timestamptz not null default now(),
  check (cluster in ('Living', 'Work', 'Essentials'))
);
create index if not exists transaction_projections_cluster_time_idx on analytics_readonly.transaction_projections(cluster, occurred_at desc);
create index if not exists transaction_projections_service_time_idx on analytics_readonly.transaction_projections(service_code, occurred_at desc);

create or replace function nia.reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append-only records cannot be updated or deleted';
end;
$$;

drop trigger if exists transaction_events_immutable on nia.transaction_events;
create trigger transaction_events_immutable before update or delete on nia.transaction_events for each row execute function nia.reject_immutable_mutation();
drop trigger if exists ledger_entries_immutable on nia.ledger_entries;
create trigger ledger_entries_immutable before update or delete on nia.ledger_entries for each row execute function nia.reject_immutable_mutation();

create or replace function nia.assert_ledger_batch_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  debit_total numeric(14,2);
  credit_total numeric(14,2);
begin
  select
    coalesce(sum(amount) filter (where side = 'Debit'), 0),
    coalesce(sum(amount) filter (where side = 'Credit'), 0)
  into debit_total, credit_total
  from nia.ledger_entries
  where batch_id = new.batch_id;
  if debit_total <= 0 or debit_total <> credit_total then
    raise exception 'ledger batch % is not balanced', new.batch_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ledger_batch_balance_check on nia.ledger_entries;
create constraint trigger ledger_batch_balance_check after insert on nia.ledger_entries deferrable initially deferred for each row execute function nia.assert_ledger_batch_balanced();

create or replace function analytics_readonly.assert_projection_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from nia.transaction_events
    where event_id = new.source_event_id
      and verified
      and analytics_allowed
      and classification <> 'Restricted payroll'
      and to_state in ('Reconciled', 'Closed')
  ) then
    raise exception 'only verified allowlisted events can enter reporting';
  end if;
  return new;
end;
$$;

drop trigger if exists transaction_projection_source_check on analytics_readonly.transaction_projections;
create trigger transaction_projection_source_check before insert on analytics_readonly.transaction_projections for each row execute function analytics_readonly.assert_projection_source();

create or replace function nia.current_actor_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from nia.operator_profiles where actor_id = nullif(current_setting('app.current_actor_id', true), '')::uuid and active;
$$;

alter table nia.transactions enable row level security;
alter table nia.transactions force row level security;
create policy transactions_read_policy on nia.transactions for select using (
  nia.current_actor_role() in ('administrator', 'finance', 'restricted-payroll')
  or (nia.current_actor_role() = 'operator' and classification <> 'Restricted payroll')
  or (nia.current_actor_role() = 'member' and member_id = nullif(current_setting('app.current_member_id', true), '')::uuid and classification <> 'Restricted payroll')
  or (nia.current_actor_role() = 'partner' and counterparty_id = nullif(current_setting('app.current_organisation_id', true), '')::uuid and classification <> 'Restricted payroll')
);
create policy transactions_write_policy on nia.transactions for insert with check (nia.current_actor_role() in ('operator', 'finance', 'administrator', 'restricted-payroll'));
create policy transactions_update_policy on nia.transactions for update using (nia.current_actor_role() in ('operator', 'finance', 'administrator', 'restricted-payroll')) with check (nia.current_actor_role() in ('operator', 'finance', 'administrator', 'restricted-payroll'));

revoke insert, update, delete on all tables in schema analytics_readonly from public;
revoke all on all tables in schema payroll_restricted from public;

commit;
