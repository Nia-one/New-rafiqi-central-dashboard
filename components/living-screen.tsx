import { ArrowDown, ArrowRight } from "lucide-react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { DemandProximityWorkspace } from "@/components/demand-proximity-workspace"
import { LivingSupplyModelReport } from "@/components/living-supply-model-report"
import type { LivingSection } from "@/lib/dashboard-model"
import { buildLivingScreenData } from "@/lib/live-mappers/living-screen"

function PacingCard({ channel, actual, owner }: { channel: string; actual: number; owner: string }) {
  const target = 2000, elapsed = 14, days = 31, left = days - elapsed
  const runRate = Math.round(actual / elapsed * days), variance = runRate - target
  return <article className="pacing-card"><span>{channel} · MONTH SO FAR</span><strong>{actual.toLocaleString("en-IN")} <small>/ 2,000 Members</small></strong><div><p><b>{left}</b> days left</p><p><b>{runRate.toLocaleString("en-IN")}</b> month-end estimate</p><p><b>{Math.abs(variance).toLocaleString("en-IN")}</b> {variance >= 0 ? "ahead" : "gap"} · {Math.round(Math.abs(variance)/target*100)}%</p></div><small>Owner: {owner} · based on the current daily pace</small></article>
}

export function LivingScreen({ focus, allocationFocus, liveOpsData }: { focus?: LivingSection; allocationFocus?: string; liveOpsData?: unknown }) {
  const live = buildLivingScreenData(liveOpsData ?? {})
  const openDemandNodes = live.proximityNodes.filter(node => node.status !== "Matched")
  const occupancyRows = live.occupancyRows
  const demandRows = live.demandRows
  const supplyRows = live.supplyRows
  return <DashboardSectionAccordion className="pillar-screen living-screen" ariaLabel="Living sections" sections={[
    { title: "Main point", summary: "Named demand should become occupied Nests." },
    { title: "Allocation context", summary: "Review the active allocation mismatch and evidence." },
    { title: "Supply model", summary: "FONO and Śram Park operating model comparison." },
    { title: "Monthly pacing", summary: "FONO 920 · Śram Park 862 Members." },
    { title: "FONO", summary: "68 Studio visits produced 7 live Studios this month." },
    { title: "Śram Park demand", summary: `${demandRows.length} factory demand records` },
    { title: "Śram Park supply", summary: `${openDemandNodes.length} open demand nodes need nearby options` },
    { title: "Living summary", summary: "Demand and occupied Nests are both 18% below plan." },
  ]}><div className="decision-bar living-headline"><div><span>MAIN POINT</span><strong>Named demand should become occupied Nests.</strong></div><p>Compare both channels by Theatre, Studio, and activation date.</p></div><AllocationContextStrip mismatchId={allocationFocus} />
    <LivingSupplyModelReport preview={null} />
    <div className="pacing-grid"><PacingCard channel="FONO" actual={live.fonoOccupied} owner={live.metricOwner("fono_owner")} /><PacingCard channel="Śram Park" actual={live.demandMatched} owner={live.metricOwner("sp_owner")} /></div>
    <section id="fono" className={`operating-section ${focus === "fono" ? "focused-section" : ""}`}>
      <p className="pillar-kicker">ACQUISITION CHANNEL 01</p>
      <h2>FONO (Franchise Owned, Nia Operated)</h2>
      <p className="section-intro">The Franchise Acquisition team opens Studios. Theatre ops fills Nests from the start.</p>
      <div className="channel-grid fono-channel-grid">
        <div className="fono-channel-chart semantic-supply">
          <div className="fono-channel-heading"><h3>68 Studio visits led to 7 live Studios this month.</h3><p className="chart-reads"><span>What this chart shows</span>This chart shows how Studios and Nests move through each FONO stage.</p></div>
          <TodayMtdFunnel stages={live.fonoSupply} />
        </div>
        <div className="fono-channel-chart semantic-demand">
          <div className="fono-channel-heading"><h3>FONO is turning open Nests into active Members.</h3><p className="chart-reads"><span>What this chart shows</span>This chart shows how named needs become active Members. The table shows each Studio's occupancy.</p></div>
          <TodayMtdFunnel stages={live.fonoDemand} />
        </div>
        {!occupancyRows.length && <p className="footer-note">No governed FONO occupancy records are available.</p>}
        <DataTable className="compact-table occupancy-table" caption="FONO Studio occupancy" columns={["STUDIO","THEATRE","AVAILABLE","OCCUPIED","OCCUPANCY","DAYS LIVE","THEATRE OPS OWNER"]} rows={occupancyRows} />
      </div>
    </section>
    <section id="demand" className={`operating-section semantic-demand ${focus === "demand" ? "focused-section" : ""}`}><p className="pillar-kicker">ŚRAM PARK · DEMAND</p><h2>JCO records each factory's need from the start.</h2><TodayMtdFunnel stages={live.demandStages} /><DataTable caption="Śram Park demand by factory" columns={["FACTORY","MEMBERS","THEATRE","ACTIVATION","JCO","LOGGED","AGING / MATCH"]} rows={demandRows} /></section>
    <section id="supply" className={`operating-section semantic-supply ${focus === "supply" ? "focused-section" : ""}`}><p className="pillar-kicker">ŚRAM PARK · SUPPLY</p><h2>RM finds Nests for each need the JCO records.</h2><p className="section-intro">Use an option only if it is within 2km and found within 24 hours.</p><TodayMtdFunnel stages={live.supplyStages} /><DataTable caption="Śram Park supply options by factory" columns={["FACTORY","JCO","RELATIONSHIP MANAGER","OPTION","DISTANCE","RESPONSE","RULE"]} rows={supplyRows} /><div className="proximity-section"><header><div><h3>Open demand and its nearest SP options.</h3><p className="chart-reads"><span>What this chart shows</span>Pick an open demand node to see its supply options placed by distance. Needs-action demand is listed first.</p></div><p>Matched demand drops from this view.</p></header><DemandProximityWorkspace nodes={openDemandNodes} /></div></section>
    <section id="reconciliation" className={`living-section ${focus === "reconciliation" ? "focused-section" : ""}`}><p className="pillar-kicker">LIVING SUMMARY</p><h2>{live.metricTemplate("living_summary", "Demand should become verified occupied Nests.")}</h2><p className="chart-reads"><span>What this chart shows</span>This chart follows demand to live capacity and then occupied Nests.</p><div className="reconciliation-strip"><article className="semantic-demand"><span>LIVE DEMAND</span><strong>{live.demandRequired}</strong><small>Sheet-derived governed demand</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article className="semantic-supply"><span>LIVE CAPACITY</span><strong>{live.fonoReady + live.spReady}</strong><small>Activation-ready Nests</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article><span>OCCUPIED NESTS</span><strong>{live.occupancyOccupied}</strong><small>{`${live.occupancyPercent}% of contracted`}</small></article></div></section>
  </DashboardSectionAccordion>
}
