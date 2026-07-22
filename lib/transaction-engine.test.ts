import assert from "node:assert/strict"
import test from "node:test"
import { seedTransactions } from "@/lib/transaction-data"
import { assertBalancedLedger, canViewTransaction, createTransaction, projectVerifiedEvent, transitionTransaction } from "@/lib/transaction-engine"
import type { ActorContext, CreateTransactionInput, LedgerEntry } from "@/lib/transaction-types"
import { SERVICE_CATALOG } from "@/lib/service-catalog"

test("rejects an invalid transition", () => {
  assert.throws(() => transitionTransaction(seedTransactions[0], {
    transactionId: seedTransactions[0].transactionId, expectedState: "Approved", nextState: "Closed", actorId: "operator",
  }, "2026-07-16T12:00:00+05:30", "evt-test"), /Cannot move/)
})

test("requires settlement reference before reconciliation", () => {
  const fulfilled = { ...seedTransactions[0], status: "Fulfilled" as const, evidence: [{ id: "ev", kind: "Confirmation" as const, label: "Done", recordedAt: "2026-07-16T12:00:00+05:30", recordedBy: "operator", classification: "Operational" as const }] }
  assert.throws(() => transitionTransaction(fulfilled, {
    transactionId: fulfilled.transactionId, expectedState: "Fulfilled", nextState: "Settled", actorId: "finance",
  }, "2026-07-16T12:00:00+05:30", "evt-test"), /settlement reference/i)
})

test("restricted payroll events never enter analytics", () => {
  const transaction = seedTransactions[3]
  const updated = transitionTransaction(transaction, {
    transactionId: transaction.transactionId, expectedState: "Under review", nextState: "Approved", actorId: "payroll-operator",
  }, "2026-07-16T12:00:00+05:30", "evt-test")
  assert.equal(updated.events.at(-1)?.analyticsAllowed, false)
  assert.equal(projectVerifiedEvent(updated, { ...updated.events.at(-1)!, verified: true }), null)
})

test("reports only receive verified allowlisted events", () => {
  const transaction = seedTransactions[0]
  const unverified = transaction.events[0]
  assert.equal(projectVerifiedEvent(transaction, unverified), null)
  const projection = projectVerifiedEvent(transaction, { ...unverified, verified: true })
  assert.equal(projection?.transactionId, transaction.transactionId)
  assert.equal(projection?.verified, true)
})

test("restricted payroll is only visible to authorised finance roles", () => {
  const transaction = seedTransactions[3]
  const operator: ActorContext = { actorId: "ops", email: "ops@nia.one", role: "operator" }
  const finance: ActorContext = { actorId: "fin", email: "fin@nia.one", role: "finance" }
  assert.equal(canViewTransaction(operator, transaction), false)
  assert.equal(canViewTransaction(finance, transaction), true)
})

test("ledger postings must be balanced", () => {
  const base = { transactionId: "ESS-1", amount: 500, currency: "INR" as const, postedAt: "2026-07-16T12:00:00Z", postedBy: "finance", classification: "Operational" as const }
  const entries: LedgerEntry[] = [
    { ...base, id: "debit", accountCode: "member-wallet", accountLabel: "Member wallet", side: "Debit" },
    { ...base, id: "credit", accountCode: "vendor-payable", accountLabel: "Vendor payable", side: "Credit" },
  ]
  assert.equal(assertBalancedLedger(entries), true)
  assert.throws(() => assertBalancedLedger([{ ...entries[0], amount: 499 }, entries[1]]), /balance/i)
})

test("financial settlement requires and records a balanced posting", () => {
  const transaction = seedTransactions[1]
  assert.throws(() => transitionTransaction(transaction, {
    transactionId: transaction.transactionId, expectedState: "Settling", nextState: "Settled", actorId: "finance",
  }, "2026-07-16T12:00:00+05:30", "evt-settle"), /Balanced ledger entries/)
  const base = { transactionId: transaction.transactionId, amount: transaction.amount!, currency: "INR" as const, postedAt: "2026-07-16T12:00:00+05:30", postedBy: "finance", classification: transaction.classification }
  const settled = transitionTransaction(transaction, {
    transactionId: transaction.transactionId, expectedState: "Settling", nextState: "Settled", actorId: "finance",
    ledgerEntries: [
      { ...base, id: "settle-debit", accountCode: "cash", accountLabel: "Cash", side: "Debit" },
      { ...base, id: "settle-credit", accountCode: "deposit-payable", accountLabel: "Deposit payable", side: "Credit" },
    ],
  }, "2026-07-16T12:00:00+05:30", "evt-settle")
  assert.equal(settled.ledgerEntries.length, 2)
  assert.equal(settled.status, "Settled")
})

test("a dispute opens a named case in the same transaction", () => {
  const transaction = seedTransactions[2]
  const disputed = transitionTransaction(transaction, {
    transactionId: transaction.transactionId, expectedState: "In progress", nextState: "Disputed", actorId: "work-operator", reason: "Joining confirmation is contested",
  }, "2026-07-16T12:00:00+05:30", "evt-dispute")
  assert.equal(disputed.cases.at(-1)?.status, "Open")
  assert.equal(disputed.cases.at(-1)?.ownerId, "work-operator")
})

test("the governed catalogue controls service classification and Essentials economics", () => {
  const actor: ActorContext = { actorId: "admin", email: "admin@nia.one", role: "administrator" }
  const input: CreateTransactionInput = {
    memberId: "MEM-1", memberLabel: "Member 1", cluster: "Essentials", service: "Rafiqi Remit family transfer", agent: "Remit agent",
    counterpartyId: "PARTNER-1", counterpartyLabel: "Partner", amount: 2500, memberSavingsAmount: 80, niaMarginAmount: 20,
    ownerId: "remit", ownerLabel: "Remit", theatre: "Wellington (Karnataka)", location: "Hosur 01", studio: "Hosur 01",
    priority: "Routine", paymentMethod: "UPI", classification: "Sensitive", dueAt: null,
  }
  assert.equal(createTransaction(input, actor, "REM-1", "evt-1", "2026-07-16T12:00:00Z").agent, "Remit agent")
  assert.throws(() => createTransaction({ ...input, classification: "Operational" }, actor, "REM-2", "evt-2", "2026-07-16T12:00:00Z"), /governed catalogue/)
  assert.throws(() => createTransaction({ ...input, niaMarginAmount: 0 }, actor, "REM-3", "evt-3", "2026-07-16T12:00:00Z"), /positive member savings and Nia margin/)
})

test("visible service names use Rafiqi while legacy integration identifiers remain stable", () => {
  const legacyIntegrations = SERVICE_CATALOG.filter((service) => service.code.startsWith("rafiki."))
  assert.equal(legacyIntegrations.length, 4)
  assert.ok(legacyIntegrations.every((service) => service.name.startsWith("Rafiqi ") && !service.name.includes("Rafiki")))
  assert.ok(seedTransactions.every((transaction) => !`${transaction.service} ${transaction.ownerLabel}`.includes("Rafiki")))
  assert.ok(seedTransactions.some((transaction) => transaction.ownerId === "rafiki-save"))
})
