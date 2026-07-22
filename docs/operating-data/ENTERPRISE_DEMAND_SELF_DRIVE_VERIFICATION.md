# Enterprise Demand Self-Drive — verification report

Date: 17 July 2026 (IST)

## Scope

This isolated stacked change replaces the existing operational `Demand activation` surface with the Enterprise Demand Self-Drive loop. It does not add a passive RafiQi Inside report or a second navigation path.

- Branch: `feat/enterprise-demand-report`
- Stacked base: PR #28 branch `feat/self-drive-simplification` at `d3740517c2823537d8c15b8b89db531467a059b4`
- Implementation: `bedceff`

The nine implementation files are `app/globals.css`, `app/page.tsx`, `components/enterprise-demand-workspace.tsx`, `components/enterprise-demand-workspace.test.ts`, `components/nia-dashboard.tsx`, `lib/dashboard-model.ts`, `lib/dashboard-model.test.ts`, `lib/operating-loop/enterprise-demand-loop.ts` and `lib/operating-loop/enterprise-demand-loop.test.ts`.

## Acceptance evidence

- A signed contract/arrival batch creates an Enterprise Demand node; arrival, commitment, shortfall, spec and terms changes reopen or reprioritise it.
- The data-derived first task is `Close 40 verified-ready Nests around Vikram Solar before the 26 July arrival.`
- The first viewport reads target 180 → independently verified ready 140 → gap 40 → owner → 25% progress → verified result.
- Daily priority combines days to arrival, uncovered Nests, deviations and missed follow-ups. Missed work rolls into the remaining hourly run rate.
- Ring 1 (0–2 km) is ordered first. Ring 2 (2–5 km) is visibly gated while Ring 1 can cover the gap. Beyond 5 km remains blocked unless protected shared-catchment evidence and human approval exist.
- FONO and SP use different candidate/playbook validation and remain visibly separated before the combined ready total.
- Missing or invalid contract identifiers and supply models are quarantined rather than inferred or blended.
- Every call/stop completion requires a valid disposition and complete closure fields. `No answer` creates a future retry. Stale or failed evidence reopens the step.
- Reported or self-declared readiness does not count. Evidence must be protected, independently verified and attributed to a different verifier.
- The pizza tracker covers Triggered → Plan built → Calls underway → Evidence received → Independently verified → Capacity covered → Members arrived → Billing live.
- Normal closure is blocked until verified-ready capacity covers the batch, spec/terms match, arrival is evidenced and billing-live evidence exists. A protected named human exception is the only alternate closure.
- Pricing and terms deviations route to Pushkar and never auto-resolve.
- The exception strip contains four rows, below the five-row maximum.

## Shadow-only safety

The preview uses typed synthetic fixtures and protected references. The immutable capability contract disables Production writes, external messages, live calls, live route assignment, GPS tracking, contract changes, payments and capital commitments. Visit steps require approved hours, check-in, consent, no trespass, hazard clearance, emergency escalation and no unsafe solo visit.

The tested local path was synthetic sign-in → Operations Control Center → Enterprise Demand → record `No answer` → observe `Retry scheduled` with a future due time → open the audit disclosure → observe the append-only synthetic entry. The interaction is non-persistent and cannot create an external effect.

## Automated verification

| Check | Result |
|---|---|
| Focused Enterprise Demand/navigation suite | 32 passed, 0 failed |
| Complete repository suite | 193 passed, 0 failed |
| TypeScript (`pnpm exec tsc --noEmit --incremental false --pretty false`) | Passed with no diagnostics |
| Production build (`pnpm build --webpack`) | Passed; Next.js 16.2.6, 7/7 static pages generated |
| Diff hygiene (`git diff --check`) | Passed |

Webpack is used because the isolated worktree reuses the existing dependency store through a symlink and Turbopack rejects that worktree topology.

## Browser QA

Browser/IAB was used against the local synthetic preview with credentials that were not committed.

| Viewport | Evidence |
|---|---|
| 1440×900 | Document width 1440; one H1; one Enterprise Demand destination; zero Demand activation destinations; Ring 2 controls disabled; first-viewport ring and progress cards visible |
| 1024×900 | Document width 1024; one H1; task and ring plan visible; four gated Ring 2 controls disabled |
| 390×844 | Document width 390; one H1; task and ring plan visible; mobile navigation active |

The final browser render had no horizontal overflow, no framework error overlay and no visible runtime error. The final console check recorded 0 warnings and 0 errors. The final 1440×900 render was captured at `/tmp/enterprise-demand-1440.png` for local review and intentionally not committed.

## Visual fidelity ledger

- Retained the global Light Operations header, navigation, filter row, white canvas, cool-grey surfaces, Inter/Helvetica typography, borders and restrained shadows.
- Used a single page H1 supplied by the global Operations shell; the content starts with the data-derived daily task rather than a duplicate hero.
- Kept the first viewport focused on target, independently verified ready, gap, run rate, ring plan and current journey.
- Used protected relative geometry for the two-ring visual and an eight-stage pizza tracker; neither implies live GPS or route assignment.
- Used shape, text and count differences in addition to colour for FONO/SP, readiness gaps and lifecycle state.
- Preserved the restrained blue-grey/indigo palette with no gradient, black hero or RAG decoration.
- Desktop uses the paired ring/progress layout; tablet and mobile stack cleanly without document-level overflow.
- The accepted `closed-loop-1440.png` and `sram-park-scout-route-1440.jpg` references were inspected before implementation; the final native-size render was inspected after the latest code change.

## Remaining assumptions

- All fixture identities, dates, capacities, candidate coordinates/references and evidence IDs are synthetic.
- The displayed run rate uses six remaining operating hours and two rolled-forward missed follow-ups. These values are visible and versioned in the preview registry rather than hidden policy.
- The existing feature-flag function retains its legacy name to preserve the current connection contract.
- The local disposition/audit interaction resets on reload.
- Live contract, readiness, arrival and billing sources are future governed inputs; this change does not connect, alter or simulate them as live.

## Merge and rollback

Keep the pull request draft and stacked on `feat/self-drive-simplification`. PRs #20–#28 remain dependencies and must not be changed or merged from this branch. After the dependency chain lands sequentially, retarget and rerun focused/full tests, typecheck, production build and responsive QA.

Rollback has no schema, data or external-system step. Revert the additive Enterprise Demand commits to restore exact PR #28 state. Do not deploy or enable any live capability from this branch.
