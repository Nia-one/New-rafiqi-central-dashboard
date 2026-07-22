import type { NiaTransaction, TransactionState } from "@/lib/transaction-types"

function seedLedger(transactionId: string, amount: number, classification: NiaTransaction["classification"], postedAt: string) {
  return [
    { id: `ledger-${transactionId}-debit`, transactionId, accountCode: "member-wallet-clearing", accountLabel: "Member wallet clearing", side: "Debit" as const, amount, currency: "INR" as const, postedAt, postedBy: "finance-system", classification },
    { id: `ledger-${transactionId}-credit`, transactionId, accountCode: "vendor-payable", accountLabel: "Vendor payable", side: "Credit" as const, amount, currency: "INR" as const, postedAt, postedBy: "finance-system", classification },
  ]
}

function seedEvent(transaction: Omit<NiaTransaction, "events">, id: string, to: TransactionState, occurredAt: string, analyticsAllowed = true) {
  return { id, type: `Transaction${to.replaceAll(" ", "")}`, from: null, to, occurredAt, actorId: "system", analyticsAllowed, verified: to === "Reconciled" || to === "Closed", classification: transaction.classification, cluster: transaction.cluster, service: transaction.service, amount: transaction.amount, memberSavingsAmount: transaction.memberSavingsAmount, niaMarginAmount: transaction.niaMarginAmount, theatre: transaction.theatre, studio: transaction.studio } as const
}

type SeedTransaction = Omit<NiaTransaction, "events" | "memberSavingsAmount" | "niaMarginAmount"> & Partial<Pick<NiaTransaction, "memberSavingsAmount" | "niaMarginAmount">>

function withEvent(transaction: SeedTransaction, id: string): NiaTransaction {
  const complete = { ...transaction, memberSavingsAmount: transaction.memberSavingsAmount ?? null, niaMarginAmount: transaction.niaMarginAmount ?? null }
  return { ...complete, events: [seedEvent(complete, id, complete.status, complete.updatedAt, complete.classification !== "Restricted payroll")] }
}

export const seedTransactions: NiaTransaction[] = [
  withEvent({
    transactionId: "LIV-260716-0042", memberId: "MEM-1842", memberLabel: "Member 1842", cluster: "Living", service: "Move-in and Nest activation",
    agent: "Infra & Community agent", counterpartyId: "STU-CHK-04", counterpartyLabel: "Chakan 04", amount: 2000, currency: "INR", status: "Approved", priority: "Time sensitive", ownerId: "operations-lead", ownerLabel: "Operations lead",
    theatre: "Deccan (Pune)", location: "Chakan 04", studio: "Chakan 04", paymentMethod: "UPI", settlementReference: null, classification: "Operational",
    openedAt: "2026-07-16T07:15:00+05:30", updatedAt: "2026-07-16T09:05:00+05:30", dueAt: "2026-07-16T18:00:00+05:30", evidence: [],
    ledgerEntries: [], cases: [],
  }, "evt-liv-42"),
  withEvent({
    transactionId: "LIV-260716-0038", memberId: "MEM-1704", memberLabel: "Member 1704", cluster: "Living", service: "Move-out and deposit closure",
    agent: "Infra & Community agent", counterpartyId: "STU-HSR-01", counterpartyLabel: "Hosur 01", amount: 3500, currency: "INR", status: "Settling", priority: "Time sensitive", ownerId: "finance-living", ownerLabel: "Living finance",
    theatre: "Wellington (Karnataka)", location: "Hosur 01", studio: "Hosur 01", paymentMethod: "Bank transfer", settlementReference: "DEP-SET-9031", classification: "Sensitive",
    openedAt: "2026-07-14T10:00:00+05:30", updatedAt: "2026-07-16T08:20:00+05:30", dueAt: "2026-07-17T18:00:00+05:30",
    evidence: [{ id: "ev-inspection-38", kind: "Photo", label: "Move-out inspection accepted", recordedAt: "2026-07-16T08:18:00+05:30", recordedBy: "theatre-checker", classification: "Sensitive" }],
    ledgerEntries: [], cases: [],
  }, "evt-liv-38"),
  withEvent({
    transactionId: "WRK-260716-0027", memberId: "MEM-1921", memberLabel: "Member 1921", cluster: "Work", service: "Offer to joining",
    agent: "Work agent", counterpartyId: "EMP-ORGM-12", counterpartyLabel: "Oragadam employer 12", amount: null, currency: "INR", status: "In progress", priority: "Time sensitive", ownerId: "work-continuity", ownerLabel: "Work continuity",
    theatre: "Coromandel (Tamil Nadu)", location: "Sriperumbudur 02", studio: "Sriperumbudur 02", paymentMethod: null, settlementReference: null, classification: "Sensitive",
    openedAt: "2026-07-15T12:30:00+05:30", updatedAt: "2026-07-16T07:40:00+05:30", dueAt: "2026-07-17T09:00:00+05:30",
    evidence: [{ id: "ev-offer-27", kind: "Confirmation", label: "Member accepted offer", recordedAt: "2026-07-16T07:40:00+05:30", recordedBy: "work-continuity", classification: "Sensitive" }],
    ledgerEntries: [], cases: [],
  }, "evt-wrk-27"),
  withEvent({
    transactionId: "WRK-PAY-2606-0011", memberId: "RESTRICTED", memberLabel: "Restricted batch", cluster: "Work", service: "Payroll reconciliation",
    agent: "Work agent", counterpartyId: "EMP-HSR-09", counterpartyLabel: "Hosur employer 09", amount: null, currency: "INR", status: "Under review", priority: "Critical", ownerId: "payroll-reconciliation", ownerLabel: "Restricted payroll operations",
    theatre: "Wellington (Karnataka)", location: "Hosur 01", studio: "Hosur 01", paymentMethod: null, settlementReference: null, classification: "Restricted payroll",
    openedAt: "2026-07-16T06:00:00+05:30", updatedAt: "2026-07-16T06:12:00+05:30", dueAt: "2026-07-16T16:00:00+05:30", evidence: [],
    ledgerEntries: [], cases: [],
  }, "evt-pay-11"),
  withEvent({
    transactionId: "ESS-260716-0064", memberId: "MEM-1842", memberLabel: "Member 1842", cluster: "Essentials", service: "Member order and fulfilment", agent: "Infra & Community agent",
    counterpartyId: "VEN-HSR-03", counterpartyLabel: "Hosur essentials vendor", amount: 486, memberSavingsAmount: 72, niaMarginAmount: 38, currency: "INR", status: "Reconciled", priority: "Routine", ownerId: "essentials-desk", ownerLabel: "Essentials desk",
    theatre: "Wellington (Karnataka)", location: "Hosur 01", studio: "Hosur 01", paymentMethod: "Nia wallet", settlementReference: "ESS-SET-6401", classification: "Operational",
    openedAt: "2026-07-16T08:45:00+05:30", updatedAt: "2026-07-16T10:15:00+05:30", dueAt: "2026-07-16T20:00:00+05:30",
    evidence: [{ id: "ev-order-64", kind: "Confirmation", label: "Member pickup confirmed", recordedAt: "2026-07-16T10:15:00+05:30", recordedBy: "essentials-desk", classification: "Operational" }], ledgerEntries: seedLedger("ESS-260716-0064", 486, "Operational", "2026-07-16T10:15:00+05:30"), cases: [],
  }, "evt-ess-64"),
  withEvent({
    transactionId: "SAV-260716-0019", memberId: "MEM-1921", memberLabel: "Member 1921", cluster: "Essentials", service: "Rafiqi Save goal deposit", agent: "Save agent",
    counterpartyId: "BANK-ESCROW-01", counterpartyLabel: "Regulated savings partner", amount: 1500, memberSavingsAmount: 1500, niaMarginAmount: 10, currency: "INR", status: "Settling", priority: "Routine", ownerId: "rafiki-save", ownerLabel: "Rafiqi Save operations",
    theatre: "Coromandel (Tamil Nadu)", location: "Sriperumbudur 02", studio: "Sriperumbudur 02", paymentMethod: "UPI autopay", settlementReference: "SAVE-SET-1128", classification: "Sensitive",
    openedAt: "2026-07-16T06:30:00+05:30", updatedAt: "2026-07-16T08:32:00+05:30", dueAt: "2026-07-17T12:00:00+05:30",
    evidence: [{ id: "ev-save-19", kind: "Provider reference", label: "Partner debit acknowledged", recordedAt: "2026-07-16T08:32:00+05:30", recordedBy: "rafiki-save", classification: "Sensitive" }], ledgerEntries: [], cases: [],
  }, "evt-save-19"),
  withEvent({
    transactionId: "REM-260716-0007", memberId: "MEM-1704", memberLabel: "Member 1704", cluster: "Essentials", service: "Rafiqi Remit family transfer", agent: "Remit agent",
    counterpartyId: "REMIT-PARTNER-02", counterpartyLabel: "Regulated remittance partner", amount: 4200, memberSavingsAmount: 120, niaMarginAmount: 35, currency: "INR", status: "In progress", priority: "Time sensitive", ownerId: "rafiki-remit", ownerLabel: "Rafiqi Remit operations",
    theatre: "Wellington (Karnataka)", location: "Hosur 01", studio: "Hosur 01", paymentMethod: "Nia wallet", settlementReference: null, classification: "Sensitive",
    openedAt: "2026-07-16T09:10:00+05:30", updatedAt: "2026-07-16T09:18:00+05:30", dueAt: "2026-07-16T13:00:00+05:30", evidence: [], ledgerEntries: [], cases: [],
  }, "evt-rem-7"),
]
