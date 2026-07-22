# Rafiqi Central agent contract

Read this file before changing the product. Reuse existing domain contracts, design tokens and operating-loop primitives. Do not invent parallel systems.

## Narrative arc: action first

Self Drive is an action surface, not a report. Every operating workspace must tell the user what happens next before explaining the system.

### Mandatory reading order

1. **Do this now** — exactly one blocking action, with owner, due time, progress and expected verified outcome.
2. **Today's work** — operational cards grouped as `Due now`, `In progress`, `Waiting for proof` and `Blocked`.
3. **Your sign-off** — only genuine human decisions that are not already occupying slot 1.
4. **Are we on track?** — target, verified result, remaining gap and time left.
5. **Why are we behind?** — root cause and recovery action in short, scannable phrases.
6. **Supporting context** — maps, channel splits, journey diagrams and explanatory charts.
7. **Proof and system health** — independent verification, data freshness, clocks and audit detail.

Slots 4–7 are conditional. Collapse them when healthy. A healthy page should become quiet after slots 1–3.

### One top slot

There must never be separate competing hero blocks for a task and a sign-off. Slot 1 resolves to the single blocking action:

- If a human sign-off blocks further work, the sign-off is `Do this now`.
- Otherwise the highest-priority executable task is `Do this now`.
- Non-blocking approvals remain in `Your sign-off`.

The top slot must state the action as an instruction, never as a question.

Good: `Call Oragadam FONO reserve A next.`

Bad: `Are we ready to close the Oragadam gap?`

### Deterministic priority rule

Never rely on fixture order, database order or component order. Select slot 1 using this governed comparison, in order:

1. `blocks_others`: blocking work and blocking sign-offs outrank non-blocking work.
2. `deadline_proximity`: the earliest valid due time wins.
3. `gap_impact`: the action closing the largest verified outcome gap wins.
4. `stable_id`: lexical stable identity is the final deterministic tie-breaker.

The chosen candidate and the factors that selected it must be testable.

### Score versus explanation

Keep one compact score strip near the top so the action has context:

`140/180 ready · gap 40 · closes 26 Jul`

Do not place gauges, maps, full KPI grids or journey stages beside the primary action. The score orients; charts explain. Explanatory visuals belong in supporting context.

### Conditional disclosure

- Healthy Loop Health stays compact and moves to the proof section.
- `Why are we behind?` does not render when there is no verified variance.
- Supporting diagrams and audit detail are collapsed by default unless they explain an active exception.
- A breached clock, stale critical feed or blocked verification may expand its relevant evidence automatically.

### Visual hierarchy without a theme fork

Do not change or fork the shared design tokens for narrative work. The primary action must still win through composition: more space, stronger scale and deliberate placement. Supporting sections must visibly recede. Reordering the DOM without changing prominence is not sufficient.

### Card contract

Every action or escalation card must expose, in this order:

1. Action or decision
2. Owner and due time
3. Progress
4. Root cause (three to five words where possible)
5. Recovery action (three to five words where possible)
6. Expected verified outcome

### Card language

Cards must name their contents before they explain the operating system.

- **Title:** two to four words that say what the user will find here. Never use a sentence as a title.
- **Finding:** one short line stating the important truth. Prefer eight words or fewer.
- **Action:** three to five words stating what happens next.
- Put narrative, method and governance detail behind `View detail`; do not repeat it in the title.

Good: `Nearby Capacity` → `3 options cover 40 Nests` → `Call three nearby suppliers`

Bad: `Ring 1 can cover today’s 40-Nest gap.`

The governing rule is: **title names the content; finding states the truth; action says what happens next.**

### Acceptance tests

- The first operating region after page navigation is the resolved `Do this now` action.
- A blocking sign-off replaces, rather than competes with, the routine top action.
- Candidate ordering is deterministic under the governed priority rule.
- The top score strip contains target/current, gap and deadline but no explanatory chart.
- Healthy optional sections are collapsed or absent.
- All existing safety, finance, role, evidence and independent-verification boundaries remain unchanged.

## Design system boundary

The shared dark design system in `docs/DESIGN_SYSTEM.md` remains the only visual token source. Narrative changes may alter layout, prominence, ordering and disclosure, but must not create route-specific palettes or duplicate status-to-colour logic.
