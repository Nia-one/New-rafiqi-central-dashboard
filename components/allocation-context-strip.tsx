import { isNoData, mismatchById } from "@/lib/allocation-engine"
import { formatInr } from "@/lib/ops-data"

/**
 * Compact "Allocation context" strip shown on Living / Essentials only when a
 * queue item deep-links here. It restates the selected mismatch without
 * redesigning or removing any existing lane content.
 */
export function AllocationContextStrip({ mismatchId, allocationData }: { mismatchId?: string; allocationData?: any }) {
  // A selected issue must come from a supplied live allocation dataset.  Do not
  // fall back to the sample allocation registry when the sheet has no row.
  if (!allocationData?.mismatchInputs) return null
  const defaultLivingMismatch = allocationData.mismatchInputs.find((item: any) => ["FONO", "Shram Park", "Supply"].includes(item.domain))
  const selectedMismatchId = mismatchId || defaultLivingMismatch?.id
  const mismatch = selectedMismatchId ? mismatchById(selectedMismatchId, {}, allocationData.mismatchInputs) : undefined
  if (!mismatch) return null
  const cm = isNoData(mismatch.forwardCmAtRisk24h) ? "No data" : formatInr(mismatch.forwardCmAtRisk24h, true)

  return (
    <aside
      id="allocation-context"
      data-mismatch-id={mismatch.id}
      className="allocation-context"
      aria-label="Issue selected from the Overview page"
    >
      <p className="allocation-context-tag">SELECTED ISSUE · LIVE DATA</p>
      <div className="allocation-context-body">
        <div><span>ISSUE</span><strong>{mismatch.label}</strong><small>{mismatch.theatre} Â· {mismatch.where}</small></div>
        <div><span>OWNER</span><strong>{mismatch.accountableOwner}</strong><small>Due by {mismatch.deadlineAt}</small></div>
        <div><span>CM AT RISK IN 24 HOURS</span><strong>{cm}</strong><small>{mismatch.timingAvailable === false ? "Open time / limit not available" : `Open ${mismatch.ageHours}h / ${mismatch.thresholdHours}h limit`}</small></div>
      </div>
      <p className={`allocation-context-action ${mismatch.actionBlocked ? "action-blocked" : ""}`}>{mismatch.nextAction}</p>
    </aside>
  )
}


