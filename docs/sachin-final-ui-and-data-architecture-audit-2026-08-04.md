# Sachin Final UI and Data Architecture Audit

Date: 4 August 2026

## Executive decision

Treat the ZIP as the final presentation reference, but do not replace the current repository with it. The ZIP is a presentation-first fork that removes the live Google Sheets ingestion and several production APIs. The safe implementation is to port its visual changes selectively onto the current live-enabled codebase.

The ZIP introduces no new live data source, spreadsheet, schema, or integration. Its changed UI continues to rely heavily on synthetic preview builders and hard-coded `operating-data` records.

## UI difference and backend impact

- 18 common application files differ.
- 4 files exist only in the ZIP, primarily separated CSS and a transaction route.
- The largest visible changes are the Finance workspace, horizontal section navigation, Decision Room progress visuals, compact Despatch layout, and split component CSS.
- Direct replacement would remove `buildOpsData`, `syncAllSources`, live allocation loading, live Self Drive mappers, live Despatch mapping, durable Google Sheet action writes, `/api/dashboard-live`, `/api/ops-data`, source-sync cron routes, and Google Sheets dependencies.
- The ZIP also changes Living back to fixed numbers and fixture arrays, restores illustrative heartbeat alerts, disables Production action writes, and narrows allocation domains.

Backend reuse remains high. Authentication, Google Sheet connectors, normalized backend tabs, source sync, owner resolution, and current live mappers should remain unchanged. Only presentation components and view-model adapters should be modified.

## Actual dashboard architecture

```text
External/User Sheets
  -> source synchronizers
  -> normalized backend workbook
  -> buildOpsData shared snapshot
  -> domain-specific live mappers
  -> source pages and components
  -> derived master/reference pages
```

Pages do not—and should not—copy data into one another. A source page and a master page update together because both consume the same normalized backend snapshot. Overview, Decision Room and Despatch are derived aggregations, not separate manual data sources.

### Source layer

- Business Report workbook: Studios, Fono Funnel, Flow, CM Actions and related imported tabs.
- User Input workbook: occupancy readiness, finance/collections, Member activation, roster, feedback, learning and SP supply.
- SP Demand bot workbook.
- Essentials ordering bot workbook.

### Synchronization layer

- `syncTeamInputs`: user-input tabs to normalized backend tabs.
- `syncEssentialsBotData`: Essentials bot to Essentials hourly/inventory records.
- `syncShramParkDemandBotData`: SP bot demand to Enterprise Demand.
- `syncMemberFeedback`: Member feedback/NPS ingestion.
- `syncVerticalInputs`: Studios/occupancy, FONO report, Flow and CM Actions ingestion.
- `syncAllSources`: sequential, rate-limited orchestration with a five-minute cooldown.

### Normalized backend layer

Core master/fact tabs include Source Registry, Policy Registry, Theatre Master, Studio Master, People Roster, Enterprise Demand, Member Activation, Hourly Heartbeat, Incident Log, Action Log, Evidence Log, Approval Log, Living Hourly, Work Hourly, Essentials Hourly, Finance Daily and Learning History.

### Presentation layer

`buildOpsData` reads the normalized workbook once. Live mappers create page-specific view models. Derived pages aggregate those view models rather than requiring duplicate user input.

## Available business data mapping

| Available data | Canonical backend | Primary pages | Derived consumers |
| --- | --- | --- | --- |
| Existing active-studio occupancy | Living Hourly (`EXISTING`) | Living, Member Adds | Nia Margins, Nia Growth, Overview, Despatch |
| FONO demand/supply funnel | Enterprise Demand and FONO-specific projections | Living/FONO | Member Adds, Overview, Decision Room |
| SP demand | Enterprise Demand | Enterprise Demand, Living/SP demand | Nia Growth, Despatch, Overview |
| SP supply | Living Hourly + Studio Master (`SP`) | Living/SP supply | Occupancy reconciliation, Growth |
| Enterprise | Enterprise Demand | Enterprise Demand | Growth, Overview, Despatch |
| Essentials orders/inventory | Essentials Hourly and Essentials Inventory | Essentials | Member Savings, Margins, Overview |
| Collections/finance | Finance Daily | Nia Margins, Economics | Cash & Control, Overview, Decision Room |

## Additional verticals assumed by the UI

These are beyond the six supplied operating verticals:

- Work/employment delivery (`Work_Hourly`). A Flow import exists, but the Work page still declares the feed unconnected.
- Member activation and acquisition (`Member_Activation`).
- Member engagement, retention and NPS (`Member_NPS_*`, Incident/Action/Evidence logs).
- People performance and heartbeat monitoring (`People_Roster`, `Hourly_Heartbeat`).
- Cash and financial control (`Finance_Daily`, Cash Control Channels, approvals).
- Governance and execution (`Incident_Log`, `Action_Log`, `Evidence_Log`, `Approval_Log`, Policy Registry).
- Learning and controlled autonomy (`Learning_History`, policy/evidence/approval records).
- Nia Growth, Nia Margins, Member Savings, Despatch, Decision Room and Overview are mainly derived analytical/control verticals, not independent raw-data verticals.

## Current page connection status

| Page | Status | Finding |
| --- | --- | --- |
| Despatch | Live | Now uses Action Log, Incident Log and People Roster; synthetic visible alerts removed. Hourly Heartbeat is empty, so no fake alert is rendered. |
| Living | Mostly live | Strongest live page. Uses shared backend data but still contains governed fallback arrays when live loading fails. |
| Nia Margins | Mostly live | Live occupancy/finance inputs are mapped; action logic is derived. |
| Member Adds | Partial | Live headline, theatre progress, proof and tasks are merged onto a fixture preview shell. |
| Member Engagement | Partial | Live measures/health are merged onto fixture tasks/background. |
| Member Savings | Partial | Some live tasks/health; other services, savings and repeat data remain fixture-driven. |
| Nia Growth | Partial | Live summary/measures only; workflow/actions remain fixture-driven. |
| Enterprise Demand | Not live | Page preview is currently constructed without live backend input. |
| Essentials | Not live | Uses hard-coded `operating-data` headline, cohorts, inventory, savings and working-capital numbers. |
| People | Not live | Uses hard-coded teams/people and illustrative commitments. |
| Member NPS | Not live | Uses static member-feedback datasets rather than the normalized backend snapshot. |
| Economics | Not live | Uses hard-coded `TABLE_SCREENS` metrics and Studio rows. |
| Work | Explicit no-data | Correctly shows a missing-feed state; it does not fabricate live metrics. |
| Cash & Control | Synthetic | Explicit stale synthetic fixture with actions blocked. |
| Finance Control | Synthetic | Preview-fixture implementation. |
| Overview | Mixed | Uses illustrative commitments and mixed live/fixture loop health. |
| Decision Room | Mixed | Aggregates the same mixed domain preview models. |
| Your Sign-Off | Mixed/synthetic | Controlled-autonomy preview is derived from mixed fixture and live inputs. |
| Learning History | Mixed | Uses the controlled-autonomy learning queue, not the backend Learning History tab as its sole authority. |

## Correct source/master interlinking

The required dependency pattern is:

1. A source sheet row is entered or received from a bot.
2. The synchronizer creates or updates one normalized backend record using a stable ID.
3. The relevant source page reads that normalized record.
4. Overview, Decision Room, Despatch, Economics, Growth, Margins and Learning derive their values from the same record and update automatically.
5. No second manual entry is required for a derived page.

Examples:

- Studios -> Existing Living Hourly -> Living occupancy -> Member Adds/Margins/Growth/Overview.
- SP bot + SP supply -> Enterprise Demand + Living Hourly -> Enterprise Demand/Living -> Growth/Despatch.
- Essentials bot -> Essentials Hourly/Inventory -> Essentials -> Savings/Margins/Overview.
- Collections -> Finance Daily -> Margins/Economics -> Cash Control/Decision Room.
- Action + Incident + People -> Despatch -> Overview/Decision Room status roll-ups.

## Final implementation rule

Use Sachin's ZIP for layout, interaction hierarchy and CSS only. Preserve the current repository's server routes, authentication, Google Sheets packages, source synchronizers, normalized schemas, live mappers, durable writes and no-data behavior. Every final UI component must declare its backend tab, fields, calculation and fallback policy. Production must never fall back to a synthetic operational value; missing data must remain visibly missing.
