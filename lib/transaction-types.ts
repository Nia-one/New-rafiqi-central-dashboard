export const TRANSACTION_CLUSTERS = ["Living", "Work", "Essentials"] as const
export type TransactionCluster = (typeof TRANSACTION_CLUSTERS)[number]

export const TRANSACTION_STATES = [
  "Draft", "Initiated", "Under review", "Approved", "In progress", "Fulfilled",
  "Settling", "Settled", "Reconciled", "Disputed", "Closed", "Cancelled", "Reversed",
] as const
export type TransactionState = (typeof TRANSACTION_STATES)[number]

export type DataClassification = "Operational" | "Sensitive" | "Restricted payroll"

export const OPERATOR_ROLES = ["member", "operator", "finance", "partner", "administrator", "restricted-payroll"] as const
export type OperatorRole = (typeof OPERATOR_ROLES)[number]

export const TRANSACTION_PRIORITIES = ["Routine", "Time sensitive", "Critical"] as const
export type TransactionPriority = (typeof TRANSACTION_PRIORITIES)[number]

export type NiaAgent = "Infra & Community agent" | "Work agent" | "Save agent" | "Remit agent"

export type ActorContext = {
  actorId: string
  email: string
  role: OperatorRole
  memberId?: string
  counterpartyId?: string
}

export type TransactionEvidence = {
  id: string
  kind: "Document" | "Photo" | "Confirmation" | "Provider reference" | "Ledger reference"
  label: string
  recordedAt: string
  recordedBy: string
  classification: DataClassification
}

export type TransactionEvent = {
  id: string
  type: string
  from: TransactionState | null
  to: TransactionState
  occurredAt: string
  actorId: string | null
  reason?: string
  analyticsAllowed: boolean
  verified: boolean
  classification: DataClassification
  cluster: TransactionCluster
  service: string
  amount: number | null
  memberSavingsAmount: number | null
  niaMarginAmount: number | null
  theatre: string
  studio: string
}

export type LedgerEntry = {
  id: string
  transactionId: string
  accountCode: string
  accountLabel: string
  side: "Debit" | "Credit"
  amount: number
  currency: "INR"
  postedAt: string
  postedBy: string
  classification: DataClassification
}

export type TransactionCase = {
  caseId: string
  transactionId: string
  kind: "Exception" | "Dispute" | "Welfare" | "Refund" | "Recovery"
  status: "Open" | "Investigating" | "Resolved" | "Closed"
  ownerId: string
  summary: string
  openedAt: string
  dueAt: string | null
  closedAt: string | null
}

export type ReportingProjection = {
  projectionId: string
  sourceEventId: string
  transactionId: string
  cluster: TransactionCluster
  service: string
  status: TransactionState
  amount: number | null
  memberSavingsAmount: number | null
  niaMarginAmount: number | null
  theatre: string
  studio: string
  occurredAt: string
  verified: true
}

export type NiaTransaction = {
  transactionId: string
  memberId: string
  memberLabel: string
  cluster: TransactionCluster
  service: string
  agent: NiaAgent
  counterpartyId: string
  counterpartyLabel: string
  amount: number | null
  memberSavingsAmount: number | null
  niaMarginAmount: number | null
  currency: "INR"
  status: TransactionState
  priority: TransactionPriority
  ownerId: string
  ownerLabel: string
  theatre: string
  location: string
  studio: string
  paymentMethod: string | null
  settlementReference: string | null
  classification: DataClassification
  openedAt: string
  updatedAt: string
  dueAt: string | null
  evidence: TransactionEvidence[]
  events: TransactionEvent[]
  ledgerEntries: LedgerEntry[]
  cases: TransactionCase[]
}

export type TransitionTransactionInput = {
  transactionId: string
  expectedState: TransactionState
  nextState: TransactionState
  actorId: string
  reason?: string
  evidence?: TransactionEvidence
  settlementReference?: string
  ledgerEntries?: LedgerEntry[]
}

export type CreateTransactionInput = {
  memberId: string
  memberLabel: string
  cluster: TransactionCluster
  service: string
  agent: NiaAgent
  counterpartyId: string
  counterpartyLabel: string
  amount: number | null
  memberSavingsAmount: number | null
  niaMarginAmount: number | null
  ownerId: string
  ownerLabel: string
  theatre: string
  location: string
  studio: string
  priority: TransactionPriority
  paymentMethod: string | null
  classification: DataClassification
  dueAt: string | null
}
