"use client"

import type { DashboardRoute } from "@/lib/dashboard-model"
import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import { AlertTriangle } from "lucide-react"
import { ExecutionControlPanel } from "./execution-control-panel"
import { FlywheelOverview } from "./flywheel-overview"
import { LoopHealthStrip } from "../loop-health-strip"
import { DashboardSectionAccordion } from "../dashboard-section-accordion"
import { OperatingLede } from "./operating-lede"
import { SpineStrip } from "./spine-strip"
import { CmTrajectory } from "./cm-trajectory"
import { useState } from "react"

export type OverviewMode = "reporting" | "execution"

export function OverviewStory({ mode, loopHealth, liveOpsData, allocationData, onModeChange, onNavigate }: { mode: OverviewMode; loopHealth?: LoopHealth; liveOpsData?: any; allocationData?: any; onModeChange: (mode: OverviewMode) => void; onNavigate: (route: DashboardRoute, mismatchId?: string) => void }) {
  const sourceCommitments = liveOpsData?.executionActions ?? []
  const contentSectionIndex = loopHealth ? 2 : 1
  const [openSectionIndex, setOpenSectionIndex] = useState(-1)
  const modeCopy = mode === "reporting"
    ? { title: "Reporting & Insights", description: "What happened and what needs attention" }
    : { title: "Execution Control & Member Satisfaction", description: "What was done, by whom, with what proof" }

  function selectMode(nextMode: OverviewMode) {
    onModeChange(nextMode)
    setOpenSectionIndex(contentSectionIndex)
  }

  return <DashboardSectionAccordion
  key={mode}
  ariaLabel="Overview sections"
  openIndex={openSectionIndex}
  onOpenIndexChange={setOpenSectionIndex}
  sections={[
    ...(loopHealth ? [{ title: "Loop health", summary: `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` }] : []),
    { title: "Overview mode", summary: `${modeCopy.title} · ${modeCopy.description}` },
    { title: mode === "reporting" ? "Reporting and insights" : "Execution control", summary: mode === "reporting" ? "Flywheel performance, bottlenecks and actions." : `${sourceCommitments.length} source action records with proof and ownership.` },
  ]}>
    {loopHealth ? <LoopHealthStrip health={loopHealth} /> : null}
    <div className="overview-mode-bar">
      <div className="overview-mode-current" aria-live="polite">
        <span>Current view</span>
        <strong>{modeCopy.title}</strong>
        <small>{modeCopy.description}</small>
      </div>
      <div className="overview-mode-switch" role="group" aria-label="Overview mode">
        <button type="button" role="radio" className={mode === "reporting" ? "is-active" : ""} aria-checked={mode === "reporting"} onClick={() => selectMode("reporting")}>Reporting</button>
        <button
          type="button"
          role="switch"
          className={`overview-mode-toggle ${mode === "execution" ? "is-execution" : ""}`}
          aria-checked={mode === "execution"}
          aria-label={mode === "reporting" ? "Switch to Execution Control" : "Switch to Reporting and Insights"}
          onClick={() => selectMode(mode === "reporting" ? "execution" : "reporting")}
        ><span aria-hidden /></button>
        <button type="button" role="radio" className={mode === "execution" ? "is-active" : ""} aria-checked={mode === "execution"} onClick={() => selectMode("execution")}>Execution control</button>
      </div>
    </div>
    {mode === "reporting"
      ? loopHealth?.overviewAnswerAllowed !== false
        ? <>
  <OperatingLede liveOpsData={liveOpsData} />

  <SpineStrip
    liveOpsData={liveOpsData}
    onNavigate={onNavigate}
  />

  <CmTrajectory
    liveOpsData={liveOpsData}
  />

  <FlywheelOverview 
    liveOpsData={liveOpsData} allocationData={allocationData}
    commitments={sourceCommitments}
    onShowExecution={() => onModeChange("execution")}
    onNavigate={onNavigate}
  />
</>
        : <section className="overview-trust-gate" role="status" aria-label="Overview unavailable until Loop Health is restored">
          <AlertTriangle aria-hidden />
          <p>PERFORMANCE VIEW PAUSED</p>
          <h2>Cannot confirm performance yet.</h2>
          <span>{loopHealth?.reasons.join(" · ")}</span>
          <small>The flywheel stays hidden until critical feeds, clocks and independent verification are current.</small>
        </section>
      : <ExecutionControlPanel liveOpsData={liveOpsData} onNavigate={onNavigate} />}
  </DashboardSectionAccordion>
}

