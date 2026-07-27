# New Rafiqi Central Dashboard - Copilot Agent Instructions

## Project Identity

Project: New-rafiqi-central-dashboard  
Framework: Next.js and TypeScript  
Primary backend: Existing Google Sheets operating-data spreadsheet  
Baseline implementation commit: d15797f

## Primary Objective

Make every mode, page, accordion, component, metric, chart, table, queue,
status, target, owner, operational summary and implication live, automated
and data-driven wherever operational data is required.

The complete dashboard must be prepared for production readiness without
changing the founder-approved UI.

## Non-Negotiable UI Rules

- Preserve the existing UI exactly.
- Do not redesign, restructure, rename, remove or restyle existing components.
- Do not change layout, spacing, colours, typography, charts, navigation,
  responsive behaviour or component hierarchy unless required to fix a
  confirmed functional defect.
- Do not remove existing sections.
- Make backend and data-integration changes behind the existing UI.
- Do not delete working functionality.

## Live Data Rules

- Every operational value must come from live Google Sheets data or another
  existing governed live backend source.
- Do not use mock, dummy, random, placeholder, fixture-only, obsolete JSON or
  hardcoded business values in production rendering.
- Do not allow silent fallback data to make an incomplete component appear live.
- Static labels and explanatory UI copy may remain static.
- Statuses, implications, recommendations, conclusions and summaries that
  describe current operations must be calculated from live governed data.
- Receiving a `liveData` prop alone does not prove that a component is live.
  Trace every displayed operational value to its actual source.

## Reuse Before Creating

Before adding any tab, column, API, model, mapper or calculation:

1. Search the entire repository.
2. Search existing Google Sheet tabs and columns.
3. Search current API responses.
4. Search dashboardService, mappers and live snapshots.
5. Search whether another page or component already uses the required data.
6. Reuse existing data, calculations, mappings and utilities whenever possible.

Do not duplicate:

- Google Sheet tabs
- columns
- metrics
- APIs
- mapper logic
- types
- calculations
- business rules

## Google Sheet Schema Rules

- Use the existing Google spreadsheet.
- Prefer adding columns to the correct existing tab.
- Add a new tab only when the information belongs to a genuinely separate
  operational domain.
- When required fields are missing, add the necessary tabs or columns without
  repeatedly asking for approval.
- Implement Sheet schema changes using safe, repeatable and idempotent setup,
  migration or seed scripts.
- Seed realistic verification data when required.
- Do not require manual Sheet editing when it can be scripted.
- Never expose service-account credentials or environment variables in
  frontend code or committed files.

## Required Data Architecture

Maintain this flow:

Google Sheets
-> lib/googleSheets.ts
-> lib/dashboardService.ts or relevant backend service
-> mapper / transformation layer
-> API route
-> live snapshot and filters
-> React component

Important existing files include:

- lib/googleSheets.ts
- lib/dashboardService.ts
- lib/opsDataMapper.ts
- lib/live-mappers/
- lib/operating-loop/
- app/api/ops-data/route.ts
- app/api/dashboard-live/route.ts
- components/nia-dashboard.tsx
- DashboardContext
- relevant setup, seed and verification scripts

Reuse the existing architecture before introducing anything new.

## Full Dashboard Scope

Audit and complete every workspace and mode, including:

### Self Drive

- Overview
- Cash & Control
- Enterprise Demand
- New Adds
- Member Engagement
- Member Savings
- Nia Growth
- Finance control
- Your Sign-Off
- Nia Margins
- Learning history and related sections

### Other Dashboard Modes and Pages

- Overview
- Living
- Work
- Essentials
- People
- Member NPS / Member Feedback
- Despatch
- Definitions / Learning History
- all nested accordions
- all charts
- all tables
- all queues
- all summaries
- all implication sections
- all responsive views

## Filter Requirements

The following filters must propagate consistently to every relevant component:

- Theatre
- Location
- Studio
- Person

Verify that:

- available filter options come from live data,
- dependent filters reset correctly,
- filtered metrics and rows update correctly,
- no component continues showing unfiltered business data,
- empty filtered states are handled honestly.

## Component-by-Component Method

For each component:

1. Inspect the component and its parent page.
2. List every displayed operational field.
3. Classify each field as:
   - Live from Google Sheets
   - Calculated from live data
   - Static UI text
   - Hardcoded business value
   - Mock/fallback/fixture value
   - Missing
4. Trace the complete data path.
5. Check whether the data already exists elsewhere.
6. Add only genuinely missing Sheet fields.
7. Implement or reuse the mapper.
8. Wire the live data into the existing UI.
9. Verify passing, failing, empty and filtered states.
10. Add or update focused tests.
11. Run focused tests.
12. Run relevant integration tests.
13. Run the production build.
14. Confirm that no UI or layout changes occurred.
15. Update PROJECT_STATUS.md.
16. Continue to the next incomplete component automatically.

Do not stop after merely auditing a component unless a genuine external blocker
exists.

## Current Checkpoint

The last reported completed Self Drive component is Member Savings.

Reported sources:

- Essentials_Hourly
- Studio_Master

Reported values:

- 1/1 service passing
- Member savings: ₹2,400
- Nia margin: ₹3,500
- Attach: 43% against 40% floor
- Repeat: 61% against 58% baseline

Verify all sections before final sign-off:

- Savings and profit check
- Usage and repeat trends
- Recovery rule
- Service implication
- Accordion headline and summary
- passing state
- failing state
- empty state
- filter behaviour
- fallback behaviour

Do not mark it complete solely from the screenshot or prior report.

## Completion Standard

A component may be marked COMPLETE only when:

- every operational value is traced to live governed data,
- dynamic summaries respond to live data,
- relevant filters work,
- no silent mock or fallback business values remain,
- focused tests pass,
- relevant integration tests pass,
- production build succeeds,
- no UI/layout regression is introduced.

Allowed statuses:

- COMPLETE
- PARTIALLY LIVE
- STATIC
- BLOCKED

## PROJECT_STATUS.md Requirements

Maintain one row per component with:

- Workspace / mode
- Page
- Component
- Status
- Live data source
- Existing data reused
- Missing tabs or columns
- Files changed
- Tests
- Build result
- Remaining action
- Verification notes

Do not mark a component COMPLETE without evidence.

## Validation Commands

Use the relevant commands for each implementation, including:

```powershell
npm run build
git diff --check
git diff --stat
git status
```

Run focused tests using the repository's established test command or the
specific test file command.

## Git Safety

- Do not edit next-env.d.ts manually.
- Do not use git reset --hard.
- Do not discard unrelated user work.
- Do not force-push.
- Do not commit or push unless explicitly instructed.
- Report all changed and newly created files before requesting a commit.
- Keep changes scoped to the component currently being implemented.

## Reporting After Each Component

Report:

- component completed
- source Sheet tabs
- fields mapped
- existing data reused
- tabs or columns added
- setup/seed scripts executed
- exact files changed
- focused test result
- integration test result
- production build result
- remaining limitation
- next component selected

Continue until every dashboard component is live and production-ready or a
genuine external blocker is reached.
