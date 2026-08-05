"use client"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { EditorialChartFrame } from "./editorial-chart-frame"
import { CHART_SOURCE_NOTE, cmBridge, EDITORIAL_CHART_COPY } from "@/lib/editorial-charts"
import { formatInr } from "@/lib/ops-data"
const data = cmBridge.map(d => ({ ...d, display: Math.abs(d.value) })); const config = { value: { label: "CM", color: "var(--chart-1)" } }
export function CmBridgeChart() { return <EditorialChartFrame compact id="cm-bridge" {...EDITORIAL_CHART_COPY.cmBridge} source={CHART_SOURCE_NOTE} table={<table><caption>Contribution margin bridge</caption><tbody>{cmBridge.map(d => <tr key={d.label}><th>{d.label}</th><td>{formatInr(d.value, true)}</td></tr>)}</tbody></table>}><ChartContainer config={config} className="editorial-chart-canvas"><BarChart accessibilityLayer data={data} margin={{ top: 22, right: 12, left: 6 }}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickFormatter={v => formatInr(v, true)} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={v => formatInr(Number(v), true)} />} /><Bar dataKey="display" fill="var(--color-value)" radius={4}><LabelList dataKey="value" position="top" formatter={v => formatInr(Number(v), true)} /></Bar></BarChart></ChartContainer></EditorialChartFrame> }
