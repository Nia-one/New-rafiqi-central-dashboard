import { AlertTriangle, CheckCircle2, Clock3, Database, FileCheck2 } from "lucide-react"
import { compactAge, LOOP_HEALTH_CRITICAL_MULTIPLIER, type LoopHealth } from "@/lib/operating-loop/loop-health"
import { dashboardDisplayLabel } from "@/lib/dashboard-model"

function FreshnessMeters({ health }: { health: LoopHealth }) {
  const stale = health.feeds.filter((feed) => feed.stale)
  if (stale.length === 0) return <p className="loop-health-note" data-tone="good">All feeds current</p>
  return <ul className="loop-health-meters">
    {stale.map((feed) => {
      const limit = feed.cadenceMinutes * LOOP_HEALTH_CRITICAL_MULTIPLIER
      const fillPct = Math.min(100, (feed.ageMinutes / limit) * 100)
      const tone = feed.criticalBeyondLimit ? "bad" : "warn"
      return <li key={feed.feedId}>
        <div className="loop-health-meter-head"><span>{dashboardDisplayLabel(feed.label)}</span><b data-tone={tone}>{compactAge(feed.ageMinutes)}</b></div>
        <div className="loop-health-meter-track" role="img" aria-label={`${feed.ageLabel}, cadence ${compactAge(feed.cadenceMinutes)}`}><i data-tone={tone} style={{ width: `${fillPct}%` }} /><span className="loop-health-meter-due" /></div>
      </li>
    })}
    {health.quarantinedRecords > 0 ? <li className="loop-health-note-row">{health.quarantinedRecords} row{health.quarantinedRecords === 1 ? "" : "s"} quarantined</li> : null}
  </ul>
}

function ClockMeters({ health }: { health: LoopHealth }) {
  const breached = health.clocks.filter((clock) => clock.breached)
  if (breached.length === 0) {
    const running = health.clocks.filter((clock) => clock.state === "Running").length
    return <p className="loop-health-note" data-tone="good">{running === 0 ? "No clocks running" : `${running} running, none breached`}</p>
  }
  const maxLate = Math.max(...breached.map((clock) => clock.agePastDueMinutes))
  return <ul className="loop-health-meters">
    {breached.map((clock) => {
      const fillPct = maxLate > 0 ? Math.min(100, (clock.agePastDueMinutes / maxLate) * 100) : 100
      return <li key={clock.clockId}>
        <div className="loop-health-meter-head"><span>{dashboardDisplayLabel(clock.label)}</span><b data-tone="bad">{compactAge(clock.agePastDueMinutes)} late</b></div>
        <div className="loop-health-meter-track" role="img" aria-label={`${compactAge(clock.agePastDueMinutes)} past due`}><i data-tone="bad" style={{ width: `${fillPct}%` }} /></div>
      </li>
    })}
  </ul>
}

function verificationSegments(health: LoopHealth) {
  const { verified, awaiting, reopened } = health.verification
  const segments = [
    { key: "verified", label: "Confirmed", value: verified, tone: "good" },
    { key: "awaiting", label: "Waiting", value: awaiting, tone: "warn" },
    { key: "reopened", label: "Reopened", value: reopened, tone: "bad" },
  ] as const
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return { segments, total }
}

function VerificationChart({ health }: { health: LoopHealth }) {
  const { segments, total } = verificationSegments(health)
  return <div className="loop-health-verify">
    <div className="loop-health-verify-headline"><b>{health.verification.verified} of {health.verification.claimed}</b><span>outcomes independently confirmed</span></div>
    <div className="loop-health-verify-bar" role="img" aria-label={segments.map((segment) => `${segment.value} ${segment.label}`).join(", ")}>
      {total === 0
        ? <i data-tone="empty" style={{ width: "100%" }} />
        : segments.filter((segment) => segment.value > 0).map((segment) => <i key={segment.key} data-tone={segment.tone} style={{ width: `${(segment.value / total) * 100}%` }} />)}
    </div>
    <ul className="loop-health-verify-legend">
      {segments.map((segment) => <li key={segment.key} data-tone={segment.tone}><i aria-hidden />{segment.label}<b>{segment.value}</b></li>)}
    </ul>
  </div>
}

export function LoopHealthStrip({ health, id }: { health: LoopHealth; id?: string }) {
  const StateIcon = health.state === "Cannot confirm" ? AlertTriangle : health.state === "Confirmed" ? CheckCircle2 : Clock3
  const needsAttention = health.state !== "Confirmed" || health.quarantinedRecords > 0 || health.verification.awaiting > 0 || health.verification.reopened > 0
  const staleFeeds = health.feeds.filter((feed) => feed.stale).length
  const breachedClocks = health.clocks.filter((clock) => clock.breached).length
  const confidenceSummary = [
    staleFeeds === 0 ? "Data current" : `${staleFeeds} stale feed${staleFeeds === 1 ? "" : "s"}`,
    breachedClocks === 0 ? "No overdue clocks" : `${breachedClocks} overdue clock${breachedClocks === 1 ? "" : "s"}`,
    `${health.verification.verified} of ${health.verification.claimed} outcomes confirmed`,
  ].join(" · ")
  return <section className={`loop-health-strip is-${health.state.toLowerCase().replaceAll(" ", "-")}`} id={id} aria-label="How reliable is data" data-overview-answer-allowed={health.overviewAnswerAllowed}>
    <header><StateIcon aria-hidden /><strong>How reliable is data</strong><span>{health.state}</span><small>{confidenceSummary}</small></header>
    <details open={needsAttention || undefined}><summary>{needsAttention ? "Check issues" : "View details"}</summary><div className="loop-health-details">
      <div className="loop-health-callout"><Database aria-hidden /><div><strong>Data freshness</strong><FreshnessMeters health={health} /></div></div>
      <div className="loop-health-callout"><Clock3 aria-hidden /><div><strong>Clocks running</strong><ClockMeters health={health} /></div></div>
      <div className="loop-health-callout"><FileCheck2 aria-hidden /><div><strong>Outcome checks</strong><VerificationChart health={health} /></div></div>
    </div></details>
  </section>
}
