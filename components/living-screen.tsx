"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowRight } from "lucide-react"
import { AllocationContextStrip } from "@/components/allocation-context-strip"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { DataTable } from "@/components/data-table"
import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { DemandProximityWorkspace } from "@/components/demand-proximity-workspace"
import { LivingSupplyModelReport } from "@/components/living-supply-model-report"
import type { LivingSection } from "@/lib/dashboard-model"
import { buildLivingScreenData } from "@/lib/live-mappers/living-screen"

function LivePacingCard({ channel, actual, target, elapsed, days, owner, copy }: { channel: "FONO" | "SP"; actual: number; target: number; elapsed: number; days: number; owner: string; copy: (key: string) => string }) {
  const left = Math.max(0, days - elapsed)
  const runRate = elapsed > 0 ? Math.round(actual / elapsed * days) : 0
  const variance = runRate - target
  const prefix = channel === "FONO" ? "fono" : "sp"
  return <article className="pacing-card"><span>{copy(`${prefix}_pacing_kicker`)}</span><strong>{actual.toLocaleString("en-IN")} <small>/ {target.toLocaleString("en-IN")} {copy("pacing_member_unit")}</small></strong><div><p><b>{left}</b> {copy("pacing_days_left")}</p><p><b>{runRate.toLocaleString("en-IN")}</b> {copy("pacing_month_end_estimate")}</p><p><b>{Math.abs(variance).toLocaleString("en-IN")}</b> {copy(variance >= 0 ? "pacing_ahead" : "pacing_gap")} - {target > 0 ? Math.round(Math.abs(variance) / target * 100) : 0}%</p></div><small>{copy("pacing_owner_prefix")} {owner} - {copy("pacing_owner_suffix")}</small></article>
}

export function LivingScreen({ focus, allocationFocus, liveOpsData, allocationData }: { focus?: LivingSection; allocationFocus?: string; liveOpsData: any; allocationData?: any }) {
  const live = buildLivingScreenData(liveOpsData)
  const openDemandNodes = live.proximityNodes.filter((node) => node.status.toLowerCase() !== "matched" && node.members > 0)
  const liveCapacity = live.fonoReady + live.spReady
  const copy = (key: string) => live.metricTemplate(key, "No data")
  const [openIndex, setOpenIndex] = useState(-1)

  useEffect(() => {
    if (allocationFocus) {
      setOpenIndex(1)
      return
    }

    if (!focus) return
    const focusIndex: Record<LivingSection, number> = {
      fono: 4,
      demand: 5,
      supply: 6,
      reconciliation: 7,
    }
    setOpenIndex(focusIndex[focus])
  }, [allocationFocus, focus])
  const fonoStages = [
    { stage: copy("fono_stage_visits"), studios: live.metricNumber("visits"), nests: live.metricNumber("visits_nests"), conversion: `${Math.round(live.metricNumber("visits_conversion") * 100)}%`, owner: live.metricOwner("visits") },
    { stage: copy("fono_stage_agreed"), studios: live.metricNumber("agreed"), nests: live.metricNumber("agreed_nests"), conversion: `${Math.round(live.metricNumber("agreed_conversion") * 100)}%`, owner: live.metricOwner("agreed") },
    { stage: copy("fono_stage_contracted"), studios: live.metricNumber("contracted"), nests: live.fonoSupply[0]?.mtd ?? 0, conversion: `${Math.round(live.metricNumber("contracted_conversion") * 100)}%`, owner: live.metricOwner("contracted") },
    { stage: copy("fono_stage_kyc"), studios: live.metricNumber("kyc"), nests: live.metricNumber("kyc_nests"), conversion: `${Math.round(live.metricNumber("kyc_conversion") * 100)}%`, owner: live.metricOwner("kyc") },
    { stage: copy("fono_stage_live"), studios: live.metricNumber("live"), nests: live.fonoReady, conversion: `${Math.round(live.metricNumber("live_conversion") * 100)}%`, owner: live.metricOwner("live") },
  ]

return <DashboardSectionAccordion className="pillar-screen living-screen" ariaLabel="Living sections" openIndex={openIndex} onOpenIndexChange={setOpenIndex} sections={[
    { title: copy("accordion_main_title"), summary: copy("accordion_main_summary") },
    { title: copy("accordion_allocation_title"), summary: copy("accordion_allocation_summary") },
    { title: copy("accordion_supply_title"), summary: copy("accordion_supply_summary") },
    { title: copy("accordion_pacing_title"), summary: copy("accordion_pacing_summary") },
    { title: copy("accordion_fono_title"), summary: copy("accordion_fono_summary") },
    { title: copy("accordion_demand_title"), summary: copy("accordion_demand_summary") },
    { title: copy("accordion_sp_supply_title"), summary: copy("accordion_sp_supply_summary") },
    { title: copy("accordion_summary_title"), summary: copy("accordion_summary_summary") },
  ]}>
    <div className="decision-bar living-headline"><div><span>{copy("main_point_kicker")}</span><strong>{copy("main_point_headline")}</strong></div><p>{copy("main_point_explanation")}</p></div>
    <AllocationContextStrip mismatchId={allocationFocus} allocationData={allocationData} />
    <LivingSupplyModelReport liveOpsData={liveOpsData} />
    <div className="pacing-grid"><LivePacingCard channel="FONO" actual={live.fonoReady} target={live.metricNumber("fono_target")} elapsed={live.metricNumber("days_elapsed")} days={live.metricNumber("days_in_month")} owner={live.metricOwner("fono_target")} copy={copy} /><LivePacingCard channel="SP" actual={live.spReady} target={live.metricNumber("sp_target")} elapsed={live.metricNumber("days_elapsed")} days={live.metricNumber("days_in_month")} owner={live.metricOwner("sp_target")} copy={copy} /></div>
    <section id="fono" className={`operating-section ${focus === "fono" ? "focused-section" : ""}`}>
      <p className="pillar-kicker">{copy("fono_kicker")}</p><h2>{copy("fono_title")}</h2><p className="section-intro">{copy("fono_intro")}</p>
      <div className="channel-grid fono-channel-grid">
        <div className="fono-channel-chart semantic-supply"><div className="fono-channel-heading"><h3>{copy("fono_supply_headline")}</h3><p className="chart-reads"><span>{copy("chart_explanation_label")}</span>{copy("fono_supply_explanation")}</p></div><TodayMtdFunnel stages={live.fonoSupply} copy={(key, fallback) => live.metricTemplate(key, fallback)} /></div>
        <div className="fono-channel-chart semantic-demand"><div className="fono-channel-heading"><h3>{copy("fono_demand_headline")}</h3><p className="chart-reads"><span>{copy("chart_explanation_label")}</span>{copy("fono_demand_explanation")}</p></div><TodayMtdFunnel stages={live.fonoDemand} copy={(key, fallback) => live.metricTemplate(key, fallback)} /></div>
        <ol className="fono-funnel" aria-label="FONO supply stages">{fonoStages.map((item, index) => <li key={item.stage}><span className="fono-stage-rank">{String(index + 1).padStart(2, "0")}</span><strong className="fono-stage-name">{item.stage}</strong><span><b>{typeof item.studios === "number" ? item.studios.toLocaleString("en-IN") : item.studios}</b> {copy("fono_stage_studios_unit")}</span><span><b>{typeof item.nests === "number" ? item.nests.toLocaleString("en-IN") : item.nests}</b> {copy("fono_stage_nests_unit")}</span><span><b>{item.conversion}</b> {copy("fono_stage_conversion_unit")}</span><span className="fono-stage-owner"><b>{item.owner}</b> {copy("fono_stage_owner_unit")}</span></li>)}</ol>
        <DataTable className="compact-table occupancy-table" caption={copy("fono_occupancy_caption")} columns={["STUDIO", "THEATRE", "AVAILABLE", "OCCUPIED", "OCCUPANCY", "DAYS LIVE", "THEATRE OPS OWNER"]} rows={live.occupancyRows} />
      </div>
    </section>
    <section id="demand" className={`operating-section semantic-demand ${focus === "demand" ? "focused-section" : ""}`}><p className="pillar-kicker">{copy("sp_demand_kicker")}</p><h2>{copy("sp_demand_title")}</h2><TodayMtdFunnel stages={live.demandStages} copy={(key, fallback) => live.metricTemplate(key, fallback)} /><DataTable caption={copy("sp_demand_table_caption")} columns={["FACTORY", "MEMBERS", "THEATRE", "ACTIVATION", "JCO", "LOGGED", "AGING / MATCH"]} rows={live.demandRows} /></section>
    <section id="supply" className={`operating-section semantic-supply ${focus === "supply" ? "focused-section" : ""}`}><p className="pillar-kicker">{copy("sp_supply_kicker")}</p><h2>{copy("sp_supply_title")}</h2><p className="section-intro">{copy("sp_supply_intro")}</p><TodayMtdFunnel stages={live.supplyStages} copy={(key, fallback) => live.metricTemplate(key, fallback)} /><DataTable caption={copy("sp_supply_table_caption")} columns={["FACTORY", "JCO", "RELATIONSHIP MANAGER", "OPTION", "DISTANCE", "RESPONSE", "RULE"]} rows={live.supplyRows} /><div className="proximity-section"><header><div><h3>{copy("sp_supply_proximity_title")}</h3><p className="chart-reads"><span>{copy("chart_explanation_label")}</span>{copy("sp_supply_proximity_description")}</p></div><p>{copy("sp_supply_matched_note")}</p></header><DemandProximityWorkspace nodes={openDemandNodes} /></div></section>
    <section id="reconciliation" className={`living-section ${focus === "reconciliation" ? "focused-section" : ""}`}><p className="pillar-kicker">{copy("living_summary_kicker")}</p><h2>{copy("living_summary_headline")}</h2><p className="chart-reads"><span>{copy("chart_explanation_label")}</span>{copy("living_summary_explanation")}</p><div className="reconciliation-strip"><article className="semantic-demand"><span>{copy("living_summary_demand_label")}</span><strong>{live.demandRequired.toLocaleString("en-IN")}</strong><small>{copy("living_summary_demand_detail")}</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article className="semantic-supply"><span>{copy("living_summary_capacity_label")}</span><strong>{liveCapacity.toLocaleString("en-IN")}</strong><small>{copy("living_summary_capacity_detail")}</small></article><i aria-hidden><ArrowRight /><ArrowDown /></i><article><span>{copy("living_summary_occupied_label")}</span><strong>{live.fonoOccupied.toLocaleString("en-IN")}</strong><small>{copy("living_summary_occupied_detail")}</small></article></div></section>
  </DashboardSectionAccordion>
}
