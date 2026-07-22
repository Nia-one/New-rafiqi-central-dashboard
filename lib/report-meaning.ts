// ============================================================================
// Report Meaning Layer — contracts
// ----------------------------------------------------------------------------
// A reusable "collapsible pyramid" reporting architecture:
//
//   Fixed Peak  →  Action Accordions  →  Evidence Layer
//
// Invariants enforced here (single source of truth for the whole product):
//   1. The Peak is uncollapsible and carries the full SCR + Ask + owner/date. (assertPeak)
//   2. Every accordion is titled with a COMPLETE, QUANTIFIED action.          (describeTitleIssue)
//   3. A closed accordion reads through on its action title ALONE.            (readThrough / render layer)
//   4. No exhibit renders without an evidence-level "So What".                (assertSoWhat)
//
// This module has no React dependency: it is pure data + validation so it can
// be shared by server components, client components and the test runner alike.
// The tone union mirrors `operationalTone` in components/operational-card.tsx,
// which remains the single runtime status source; here we only type it.
// ============================================================================

export type ReportTone = "critical" | "breach" | "attention" | "verified" | "neutral"

export type EvidenceDataSource = "static" | "live"
export type EvidenceChartType = "bar" | "line" | "table" | "metric"

/**
 * A single quantified fact. No per-metric "So What" is required: the parent
 * EvidenceBlock owns the mandatory meaning gate, so repeating it here would be
 * redundant noise.
 */
export type ReportMetric = {
  label: string
  value: string
  delta?: string
  tone?: ReportTone
}

/** A tabular exhibit. Meaning lives on the parent evidence block, not here. */
export type ReportTable = {
  caption: string
  columns: readonly string[]
  rows: readonly (readonly string[])[]
}

/** One point in a bar or line exhibit. */
export type ReportChartPoint = {
  label: string
  value: number
}

/** A bar or line series. Meaning lives on the parent evidence block. */
export type ReportChartSeries = {
  unit?: string
  points: readonly ReportChartPoint[]
}

/**
 * The bottom of the pyramid: proof for one action.
 *
 *  - `chartType` selects the exhibit: metric grid, table, bar or line.
 *  - `dataSource` marks the exhibit as baked-in (`static`) or fed by a live hook
 *    (`live`); a live block MUST declare an `endpoint` and a `refreshInterval`,
 *    and MAY seed a payload for first paint.
 *  - `soWhat` is the mandatory meaning gate — nothing renders ahead of it.
 *  - `sourceLabel` + `pulledAt` are mandatory provenance, rendered as the
 *    "Source · Pulled" footer so every exhibit is auditable.
 */
export type ReportEvidence = {
  id: string
  chartType: EvidenceChartType
  dataSource: EvidenceDataSource
  soWhat: string
  sourceLabel: string
  pulledAt: string
  tone?: ReportTone
  // Payloads. Static evidence must carry the payload for its chartType; live
  // evidence may seed one for first paint before the endpoint responds.
  metrics?: readonly ReportMetric[]
  table?: ReportTable
  series?: ReportChartSeries
  note?: string
  // Live source wiring.
  endpoint?: string
  refreshInterval?: number
}

/**
 * The middle of the pyramid. `actionTitle` is a complete, quantified instruction
 * so the closed read-through is a coherent argument on its own. `soWhat`, owner
 * and evidence are revealed only on expand — the closed summary shows the title
 * and nothing else.
 */
export type ReportAccordion = {
  id: string
  actionTitle: string
  soWhat: string
  tone?: ReportTone
  owner?: string
  dueDate?: string
  evidence: readonly ReportEvidence[]
  defaultOpen?: boolean
}

/**
 * The uncollapsible top of the pyramid. Carries the full Situation-Complication-
 * Recommendation narrative plus a single Ask with an accountable owner and due
 * date. Every field is always visible; nothing here collapses.
 */
export type ReportPeak = {
  objective: string
  situation: string
  complication: string
  recommendation: string
  ask: string
  owner: string
  dueDate: string
  asOf: string
  tone?: ReportTone
}

export type ReportConfig = {
  peak: ReportPeak
  accordions: readonly ReportAccordion[]
}

// ---------------------------------------------------------------------------
// Action-title enforcement.
//
// A valid action title is more than a leading verb. It must be:
//   (a) led by an imperative verb from the lexicon (not a topic/noun phrase),
//   (b) a complete instruction (enough words to name an object, not a fragment),
//   (c) quantified (a magnitude, target, %, currency or count) so the action is
//       measurable rather than a vague aspiration.
// ---------------------------------------------------------------------------
export const REPORT_ACTION_VERBS: ReadonlySet<string> = Object.freeze(
  new Set([
    "acknowledge", "add", "align", "approve", "assign", "audit", "block", "build",
    "cap", "chase", "clear", "close", "collect", "confirm", "correct", "cut",
    "decline", "defer", "deliver", "escalate", "expand", "extend", "fill", "fix",
    "flag", "freeze", "grow", "halt", "hold", "increase", "investigate", "launch",
    "lift", "lower", "move", "open", "pause", "prioritise", "prioritize", "protect",
    "raise", "rebalance", "recover", "reduce", "reject", "release", "reopen",
    "replace", "resolve", "restore", "resubmit", "retry", "review", "run", "scale",
    "secure", "shift", "sign", "start", "stop", "submit", "swap", "tighten",
    "trim", "unblock", "validate", "verify",
  ]),
)

// A quantifier is a digit, a currency/percent symbol, or a common magnitude unit
// (pts / pp / bps / days / weeks / hours / x). This is what makes an instruction
// measurable rather than aspirational.
const QUANTIFIER = /(\d|[%₹$€£]|\b(?:pts?|pp|bps|days?|weeks?|hrs?|hours?|x)\b)/i

const MIN_ACTION_WORDS = 4

const firstWord = (value: string) =>
  value.trim().toLowerCase().replace(/^[^a-z]+/, "").split(/[\s'’-]/, 1)[0] ?? ""

/**
 * Returns a human-readable reason a title is not a valid action, or `null` when
 * the title passes every rule. Used for precise validation errors.
 */
export function describeTitleIssue(title: string): string | null {
  if (typeof title !== "string" || !title.trim()) return "requires an action title"
  const words = title.trim().split(/\s+/)
  if (!REPORT_ACTION_VERBS.has(firstWord(title))) {
    return "is a topic, not an action; lead with an imperative verb"
  }
  if (words.length < MIN_ACTION_WORDS) {
    return "is not a complete action sentence; name what to act on"
  }
  if (!QUANTIFIER.test(title)) {
    return "is not quantified; state the magnitude, target or count"
  }
  return null
}

/** True when a title is a complete, quantified, imperative action. */
export function isActionTitle(title: string): boolean {
  return describeTitleIssue(title) === null
}

/** The "So What" gate. Throws when meaning is missing, blocking a naked exhibit. */
export function assertSoWhat(soWhat: string | undefined, context: string): string {
  const meaning = (soWhat ?? "").trim()
  if (!meaning) throw new Error(`Report meaning gate: "${context}" must state a "So What" before it can render.`)
  return meaning
}

function assertNonEmpty(value: string | undefined, message: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(message)
}

function validateMetric(metric: ReportMetric, path: string) {
  assertNonEmpty(metric.label, `${path} metric requires a label.`)
  assertNonEmpty(metric.value, `${path} metric "${metric.label}" requires a value.`)
}

function validateTable(table: ReportTable, path: string) {
  assertNonEmpty(table.caption, `${path} table requires a caption.`)
  if (table.columns.length === 0) throw new Error(`${path} table requires at least one column.`)
  for (const row of table.rows) {
    if (row.length !== table.columns.length) throw new Error(`${path} table row width must match its ${table.columns.length} columns.`)
  }
}

function validateSeries(series: ReportChartSeries, path: string) {
  if (series.points.length === 0) throw new Error(`${path} chart requires at least one point.`)
  for (const point of series.points) {
    assertNonEmpty(point.label, `${path} chart point requires a label.`)
    if (!Number.isFinite(point.value)) throw new Error(`${path} chart point "${point.label}" requires a finite value.`)
  }
}

function validateEvidence(evidence: ReportEvidence, path: string) {
  const where = `${path} › ${evidence.id}`
  assertNonEmpty(evidence.id, `${path} evidence requires a stable id.`)
  assertSoWhat(evidence.soWhat, `Evidence "${evidence.id}"`)
  assertNonEmpty(evidence.sourceLabel, `${where} requires a sourceLabel for its provenance footer.`)
  if (!Number.isFinite(Date.parse(evidence.pulledAt))) {
    throw new Error(`${where} requires a valid pulledAt timestamp for its provenance footer.`)
  }

  // Data-source wiring.
  if (evidence.dataSource === "live") {
    assertNonEmpty(evidence.endpoint, `${where} is live and must declare an endpoint.`)
    if (!Number.isFinite(evidence.refreshInterval) || (evidence.refreshInterval ?? 0) <= 0) {
      throw new Error(`${where} is live and must declare a positive refreshInterval (ms).`)
    }
  } else if (evidence.endpoint || evidence.refreshInterval !== undefined) {
    throw new Error(`${where} is static and must not declare a live endpoint or refreshInterval.`)
  }

  // Payload must match the chart type. Static evidence must ship its payload;
  // live evidence may omit it (the hook fills first paint) but must be valid if present.
  const requirePayload = evidence.dataSource === "static"
  switch (evidence.chartType) {
    case "metric":
      if (requirePayload && !evidence.metrics?.length) throw new Error(`${where} is a metric exhibit and requires at least one metric.`)
      break
    case "table":
      if (requirePayload && !evidence.table) throw new Error(`${where} is a table exhibit and requires a table.`)
      break
    case "bar":
    case "line":
      if (requirePayload && !evidence.series) throw new Error(`${where} is a ${evidence.chartType} exhibit and requires a series.`)
      break
  }
  if (evidence.metrics?.length) evidence.metrics.forEach((metric) => validateMetric(metric, where))
  if (evidence.table) validateTable(evidence.table, where)
  if (evidence.series) validateSeries(evidence.series, where)
}

function validateAccordion(accordion: ReportAccordion, path: string) {
  assertNonEmpty(accordion.id, `${path} accordion requires a stable id.`)
  const issue = describeTitleIssue(accordion.actionTitle)
  if (issue) throw new Error(`${path} accordion "${accordion.actionTitle}" ${issue}.`)
  assertSoWhat(accordion.soWhat, `Accordion "${accordion.actionTitle}"`)
  if (accordion.evidence.length === 0) throw new Error(`${path} accordion "${accordion.actionTitle}" requires at least one evidence block.`)
  accordion.evidence.forEach((evidence) => validateEvidence(evidence, `Accordion "${accordion.actionTitle}"`))
}

function assertPeak(peak: ReportPeak) {
  assertNonEmpty(peak.objective, "Report peak requires an objective.")
  assertNonEmpty(peak.situation, "Report peak requires a situation.")
  assertNonEmpty(peak.complication, "Report peak requires a complication.")
  assertNonEmpty(peak.recommendation, "Report peak requires a single recommendation.")
  assertNonEmpty(peak.ask, "Report peak requires an Ask that is never hidden.")
  assertNonEmpty(peak.owner, "Report peak requires an accountable owner.")
  assertNonEmpty(peak.dueDate, "Report peak requires a due date for the Ask.")
  if (!Number.isFinite(Date.parse(peak.asOf))) throw new Error("Report peak requires a valid as-of timestamp.")
}

/**
 * Validate and deep-freeze a report. Throws on any breach of the four
 * invariants so a malformed report can never reach the render layer.
 */
export function buildReport(input: ReportConfig): ReportConfig {
  assertPeak(input.peak)
  if (input.accordions.length === 0) throw new Error("A report requires at least one action accordion.")
  if (new Set(input.accordions.map((accordion) => accordion.id)).size !== input.accordions.length) {
    throw new Error("Report accordion ids must be unique.")
  }
  input.accordions.forEach((accordion) => validateAccordion(accordion, "Report"))

  return Object.freeze({
    peak: Object.freeze({ ...input.peak }),
    accordions: Object.freeze(
      input.accordions.map((accordion) =>
        Object.freeze({
          ...accordion,
          evidence: Object.freeze(
            accordion.evidence.map((evidence) =>
              Object.freeze({
                ...evidence,
                metrics: evidence.metrics ? Object.freeze(evidence.metrics.map((metric) => Object.freeze({ ...metric }))) : undefined,
                table: evidence.table
                  ? Object.freeze({ ...evidence.table, columns: Object.freeze([...evidence.table.columns]), rows: Object.freeze(evidence.table.rows.map((row) => Object.freeze([...row]))) })
                  : undefined,
                series: evidence.series
                  ? Object.freeze({ ...evidence.series, points: Object.freeze(evidence.series.points.map((point) => Object.freeze({ ...point }))) })
                  : undefined,
              }),
            ),
          ),
        }),
      ),
    ),
  })
}

/**
 * The closed read-through: the Peak recommendation followed by every action
 * title. These lines must form a coherent argument without any accordion being
 * opened — which is why each title must itself be a complete, quantified action.
 */
export function readThrough(config: ReportConfig): readonly string[] {
  return Object.freeze([config.peak.recommendation, ...config.accordions.map((accordion) => accordion.actionTitle)])
}
