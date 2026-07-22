# Phase 5 controlled autonomy verification report

Status: complete for draft review on `feat/controlled-autonomy`, stacked on Phase 4 head `b099958ea455b4b0386b0a819687cec4264b7b1f`.

## Delivered scope

Phase 5 adds an `Autonomy review` screen to the existing Operations Control Center. Its primary hierarchy is self-driven routine operations, not a management work queue. The system-owned shadow projection detects routine exceptions, assigns them through the bot route, chases SLA, collects protected proof, independently verifies, closes, reopens and escalates without central-management intervention. It is a fixture-only state projection and sends no bot or external message.

The human-facing section is exception-only. It suppresses single events, pending or poor data, and records without an independent verifier. A person can appear only after repeated independently verified non-performance against the same governed goal and SLA. When a prior counselling or performance-review record exists, the person remains suppressed until a later verified recurrence exists.

The governed people path is:

1. `Coach / Counsel` — evidence-led human support after repeated verified non-performance.
2. `Performance review` — a named human review only after verified recurrence following counselling.
3. `Exit review` — a named HR/management review only after verified recurrence following a prior performance review, with protected legal/process checks.

No stage automatically disciplines, terminates, messages or makes an employment decision. An Exit review approval records only that the human review may begin; `employmentDecisionExecuted` and `externalMessageSent` remain `false`.

As a secondary calibration view, Phase 5 evaluates the operating orchestrator in shadow mode by joining each completed recommendation to the actual human decision and final independently reviewed disposition. This historical comparison is explicitly labelled `not a work queue`. The implementation does not add an execution adapter.

The append-only evaluation snapshot records four required labels:

- `Rejected action` when a human rejects a recommendation;
- `Human override` when a human selects a materially different action or owner;
- `Missed alert` when an independently labelled expected signal has no recommendation;
- `Failed verification` when the actioned decision does not survive independent verification.

Every expected signal, recommendation, decision and disposition carries a unique identifier, event time and protected evidence or source reference. Unknown links, missing source lineage, duplicate snapshot links and unprotected evidence references fail validation.

## Exception-only people acceptance

The synthetic people projection contains one EAE record with three independently verified recurrences, two prior bot reminders and one prior counselling record. Because verified non-performance recurred after counselling, the surface recommends a named human `Performance review`. It shows the governed goal and SLA, impact, evidence history, recurrence count, reminders, counselling and recommended next step.

A single verified JCO event and two poor-data records are withheld and shown only as aggregate protection counts; their names do not appear in the human exception surface. The system continues routine source-quality and evidence chase without creating work for Sachin or central operators.

## Shadow comparison and metrics

The synthetic fixture deliberately includes one correct low-risk recommendation, one rejected false positive, one human override, one missed financial alert and one failed high-risk verification. It produces the following governed evaluation values:

| Measure | Value | Basis |
|---|---:|---|
| Detection precision | 75.0% | matched recommendations / all recommendations |
| False-positive rate | 25.0% | unmatched recommendations / all recommendations |
| Missed-event rate | 25.0% | independently labelled signals without a recommendation / expected signals |
| Accepted | 50.0% | accepted / reviewed recommendations |
| Rejected | 25.0% | rejected / reviewed recommendations |
| Overridden | 25.0% | overridden / reviewed recommendations |
| Reversal rate | 33.3% | reversed / actioned recommendations |
| Failed verification | 33.3% | failed / independently reviewed actioned recommendations |
| Audit completeness | 100.0% | complete recommendation, decision and disposition chain / reviewed recommendations |
| Median decision time | 11 minutes | recommendation to human decision |
| Median verification time | 28 minutes | human decision to independent disposition |

The UI shows source, as-of time and verification basis for the primary measures. `Hours saved` and `Cost per verified outcome` display `No data` because neither has a governed definition or source coverage. Task and message counts are explicitly not presented as primary success measures.

## Governed autonomy gate

All thresholds live in the versioned policy registry:

| Policy | Active value | Effect |
|---|---|---|
| `POL-AUTONOMY-MODE@v1` | `Shadow only` | controlled execution is off |
| `POL-AUTONOMY-PRECISION-GATE@v1` | `Not agreed` | accuracy gate cannot pass |
| `POL-AUTONOMY-REVERSAL-GATE@v1` | `Not agreed` | reversal gate cannot pass |
| `POL-AUTONOMY-AUDIT-GATE@v1` | `Not agreed` | audit-completeness gate cannot pass |
| `POL-AUTONOMY-KILL-SWITCH@v1` | `Engaged` | automatic execution is blocked |
| `POL-AUTONOMY-HIGH-RISK@v1` | `Human approval permanently required` | no threshold can bypass a human |
| `POL-AUTONOMY-PEOPLE-ESCALATION@v1` | `Verified recurrence only: Coach / Counsel → Performance review → Exit review` | prior intervention plus later verified recurrence determines the next review |
| `POL-AUTONOMY-EMPLOYMENT-DECISION@v1` | `Named HR/management approval plus legal/process checks` | no automatic discipline, termination or employment decision |

The evaluator permits a low-risk policy result only when all three registry values are numeric and met, the registry mode is `Controlled low risk`, and the kill switch is `Disengaged`. The active policies meet none of those enablement conditions. The Phase 5 Preview also exposes `executionAdapterAvailable: false`, so a policy result cannot perform a write.

Only non-empty changes classified entirely as `operational` are low risk. Pricing, money, deposits, capex and commercial changes remain permanently human-approved by Pushkar. External communication, configuration and irreversible writes remain permanently human-approved by Sachin. An empty or mixed change set is high risk and cannot default to automatic execution.

## Safety flags

- `RAFIQI_CONTROLLED_AUTONOMY_EVALUATION` defaults on only in local development and Preview and defaults off in Production.
- `writesEnabled`, `liveReadsEnabled`, `externalMessagesEnabled` and `executionAdapterAvailable` are all `false` in the Phase 5 projection.
- `RAFIQI_OPERATING_DATA_LIVE_READS=false` and `RAFIQI_WHATSAPP_OPERATING_WRITES=false` remain required throughout review.
- No WhatsApp or external message was sent. No money moved. No pricing, payout, contract, migration, Studio release, deployment or Production write occurred.
- No person was disciplined, terminated or automatically placed into an employment process. The people projection is read-only and human-approved.
- All fixture records are synthetic and excluded from company totals.
- Existing Phase 0–4 controls, approval paths, registries, audit rules and reporting projections remain unchanged.

## Verification

- Focused Phase 5 suite: 33 passed, 0 failed, covering the autonomy engine, self-driven routine loop, exception-only people evaluator, preview, UI, feature flag and Operations navigation.
- Complete operating-loop and component suite: 65 passed, 0 failed.
- Repository test suite: 92 passed, 0 failed.
- TypeScript: passed with no diagnostics.
- Production build: passed with Next.js 16.2.6 and Turbopack.
- Responsive QA: passed at exact 1440×900, 1024×900 and 390×844 browser viewports. Document width equalled viewport width at every size. The 1040px routine lifecycle and 1120px routine table scrolled inside their labelled regions at tablet and mobile widths.
- Interaction QA: synthetic local sign-in, Operations selection, Autonomy review navigation, feedback filtering and mobile navigation passed.
- Browser console: 0 warnings and 0 errors after a clean reload and route replay.
- Diff hygiene: passed with no whitespace errors.
- Lint: not runnable because the inherited repository script calls an uninstalled `eslint` binary (`eslint: command not found`). Phase 5 does not change `package.json` or the lockfile and does not introduce that tooling gap.

Reference screenshots:

- `screenshots/autonomy-review-1440.png`
- `screenshots/autonomy-review-1024.png`
- `screenshots/autonomy-review-390.png`

## Rollback

No data or schema rollback is needed. Keep `RAFIQI_CONTROLLED_AUTONOMY_EVALUATION=false` in Production. If the stacked change must be removed, revert only the additive Phase 5 implementation and handoff commits; that removes the Autonomy review tab, system-owned routine projection, exception-only people evaluator, historical calibration builder, readiness evaluator, registry additions, tests, documentation and styles while leaving Phase 0–4 unchanged.

The Phase 5 draft must remain stacked on PR #24 until PRs #20–#24 merge in order. After dependency merges, retarget and rerun tests, typecheck, production build and responsive QA before merge approval.
