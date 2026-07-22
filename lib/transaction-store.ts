import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { seedTransactions } from "@/lib/transaction-data"
import { createTransaction, transitionTransaction } from "@/lib/transaction-engine"
import type { ActorContext, CreateTransactionInput, NiaTransaction, TransitionTransactionInput } from "@/lib/transaction-types"

function storePath() {
  return resolve(/* turbopackIgnore: true */ process.cwd(), process.env.NIA_LOCAL_STORE_PATH ?? ".nia-control/transactions.json")
}

function cloneSeed() {
  return structuredClone(seedTransactions)
}

export function readTransactions(): NiaTransaction[] {
  const path = storePath()
  if (!existsSync(path)) return cloneSeed()
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown
  if (!Array.isArray(parsed)) throw new Error("The local transaction store is invalid")
  return (structuredClone(parsed) as NiaTransaction[]).map((transaction) => ({
    ...transaction,
    memberSavingsAmount: transaction.memberSavingsAmount ?? null,
    niaMarginAmount: transaction.niaMarginAmount ?? null,
  }))
}

function persistTransactions(transactions: NiaTransaction[]) {
  const path = storePath()
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(transactions, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  renameSync(temporaryPath, path)
}

function prefixFor(input: CreateTransactionInput) {
  if (input.agent === "Save agent") return "SAV"
  if (input.agent === "Remit agent") return "REM"
  return input.cluster === "Living" ? "LIV" : input.cluster === "Work" ? "WRK" : "ESS"
}

export function insertTransaction(input: CreateTransactionInput, actor: ActorContext, now = new Date().toISOString()) {
  const transactions = readTransactions()
  const transaction = createTransaction(input, actor, `${prefixFor(input)}-${now.slice(2, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`, `evt-${randomUUID()}`, now)
  persistTransactions([...transactions, transaction])
  return transaction
}

export function updateTransaction(input: TransitionTransactionInput, now = new Date().toISOString()) {
  const transactions = readTransactions()
  const index = transactions.findIndex((transaction) => transaction.transactionId === input.transactionId)
  if (index < 0) throw new Error("Transaction was not found")
  const updated = transitionTransaction(transactions[index], input, now, `evt-${randomUUID()}`)
  transactions[index] = updated
  persistTransactions(transactions)
  return updated
}
