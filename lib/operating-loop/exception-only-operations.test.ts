import assert from "node:assert/strict"
import test from "node:test"
import { buildExceptionOnlyPeopleProjection, buildRoutineLoopSnapshot, recordHumanStageApproval, ROUTINE_LOOP_STATES, type NonPerformanceSignal, type PeopleIntervention } from "@/lib/operating-loop/exception-only-operations"
import { buildControlledAutonomyPreview } from "@/lib/operating-loop/controlled-autonomy-preview"
import { policyAt } from "@/lib/operating-loop/contracts"

test("the self-driven routine loop covers every lifecycle state without management intervention", () => {
  const { routineLoop } = buildControlledAutonomyPreview()
  assert.deepEqual(routineLoop.stateCoverage.map((item) => item.state), ROUTINE_LOOP_STATES)
  assert.ok(routineLoop.stateCoverage.every((item) => item.count > 0))
  assert.ok(routineLoop.records.every((record) => record.assignedThroughBot && !record.managementInterventionRequired && !record.externalMessageSent))
  assert.ok(routineLoop.records.every((record) => record.ownerActorId !== record.verifierActorId))
  assert.ok(routineLoop.records.every((record) => Object.isFrozen(record.history)))
  const record = routineLoop.records[0]!
  const selfVerified = { ...record, history: record.history.map((event) => event.state === "Independently verified" ? { ...event, actorId: record.ownerActorId } : event) }
  assert.throws(() => buildRoutineLoopSnapshot([selfVerified]), /independent verifier/i)
})

test("people surface only after repeated verified non-performance and a verified recurrence after intervention", () => {
  const { peopleExceptions } = buildControlledAutonomyPreview()
  assert.equal(peopleExceptions.surfaced.length, 1)
  const exception = peopleExceptions.surfaced[0]
  assert.equal(exception?.actorId, "ACT-EAE")
  assert.equal(exception?.stage, "Performance review")
  assert.equal(exception?.recurrenceCount, 3)
  assert.equal(exception?.priorBotReminders.length, 2)
  assert.equal(exception?.priorCounselling.length, 1)
  assert.equal(exception?.evidenceHistory.length, 3)
  assert.equal(exception?.namedHumanApprovalRequired, true)
  assert.equal(exception?.automaticEmploymentDecisionPermitted, false)
  assert.deepEqual(peopleExceptions.withheld.map((item) => item.reason).toSorted(), ["Poor or unverified data", "Single verified event"])
})

test("a prior intervention suppresses the person until a later verified recurrence exists", () => {
  const signals: readonly NonPerformanceSignal[] = [
    { signalId: "SIG-1", actorId: "ACT-1", displayName: "Test actor", role: "EAE", metricId: "MET-1", governedGoal: "Goal", governedSla: "SLA", actualOutcome: "Missed", impact: "Impact", occurredAt: "2026-07-15T08:00:00+05:30", verificationStatus: "Verified", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://test/signal-1" },
    { signalId: "SIG-2", actorId: "ACT-1", displayName: "Test actor", role: "EAE", metricId: "MET-1", governedGoal: "Goal", governedSla: "SLA", actualOutcome: "Missed", impact: "Impact", occurredAt: "2026-07-16T08:00:00+05:30", verificationStatus: "Verified", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://test/signal-2" },
  ]
  const interventions: readonly PeopleIntervention[] = [{ interventionId: "INT-1", actorId: "ACT-1", type: "Counselling", occurredAt: "2026-07-17T08:00:00+05:30", performedBy: "ACT-THEATRE", evidenceRef: "protected://test/counselling" }]
  const result = buildExceptionOnlyPeopleProjection(signals, interventions)
  assert.equal(result.surfaced.length, 0)
  assert.equal(result.withheld[0]?.reason, "No verified recurrence after prior intervention")
})

test("different goals, SLAs and self-verified records cannot create a people exception", () => {
  const base: Omit<NonPerformanceSignal, "signalId" | "metricId" | "governedGoal" | "governedSla" | "occurredAt" | "independentlyVerifiedBy" | "evidenceRef"> = {
    actorId: "ACT-1", displayName: "Test actor", role: "EAE", actualOutcome: "Missed", impact: "Impact", verificationStatus: "Verified",
  }
  const signals: readonly NonPerformanceSignal[] = [
    { ...base, signalId: "SIG-1", metricId: "MET-1", governedGoal: "Goal one", governedSla: "SLA one", occurredAt: "2026-07-15T08:00:00+05:30", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://test/signal-1" },
    { ...base, signalId: "SIG-2", metricId: "MET-2", governedGoal: "Goal two", governedSla: "SLA two", occurredAt: "2026-07-16T08:00:00+05:30", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://test/signal-2" },
    { ...base, signalId: "SIG-3", metricId: "MET-1", governedGoal: "Goal one", governedSla: "SLA one", occurredAt: "2026-07-17T08:00:00+05:30", independentlyVerifiedBy: "ACT-1", evidenceRef: "protected://test/signal-3" },
  ]
  const result = buildExceptionOnlyPeopleProjection(signals, [])
  assert.equal(result.surfaced.length, 0)
  assert.equal(result.withheld[0]?.reason, "No repeated verified goal / SLA")
  assert.equal(result.withheld[0]?.verifiedRecurrences, 1)
})

test("exit review requires a named human and protected legal/process checks but executes no employment action", () => {
  assert.throws(() => recordHumanStageApproval({ approvalId: "APR-EXIT-1", actorId: "ACT-1", stage: "Exit review", approvedBy: "HR lead", approverRole: "HR", approvedAt: "2026-07-17T08:00:00+05:30", evidenceRef: "protected://test/exit-review" }), /legal and process check/i)
  const approval = recordHumanStageApproval({ approvalId: "APR-EXIT-2", actorId: "ACT-1", stage: "Exit review", approvedBy: "HR lead", approverRole: "HR", approvedAt: "2026-07-17T08:00:00+05:30", evidenceRef: "protected://test/exit-review", legalProcessCheckRef: "protected://test/legal-process-check" })
  assert.equal(approval.reviewApproved, true)
  assert.equal(approval.employmentDecisionExecuted, false)
  assert.equal(approval.externalMessageSent, false)
  assert.match(String(policyAt("POL-AUTONOMY-PEOPLE-ESCALATION", "2026-07-17T08:00:00+05:30")?.value), /Coach \/ Counsel → Performance review → Exit review/)
  assert.match(String(policyAt("POL-AUTONOMY-EMPLOYMENT-DECISION", "2026-07-17T08:00:00+05:30")?.value), /HR\/management approval plus legal\/process checks/)
})
