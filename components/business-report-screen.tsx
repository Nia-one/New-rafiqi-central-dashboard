import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { buildBusinessReportData } from "@/lib/live-mappers/business-report"
import { ENTERPRISE_PIPELINE_STAGES } from "@/lib/enterprise-pipeline-stage"
import { EnterpriseDemandSupplyScreen } from "@/components/enterprise-demand-supply-screen"

const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
const compactInr = (value: number) => value ? `₹${(value / 100_000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}L` : "Not recorded"

function ContributionWaterfall({ components, actual, pipeline }: { components: readonly { component: string; type: string; cmInr: number }[]; actual: number; pipeline: number }) {
  const order = ["Work", "Living", "B2B", "FONO", "Essentials", "ITC", "DLF", "Expected FONO", "Iztri"]
  const rows = order.flatMap((name) => components.filter((row) => row.component.toLowerCase() === name.toLowerCase()))
  const maximum = Math.max(1, actual + pipeline, ...rows.map((row) => Math.abs(row.cmInr)))
  return <article className="cm-waterfall-card"><h3>CM WATERFALL · ACTUALS TO COMBINED (Rs L)</h3><div className="cm-waterfall">{rows.map((row) => <div key={`${row.type}-${row.component}`}><b>{(row.cmInr / 100_000).toFixed(1)}</b><i className={row.type === "Pipeline" ? "pipeline" : "actual"} style={{ height: `${Math.max(6, Math.abs(row.cmInr) / maximum * 150)}px` }} /><span>{row.component}</span></div>)}<div className="total"><b>{((actual + pipeline) / 100_000).toFixed(1)}</b><i style={{ height: `${Math.max(6, (actual + pipeline) / maximum * 150)}px` }} /><span>Combined</span></div></div></article>
}

function Funnel({ title, values }: { title: string; values: readonly [string, number][] }) {
  const maximum = Math.max(1, ...values.map(([, value]) => value))
  return <article className="business-report-panel"><h3>{title}</h3><div className="business-funnel">{values.map(([label, value]) => <div key={label}><span>{label}</span><i><b style={{ width: `${Math.max(value ? 3 : 0, value / maximum * 100)}%` }} /></i><strong>{value.toLocaleString("en-IN")}</strong></div>)}</div></article>
}

function EnterpriseTheatrePerformance({ rows }: { rows: ReturnType<typeof buildBusinessReportData>["enterprise"]["byTheatre"] }) {
  const stages = ENTERPRISE_PIPELINE_STAGES
  const maxima = Object.fromEntries(stages.map((stage) => [stage, Math.max(1, ...rows.map((row) => row[stage]))])) as Record<(typeof stages)[number], number>
  return <div className="table-wrap enterprise-theatre-performance"><table>
    <caption className="sr-only">Enterprise demand stage performance by Theatre</caption>
    <thead><tr><th scope="col">THEATRE</th>{stages.map((stage) => <th className="numeric" scope="col" key={stage}>{stage.toUpperCase()}</th>)}<th className="numeric" scope="col">TOTAL</th></tr></thead>
    <tbody>{rows.map((row, rowIndex) => <tr key={row.theatre} style={{ animationDelay: `${rowIndex * 80}ms` }}><td className="first">{row.theatre}</td>{stages.map((stage) => <td className="numeric enterprise-stage-cell" key={stage}><span><i style={{ width: `${row[stage] / maxima[stage] * 100}%` }} /><b>{row[stage].toLocaleString("en-IN")}</b></span></td>)}<td className="numeric enterprise-theatre-total"><strong>{row.records.toLocaleString("en-IN")}</strong></td></tr>)}</tbody>
  </table></div>
}

function EssentialsAttachmentReport({ essentials }: { essentials: ReturnType<typeof buildBusinessReportData>["essentials"] }) {
  const theatreOrder = ["Rajputana", "Wellington", "Coromandel", "Deccan"]
  const rows = [...essentials.byTheatre]
    .sort((a, b) => {
      const ai = theatreOrder.indexOf(a.theatre)
      const bi = theatreOrder.indexOf(b.theatre)
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.theatre.localeCompare(b.theatre)
    })
    .map((row) => {
      // buildEssentialsReport already combines Essentials, Curry and
      // Internet & Equipment into buyingMembers and revenue.
      const buyers = row.buyingMembers
      const buyingValue = row.revenue
      return {
        ...row,
        buyers,
        buyingValue,
        attachPct: row.eligibleMembers ? Math.round(buyers / row.eligibleMembers * 1_000) / 10 : 0,
        attachRevenuePct: row.studioRevenue ? Math.round(buyingValue / row.studioRevenue * 10_000) / 100 : 0,
      }
    })
  const totalBuyers = rows.reduce((sum, row) => sum + row.buyers, 0)
  const totalBuyingValue = rows.reduce((sum, row) => sum + row.buyingValue, 0)
  const totalMembers = rows.reduce((sum, row) => sum + row.eligibleMembers, 0)
  const totalRevenue = rows.reduce((sum, row) => sum + row.studioRevenue, 0)
  const combinedAttach = totalMembers ? Math.round(totalBuyers / totalMembers * 1_000) / 10 : 0
  const combinedAttachRevenue = totalRevenue ? Math.round(totalBuyingValue / totalRevenue * 10_000) / 100 : 0
  const leaders = [...rows].sort((a, b) => b.attachPct - a.attachPct)
  const curryBuyers = rows.reduce((sum, row) => sum + row.curryUniqueMembers, 0)
  const internetEquipmentBuyers = rows.reduce((sum, row) => sum + row.internetEquipmentUniqueMembers, 0)
  const essentialsBuyers = totalBuyers - curryBuyers - internetEquipmentBuyers
  const curryBuyingValue = rows.reduce((sum, row) => sum + row.curryBuyingValue, 0)
  const internetEquipmentBuyingValue = rows.reduce((sum, row) => sum + row.internetEquipmentBuyingValue, 0)
  const essentialsBuyingValue = totalBuyingValue - curryBuyingValue - internetEquipmentBuyingValue

  return <section className="business-report-panel essentials-report-card">
    <div className="essentials-report-heading">
      <p className="pillar-kicker"><b>5</b> ESSENTIALS</p>
      <p>Combined attach is {combinedAttach.toFixed(1)}%. {leaders[0]?.theatre} leads at {leaders[0]?.attachPct.toFixed(1)}%, followed by {leaders[1]?.theatre} at {leaders[1]?.attachPct.toFixed(1)}%.</p>
    </div>
    <div className="essentials-report-grid">
      <div className="essentials-attach-chart">
        <h3>COMBINED ATTACH RATE BY THEATRE</h3>
        <div className="essentials-bars">{rows.map((row) => <div className="essentials-bar-row" key={row.theatre}>
          <strong>{row.theatre}</strong>
          <div className="essentials-bar-track"><i style={{ width: `${Math.min(100, row.attachPct)}%` }} /><span style={{ left: `${Math.min(100, combinedAttach)}%` }} /></div>
          <div><b>{row.attachPct.toFixed(1)}%</b><small>{row.buyers.toLocaleString("en-IN")} / {row.eligibleMembers.toLocaleString("en-IN")}</small></div>
        </div>)}</div>
        <small className="essentials-average">Group avg {combinedAttach.toFixed(1)}% · dashed line</small>
      </div>
      <div className="essentials-summary-table">
        <h3>ATTACHMENT SUMMARY</h3>
        <table><thead><tr><th>THEATRE</th><th>MEMBERS</th><th>BUYERS</th><th>ATTACH %</th><th>TOTAL BUYING VALUE Rs</th><th>REVENUE Rs</th><th>ATTACH REV %</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.theatre}><td>{row.theatre}</td><td>{row.eligibleMembers.toLocaleString("en-IN")}</td><td>{row.buyers.toLocaleString("en-IN")}</td><td>{row.attachPct.toFixed(1)}%</td><td>{Math.round(row.buyingValue).toLocaleString("en-IN")}</td><td>{Math.round(row.studioRevenue).toLocaleString("en-IN")}</td><td>{row.attachRevenuePct.toFixed(2)}%</td></tr>)}
          <tr className="essentials-total"><td>Grand total</td><td>{totalMembers.toLocaleString("en-IN")}</td><td>{totalBuyers.toLocaleString("en-IN")}</td><td>{combinedAttach.toFixed(1)}%</td><td>{Math.round(totalBuyingValue).toLocaleString("en-IN")}</td><td>{Math.round(totalRevenue).toLocaleString("en-IN")}</td><td>{combinedAttachRevenue.toFixed(2)}%</td></tr></tbody>
        </table>
      </div>
    </div>
    <div className="essentials-report-callout">
      <span>Combined attach uses {essentialsBuyers.toLocaleString("en-IN")} unique buyers + {curryBuyers.toLocaleString("en-IN")} Curry + {internetEquipmentBuyers.toLocaleString("en-IN")} Internet &amp; Equipment = {totalBuyers.toLocaleString("en-IN")} attachments.</span>
      <span>Total buying value includes ₹{Math.round(essentialsBuyingValue).toLocaleString("en-IN")} Essentials + ₹{Math.round(curryBuyingValue).toLocaleString("en-IN")} Curry + ₹{Math.round(internetEquipmentBuyingValue).toLocaleString("en-IN")} Internet &amp; Equipment = ₹{Math.round(totalBuyingValue).toLocaleString("en-IN")}.</span>
    </div>
  </section>
}

export function BusinessReportScreen({ liveOpsData }: { liveOpsData: any }) {
  const report = buildBusinessReportData(liveOpsData)
  const enterpriseMatches = (liveOpsData?.enterpriseDemandSupplyMatches ?? []).filter((row: any) => !row.dataIssue)
  const provisionalMatches = enterpriseMatches.filter((row: any) => row.rank === 1)
  const founderReadyMatches = provisionalMatches.filter((row: any) => String(row.verificationStatus ?? "").trim().toLowerCase() === "verified match" && String(row.verifiedProperty ?? "").trim().toLowerCase() === String(row.property ?? "").trim().toLowerCase() && Number.isFinite(row.verifiedDistanceKm) && Number.isFinite(row.verifiedBikeMinutes))
  const top = [
    ["GROUP OCCUPANCY", `${report.occupancy.percent}%`, `${report.occupancy.occupied.toLocaleString("en-IN")} / ${report.occupancy.contracted.toLocaleString("en-IN")} Nests filled`],
    ["VACANT NESTS", report.occupancy.vacant.toLocaleString("en-IN"), "Headroom to fill"],
    ["PROJECTED REVENUE", compactInr(report.projectedRevenue), "Governed billed and projected records"],
    ["CM ACTUALS", compactInr(report.contribution.actual), "Only explicitly recorded contribution"],
    ["CM INCL. PIPELINE", report.contribution.pipelineRecorded ? compactInr(report.contribution.actual + report.contribution.pipeline) : "Not recorded", "No governed pipeline CM input"],
    ["FONO COMMITTED NESTS", report.fono.stages.Contracted.toLocaleString("en-IN"), `${report.fono.stages.Contracting.toLocaleString("en-IN")} contracting · ${report.fono.stages.Lead.toLocaleString("en-IN")} lead`],
    ["ENTERPRISE RECORDS", report.enterprise.records.toLocaleString("en-IN"), `${report.enterprise.stages.Lead.toLocaleString("en-IN")} Lead`],
    ["ESSENTIALS ATTACH", `${report.essentials.attachPct}%`, `${report.essentials.buyingMembers.toLocaleString("en-IN")} / ${report.essentials.eligibleMembers.toLocaleString("en-IN")} eligible Members`],
  ] as const

  return <DashboardSectionAccordion className="pillar-screen business-report-screen" ariaLabel="Business Report sections" sections={[
    { title: "Board summary", summary: `Live report · updated ${report.asOf}` },
    { title: "Occupancy", summary: `${report.occupancy.percent}% · ${report.occupancy.vacant} vacant Nests` },
    { title: "Contribution margin", summary: report.contribution.actual ? `${compactInr(report.contribution.actual)} recorded actual CM` : "Governed CM values not recorded" },
    { title: "FONO pipeline", summary: `${report.fono.stages.Contracted.toLocaleString("en-IN")} contracted Nests` },
    { title: "Enterprise Demand", summary: `${report.enterprise.records} governed records` },
    { title: "Enterprise Demand vs Supply", summary: `${provisionalMatches.length} provisional · ${founderReadyMatches.length} Founder-ready` },
    { title: "Essentials", summary: `${report.essentials.attachPct}% live attach` },
    { title: "Source and controls", summary: "Existing normalized backend · read-only projection" },
  ]}>
    <section><div className="business-report-title"><div><span>ALL VERTICALS · OCCUPANCY · FONO · ENTERPRISE · ESSENTIALS · CM</span><h2>Nia · Business Report</h2></div><p>Updated {report.asOf}<br />Figures use governed live backend records</p></div><div className="business-kpi-strip">{top.map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div></section>
    <section className="business-report-panel"><p className="pillar-kicker">1 · OCCUPANCY</p><h2>{report.occupancy.percent}% group occupancy.</h2><div className="business-split"><DataTable caption="Live occupancy by Theatre" columns={["THEATRE", "STUDIOS", "CONTRACTED", "OCCUPIED", "VACANT", "OCCUPANCY"]} rows={report.occupancy.byTheatre.map((row) => [row.theatre, String(row.studios), row.contracted.toLocaleString("en-IN"), row.occupied.toLocaleString("en-IN"), row.vacant.toLocaleString("en-IN"), `${row.occupancyPct}%`])} /><DataTable caption="Living CM by Theatre" columns={["THEATRE", "LIVING CM"]} rows={report.contribution.livingByTheatre.length ? report.contribution.livingByTheatre.map((row) => [row.theatre, compactInr(row.cmInr)]) : [["No governed Theatre CM", "Not recorded"]]} /></div></section>
    <section className="business-report-panel"><p className="pillar-kicker">2 · CONTRIBUTION MARGIN</p><h2>{report.contribution.actual ? `${compactInr(report.contribution.actual)} actuals; ${report.contribution.pipelineRecorded ? `${compactInr(report.contribution.pipeline)} expected pipeline` : "pipeline not recorded"}.` : "Governed contribution margin is not recorded."}</h2><div className="business-split"><ContributionWaterfall components={report.contribution.components} actual={report.contribution.actual} pipeline={report.contribution.pipeline} /><DataTable caption="Closure and pipeline" columns={["COMPONENT", "TYPE", "CM", "REVENUE"]} rows={[...report.contribution.components.map((row) => [row.component, row.type, compactInr(row.cmInr), row.revenueInr ? compactInr(row.revenueInr) : "—"]), ["Total actuals", "Actual", compactInr(report.contribution.actual), "—"], ["Total pipeline", "Pipeline", report.contribution.pipelineRecorded ? compactInr(report.contribution.pipeline) : "Not recorded", "—"]]} /></div></section>
    <section className="business-report-panel"><p className="pillar-kicker">3 · FONO PIPELINE · NESTS</p><h2>{report.fono.stages.Lead.toLocaleString("en-IN")} Lead · {report.fono.stages.Contracting.toLocaleString("en-IN")} Contracting · {report.fono.stages.Contracted.toLocaleString("en-IN")} Contracted.</h2><div className="business-split"><Funnel title="Cumulative total" values={Object.entries(report.fono.stages) as [string, number][]} /><DataTable caption="FONO pipeline by Theatre" columns={["THEATRE", "LEAD", "CONTRACTING", "CONTRACTED", "TOTAL"]} rows={report.fono.byTheatre.map((row) => [row.theatre, row.Lead.toLocaleString("en-IN"), row.Contracting.toLocaleString("en-IN"), row.Contracted.toLocaleString("en-IN"), row.total.toLocaleString("en-IN")])} /></div></section>
    <section className="business-report-panel"><p className="pillar-kicker">4 · ENTERPRISE DEMAND</p><h2>{report.enterprise.records} demand records.</h2><div style={{ marginBottom: 24 }}><Funnel title="Demand conversion funnel" values={Object.entries(report.enterprise.stages) as [string, number][]} /></div><EnterpriseTheatrePerformance rows={report.enterprise.byTheatre} /></section>
    <EnterpriseDemandSupplyScreen rows={liveOpsData?.enterpriseDemandSupplyMatches ?? []} embedded />
    <EssentialsAttachmentReport essentials={report.essentials} />
    <section className="business-report-source"><strong>Source and controls</strong><p>Read-only projection of Living_Hourly, Enterprise_Demand, Work_Hourly, Finance_Daily and Essentials governed backend records. No manual board-report values are copied into production.</p></section>
  </DashboardSectionAccordion>
}
