"use client"

import { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { contentValue } from "@/lib/dashboard-content"
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

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""))
}

export function CmTrajectory({ liveOpsData }: { liveOpsData: any }) {
  const currentCm = Number(liveOpsData.spine?.find((metric: any) => metric.id === "cm")?.actual ?? 0)
  const reportingPeriod = liveOpsData.cmReportingPeriod ?? liveOpsData.meta
  const daysRemaining = Math.max(1, Number(reportingPeriod.daysLeft ?? 0))
  const monthName = String(reportingPeriod.month || "Source period").replace(/\s+\d{4}$/, "")
  const currentDay = Number(reportingPeriod.day ?? 0)
  const lastDay = Number(reportingPeriod.daysInMonth ?? 0)
  // CM_History may contain several intraday snapshots. The trajectory is a
  // daily chart, so retain only the latest snapshot for each business day.
  const historyPoints = Array.from(
    (liveOpsData.history || []).reduce((latestByDay: Map<number, any>, point: any) => {
      const day = Number(point.day)
      if (!Number.isFinite(day)) return latestByDay
      const existing = latestByDay.get(day)
      const existingAt = Date.parse(existing?.capturedAt || existing?.businessDate || "")
      const pointAt = Date.parse(point.capturedAt || point.businessDate || "")
      if (!existing || !Number.isFinite(existingAt) || (Number.isFinite(pointAt) && pointAt >= existingAt)) latestByDay.set(day, point)
      return latestByDay
    }, new Map<number, any>()).values()
  ).sort((left: any, right: any) => Number(left.day) - Number(right.day))
  const points = historyPoints.some((point: any) => Number(point.day) === currentDay)
    ? historyPoints
    : [...historyPoints, { day: currentDay, actual: currentCm }]
  const run: {
  current: number
  target: number
  projection: number
  askRate: number
  askRateMultiple: number
  points: CmTrajectoryPoint[]
} = {
    current: currentCm,
    target: liveOpsData.monthlyCMTarget,
    projection: liveOpsData.monthEndProjection,
    askRate: Math.round(
      (liveOpsData.monthlyCMTarget - currentCm) / daysRemaining
    ),
    askRateMultiple: liveOpsData.askRateMultiple,
    points: points.map((point: any) => ({ day: point.day, actual: point.actual, target: lastDay > 0 ? Math.round((liveOpsData.monthlyCMTarget / lastDay) * point.day) : 0, projection: point.day >= currentDay ? liveOpsData.monthEndProjection : null })), 
}
  const values = {
    projection: formatInr(run.projection, true),
    earned: formatInr(run.current, true),
    target: formatInr(run.target, true),
    askRate: formatInr(run.askRate, true),
    askRateMultiple: run.askRateMultiple.toFixed(2),
    daysLeft: reportingPeriod.daysLeft,
    monthName,
    currentDay,
  }
  const content = liveOpsData.dashboardContent
  const text = (key: string, fallback: string) =>
    interpolate(contentValue(content, "Overview", "cm_trajectory", key, fallback), values)

  return (
    <section className="story-section trajectory" aria-labelledby="trajectory-title">
      <header className="story-heading"><div><p className="story-kicker">{text("kicker", "03 · CM FORECAST (CONTRIBUTION MARGIN)")}</p><h2 id="trajectory-title">{text("headline_template", "At this pace, CM will reach {projection} by month end.")}</h2><p className="chart-reads"><span>{text("chart_reads_label", "What this chart shows")}</span>{text("chart_reads_text", "This chart shows CM earned so far, the forecast for month end, and the target.")}</p></div><p>{text("needed_pace_prefix", "Needed pace:")} <strong>{text("needed_pace_template", "{askRate}/day. This is {askRateMultiple}× the current pace")}</strong> {text("remaining_days_template", "for the remaining {daysLeft} days.")}</p></header>
      <div className="trajectory-summary"><div><span>{text("earned_label", "EARNED")}</span><strong>{formatInr(run.current, true)}</strong></div><div><span>{text("forecast_label", "FORECAST")}</span><strong>{formatInr(run.projection, true)}</strong></div><div><span>{text("target_label", "TARGET")}</span><strong>{formatInr(run.target, true)}</strong></div></div>
      <ChartContainer config={chartConfig} className="cm-chart min-h-[270px]" aria-label="Cumulative contribution margin actual, target path and projected month end">
        <LineChart data={run.points} margin={{ top: 20, right: 28, left: 4, bottom: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={(value) => value === 1 || value === currentDay || value === lastDay ? `${monthName} ${value}` : ""} />
          <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => formatInr(value, true)} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => `${monthName} ${payload?.[0]?.payload?.day ?? ""}`} />} />
          <Line dataKey="target" type="linear" stroke="var(--color-target)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
          <Line dataKey="actual" type="monotone" stroke="var(--color-actual)" dot={false} strokeWidth={2.5} connectNulls />
          <Line dataKey="projection" type="linear" stroke="var(--color-projection)" strokeDasharray="7 5" dot={false} strokeWidth={2} connectNulls />
          <ReferenceDot x={lastDay} y={run.target} r={4} fill="var(--color-target)" stroke="var(--color-target)" />
        </LineChart>
      </ChartContainer>
      <div className="chart-labels" aria-hidden><span><i className="actual" />{text("actual_legend_template", "Actual through {monthName} {currentDay}")}</span><span><i className="projection" />{text("forecast_legend_label", "Forecast")}</span><span><i className="target" />{text("target_legend_label", "Target")}</span></div>
      <div className="sr-only"><table><caption>Cumulative CM trajectory</caption><thead><tr><th>Day</th><th>Actual</th><th>Target</th><th>Projection</th></tr></thead><tbody>{run.points.map((point) => <tr key={point.day}><td>{point.day}</td><td>{point.actual ?? "No data"}</td><td>{point.target}</td><td>{point.projection ?? "No data"}</td></tr>)}</tbody></table></div>
    </section>
  )
}

