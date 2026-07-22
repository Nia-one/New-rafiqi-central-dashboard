import assert from "node:assert/strict"
import test from "node:test"
import { buildClosedLoopPreview } from "@/lib/operating-loop/preview"

test("synthetic demand closes only after evidence, approval, and independent verification", () => {
  const preview = buildClosedLoopPreview()
  assert.equal(preview.mode, "Shadow mode")
  assert.equal(preview.selectedStudioId, "ST-ORA-01")
  assert.equal(preview.action.state, "Closed")
  assert.equal(preview.action.approvals[0].approvedBy, "Pushkar")
  assert.ok(preview.action.history.findIndex((event) => event.to === "Proof submitted") < preview.action.history.findIndex((event) => event.to === "Verified"))
  assert.notEqual(preview.action.ownerActorId, preview.action.verifierActorId)
  assert.equal(preview.activation.verifiedCount, 240)
})

test("Rafiqi Insights receives a frozen verified allowlist projection", () => {
  const projection = buildClosedLoopPreview().projection
  assert.equal(projection.eventType, "member.activation.verified")
  assert.equal(projection.verificationStatus, "Verified")
  assert.equal(Object.isFrozen(projection), true)
  assert.equal(projection.supplyModel, "FONO")
  assert.match(projection.studioSourceRowIdentity, /:Studio_Master:/)
  assert.deepEqual(Object.keys(projection).toSorted(), ["demandId", "enterpriseId", "eventType", "occurredAt", "sourceRowIdentity", "studioId", "studioSourceRowIdentity", "supplyModel", "synthetic", "theatreId", "verificationStatus", "verifiedActivationCount"].toSorted())
})
