"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { buildRankedQueue, isNoData } from "@/lib/allocation-engine"
import { ACTION_LOG_REFERENCE_AT, seedActionLog, type ActionLogEntry } from "@/lib/action-log"
import type { RankedMismatch } from "@/lib/allocation-types"
import type { DashboardRoute } from "@/lib/dashboard-model"
import { EXECUTION_REPORT_AS_OF } from "@/lib/execution-data"
import { buildExecutionReport, type ExecutionAction } from "@/lib/execution-control"
import { formatInr } from "@/lib/ops-data"
import { AllocationReviewPanel } from "./allocation-review-panel"

function scoreLabel(mismatch: RankedMismatch) {
  return isNoData(mismatch.priorityScore) ? "No data" : String(mismatch.priorityScore)
}
function gapLabel(mismatch: RankedMismatch) {
  return isNoData(mismatch.gapQty) ? "No data" : `${mismatch.gapQty.toLocaleString("en-IN")} ${mismatch.gapUnit}`
}
function cmLabel(mismatch: RankedMismatch) {
  return isNoData(mismatch.forwardCmAtRisk24h) ? "No data" : formatInr(mismatch.forwardCmAtRisk24h, true)
}

export function AllocationAttentionQueue({ allocationData, commitments, onShowExecution, onNavigate }: { allocationData?: any; commitments: ExecutionAction[]; onShowExecution: () => void; onNavigate: (route: DashboardRoute, mismatchId: string) => void }) {
  const [entries, setEntries] = useState<ActionLogEntry[]>(seedActionLog)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/action-log", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The action history could not be loaded.")
        return response.json() as Promise<{ entries: ActionLogEntry[] }>
      })
      .then((body) => {
        setEntries(body.entries)
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return
        setError(reason instanceof Error ? reason.message : "The action history could not be loaded.")
      })
    return () => controller.abort()
  }, [])

  const context = useMemo(() => ({ actionLog: entries, now: ACTION_LOG_REFERENCE_AT }), [entries])
  const queue = useMemo(() => buildRankedQueue(context, allocationData?.mismatchInputs), [context, allocationData])
  const selected = queue.find((item) => item.id === selectedId) ?? null
  const meetingCommitments = useMemo(() => buildExecutionReport(commitments, EXECUTION_REPORT_AS_OF).actions.filter((action) => action.source === "meeting_commitment" && action.status !== "Verified" && action.status !== "Dismissed"), [commitments])

  const top = queue.slice(0, 3)
  const rest = queue.slice(3)

  return (
    <section className="story-section allocation-queue-section" aria-labelledby="queue-title">
      <header className="story-heading">
        <div>
          <p className="story-kicker">03 · EXECUTION QUEUE</p>
          <h2 id="queue-title">Fix the biggest problem first.</h2>
        </div>
        <p>Read-only report. The system creates each action and tags the owner from the reviewed root cause.</p>
      </header>

      <ol className="constraint-list allocation-queue">
        {top.map((mismatch, index) => (
          <li key={mismatch.id} className={index === 0 ? "is-priority" : undefined}>
            <span className="constraint-rank tnum" aria-label={`Priority score ${scoreLabel(mismatch)}`}>{scoreLabel(mismatch)}</span>
            <div className="constraint-copy">
              <span className="commitment-source commitment-source-system_detected">System detected</span>
              <strong>{mismatch.label}</strong>
              <p>{mismatch.theatre} · {mismatch.where} · <span className={isNoData(mismatch.gapQty) ? "" : "queue-gap"}>{gapLabel(mismatch)}</span></p>
              <small>{mismatch.accountableOwner} · owner tagged · alert queued</small>
              <p className="queue-generated-action">{mismatch.nextAction}</p>
              <ul className="queue-facts">
                <li><span>CM at risk in 24 hours</span><b>{cmLabel(mismatch)}</b></li>
                <li><span>Open / time limit</span><b className="tnum">{mismatch.ageHours}h / {mismatch.thresholdHours}h</b></li>
              </ul>
            </div>
            <div className="queue-actions">
              <button className="queue-review" onClick={() => setSelectedId(mismatch.id)}>View root cause</button>
              <button className="queue-open" onClick={() => {
  console.log("OPEN LANE CLICK", mismatch.laneTarget, mismatch.id);
  onNavigate(mismatch.laneTarget, mismatch.id);
}} aria-label={`Open ${mismatch.laneTarget.screen}${mismatch.laneTarget.subsection ? ` ${mismatch.laneTarget.subsection}` : ""} for ${mismatch.label}`}>Open lane<ArrowUpRight aria-hidden /></button>
            </div>
          </li>
        ))}
      </ol>

      {meetingCommitments.length > 0 ? <div className="meeting-queue-block">
        <header><div><span className="commitment-source commitment-source-meeting_commitment">Meeting commitment</span><h3>Agreed actions in the same queue</h3></div><button type="button" onClick={onShowExecution}>Open Execution Control <ArrowUpRight aria-hidden /></button></header>
        <ol>{meetingCommitments.map((action) => <li key={action.id}>
          <div><strong>{action.title}</strong><p>{action.owner} · {action.team} · {action.status}</p></div>
          <span>{action.carryForward ? "Carry-forward" : action.result}</span>
        </li>)}</ol>
      </div> : null}

      {error ? <p className="queue-read-error" role="status">{error}</p> : null}

      {rest.length > 0 && (
        <details className="more-constraints">
          <summary>+{rest.length} more in queue</summary>
          <ul>{rest.map((mismatch) => <li key={mismatch.id}><button onClick={() => setSelectedId(mismatch.id)}><span className="tnum">{scoreLabel(mismatch)}</span> · {mismatch.label} · {mismatch.theatre} · {cmLabel(mismatch)} · {mismatch.actionStatus}</button></li>)}</ul>
        </details>
      )}

      {selected && (
        <AllocationReviewPanel
          mismatch={selected}
          entries={entries}
          onClose={() => setSelectedId(null)}
          onNavigate={onNavigate}
        />
      )}
    </section>
  )
}




