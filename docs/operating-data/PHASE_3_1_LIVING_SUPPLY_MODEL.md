# Phase 3.1 — Living supply-model split

Phase 3.1 is a stacked, shadow-mode extension of Phase 3. Its product surface is the existing **Rafiqi Insights → Living** report. It does not add a Finance-only dashboard and does not begin Phase 4 or Phase 5.

## Reporting contract

Each Living refresh materialises these projections in order:

1. FONO.
2. SP.
3. Combined, only after both components are visible.

Each channel exposes contracted, activation-ready, occupied and paying Nests; occupancy; billed ARPU; collection leakage; CM1; and CM2. The FONO detail separates franchisee-sourced and Nia-filled Members and calculates Nia fill rate against vacant Nests at the operating-cycle start. The SP detail exposes build-out, hardware and amenity readiness, Sukh and UFD activation, enterprise contract coverage, blocking milestones and Nia capex exposure against covered and ready capacity per park.

ARPU is billed Living revenue divided by occupied Nests. Collection leakage is reported separately. Float is defunct and is excluded. The projection consumes governed CM1 and CM2 definitions; absent definitions or incomplete source coverage render `No data` instead of a fabricated value.

## Governed data and lineage

`Studio_Master.supply_model` is required and accepts only `FONO` or `SP`. Studio Master is authoritative. The ingestion boundary quarantines a missing, invalid or batch-conflicting value and never derives it from a Studio name or operating model.

The governed value and Studio Master row identity propagate through capacity rows, verified activation projections, occupancy and activation gap events, operating actions, action history and verification records. Combined Living totals retain the source lineage of both channels.

## Routing and closure

An operating cycle is the earlier of an incident trigger or hourly heartbeat. Thresholds are loaded from effective-dated policy records:

- SP: provisionally escalate after one unresolved cycle.
- FONO: provisionally escalate after two consecutive cycles.
- Locked ordering: SP escalation remains faster than FONO because Nia capital is exposed.
- Calibration: replace the provisional values only through the governed registry after the first real SP.

FONO checks the franchisee pipeline and base commitment first, then Nia demand channels, then franchise review after two below-breakeven cycles despite Nia support. SP checks enterprise contract coverage first, then separates uncontracted demand from readiness or capacity and names the blocking milestone before the faster executive escalation.

A missing supply model or channel-mismatched playbook cannot create a valid action or close as Verified. Closure remains append-only and requires a named owner, deadline, protected evidence and an independent verifier.

## Safety boundary

All displayed records are synthetic fixtures. Google Sheets remains read-only, WhatsApp remains disabled and no external message, payment, contract, Studio release, migration, deployment or Production write is performed. The report is a read-only projection inside the existing Rafiqi Central shell and design system.
