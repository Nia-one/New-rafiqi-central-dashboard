# New UI single-input rules

This document is the operational rule for preventing duplicate data entry.

1. Every business fact has one canonical input source. Dashboard pages never own input.
2. FONO data is entered/imported only in `Fono Funnel`; it flows to `Enterprise_Demand` and every consuming page.
3. Shram Park demand is entered only in the Demand Bot. `TEAM_SHRAMPARK_DEMAND` and `Enterprise_Demand` are automated mirrors.
4. Essentials orders, items, delivery and inventory are entered only in the Essentials Bot. User Input must not repeat them.
5. Studio occupancy/economics comes from the imported `Studios` report. `TEAM_OCCUPANCY` is its governed mirror; only explicitly preserved readiness fields may be entered there.
6. Member feedback/NPS is entered once in `TEAM_MEMBER_FEEDBACK`; three backend NPS tabs are generated automatically.
7. Finance facts are entered once in `TEAM_FINANCE_DAILY`; Cash & Control, Nia Margins and Overview must reuse them.
8. Owner assignments are entered once in `TEAM_OWNER_REGISTRY`; the sync cascades them to owner-bearing backend tabs.
9. Governance actions, evidence and approvals are separate lifecycle records, not duplicate business facts.
10. If a source value is absent, the UI must say `No data` or `Not recorded`; it must not substitute a fixture number.

The detailed mapping and current gap status are in `NEW_UI_DATA_LINEAGE_AUDIT.csv`.
