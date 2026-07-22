import assert from "node:assert/strict"
import test from "node:test"
import { appendApproval, appendEvidence, createOperatingAction, requiredApprovalTier, transitionAction } from "@/lib/operating-loop/action-engine"

function action() {
  return createOperatingAction({ actionId: "A-1", demandId: "D-1", studioId: "S-1", supplyModel: "FONO", playbook: "FONO gap", title: "Test", ownerActorId: "OWNER", verifierActorId: "VERIFY", dueAt: "2026-07-20T00:00:00Z", governedChanges: ["deposit"], metricId: "M-1", expectedImpact: "1", confidence: 0.8, at: "2026-07-17T00:00:00Z", actorId: "DETECTOR" })
}

test("optimistic versioning and transition graph reject stale and invalid writes", () => {
  const current = action()
  assert.throws(() => transitionAction(current, { to: "Assigned", actorId: "X", occurredAt: "2026-07-17T01:00:00Z", note: "skip", expectedVersion: 1 }), /Invalid action transition/)
  assert.throws(() => transitionAction(current, { to: "Proposed", actorId: "X", occurredAt: "2026-07-17T01:00:00Z", note: "stale", expectedVersion: 0 }), /Stale action version/)
})

test("Living actions reject a missing or cross-channel playbook", () => {
  const base = { actionId: "A-2", demandId: "D-2", studioId: "S-2", title: "Channel check", ownerActorId: "OWNER", verifierActorId: "VERIFY", dueAt: "2026-07-20T00:00:00Z", governedChanges: ["operational" as const], metricId: "M-1", expectedImpact: "1", confidence: 0.8, at: "2026-07-17T00:00:00Z", actorId: "DETECTOR" }
  assert.throws(() => createOperatingAction({ ...base, supplyModel: "FONO", playbook: "SP gap" }), /FONO actions must use the FONO gap playbook/)
  assert.throws(() => createOperatingAction({ ...base, supplyModel: undefined as never, playbook: "FONO gap" }), /governed FONO or SP supply_model/)
})

test("Pushkar approval, protected evidence, and an independent verifier are enforced", () => {
  let current = transitionAction(action(), { to: "Proposed", actorId: "DETECTOR", occurredAt: "2026-07-17T01:00:00Z", note: "propose", expectedVersion: 1 })
  assert.throws(() => transitionAction(current, { to: "Auto-approved", actorId: "BOT", occurredAt: "2026-07-17T01:01:00Z", note: "auto", expectedVersion: current.version }), /cannot be bypassed/)
  assert.throws(() => transitionAction(current, { to: "Approved", actorId: "OWNER", occurredAt: "2026-07-17T01:01:00Z", note: "approve", expectedVersion: current.version }), /Pushkar approval is required/)
  current = appendApproval(current, { approvalId: "P-1", tier: "Pushkar", approvedBy: "Pushkar", approvedAt: "2026-07-17T01:01:00Z", decision: "Approved", note: "ok" }, current.version)
  current = transitionAction(current, { to: "Approved", actorId: "Pushkar", occurredAt: "2026-07-17T01:02:00Z", note: "approved", expectedVersion: current.version })
  current = transitionAction(current, { to: "Assigned", actorId: "LEAD", occurredAt: "2026-07-17T01:03:00Z", note: "assigned", expectedVersion: current.version })
  current = transitionAction(current, { to: "In progress", actorId: "OWNER", occurredAt: "2026-07-17T01:04:00Z", note: "work", expectedVersion: current.version })
  assert.throws(() => transitionAction(current, { to: "Proof submitted", actorId: "OWNER", occurredAt: "2026-07-17T01:05:00Z", note: "proof", expectedVersion: current.version }), /without protected evidence/)
  assert.throws(() => appendEvidence(current, { evidenceId: "E-1", protectedRef: "https://public", submittedBy: "OWNER", submittedAt: "2026-07-17T01:05:00Z", description: "bad" }, current.version), /protected reference/)
  current = appendEvidence(current, { evidenceId: "E-1", protectedRef: "protected://evidence/1", submittedBy: "OWNER", submittedAt: "2026-07-17T01:05:00Z", description: "good" }, current.version)
  current = transitionAction(current, { to: "Proof submitted", actorId: "OWNER", occurredAt: "2026-07-17T01:06:00Z", note: "proof", expectedVersion: current.version })
  assert.throws(() => transitionAction(current, { to: "Verified", actorId: "OWNER", verifierActorId: "OWNER", occurredAt: "2026-07-17T01:07:00Z", note: "verify", expectedVersion: current.version }), /independent/)
})

test("Sachin owns external, configuration, and irreversible authority while mixed authority fails closed", () => {
  assert.equal(requiredApprovalTier(["external-communication"]), "Sachin")
  assert.equal(requiredApprovalTier(["configuration"]), "Sachin")
  assert.equal(requiredApprovalTier(["irreversible-write"]), "Sachin")
  assert.equal(requiredApprovalTier(["pricing"]), "Pushkar")
  assert.throws(() => requiredApprovalTier(["pricing", "external-communication"]), /separate governed actions/)
})
