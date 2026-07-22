import type { DataClassification, NiaAgent, TransactionCluster } from "@/lib/transaction-types"

export type ServiceDefinition = {
  code: string
  cluster: TransactionCluster
  name: string
  agent: NiaAgent
  classification: DataClassification
  requiresAmount: boolean
  requiresSettlement: boolean
  savingsMarginRule?: string
}

export const SERVICE_CATALOG: ServiceDefinition[] = [
  { code: "living.move_in", cluster: "Living", name: "Move-in and Nest activation", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: false },
  { code: "living.membership", cluster: "Living", name: "Membership billing and collection", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true },
  { code: "living.utilities", cluster: "Living", name: "Utilities and shared-cost allocation", agent: "Infra & Community agent", classification: "Operational", requiresAmount: true, requiresSettlement: true },
  { code: "living.meals", cluster: "Living", name: "Meal plan fulfilment", agent: "Infra & Community agent", classification: "Operational", requiresAmount: true, requiresSettlement: true },
  { code: "living.maintenance", cluster: "Living", name: "Maintenance and repair", agent: "Infra & Community agent", classification: "Operational", requiresAmount: false, requiresSettlement: false },
  { code: "living.incident", cluster: "Living", name: "Security and incident response", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: false, requiresSettlement: false },
  { code: "living.welfare", cluster: "Living", name: "Health and welfare request", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: false, requiresSettlement: false },
  { code: "living.transfer", cluster: "Living", name: "Room or corridor transfer", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: false, requiresSettlement: false },
  { code: "living.move_out", cluster: "Living", name: "Move-out and deposit closure", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true },
  { code: "work.match", cluster: "Work", name: "Worker passport and job matching", agent: "Work agent", classification: "Sensitive", requiresAmount: false, requiresSettlement: false },
  { code: "work.joining", cluster: "Work", name: "Offer to joining", agent: "Work agent", classification: "Sensitive", requiresAmount: false, requiresSettlement: false },
  { code: "work.attendance", cluster: "Work", name: "Attendance and wage input verification", agent: "Work agent", classification: "Sensitive", requiresAmount: false, requiresSettlement: false },
  { code: "work.payroll", cluster: "Work", name: "Payroll reconciliation", agent: "Work agent", classification: "Restricted payroll", requiresAmount: false, requiresSettlement: false },
  { code: "work.dispute", cluster: "Work", name: "Wage dispute and recovery", agent: "Work agent", classification: "Restricted payroll", requiresAmount: true, requiresSettlement: true },
  { code: "work.redeployment", cluster: "Work", name: "Job switching and redeployment", agent: "Work agent", classification: "Sensitive", requiresAmount: false, requiresSettlement: false },
  { code: "work.exit", cluster: "Work", name: "Employment exit and final settlement", agent: "Work agent", classification: "Restricted payroll", requiresAmount: true, requiresSettlement: true },
  { code: "work.employer_billing", cluster: "Work", name: "Employer billing and collections", agent: "Work agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true },
  { code: "essentials.order", cluster: "Essentials", name: "Member order and fulfilment", agent: "Infra & Community agent", classification: "Operational", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "Member price must be below the approved market benchmark while Nia contribution margin remains positive." },
  { code: "essentials.subscription", cluster: "Essentials", name: "Bundle or subscription", agent: "Infra & Community agent", classification: "Operational", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "Bundle savings must be recorded before approval." },
  { code: "essentials.refund", cluster: "Essentials", name: "Return and refund", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "Refunds must preserve the member entitlement and show the net Nia margin impact." },
  { code: "essentials.vendor", cluster: "Essentials", name: "Vendor purchase order and settlement", agent: "Infra & Community agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "Approved vendor cost must preserve member savings and sustainable margin." },
  { code: "rafiki.save", cluster: "Essentials", name: "Rafiqi Save goal deposit", agent: "Save agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "The member retains the full principal and sees every fee before consent." },
  { code: "rafiki.save_withdrawal", cluster: "Essentials", name: "Rafiqi Save withdrawal", agent: "Save agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "Withdrawal charges cannot exceed the approved disclosed cap." },
  { code: "rafiki.remit", cluster: "Essentials", name: "Rafiqi Remit family transfer", agent: "Remit agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "The delivered amount plus all fees must beat the approved comparable corridor price." },
  { code: "rafiki.remit_retry", cluster: "Essentials", name: "Rafiqi Remit retry or reversal", agent: "Remit agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "The member cannot bear a duplicate fee for a provider failure." },
  { code: "essentials.credit", cluster: "Essentials", name: "Credit disbursement and repayment", agent: "Save agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "Total cost must be disclosed and improve the member outcome against approved alternatives." },
  { code: "essentials.insurance", cluster: "Essentials", name: "Insurance policy and claim", agent: "Save agent", classification: "Sensitive", requiresAmount: true, requiresSettlement: true, savingsMarginRule: "Premium value and claim support must be documented before sale." },
]

export function servicesForCluster(cluster: TransactionCluster) {
  return SERVICE_CATALOG.filter((service) => service.cluster === cluster)
}

export function serviceDefinition(name: string) {
  return SERVICE_CATALOG.find((service) => service.name === name)
}
