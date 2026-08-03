# RafiQi Central design system

Status: locked product-wide contract
Scope: Self Drive, Self Learn, Finance, legacy views and shared controls

## Narrative hierarchy

Self Drive follows the mandatory action-first contract in [`CLAUDE.md`](../CLAUDE.md): one resolved blocking action, today's work, non-blocking sign-offs, status, causes, context and proof. Narrative work may change composition and disclosure, but it must not fork this design system.

## One system

Every page uses the same mixed-shell tokens and component primitives: one near-black navigation rail with a white/soft-grey operating canvas. A route may change layout to fit its job, but it may not redefine the product palette, typography, control chrome or status mapping. There is no route-specific theme fork.

## Tokens

The source of truth is `app/globals.css`.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#17191B` | Primary text and selected states |
| `--muted` | `#6E7378` | Secondary text |
| `--faint` | `#90959A` | Tertiary and placeholder text |
| `--border` | `#E1E3E5` | Hairlines and dividers |
| `--surface` | `#FFFFFF` | Working surfaces |
| `--bg` / `--canvas` | `#F7F7F8` | Application background |
| `--accent` | neutral near-black | Interaction, selected state and focus only |

Feature styles must consume these tokens. They must not redeclare `--ink`, `--muted`, `--surface`, `--bg`, `--accent` or the font stack.

## Typography

- Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif`.
- Headings and strong UI labels cap at 600.
- Heading tracking is `-0.012em`.
- Copy is sentence case and short enough to scan.
- Supporting metadata uses `--muted`; placeholders use `--faint`.

## Interaction

- Blue is not part of the product palette. Selected and focus states use black/grey; colour is reserved for genuine status and exceptions.
- Focus is a soft, two-pixel `--focus-ring`; never native browser chrome.
- Native `select` controls are prohibited. Use `components/token-select.tsx`.
- Static displays use white surfaces, dark ink and neutral grey. The global rail is the only persistent dark surface.

## Semantic tone

The only status mapping is `operationalTone()` in `components/operational-card.tsx`.

Tones: `critical | breach | attention | verified | neutral`.

Every severity surface receives `data-tone` and consumes the shared tone variables. Card rail, pill, progress and action segment must agree. Critical, breach and attention carry vivid signal color; verified and neutral remain calm grey. Status is also written in text and never communicated by color alone.

## Microcopy

Use terse labels: `Billing outcomes · 30m`, not narrative sentences. Feed freshness is a per-feed status dot, short name and age. Root cause and required action are three to four words on the card face; detail stays behind disclosure.

Every card follows one reading rule:

- Title: two to four words naming the content.
- Finding: one short line stating the truth.
- Action: three to five words stating what happens next.

Titles never explain the operating system. Narrative, method and governance detail belong behind `View detail`. The full action-first composition contract lives in `CLAUDE.md`.

## Project map

### Routes and tabs

- Self Drive: Cash & Control, Enterprise Demand, Member Adds, Member Engagement, Member Savings, Nia Margins, Nia Growth, Despatch, Your Sign-Off.
- Self Learn: Overview, Living, Work, Essentials, Member NPS, People, Learning history.
- Finance: Finance control, Nia Margins, Cash & Control, subject to role gates.
- Legacy dark-launch shell: Overview, Operations Mandate, Living, Work, Essentials, People, Member NPS, Economics, Definitions, Despatch.
- There is no route-specific theme fork. Login, Self Drive, Self Learn, Finance and legacy views all consume the same dark tokens.

### Commands

- Tests: `pnpm test`
- Development: `pnpm dev`
- Type check: `pnpm exec tsc --noEmit`
- Production build: `pnpm build --webpack`

### Key files

- Global tokens and primitives: `app/globals.css`
- Shell and tab routing: `components/nia-dashboard.tsx`, `lib/dashboard-model.ts`
- Severity source and action cards: `components/operational-card.tsx`
- Custom selector: `components/token-select.tsx`
- Workspace components: `components/*-workspace.tsx`

## Change discipline

1. Read and reuse the existing token, tone and control primitive.
2. Change shared tokens in `app/globals.css`; do not fork them inside a route.
3. Confirm the change does not create a second visual system.
4. Run the full test suite and type check.
5. Verify the changed surfaces at desktop and mobile widths before declaring done.
