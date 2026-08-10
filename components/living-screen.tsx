import { ArrowDown, ArrowRight } from "lucide-react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { DemandProximityWorkspace } from "@/components/demand-proximity-workspace"
import { LivingSupplyModelReport } from "@/components/living-supply-model-report"
import type { LivingSection } from "@/lib/dashboard-model"
import { buildLivingScreenData } from "@/lib/live-mappers/living-screen"

function PacingCard({ channel, actual, target, owner }: { channel: string; actual: number; target: number; owner: string }) {
  const elapsed = Math.max(1, new Date().getDate()), days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(), left = days - elapsed
  const remaining = Math.max(0, target - actual), completion = target > 0 ? Math.round(actual / target * 100) : 0
  return <article className="pacing-card"><span>{channel} · CURRENT POSITION</span><strong>{actual.toLocaleString("en-IN")} <small>/ {target.toLocaleString("en-IN")} Members</small></strong><div><p><b>{left}</b> days left</p><p><b>{remaining.toLocaleString("en-IN")}</b> remaining</p><p><b>{completion}%</b> complete</p></div><small>Owner: {owner} · governed current-state readback</small></article>
}

export function LivingScreen({ focus, allocationFocus, liveOpsData = {} }: { focus?: LivingSection; allocationFocus?: string; liveOpsData?: any }) {
  const live = buildLivingScreenData(liveOpsData)
  const fonoTeam = { stages: live.fonoSupply }, fonoDemand = { stages: live.fonoRequirementStages }, demandTeam = { stages: live.demandStages }, supplyTeam = { stages: live.supplyStages }
  const fonoStudioCounts = [live.fonoStudioCount, live.fonoReadyStudioCount, live.fonoOccupiedStudioCount]
  const fonoSupply = live.fonoSupply.map((item, index) => ({ stage: item.label, studios: fonoStudioCounts[index] ?? 0, nests: item.mtd, conversion: item.mtdConversion, owner: live.fonoOwner }))
  const fonoOccupancy = live.occupancyRows
  const shramDemand = live.demandRows
  const shramSupply = live.supplyRows
  const openDemandNodes = live.proximityNodes.filter(node => node.status !== "Matched")
  const shramGap = Math.max(0, live.demandRequired - live.demandMatched)
  // Keep the headline vertical-specific: FONO occupancy is not Shram Park output.
  const mainPoint = live.demandRequired > 0
    ? `${live.demandMatched.toLocaleString("en-IN")} of ${live.demandRequired.toLocaleString("en-IN")} named Śram Park demand records are matched; ${shramGap.toLocaleString("en-IN")} remain unmatched.`
    : "No governed Śram Park demand records are available."
  return <DashboardSectionAccordion className="pillar-screen living-screen" ariaLabel="Living sections" sections={[
    { title: "Main point", summary: mainPoint },
    { title: "Allocation context", summary: "Review the active allocation mismatch and evidence." },
    { title: "Supply model", summary: "FONO and Śram Park operating model comparison." },
    { title: "Monthly pacing", summary: `FONO ${live.fonoOccupied.toLocaleString("en-IN")} · Śram Park ${live.demandMatched.toLocaleString("en-IN")} Members.` },
    { title: "FONO", summary: `${live.fonoSupply[0]?.mtd ?? 0} contracted Nests are tracked this month.` },
    { title: "Śram Park demand", summary: `${shramDemand.length} factory demand records` },
    { title: "Śram Park supply", summary: `${openDemandNodes.length} open demand nodes need nearby options` },
    { title: "Existing occupancy", summary: `${live.existingOccupied.toLocaleString("en-IN")} occupied of ${live.existingContracted.toLocaleString("en-IN")} contracted Nests.` },
    { title: "Living summary", summary: `${live.occupancyOccupied.toLocaleString("en-IN")} occupied of ${live.occupancyContracted.toLocaleString("en-IN")} contracted Nests.` },
  ]}><div className="decision-bar living-headline"><div><span>MAIN POINT</span><strong>{mainPoint}</strong></div><p>Automatically reconciled only from governed Śram Park demand and matching records.</p></div><AllocationContextStrip mismatchId={allocationFocus} live={{ channel: "ŚRAM PARK", issue: `${shramGap.toLocaleString("en-IN")} named demand records remain unmatched`, owner: live.metricOwner("shram_owner"), current: `${live.demandMatched.toLocaleString("en-IN")} matched`, target: `${live.demandRequired.toLocaleString("en-IN")} named demand`, gap: `${shramGap.toLocaleString("en-IN")} demand-to-Nest gap`, updated: String(liveOpsData?.meta?.updatedAt || liveOpsData?.fetchedAt || "current refresh"), action: "Convert named Śram Park demand into governed matched and occupied Nests." }} />
    <LivingSupplyModelReport liveData={live} refreshedAt={liveOpsData?.fetchedAt || liveOpsData?.meta?.updatedAt} />
    <div className="pacing-grid"><PacingCard channel="FONO" actual={live.fonoOccupied} target={live.fonoReady} owner={live.fonoOwner} /><PacingCard channel="Śram Park" actual={live.demandMatched} target={live.demandRequired} owner={live.metricOwner("shram_owner")} /></div>
    <section id="fono" className={`operating-section ${focus === "fono" ? "focused-section" : ""}`}>
      <p className="pillar-kicker">ACQUISITION CHANNEL 01</p>
      <h2>FONO (Franchise Owned, Nia Operated)</h2>
      <p className="section-intro">The Franchise Acquisition team opens Studios. Theatre ops fills Nests from the start.</p>
      <div className="channel-grid fono-channel-grid">
        <div className="fono-channel-chart semantic-supply">
          <div className="fono-channel-heading"><h3>{live.fonoSupply[0]?.mtd ?? 0} contracted Nests are moving through the FONO supply funnel.</h3><p className="chart-reads"><span>What this chart shows</span>This chart shows how Studios and Nests move through each FONO stage.</p></div>
          <TodayMtdFunnel stages={fonoTeam.stages} />
        </div>
        <div className="fono-channel-chart semantic-demand">
          <div className="fono-channel-heading"><h3>FONO is turning open Nests into active Members.</h3><p className="chart-reads"><span>What this chart shows</span>This chart shows how named needs become active Members. The table shows each Studio's occupancy.</p></div>
          <TodayMtdFunnel stages={fonoDemand.stages} />
        </div>
        <ol className="fono-funnel" aria-label="FONO supply stages">{fonoSupply.map((item,index) => <li key={item.stage}><span className="fono-stage-rank">{String(index+1).padStart(2,"0")}</span><strong className="fono-stage-name">{item.stage}</strong><span><b>{item.studios}</b> Studios</span><span><b>{item.nests.toLocaleString("en-IN")}</b> Nests</span><span><b>{item.conversion === null ? "No data" : `${item.conversion}%`}</b> conversion</span><span className="fono-stage-owner"><b>{item.owner}</b> owner</span></li>)}</ol>
        <DataTable className="compact-table occupancy-table" caption="FONO Studio occupancy" columns={["STUDIO","THEATRE","AVAILABLE","OCCUPIED","OCCUPANCY","VACANT NESTS","THEATRE OPS OWNER"]} rows={fonoOccupancy} />
      </div>
    </section>
    <section id="demand" className={`operating-section semantic-demand ${focus === "demand" ? "focused-section" : ""}`}><p className="pillar-kicker">ŚRAM PARK · DEMAND</p><h2>JCO records each factory's need from the start.</h2><TodayMtdFunnel stages={demandTeam.stages} /><DataTable caption="Śram Park demand by factory" columns={["FACTORY","MEMBERS","THEATRE","ACTIVATION","JCO","LOGGED","AGING / MATCH"]} rows={shramDemand} /></section>
    <section id="supply" className={`operating-section semantic-supply ${focus === "supply" ? "focused-section" : ""}`}><p className="pillar-kicker">ŚRAM PARK · SUPPLY</p><h2>RM finds Nests for each need the JCO records.</h2><p className="section-intro">Use an option only if it is within 2km and found within 24 hours.</p><TodayMtdFunnel stages={supplyTeam.stages} /><DataTable caption="Śram Park supply options by factory" columns={["FACTORY","JCO","RELATIONSHIP MANAGER","OPTION","DISTANCE","RESPONSE","RULE"]} rows={shramSupply} /><div className="proximity-section"><header><div><h3>Open demand and its nearest SP options.</h3><p className="chart-reads"><span>What this chart shows</span>Pick an open demand node to see its supply options placed by distance. Needs-action demand is listed first.</p></div><p>Matched demand drops from this view.</p></header><DemandProximityWorkspace nodes={openDemandNodes} /></div></section>
    <section className="operating-section existing-occupancy-section">
      <p className="pillar-kicker">EXISTING LIVING NETWORK</p>
      <h2>{live.existingOccupied.toLocaleString("en-IN")} occupied of {live.existingContracted.toLocaleString("en-IN")} contracted Nests.</h2>
      <p className="section-intro">Current occupancy of existing Studios, kept separate from the FONO acquisition funnel.</p>
      <div className="reconciliation-strip"><article><span>CONTRACTED NESTS</span><strong>{live.existingContracted.toLocaleString("en-IN")}</strong><small>Existing Studio capacity</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article className="semantic-supply"><span>OCCUPIED NESTS</span><strong>{live.existingOccupied.toLocaleString("en-IN")}</strong><small>{live.existingOccupancyPercent}% occupancy</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article><span>VACANT NESTS</span><strong>{live.existingVacant.toLocaleString("en-IN")}</strong><small>Contracted minus occupied</small></article></div>
      <DataTable caption="Existing occupancy by Theatre" columns={["THEATRE","STUDIOS","CONTRACTED","OCCUPIED","VACANT","OCCUPANCY"]} rows={live.existingByTheatre} />
      <DataTable className="compact-table occupancy-table" caption="Existing occupancy by Studio" columns={["STUDIO","THEATRE","CONTRACTED","OCCUPIED","VACANT","OCCUPANCY","UPDATED"]} rows={live.existingOccupancyRows} />
    </section>
    <section id="reconciliation" className={`living-section ${focus === "reconciliation" ? "focused-section" : ""}`}><p className="pillar-kicker">LIVING SUMMARY</p><h2>{live.occupancyOccupied.toLocaleString("en-IN")} occupied of {live.occupancyContracted.toLocaleString("en-IN")} contracted Nests.</h2><p className="chart-reads"><span>What this chart shows</span>This chart follows demand to live capacity and then occupied Nests.</p><div className="reconciliation-strip"><article className="semantic-demand"><span>LIVE DEMAND</span><strong>{live.demandRequired}</strong><small>{live.demandMatched} matched</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article className="semantic-supply"><span>LIVE CAPACITY</span><strong>{live.fonoReady + live.spReady}</strong><small>Activation-ready Nests</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article><span>OCCUPIED NESTS</span><strong>{live.occupancyOccupied}</strong><small>{live.occupancyPercent}% occupancy</small></article></div></section>
  </DashboardSectionAccordion>
}
