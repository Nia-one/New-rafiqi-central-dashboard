import { isNoData, mismatchById } from "@/lib/allocation-engine"
import { formatInr } from "@/lib/ops-data"

/**
 * Compact "Allocation context" strip shown on Living / Essentials only when a
 * queue item deep-links here. It restates the selected mismatch without
 * redesigning or removing any existing lane content.
 */
export function AllocationContextStrip({ mismatchId, allocationData }: { mismatchId?: string; allocationData?: any }) {
  const mismatch = mismatchId ? mismatchById(mismatchId, {}, allocationData?.mismatchInputs) : undefined
  if (!mismatch) return null
  const cm = isNoData(mismatch.forwardCmAtRisk24h) ? "No data" : formatInr(mismatch.forwardCmAtRisk24h, true)

  return (
    <aside className="allocation-context" aria-label="Issue selected from the Overview page">
      <p className="allocation-context-tag">SELECTED ISSUE Â· SAMPLE DATA</p>
      <div className="allocation-context-body">
        <div><span>ISSUE</span><strong>{mismatch.label}</strong><small>{mismatch.theatre} Â· {mismatch.where}</small></div>
        <div><span>OWNER</span><strong>{mismatch.accountableOwner}</strong><small>Due by {mismatch.deadlineAt}</small></div>
        <div><span>CM AT RISK IN 24 HOURS</span><strong>{cm}</strong><small>Open {mismatch.ageHours}h / {mismatch.thresholdHours}h limit</small></div>
      </div>
      <p className={`allocation-context-action ${mismatch.actionBlocked ? "action-blocked" : ""}`}>{mismatch.nextAction}</p>
    </aside>
  )
}


