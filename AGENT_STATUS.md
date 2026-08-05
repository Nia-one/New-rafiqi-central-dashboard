# Agent status

## Live Google Sheets migration — current progress

Updated: 24 July 2026 (IST)

| Area | Status | Notes |
| --- | --- | --- |
| Google Sheet access | Complete | Existing service account is reading the connected workbook. |
| Sheet setup | Complete | `Dashboard_Content` and `DATA_ENTRY_GUIDE` have been created. |
| Test data | Complete | Clearly labelled test records were added only to previously empty operational tabs. |
| Operations guidance | Complete | Yellow columns mark Operations-editable fields; `DATA_ENTRY_GUIDE` specifies format and update rhythm. |
| Overview/header live data | Complete | Freshness, reporting period, key overview data and editable page content read from the Sheet. |
| Self Drive detailed workspaces | In progress | The app still directly invokes synthetic preview builders for Enterprise Demand, Member Adds, Engagement, Savings, Margins, Growth, Cash Control and Sign-Off. |
| Self Learn detailed screens | In progress | Overview and Living are sheet-backed. Work, Essentials, People, NPS, Economics and Learning History still contain static/fixture rendering. |
| Input protections | Pending | Apply after final mappings so only Operations input columns are editable. |
| Final verification | Pending | Production build plus live-sheet smoke test after all components are mapped. |

Latest audit: Self Learn → Living was remapped on 24 July 2026. Its funnels, report, tables, proximity view, summaries and copy now calculate from `Living_Hourly`, `Studio_Master`, `Enterprise_Demand` and `People_Roster`; unavailable metrics show `No data`. The production build passed. This does not mean the remaining pages are component-live.

The project currently has live Sheet connectivity and seeded test data, but it is **not yet fully component-live**. Do not treat fixture-backed cards/charts as final until the two “In progress” rows are complete.

Updated: 17 July 2026 (IST)

Branch: `feat/enterprise-demand-report`

Stacked base: PR #28 branch `feat/self-drive-simplification` at `d3740517c2823537d8c15b8b89db531467a059b4`

Dependency chain: PRs #20–#28 remain unchanged. This draft must stay stacked on PR #28 until the chain is merged and retested sequentially.

## Scope state

The authorised Enterprise Demand Self-Drive loop is complete for draft review. No later loop or shared trust-layer task has started or remains queued on this branch.

- The existing Operations `Demand activation` destination is replaced by one `Enterprise Demand` destination; no passive RafiQi Inside report or duplicate path was added.
- Signed enterprise arrivals create or reopen synthetic demand nodes and drive a risk-ranked daily queue.
- The plan exhausts Ring 1 (0–2 km) before enabling Ring 2 (2–5 km); beyond 5 km remains blocked without evidenced human approval.
- FONO and SP capacity and playbooks remain separate before combined coverage.
- Every completed call/stop requires a disposition, evidence reference, next action, owner, due time, affected capacity, state and timestamp.
- Capacity counts as ready only after independent verification. Closure requires covered capacity, matching spec/terms, evidenced arrival and evidenced billing, or a protected human exception.
- Pricing and terms deviations route to Pushkar. All live/external capabilities remain disabled.

## Commits

- Base: `d3740517c2823537d8c15b8b89db531467a059b4`.
- Implementation/tests: `bedceff` (`feat: add enterprise demand self-drive loop`).
- The additive verification/status commit follows the implementation commit.

## Checks

- Focused Enterprise Demand/navigation suite: 32 passed, 0 failed.
- Complete repository suite: 193 passed, 0 failed.
- TypeScript: passed with no diagnostics.
- Production build: passed with Next.js 16.2.6 and Webpack; 7/7 static pages generated.
- Browser QA: passed at 1440×900, 1024×900 and 390×844 with one H1 and no horizontal overflow.
- Interaction: `No answer` schedules a future retry and appends a synthetic local audit entry.
- Navigation: one `Enterprise Demand` destination, zero `Demand activation` destinations.
- Latest runtime smoke: no framework error overlay or visible runtime error; the final console check recorded 0 warnings and 0 errors.
- React review: no fetch, effect, server action, socket, beacon or geolocation capability was added; static registries are hoisted and local audit state uses functional updates.
- Diff hygiene: passed; generated `next-env.d.ts` was restored and excluded.

## Review artifact

- `docs/operating-data/ENTERPRISE_DEMAND_SELF_DRIVE_VERIFICATION.md`

## Blockers and assumptions

- No implementation blocker remains.
- All enterprise, plant, date, capacity, candidate and evidence records are clearly labelled synthetic fixtures.
- The displayed `1/hr` run rate assumes six remaining operating hours and carries two missed follow-ups forward; the assumption is visible and versioned in the preview registry.
- The legacy `closedLoopDemandActivationEnabled` feature-flag name is retained to avoid changing the existing integration contract; its rendered surface is now Enterprise Demand.
- Local dispositions and audit entries are preview-only and disappear on reload.
- A future live read model will need governed contract, readiness, arrival and billing sources; none were connected or changed here.

## Merge, safety and rollback notes

- Keep the new PR draft and based on `feat/self-drive-simplification` so its diff contains Enterprise Demand only.
- Do not modify, retarget or merge PRs #20–#28 from this branch. Retarget and fully retest only after dependencies merge sequentially.
- Do not deploy, write to Production, enable live integrations, send external messages, place calls, assign live routes, track GPS, move money, change contracts or commit capital.
- Rollback requires no schema, data or external-system action: revert only the additive Enterprise Demand commits to restore the exact PR #28 state.

## 2026-08-05 — Sachin final UI adoption

- Adopted the presentation layer from `RafiQi-Inside-main (3).zip` as the approved UI baseline: 38 files across `app` and `components`.
- Preserved API routes, operating-loop builders, database code, and connector/data-sync logic unchanged.
- Checks: 556/556 tests passed; Next.js production build passed; browser QA passed on desktop and 390×844 mobile with one H1, one focused outline card, working Decide/Operate and drawer navigation, and no page-level horizontal overflow or console warnings/errors.
- Standalone `tsc --noEmit` remains blocked by seven pre-existing backend/data-sync typing diagnostics outside this UI scope; the production build compiles successfully because the repository build intentionally skips type validation.
- Rollback is file-only: restore `artifacts/pre-sachin-final-ui-20260805-080003.zip`; no schema, data, connector, or external-system rollback is required.
- Production deployment `dpl_2dqfmyU4GtX6FDDEwZb2t1tUaWBB` completed successfully and is served by `rafiqi-central-dashboard.vercel.app`; its generated deployment URL and public login surface passed browser validation with no console warnings/errors or horizontal overflow.
- `www.rafiqicentral.com` remains managed outside the linked `nia-command-center` Vercel scope. An explicit alias assignment was rejected because this Vercel account does not have access to that domain; no DNS or external-domain configuration was changed.
