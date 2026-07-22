# Nia Margins Self-Drive Verification

## Scope

Shadow-only Nia Margins loop. It explains the operating cause moving billed CM2, routes the cause to the correct owner, verifies recovery independently, and exports a governed Self Learn recommendation. Collection leakage remains in Cash & Control and is never included in CM2.

## Safety boundary

- Synthetic fixture data only.
- No price, payment, contract, supplier, Studio, or external action is enabled.
- FONO occupancy routes to New Adds; SP occupancy routes to Enterprise Demand.
- Ramp Studios are excluded from post-ramp occupancy exceptions.
- Recommendation is Observed-only, Low confidence, and unable to auto-adopt.

## Verification

- Focused engine and workspace tests: 10/10 passed.
- TypeScript: passed.
- Production build: passed.
- `git diff --check`: passed.
- The previous responsive local QA covered 1440, 1024, and 390 px using a temporary harness removed before this commit.

## Known integration requirement

The unified Rafiqi Central shell will mount this standalone workspace and provide its final navigation path. This branch intentionally does not change shared navigation or the app shell.
