"use client"
import { CartesianGrid, LabelList, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { EditorialChartFrame } from "./editorial-chart-frame"
import { CHART_SOURCE_NOTE, EDITORIAL_CHART_COPY, networkAverage, studioArpu } from "@/lib/editorial-charts"

const config = { arpu: { label: "ARPU", color: "var(--chart-1)" } }

export function StudioArpuChart({ rows = studioArpu, average = networkAverage, source = CHART_SOURCE_NOTE }: { rows?: readonly { theatre: string; value: number }[]; average?: { label: string; value: number }; source?: string }) {
  const values = rows.map((row) => row.value)
  const minimum = values.length ? Math.min(...values, average.value) : 0
  const maximum = values.length ? Math.max(...values, average.value) : 1
  const padding = Math.max(1, Math.round((maximum - minimum) * .1))
  return <EditorialChartFrame id="studio-arpu" {...EDITORIAL_CHART_COPY.arpu} source={source} table={<table><caption>Theatre ARPU ranking</caption><thead><tr><th>Theatre</th><th>ARPU</th></tr></thead><tbody>{rows.map((row) => <tr key={row.theatre}><th>{row.theatre}</th><td>₹{row.value.toLocaleString("en-IN")}</td></tr>)}<tr><th>{average.label}</th><td>₹{average.value.toLocaleString("en-IN")}</td></tr></tbody></table>}>
    <ChartContainer config={config} className="editorial-chart-canvas"><ScatterChart accessibilityLayer margin={{ left: 18, right: 58, top: 14, bottom: 8 }}><CartesianGrid horizontal={false} /><XAxis type="number" dataKey="value" domain={[Math.max(0, minimum - padding), maximum + padding]} tickFormatter={(value) => `₹${value}`} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="theatre" width={128} tickLine={false} axisLine={false} /><ReferenceLine x={average.value} stroke="var(--interactive-blue-soft)" strokeDasharray="4 4" label={{ value: `${average.label} ₹${average.value.toLocaleString("en-IN")}`, position: "insideTopRight" }} /><ChartTooltip content={<ChartTooltipContent />} /><Scatter data={rows} fill="var(--color-arpu)"><LabelList dataKey="value" position="right" formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} /></Scatter></ScatterChart></ChartContainer>
  </EditorialChartFrame>
}
