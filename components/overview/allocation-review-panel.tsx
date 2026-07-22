"use client"

import { useEffect, useMemo, useRef } from "react"
import { ArrowUpRight, X } from "lucide-react"
import type { DashboardRoute } from "@/lib/dashboard-model"
import { isNoData } from "@/lib/allocation-engine"
import { ACTION_ACTORS, actionHistory, type ActionLogEntry } from "@/lib/action-log"
import type { RankedMismatch } from "@/lib/allocation-types"
import { formatInr } from "@/lib/ops-data"

function gapLabel(mismatch: RankedMismatch) {
  return isNoData(mismatch.gapQty) ? "No data" : `${mismatch.gapQty.toLocaleString("en-IN")} ${mismatch.gapUnit}`
}
function cmLabel(mismatch: RankedMismatch) {
  return isNoData(mismatch.forwardCmAtRisk24h) ? "No data" : formatInr(mismatch.forwardCmAtRisk24h, true)
}
function actorName(id: string | null) {
  if (!id) return "System"
  return ACTION_ACTORS.find((actor) => actor.id === id)?.name ?? id
}
function istTime(value: string) {
  return `${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date(value))} IST`
}

export function AllocationReviewPanel({ mismatch, entries, onClose, onNavigate }: {
  mismatch: RankedMismatch
  entries: ActionLogEntry[]
  onClose: () => void
  onNavigate: (route: DashboardRoute, mismatchId: string) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const history = useMemo(() => actionHistory(mismatch.id, entries).reverse(), [mismatch.id, entries])

  useEffect(() => {
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const components = mismatch.scoreComponents
  const titleId = `review-${mismatch.id}`

  return <div className="review-scrim" onMouseDown={onClose}>
    <aside className="review-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <header className="review-head"><div><p className="review-tag">ILLUSTRATIVE OPERATING DATA</p><h2 id={titleId}>{mismatch.label}</h2><p className="review-sub">{mismatch.domain} · {mismatch.theatre} · {mismatch.where}</p></div><button ref={closeRef} className="review-close" onClick={onClose} aria-label="Close review panel"><X aria-hidden /></button></header>

      <div className="review-score"><div className="review-score-value"><span>PRIORITY SCORE</span><strong className="tnum">{isNoData(mismatch.priorityScore) ? "No data" : mismatch.priorityScore}</strong></div><dl className="review-breakdown">{isNoData(components) ? <p className="review-nodata">No score is available because CM at risk is missing. It is not zero. Confidence stays {mismatch.confidence}.</p> : <><div><dt>CM at risk in 24 hours</dt><dd className="tnum">{formatInr(components.forwardCmAtRisk24h, true)}</dd></div><div><dt>Time pressure</dt><dd className="tnum">{components.urgencyMultiplier.toFixed(2)}×</dd></div><div><dt>Share that can be recovered</dt><dd className="tnum">{Math.round(components.recoverableShare * 100)}%</dd></div><div><dt>Confidence ({mismatch.confidence})</dt><dd className="tnum">{components.confidenceMultiplier.toFixed(2)}×</dd></div><div><dt>Need for action ({mismatch.attentionBucket})</dt><dd className="tnum">{components.attentionMultiplier.toFixed(2)}×</dd></div><div className="review-raw"><dt>Base score</dt><dd className="tnum">{Math.round(components.rawPriority).toLocaleString("en-IN")}</dd></div></>}</dl></div>

      <div className="review-grid"><div><span>GAP</span><strong className={isNoData(mismatch.gapQty) ? "" : "queue-gap"}>{gapLabel(mismatch)}</strong></div><div><span>CM AT RISK IN 24 HOURS</span><strong>{cmLabel(mismatch)}</strong></div><div><span>OPEN / TIME LIMIT</span><strong className="tnum">{mismatch.ageHours}h / {mismatch.thresholdHours}h</strong></div><div><span>OWNER</span><strong>{mismatch.accountableOwner}</strong></div></div>

      <section className="review-evidence" aria-label="Mismatch evidence"><h3>Evidence</h3><ul>{mismatch.evidence.map((line) => <li key={line}>{line}</li>)}</ul><p className="review-source">Source: {mismatch.sourceLabel} · updated {mismatch.sourceUpdatedAt}</p></section>

      <section className="review-analysis" aria-label="Evidence-backed five whys analysis"><div className="review-analysis-head"><h3>5 Whys analysis</h3><span>{mismatch.rootCauseAnalysis.review.status}</span></div><ol>{mismatch.rootCauseAnalysis.whys.map((why, index) => <li key={why}><span>Why {index + 1}</span><p>{why}</p></li>)}</ol><div className="review-analysis-summary review-root-cause"><span>Root cause</span><p>{mismatch.rootCauseAnalysis.rootCause}</p></div><div className="review-analysis-summary review-solution"><span>Recommended solution</span><p>{mismatch.rootCauseAnalysis.recommendedSolution}</p></div><p className="review-source">Reviewed by {mismatch.rootCauseAnalysis.review.reviewedBy} · {mismatch.rootCauseAnalysis.review.reviewedAt}</p></section>

      <section className="review-action" aria-label="System-generated next action"><h3>System-generated action</h3><p className={mismatch.actionBlocked ? "action-blocked" : ""}>{mismatch.nextAction}</p><button className="review-link" onClick={() => onNavigate(mismatch.laneTarget, mismatch.id)}>Open lane · {mismatch.laneTarget.screen}<ArrowUpRight aria-hidden /></button></section>

      <section className="review-owner-alert" aria-label="Tagged owner and alert state"><div><span>TAGGED OWNER</span><strong>{mismatch.accountableOwner}</strong></div><div><span>OWNER ALERT</span><strong>Queued automatically</strong></div><p>Delivery remains illustrative until the alert connector is live. No action is entered or assigned from this report.</p></section>

      <section className="workflow" aria-label="Human confirmed workflow"><h3>Execution lifecycle</h3><ol>{["Detected", "Assigned", "Resolved", "Closed", "Verified"].map((status) => <li className={status === mismatch.actionStatus ? "current" : ""} key={status}>{status}</li>)}</ol>{mismatch.actionStatus === "Dismissed" && <p>Dismissed through the logged off-ramp.</p>}</section>

      <section className="review-history" aria-label="Append-only action history"><h3>Action history</h3><ol>{history.map((entry) => <li key={entry.id}><div><strong>{entry.action_type === "detect" ? "Detected" : entry.action_type.charAt(0).toUpperCase() + entry.action_type.slice(1)}</strong><time dateTime={entry.executed_at}>{istTime(entry.executed_at)}</time></div><p>{actorName(entry.actor_id)} · {entry.previous_status ? `${entry.previous_status} → ` : ""}{entry.new_status}</p>{entry.note && <small>{entry.note}</small>}</li>)}</ol></section>
    </aside>
  </div>
}
