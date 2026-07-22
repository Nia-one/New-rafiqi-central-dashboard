# Nia Self-Drive simplification — verification report

Date: 17 July 2026 (IST)

## Scope

This presentation-only stacked change renames `Autonomy review` to `Self-Drive` and simplifies the primary screen without changing the controlled-autonomy preview builder, governed contracts, source connections, policy evaluators or execution safeguards.

- Branch: `feat/self-drive-simplification`
- Stacked base: PR #27 branch `feat/sram-park-scout-route-plan` at `0e0e61114f1b35fd8689db9fb7449cd766ec3f05`
- Implementation: `d50022a838fc0113452c7b679af9dd4dd9d1443c`

The six implementation files are `app/globals.css`, `components/controlled-autonomy-workspace.tsx`, `components/controlled-autonomy-workspace.test.ts`, `components/nia-dashboard.tsx`, `lib/dashboard-model.ts` and `lib/dashboard-model.test.ts`.

## Acceptance evidence

- The Operations navigation has one `Self-Drive` destination and no `Autonomy review` duplicate.
- The global Operations header is the sole title hierarchy: `Nia Self-Drive` and `RafiQi runs the routine. Leaders decide the consequential.`
- There is exactly one H1. Self-Drive content begins directly with exactly three semantic columns: `SELF-DRIVE`, `WAITING ON YOU` and `HUMAN AUTHORITY`.
- Routine cards contain action, owner, progress and expected completion only.
- Approval cards contain the decision, reason, impact, deadline and Approve/Decline controls.
- Money, contracts, employment, legal/compliance and external communication each name the retained human authority.
- The former phase banner, source/execution metadata, lifecycle, people escalation, comparison tables, policy gates, feedback ledger, safeguards and scorecard remain intact inside a closed native `System audit details` disclosure.
- Primary copy contains no registry, lineage, architecture or policy terminology.

## Shadow-only interaction

The verified path was synthetic sign-in → Operations Control Center → Self-Drive → Approve the finance hold → observe `Shadow decision only · Approved locally` → open `System audit details` → observe the new append-only synthetic entry.

The component has no fetch, server action, socket, beacon or execution adapter. The immutable preview still reports `writesEnabled=false`, `externalMessagesEnabled=false` and `executionAdapterAvailable=false`. The local acknowledgement disappears on reload and cannot send a message, mutate Production, move money, approve a contract or create an employment action.

## Automated verification

| Check | Result |
|---|---|
| Focused Self-Drive and navigation suite | 18 passed, 0 failed |
| Complete repository suite | 173 passed, 0 failed |
| TypeScript (`pnpm exec tsc --noEmit --incremental false --pretty false`) | Passed with no diagnostics |
| Production build (`pnpm build --webpack`) | Passed; Next.js 16.2.6, 7/7 static pages generated |
| Diff hygiene (`git diff --check`) | Passed |

Webpack is used because the isolated worktree reuses the existing dependency store through a symlink and Turbopack rejects that worktree topology.

## Browser QA

Browser/IAB was used against `http://127.0.0.1:3018/` with synthetic local-only credentials that were not committed.

| Viewport | Layout and overflow evidence |
|---|---|
| 1440×900 | Three 449.33 px columns on one row; document width 1440; one H1; audit closed |
| 1024×900 | Two 485 px columns, then the 984 px Human Authority column; document width 1024; one H1 |
| 390×844 | Three semantic columns stacked as 362 px single-column sections; document width 390; one H1; mobile navigation visible |

The mobile menu contained one `Self-Drive` button and zero `Autonomy review` buttons. Page identity, non-blank content, absence of a framework overlay, approval interaction, disclosure interaction and local audit entry all passed. Final console check: 0 warnings and 0 errors.

## Visual fidelity ledger

- Retained the global Light Operations header, navigation, filters, white canvas, cool-grey surfaces, Inter/Helvetica typography, borders and restrained shadows.
- Replaced the former black introductory phase block with direct column content, as required.
- Applied one restrained Apple indigo accent to progress and local shadow controls; no gradients or RAG colours were introduced.
- Kept every card independently bordered and scannable, with plain field labels and no dense prose in the primary view.
- Preserved desktop three-column, tablet two-column and mobile one-column behavior without document-level overflow.
- Exact page title, subtitle, column labels and column subtitles match the authorised copy.
- The existing `autonomy-review-1440.png` artifact was inspected as the Light Operations reference; the final 1440×900 browser render was inspected at native size. No material visual mismatch remains.

## Remaining presentation assumptions

- `ACT-EAE`, `ACT-THEATRE` and `ACT-JCO` are displayed as `Essentials EAE`, `Theatre lead` and `Demand JCO`; underlying identifiers are unchanged in audit details.
- Expected-completion strings are plain presentation labels derived from current lifecycle state, not new governed deadlines.
- The two Waiting on You cards are projections of the existing synthetic finance comparison and people exception; they do not add workflow records or approvals to the source contract.

## Merge and rollback

Keep the pull request draft and stacked on PR #27. PRs #20–#27 remain dependencies and must not be changed or merged from this branch. After the dependency chain lands sequentially, retarget and rerun focused/full tests, typecheck, production build and responsive QA.

Rollback has no schema, data or external-system step. Revert the additive Self-Drive commits to restore the exact PR #27 state. Do not deploy or enable any live capability from this branch.
