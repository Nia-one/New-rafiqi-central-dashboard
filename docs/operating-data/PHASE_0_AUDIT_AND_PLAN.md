# Phase 0 audit and Phase 1–2 implementation plan

Date: 17 July 2026  
Feature branch: `feat/closed-loop-demand-activation`  
Base commit: `a192b298126e1139c3d7aa9c98bc442cdb86f6ea`  
Dependency: draft PR #20, `feat/post-login-workspace-chooser`, which contains the approved workspace chooser, separated navigation, Operations Mandate, Scouter’s Journey Plan and demand map

## Repository state before this branch

- The selected checkout is `SachinChhabra1/nia-operating-system-dashboard`.
- The only pre-existing dirty file was the generated `tsconfig.tsbuildinfo`; it is not part of this branch and must not be staged.
- No `AGENTS.md`, session handoff or separate implementation-plan file was present.
- Rafiqi Insights and Operations Control Center already share one authenticated Next.js App Router shell.
- Operations navigation is isolated, but it exposes only Scouter’s Journey Plan before this branch.
- Existing approved reference images include `.v0-theme-final.png`, `.v0-theme-overview.png` and `.v0-theme-mobile.png`. The locked design contract in the build brief overrides their legacy teal/green colours while retaining their restrained shell, density and responsive hierarchy.

## Current storage and integration boundaries

| Boundary | Current state | Phase 0–2 treatment |
|---|---|---|
| Reporting and operating dashboard data | Hard-coded illustrative TypeScript fixtures | Preserve; label new fixtures synthetic and exclude them from live totals |
| Transaction preview | Ignored local `.nia-control/transactions.json` | Preserve; no production write enablement |
| Action log | In-memory local store seeded from illustrative diagnostics | Preserve; add a separate governed action state machine for demand activation |
| Heartbeats | In-memory local store polled every 45 seconds | Preserve; add the supplied incident-or-60-minute cadence as a separate contract |
| Database | Additive Postgres migration `001_transaction_layer.sql` with RLS and immutable events | Add a backward-compatible Phase 0–2 migration and rollback note; do not apply to Production |
| Google Sheets | Not connected | Add a read-only adapter and deterministic fixture adapter; quarantine invalid rows and preserve lineage |
| WhatsApp | Not connected | Add a disabled adapter plus cadence/idempotency rules; never send live messages |
| Evidence | Metadata only in local fixtures | Store protected references and metadata only; reject Member PII, KYC and payroll material |

## Workbook findings

- 20 tabs and 20 tables are present.
- `Data_Dictionary` defines 327 fields across 16 intake tables.
- The workbook includes `Source_Registry` and `Policy_Registry` but no `Metric_Registry`; the application semantic layer must add that registry without altering the workbook.
- Formula-error inspection found no `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?` or `#N/A` matches.
- The workbook contains no operating rows beyond its locked policies; fixtures are therefore required for branch Preview.

## Naming and product gaps

- Visible metadata and login copy use `RafiQi Central`; the internal product must be `Rafiqi Central`.
- Legacy Scouter’s Journey Plan copy uses `PG` and literal green, teal, purple and amber styles. The related Operations surface must move to semantic blue-grey tokens without changing its map capability.
- The existing global token names are teal-derived even where they are called blue. Phase 0–2 will add canonical token aliases and use them for new and materially changed Operations surfaces; unrelated Insights layouts will not be redesigned.

## Baseline checks

- Existing automated suite: 82 tests passed on 17 July 2026.
- The TypeScript check emitted no diagnostics but did not finish within 90 seconds and was stopped; the final gate will run it again after the scoped implementation.
- The production build was deferred until the contracts were committed and will be part of the final gate.

## Phase 1 implementation

1. Define the workbook tab contract, source registry, metric registry and effective-dated policy registry.
2. Add read-only Google Sheets and fixture adapters behind disabled credentials.
3. Preserve every raw row with batch, source row identity, source update time, ingestion time and checksum.
4. Make imports idempotent; quarantine missing columns, invalid values and duplicate identities without coercion.
5. Build canonical Theatre, Studio, Enterprise, demand, people and Member-activation records.
6. Expose source, `as of`, freshness, verification and synthetic/quarantined state to the UI.

## Phase 2 implementation

1. Rank nearby Studio options using visible headcount, date, distance, capital, deposit, capex, recurring cost, friction and projected 90-day contribution inputs.
2. Create governed actions with one owner, due time, evidence, approval tier, confidence and optimistic version.
3. Enforce valid transitions, evidence before proof, independent verification and Pushkar approval for pricing or financial exceptions.
4. Verify pseudonymous Member activations against ready Nests and the demand requirement.
5. Publish only verified allowlisted events into a read-only Rafiqi Insights projection.
6. Demonstrate the complete loop in shadow mode with synthetic fixtures and no production writes, money movement, contracts, external communication or irreversible action.

## Release gate and rollback

- Run tests, type check, build, access-control checks and the end-to-end acceptance test.
- Capture the changed Operations surface at 1440px, 1024px and 390px.
- Keep Production flags and every live adapter off by default.
- Roll back application behaviour by disabling `RAFIQI_CLOSED_LOOP_DEMAND_ACTIVATION`.
- Roll back the additive database migration only in a non-production review environment using the migration’s documented reverse-order drops; no Production migration is authorised by this branch.
