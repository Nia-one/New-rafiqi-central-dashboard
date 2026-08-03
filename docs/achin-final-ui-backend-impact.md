# Achin final UI: backend impact and implementation contract

## Decision

The ZIP is a presentation-first synthetic fork, while this repository contains the live Google Sheets ingestion, mappers, sync jobs, APIs, and operational input workflows. The final UI must therefore be ported onto this repository. Replacing this repository with the ZIP would remove working backend capabilities.

## Estimated impact

| Area | Reuse | Change required |
| --- | ---: | --- |
| Authentication and finance access | High | Keep current role and finance gates; wire the new rail and restricted Cash & Control screen to them. |
| Google Sheets ingestion and source registry | High | Keep current services. Add fields only where the final cards cannot be derived reliably. |
| Action, evidence, approval, heartbeat and owner flows | High | Map existing normalized records into the new Decision/Operate cards and loop-health strips. |
| Domain preview builders | Medium | Replace synthetic-only inputs with live mapper adapters incrementally; retain fixtures as demo fallback. |
| Frontend shell and navigation | Low | Port the dark rail, Decide/Operate lens, outline pane, focused canvas and context strip. |
| Domain screen composition | Medium | Port final layouts, then bind each section to the current live snapshot rather than ZIP fixtures. |

Overall estimate: roughly 65-75% of the current backend can be reused unchanged. About 15-20% is adapter/view-model work and 10-15% is sheet/schema/input hardening. This is not a backend rewrite.

## Sheet strategy

Do not create one sheet per screen. Keep normalized backend tabs and human-entry tabs separate.

Existing backend tabs remain authoritative: `Source_Registry`, `Policy_Registry`, `Studio_Master`, `People_Roster`, `Enterprise_Demand`, `Hourly_Heartbeat`, `Incident_Log`, `Action_Log`, `Evidence_Log`, `Approval_Log`, `Living_Hourly`, `Work_Hourly`, `Essentials_Hourly`, `Finance_Daily`, and `Member_Activation`.

Add or extend human-input tabs only for values that are not already produced by a connected system:

- Member retention/recovery: cohort, risk reason, recovery owner, due time, verified recovery status and proof reference.
- Member savings: service/SKU, member price, governed cost, savings, margin, repeat/attach state, owner and proof reference.
- Nia growth: channel, theatre, planned capacity, activation-ready capacity, stage, capital requirement, decision owner and approval reference.
- Work: Studio, theatre, enterprise/employer, active Members, work revenue, period start and period end (the final UI explicitly identifies these missing fields).
- Member NPS: anonymised member token, score, reason category, captured time, action link and privacy classification.

All new rows require stable IDs, source update time, ingestion time, verification status, verifier, and evidence/approval references where relevant. Missing data stays missing; it must never be converted to zero.

## Implementation order

1. Add the shared Decide/Operate lens and final operating UI primitives.
2. Port the rail, context strip and one-focused-section outline without changing live data contracts.
3. Bind Despatch and loop health first because their current backend coverage is strongest.
4. Bind Enterprise Demand and Member Adds.
5. Add the missing Member Engagement, Member Savings, Nia Growth, Work and NPS input contracts and adapters.
6. Finish Decision Room, Your Sign-Off and Self Learn reporting, then run desktop/mobile visual QA.

## First implementation slice

`components/lens.tsx` and `components/operating-ui.tsx` are now additive shared foundations copied from the approved final UI. They do not replace or bypass any live backend path. The next slice is to connect these primitives to the current `NiaDashboard` and port the final rail/outline while preserving `liveOpsData`, `liveSelfDriveData`, and `allocationData`.
