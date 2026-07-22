import type { ReportChartSeries, ReportTone } from "@/lib/report-meaning"

// Token-driven bar exhibit. No charting dependency: each bar is a CSS track so
// it inherits the palette and re-resolves under light/dark automatically.
export function BarChart({ series, label, tone }: { series: ReportChartSeries; label: string; tone?: ReportTone }) {
  const max = Math.max(...series.points.map((point) => point.value), 0) || 1
  const unit = series.unit ?? ""
  return (
    <div className="report-bars" role="img" aria-label={label}>
      {series.points.map((point) => {
        const pct = Math.max(0, Math.min(100, (point.value / max) * 100))
        return (
          <div className="report-bar" data-tone={tone ?? undefined} key={point.label}>
            <span className="report-bar-label">{point.label}</span>
            <span className="report-bar-track">
              <span className="report-bar-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="report-bar-value">
              {point.value}
              {unit}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const VIEW_W = 320
const VIEW_H = 120
const PAD = 12

// Line exhibit. A single inline SVG polyline scaled uniformly (meet) so the dots
// stay circular at any width. Stroke and fills are tokens.
export function LineChart({ series, label }: { series: ReportChartSeries; label: string }) {
  const values = series.points.map((point) => point.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const n = series.points.length
  const coords = series.points.map((point, index) => {
    const x = n === 1 ? VIEW_W / 2 : PAD + (index * (VIEW_W - PAD * 2)) / (n - 1)
    const y = VIEW_H - PAD - ((point.value - min) / span) * (VIEW_H - PAD * 2)
    return { x, y, point }
  })
  const path = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(" ")
  const midY = VIEW_H / 2
  return (
    <div className="report-line">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
        <line className="report-line-grid" x1={PAD} y1={midY} x2={VIEW_W - PAD} y2={midY} />
        <path className="report-line-path" d={path} />
        {coords.map((coord) => (
          <circle className="report-line-dot" key={coord.point.label} cx={coord.x} cy={coord.y} r={3} />
        ))}
      </svg>
      <div className="report-line-axis">
        <span>{series.points[0]?.label}</span>
        <span>{series.points[n - 1]?.label}</span>
      </div>
    </div>
  )
}
