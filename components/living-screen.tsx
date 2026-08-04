import { ArrowDown, ArrowRight } from "lucide-react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { DemandProximityWorkspace } from "@/components/demand-proximity-workspace"
import { LivingSupplyModelReport } from "@/components/living-supply-model-report"
import type { LivingSection } from "@/lib/dashboard-model"
import { demandProximityNodes, fonoOccupancy, fonoSupply, shramDemand, shramSupply, teamBlocks } from "@/lib/operating-data"
import { buildLivingScreenData } from "@/lib/live-mappers/living-screen"

function PacingCard({ channel, actual, owner }: { channel: string; actual: number; owner: string }) {
  const target = 2000, elapsed = 14, days = 31, left = days - elapsed
  const runRate = Math.round(actual / elapsed * days), variance = runRate - target
  return <article className="pacing-card"><span>{channel} · MONTH SO FAR</span><strong>{actual.toLocaleString("en-IN")} <small>/ 2,000 Members</small></strong><div><p><b>{left}</b> days left</p><p><b>{runRate.toLocaleString("en-IN")}</b> month-end estimate</p><p><b>{Math.abs(variance).toLocaleString("en-IN")}</b> {variance >= 0 ? "ahead" : "gap"} · {Math.round(Math.abs(variance)/target*100)}%</p></div><small>Owner: {owner} · based on the current daily pace</small></article>
}

export function LivingScreen({ focus, allocationFocus, liveOpsData }: { focus?: LivingSection; allocationFocus?: string; liveOpsData?: unknown }) {
  const live = liveOpsData ? buildLivingScreenData(liveOpsData) : null
  const fonoTeam = teamBlocks.find(t => t.name === "FONO Supply")!, fonoDemand = teamBlocks.find(t => t.name === "FONO Demand")!, demandTeam = teamBlocks.find(t => t.name === "Śram Park Demand")!, supplyTeam = teamBlocks.find(t => t.name === "Śram Park Supply")!
  const openDemandNodes = (live ? live.proximityNodes : demandProximityNodes).filter(node => node.status !== "Matched")
  const occupancyRows = live ? live.occupancyRows : fonoOccupancy
  const demandRows = live ? live.demandRows : shramDemand
  const supplyRows = live ? live.supplyRows : shramSupply
  return <DashboardSectionAccordion className="pillar-screen living-screen" ariaLabel="Living sections" sections={[
    { title: "Main point", summary: "Named demand should become occupied Nests." },
    { title: "Allocation context", summary: "Review the active allocation mismatch and evidence." },
    { title: "Supply model", summary: "FONO and Śram Park operating model comparison." },
    { title: "Monthly pacing", summary: "FONO 920 · Śram Park 862 Members." },
    { title: "FONO", summary: "68 Studio visits produced 7 live Studios this month." },
    { title: "Śram Park demand", summary: `${shramDemand.length} factory demand records` },
    { title: "Śram Park supply", summary: `${openDemandNodes.length} open demand nodes need nearby options` },
    { title: "Living summary", summary: "Demand and occupied Nests are both 18% below plan." },
  ]}><div className="decision-bar living-headline"><div><span>MAIN POINT</span><strong>Named demand should become occupied Nests.</strong></div><p>Compare both channels by Theatre, Studio, and activation date.</p></div><AllocationContextStrip mismatchId={allocationFocus} />
    <LivingSupplyModelReport preview={null} />
    <div className="pacing-grid"><PacingCard channel="FONO" actual={live?.fonoOccupied ?? 920} owner={live?.metricOwner("fono_owner") ?? "Franchise Acquisition + Theatre ops"} /><PacingCard channel="Śram Park" actual={live?.demandMatched ?? 862} owner={live?.metricOwner("sp_owner") ?? "JCO + RM teams"} /></div>
    <section id="fono" className={`operating-section ${focus === "fono" ? "focused-section" : ""}`}>
      <p className="pillar-kicker">ACQUISITION CHANNEL 01</p>
      <h2>FONO (Franchise Owned, Nia Operated)</h2>
      <p className="section-intro">The Franchise Acquisition team opens Studios. Theatre ops fills Nests from the start.</p>
      <div className="channel-grid fono-channel-grid">
        <div className="fono-channel-chart semantic-supply">
          <div className="fono-channel-heading"><h3>68 Studio visits led to 7 live Studios this month.</h3><p className="chart-reads"><span>What this chart shows</span>This chart shows how Studios and Nests move through each FONO stage.</p></div>
          <TodayMtdFunnel stages={live?.fonoSupply ?? fonoTeam.stages} />
        </div>
        <div className="fono-channel-chart semantic-demand">
          <div className="fono-channel-heading"><h3>FONO is turning open Nests into active Members.</h3><p className="chart-reads"><span>What this chart shows</span>This chart shows how named needs become active Members. The table shows each Studio's occupancy.</p></div>
          <TodayMtdFunnel stages={live?.fonoDemand ?? fonoDemand.stages} />
        </div>
        <ol className="fono-funnel" aria-label="FONO supply stages">{fonoSupply.map((item,index) => <li key={item.stage}><span className="fono-stage-rank">{String(index+1).padStart(2,"0")}</span><strong className="fono-stage-name">{item.stage}</strong><span><b>{item.studios}</b> Studios</span><span><b>{item.nests.toLocaleString("en-IN")}</b> Nests</span><span><b>{item.conversion === null ? "No data" : `${item.conversion}%`}</b> conversion</span><span className="fono-stage-owner"><b>{item.owner}</b> owner</span></li>)}</ol>
        <DataTable className="compact-table occupancy-table" caption="FONO Studio occupancy" columns={["STUDIO","THEATRE","AVAILABLE","OCCUPIED","OCCUPANCY","DAYS LIVE","THEATRE OPS OWNER"]} rows={occupancyRows} />
      </div>
    </section>
    <section id="demand" className={`operating-section semantic-demand ${focus === "demand" ? "focused-section" : ""}`}><p className="pillar-kicker">ŚRAM PARK · DEMAND</p><h2>JCO records each factory's need from the start.</h2><TodayMtdFunnel stages={live?.demandStages ?? demandTeam.stages} /><DataTable caption="Śram Park demand by factory" columns={["FACTORY","MEMBERS","THEATRE","ACTIVATION","JCO","LOGGED","AGING / MATCH"]} rows={demandRows} /></section>
    <section id="supply" className={`operating-section semantic-supply ${focus === "supply" ? "focused-section" : ""}`}><p className="pillar-kicker">ŚRAM PARK · SUPPLY</p><h2>RM finds Nests for each need the JCO records.</h2><p className="section-intro">Use an option only if it is within 2km and found within 24 hours.</p><TodayMtdFunnel stages={live?.supplyStages ?? supplyTeam.stages} /><DataTable caption="Śram Park supply options by factory" columns={["FACTORY","JCO","RELATIONSHIP MANAGER","OPTION","DISTANCE","RESPONSE","RULE"]} rows={supplyRows} /><div className="proximity-section"><header><div><h3>Open demand and its nearest SP options.</h3><p className="chart-reads"><span>What this chart shows</span>Pick an open demand node to see its supply options placed by distance. Needs-action demand is listed first.</p></div><p>Matched demand drops from this view.</p></header><DemandProximityWorkspace nodes={openDemandNodes} /></div></section>
    <section id="reconciliation" className={`living-section ${focus === "reconciliation" ? "focused-section" : ""}`}><p className="pillar-kicker">LIVING SUMMARY</p><h2>{live?.metricTemplate("living_summary", "Demand should become verified occupied Nests.") ?? "Demand and occupied Nests are both 18% below plan."}</h2><p className="chart-reads"><span>What this chart shows</span>This chart follows demand to live capacity and then occupied Nests.</p><div className="reconciliation-strip"><article className="semantic-demand"><span>LIVE DEMAND</span><strong>{live?.demandRequired ?? 862}</strong><small>Sheet-derived governed demand</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article className="semantic-supply"><span>LIVE CAPACITY</span><strong>{(live?.fonoReady ?? 920) + (live?.spReady ?? 0)}</strong><small>Activation-ready Nests</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article><span>OCCUPIED NESTS</span><strong>{live?.occupancyOccupied ?? 804}</strong><small>{live ? `${live.occupancyPercent}% of contracted` : "Plan 980 · 82%"}</small></article></div></section>
  </DashboardSectionAccordion>
}
