"use client"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { EditorialChartFrame } from "./editorial-chart-frame"
import { CHART_SOURCE_NOTE, cmBridge, EDITORIAL_CHART_COPY } from "@/lib/editorial-charts"
import { formatInr } from "@/lib/ops-data"

const config = { value: { label: "CM", color: "var(--chart-1)" } }

export function CmBridgeChart({ rows = cmBridge, source = CHART_SOURCE_NOTE }: { rows?: readonly { label: string; value: number }[]; source?: string }) {
  const data = rows.map((row) => ({ ...row, display: Math.abs(row.value) }))
  return <EditorialChartFrame compact id="cm-bridge" {...EDITORIAL_CHART_COPY.cmBridge} source={source} table={<table><caption>Contribution margin bridge</caption><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th><td>{formatInr(row.value, true)}</td></tr>)}</tbody></table>}>
    <ChartContainer config={config} className="editorial-chart-canvas"><BarChart accessibilityLayer data={data} margin={{ top: 22, right: 12, left: 6 }}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => formatInr(value, true)} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => formatInr(Number(value), true)} />} /><Bar dataKey="display" fill="var(--color-value)" radius={4}><LabelList dataKey="value" position="top" formatter={(value) => formatInr(Number(value), true)} /></Bar></BarChart></ChartContainer>
  </EditorialChartFrame>
}
