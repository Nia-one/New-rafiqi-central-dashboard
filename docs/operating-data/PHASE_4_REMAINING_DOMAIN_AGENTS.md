# Phase 4 remaining domain agents

Phase 4 extends the existing Operations Control Center with governed, fixture-only loops for Essentials, People and Execution, Member Continuity, and Governance and IR. It is stacked on the verified Phase 3.1 head `93ff68ca61513c1ee4c5c37f6a19b199a6029691` and does not begin Phase 5.

## Operating boundary

- `RAFIQI_REMAINING_DOMAIN_CONTROL` defaults on only for local development and Preview. It defaults off in Production and can be explicitly disabled.
- All displayed records are synthetic. Phase 4 performs no live read, Production write, external message, payment, contract, Studio release, payroll change, report mutation or deployment.
- Phase 4 reuses the existing action-state vocabulary, protected evidence references, optimistic versions and append-only history. A domain action cannot close before protected proof and independent verification.
- Existing Phase 2 demand activation, Phase 3 financial controls and Phase 3.1 FONO/SP rules remain unchanged.

## Essentials loop

The fixture models governed catalogue, supplier, purchase terms, inventory ownership, stock, orders, fulfilment, attach, repeat, Curry, Save and Remit records. Member savings and Nia margin use versioned policies:

- `POL-ESSENTIALS-SAVINGS-FLOOR@v1`: `MRP - Member price` must be greater than zero.
- `POL-ESSENTIALS-MARGIN-FLOOR@v1`: `Member price - governed direct supplier cost` must be greater than zero.

Rows that fail either economic rule or contain impossible population or fulfilment counts are quarantined with row lineage. Stockouts route into the shared action ledger. The synthetic closed example records one owner, protected evidence, an independent verifier and immutable history; it does not place an order or move money.

## People and execution loop

JCO, EAE, Theatre and functional ownership are visible. The control keeps three measures separate:

1. activity updates;
2. action closure rate;
3. independently resolved-outcome rate.

Missing reporting uses `POL-HEARTBEAT-CADENCE@v1`. Metric-gaming detection flags activity and closure without a resolved outcome. A payout exception is raised when a recorded payout exceeds the approved outcome amount or exists without a resolved outcome. Incentive eligibility consumes only the approved outcome amount and becomes zero when no resolved outcome exists. Raw payroll remains outside general analytics.

## Member continuity and retention

The projection joins existing anonymised Member tokens across Member Activation, Living, Work and Essentials sources. It does not create a duplicate Member master or disconnected continuity database. Pending signals remain visible but are excluded from the verified M6 denominator.

The governed registry provides the approximately 69% M6 reference, the below-65% warning and the 6% monthly churn operating reference. Every rendered token preserves cross-pillar source coverage.

## Governance and IR

Monthly MIS, board and investor drafts admit only independently verified, analytics-allowlisted, non-payroll facts with metric version, source row, as-of time and verifier. Pending, non-allowlisted and restricted-payroll facts are excluded with a reason.

All three outputs are read-only drafts. `POL-EXTERNAL-REPORT-APPROVER@v1` requires CEO approval, and the Preview has no send or publish capability. `externalReleasePermitted` and `reportMutationPermitted` remain `false`.

## Verification

- Focused Phase 4 suite: 10 passed.
- Complete operating-loop and component suite: 48 passed.
- Repository suite: 92 passed.
- TypeScript: passed with no diagnostics.
- Production build: passed.
- Responsive and interaction QA: passed at 1440px, 1024px and 390px CSS viewports. The document matched the viewport at each width; wide tables and the four-domain rail scroll inside their labelled regions. Operations navigation, the mobile menu and Governance jump link were exercised.
- Browser console: zero warnings and zero errors.
- Lint remains unavailable because the inherited `pnpm lint` script references an uninstalled `eslint` binary; Phase 4 does not change dependencies or the lockfile.

Review artifacts:

- `screenshots/domain-controls-1440.png`
- `screenshots/domain-controls-1024.png`
- `screenshots/domain-controls-390.png`

## Rollback

No schema migration or Production data change exists. Rollback is the additive code revert that removes the `Domain controls` navigation entry, the Phase 4 Preview builder, its feature flag, tests and styles. Keep all live adapter flags disabled throughout review.
