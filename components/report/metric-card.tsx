import type { ReportMetric } from "@/lib/report-meaning"

// A single quantified fact. Meaning is owned by the parent EvidenceBlock's "So
// What" gate, so the card stays terse: label, value and an optional delta.
export function MetricCard({ metric }: { metric: ReportMetric }) {
  return (
    <div className="report-metric" data-tone={metric.tone ?? undefined} role="listitem">
      <span className="report-metric-label">{metric.label}</span>
      <strong className="report-metric-value">
        {metric.value}
        {metric.delta ? <span className="report-metric-delta">{metric.delta}</span> : null}
      </strong>
    </div>
  )
}

export function MetricGrid({ metrics, label }: { metrics: readonly ReportMetric[]; label: string }) {
  if (metrics.length === 0) return null
  return (
    <div className="report-metric-grid" role="list" aria-label={label}>
      {metrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </div>
  )
}
