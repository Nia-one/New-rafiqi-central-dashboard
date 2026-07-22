# Rafiqi Central: Final Other-Mac Build and Merge Brief

Copy this entire document into GPT/Codex on the other Mac while it is opened inside the existing Rafiqi Central repository.

## Role and outcome

Act as the principal product engineer and operating-systems architect for **Rafiqi Central**, Nia's internal company operating system.

Build the closed operating loop that allows Nia to detect an operating issue or opportunity, gather governed context, create and assign an action, capture evidence, verify the result, escalate exceptions and publish only verified outcomes into reporting.

The first production-shaped loop is:

> **Enterprise demand -> nearby Studio and Nest capacity -> assigned action -> evidence -> independent verification -> Member activation -> verified reporting event**

This is an implementation assignment, not a strategy essay or visual concept. Preserve the working product, extend the existing architecture and deliver tested code in controlled phases.

## Release boundary

**Phases 0–2 are the product for this branch.** Complete them end to end before touching Phase 3 or later. Do not add the remaining domain agents, broad financial-control surfaces or production autonomy merely because they appear later in this document.

The branch is complete only when one enterprise-demand event can travel through governed ingestion, nearby Studio and Nest matching, a named action, required evidence, independent verification, Member activation and a verified read-only reporting event.

At the end of Phase 2, run recommendations and proposed actions in **shadow mode**. The system may detect, rank, propose, assign, collect evidence and verify. It must not execute pricing, money movement, contracts, external communication, production configuration or irreversible actions. Progression beyond Phase 2 requires explicit approval from Sachin.

## Read before changing code

1. Read `AGENTS.md` completely if it exists.
2. Read the latest session handoff and implementation plan.
3. Read `docs/nia-control-center-release-spec.md` if present.
4. Read `docs/DESIGN_SYSTEM.md` if present. If it does not exist, create it from the locked design contract in this brief before building new screens.
5. Inspect the current application, database contracts, action log, transaction state machine, access control, tests and deployment configuration.
6. Inspect the approved reference images already stored in the repository, including `.v0-theme-final.png`, `.v0-theme-overview.png`, `.v0-theme-mobile.png` and the latest approved demand-map reference where present.
7. Identify the repository that already contains both Rafiqi Insights and Operations Control Center. Use that repository. Do not create a replacement application or a new repository.
8. Report the current branch, dirty files, current data stores and existing tests before making changes.

Do not delete or rewrite working screens. Do not discard user changes. Do not enable production writes or deploy to production without explicit approval.

## GitHub delivery workflow

All work from the other Mac must be isolated in GitHub and integrated through review.

1. Fetch the latest remote state and inspect open Rafiqi Central pull requests.
2. Identify the latest branch that contains the approved workspace chooser, Rafiqi Insights, Operations Control Center, Operations Mandate and Scouter's Journey Plan.
3. Prefer branching from an up-to-date `main`. If approved UI work is still in an unmerged pull request, do not silently branch from an older `main`. Report the dependency and either wait for that pull request to merge or create the implementation branch from the approved feature branch with the dependency documented.
4. Create a dedicated branch such as `feat/closed-loop-demand-activation`.
5. Never commit directly to `main`.
6. Commit phase by phase with clear messages and push only the feature branch.
7. Open a draft pull request against `main`. State the base commit, dependencies, migrations, environment variables, tests run, known limitations and rollback path.
8. Use the branch's Vercel Preview for review. Do not point Preview at production data or enable production writes.
9. Keep the pull request draft until type checks, tests, build, access-control checks and the end-to-end acceptance criteria pass.
10. Merge only after Sachin approves the product and Pushkar approves any financial or operating-control changes within his authority.
11. After merge, verify the new Production deployment separately. A successful Preview is not Production approval.

Do not have two computers make overlapping edits on the same branch. Each independent body of work gets its own branch and pull request. If the base branch changes, rebase or merge safely without deleting unrelated user changes.

### Mergeability contract

- Keep this work in one vertical feature branch: `feat/closed-loop-demand-activation`.
- Do not mix unrelated redesigns, dependency upgrades, repository clean-up or naming refactors into this branch.
- Put new behaviour behind a feature flag that defaults to off outside the branch Preview.
- Keep Google Sheets, WhatsApp and database integrations behind adapters. Missing credentials must leave the application buildable and testable with local fixtures; they must never trigger live writes.
- Make database migrations additive and backward-compatible. Include a rollback note for every migration.
- Preserve existing routes and component APIs unless a documented compatibility layer is included.
- Use separate commits for Phase 0 contracts, Phase 1 ingestion and semantic layer, and Phase 2 loop, UI and tests.
- Before requesting review, update the branch from its documented base and resolve conflicts without deleting unrelated work.
- The pull request must include changed-file scope, architecture decisions, migrations, environment variables, tests, screenshots, Preview URL, known limitations and rollback steps.
- Stop after Phase 2 and leave the pull request in draft until its release gate passes.

## 1. Naming and terminology

The naming distinction is permanent:

- **Rafiqi Central**: Nia's internal company operating system. Capital R, lowercase q.
- **RafiQi**: the member-facing capital allocation agent. Capital R and capital Q.
- **Rafiqi Insights**: the internal reporting and intelligence workspace inside Rafiqi Central.
- **Operations Control Center**: the internal execution workspace inside Rafiqi Central.

Reserve **RafiQi** exclusively for the member agent. Remove inconsistent internal labels such as `RafiQi Central` and `RafiQi Ops Team` from visible product copy, metadata and accessible labels.

Nia terminology is non-negotiable:

| Use | Never use |
|---|---|
| Member or Nian | resident, tenant, occupant |
| Studio or Workforce Hub | PG, hostel, dormitory, co-living |
| Nest | bed |
| Membership fee | rent or room charge |
| Service request | complaint |
| Membership activation or end | check-in or check-out |
| Theatre | region, when referring to Nia's operating hierarchy |
| Living, Work, Essentials | Tribe, Flow, Studio pillar |

- JCO means **Joint Community Officer**.
- EAE means **Edge Activation Executive**.
- Curry is the meals layer within **Essentials**, not Living.
- RafiQi has four member-facing sub-agents: Work agent, Infra & Community agents, Save agent and Remit agent. These are separate from the internal Rafiqi Central operating agents defined below.

## 2. Product boundaries

Rafiqi Central has two isolated post-login workspaces.

### Rafiqi Insights

Read-only reporting and intelligence across:

- Overview
- Living
- Work
- Essentials
- Economics
- People
- Member Feedback
- Definitions
- Despatch

Reports must not create, update, settle, reconcile or close operational records. Only verified allowlisted events may create reporting projections.

#### Living supply-model reporting addendum

This is a **Rafiqi Insights Living report requirement**, not a Finance-only or separate dashboard. On every refresh, Living must update and display the two supply channels independently in this fixed order:

1. **FONO**.
2. **SP**.
3. A combined Living roll-up, only after both FONO and SP components are visible.

The FONO and SP rows must each show contracted, activation-ready, occupied and paying Nests; occupancy; billed ARPU; collection leakage; CM1; and CM2. FONO must also show franchisee-sourced Members, Nia-filled Members and Nia fill rate for vacant Nests. SP must show build-out, hardware and amenity readiness, Sukh and UFD activation, enterprise contract coverage, and capex exposure versus covered capacity for each park. A combined value must never hide a missing channel.

Living ARPU remains billed Living revenue divided by occupied Nests. Collection leakage remains separate. Float is defunct and must not appear. This Living projection consumes governed CM1 and CM2 definitions; it must not invent a formula or value and must render explicit `No data` and source-coverage status when required inputs are absent.

### Operations Control Center

Execution across:

- Operations Mandate
- Scouter's Journey Plan
- Daily and role-specific task lists
- Enterprise demand and proximity mapping
- Studio and Nest capacity
- Transaction and exception queues
- Evidence, verification and closure
- Approvals and escalations
- Master data and policy settings

When a person selects Operations Control Center, show only Operations modules. Do not show Insights reports in its navigation. Provide one explicit `Change workspace` control.

## 3. Operating doctrine

Humans set goals, priorities, policy and tradeoffs. Agents perform governed steps.

Every autonomous loop must implement:

1. Detect an event, gap, risk or opportunity.
2. Retrieve governed context and source lineage.
3. Calculate impact and confidence.
4. Propose the next action.
5. Apply the approval policy.
6. Assign one named owner and due time.
7. Execute only actions within the agent's permission scope.
8. Capture structured evidence.
9. Verify the result independently.
10. Close, reopen or escalate.
11. Publish verified events into Rafiqi Insights.
12. Record the entire chain in an append-only audit log.

An action is not complete because someone clicked `Done`. It closes only when its expected operating result is independently verified.

The executor and verifier cannot be the same actor for material actions.

## 4. Internal agent architecture

Implement one orchestrator above six narrow operating agents.

### 4.1 Chief Orchestrator

Responsibilities:

- Watch governed events and metric thresholds.
- Route work to the correct domain agent.
- Resolve cross-domain dependencies.
- Prevent duplicate or conflicting actions.
- Maintain the company-wide action ledger.
- Escalate blocked, overdue, low-confidence or high-risk actions.
- Produce an executive daily mandate from verified data.

The orchestrator does not receive unrestricted access. It coordinates agents with narrower scopes.

### 4.2 Living Operations Agent

Responsibilities:

- Studio and Nest capacity, readiness, occupancy and activation.
- Studio partner contracts, operating cost, deposit and capex visibility.
- CM1 and CM2 control.
- Service requests, utilities, safety and membership continuity.
- Expansion-option comparison and Studio release workflow.

### 4.3 Work and Enterprise Demand Agent

Responsibilities:

- Enterprise, plant and corridor demand.
- Required headcount, roles, skills, shift, start date and demand certainty.
- Demand-to-capacity matching using distance, availability and activation SLA.
- Work placement, joining, attendance, redeployment and exit signals.
- Employer fulfilment and collection exceptions.

### 4.4 Essentials Agent

Responsibilities:

- Catalogue, suppliers, purchase terms, MRP and Member savings.
- Inventory ownership, consignment, stock movement and availability.
- Orders, fulfilment, attach, repeat rate and stockout exceptions.
- Curry, Save and Remit operating records within Essentials.
- Enforce positive Member savings and sustainable positive Nia margin.

### 4.5 Finance and Unit Economics Agent

Responsibilities:

- Revenue, collections, partner cost, utilities, deposits, capex and opex.
- CM1, pillar CM2, full-use CM2, cash position and cash guardrail.
- CAC by channel, payback, ARPU and cohort economics.
- Settlement, reconciliation, ledger exceptions and financial approvals.
- Prevent stale or retired economic numbers from appearing in reports.

### 4.6 People and Execution Agent

Responsibilities:

- JCO, EAE, Theatre and functional ownership.
- Roster, assignments, due dates, evidence and verified closure.
- Separate activity, closure and resolved-outcome rates.
- Detect missing reporting, metric gaming and abnormal payout patterns.
- Calculate incentives only from approved outcome definitions.

### 4.7 Governance and IR Agent

Responsibilities:

- Metric definitions, source lineage, freshness and version history.
- Board, investor and monthly MIS drafts from verified data only.
- Policy changes, approval records and external-release controls.
- Never send or publish external material without CEO approval.

Member continuity is a company-wide outcome across the agents. Do not create a disconnected continuity database or a duplicate Member record.

## 5. Confirmed control values

Store every threshold in a versioned policy or metric registry with an effective date, approver and source. Do not scatter constants through UI components.

### Financial controls

| Control | Initial value | Rule |
|---|---:|---|
| Monthly opex cap | ₹60 lakh | Alert on forecast breach before the month closes |
| Minimum cash guardrail | ₹150 lakh | Immediate escalation on forecast or actual breach |
| Hiring | Frozen | No new hiring workflow may progress without explicit policy change |
| Financial approver while CFO role is vacant | Pushkar | Pricing and financial exceptions require Pushkar's approval |

₹150 lakh equals 2.5 months at the ₹60 lakh opex cap. Do not describe it as a three-month guardrail.

### Unit economics

| Metric | Initial value | Required interpretation |
|---|---:|---|
| Living ARPU | ₹5,000 per occupied Nest per month | Billed amount Nia must collect |
| Work ARPU | ₹1,000 per occupied Nest per month | Billed amount Nia must collect |
| Essentials ARPU | ₹1,000 per occupied Nest per month | Billed amount Nia must collect |
| Full-use ARPU | ₹7,000 per occupied Nest per month | Living + Work + Essentials when all three are used; not portfolio blended actual |
| Portfolio blended ARPU | No locked value | Calculate from live billed pillar revenue and occupied Nests |
| Structural CAC | ₹60 | Loaded target with channel breakdown |
| CAC warning | Above ₹100 per Theatre per month | Data-quality or operational exception |
| Payback | 15 days | Never claim three-day payback |
| Living CM2 | ₹300 per occupied Nest per month | Living component |
| Work CM2 | ₹1,000 per occupied Nest per month | Work component |
| Essentials CM2 | ₹200 per occupied Nest per month | Essentials component |
| Fully cross-used CM2 | ₹1,500 per occupied Nest per month | Living ₹300 + Work ₹1,000 + Essentials ₹200 |
| Retention | Approximately 69% at M6 | Always name the M6 cohort |
| Monthly churn | 6% | Operating reference |
| Retention warning | Below 65% at M6 | Early-warning threshold |
| Breakeven occupancy | 78% | Studio control threshold |
| Studio GM target | 20% | Healthy-Studio threshold |
| Nest EBITDA margin | 18% | At target occupancy |
| New Studio ramp | 30 days | Show separately before normal scoring |

Do not use the retired ₹7,600 blended ARPU. Do not calculate or display an investor-facing LTV/CAC multiple. Show cumulative contribution margin instead.

ARPU is a billed operating metric:

```text
Billed ARPU = total billed amount Nia must collect / occupied Nests

Collection leakage = billed amount due - amount collected
```

Store GST, discounts, refunds and credit notes as separate fields so the billed amount, accounting revenue and collection requirement can be reconciled. Report collection leakage separately by current due, overdue, disputed, credited and written-off amounts. Do not reduce billed ARPU merely because collection is late.

CM definitions:

```text
Living CM1 = billed Living revenue - effective Studio partner cost
CM2 = CM1 - utilities

Fully cross-used CM2 = Living CM2 + Work CM2 + Essentials CM2
```

For Living, CM2 subtracts the Studio partner cost through CM1 and then utilities. Do not silently add housekeeping, security, EAE payroll, central payroll or other operating costs to CM2. If management wants those costs below CM2, create and approve a separate CM3 or Studio operating contribution definition.

The initial control values imply Work CM2 of ₹1,000 on Work ARPU of ₹1,000, and Essentials CM2 of ₹200 on Essentials ARPU of ₹1,000. Keep direct Work and Essentials delivery-cost fields visible. Do not net new cost categories into these CM2 definitions without an approved metric-version change.

### Studio health

| Status | Rule | Required response |
|---|---|---|
| Green | Occupancy >=78% and GM >=20% | Hold and replicate |
| Amber | Occupancy 60% to <78% or GM 10% to <20% | Theatre review within 24 hours; action plan within 48 hours |
| Red | Occupancy <60%, GM <10% or negative CM | CEO and COO review the same day; decision within seven days |
| No data | Required operating or financial data missing | Maximum priority until corrected |

Member relocation must occur before any Studio is released.

## 6. Expansion rule

There are no geography-specific expansion bans and no fixed ₹1,200 per-Nest sourcing ceiling.

Build wherever Nia can activate capacity with:

1. Verified demand or clearly evidenced Member demand.
2. Low recurring operating cost.
3. Least deposit capital tied up.
4. Least Nia-funded capex.
5. Least contracting and activation friction.
6. Fastest path to occupied, paying Nests.
7. Strongest projected 90-day CM with explicit assumptions.

Do not hide these factors inside an unexplained composite score. Show each component and allow policy owners to introduce versioned weights later.

Calculate and display:

```text
Upfront capital tied up = refundable deposit + non-refundable deposit + Nia-funded capex + launch working capital

Capital tied up per activation-ready Nest = upfront capital tied up / activation-ready Nests

Recurring cost per contracted Nest = monthly Studio partner cost / contracted Nests

Recurring cost per expected occupied Nest = monthly Studio partner cost / expected occupied Nests

Activation friction = days to commercial agreement + days to compliance readiness + days to physical readiness + unresolved dependency days
```

Keep the components visible. Do not invent an amortisation period or silently convert refundable deposits into expenses.

Every expansion recommendation must show at least two comparable options when two options exist. It must show demand evidence, distance, readiness date, upfront capital, deposit, capex, recurring cost, activation friction and projected 90-day outcome.

## 7. Google Sheets as the current source system

Google Sheets is the current operating source. Build a governed ingestion layer rather than embedding Sheet reads directly inside UI components.

### Provided source contract — do not wait for legacy files

This brief is accompanied by two implementation inputs that are now the authoritative starting contract:

- `Rafiqi_Central_Operating_Data_Capture.xlsx`: a Google-Sheets-ready workbook with 20 governed tabs, 328 field definitions, validations, formulas, source and policy registries, finance controls and data-quality checks.
- `WHATSAPP_OPERATING_DATA_BOT_INSTRUCTIONS.md`: the executable conversation, cadence, permissions, escalation, evidence, privacy and write contract for the WhatsApp operating-data bot.

Copy both into the implementation branch under `docs/operating-data/` (keep the workbook binary unchanged) and reference them from the repository plan. Import the workbook into one controlled Google Sheet and use its tab and field names as the v1 intake schema. Do not invent a competing intake workbook and do not block implementation while waiting for historic source files.

The operating capture rule is locked:

> During an active shift, capture immediately when an incident occurs; otherwise capture one heartbeat every 60 minutes — whichever happens first. The incident submission satisfies the current hourly window, while follow-ups continue until independently verified closure.

Historic Google Sheets may later be mapped into this contract through `Source_Registry`. Preserve each historic tab name and map its columns; never force an operational team to rename a live legacy tab before ingestion can begin.

### Required ingestion pattern

```text
Google Sheets -> immutable raw import -> validation and quarantine -> canonical records -> operating events -> action ledger -> verified reporting projections
```

Requirements:

- Begin with read-only Google service-account access.
- Keep Sheet ID, tab name, range, owner and expected refresh cadence in a source registry.
- Record source row identity, import batch, source update time and ingestion time.
- Make imports idempotent.
- Preserve raw values for audit.
- Quarantine invalid rows instead of silently coercing them.
- Show missing columns, duplicate identities, impossible values and stale sources.
- Do not overwrite source Sheets in the first release.
- Do not mix demo or seeded data with imported operating data.
- Label synthetic records clearly and exclude them from company totals.

Do not require source tabs to be renamed. Create mappings from the existing Sheet columns to the canonical model.

### Source domains to map

Create mappings for:

- Theatre, Studio and Nest master
- Daily capacity, occupied Nests and membership activations
- Enterprise demand and Work requirements
- Studio sourcing and conversion pipeline
- Essentials catalogue, supplier terms, inventory and orders
- Revenue, collections, partner cost, utilities, deposits, capex, opex and cash
- JCO, EAE and operating-team roster
- Actions, evidence, approvals and closure
- Member feedback and service requests
- Metric and policy registry

Sync cadence must be configurable per source. Every screen must show `as of`, `source` and `freshness` status.

## 8. Canonical shared data model

Use stable identifiers and effective-dated records. Money uses exact numeric types. Timestamps are timezone-aware. Operational event history is append-only.

### Organisation and place

- `Theatre`: ID, name, code, active status, lead, geography.
- `Studio`: ID, Theatre, name, address, latitude, longitude, operating model, partner, contract status, readiness state.
- `Nest`: ID, Studio, capacity state, availability, activation readiness and current Member token.
- `Enterprise`: ID, legal and display names, industry, account owner and payment terms.
- `Plant`: ID, Enterprise, address, latitude, longitude, shifts and operating calendar.
- `Supplier` and `StudioPartner`: governed counterparties with contract and payment metadata.

### Member and Work

- `Member`: pseudonymous operating ID, consent state, Living status and restricted PII reference.
- `MemberProduct`: active Living, Work and Essentials relationships with effective dates.
- `SkillProfile`: role, skill, certification, experience and availability.
- `DemandRequirement`: Enterprise, plant, role, skill, headcount, gender or shift constraints where lawful, wage, start date, duration, certainty, owner and status.
- `WorkAssignment`: Member, requirement, offer, joining, attendance, exit and redeployment states.

Do not store KYC documents in Rafiqi Central. Store only completion status, verification metadata and a restricted external reference. Raw payroll stays inside a restricted boundary and never enters general analytics.

### Living and expansion

- `Studio.supply_model` is mandatory and governed as the exact enum `FONO | SP`. Studio Master is authoritative; missing, invalid or conflicting values are quarantined and are never inferred from Studio names or `operating_model`.
- Every capacity row, Living reporting projection, occupancy or activation gap event, action and verification record carries `supply_model` and visible Studio Master lineage.
- Contracted and activation-ready Nests.
- Occupied and paying Nests.
- Membership fee and verified collections.
- Studio partner cost, utilities, deposit and capex.
- Commercial, compliance and physical-readiness milestones.
- Capacity available date and activation SLA.
- Service requests, incidents and proof.
- Expansion alternatives and comparable capital/friction components.
- Living reporting materialises FONO first and SP second on every refresh. A combined roll-up is valid only when both component projections are visible.
- FONO reporting distinguishes franchisee-sourced Members from Nia-filled Members and exposes Nia fill rate for vacant Nests.
- SP reporting retains per-park build-out, hardware and amenity readiness, Sukh and UFD activation, enterprise contract coverage, and capex exposure versus covered capacity.
- Billed ARPU uses billed Living revenue divided by occupied Nests; collection leakage remains a separate governed metric. Float is defunct. CM1 and CM2 use governed definitions and explicitly return `No data` with source coverage when inputs are absent.

### Essentials

- Service or SKU ID, category, unit and active state.
- Supplier, procurement method and ownership model.
- Purchase price, MRP, Member price, Member savings and Nia margin.
- Stock on hand, consigned stock, reorder point, expiry and zero-sale stock.
- Order, fulfilment, cancellation, return, refund and settlement.
- Eligible Members, attach, repeat rate, fill rate and stockout duration.

### Finance

- Transaction, amount, currency, classification and counterparty.
- Revenue, collection, partner cost, utilities, deposit, capex and opex.
- Payment method, settlement reference and reconciliation state.
- Balanced ledger batch and entries.
- Cash position, approved forecast and guardrail exception.
- Approval request, approver, decision, reason and timestamp.

### People and execution

- Staff ID, role, Theatre, Studio or function, manager and roster state.
- Task owner, due time, priority, source event and expected metric.
- Evidence type, URI or record, submitter and timestamp.
- Verification result, verifier, measured outcome and reason.
- Closure rate, verified-result rate, overdue rate and reopened rate.

### Governance

- Metric definition, formula, dimensions, owner and source.
- Policy value, effective date, approver and version.
- Source lineage, freshness expectation and data-quality status.
- Append-only audit event with actor, before/after state and reason.

## 9. Action and transaction controls

Use one governed lifecycle for operating actions:

```text
Detected -> Proposed -> Approved or Auto-approved -> Assigned -> In progress -> Proof submitted -> Verified -> Closed
                                                                                                     -> Reopened
                                                                                                     -> Escalated
```

Each action requires:

- Source event and detection rule.
- Named operating objective.
- Pillar, Theatre, Studio or Enterprise context.
- Expected financial or Member outcome.
- Confidence and reason.
- Named owner and due time.
- Approval tier.
- Required evidence.
- Verification method and window.
- Complete state-transition history.

Invalid, stale or unauthorised transitions must fail. Use optimistic concurrency so an old command cannot overwrite a newer state.

Financial transactions retain the stricter settlement and reconciliation lifecycle already defined in the repository. Do not simplify it into the action lifecycle.

## 10. Permission and approval matrix

### Agents may do automatically

- Read governed data.
- Calculate metrics and detect exceptions.
- Rank options and prepare recommendations.
- Create and assign low-risk tasks.
- Send internal reminders through approved channels.
- Request missing evidence.
- Draft internal and external material.
- Verify rule-based outcomes when the verifier is independent.

### Pushkar approval required

- Pricing and financial exceptions.
- Studio commercial terms.
- Deposits and Nia-funded capex.
- Vendor or enterprise financial commitments.
- Payout exceptions.
- Studio exits or releases.
- Any action that may breach the ₹60 lakh opex cap or ₹150 lakh cash guardrail.

### CEO approval required

- Investor, board or external capital communication.
- Changes to company-level metric definitions or operating doctrine.
- Production activation of materially autonomous permissions.

### Always prohibited without an explicit production approval

- Moving money.
- Modifying payroll.
- Signing or accepting contracts.
- Sending investor communications.
- Ending a membership.
- Releasing a Studio.
- Writing back to live operating Sheets.
- Enabling production integrations or production database writes.

Implement least privilege, role-based access, secret isolation, rate limits, cost limits, audit logs and an emergency kill switch.

## 11. First autonomous loop

Build this end to end before adding further automation.

### Trigger

A new or changed enterprise demand requirement enters Google Sheets.

### Context assembly

Retrieve:

- Enterprise and plant coordinates.
- Required headcount, role, skill, shift and activation date.
- Available and activation-ready Nests.
- Studio coordinates, distance and travel direction.
- Readiness date and operational dependencies.
- Deposit, capex, partner cost and recurring cost per Nest.
- Current occupancy, GM and Studio health.
- Existing actions or competing demand reservations.
- Data freshness and completeness.

### Matching

Produce ranked Studio or new-supply options using:

1. Ability to meet required headcount.
2. Ability to meet activation date.
3. Distance and practical worker commute.
4. Lowest capital tied up per ready Nest.
5. Least deposit and capex.
6. Lowest recurring cost per expected occupied Nest.
7. Least activation friction.
8. Highest projected 90-day CM.

Show why each option ranked where it did. Never let an opaque model select a Studio without explainable inputs.

### Action creation

The selected or approved option creates structured tasks for the named Work, supply, Studio and activation owners. Each task receives a due time, evidence requirement and expected metric.

### Evidence

Evidence may include:

- Enterprise demand confirmation.
- Geo-verified Studio or plant reference.
- Studio readiness checklist.
- Partner commercial confirmation.
- Nest roster.
- Member activation record.
- Collection or contract reference where applicable.

### Verification

Verify:

- Required Nests were truly ready.
- Activated Members match the demand requirement.
- Activation occurred within the promised window.
- No Member is double-counted.
- Commercial and capital values match approved terms.
- Reporting receives only verified activations.

### Escalation

Escalate when:

- Data is missing, stale or contradictory.
- No option meets headcount or activation date.
- Two demands compete for the same Nests.
- Deposit or capex is not approved.
- Pricing or commercial terms require an exception.
- Evidence is late or fails verification.
- An action is overdue or repeatedly reopened.

### Living channel routing and verification addendum

This addendum extends the first loop into the Living report without authorising a live write. An operating cycle is an incident trigger or the hourly heartbeat, whichever occurs first. All thresholds live in the versioned policy registry; do not scatter or hard-code them in the orchestrator or UI.

- **FONO gap:** check the franchisee pipeline and base commitment first. If both are healthy, route vacant Nests to Nia demand channels. After two consecutive below-breakeven cycles despite Nia support, create a franchise review.
- **SP gap:** check enterprise contract coverage first, then distinguish uncontracted demand from unactivated readiness or capacity and name the blocking milestone. Because Nia capital is exposed, executive escalation must be faster than FONO.
- The locked relative rule is `SP escalation < FONO escalation`. Until the first real SP is available for calibration, use explicitly provisional shadow defaults of one unresolved cycle for SP and two consecutive cycles for FONO.
- The orchestrator must never apply a FONO playbook to SP or an SP playbook to FONO. An action missing `supply_model`, carrying a mismatched playbook or lacking Studio Master lineage fails validation and cannot close as Verified.
- Closure requires a named owner, due time, protected evidence, escalation state where applicable and an independent verifier. Append-only events preserve the event, action, policy-version, source-lineage and verification chain.
- The verified read-only projection refreshes the Living report in the fixed order **FONO, SP, combined**. It does not create a Finance-only dashboard or perform a Production write.

## 12. Locked design-system contract

The other Mac must not infer the design from a single screenshot or invent new colours. Create `docs/DESIGN_SYSTEM.md` in the repository and make this section its starting contract. Centralise the tokens in `app/globals.css` or the repository's existing global token file.

### Design character

- Apple HIG restraint with finance-grade data density.
- Light surfaces, sharp hierarchy and restrained colour.
- Black, Nia blue, grey and white only.
- No green, teal, sage, saffron, gold, clay, red-amber-green status system or decorative gradients.
- Borders first. Shadows only when elevation materially clarifies hierarchy.
- Sentence case for product copy. No oversized marketing language inside operating screens.

### Canonical colour tokens

```css
:root {
  --canvas: #F4F6F8;
  --surface: #FFFFFF;
  --surface-subtle: #F1F5F9;
  --surface-strong: #E8EDF3;

  --ink: #111318;
  --ink-soft: #4B5563;
  --muted: #7B8490;

  --border: #D8DEE6;
  --border-strong: #B8C2CF;

  --nia-blue: #2C5880;
  --nia-blue-deep: #1C3F5C;
  --nia-blue-soft: #6A8CAE;

  --interactive: var(--nia-blue);
  --interactive-hover: var(--nia-blue-deep);
  --focus-ring: rgba(44, 88, 128, 0.25);

  --chart-1: #1C3F5C;
  --chart-2: #2C5880;
  --chart-3: #6A8CAE;
  --chart-4: #A8B9C9;

  --shadow-subtle: 0 1px 2px rgba(17, 19, 24, 0.04), 0 8px 24px rgba(17, 19, 24, 0.04);
  --shadow-card: 0 14px 40px rgba(17, 19, 24, 0.07);
}
```

Do not add literal hex colours inside feature components when a semantic token exists. The demand map may use a dark map surface, but its controls, labels and highlights must remain black, blue, grey and white.

### Typography

```css
--font-ui: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-data: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
```

- Large title: 34px / 700.
- Page title: 28px / 700.
- Section title: 22px / 700.
- Card title: 17px / 600.
- Body: 15px / 400 with 1.5 line height.
- Dense table and control text: 12px to 13px, never below 11px for primary information.
- Eyebrow and metadata: 11px / 600 with restrained tracking.
- Numbers use tabular figures and right alignment.
- Do not introduce decorative serif type into the application shell. A serif may be used only in a deliberately approved exported financial memo, never as a default UI font.

### Spacing, radii and elevation

- Use an 8px spacing grid: 4px only for micro-gaps, then 8, 16, 24, 32 and 48px.
- Input radius: 8px.
- Button radius: 10px.
- Card radius: 12px.
- Large workspace tile radius: 16px. Do not use 28px marketing-style tiles in operating screens.
- Pill radius: 999px.
- Default border: 1px solid `var(--border)`.
- Default input and button height: at least 44px on member-facing or mobile surfaces and at least 36px on dense desktop operating controls.
- Use `--shadow-subtle` for normal elevation. Reserve `--shadow-card` for modals and the workspace chooser.

### Icons and charts

- Lucide outline icons only.
- Default icon size 20px with approximately 1.5px stroke.
- No emoji, filled clip-art or mixed icon libraries.
- Charts use the four blue tokens plus grey. Never use traffic-light colours.
- Status must be communicated through a written label, icon and border or pattern, not colour alone.

### Core reusable components

Before adding domain screens, create or consolidate reusable primitives for:

- Application shell and workspace navigation.
- Page header and freshness indicator.
- Filter bar.
- Metric tile.
- Decision or mandate card.
- Dense data table with sticky headers and numeric alignment.
- Status badge with text and icon.
- Source, timestamp and verification label.
- Empty, loading, stale-data and error states.
- Form field, select, date input and search input.
- Primary, secondary, bordered and destructive-confirmation buttons. Destructive actions still use black/grey styling with explicit language, not red.
- Drawer or modal.
- Evidence uploader and evidence viewer.
- Approval panel and immutable event timeline.

New screens must compose these primitives. Do not make one-off card, button, badge or table styles for each agent.

### Layout rules

- Desktop content max width follows the existing application shell. Do not arbitrarily narrow data screens.
- Use a 12-column grid for dashboards and a two-column master/detail layout for queues.
- Tables remain the primary surface for repeated operating records.
- Cards are for decisions, summaries and exceptions, not for every data point.
- Keep Operations navigation isolated from Rafiqi Insights navigation.
- On mobile, collapse navigation deliberately and make tables horizontally scrollable or convert them to labelled rows without losing values.

### Reference hierarchy

When design sources conflict, follow this order:

1. The locked design-system contract in this brief and `docs/DESIGN_SYSTEM.md`.
2. Approved screenshots named in the repository handoff.
3. Existing shared tokens and reusable components.
4. Existing individual screens.

Existing teal or greenish tokens are legacy and do not override the locked blue-grey palette.

### Visual verification

For every new or materially changed screen:

- Capture desktop at 1440px width.
- Capture compact desktop or tablet at 1024px width.
- Capture mobile at 390px width.
- Compare navigation, typography, spacing, colours, table density and states against the approved references.
- Include screenshots in the pull request description or attach them to the review record.
- Treat unexpected token additions and literal feature-level colours as review failures.

## 13. User experience

Preserve the existing calm, information-dense product shell.

Design requirements:

- Black, blue, grey and white only. Remove green from internal product surfaces.
- Inter as the primary font, with Helvetica and Arial fallbacks.
- Clear hierarchy, restrained borders and dense but readable tables.
- No decorative gradients, glass effects or oversized marketing cards.
- Numeric columns use tabular figures and align right.
- Every metric shows source, timestamp and verification state.
- Every mandate shows owner, due time, impact, confidence and required proof.
- Desktop and mobile workflows must remain usable.
- Preserve the demand-radius map and CSV download capability.

Do not redesign unrelated screens while building the operating loop.

## 14. Delivery phases

### Phase 0: Repository and data audit

- Inspect the current implementation and tests.
- Inventory all illustrative, seeded and hard-coded data.
- Find inconsistent Rafiqi/RafiQi naming.
- Identify current storage boundaries and disabled production paths.
- Produce a short gap report and implementation plan.
- Use the provided operating-data workbook and WhatsApp bot contract immediately; do not wait for Sachin to source legacy files.
- Ask once only for credentials that are genuinely required to connect a deployed integration, such as the Google service account, WhatsApp provider and database URL. Never print secrets. If credentials are not yet available, continue with local fixtures and disabled adapters while preserving the exact production interfaces.

### Phase 1: Semantic operating layer

- Build the source registry, metric registry and policy registry.
- Build read-only Google Sheets ingestion and validation.
- Build canonical Theatre, Studio, Nest, Enterprise, demand and staff masters.
- Separate synthetic data from imported operating data.
- Add freshness, lineage and data-quality surfaces.

### Phase 2: Demand-to-activation loop

- Ingest enterprise demand.
- Match demand to capacity and expansion options.
- Create governed actions.
- Capture evidence.
- Verify Member activation.
- Project verified outcomes into Insights.
- Add complete audit trails and approval gates.
- Run the complete loop in shadow mode and record proposed actions, human decisions, overrides and verification outcomes without enabling autonomous production execution.

### Phase 3: Finance and expansion control

- Add deposits, capex, recurring cost and 90-day CM comparison.
- Add the ₹60 lakh opex cap and ₹150 lakh cash guardrail.
- Add Pushkar approval workflows.
- Add Studio health and War Room exception routing.

### Phase 4: Remaining domain agents

- Essentials loop.
- People and execution loop.
- Member continuity and retention signals.
- Governance and IR verified reporting.

### Phase 5: Controlled autonomy

- Run in shadow mode first.
- Keep routine exceptions self-driven: detect, assign through the bot, chase, collect evidence, independently verify, close, reopen and escalate without a central-management work queue.
- Make the human-facing Operations surface exception-only. Surface a person only after repeated independently verified non-performance against the same governed goal and SLA survives data-quality and prior-intervention checks.
- Use the governed people path `Coach / Counsel → Performance review → Exit review`, retaining recurrence, impact, bot reminders, counselling and evidence history at every stage.
- Never automatically discipline, terminate, message externally or make an employment decision. Exit review requires named HR/management approval and legal/process checks.
- Compare recommendations with actual human decisions.
- Record rejected actions, overrides, missed alerts and failed verifications as labelled feedback.
- Permit automatic low-risk execution only after agreed accuracy, reversal and audit-completeness thresholds are met.
- Keep high-risk actions human-approved permanently.

Complete and test one phase before starting the next. Update the repository plan or checklist as each acceptance criterion passes. Commit in small, comprehensible units if repository instructions permit commits.

### Mandatory stop after Phase 2

Phase 3, Phase 4 and Phase 5 are roadmap context only. Do not implement them in this branch. When Phase 0–2 acceptance criteria pass, stop, update the draft pull request and request Sachin's review. A later branch may begin Phase 3 only after that approval.

## 15. Testing and acceptance criteria

The build is not complete until:

- The product consistently displays `Rafiqi Central` for the internal OS and `RafiQi` only for the member agent.
- `docs/DESIGN_SYSTEM.md` exists and matches the locked design contract.
- New screens use canonical tokens and shared primitives, with no feature-level green or teal colours.
- Desktop, compact-desktop and mobile reference screenshots are included for materially changed screens.
- Selecting Operations Control Center exposes only Operations navigation.
- Google Sheets imports are idempotent, traceable and validated.
- Invalid source rows are quarantined and visible.
- Demo data is clearly separated and excluded from live totals.
- Every metric shows source, `as of` time and verification state.
- Thresholds come from the versioned registry, not scattered constants.
- The first enterprise-demand event can produce ranked capacity options.
- Ranking visibly includes deposit, capex, recurring cost and friction.
- Approved actions receive one owner, due time and evidence requirement.
- An action cannot close without required evidence and independent verification.
- Invalid or stale state transitions fail.
- Pushkar approval is enforced for pricing and financial exceptions.
- Forecast breaches of ₹60 lakh opex or ₹150 lakh cash generate escalations.
- Reports cannot mutate operating records.
- Only verified allowlisted events enter Rafiqi Insights.
- Restricted payroll and Member PII remain outside general analytics.
- Audit logs are append-only.
- Unit, integration, access-control and state-transition tests pass.
- Type checking and the production build pass locally or in Preview.
- No production deployment or production write is enabled without explicit approval.

### Phase 0–2 merge gate

Before requesting merge, provide evidence that:

- The branch contains only the scoped Phase 0–2 work and its required tests or documentation.
- The application builds and the existing test suite still passes.
- The new unit, integration, access-control and state-transition tests pass.
- A branch Preview demonstrates the complete enterprise-demand-to-verified-activation journey.
- Imported, quarantined, synthetic and verified records are visibly distinguishable.
- Google Sheets imports are idempotent and preserve source lineage.
- The WhatsApp adapter follows the immediate-incident-or-60-minute-heartbeat rule and can run disabled with test fixtures.
- Executor and verifier separation is enforced.
- Pushkar approval is enforced for pricing and financial exceptions.
- Reports cannot mutate operating records.
- Feature flags default to off for Production.
- No secret, Member PII, KYC document or raw payroll data appears in source control, logs, screenshots or fixtures.
- Migration and rollback instructions have been tested or dry-run.
- The pull request identifies the exact base commit and reports whether it is conflict-free with current `main`.

## 16. Measures for the operating system itself

Track whether the automation is improving the company, not merely producing more actions:

- Detection precision and false-positive rate.
- Missed-event rate.
- Recommendation acceptance rate.
- Human override and reversal rate.
- Time from detection to assigned owner.
- Time from assignment to proof.
- Time from proof to independent verification.
- Verified action-closure rate.
- Closed-but-not-resolved rate.
- Reopened-action rate.
- Stale-data rate.
- Verified Member and financial outcome.
- Human operating hours saved.
- Agent and infrastructure cost per verified outcome.
- Audit completeness.

Do not use task count, message count or generated output as the primary success metric.

## Final execution instruction

Begin with Phase 0. Do not start by redesigning the interface or creating more demo dashboards. Establish the semantic operating layer and source contracts, then make the enterprise-demand-to-verified-activation loop work end to end inside the existing Rafiqi Central product.

Use the provided workbook as the authoritative v1 intake contract and the WhatsApp document as the authoritative collection contract. Do not wait for Sachin to locate historic source files or mappings. Map historic Sheets later through `Source_Registry`.

If credentials are missing, implement the production-shaped adapter, keep it disabled, use non-sensitive fixtures and continue. Ask one consolidated credentials question only when the missing credential prevents the next agreed integration test. Never print or commit secrets.

For all other implementation decisions, make the safest reversible choice, document it and continue. Stop after Phase 2, update the draft pull request with the merge-gate evidence and wait for Sachin's approval.
