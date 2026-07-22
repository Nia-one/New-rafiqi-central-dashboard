# Śram Park Scout Route Plan

Status: audited product specification for synthetic shadow-mode implementation

Scope: replaces the existing Scouter’s Journey Plan; SP / Śram Park only

Decision owner: Sachin

Execution: read-only recommendation; no live route, contact, lease, spend or capital authority

## Final scorecard

| # | Criterion | Score | Final evidence |
|---:|---|---:|---|
| 1 | Field-ready | 5/5 | The SOP defines the trigger, inputs, queue, safe field session, capture, evidence and stop condition step by step. |
| 2 | Sequence integrity | 5/5 | A gate must enter Negotiation before a sweep can trigger; Ring 2 cannot open until all eight Ring 1 wedges are independently closed dry at the governed target-rent policy. |
| 3 | Trigger and daily prioritisation | 5/5 | The priority ladder protects incidents and guardrails, then ranks active Negotiation gates with a versioned formula and worked queue. |
| 4 | Coverage is complete | 5/5 | Radial intervals and eight half-open 45° wedges leave no gaps or overlaps; duration is derived from registry values. |
| 5 | Capture sheet is usable | 5/5 | Every candidate and gate field has a type, requirement, allowed values, privacy class and validation. |
| 6 | Fit score is real math | 5/5 | Every factor is normalised, versioned and shown in two worked examples. |
| 7 | Ranking works | 5/5 | Demand rank and supply-queue value are explicit and a synthetic top-three example is calculated. |
| 8 | Economics respected | 4/5 | Ring 2 includes shuttle cost and rent/capacity trade-offs; values are provisional until governed calibration replaces them. |
| 9 | Stop/kill discipline | 5/5 | Building rejection, paused negotiations, corridor switching and unsafe-field conditions have explicit outcomes. |
| 10 | Density enforced | 5/5 | The queue completes one corridor and clusters subsequent candidates within 5 km before opening another corridor. |

Red-flag check: **no red flags open**. The implementation must preserve the validation failures listed in Acceptance criteria.

## Audit history

### Pass 1 — build and audit

- Built the demand-to-supply handoff, Negotiation trigger, two-ring geometry, candidate form and ranking formula.
- Weakest lines: economics, stop discipline and field readiness.
- Findings: a beyond-5 km exception did not yet require named approval; field safety and privacy checks were incomplete; “drop everything” could pre-empt active War Rooms.

### Pass 2 — rebuild and audit

- Added the protected-priority ladder, recommendation-only shared-catchment exception, field-person safety gate, privacy classes, quarantine and provisional registry labels.
- Recalculated both fit-score examples and the top-three gate ranking from the documented formulas.
- Weakest line: economics remains 4/5 because target rent, billed ARPU and shuttle ceilings are explicitly provisional rather than approved operating facts.

### Pass 3 — adversarial audit

- Tried FONO input, missing `supply_model`, Qualified-stage input, Ring 2 before Ring 1 closure, an unevidenced 5 km exception, duplicate wedge coverage, an unsafe solo visit and a live contact/lease action.
- Expected result: every case quarantines or blocks; none creates a live assignment, message, contact, payment, lease or capital commitment.
- Final result: every rubric line is at least 4/5 and no red flag remains open.

## 4A — Field SOP

### 1. Roles and handoff

**Demand Scout** owns the factory-gate record and funnel evidence. **Supply Scout** owns the safe, systematic sweep after the trigger. **Independent verifier** is different from the Supply Scout and verifies wedge closure and candidate evidence. **Human approver** decides any shared-catchment exception and every lease, spend, contact or capital proposal outside this read-only system.

When a gate enters `Negotiation`, transfer this immutable snapshot:

1. `gate_id`, `enterprise_ref` and `supply_model=SP`;
2. protected factory-gate coordinate reference and corridor;
3. verified headcount, migrant share, shift pattern and current Living spend;
4. funnel stage, stage-entered time, expected close date and protected negotiation evidence;
5. billed-ARPU definition reference and contract-certainty policy reference;
6. source freshness, source lineage and independent verification state.

Missing, FONO, conflicting, stale or unprotected handoff data is quarantined. The system never infers SP from a name.

### 2. Trigger and funnel

Funnel order: `Identified → Contacted → Qualified → Negotiation → Floor Signed`.

- `Identified`, `Contacted` and `Qualified`: demand work only; supply sweep blocked.
- `Negotiation`: fire signal. Create a synthetic shadow sweep recommendation the same operating day.
- `Floor Signed`: keep an already-triggered sweep active until independently closed; do not wait for this stage to begin scouting.

Scouting at Negotiation is correct because candidate evidence can be ready when the occupancy floor closes without exposing Nia to speculative pre-Negotiation work or an avoidable post-signature delay.

### 3. Daily queue rebuild

Rebuild the queue from governed records at the start of every approved work window and whenever a protected-priority event arrives.

Priority order:

1. safety incident or emergency response;
2. active Studio War Room;
3. cash or financial guardrail breach;
4. legal or compliance block;
5. newly entered SP Negotiation gates;
6. continuing SP sweeps;
7. stalled SP negotiations and data-quality recovery;
8. no speculative supply task.

Within levels 5 and 6, order by:

`queue_value = potential_occupied_nests × billed_ARPU × contract_certainty`

where:

`potential_occupied_nests = headcount × migrant_share × shift_factor × contractability`

Break remaining ties by earliest expected close date, then oldest `stage_entered_at`. A protected-priority item pre-empts the sweep but does not delete its append-only history.

Synthetic example using registry v1:

| Queue | Gate | Stage | Potential occupied Nests | Queue value | Expected close | Why |
|---:|---|---|---:|---:|---|---|
| Protected | Safety incident | — | — | — | Immediate | Always outranks scouting. |
| 1 | `GATE-SP-A` | Negotiation | 1,008.0 | ₹27.22L | 18 Jul | Highest governed fill potential and nearest close. |
| 2 | `GATE-SP-B` | Negotiation | 688.5 | ₹18.59L | 19 Jul | Higher value than C. |
| 3 | `GATE-SP-C` | Negotiation | 686.4 | ₹18.53L | 22 Jul | Slightly lower value and later close. |
| Blocked | `GATE-SP-D` | Qualified | 1,200.0 | Not ranked | 20 Jul | Has not entered Negotiation. |

The values use synthetic billed ARPU ₹4,500 and Negotiation certainty 0.60. They are not approved commercial facts.

### 4. Set the centroid and sectors

1. Open only the verified protected factory-gate coordinate. Never use a Nia office, city centre or candidate building as the centroid.
2. Ring 1 is `[0, 2] km`. Ring 2 is `(2, 5] km`. More than 5 km is `Reject` unless the shared-catchment rule passes.
3. Normalise bearing into `[0°, 360°)` and assign exactly one half-open wedge:

| Wedge | Bearing | Clock direction |
|---|---|---|
| W1 | `[0°, 45°)` | 12–1:30 |
| W2 | `[45°, 90°)` | 1:30–3 |
| W3 | `[90°, 135°)` | 3–4:30 |
| W4 | `[135°, 180°)` | 4:30–6 |
| W5 | `[180°, 225°)` | 6–7:30 |
| W6 | `[225°, 270°)` | 7:30–9 |
| W7 | `[270°, 315°)` | 9–10:30 |
| W8 | `[315°, 360°)` | 10:30–12 |

One wedge has one accountable owner. A required safety buddy shares the visit but does not create a second coverage record.

### 5. Safe field session

Before departure, the shadow system must show every safety condition as passed or the route remains blocked:

- inside the versioned approved/daylight window;
- start, midpoint and end check-ins planned;
- no active emergency, War Room, guardrail or legal pre-emption;
- access is public or owner consent is evidenced; no trespass;
- hazardous-site controls and required PPE are recorded;
- a buddy is assigned whenever the risk review says solo work is unsafe;
- emergency contact and stop-work instruction are visible.

The implementation does not track GPS, contact owners, take photographs or assign a live route. It displays synthetic protected references only.

### 6. Sweep Ring 1 before Ring 2

1. Work one Ring 1 wedge per safe half-day session.
2. Log every candidate or an explicit `No candidate at target-rent policy` wedge result.
3. Independent verification must close all eight Ring 1 wedges.
4. If any eligible Ring 1 candidate remains open, Ring 2 stays blocked.
5. Ring 2 opens only after the eight verified dry results exist at the active target-rent policy version.
6. Repeat the same eight-wedge discipline in Ring 2, including the shuttle-cost factor.

At provisional 210 minutes per wedge, one scout needs four safe scout-days for one complete ring. Two scouts need two safe days and four scouts need one safe day. The system reports a resource gap if available safe sessions cannot finish before expected close; it never silently shortens a wedge.

### 7. Candidate return package

For each candidate, return the required capture-sheet fields, protected coordinate and photo references, access/utility evidence, owner-reachability state, rent evidence, fit-score inputs, policy versions and field-safety result. `Owner reachable=Yes` is not permission to contact the owner.

Wedge closure requires evidence from the accountable scout and a different verifier. Failed verification reopens the wedge.

### 8. Stop and kill rules

- Reject a candidate with missing/invalid SP context, more than 5 km without the approved exception, trespass requirement, unsafe access, unavailable drainage, no protected coordinate/evidence lineage, or an unaffordable result under the active target-rent policy.
- Block Ring 2 until Ring 1 is independently closed dry.
- Mark a Negotiation gate `Stalled` after the provisional stall interval without fresh evidence; retain it below active negotiations and never delete history.
- Pause field work immediately for an incident, emergency, War Room, guardrail or legal block.
- Move to another corridor only after active triggered gates in the current corridor are verified complete, stalled, killed or safely capacity-blocked.
- Source the second building within 5 km of the first candidate where possible; cluster buildings around the same gate to share shuttle, delivery and field coverage.
- A fit score never authorises contact, lease, payment, route assignment or capital commitment.

## 4B — Supply Scout Capture Sheet

All examples committed to the repository are synthetic. `protected://` values are opaque references, not raw data.

| Field | Type | Required | Allowed values / validation | Privacy |
|---|---|---:|---|---|
| `candidate_id` | text | Yes | Unique immutable ID | Internal |
| `gate_id` | text | Yes | Existing triggered gate | Internal |
| `supply_model` | enum | Yes | `SP` only; other/missing quarantined | Internal |
| `source_row_identity` | text | Yes | Immutable source lineage | Internal |
| `policy_version` | text | Yes | Active `SP-SCOUT-REGISTRY@vN` | Internal |
| `ring` | enum | Yes | `Ring 1`, `Ring 2`, `Beyond 5 km` | Internal |
| `wedge` | enum | Yes | `W1`–`W8` from computed bearing | Internal |
| `distance_km` | decimal | Yes | `0–5`; greater values require exception evidence | Restricted location |
| `walking_minutes` | integer | Yes | `0–180`; verified estimate source required | Restricted location |
| `building_type` | enum | Yes | `PG-convertible`, `Standalone`, `Bare land` | Internal |
| `floors` | integer | Yes | `0–50`; `0` allowed only for bare land | Internal |
| `estimated_nest_capacity` | integer | Yes | Positive whole Nests | Internal |
| `owner_reachable` | enum | Yes | `Yes`, `No`, `Unknown`; never contact permission | Restricted commercial |
| `owner_ref` | protected ref | Conditional | Required only when reachability evidence exists | Restricted commercial |
| `asking_rent_inr_month` | decimal | Yes | Non-negative, evidence required | Restricted commercial |
| `asking_rent_per_nest_inr` | decimal | Yes | Computed rent / capacity | Restricted commercial |
| `water_status` | enum | Yes | `Verified available`, `Unverified`, `Unavailable` | Internal |
| `power_status` | enum | Yes | `Verified available`, `Unverified`, `Unavailable` | Internal |
| `drainage_status` | enum | Yes | `Verified available`, `Unverified`, `Unavailable` | Internal |
| `road_access` | enum | Yes | `Walk only`, `Light vehicle`, `Shuttle and delivery`, `Unsafe` | Internal |
| `coordinate_ref` | protected ref | Yes | Must start `protected://`; no raw coordinates in report | Restricted location |
| `photo_ref` | protected ref | Yes | Must start `protected://`; no image committed | Restricted image |
| `owner_consent_ref` | protected ref | Conditional | Required before non-public access | Restricted commercial |
| `hazard_status` | enum | Yes | `Cleared`, `PPE required`, `Buddy required`, `Stop work` | Restricted safety |
| `check_in_status` | enum | Yes | `Planned`, `Complete`, `Failed` | Restricted safety |
| `shared_catchment_gate_ids` | text list | Conditional | Exactly two or more governed SP gate IDs for >5 km | Internal |
| `shared_catchment_evidence_ref` | protected ref | Conditional | Required for >5 km recommendation | Restricted location |
| `shared_catchment_approval_ref` | protected ref | Conditional | Named human approval required; recommendation-only | Restricted approval |
| `fit_score` | formula decimal | Conditional | `0–125`; null when blocked or >5 km | Internal |
| `fit_score_basis` | text | Yes | Factor values plus policy IDs/versions | Internal |
| `verification_state` | enum | Yes | `Pending`, `Verified`, `Failed`, `Quarantined` | Internal |
| `verifier_actor_id` | text | Conditional | Required for Verified; different from scout | Restricted identity |
| `captured_at` | datetime | Yes | ISO 8601 with offset | Internal |

### Fit score

Registry v1 defines:

- `capacity_factor = min(estimated_capacity / 250, 1)`
- `proximity_factor = max(0, 1 - distance_km / 5)`
- `convertibility_factor = 1.00 PG-convertible; 0.75 Standalone; 0.45 Bare land`
- `rent_factor = min(2500 / asking_rent_per_nest, 1.25)`
- `shuttle_factor = 1.00 in Ring 1; max(0, 1 - shuttle_cost_per_nest / 800) in Ring 2`
- `fit_score = round(100 × capacity_factor × proximity_factor × convertibility_factor × rent_factor × shuttle_factor, 1)`

All numbers above are provisional shadow calibration values from `SP-SCOUT-REGISTRY@v1`. Invalid, zero-rent, missing-source or beyond-5 km input returns no score.

Worked examples:

1. `CAND-SP-01`: Ring 1, 220 Nests, 1.2 km, PG-convertible, ₹2,200/Nest, no shuttle. `100 × 0.88 × 0.76 × 1.00 × 1.136 × 1.00 = 76.0`.
2. `CAND-SP-02`: Ring 2, 300 Nests, 3.4 km, standalone, ₹2,100/Nest, ₹350 shuttle/Nest. `100 × 1.00 × 0.32 × 0.75 × 1.190 × 0.5625 = 16.1`.

The higher Ring 1 score reflects walk-to-work proximity and no shuttle exposure. Neither result approves a transaction.

## 4C — Demand Scout Target Sheet

| Field | Type | Required | Allowed values / validation | Privacy |
|---|---|---:|---|---|
| `gate_id` | text | Yes | Unique immutable gate ID | Internal |
| `enterprise_ref` | protected ref | Yes | No raw contact or contract data | Restricted commercial |
| `supply_model` | enum | Yes | `SP` only | Internal |
| `gate_coordinate_ref` | protected ref | Yes | Factory-gate centroid only | Restricted location |
| `corridor_id` | text | Yes | Governed corridor master | Internal |
| `funnel_stage` | enum | Yes | `Identified`, `Contacted`, `Qualified`, `Negotiation`, `Floor Signed` | Internal |
| `stage_entered_at` | datetime | Yes | ISO 8601 with offset | Internal |
| `expected_close_date` | date | Yes | ISO date; freshness visible | Restricted commercial |
| `headcount` | integer | Yes | Positive; protected evidence | Restricted workforce |
| `migrant_share` | ratio | Yes | `0–1`; protected aggregate evidence | Restricted workforce |
| `shift_pattern` | enum | Yes | `Single`, `Two shift`, `Three shift`, `Continuous` | Restricted workforce |
| `shift_factor` | formula decimal | Yes | Versioned registry lookup | Internal |
| `current_living_spend_inr` | decimal | Yes | Non-negative aggregate; evidence required | Restricted commercial |
| `billed_arpu_inr` | decimal | Yes | Governed definition or provisional fixture policy | Restricted commercial |
| `contractability` | ratio | Yes | `0–1`; evidence and policy basis required | Restricted commercial |
| `contract_certainty` | ratio | Yes | Versioned stage policy | Restricted commercial |
| `potential_occupied_nests` | formula decimal | Yes | Headcount × migrant share × shift factor × contractability | Internal |
| `queue_value_inr` | formula decimal | Conditional | Only Negotiation/Floor Signed | Internal |
| `supply_trigger` | formula enum | Yes | `Blocked`, `Live shadow trigger`, `Continuing` | Internal |
| `trigger_evidence_ref` | protected ref | Conditional | Required for Live/Continuing | Restricted commercial |
| `source_freshness` | enum | Yes | `Current`, `Stale`, `No data` | Internal |
| `verification_state` | enum | Yes | `Pending`, `Verified`, `Failed`, `Quarantined` | Internal |

Synthetic corridor ranking:

| Rank | Gate | Headcount | Migrant share | Shift factor | Contractability | Potential occupied Nests | Queue value at ₹4,500 × 0.60 |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | `GATE-SP-A` | 1,800 | 0.70 | 1.00 | 0.80 | 1,008.0 | ₹27.22L |
| 2 | `GATE-SP-B` | 1,200 | 0.85 | 0.90 | 0.75 | 688.5 | ₹18.59L |
| 3 | `GATE-SP-C` | 2,400 | 0.55 | 0.80 | 0.65 | 686.4 | ₹18.53L |

`GATE-SP-D` may have a larger theoretical potential but is excluded while its funnel stage is Qualified.

## Decision registry

Every row is versioned. “Provisional shadow” means it may drive synthetic comparison and display but cannot govern live work.

| Policy | v1 value | Unit | State | Assumption/source |
|---|---:|---|---|---|
| `POL-SP-SCOUT-TRIGGER-STAGE` | Negotiation | funnel stage | Locked | Sachin decision |
| `POL-SP-SCOUT-RING-1-MAX` | 2 | km | Locked | Sachin decision |
| `POL-SP-SCOUT-RING-2-MAX` | 5 | km | Locked | Sachin decision |
| `POL-SP-SCOUT-WEDGES` | 8 | wedges/ring | Locked | Scout brief |
| `POL-SP-SCOUT-SHARED-CATCHMENT-GATES` | 2 | verified SP gates | Locked | Sachin decision; recommendation still needs human approval |
| `POL-SP-SCOUT-WEDGE-MINUTES` | 210 | minutes | Provisional shadow | Half-day calibration |
| `POL-SP-SCOUT-TARGET-RENT` | 2,500 | INR/Nest/month | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-TARGET-CAPACITY` | 250 | Nests | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-BILLED-ARPU` | 4,500 | INR/occupied Nest/month | Provisional shadow | Must be replaced by governed billed-ARPU coverage |
| `POL-SP-SCOUT-SHUTTLE-CEILING` | 800 | INR/Nest/month | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-STALL-DAYS` | 2 | operating days | Provisional shadow | Calibration required |
| `POL-SP-SCOUT-NEGOTIATION-CERTAINTY` | 0.60 | ratio | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-SHIFT-SINGLE` | 1.00 | ratio | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-SHIFT-TWO` | 0.90 | ratio | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-SHIFT-THREE` | 0.80 | ratio | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-SHIFT-CONTINUOUS` | 0.85 | ratio | Provisional shadow | Synthetic fixture only |
| `POL-SP-SCOUT-APPROVED-HOURS` | 08:00–18:00 | local daylight window | Provisional shadow | Field-safety review required |
| `POL-SP-SCOUT-CHECKINS` | 3 | start/mid/end | Provisional shadow | Field-safety review required |

## Acceptance criteria

1. Only `SP` records can enter the preview; missing or FONO data quarantines without inference.
2. Supply activation is blocked before Negotiation and begins the same operating day when verified Negotiation evidence arrives.
3. Protected priority work always ranks above scouting; it remains outside gate-value arithmetic.
4. Ring 1 must independently close all W1–W8 before Ring 2 opens.
5. Wedge functions cover every normalised bearing exactly once.
6. More than 5 km rejects by default. A shared-catchment recommendation requires at least two SP gates, protected evidence and named human approval, and still cannot execute.
7. Fit score consumes one visible registry version and returns no value for incomplete, invalid or blocked input.
8. Raw coordinates, photographs, owner details, phone data and workforce details quarantine; only protected references can render.
9. An unsafe time, missing check-in, trespass, missing consent, unresolved hazard or unsafe solo condition blocks the field recommendation.
10. Every route action carries `supply_model=SP`, protected evidence, an independent verifier and append-only history.
11. External messaging, GPS tracking, owner contact, photography, live assignment, lease, payment, capex and Production writes remain structurally unavailable.
12. The existing Scouter’s Journey Plan component is replaced in place. Operations navigation contains one route-plan entry and no duplicate tab.
13. The first viewport states the trigger, both rings, required return package and evidence/safety blocks without scrolling.
14. The demand-radius map and CSV remain available but use Ring 1, Ring 2 and Reject rather than 2/5/15 km.

## Assumptions

- All committed rows, coordinates and references are synthetic.
- `SP-SCOUT-REGISTRY@v1` is a calibration fixture, not an approved live policy set.
- Billed ARPU retains the governed meaning of billed Living revenue divided by occupied Nests; collection leakage remains separate.
- A Floor Signed gate may continue an already-triggered incomplete sweep; it is not a later trigger.
- A safety-required buddy does not create duplicate wedge coverage.
- Shared-catchment approval permits review only; it never authorises a lease, contact, payment, assignment or capital action.
- The system does not decide how many live scouts to deploy. It reports safe-session capacity and a resource gap.
- Existing FONO routes and franchisee playbooks remain outside this replacement.
