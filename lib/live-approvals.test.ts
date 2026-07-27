import assert from "node:assert/strict"
import test from "node:test"
import { approvalsForDomain, buildLiveApprovals, unlinkedApprovalRequiredActions } from "./live-approvals"

const source = {
  actions: [
    { "action id": "A-CASH", "operating objective": "Approve monthly cash destination", "owner actor id": "P1", "due at": "2026-07-26T14:00:00+05:30", "approval tier": "Finance" },
    { "action id": "A-GROW", "operating objective": "Approve FONO expansion underwriting", "owner actor id": "P2", "approval tier": "CEO" },
  ],
  approvals: [
    { "approval id": "APR-1", "linked action id": "A-CASH", "proposed terms": "Approve cash target", "business reason": "Unlock cascade", "approver actor id": "P1", decision: "Pending" },
  ],
  people: [{ "actor id": "P1", "display name": "Priya" }],
}

test("joins Approval_Log to Action_Log and People_Roster", () => {
  const [approval] = buildLiveApprovals(source)
  assert.equal(approval.linkedActionId, "A-CASH")
  assert.equal(approval.owner, "Priya")
  assert.equal(approval.domain, "cash-control")
  assert.equal(approval.action, "Unlock cascade")
  assert.equal(approval.pending, true)
})

test("filters approvals by dashboard domain", () => {
  assert.equal(approvalsForDomain(source, "cash-control", true).length, 1)
  assert.equal(approvalsForDomain(source, "nia-growth", true).length, 0)
})

test("reports approval-required actions that have no Approval_Log row", () => {
  assert.deepEqual(unlinkedApprovalRequiredActions(source).map((row) => row["action id"]), ["A-GROW"])
})
