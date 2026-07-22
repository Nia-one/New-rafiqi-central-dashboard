import { getMismatchForStage, isNoData, isUnresolved } from "@/lib/allocation-engine"
import type { FunnelStage } from "@/lib/operating-data"
import { formatInr } from "@/lib/ops-data"

export type StageDiagnosticStatus = "working" | "not-working"

export type StageDiagnostic = {
  stageLabel: string
  status: StageDiagnosticStatus
  reason: string
  mismatchId?: string
  nextAction?: string
  accountableOwner?: string
  forwardCmAtRisk24h?: string
}

function mismatchHasNoData(mismatch: NonNullable<ReturnType<typeof getMismatchForStage>>) {
  return [mismatch.demandQty, mismatch.supplyQty, mismatch.gapQty, mismatch.forwardCmAtRisk24h].some((value) => isNoData(value))
}

/**
 * Stage reason stays local to the operating metric. Status, action, owner and CM
 * are resolved from the Allocation Engine whenever an entity join key is present.
 */
export function diagnoseStage(stage: FunnelStage): StageDiagnostic | null {
  const context = stage.diagnosticContext
  const mismatch = context ? getMismatchForStage(context.domain, context.joinKey) : undefined

  const status: StageDiagnosticStatus | null = mismatch
    ? isUnresolved(mismatch.actionStatus) ? "not-working" : "working"
    : stage.signal === "issue" ? "not-working" : stage.signal === "positive" ? "working" : null

  if (!status) return null

  const reason = stage.reason ?? mismatch?.label
  if (!reason) return null
  if (!mismatch) return { stageLabel: stage.label, status, reason }

  const noData = mismatchHasNoData(mismatch) || mismatch.actionBlocked
  return {
    stageLabel: stage.label,
    status,
    reason,
    mismatchId: mismatch.id,
    nextAction: noData ? "No data: action pending verification" : mismatch.nextAction,
    accountableOwner: mismatch.accountableOwner,
    forwardCmAtRisk24h: isNoData(mismatch.forwardCmAtRisk24h) ? "No data" : formatInr(mismatch.forwardCmAtRisk24h, true),
  }
}
