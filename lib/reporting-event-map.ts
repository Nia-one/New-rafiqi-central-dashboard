import type { DataClassification, TransactionEvent, TransactionState } from "@/lib/transaction-types"

export type ReportingDisposition = "Operational only" | "Verified projection" | "Excluded restricted payroll"

export const REPORTING_EVENT_MAP: Record<TransactionState, { eventType: string; disposition: Exclude<ReportingDisposition, "Excluded restricted payroll">; reportUse: string }> = {
  Draft: { eventType: "TransactionDraft", disposition: "Operational only", reportUse: "No report mutation" },
  Initiated: { eventType: "TransactionInitiated", disposition: "Operational only", reportUse: "Open workflow monitoring only" },
  "Under review": { eventType: "TransactionUnderreview", disposition: "Operational only", reportUse: "Exception monitoring only" },
  Approved: { eventType: "TransactionApproved", disposition: "Operational only", reportUse: "Approved pipeline monitoring only" },
  "In progress": { eventType: "TransactionInprogress", disposition: "Operational only", reportUse: "Execution monitoring only" },
  Fulfilled: { eventType: "TransactionFulfilled", disposition: "Operational only", reportUse: "Await settlement monitoring only" },
  Settling: { eventType: "TransactionSettling", disposition: "Operational only", reportUse: "Finance queue monitoring only" },
  Settled: { eventType: "TransactionSettled", disposition: "Operational only", reportUse: "Await reconciliation monitoring only" },
  Reconciled: { eventType: "TransactionReconciled", disposition: "Verified projection", reportUse: "Financial and operating measures" },
  Disputed: { eventType: "TransactionDisputed", disposition: "Operational only", reportUse: "Exception and case monitoring only" },
  Closed: { eventType: "TransactionClosed", disposition: "Verified projection", reportUse: "Completion, retention and fulfilment measures" },
  Cancelled: { eventType: "TransactionCancelled", disposition: "Operational only", reportUse: "Cancellation monitoring only" },
  Reversed: { eventType: "TransactionReversed", disposition: "Operational only", reportUse: "Reversal monitoring until reconciled closure" },
}

export function reportingDisposition(event: Pick<TransactionEvent, "to" | "verified" | "analyticsAllowed" | "classification">, classification: DataClassification = event.classification): ReportingDisposition {
  if (classification === "Restricted payroll" || !event.analyticsAllowed) return "Excluded restricted payroll"
  if (event.verified && REPORTING_EVENT_MAP[event.to].disposition === "Verified projection") return "Verified projection"
  return "Operational only"
}
