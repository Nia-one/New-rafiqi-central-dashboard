import { ArrowRight, Clock3, Database, RefreshCw, ShieldCheck } from "lucide-react"
import { buildLivingSupplyPreview, livingOccupancyBand, type GovernedMetricValue, type LivingSupplyPolicies } from "@/lib/operating-loop/living-supply-model"

const number = (value: number) => value.toLocaleString("en-IN")
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`
const percent = (value: number) => `${Math.round(value * 100)}%`

// "SP" is the governed data key, but it is opaque to new joiners, so the rest of the
// Living surface already reads "Shram Park". This maps the stored supply_model to the
// human label without touching the data value the CSS and lineage still key on.
const MODEL_LABELS: Record<string, string> = { FONO: "FONO", SP: "Shram Park", Combined: "COMBINED" }
const modelLabel = (supplyModel: string) => MODEL_LABELS[supplyModel] ?? supplyModel

// Renders the contracted -> ready -> occupied -> paying funnel as four shrinking bars
// with the counts kept alongside. Consolidating the four numeric columns into one keeps
// the table inside its width, and the worst stage-to-stage drop is flagged so the leak is
// obvious without reading every figure.
function funnelCell(contracted: number, ready: number, occupied: number, paying: number) {
  const base = Math.max(1, contracted)
  const stages = [
    { key: "contracted", label: "Contracted", value: contracted },
    { key: "ready", label: "Ready", value: ready },
    { key: "occupied", label: "Occupied", value: occupied },
    { key: "paying", label: "Paying", value: paying },
  ] as const
  let leakIndex = -1
  let worstDrop = 0
  for (let i = 1; i < stages.length; i += 1) {
    const drop = stages[i - 1].value - stages[i].value
    if (drop > worstDrop) {
      worstDrop = drop
      leakIndex = i
    }
  }
  const conversion = Math.round((paying / base) * 100)
  const label = `Supply funnel: ${number(contracted)} contracted, ${number(ready)} ready, ${number(occupied)} occupied, ${number(paying)} paying. ${conversion}% contracted to paying.`
  return (
    <td className="living-funnel">
      <span className="living-funnel-bars" role="img" aria-label={label}>
        {stages.map((stage, index) => (
          <span className="living-funnel-row" key={stage.key} data-leak={index === leakIndex ? "" : undefined}>
            <small>{stage.label}</small>
            <i className="living-funnel-track"><b data-stage={stage.key} style={{ width: `${Math.round((stage.value / base) * 100)}%` }} /></i>
            <strong>{number(stage.value)}</strong>
          </span>
        ))}
      </span>
    </td>
  )
}

function metric(metric: GovernedMetricValue, format: "percent" | "money") {
  if (metric.state === "No data" || metric.value === null) return <span className="living-no-data"><strong>No data</strong><small>Source coverage absent</small></span>
  return <span className="living-metric-value"><strong>{format === "percent" ? percent(metric.value) : money(metric.value)}</strong><small>{metric.definitionRef}</small></span>
}

function occupancyCell(value: GovernedMetricValue, policies: LivingSupplyPolicies) {
  if (value.state === "No data" || value.value === null) return <span className="living-no-data"><strong>No data</strong><small>Source coverage absent</small></span>
  const pct = Math.round(value.value * 100)
  return <span className="living-occupancy" data-band={livingOccupancyBand(value.value, policies)}>
    <strong>{pct}%</strong>
    <span className="living-occupancy-bar" role="img" aria-label={`Occupancy ${pct} percent`}><i style={{ width: `${pct}%` }} /></span>
    <small>{value.definitionRef}</small>
  </span>
}

function Readiness({ state }: { state: string }) {
  return <span className={`living-readiness state-${state.toLowerCase().replaceAll(" ", "-")}`}>{state}</span>
}

export function LivingSupplyModelReport() {
  const preview = buildLivingSupplyPreview()
  const { report, policies } = preview
  const combined = report.combined
  return <section className="living-supply-report" aria-labelledby="living-supply-report-title">
    <header className="living-supply-report-head">
      <div>
        <p className="section-kicker">LIVING REPORT · GOVERNED SUPPLY VIEW</p>
        <h2 id="living-supply-report-title">FONO first. Shram Park second. Then the combined Living view.</h2>
        <p>Both channels refresh independently from Studio Master before any combined roll-up is allowed.</p>
      </div>
      <dl>
        <div><dt><RefreshCw /> Refresh</dt><dd>17 Jul · 08:00</dd></div>
        <div><dt><ShieldCheck /> Mode</dt><dd>{report.mode}</dd></div>
      </dl>
    </header>

    <ol className="living-refresh-order" aria-label="Required Living report refresh order">
      <li><span>01</span><strong>FONO</strong><small>Franchise-owned supply</small></li>
      <li aria-hidden><ArrowRight /></li>
      <li><span>02</span><strong>Shram Park</strong><small>Nia-capital-exposed parks</small></li>
      <li aria-hidden><ArrowRight /></li>
      <li><span>03</span><strong>COMBINED</strong><small>Only after both are visible</small></li>
    </ol>

    <div className="living-supply-table-card">
    <div className="living-supply-table-wrap" tabIndex={0} role="region" aria-label="Living FONO and SP report table">
      <table className="living-supply-table">
        <caption className="sr-only">Living report with FONO first, SP second, and the combined roll-up last</caption>
        <thead><tr><th scope="col">SUPPLY MODEL</th><th scope="col">SUPPLY FUNNEL</th><th scope="col">OCCUPANCY</th><th scope="col">BILLED ARPU</th><th scope="col">COLLECTION LEAKAGE</th><th scope="col">CM1</th><th scope="col">CM2</th></tr></thead>
        <tbody>{report.channels.map((channel, index) => <tr key={channel.supplyModel} data-supply-model={channel.supplyModel}>
          <th scope="row"><span>{String(index + 1).padStart(2, "0")}</span><strong>{modelLabel(channel.supplyModel)}</strong><small>{channel.studioCount} governed Studios</small></th>
          {funnelCell(channel.contractedNests, channel.activationReadyNests, channel.occupiedNests, channel.payingNests)}
          <td>{occupancyCell(channel.occupancy, policies)}</td><td>{metric(channel.billedArpu, "money")}</td><td>{metric(channel.collectionLeakage, "money")}</td><td>{metric(channel.cm1, "money")}</td><td>{metric(channel.cm2, "money")}</td>
        </tr>)}</tbody>
        {combined && <tfoot><tr data-supply-model="Combined"><th scope="row"><span>03</span><strong>COMBINED</strong><small>FONO + Shram Park, shown last</small></th>
          {funnelCell(combined.contractedNests, combined.activationReadyNests, combined.occupiedNests, combined.payingNests)}
          <td>{occupancyCell(combined.occupancy, policies)}</td><td>{metric(combined.billedArpu, "money")}</td><td>{metric(combined.collectionLeakage, "money")}</td><td>{metric(combined.cm1, "money")}</td><td>{metric(combined.cm2, "money")}</td>
        </tr></tfoot>}
      </table>
    </div>
    </div>

    <div className="living-channel-detail-grid">
      <article className="living-channel-detail fono-detail">
        <header><div><p className="section-kicker">01 · FONO</p><h3>Who filled occupied Nests?</h3></div><strong>{report.channels[0] ? percent(report.channels[0].occupancy.value ?? 0) : "No data"}<small>occupancy</small></strong></header>
        <div className="fono-source-bars">
          <div><span>Franchisee-sourced Members</span><strong>{number(report.fono?.franchiseeSourcedMembers ?? 0)}</strong><i style={{ width: `${Math.round(((report.fono?.franchiseeSourcedMembers ?? 0) / Math.max(1, (report.fono?.franchiseeSourcedMembers ?? 0) + (report.fono?.niaFilledMembers ?? 0))) * 100)}%` }} /></div>
          <div><span>Nia-filled Members</span><strong>{number(report.fono?.niaFilledMembers ?? 0)}</strong><i style={{ width: `${Math.round(((report.fono?.niaFilledMembers ?? 0) / Math.max(1, (report.fono?.franchiseeSourcedMembers ?? 0) + (report.fono?.niaFilledMembers ?? 0))) * 100)}%` }} /></div>
        </div>
        <dl><div><dt>Vacant Nests at cycle start</dt><dd>{number(report.fono?.vacantNestsAtCycleStart ?? 0)}</dd></div><div><dt>Nia fill rate</dt><dd>{report.fono ? metric(report.fono.niaFillRate, "percent") : "No data"}</dd></div></dl>
      </article>

      <article className="living-channel-detail sp-detail">
        <header><div><p className="section-kicker">02 · SHRAM PARK</p><h3>Capital-exposed capacity by park</h3></div><strong>{report.spParks.length}<small>parks</small></strong></header>
        <div className="living-sp-table-wrap" tabIndex={0} role="region" aria-label="SP park readiness">
          <table><thead><tr><th>PARK</th><th>BUILD</th><th>HARDWARE</th><th>SUKH</th><th>UFD</th><th>COVERAGE</th><th>CAPEX</th></tr></thead><tbody>{report.spParks.map((park) => <tr key={park.studioId}><th scope="row"><strong>{park.studioName}</strong><small>{park.blockingMilestone}</small></th><td><Readiness state={park.readiness.buildOut} /></td><td><Readiness state={park.readiness.hardwareAmenities} /></td><td><Readiness state={park.readiness.sukh} /></td><td><Readiness state={park.readiness.ufd} /></td><td>{metric(park.contractCoverage, "percent")}</td><td><strong>{money(park.capexExposureInr)}</strong><small>{number(park.enterpriseContractCoveredNests)} / {number(park.activationReadyNests)} covered / ready</small></td></tr>)}</tbody></table>
        </div>
      </article>
    </div>

    <div className="living-route-grid">
      {preview.routes.map((event, index) => <article key={event.eventId} data-supply-model={event.supplyModel}>
        <span>{String(index + 1).padStart(2, "0")} · {modelLabel(event.supplyModel).toUpperCase()} GAP</span>
        <strong>{event.route.primaryRoute}</strong>
        <p>{event.route.blockingMilestone}</p>
        <small><Clock3 /> Escalate after {event.route.escalationAfterCycles} unresolved {event.route.escalationAfterCycles === 1 ? "cycle" : "cycles"} · {event.route.escalationOwner}</small>
      </article>)}
      <aside><Database /><div><strong>Studio Master is authoritative.</strong><span>Missing or conflicting supply_model is quarantined. No name inference.</span><small>Lineage visible: Studio_Master rows 3, 5 (FONO) · 2, 4 (Shram Park). {policies.policyVersions.join(" · ")} · Provisional; {policies.calibrationNote}.</small></div></aside>
    </div>
  </section>
}
