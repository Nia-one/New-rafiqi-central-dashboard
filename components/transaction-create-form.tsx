"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { X } from "lucide-react"
import { TokenSelect } from "@/components/token-select"
import { servicesForCluster } from "@/lib/service-catalog"
import type { CreateTransactionInput, NiaTransaction, TransactionCluster, TransactionPriority } from "@/lib/transaction-types"

type TransactionCreateFormProps = {
  onClose: () => void
  onCreated: (transaction: NiaTransaction) => void
}

const theatreByCluster: Record<TransactionCluster, string> = {
  Living: "Deccan (Pune)", Work: "Coromandel (Tamil Nadu)", Essentials: "Wellington (Karnataka)",
}
const PRIORITIES: TransactionPriority[] = ["Routine", "Time sensitive", "Critical"]

export function TransactionCreateForm({ onClose, onCreated }: TransactionCreateFormProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [cluster, setCluster] = useState<TransactionCluster>("Living")
  const services = useMemo(() => servicesForCluster(cluster), [cluster])
  const [serviceName, setServiceName] = useState(services[0].name)
  const [memberId, setMemberId] = useState("MEM-")
  const [memberLabel, setMemberLabel] = useState("")
  const [counterpartyId, setCounterpartyId] = useState("")
  const [counterpartyLabel, setCounterpartyLabel] = useState("")
  const [ownerLabel, setOwnerLabel] = useState("")
  const [amount, setAmount] = useState("")
  const [memberSavingsAmount, setMemberSavingsAmount] = useState("")
  const [niaMarginAmount, setNiaMarginAmount] = useState("")
  const [priority, setPriority] = useState<TransactionPriority>("Routine")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const definition = services.find((service) => service.name === serviceName) ?? services[0]

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLButtonElement>(".token-select-trigger")?.focus()
    return () => previousFocus?.focus()
  }, [])

  function changeCluster(next: TransactionCluster) {
    const nextServices = servicesForCluster(next)
    setCluster(next)
    setServiceName(nextServices[0].name)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const theatre = theatreByCluster[cluster]
    const input: CreateTransactionInput = {
      memberId, memberLabel: memberLabel || memberId, cluster, service: definition.name, agent: definition.agent,
      counterpartyId, counterpartyLabel, amount: amount ? Number(amount) : null,
      memberSavingsAmount: memberSavingsAmount ? Number(memberSavingsAmount) : null,
      niaMarginAmount: niaMarginAmount ? Number(niaMarginAmount) : null,
      ownerId: ownerLabel.toLowerCase().replaceAll(" ", "-"), ownerLabel, theatre,
      location: cluster === "Living" ? "Chakan 04" : cluster === "Work" ? "Sriperumbudur 02" : "Hosur 01",
      studio: cluster === "Living" ? "Chakan 04" : cluster === "Work" ? "Sriperumbudur 02" : "Hosur 01",
      priority, paymentMethod: amount ? "To be confirmed" : null, classification: definition.classification,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
    try {
      const response = await fetch("/api/control/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
      const result = await response.json() as { transaction?: NiaTransaction; error?: string }
      if (!response.ok || !result.transaction) throw new Error(result.error ?? "The transaction could not be created.")
      onCreated(result.transaction)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The transaction could not be created.")
    } finally {
      setSaving(false)
    }
  }

  return <div className="transaction-form-backdrop" role="presentation">
    <section ref={dialogRef} className="transaction-form" role="dialog" aria-modal="true" aria-labelledby="create-transaction-title" onKeyDown={(event) => { if (event.key === "Escape") onClose() }}>
      <header><div><p className="pillar-kicker">NEW CONTROL ITEM</p><h2 id="create-transaction-title">Start a verified workflow</h2></div><button type="button" onClick={onClose} aria-label="Close transaction form"><X aria-hidden /></button></header>
      <form onSubmit={submit}>
        <label>Cluster<TokenSelect ariaLabel="Cluster" value={cluster} options={["Living", "Work", "Essentials"] as const} onChange={changeCluster} /></label>
        <label className="wide">Service<TokenSelect ariaLabel="Service" value={serviceName} options={services.map((service) => ({ value: service.name, label: service.name }))} onChange={setServiceName} /><small>{definition.agent} · {definition.classification}</small></label>
        <label>Member ID<input required value={memberId} onChange={(event) => setMemberId(event.target.value)} /></label>
        <label>Member label<input required value={memberLabel} onChange={(event) => setMemberLabel(event.target.value)} placeholder="Member 0000" /></label>
        <label>Counterparty ID<input required value={counterpartyId} onChange={(event) => setCounterpartyId(event.target.value)} /></label>
        <label>Counterparty name<input required value={counterpartyLabel} onChange={(event) => setCounterpartyLabel(event.target.value)} /></label>
        <label>Owner<input required value={ownerLabel} onChange={(event) => setOwnerLabel(event.target.value)} placeholder="Named operating owner" /></label>
        <label>Amount in INR<input required={definition.requiresAmount} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={definition.requiresAmount ? "Required" : "Optional"} /></label>
        {definition.savingsMarginRule && <><label>Member saving in INR<input required type="number" min="0.01" step="0.01" value={memberSavingsAmount} onChange={(event) => setMemberSavingsAmount(event.target.value)} /></label><label>Nia margin in INR<input required type="number" min="0.01" step="0.01" value={niaMarginAmount} onChange={(event) => setNiaMarginAmount(event.target.value)} /></label></>}
        <label>Priority<TokenSelect ariaLabel="Priority" value={priority} options={PRIORITIES} onChange={setPriority} /></label>
        {definition.savingsMarginRule && <p className="transaction-savings-rule"><strong>Savings-margin gate</strong>{definition.savingsMarginRule}</p>}
        {error && <p className="transaction-form-error" role="alert">{error}</p>}
        <div className="transaction-form-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Starting workflow" : "Start transaction"}</button></div>
      </form>
    </section>
  </div>
}
