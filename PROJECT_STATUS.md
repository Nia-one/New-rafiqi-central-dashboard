# New Rafiqi Central Dashboard - Project Status

Last reviewed: 27 July 2026

## Project Information

Project folder:

C:\Projects\New-rafiqi-central-dashboard

Repository:

Nia-one/New-rafiqi-central-dashboard

Branch:

main

Latest known implementation commit:

d15797f - Implement live dashboard integrations across overview, essentials, people, work and operating loops

## Core Requirements

- Preserve the existing UI exactly.
- Do not redesign any screen or component.
- Connect every existing component to live Google Sheets data.
- If data fields are missing, extend the existing spreadsheet with tabs or columns.
- Do not introduce dummy or mock data.
- Complete integrations page by page and component by component.

## Verified Completed Work

### Google Sheets Foundation

- Google Sheets service-account integration is implemented.
- Google Sheets reading is handled through lib/googleSheets.ts.
- Dashboard data loading is implemented in lib/dashboardService.ts.
- Dashboard data transformation is implemented in lib/opsDataMapper.ts.
- API endpoint app/api/ops-data/route.ts is available.
- Google Sheet test endpoint app/api/test-sheet/route.ts is available.

### Google Sheet Tabs Currently Loaded

- Source_Registry
- Policy_Registry
- Theatre_Master
- Studio_Master
- People_Roster
- Enterprise_Demand
- Member_Activation
- Hourly_Heartbeat
- Incident_Log
- Action_Log
- Evidence_Log
- Approval_Log
- Living_Hourly
- Work_Hourly
- Essentials_Hourly
- Finance_Daily
- Dashboard_Overview

### Live Data Mapping

Known live mappings include:

- Studio summary
- Living demand
- Living supply
- Living occupied nests
- Work demand
- Work supply
- Essentials eligible members
- Essentials purchasing members
- Contracted demand
- Live capacity
- Active members
- Attach percentage
- ARPU
- CM
- FONO occupancy rows

### Filters

Live filters are available for:

- Theatre
- Location
- Studio
- Person

DashboardContext stores:

- selectedTheatre
- selectedLocation
- selectedStudio
- selectedPerson

### Integrated Screens

Work has been completed across:

- Overview
- Living
- Work
- Essentials
- People
- Operating loops
- Self-drive member savings workspace

These areas still require a final component-by-component verification before production sign-off.

### Member Savings Workspace

Previously validated values included:

- Service passing: 1/1
- Member savings: ₹2,400
- Nia margin: ₹3,500
- Attach: 43%
- Attach floor: 40%
- Repeat: 61%
- Repeat baseline: 58%

Verified hardening completed:

- Local task state now synchronizes with incoming live task projections so surviving tasks retain their shadow state and newly introduced tasks default to Unresolved.
- The ask-band due-date rendering now uses an honest empty-state-safe value when live data contains no governed task due date.
- Focused regression tests for the new behaviors pass.

Verified tests:

- npx tsx --test components/member-savings-workspace.test.ts (20/20 passed)
- npm run build (succeeded)

### Known Dashboard Metrics

- CM
- SP_SUPPLY_CONTRACTED
- FONO_LIVE
- SP_DEMAND_CONTRACTED
- MEMBERS_ACTIVATED
- ESS_PAID_ORDERS
- ESS_GMV
- PJP_ACTIONS
- INVENTORY_VALUE
- STOCKOUT_SKUS

## Partially Completed or Pending

### FONO Funnel

The following fields are not fully mapped:

- Studios visited
- Agreed
- Contracted
- KYC
- Live

### Funnel Details

Missing fields include:

- Stage conversion percentage
- Owner by stage

These may require new Google Sheet columns or a new tab inside the existing spreadsheet.

### Finance

Finance sections require a full live-data audit.

Controlled-autonomy and finance-expansion previews may still contain synthetic or static values.

### Legacy Static Data

Some components may still reference:

ops-data.json

Do not delete this file until every dependent component has been migrated and tested.

### Final Audit Required

Inspect every page and component for:

- Hardcoded values
- Static tables
- Static charts
- Dummy arrays
- Mock data
- Random values
- Fallback values
- Direct imports from ops-data.json

### Final UAT Pending

- Page-by-page UAT
- Filter validation
- Empty-state validation
- API failure validation
- Google Sheet range validation
- Responsive UI regression check
- Production environment validation
- Vercel deployment verification

## Next Action

Copilot must first inspect the current workspace and verify this status against the actual code.

Do not modify application code during the initial audit.

The audit must report:

1. Work already completed.
2. Components using live Google Sheets data.
3. Components still using static or mock data.
4. All remaining ops-data.json references.
5. Missing Google Sheet tabs or columns.
6. Current build or TypeScript issues.
7. The safest next component to complete.

---

# Component Tracker

| Workspace | Page | Component | Status | Live Source | Existing Data Reused | Missing Sheet Fields | Tests | Build | Notes |
|-----------|------|-----------|--------|-------------|----------------------|----------------------|-------|-------|-------|
| Self Drive | Member Savings | MemberSavingsWorkspace | COMPLETE | Live Essentials_Hourly + Action_Log + Evidence_Log + Approval_Log + People_Roster | Reused live freshness/loop-health plumbing and the existing live summary wiring | None | components/member-savings-workspace.test.ts | npm run build | Member Savings action cards now derive from governed Action_Log rows in live mode; focused component tests passed (20/20) and the production build succeeded |
| Self Drive | Member Engagement | MemberEngagementWorkspace | COMPLETE | Live Action_Log + Evidence_Log + Member_NPS_Feedback + Member_NPS_Responses + People_Roster + Policy_Registry + Learning_History | Reused live mapper and existing approval/loop-health plumbing | None | lib/live-mappers/self-drive.test.ts | npm run build | Live command now requires a governed Action_Log row before it reports a recovery command; focused mapper tests passed (22/22) |
| Self Drive | New Adds | NewAddsWorkspace | COMPLETE | Live Living_Hourly + Action_Log + Evidence_Log + Studio_Master + People_Roster | Reused existing fill-status/proof/live-task plumbing | None | lib/live-mappers/self-drive.test.ts | npm run build | Direct FONO-scope Action_Log rows now contribute to the live fill-task queue; focused mapper tests passed (24/24) |
| Self Drive | Nia Growth | NiaGrowthWorkspace | COMPLETE | Live Living_Hourly + People_Roster + approvals | Reused live mapper and dashboard approval plumbing | None | lib/live-mappers/self-drive.test.ts | npm run build | Live summary, measures and owner now derive from the live Living feed; focused mapper tests passed (21/21) |
| Self Drive | Nia Margins | NiaMarginsWorkspace | PENDING | - | - | - | - | - | - |
| Self Drive | Enterprise Demand | EnterpriseDemandWorkspace | PENDING | - | - | - | - | - | - |
| Self Drive | Cash & Control | CashControlWorkspace | PENDING | - | - | - | - | - | - |
| Self Drive | Finance Control | FinanceExpansionWorkspace | PENDING | - | - | - | - | - | - |
| Self Drive | Your Sign-Off | ControlledAutonomyWorkspace | PENDING | - | - | - | - | - | - |
| Dashboard | Overview | Overview Components | PENDING | - | - | - | - | - | - |
| Dashboard | Living | Living Components | PENDING | - | - | - | - | - | - |
| Dashboard | Work | Work Components | PENDING | - | - | - | - | - | - |
| Dashboard | Essentials | Essentials Components | PENDING | - | - | - | - | - | - |
| Dashboard | People | People Components | PENDING | - | - | - | - | - | - |
| Dashboard | Member Feedback | MemberFeedbackScreen | PENDING | - | - | - | - | - | - |
| Dashboard | Despatch | DespatchScreen | PENDING | - | - | - | - | - | - |
| Dashboard | Definitions | LearningHistoryWorkspace | PENDING | - | - | - | - | - | - |

