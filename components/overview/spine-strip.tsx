import { ArrowRight } from "lucide-react"
import { isNoData, topUnresolved } from "@/lib/allocation-engine"
import { OVERVIEW_ROUTES, type DashboardRoute } from "@/lib/dashboard-model"
import { formatInr, formatSpineValue, metricPace, metricVariance } from "@/lib/ops-data"

type SpineMetric = {
  id: string
  label: string
  lane: string
  actual: number
  plan: number
  unit: string
  owner?: string
}

export function SpineStrip({
  liveOpsData,
  allocationData,
  onNavigate,
}: {
  liveOpsData: {
    spine: SpineMetric[]
  }
  allocationData?: any
  onNavigate: (route: DashboardRoute, mismatchId?: string) => void
}) {
  const top = topUnresolved({}, allocationData?.mismatchInputs)
  const leakCm = top && !isNoData(top.forwardCmAtRisk24h) ? formatInr(top.forwardCmAtRisk24h, true) : "No data"
  const spine = liveOpsData?.spine ?? []
  const lowestPace = spine
    .filter((metric) => metric.plan > 0)
    .sort((a, b) => metricPace(a) - metricPace(b))[0]
  return (
    <section className="story-section" aria-labelledby="spine-title">
      <header className="story-heading"><div><p className="story-kicker">01 · HOW THE BUSINESS WORKS</p><h2 id="spine-title">{lowestPace ? `The largest plan gap is ${lowestPace.label.toLowerCase()}.` : "Source plans are not configured."}</h2><p className="chart-reads"><span>What this chart shows</span>Compare the approved plan with live results at six steps.</p></div><p>Select a step to see its details.</p></header>
      <div className="spine-scroll" role="group" aria-label="Operating spine; scroll horizontally on small screens">
        <div className="spine-strip">
          {spine.map((metric, index) => {
            const variance = metricVariance(metric)
            const value = formatSpineValue(metric)
            return <div className="spine-unit" key={metric.id}>
              <button className="spine-node" onClick={() => onNavigate(OVERVIEW_ROUTES[metric.id])} aria-label={`${metric.label}: ${value}, ${metricPace(metric)} percent of plan. Open ${OVERVIEW_ROUTES[metric.id].screen}${OVERVIEW_ROUTES[metric.id].subsection ? ` ${OVERVIEW_ROUTES[metric.id].subsection}` : ""}`}>
                <span>{String(index + 1).padStart(2, "0")} · {metric.label}</span><strong>{value}</strong><small>{metricPace(metric)}% of plan · {variance > 0 ? "+" : ""}{metric.unit === "INR" ? formatInr(variance, true) : metric.unit === "percent" ? `${variance} percentage points` : variance.toLocaleString("en-IN")} from plan</small><small>Owner: {metric.owner || "Owner not configured"}</small>
              </button>
              {index < spine.length - 1 && <button className={`spine-link ${index === 0 && top ? "broken" : ""}`} onClick={() => (index === 0 && top ? onNavigate(top.laneTarget, top.id) : onNavigate(OVERVIEW_ROUTES[spine[index + 1].id]))} aria-label={index === 0 && top ? `Highest-ranked mismatch: ${top.label}; open ${top.laneTarget.screen}${top.laneTarget.subsection ? ` ${top.laneTarget.subsection}` : ""}` : `Open ${OVERVIEW_ROUTES[spine[index + 1].id].screen}${OVERVIEW_ROUTES[spine[index + 1].id].subsection ? ` ${OVERVIEW_ROUTES[spine[index + 1].id].subsection}` : ""}; continue downstream`}><ArrowRight aria-hidden /></button>}
            </div>
          })}
        </div>
      </div>
      {top && <p className="leak-note"><span aria-hidden />Biggest gap: <strong>{top.label}</strong> · {leakCm} CM at risk in the next 24 hours</p>}
    </section>
  )
}



