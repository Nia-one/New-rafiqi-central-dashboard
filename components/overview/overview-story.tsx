"use client"

import type { DashboardRoute } from "@/lib/dashboard-model"
import type { ExecutionAction } from "@/lib/execution-control"
import type { LoopHealth } from "@/lib/operating-loop/loop-health"
import { AlertTriangle } from "lucide-react"
import { ExecutionControlPanel } from "./execution-control-panel"
import { FlywheelOverview } from "./flywheel-overview"
import { LoopHealthStrip } from "../loop-health-strip"
import { DashboardSectionAccordion } from "../dashboard-section-accordion"
import { LiveOverviewWorkspace, LiveSheetWorkspace } from "../live-sheet-workspace"

export type OverviewMode = "reporting" | "execution"

export function OverviewStory({ mode, commitments, loopHealth, liveOpsData = {}, onModeChange, onNavigate }: { mode: OverviewMode; commitments: ExecutionAction[]; loopHealth?: LoopHealth; liveOpsData?: any; onModeChange: (mode: OverviewMode) => void; onNavigate: (route: DashboardRoute, mismatchId?: string) => void }) {
  const modeCopy = mode === "reporting"
    ? { title: "Reporting & Insights", description: "What happened and what needs attention" }
    : { title: "Execution Control & Member Satisfaction", description: "What was done, by whom, with what proof" }

  return <DashboardSectionAccordion key={mode} ariaLabel="Overview sections" sections={[
    ...(loopHealth ? [{ title: "Loop health", summary: `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` }] : []),
    { title: "Overview mode", summary: `${modeCopy.title} · ${modeCopy.description}` },
    { title: mode === "reporting" ? "Reporting and insights" : "Execution control", summary: mode === "reporting" ? "Flywheel performance, bottlenecks and actions." : `${commitments.length} commitments with proof and ownership.` },
  ]}>
    {loopHealth ? <LoopHealthStrip health={loopHealth} /> : null}
    <div className="overview-mode-bar">
      <div className="overview-mode-current" aria-live="polite">
        <span>Current view</span>
        <strong>{modeCopy.title}</strong>
        <small>{modeCopy.description}</small>
      </div>
      <div className="overview-mode-switch" role="group" aria-label="Overview mode">
        <button type="button" role="radio" className={mode === "reporting" ? "is-active" : ""} aria-checked={mode === "reporting"} onClick={() => onModeChange("reporting")}>Reporting</button>
        <button
          type="button"
          role="switch"
          className={`overview-mode-toggle ${mode === "execution" ? "is-execution" : ""}`}
          aria-checked={mode === "execution"}
          aria-label={mode === "reporting" ? "Switch to Execution Control" : "Switch to Reporting and Insights"}
          onClick={() => onModeChange(mode === "reporting" ? "execution" : "reporting")}
        ><span aria-hidden /></button>
        <button type="button" role="radio" className={mode === "execution" ? "is-active" : ""} aria-checked={mode === "execution"} onClick={() => onModeChange("execution")}>Execution control</button>
      </div>
    </div>
    {mode === "reporting"
      ? !loopHealth || loopHealth.overviewAnswerAllowed
        ? <LiveOverviewWorkspace liveOpsData={liveOpsData} />
        : <section className="overview-trust-gate" role="status" aria-label="Overview unavailable until Loop Health is restored">
          <AlertTriangle aria-hidden />
          <p>PERFORMANCE VIEW PAUSED</p>
          <h2>Cannot confirm performance yet.</h2>
          <span>{loopHealth?.reasons.join(" · ")}</span>
          <small>The flywheel stays hidden until critical feeds, clocks and independent verification are current.</small>
        </section>
      : <LiveSheetWorkspace kind="Actions" rows={liveOpsData?.actionLog ?? []} secondaryRows={liveOpsData?.evidenceLog ?? []} asOf={liveOpsData?.fetchedAt} />}
  </DashboardSectionAccordion>
}
