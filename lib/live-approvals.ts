export type ApprovalDomain =
  | "cash-control"
  | "enterprise-demand"
  | "new-adds"
  | "member-engagement"
  | "member-savings"
  | "nia-margins"
  | "nia-growth"
  | "governance"

export type LiveApprovalDecision = "Pending" | "Approved" | "Rejected"

export type LiveApprovalRecord = Readonly<{
  approvalId: string
  linkedActionId: string
  domain: ApprovalDomain
  title: string
  action: string
  owner: string
  ownerActorId: string
  dueAt: string
  amountInr: number
  currentTerms: string
  proposedTerms: string
  businessReason: string
  expectedResult: string
  decision: LiveApprovalDecision
  decisionReason: string
  decidedAt: string
  pending: boolean
  terminal: boolean
  source: "Approval_Log"
  approvalRow: Record<string, unknown>
  actionRow: Record<string, unknown> | null
}>

const rowText = (row: Record<string, unknown> | null | undefined, keys: readonly string[]) => {
  if (!row) return ""
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

const rowNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const rows = (source: any, primary: string, fallback: string) =>
  Array.isArray(source?.[primary]) ? source[primary] as Record<string, unknown>[]
    : Array.isArray(source?.[fallback]) ? source[fallback] as Record<string, unknown>[]
      : []

function matches(value: string, expressions: readonly RegExp[]) {
  return expressions.some((expression) => expression.test(value))
}

export function classifyApprovalDomain(actionRow: Record<string, unknown> | null, approvalRow: Record<string, unknown>): ApprovalDomain {
  const action = [
    rowText(actionRow, ["operating objective", "title"]),
    rowText(actionRow, ["expected metric"]),
    rowText(actionRow, ["required evidence"]),
  ].join(" ").toLowerCase()
  const approval = [
    rowText(approvalRow, ["decision type"]),
    rowText(approvalRow, ["current terms"]),
    rowText(approvalRow, ["proposed terms"]),
    rowText(approvalRow, ["business reason"]),
    rowText(approvalRow, ["expected result"]),
  ].join(" ").toLowerCase()
  const combined = `${action} ${approval}`

  if (matches(action, [/nia margin/, /cm1/, /cm2/, /unit economics/, /margin/])) return "nia-margins"
  if (matches(action, [/nia growth/, /fono/, /franchise/, /shram/, /underwriting/, /expansion/, /contracted nests/])) return "nia-growth"
  if (matches(action, [/enterprise demand/, /named demand/, /headcount/, /demand/, /matching/])) return "enterprise-demand"
  if (matches(action, [/member savings/, /essentials/, /supplier/, /pricing/, /sku/, /stock/, /repeat purchase/])) return "member-savings"
  if (matches(action, [/member engagement/, /attendance/, /churn/, /nps/, /heartbeat/])) return "member-engagement"
  if (matches(action, [/billing.?live/, /member activation/, /new add/, /onboard/, /activation/])) return "new-adds"
  if (matches(action, [/cash/, /collection/, /opex/, /monthly destination/, /finance/])) return "cash-control"

  if (matches(combined, [/margin/, /cm1/, /cm2/, /unit economics/])) return "nia-margins"
  if (matches(combined, [/growth/, /fono/, /franchise/, /shram/, /underwriting/, /expansion/])) return "nia-growth"
  if (matches(combined, [/enterprise demand/, /headcount/, /demand/, /matching/])) return "enterprise-demand"
  if (matches(combined, [/savings/, /essentials/, /supplier/, /pricing/, /sku/, /stock/])) return "member-savings"
  if (matches(combined, [/engagement/, /attendance/, /churn/, /nps/])) return "member-engagement"
  if (matches(combined, [/billing.?live/, /member activation/, /new add/, /onboard/])) return "new-adds"
  if (matches(combined, [/cash/, /collection/, /opex/, /monthly destination/, /financial exception/])) return "cash-control"
  return "governance"
}

export function normaliseApprovalDecision(value: unknown): LiveApprovalDecision {
  const decision = String(value ?? "").trim().toLowerCase()
  if (["approved", "approve", "accepted", "accept"].includes(decision)) return "Approved"
  if (["rejected", "reject", "declined", "decline", "dismissed"].includes(decision)) return "Rejected"
  return "Pending"
}

export function buildLiveApprovals(source: any): readonly LiveApprovalRecord[] {
  const approvalRows = rows(source, "approvals", "approvalLog")
  const actionRows = rows(source, "actions", "actionLog")
  const peopleRows = rows(source, "people", "people")

  return approvalRows.map((approvalRow, index) => {
    const linkedActionId = rowText(approvalRow, ["linked action id"])
    const actionRow = actionRows.find((row) => rowText(row, ["action id", "id"]) === linkedActionId) ?? null
    const ownerActorId = rowText(approvalRow, ["approver actor id"]) || rowText(actionRow, ["owner actor id", "owner"])
    const person = peopleRows.find((row) => rowText(row, ["actor id"]) === ownerActorId)
    const owner = rowText(person, ["display name"]) || ownerActorId || rowText(approvalRow, ["approver role"]) || "Approver not recorded"
    const decision = normaliseApprovalDecision(rowText(approvalRow, ["decision", "status"]))
    const proposedTerms = rowText(approvalRow, ["proposed terms"])
    const businessReason = rowText(approvalRow, ["business reason"])
    return Object.freeze({
      approvalId: rowText(approvalRow, ["approval id", "id"]) || `approval-${index}`,
      linkedActionId,
      domain: classifyApprovalDomain(actionRow, approvalRow),
      title: proposedTerms || rowText(approvalRow, ["decision type"]) || rowText(actionRow, ["operating objective", "title"]) || "Approval decision",
      action: businessReason || proposedTerms || rowText(actionRow, ["required evidence", "operating objective"]) || "Approval action not recorded",
      owner,
      ownerActorId,
      dueAt: rowText(actionRow, ["due at"]),
      amountInr: rowNumber(approvalRow["amount inr"]),
      currentTerms: rowText(approvalRow, ["current terms"]),
      proposedTerms,
      businessReason,
      expectedResult: rowText(approvalRow, ["expected result"]) || rowText(actionRow, ["expected metric"]),
      decision,
      decisionReason: rowText(approvalRow, ["decision reason"]),
      decidedAt: rowText(approvalRow, ["decided at", "updated at"]),
      pending: decision === "Pending",
      terminal: decision !== "Pending",
      source: "Approval_Log" as const,
      approvalRow,
      actionRow,
    })
  })
}

export function approvalsForDomain(source: any, domain: ApprovalDomain, pendingOnly = false) {
  return buildLiveApprovals(source).filter((approval) => approval.domain === domain && (!pendingOnly || approval.pending))
}

export function unlinkedApprovalRequiredActions(source: any) {
  const actionRows = rows(source, "actions", "actionLog")
  const linked = new Set(buildLiveApprovals(source).map((approval) => approval.linkedActionId).filter(Boolean))
  return actionRows.filter((row) => {
    const tier = rowText(row, ["approval tier"]).toLowerCase()
    return tier && !["auto", "none", "not required"].includes(tier) && !linked.has(rowText(row, ["action id", "id"]))
  })
}
