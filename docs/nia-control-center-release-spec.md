# Nia Control Center Product Release Specification

Status: implementation complete for the local operating preview
Release: Transaction Layer R1
Production status: deployment and production writes are disabled
Owner: Nia platform and operating teams

## 1. Release objective

Nia Control Center becomes the operational source of truth for Living, Work, and Essentials. It captures work, money, evidence, settlement, reconciliation, exceptions, and closure. Existing reports remain read-only projections of verified transaction events.

Nia acquires through Living, retains through Work, and monetises the full wallet through Essentials.

## 2. Locked product rules

1. Nia has exactly three clusters: Living, Work, and Essentials.
2. Rafiqi Save and Rafiqi Remit are services inside Essentials.
3. Rafiqi has four agents: Infra & Community agent, Work agent, Save agent, and Remit agent.
4. Reports cannot create, update, settle, reconcile, or close transactions.
5. Only verified Reconciled and Closed events can create analytical projections.
6. Raw payroll rows remain in a restricted payroll boundary.
7. Restricted payroll events and personal payroll data never enter analytics.
8. A transaction cannot close without evidence.
9. A financial transaction cannot reconcile without a settlement reference and balanced ledger posting.
10. Production deployment is outside this release.

## 3. Release scope

### Shared foundation

- Member, organisation, employer, vendor, partner, site, and operator identities
- Role-based access for members, operators, finance, partners, administrators, and restricted payroll staff
- Service catalogue and eligibility rules
- Transaction lifecycle with optimistic concurrency
- Evidence, consent, KYC, document custody, cases, notifications, and audit events
- Double-entry ledger, payments, receipts, refunds, credits, deposits, and adjustments
- Settlement and reconciliation queues
- Read-only verified reporting projections
- API boundaries for external providers and future webhooks

### Phase 1: Living and Work

Living includes move-in, membership, billing, utilities, meals, maintenance, incidents, welfare, transfers, move-out, deposits, vendor operations, and daily occupancy reconciliation.

Work includes employer accounts, worker passports, matching, offers, joining, attendance, wage inputs, restricted payroll reconciliation, disputes, redeployment, exits, employer billing, collections, and employer service levels.

### Phase 2: Essentials commerce

Essentials includes catalogue, member pricing, stock, subscriptions, orders, fulfilment, delivery, pickup, cancellation, returns, refunds, promotions, credits, purchase orders, and vendor settlement.

Every Essentials service must pass the savings-margin gate. The member must save or retain more money while Nia records sustainable positive margin.

### Phase 3: Rafiqi financial rails

- Save agent: goals, recurring deposits, lock periods, withdrawals, partner settlement, and receipts
- Remit agent: beneficiaries, consent, fees, delivery amount, initiation, retry, reversal, provider reconciliation, and family notification
- Later rails: credit, insurance, document custody, and emergency liquidity

## 4. Personas and permissions

| Persona | Can view | Can create or progress | Restricted payroll | Reporting |
|---|---|---|---|---|
| Member | Own non-payroll transactions | Member confirmations and consent only | No | Own receipts and status |
| Operator | Assigned non-payroll transactions | Yes, within valid transitions | No | Operational queues |
| Finance | Financial and settlement transactions | Yes | Yes | Verified aggregates only |
| Partner | Own counterparty transactions | Partner fulfilment and provider references | No | Own settlement status |
| Administrator | All operational records | Yes | Yes | Verified projections |
| Restricted payroll | Restricted Work records | Payroll review and reconciliation | Yes | No raw rows |

Server routes re-check role permissions. The browser shell and proxy are not the only authorisation layer.

## 5. Core data model

### Transaction envelope

Every transaction contains:

- transaction ID and external reference
- member and cluster
- service and responsible agent
- counterparty and site
- amount and currency
- member savings and Nia margin for every Essentials transaction
- current state and priority
- owner
- classification
- payment method
- settlement reference
- opened, updated, due, and closure timestamps
- evidence
- append-only events
- balanced ledger entries
- linked cases

### Supporting records

- Member
- Organisation
- Site
- Operator profile
- Service definition
- Evidence
- Transaction event
- Ledger account
- Ledger batch and entry
- Settlement
- Case
- Restricted payroll row
- Reporting projection

Postgres identifiers use UUIDs. Money uses exact numeric values. All timestamps are timezone-aware. Foreign keys and operating queue indexes are explicit.

## 6. Transaction state machine

| State | Valid next states | Gate |
|---|---|---|
| Draft | Initiated, Cancelled | Actor and reason for cancellation |
| Initiated | Under review, Approved, Cancelled | Eligibility and ownership |
| Under review | Approved, Disputed, Cancelled | Review result |
| Approved | In progress, Cancelled | Required approval |
| In progress | Fulfilled, Disputed, Cancelled | Execution evidence for fulfilment |
| Fulfilled | Settling, Settled, Disputed | Service proof |
| Settling | Settled, Disputed | Provider response |
| Settled | Reconciled, Disputed, Reversed | Settlement reference |
| Reconciled | Closed, Disputed, Reversed | Balanced ledger and verification |
| Disputed | Under review, In progress, Settling, Reconciled, Reversed, Closed | Named case owner and reason |
| Reversed | Closed | Reversal evidence |
| Closed | None | Closure evidence |
| Cancelled | None | Reason |

Every command includes the expected current state. A stale command fails instead of overwriting a newer transaction.

## 7. Daily operating loop

1. Capture the event.
2. Validate identity, service, amount, consent, and eligibility.
3. Assign one named owner.
4. Obtain approval where required.
5. Execute the service or payment.
6. Record evidence.
7. Settle with the partner, employer, or vendor.
8. Post and validate balanced ledger entries.
9. Reconcile external and internal references.
10. Open and escalate cases for exceptions.
11. Close only after proof and verification.
12. Project the verified event into reporting.

## 8. First implementation scope

The first executable slice includes:

### Living

- Move-in and Nest activation
- Move-out and deposit closure
- Membership billing
- Utilities
- Meals
- Maintenance
- Security incidents
- Welfare
- Room and corridor transfer

### Work

- Worker passport and matching
- Offer to joining
- Attendance and wage input verification
- Restricted payroll reconciliation
- Wage disputes
- Redeployment
- Employment exit and final settlement
- Employer billing and collections

### Essentials and Rafiqi mapping

- Orders, subscriptions, refunds, purchase orders, and vendor settlement
- Save goal deposits and withdrawals
- Remit transfers, retries, and reversals
- Credit and insurance service envelopes

## 9. Product surfaces

### Operator console

- Search and filter by cluster
- Create a transaction from the governed service catalogue
- See owner, due time, priority, evidence, and valid next actions
- Progress only through allowed states
- Open and manage exceptions
- See the immutable event trail

### Finance console

- Amount, payment, settlement, and reconciliation queues
- Restricted payroll access only for authorised roles
- Settlement references and provider evidence
- Balanced debit and credit postings
- Refund, reversal, recovery, and dispute workflows

### Member experience

- Own service status
- Amount, payment method, due time, and receipt
- Consent and confirmation actions
- Evidence visible to the member
- No internal payroll, partner, or reconciliation data

### Partner workflow

- Counterparty-scoped queue
- Fulfilment confirmation
- Provider reference and evidence submission
- Settlement status
- Member privacy preserved

### Reporting experience

- Read-only
- Verified Reconciled and Closed projections only
- No raw payroll
- No mutation controls
- Source event traceability

## 10. Event-to-report mapping

| Event state | Reporting disposition |
|---|---|
| Draft | Operational only |
| Initiated | Operational only |
| Under review | Operational only |
| Approved | Operational only |
| In progress | Operational only |
| Fulfilled | Operational only |
| Settling | Operational only |
| Settled | Operational only |
| Reconciled | Verified projection |
| Disputed | Operational only |
| Closed | Verified projection |
| Cancelled | Operational only |
| Reversed | Operational only until reconciled closure |
| Any restricted payroll event | Excluded |

Projection fields are source event ID, transaction ID, cluster, service, state, approved amount, theatre, studio, event time, and verification flag. Reports cannot access personal payroll rows.

## 11. Acceptance criteria

- The service catalogue contains only Living, Work, and Essentials clusters.
- Save and Remit appear inside Essentials and retain their named agents.
- Operators can create and progress transactions locally.
- Invalid, stale, or unauthorised transitions fail.
- Fulfilment and closure require evidence.
- Settlement and reconciliation require a settlement reference.
- Ledger batches reject unbalanced debit and credit totals.
- Financial settlement, reconciliation, and reversal require balanced postings.
- Disputes open a named case in the same transaction.
- Essentials creation requires positive member savings and positive Nia margin.
- Restricted payroll is hidden from operators, members, partners, and analytics.
- Only verified allowlisted events create reporting projections.
- All event and ledger records are append-only.
- Desktop and mobile workflows are usable.
- Type checks, automated tests, and the production build pass.
- No production deployment or production write enablement occurs.

## 12. Release and migration plan

1. Review this local preview with operating, finance, payroll, and data owners.
2. Provision a non-production Postgres database.
3. Apply the transaction schema and row-level policies in a test environment.
4. Connect durable object storage for evidence.
5. Integrate provider sandboxes for payment, Save, and Remit.
6. Run role, privacy, reconciliation, recovery, and load tests.
7. Run a controlled internal pilot with synthetic or consented test data.
8. Obtain security, finance, payroll, and operating sign-off.
9. Prepare a separate production release decision.

## 13. Explicitly deferred

- Production deployment
- Production payment movement
- Live payroll ingestion
- Live member messaging
- Provider credential activation
- Credit underwriting
- Insurance issuance
- Automated external settlement
