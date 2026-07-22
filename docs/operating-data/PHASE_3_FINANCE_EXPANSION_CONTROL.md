# Phase 3 finance and expansion control

Status: synthetic, shadow-mode implementation for draft review

Branch: `feat/finance-expansion-control`

Stacked base: `feat/closed-loop-demand-activation` at `a8ca95eff307903e7ab456615e068d4ece7cf466`

## Release boundary

This phase adds governed finance comparison, versioned guardrails, Pushkar approval workflows, Studio health and War Room routing. It does not add Phase 4 domain agents or Phase 5 autonomy.

The implementation cannot move money, change pricing, accept commercial terms, sign a contract, approve hiring, release a Studio, send WhatsApp or other external communication, write back to Google Sheets, apply a migration, or write to Production. All displayed records are synthetic and excluded from company totals.

## Expansion comparison

Every option exposes these components without an opaque composite score:

- refundable deposit;
- non-refundable deposit;
- Nia-funded capex;
- launch working capital;
- total upfront capital and capital per activation-ready Nest;
- monthly Studio partner cost;
- recurring cost per contracted and expected occupied Nest;
- commercial, compliance, physical-readiness and unresolved-dependency days;
- projected 90-day contribution margin and its explicit assumptions.

The Preview uses the locked Living CM2 value of ₹300 per expected occupied Nest per month for three months. It does not invent a Work or Essentials usage assumption. Deposits, capex and working capital remain visible capital components and are never amortised into contribution margin.

## Versioned financial controls

| Policy | Locked value | Response |
|---|---:|---|
| `POL-OPEX-CAP@v1` | ₹60 lakh per month | Escalate a forecast breach before month close |
| `POL-CASH-GUARD@v1` | ₹150 lakh minimum cash | Escalate a forecast or actual breach immediately |
| `POL-HIRING@v1` | Frozen | Block proposed hiring until an approved policy version changes |
| `POL-FIN-APPROVER@v1` | Pushkar | No automatic financial approval while the CFO role is vacant |

The ₹150 lakh cash guardrail equals 2.5 months at the ₹60 lakh opex cap. The product does not describe it as a three-month guardrail.

## Pushkar approval ledger

The append-only workflow covers all locked categories:

1. Pricing exception.
2. Studio commercial terms.
3. Deposit.
4. Nia-funded capex.
5. Financial commitment.
6. Payout exception.
7. Studio release.
8. Forecast guardrail breach.

Each request contains one category, requester, reason, optional amount, policy references, protected evidence, optimistic version and immutable audit events. Only Pushkar can record an approval or rejection. A decision never grants execution permission in this phase.

## Studio health

| Status | Exact rule | Required response |
|---|---|---|
| Green | Occupancy ≥78% and GM ≥20%, with non-negative CM | Hold and replicate |
| Amber | Occupancy 60% to <78% or GM 10% to <20% | Theatre review within 24 hours; action plan within 48 hours |
| Red | Occupancy <60%, GM <10% or negative CM | CEO and COO review the same day; decision within seven days |
| No data | Required operating or financial data missing | Maximum priority until corrected |

No-data, Amber and Red assessments route into the War Room. Every case has one accountable owner, response and decision deadlines where specified, expected evidence, append-only events, protected evidence and a verifier independent from the owner. Closure is impossible before proof and independent verification.

## Reporting boundary

Only a closed, independently verified War Room case can create the frozen `finance.war-room-closure.verified` projection. Its allowlist contains case ID, Studio ID, result, verifier, verification time, source-row identity and the synthetic marker. Evidence, commercial terms, raw financial records and mutation controls never cross into Rafiqi Insights.

## Configuration and API

- `RAFIQI_FINANCE_EXPANSION_CONTROL` defaults on for local development and Vercel Preview, and off in Production.
- `GET /api/finance-expansion/preview` rechecks authentication, sends `Cache-Control: no-store`, returns synthetic data and declares `writesEnabled: false`.
- Existing `RAFIQI_OPERATING_DATA_LIVE_READS=false` and `RAFIQI_WHATSAPP_OPERATING_WRITES=false` controls remain unchanged.

## Migration and rollback

`db/migrations/004_finance_expansion_control.sql` is additive and has not been applied. It defines finance evaluations and breaches, approval requests and immutable events, Studio-health assessments, War Room cases/evidence/events and a verified read-only reporting view with row-level policies.

For a non-production rollback, drop the Phase 3 view, Phase 3 immutable triggers and Phase 3 tables in the order recorded at the end of migration `004`. Do not remove or rewrite the shared Phase 1–2 registries, evidence, action or verification tables.
