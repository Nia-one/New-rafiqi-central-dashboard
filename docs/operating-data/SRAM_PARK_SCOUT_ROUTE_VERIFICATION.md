# Śram Park Scout Route Plan — verification report

Date: 17 July 2026 (IST)

## Review scope

This stacked change replaces the former `Scouter’s Journey Plan` in place. Operations has one `Śram Park Scout Route Plan` entry and no parallel legacy route tab. The projection is SP-only, read-only, shadow-mode and backed exclusively by labelled synthetic fixtures.

Stacked base: PR #25 branch `feat/controlled-autonomy` at `315711bf205dc45744043585ee4c3f260b6875bb`.

Implementation commits:

- `7b67890f4c4ef2e4b8966c3ed066ce7222c9fbdf` — audited SOP, data dictionary, form specifications, decision registry and acceptance criteria.
- `3d301ce708ac24faf00794a3f86b648b9577b76e` — SP-only engine, quarantine and verification controls, replacement UI, tests and responsive artifacts.

## Acceptance evidence

- Negotiation activates the same-day shadow trigger; pre-Negotiation records remain blocked.
- Safety incidents, emergency response, active Studio War Rooms, financial guardrails and legal/compliance blocks outrank scouting.
- The authoritative factory-gate centroid drives `[0,2] km` Ring 1, `(2,5] km` Ring 2 and eight half-open 45-degree wedges.
- Ring 2 remains blocked until all eight Ring 1 wedges have independently verified evidence.
- Missing or FONO supply context is quarantined. No FONO acquisition or franchisee playbook is available.
- Candidates beyond 5 km reject by default. A protected shared-catchment record can only produce a human-review recommendation; it cannot approve or execute an action.
- Fit score is reproducible against an effective registry version and returns no score for missing, invalid or blocked inputs.
- Raw coordinates, photographs, owner details, personal headcounts and shift data are absent from the projection and fail privacy validation if supplied directly.
- Approved/daylight hours, start/midpoint/end check-ins, consent, no-trespass, hazard controls and unsafe-solo-visit blocks are enforced before a safe field session can be represented.
- There are no adapters for GPS tracking, owner contact, photographs, WhatsApp, leases, payments, capital commitments, Production writes or live route assignment.

## Automated verification

| Check | Result |
|---|---|
| Focused route and replacement-screen tests | 16 passed, 0 failed |
| Focused design-system regression test | 12 passed, 0 failed |
| Complete repository test suite | 170 passed, 0 failed |
| TypeScript (`pnpm exec tsc --noEmit`) | Passed with no diagnostics |
| Production build (`pnpm build --webpack`) | Passed; Next.js 16.2.6, 7/7 static pages generated |
| Diff hygiene (`git diff --check`) | Passed |

Webpack was selected explicitly because the isolated worktree reuses the dependency store through a symlink and Next.js Turbopack rejects that worktree topology. The production artifact compiled and generated successfully.

## Responsive and interaction QA

QA used a synthetic local-only login and the normal Operations navigation path. No credential or fixture was committed.

| Viewport | Result |
|---|---|
| 1440×900 desktop | Passed; all four required first-viewport answers end at 814.84 px, inside the 900 px viewport; no horizontal overflow |
| 1024×900 tablet | Passed; first-viewport cards form two 487 px columns; no horizontal overflow |
| 390×844 mobile | Passed; cards form one column, mobile navigation is present and there is no document-level horizontal overflow |

The synthetic map renders four protected candidate markers and no raw-location input. The registry view exposes the effective version and provisional status. Browser console replay produced 0 warnings and 0 errors.

Artifacts:

- `screenshots/sram-park-scout-route-1440.jpg`
- `screenshots/sram-park-scout-route-1024.jpg`
- `screenshots/sram-park-scout-route-390.jpg`

## Visual-fidelity ledger

- Preserved the existing Rafiqi Central black, blue and neutral semantic token system.
- Reused the Operations shell, typography, borders, spacing and compact evidence-table conventions.
- Implemented the four concept questions as the first viewport rather than adding introductory prose.
- Converted the 2/5/15 km legacy model into one visible gate-centred Ring 1/Ring 2/wedge geometry.
- Kept the protected-priority ladder, evidence gate and disabled-action boundary visually prominent.
- Mapped desktop four-up cards to tablet two-up and mobile one-up layouts without a duplicate navigation destination.
- Deliberate copy difference: the shell heading is action-oriented while the sole navigation label carries the complete product name.
- No decorative imagery or third-party map asset was added; all locations remain synthetic abstractions.

## Provisional assumptions requiring governance

Thirteen values in `SP-SCOUT-REGISTRY@v1` are visible provisional shadow assumptions: wedge duration, target rent, target capacity, billed ARPU, Ring 2 shuttle ceiling, stalled-negotiation interval, Negotiation contract certainty, four shift factors, approved daylight window and required check-ins. They must be calibrated and approved before any live field use. The locked trigger, ring geometry, wedge count and shared-catchment gate rule are separate governed decisions.

## Safety, merge and rollback

Keep this pull request draft and stacked on PR #25 until PRs #20–#25 merge sequentially. Then retarget and rerun focused/full tests, typecheck, production build and responsive QA before merge approval.

Rollback has no data, schema, credential or external-system step. Revert only the additive scout-route commits above to restore the PR #25 state. Do not deploy, enable live integrations, write to Production or create a live route from this branch.
