import assert from "node:assert/strict"
import test from "node:test"
import { buildRemainingDomainPreview } from "@/lib/operating-loop/remaining-domain-preview"

test("Phase 4 Preview covers all four domains and keeps every live capability disabled", () => {
  const preview = buildRemainingDomainPreview()
  assert.equal(preview.phase, "Phase 4 only")
  assert.equal(preview.mode, "Shadow mode")
  assert.equal(preview.writesEnabled, false)
  assert.equal(preview.liveReadsEnabled, false)
  assert.equal(preview.externalMessagesEnabled, false)
  assert.deepEqual(preview.essentials.accepted.map((record) => record.service), ["Curry", "Save", "Remit"])
  assert.deepEqual(preview.actions.map((action) => action.domain), ["Essentials", "People and Execution", "Member Continuity"])
  assert.deepEqual(preview.governance.reports.map((report) => report.reportType), ["Monthly MIS", "Board draft", "Investor draft"])
})

test("Phase 4 Preview exposes Essentials quarantine, people anomalies and governed retention", () => {
  const preview = buildRemainingDomainPreview()
  assert.equal(preview.essentials.accepted.length, 3)
  assert.equal(preview.essentials.quarantined.length, 1)
  assert.deepEqual(preview.people.people.find((person) => person.actorId === "ACT-EAE")?.flags, ["Missing reporting", "Activity without resolved outcome", "Payout exception"])
  assert.equal(preview.people.people.find((person) => person.actorId === "ACT-EAE")?.incentiveEligibleInr, 0)
  assert.equal(preview.continuity.m6Retention, 0.5)
  assert.equal(preview.continuity.warning, true)
  assert.equal(preview.continuity.memberMasterCreated, false)
})

test("Phase 4 action and report fixtures preserve verification and external-release controls", () => {
  const preview = buildRemainingDomainPreview()
  const closed = preview.actions[0]
  assert.equal(closed.state, "Closed")
  assert.equal(closed.history.at(-2)?.to, "Verified")
  assert.notEqual(closed.ownerActorId, closed.verifierActorId)
  assert.equal(closed.evidence[0]?.protectedRef.startsWith("protected://"), true)
  assert.deepEqual(preview.actions.slice(1).map((action) => action.state), ["Assigned", "Assigned"])
  assert.ok(preview.governance.reports.every((report) => report.externalReleasePermitted === false && report.reportMutationPermitted === false))
  assert.ok(preview.governance.reports.every((report) => report.verifiedFacts.length === 3 && report.excludedFacts.length === 2))
})
