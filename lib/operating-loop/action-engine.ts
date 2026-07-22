import type { SupplyModel } from "@/lib/operating-loop/contracts"

export const ACTION_STATES = [
  "Detected",
  "Proposed",
  "Approved",
  "Auto-approved",
  "Assigned",
  "In progress",
  "Proof submitted",
  "Verified",
  "Closed",
  "Reopened",
  "Escalated",
] as const

export type ActionState = (typeof ACTION_STATES)[number]
export type ApprovalTier = "None" | "Sachin" | "Pushkar"
export type GovernedChange = "operational" | "pricing" | "money" | "deposit" | "capex" | "commercial" | "external-communication" | "configuration" | "irreversible-write"
export const LIVING_PLAYBOOKS = ["FONO gap", "SP gap"] as const
export type LivingPlaybook = (typeof LIVING_PLAYBOOKS)[number]

export type ActionEvidence = {
  evidenceId: string
  protectedRef: string
  submittedBy: string
  submittedAt: string
  description: string
}

export type ActionApproval = {
  approvalId: string
  tier: Exclude<ApprovalTier, "None">
  approvedBy: string
  approvedAt: string
  decision: "Approved"
  note: string
}

export type ActionEvent = {
  eventId: string
  from: ActionState | null
  to: ActionState
  actorId: string
  occurredAt: string
  note: string
  version: number
  supplyModel: SupplyModel
  playbook: LivingPlaybook
}

export type OperatingAction = {
  actionId: string
  demandId: string
  studioId: string
  supplyModel: SupplyModel
  playbook: LivingPlaybook
  title: string
  ownerActorId: string | null
  verifierActorId: string | null
  dueAt: string
  state: ActionState
  version: number
  approvalTier: ApprovalTier
  governedChanges: readonly GovernedChange[]
  metricId: string
  expectedImpact: string
  confidence: number
  evidence: readonly ActionEvidence[]
  approvals: readonly ActionApproval[]
  history: readonly ActionEvent[]
}

const validTransitions: Readonly<Record<ActionState, readonly ActionState[]>> = {
  Detected: ["Proposed"],
  Proposed: ["Approved", "Auto-approved", "Escalated"],
  Approved: ["Assigned"],
  "Auto-approved": ["Assigned"],
  Assigned: ["In progress", "Escalated"],
  "In progress": ["Proof submitted", "Escalated"],
  "Proof submitted": ["Verified", "Reopened", "Escalated"],
  Verified: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Reopened: ["Assigned", "Escalated"],
  Escalated: ["Proposed", "Assigned"],
}

const pushkarChanges = new Set<GovernedChange>(["pricing", "money", "deposit", "capex", "commercial"])
const sachinChanges = new Set<GovernedChange>(["external-communication", "configuration", "irreversible-write"])

export function assertChannelCorrectPlaybook(supplyModel: SupplyModel | null | undefined, playbook: LivingPlaybook | null | undefined) {
  if (supplyModel !== "FONO" && supplyModel !== "SP") throw new Error("A governed FONO or SP supply_model is required for every Living action.")
  const expected = supplyModel === "FONO" ? "FONO gap" : "SP gap"
  if (playbook !== expected) throw new Error(`${supplyModel} actions must use the ${expected} playbook.`)
}

export function requiredApprovalTier(changes: readonly GovernedChange[]): ApprovalTier {
  const requiresPushkar = changes.some((change) => pushkarChanges.has(change))
  const requiresSachin = changes.some((change) => sachinChanges.has(change))
  if (requiresPushkar && requiresSachin) throw new Error("Mixed Pushkar and Sachin authority requires separate governed actions; approval cannot be inferred.")
  if (requiresSachin) return "Sachin"
  if (requiresPushkar) return "Pushkar"
  return "None"
}

export function createOperatingAction(input: Omit<OperatingAction, "state" | "version" | "approvalTier" | "evidence" | "approvals" | "history"> & { at: string; actorId: string }): OperatingAction {
  assertChannelCorrectPlaybook(input.supplyModel, input.playbook)
  const approvalTier = requiredApprovalTier(input.governedChanges)
  const event: ActionEvent = Object.freeze({ eventId: `${input.actionId}-v1`, from: null, to: "Detected", actorId: input.actorId, occurredAt: input.at, note: "Demand signal detected.", version: 1, supplyModel: input.supplyModel, playbook: input.playbook })
  return Object.freeze({
    actionId: input.actionId,
    demandId: input.demandId,
    studioId: input.studioId,
    supplyModel: input.supplyModel,
    playbook: input.playbook,
    title: input.title,
    ownerActorId: input.ownerActorId,
    verifierActorId: input.verifierActorId,
    dueAt: input.dueAt,
    governedChanges: Object.freeze([...input.governedChanges]),
    metricId: input.metricId,
    expectedImpact: input.expectedImpact,
    confidence: input.confidence,
    state: "Detected",
    version: 1,
    approvalTier,
    evidence: Object.freeze([]),
    approvals: Object.freeze([]),
    history: Object.freeze([event]),
  })
}

export function appendEvidence(action: OperatingAction, evidence: ActionEvidence, expectedVersion: number) {
  if (expectedVersion !== action.version) throw new Error(`Stale action version: expected ${action.version}, received ${expectedVersion}.`)
  if (!evidence.protectedRef.startsWith("protected://")) throw new Error("Evidence must use a protected reference.")
  if (action.evidence.some((item) => item.evidenceId === evidence.evidenceId)) throw new Error("Evidence identifiers are append-only and unique.")
  return Object.freeze({ ...action, version: action.version + 1, evidence: Object.freeze([...action.evidence, Object.freeze({ ...evidence })]) })
}

export function appendApproval(action: OperatingAction, approval: ActionApproval, expectedVersion: number) {
  if (expectedVersion !== action.version) throw new Error(`Stale action version: expected ${action.version}, received ${expectedVersion}.`)
  if (action.approvals.some((item) => item.approvalId === approval.approvalId)) throw new Error("Approval identifiers are append-only and unique.")
  if (action.approvalTier === "Pushkar" && (approval.tier !== "Pushkar" || approval.approvedBy !== "Pushkar")) throw new Error("Pushkar approval is required for pricing, money, deposit, capex, and commercial changes.")
  if (action.approvalTier === "Sachin" && (approval.tier !== "Sachin" || approval.approvedBy !== "Sachin")) throw new Error("Sachin approval is required for external communication, configuration, and irreversible writes.")
  return Object.freeze({ ...action, version: action.version + 1, approvals: Object.freeze([...action.approvals, Object.freeze({ ...approval })]) })
}

export type TransitionInput = {
  to: ActionState
  actorId: string
  occurredAt: string
  note: string
  expectedVersion: number
  verifierActorId?: string
}

export function transitionAction(action: OperatingAction, input: TransitionInput): OperatingAction {
  if (input.expectedVersion !== action.version) throw new Error(`Stale action version: expected ${action.version}, received ${input.expectedVersion}.`)
  if (!validTransitions[action.state].includes(input.to)) throw new Error(`Invalid action transition: ${action.state} → ${input.to}.`)
  if (input.to === "Auto-approved" && action.approvalTier !== "None") throw new Error(`${action.approvalTier} approval cannot be bypassed by auto-approval.`)
  if (input.to === "Approved" && action.approvalTier !== "None" && !action.approvals.some((approval) => approval.tier === action.approvalTier)) throw new Error(`${action.approvalTier} approval is required.`)
  if (input.to === "Assigned" && !action.ownerActorId) throw new Error("An action owner is required before assignment.")
  if (input.to === "Proof submitted" && action.evidence.length === 0) throw new Error("Proof cannot be submitted without protected evidence.")
  const verifierActorId = input.verifierActorId ?? action.verifierActorId
  if (input.to === "Verified") {
    assertChannelCorrectPlaybook(action.supplyModel, action.playbook)
    if (!verifierActorId) throw new Error("An independent verifier is required.")
    if (verifierActorId === action.ownerActorId) throw new Error("The verifier must be independent of the action owner.")
    if (action.evidence.length === 0) throw new Error("Verification requires evidence.")
  }
  const version = action.version + 1
  const event: ActionEvent = Object.freeze({ eventId: `${action.actionId}-v${version}`, from: action.state, to: input.to, actorId: input.actorId, occurredAt: input.occurredAt, note: input.note, version, supplyModel: action.supplyModel, playbook: action.playbook })
  return Object.freeze({ ...action, state: input.to, version, verifierActorId, history: Object.freeze([...action.history, event]) })
}
