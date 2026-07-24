"use client"

import { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatInr } from "@/lib/ops-data"

const chartConfig = {
  actual: { label: "Actual CM", color: "var(--chart-1)" },
  target: { label: "Target path", color: "var(--chart-2)" },
  projection: { label: "Projection", color: "var(--chart-3)" },
} satisfies ChartConfig

type CmTrajectoryPoint = {
  day: number
  actual: number | null
  target: number
  projection: number | null
}

export function CmTrajectory({ liveOpsData }: { liveOpsData: any }) {
  const run: {
  current: number
  target: number
  projection: number
  askRate: number
  askRateMultiple: number
  points: CmTrajectoryPoint[]
} = {
    current: liveOpsData.previousBlock.cm,
    target: liveOpsData.monthlyCMTarget,
    projection: liveOpsData.monthEndProjection,
    askRate: Math.round(
      (liveOpsData.monthlyCMTarget - liveOpsData.previousBlock.cm) /
      liveOpsData.meta.daysLeft
    ),
    askRateMultiple: liveOpsData.askRateMultiple,
    points: liveOpsData.history.map((point: any) => ({ day: point.day, actual: point.actual, target: Math.round((liveOpsData.monthlyCMTarget / liveOpsData.meta.daysInMonth) * point.day), projection: point.day >= liveOpsData.meta.day ? liveOpsData.monthEndProjection : null })), 
}
  return (
    <section className="story-section trajectory" aria-labelledby="trajectory-title">
      <header className="story-heading"><div><p className="story-kicker">03 · CM FORECAST (CONTRIBUTION MARGIN)</p><h2 id="trajectory-title">At this pace, CM will reach {formatInr(run.projection, true)} by month end.</h2><p className="chart-reads"><span>What this chart shows</span>This chart shows CM earned so far, the forecast for month end, and the target.</p></div><p>Needed pace: <strong>{formatInr(run.askRate, true)}/day. This is {run.askRateMultiple.toFixed(2)}× the current pace</strong> for the remaining {liveOpsData.meta.daysLeft} days.</p></header>
      <div className="trajectory-summary"><div><span>EARNED</span><strong>{formatInr(run.current, true)}</strong></div><div><span>FORECAST</span><strong>{formatInr(run.projection, true)}</strong></div><div><span>TARGET</span><strong>{formatInr(run.target, true)}</strong></div></div>
      <ChartContainer config={chartConfig} className="cm-chart min-h-[270px]" aria-label="Cumulative contribution margin actual, target path and projected month end">
        <LineChart data={run.points} margin={{ top: 20, right: 28, left: 4, bottom: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={(value) => value === 1 || value === liveOpsData.meta.day || value === 31 ? `Jul ${value}` : ""} />
          <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => formatInr(value, true)} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => `July ${payload?.[0]?.payload?.day ?? ""}`} />} />
          <Line dataKey="target" type="linear" stroke="var(--color-target)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
          <Line dataKey="actual" type="monotone" stroke="var(--color-actual)" dot={false} strokeWidth={2.5} connectNulls />
          <Line dataKey="projection" type="linear" stroke="var(--color-projection)" strokeDasharray="7 5" dot={false} strokeWidth={2} connectNulls />
          <ReferenceDot x={31} y={run.target} r={4} fill="var(--color-target)" stroke="var(--color-target)" />
        </LineChart>
      </ChartContainer>
      <div className="chart-labels" aria-hidden><span><i className="actual" />Actual through Jul {liveOpsData.meta.day}</span><span><i className="projection" />Forecast</span><span><i className="target" />Target</span></div>
      <div className="sr-only"><table><caption>Cumulative CM trajectory</caption><thead><tr><th>Day</th><th>Actual</th><th>Target</th><th>Projection</th></tr></thead><tbody>{run.points.map((point) => <tr key={point.day}><td>{point.day}</td><td>{point.actual ?? "No data"}</td><td>{point.target}</td><td>{point.projection ?? "No data"}</td></tr>)}</tbody></table></div>
    </section>
  )
}

