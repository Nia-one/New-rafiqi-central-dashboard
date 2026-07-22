"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, FileCheck2, LockKeyhole, Plus, Search, ShieldCheck, WalletCards } from "lucide-react"
import { TransactionCreateForm } from "@/components/transaction-create-form"
import { availableTransitions, projectVerifiedEvent } from "@/lib/transaction-engine"
import { seedTransactions } from "@/lib/transaction-data"
import type { ActorContext, LedgerEntry, NiaTransaction, TransactionCluster, TransactionState } from "@/lib/transaction-types"

type Workspace = "Operations" | "Finance" | "Member" | "Partner" | "Reporting"
const WORKSPACES: Workspace[] = ["Operations", "Finance", "Member", "Partner", "Reporting"]
const CLUSTER_FILTERS = ["All", "Living", "Work", "Essentials"] as const

function money(value: number | null) {
  return value === null ? "Not applicable" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
}

function workspaceAllows(workspace: Workspace, transaction: NiaTransaction) {
  if (workspace === "Finance") return transaction.amount !== null || transaction.classification === "Restricted payroll" || ["Fulfilled", "Settling", "Settled", "Reconciled"].includes(transaction.status)
  if (workspace === "Member") return transaction.memberId !== "RESTRICTED" && transaction.classification !== "Restricted payroll"
  if (workspace === "Partner") return transaction.classification !== "Restricted payroll"
  if (workspace === "Reporting") return transaction.events.some((event) => projectVerifiedEvent(transaction, event))
  return true
}

function ledgerForTransition(transaction: NiaTransaction, nextState: TransactionState, actorId: string, postedAt: string): LedgerEntry[] | undefined {
  if ((transaction.amount ?? 0) <= 0) return undefined
  const needsInitialPosting = (nextState === "Settled" || nextState === "Reconciled") && transaction.ledgerEntries.length === 0
  const needsReversal = nextState === "Reversed"
  if (!needsInitialPosting && !needsReversal) return undefined
  const base = { transactionId: transaction.transactionId, amount: transaction.amount!, currency: "INR" as const, postedAt, postedBy: actorId, classification: transaction.classification }
  const debitAccount = needsReversal ? { accountCode: "counterparty-payable", accountLabel: "Counterparty payable" } : { accountCode: "member-wallet-clearing", accountLabel: "Member wallet clearing" }
  const creditAccount = needsReversal ? { accountCode: "member-wallet-clearing", accountLabel: "Member wallet clearing" } : { accountCode: "counterparty-payable", accountLabel: "Counterparty payable" }
  return [
    { ...base, id: `ledger-${Date.now()}-debit`, ...debitAccount, side: "Debit" },
    { ...base, id: `ledger-${Date.now()}-credit`, ...creditAccount, side: "Credit" },
  ]
}

export function ControlScreen() {
  const [transactions, setTransactions] = useState<NiaTransaction[]>(seedTransactions)
  const [actor, setActor] = useState<ActorContext | null>(null)
  const [persistence, setPersistence] = useState("loading")
  const [writesEnabled, setWritesEnabled] = useState(false)
  const [workspace, setWorkspace] = useState<Workspace>("Operations")
  const [cluster, setCluster] = useState<TransactionCluster | "All">("All")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState(seedTransactions[0].transactionId)
  const [message, setMessage] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/control/transactions", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { actor?: ActorContext; transactions?: NiaTransaction[]; persistence?: string; writesEnabled?: boolean; error?: string }
        if (!response.ok || !result.transactions) throw new Error(result.error ?? "The operating queue could not be loaded.")
        if (!active) return
        setTransactions(result.transactions)
        setActor(result.actor ?? null)
        setPersistence(result.persistence ?? "unknown")
        setWritesEnabled(Boolean(result.writesEnabled))
        setSelectedId((current) => result.transactions?.some((item) => item.transactionId === current) ? current : result.transactions?.[0]?.transactionId ?? "")
      })
      .catch((error) => { if (active) { setPersistence("seed fallback"); setMessage(error instanceof Error ? `${error.message} Showing safe seed data.` : "Showing safe seed data.") } })
    return () => { active = false }
  }, [])

  const visible = useMemo(() => transactions.filter((item) => workspaceAllows(workspace, item) && (cluster === "All" || item.cluster === cluster) && `${item.transactionId} ${item.memberLabel} ${item.service} ${item.counterpartyLabel} ${item.agent}`.toLowerCase().includes(query.toLowerCase())), [transactions, workspace, cluster, query])
  const selected = transactions.find((item) => item.transactionId === selectedId && workspaceAllows(workspace, item)) ?? visible[0]
  const restricted = transactions.filter((item) => item.classification === "Restricted payroll").length
  const awaitingSettlement = transactions.filter((item) => item.status === "Fulfilled" || item.status === "Settling" || item.status === "Settled").length
  const projections = transactions.flatMap((item) => item.events.map((event) => projectVerifiedEvent(item, event))).filter((item) => item !== null)

  async function move(nextState: TransactionState) {
    if (!selected) return
    setMessage(null)
    const now = new Date().toISOString()
    const ledgerEntries = ledgerForTransition(selected, nextState, actor?.actorId ?? "control-center-operator", now)
    const command = {
      expectedState: selected.status, nextState,
      ...(nextState === "Cancelled" || nextState === "Disputed" || nextState === "Reversed" ? { reason: "Operator review recorded" } : {}),
      ...(nextState === "Settled" || nextState === "Reconciled" ? { settlementReference: selected.settlementReference ?? `SET-${Date.now()}` } : {}),
      ...(nextState === "Fulfilled" || nextState === "Closed" || nextState === "Reversed" ? { evidence: { id: `ev-${Date.now()}`, kind: "Confirmation" as const, label: "Operator confirmation", recordedAt: now, recordedBy: actor?.actorId ?? "control-center-operator", classification: selected.classification } } : {}),
      ...(ledgerEntries ? { ledgerEntries } : {}),
    }
    try {
      const response = await fetch(`/api/control/transactions/${selected.transactionId}/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command) })
      const result = await response.json() as { transaction?: NiaTransaction; error?: string }
      if (!response.ok || !result.transaction) throw new Error(result.error ?? "The transition could not be recorded.")
      setTransactions((items) => items.map((item) => item.transactionId === result.transaction?.transactionId ? result.transaction : item))
      setMessage(`${result.transaction.transactionId} moved to ${result.transaction.status}. The event is now in the local durable preview store.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The transition could not be recorded.")
    }
  }

  function addCreated(transaction: NiaTransaction) {
    setTransactions((items) => [...items, transaction])
    setSelectedId(transaction.transactionId)
    setCreating(false)
    setWorkspace("Operations")
    setCluster(transaction.cluster)
    setMessage(`${transaction.transactionId} started and assigned to ${transaction.ownerLabel}.`)
  }

  return <div className="control-screen">
    <div className="decision-bar"><div><span>TRANSACTION CONTROL</span><strong>Run the work here. Project verified events into reports.</strong></div><p>{writesEnabled ? "Local durable preview" : "Read only"} · Production writes remain disabled</p></div>
    <div className="control-toolbar"><div className="control-workspaces" aria-label="Workflow view">{WORKSPACES.map((item) => <button key={item} className={workspace === item ? "active" : ""} onClick={() => { setWorkspace(item); setMessage(null) }}>{item}</button>)}</div><div className="control-access"><span>{actor?.role ?? "Preview"}</span><small>{persistence.replaceAll("-", " ")}</small>{writesEnabled && (workspace === "Operations" || workspace === "Finance") && <button onClick={() => setCreating(true)}><Plus aria-hidden />New transaction</button>}</div></div>
    <section className="control-metrics" aria-label="Transaction summary">
      <article><WalletCards aria-hidden /><span>OPEN TRANSACTIONS</span><strong>{transactions.filter((item) => !["Closed", "Cancelled", "Reversed"].includes(item.status)).length}</strong><p>Across Living, Work and Essentials</p></article>
      <article><Clock3 aria-hidden /><span>AWAITING SETTLEMENT</span><strong>{awaitingSettlement}</strong><p>Requires finance reconciliation</p></article>
      <article><LockKeyhole aria-hidden /><span>RESTRICTED PAYROLL</span><strong>{restricted}</strong><p>Visible only to restricted roles</p></article>
      <article><ShieldCheck aria-hidden /><span>REPORT PROJECTIONS</span><strong>{projections.length}</strong><p>Verified and analytics allowlisted</p></article>
    </section>
    <section className="transaction-workspace">
      <div className="transaction-list-panel">
        <header><div><p className="pillar-kicker">{workspace.toUpperCase()} QUEUE</p><h2>{workspace === "Reporting" ? "Verified report events" : "Transactions needing action"}</h2></div><label className="transaction-search"><Search aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, member or service" /></label></header>
        <div className="transaction-cluster-filter">{CLUSTER_FILTERS.map((item) => <button key={item} className={cluster === item ? "active" : ""} onClick={() => setCluster(item)}>{item}</button>)}</div>
        <div className="transaction-list">{visible.map((item) => <button key={item.transactionId} className={selected?.transactionId === item.transactionId ? "active" : ""} onClick={() => { setSelectedId(item.transactionId); setMessage(null) }}><span><b>{item.cluster}</b>{item.status}</span><strong>{item.service}</strong><small>{item.transactionId} · {workspace === "Member" ? item.location : item.agent}</small></button>)}{visible.length === 0 && <p className="transaction-empty">No transactions match this view.</p>}</div>
      </div>
      {selected && <article className="transaction-detail">
        <header><div><p className="pillar-kicker">{selected.cluster.toUpperCase()} · {selected.transactionId}</p><h2>{selected.service}</h2><p>{workspace === "Partner" ? selected.memberId : selected.memberLabel} · {selected.counterpartyLabel}</p></div><span className={`transaction-classification ${selected.classification === "Restricted payroll" ? "restricted" : ""}`}>{selected.classification === "Restricted payroll" && <LockKeyhole aria-hidden />}{selected.classification}</span></header>
        {message && <p className="transaction-message" role="status">{message}</p>}
        <dl><div><dt>Current state</dt><dd>{selected.status}</dd></div>{workspace !== "Member" && <div><dt>Owner</dt><dd>{selected.ownerLabel}</dd></div>}<div><dt>Amount</dt><dd>{money(selected.amount)}</dd></div>{selected.cluster === "Essentials" && <><div><dt>Member saving</dt><dd>{money(selected.memberSavingsAmount)}</dd></div><div><dt>Nia margin</dt><dd>{money(selected.niaMarginAmount)}</dd></div></>}<div><dt>Due</dt><dd>{selected.dueAt ? new Date(selected.dueAt).toLocaleString("en-IN") : "No deadline"}</dd></div><div><dt>Payment</dt><dd>{selected.paymentMethod ?? "Not recorded"}</dd></div>{workspace !== "Member" && <div><dt>Settlement</dt><dd>{selected.settlementReference ?? "Pending"}</dd></div>}<div><dt>Agent</dt><dd>{selected.agent}</dd></div><div><dt>Priority</dt><dd>{selected.priority}</dd></div></dl>
        <section><h3><FileCheck2 aria-hidden /> Evidence</h3>{selected.evidence.length ? <ul>{selected.evidence.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{item.kind} · {item.recordedBy}</span></li>)}</ul> : <p>No evidence recorded yet.</p>}</section>
        {(workspace === "Finance" || selected.ledgerEntries.length > 0) && <section><h3><WalletCards aria-hidden /> Balanced ledger</h3>{selected.ledgerEntries.length ? <ul>{selected.ledgerEntries.map((entry) => <li key={entry.id}><strong>{entry.side} · {entry.accountLabel}</strong><span>{money(entry.amount)} · {entry.postedBy}</span></li>)}</ul> : <p>Ledger posting will be required before financial reconciliation.</p>}</section>}
        {selected.cases.length > 0 && <section><h3>Cases and exceptions</h3><ul>{selected.cases.map((item) => <li key={item.caseId}><strong>{item.kind} · {item.status}</strong><span>{item.summary} · {item.ownerId}</span></li>)}</ul></section>}
        {workspace !== "Member" && workspace !== "Partner" && workspace !== "Reporting" && <section><h3><CheckCircle2 aria-hidden /> Next valid actions</h3><div className="transaction-actions">{availableTransitions(selected.status).map((state) => <button key={state} onClick={() => move(state)}>{state}</button>)}</div></section>}
        <section><h3>{workspace === "Reporting" ? "Read-only projection trail" : "Immutable event trail"}</h3><ol className="transaction-events">{[...selected.events].reverse().map((event) => <li key={event.id}><span>{new Date(event.occurredAt).toLocaleString("en-IN")}</span><strong>{event.type}</strong><small>{event.classification === "Restricted payroll" ? "Restricted, never published" : event.verified ? "Verified for reporting" : "Operational only until verified"}</small></li>)}</ol></section>
      </article>}
    </section>
    {creating && <TransactionCreateForm onClose={() => setCreating(false)} onCreated={addCreated} />}
  </div>
}
