import type { ReactNode } from "react"
import { measureViz } from "@/lib/measure-viz"

// Renders a compact inline chart for a measure's value/target pair.
// Falls back to the provided node (usually the reference text) when the pair cannot be charted.
export function MeasureViz({ value, target, fallback = null, showCaption = true }: { value: string; target: string; fallback?: ReactNode; showCaption?: boolean }) {
  const viz = measureViz(value, target)
  if (!viz) return <>{fallback}</>
  const label = viz.kind === "compare"
    ? `${value} against ${target}`
    : `${value} · ${viz.caption}`
  return <span className="measure-viz">
    <span className="measure-viz-track" role="img" aria-label={label}>
      <span className="measure-viz-fill" style={{ width: `${viz.fillPct}%` }} />
      {viz.kind === "compare" ? <span className="measure-viz-marker" style={{ left: `${viz.markerPct}%` }} /> : null}
    </span>
    {showCaption ? <span className="measure-viz-caption">{viz.caption}</span> : null}
  </span>
}
