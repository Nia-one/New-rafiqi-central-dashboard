import type { ActorContext, CreateTransactionInput, LedgerEntry, NiaTransaction, ReportingProjection, TransactionEvent, TransactionState, TransitionTransactionInput } from "@/lib/transaction-types"
import { serviceDefinition } from "@/lib/service-catalog"

const allowedTransitions: Record<TransactionState, readonly TransactionState[]> = {
  Draft: ["Initiated", "Cancelled"],
  Initiated: ["Under review", "Approved", "Cancelled"],
  "Under review": ["Approved", "Disputed", "Cancelled"],
  Approved: ["In progress", "Cancelled"],
  "In progress": ["Fulfilled", "Disputed", "Cancelled"],
  Fulfilled: ["Settling", "Settled", "Disputed"],
  Settling: ["Settled", "Disputed"],
  Settled: ["Reconciled", "Disputed", "Reversed"],
  Reconciled: ["Closed", "Disputed", "Reversed"],
  Disputed: ["Under review", "In progress", "Settling", "Reconciled", "Reversed", "Closed"],
  Closed: [],
  Cancelled: [],
  Reversed: ["Closed"],
}

const statesRequiringEvidence = new Set<TransactionState>(["Fulfilled", "Reconciled", "Closed", "Reversed"])
const statesRequiringReason = new Set<TransactionState>(["Disputed", "Cancelled", "Reversed"])

export function canTransition(from: TransactionState, to: TransactionState) {
  return allowedTransitions[from].includes(to)
}

export function availableTransitions(state: TransactionState) {
  return [...allowedTransitions[state]]
}

const transitionRoles = new Set<ActorContext["role"]>(["operator", "finance", "administrator", "restricted-payroll"])
const restrictedRoles = new Set<ActorContext["role"]>(["finance", "administrator", "restricted-payroll"])

export function canViewTransaction(actor: ActorContext, transaction: NiaTransaction) {
  if (transaction.classification === "Restricted payroll" && !restrictedRoles.has(actor.role)) return false
  if (actor.role === "member") return actor.memberId === transaction.memberId && transaction.classification !== "Restricted payroll"
  if (actor.role === "partner") return actor.counterpartyId === transaction.counterpartyId && transaction.classification !== "Restricted payroll"
  return true
}

export function canOperateTransaction(actor: ActorContext, transaction: NiaTransaction) {
  if (!transitionRoles.has(actor.role)) return false
  return canViewTransaction(actor, transaction)
}

export function assertBalancedLedger(entries: LedgerEntry[]) {
  if (entries.length < 2) throw new Error("A ledger posting requires at least two entries")
  const debit = entries.filter((entry) => entry.side === "Debit").reduce((sum, entry) => sum + entry.amount, 0)
  const credit = entries.filter((entry) => entry.side === "Credit").reduce((sum, entry) => sum + entry.amount, 0)
  if (debit <= 0 || Math.abs(debit - credit) > 0.001) throw new Error("Ledger entries must balance")
  if (entries.some((entry) => entry.amount <= 0)) throw new Error("Ledger amounts must be positive")
  return true
}

export function projectVerifiedEvent(transaction: NiaTransaction, event: TransactionEvent): ReportingProjection | null {
  if (!event.verified || !event.analyticsAllowed || event.classification === "Restricted payroll") return null
  return {
    projectionId: `projection-${event.id}`,
    sourceEventId: event.id,
    transactionId: transaction.transactionId,
    cluster: event.cluster,
    service: event.service,
    status: event.to,
    amount: event.amount,
    memberSavingsAmount: event.memberSavingsAmount,
    niaMarginAmount: event.niaMarginAmount,
    theatre: event.theatre,
    studio: event.studio,
    occurredAt: event.occurredAt,
    verified: true,
  }
}

export function createTransaction(input: CreateTransactionInput, actor: ActorContext, transactionId: string, eventId: string, openedAt: string): NiaTransaction {
  if (!input.memberId.trim() || !input.memberLabel.trim()) throw new Error("Member is required")
  if (!input.service.trim() || !input.counterpartyId.trim() || !input.ownerId.trim()) throw new Error("Service, counterparty and owner are required")
  if (input.amount !== null && (!Number.isFinite(input.amount) || input.amount < 0)) throw new Error("Amount must be zero or greater")
  const governedService = serviceDefinition(input.service)
  if (!governedService) throw new Error("Service is not in the governed catalogue")
  if (governedService.cluster !== input.cluster || governedService.agent !== input.agent || governedService.classification !== input.classification) throw new Error("Service ownership or classification does not match the governed catalogue")
  if (governedService.requiresAmount && (input.amount === null || input.amount <= 0)) throw new Error("A positive amount is required for this service")
  if (input.cluster === "Essentials" && ((input.memberSavingsAmount ?? 0) <= 0 || (input.niaMarginAmount ?? 0) <= 0)) throw new Error("Essentials requires positive member savings and Nia margin")
  const transaction: NiaTransaction = {
    transactionId,
    memberId: input.memberId.trim(),
    memberLabel: input.memberLabel.trim(),
    cluster: input.cluster,
    service: input.service.trim(),
    agent: input.agent,
    counterpartyId: input.counterpartyId.trim(),
    counterpartyLabel: input.counterpartyLabel.trim(),
    amount: input.amount,
    memberSavingsAmount: input.memberSavingsAmount,
    niaMarginAmount: input.niaMarginAmount,
    currency: "INR",
    status: "Initiated",
    priority: input.priority,
    ownerId: input.ownerId.trim(),
    ownerLabel: input.ownerLabel.trim(),
    theatre: input.theatre.trim(),
    location: input.location.trim(),
    studio: input.studio.trim(),
    paymentMethod: input.paymentMethod,
    settlementReference: null,
    classification: input.classification,
    openedAt,
    updatedAt: openedAt,
    dueAt: input.dueAt,
    evidence: [],
    ledgerEntries: [],
    cases: [],
    events: [],
  }
  transaction.events.push({
    id: eventId, type: "TransactionInitiated", from: null, to: "Initiated", occurredAt: openedAt, actorId: actor.actorId,
    analyticsAllowed: input.classification !== "Restricted payroll", verified: false, classification: input.classification,
    cluster: input.cluster, service: input.service, amount: input.amount, theatre: input.theatre, studio: input.studio,
    memberSavingsAmount: input.memberSavingsAmount, niaMarginAmount: input.niaMarginAmount,
  })
  return transaction
}

export function transitionTransaction(transaction: NiaTransaction, input: TransitionTransactionInput, occurredAt: string, eventId: string) {
  if (transaction.transactionId !== input.transactionId) throw new Error("Transaction does not match the command")
  if (transaction.status !== input.expectedState) throw new Error(`Transaction changed since it was opened. Current state is ${transaction.status}.`)
  if (!input.actorId.trim()) throw new Error("An authorised actor is required")
  if (!canTransition(transaction.status, input.nextState)) throw new Error(`Cannot move ${transaction.status} to ${input.nextState}`)
  if (statesRequiringReason.has(input.nextState) && !input.reason?.trim()) throw new Error(`A reason is required to mark a transaction ${input.nextState}`)
  if (statesRequiringEvidence.has(input.nextState) && transaction.evidence.length === 0 && !input.evidence) throw new Error(`Evidence is required to mark a transaction ${input.nextState}`)
  if ((input.nextState === "Settled" || input.nextState === "Reconciled") && !transaction.settlementReference && !input.settlementReference) {
    throw new Error(`A settlement reference is required to mark a transaction ${input.nextState}`)
  }
  const financialTransitionNeedsPosting = (input.nextState === "Settled" || input.nextState === "Reconciled") && (transaction.amount ?? 0) > 0 && transaction.ledgerEntries.length === 0
  const reversalNeedsPosting = input.nextState === "Reversed" && (transaction.amount ?? 0) > 0
  if ((financialTransitionNeedsPosting || reversalNeedsPosting) && !input.ledgerEntries?.length) throw new Error(`Balanced ledger entries are required to mark a transaction ${input.nextState}`)
  if (input.ledgerEntries?.length) {
    assertBalancedLedger(input.ledgerEntries)
    if (input.ledgerEntries.some((entry) => entry.transactionId !== transaction.transactionId || entry.classification !== transaction.classification || entry.currency !== transaction.currency)) throw new Error("Ledger entries do not match the transaction")
  }

  const event: TransactionEvent = {
    id: eventId,
    type: `Transaction${input.nextState.replaceAll(" ", "")}`,
    from: transaction.status,
    to: input.nextState,
    occurredAt,
    actorId: input.actorId,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    analyticsAllowed: transaction.classification !== "Restricted payroll",
    verified: input.nextState === "Reconciled" || input.nextState === "Closed",
    classification: transaction.classification,
    cluster: transaction.cluster,
    service: transaction.service,
    amount: transaction.amount,
    memberSavingsAmount: transaction.memberSavingsAmount,
    niaMarginAmount: transaction.niaMarginAmount,
    theatre: transaction.theatre,
    studio: transaction.studio,
  }

  let cases = transaction.cases
  if (input.nextState === "Disputed" && !cases.some((item) => item.status === "Open" || item.status === "Investigating")) {
    cases = [...cases, { caseId: `case-${eventId}`, transactionId: transaction.transactionId, kind: "Dispute", status: "Open", ownerId: input.actorId, summary: input.reason!, openedAt: occurredAt, dueAt: transaction.dueAt, closedAt: null }]
  }
  if (transaction.status === "Disputed" && (input.nextState === "Reconciled" || input.nextState === "Closed" || input.nextState === "Reversed")) {
    cases = cases.map((item) => item.status === "Open" || item.status === "Investigating" ? { ...item, status: input.nextState === "Closed" ? "Closed" as const : "Resolved" as const, closedAt: occurredAt } : item)
  }

  return {
    ...transaction,
    status: input.nextState,
    updatedAt: occurredAt,
    settlementReference: input.settlementReference ?? transaction.settlementReference,
    evidence: input.evidence ? [...transaction.evidence, input.evidence] : transaction.evidence,
    events: [...transaction.events, event],
    ledgerEntries: input.ledgerEntries ? [...transaction.ledgerEntries, ...input.ledgerEntries] : transaction.ledgerEntries,
    cases,
  }
}
