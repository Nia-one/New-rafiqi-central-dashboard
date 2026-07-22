"use client"

import { useEffect, useState } from "react"
import type { ReportEvidence, ReportMetric, ReportTable, ReportChartSeries } from "@/lib/report-meaning"
import { assertSoWhat } from "@/lib/report-meaning"
import { MetricGrid } from "./metric-card"
import { DataTable } from "./data-table"
import { BarChart, LineChart } from "./charts"

// Pinned to UTC so the server and the first client render format the seed
// `pulledAt` to byte-identical text. Without a fixed timeZone the server (UTC)
// and the browser (local zone) would disagree and trip a hydration mismatch on
// every evidence footer. The trailing "UTC" keeps the displayed time honest.
const PULLED_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })

function formatPulled(iso: string) {
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? `${PULLED_FMT.format(new Date(parsed))} UTC` : iso
}

function formatInterval(ms: number) {
  if (ms % 60000 === 0) return `every ${ms / 60000}m`
  if (ms % 1000 === 0) return `every ${ms / 1000}s`
  return `every ${ms}ms`
}

type Payload = { metrics?: readonly ReportMetric[]; table?: ReportTable; series?: ReportChartSeries; pulledAt: string }

// The bottom of the pyramid. The evidence-level "So What" is asserted first, so
// no exhibit can render ahead of its meaning. Live evidence polls its endpoint
// on the declared interval, seeded by any static payload for first paint; static
// evidence renders its baked-in payload. Both close with a Source · Pulled footer.
export function EvidenceBlock({ evidence }: { evidence: ReportEvidence }) {
  const soWhat = assertSoWhat(evidence.soWhat, `Evidence "${evidence.id}"`)
  const isLive = evidence.dataSource === "live"

  const [payload, setPayload] = useState<Payload>({
    metrics: evidence.metrics,
    table: evidence.table,
    series: evidence.series,
    pulledAt: evidence.pulledAt,
  })

  useEffect(() => {
    if (!isLive || !evidence.endpoint || !evidence.refreshInterval) return
    let active = true
    const controller = new AbortController()
    const pull = async () => {
      try {
        const res = await fetch(evidence.endpoint as string, { signal: controller.signal, cache: "no-store" })
        if (!res.ok) return
        const next = (await res.json()) as Partial<Payload>
        if (!active) return
        setPayload((prev) => ({
          metrics: next.metrics ?? prev.metrics,
          table: next.table ?? prev.table,
          series: next.series ?? prev.series,
          pulledAt: next.pulledAt ?? new Date().toISOString(),
        }))
      } catch {
        // Network/abort errors leave the last-known payload in place.
      }
    }
    pull()
    const timer = setInterval(pull, evidence.refreshInterval)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [isLive, evidence.endpoint, evidence.refreshInterval])

  const hasData =
    evidence.chartType === "metric" ? Boolean(payload.metrics?.length)
    : evidence.chartType === "table" ? Boolean(payload.table)
    : Boolean(payload.series?.points.length)

  return (
    <section className="report-evidence" aria-label={soWhat}>
      <div className="report-evidence-sowhat">
        <span>So what</span>
        <p>{soWhat}</p>
      </div>

      {!hasData ? (
        <p className="report-evidence-empty">Awaiting live data…</p>
      ) : evidence.chartType === "metric" && payload.metrics ? (
        <MetricGrid metrics={payload.metrics} label={`${soWhat} — metrics`} />
      ) : evidence.chartType === "table" && payload.table ? (
        <DataTable table={payload.table} />
      ) : evidence.chartType === "bar" && payload.series ? (
        <BarChart series={payload.series} label={`${soWhat} — bar chart`} tone={evidence.tone} />
      ) : evidence.chartType === "line" && payload.series ? (
        <LineChart series={payload.series} label={`${soWhat} — line chart`} />
      ) : null}

      {evidence.note ? <p className="report-evidence-note">{evidence.note}</p> : null}

      <footer className="report-evidence-footer">
        <span className="report-evidence-source" data-source={evidence.dataSource}>
          {isLive ? "Live" : "Static"}
        </span>
        <span className="report-evidence-provenance">Source: {evidence.sourceLabel}</span>
        <span className="report-evidence-provenance">Pulled {formatPulled(payload.pulledAt)}</span>
        {isLive && evidence.refreshInterval ? (
          <span className="report-evidence-provenance">Refresh {formatInterval(evidence.refreshInterval)}</span>
        ) : null}
      </footer>
    </section>
  )
}
