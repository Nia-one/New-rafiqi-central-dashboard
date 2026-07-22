import assert from "node:assert/strict"
import test from "node:test"
import { appendActionLogEntry } from "./action-log"
import { EXECUTION_BLOCK_START, EXECUTION_REPORT_AS_OF, executionActions } from "./execution-data"
import { buildActionChaseQueue, buildDespatchValidationQueue, buildExecutionReport, commitmentBlockChanges, commitmentOutcome, commitmentStatus, createCommitment, shouldCarryForward, validateActionProof, verificationDetails, type CreateCommitmentInput, type ExecutionAction } from "./execution-control"

function input(source: CreateCommitmentInput["source"]): CreateCommitmentInput {
  return {
    source,
    title: "Confirm the named owner.",
    owner: "Asha Rao",
    team: "Living Demand",
    theatre: "Rajputana (NCR)",
    committedBy: source === "meeting_commitment" ? "Asha Rao" : "Allocation engine",
    dueAt: "2026-07-16T12:00:00+05:30",
    route: { screen: "Overview" },
    expectedMetric: { key: "named_owner_rate", label: "Named owner rate", direction: "up", checkWindowDays: 7, baselineValue: 60, actualValue: null, unit: "%" },
    ...(source === "meeting_commitment" ? {
      meetingId: "monthly-review",
      meetingLabel: "Monthly Review",
      meetingDate: "2026-07-15T09:00:00+05:30",
      decisionText: "Name the owner before tomorrow.",
    } : {}),
  }
}

test("system detections and meeting commitments use one downstream action log", () => {
  const detected = createCommitment(input("system_detected"), "2026-07-15T10:00:00+05:30", "detected-1")
  const agreed = createCommitment(input("meeting_commitment"), "2026-07-15T10:00:00+05:30", "meeting-1")
  assert.equal(detected.actionLog[0].action_type, "detect")
  assert.equal(agreed.actionLog[0].action_type, "agree")
  const assignedDetected = { ...detected, actionLog: appendActionLogEntry(detected.actionLog, { queue_item_id: detected.id, actor_id: "asha-rao", action_type: "assign" }, "2026-07-15T10:10:00+05:30", "log-detected-assign") }
  const assignedAgreed = { ...agreed, actionLog: appendActionLogEntry(agreed.actionLog, { queue_item_id: agreed.id, actor_id: "asha-rao", action_type: "assign" }, "2026-07-15T10:10:00+05:30", "log-meeting-assign") }
  assert.equal(commitmentStatus(assignedDetected), "Assigned")
  assert.equal(commitmentStatus(assignedAgreed), "Assigned")
})

test("Closed and Verified are distinct events and verification needs proof or a different checker", () => {
  const valid = executionActions.find((action) => action.id === "exec-hosur-hold")!
  const detail = verificationDetails(valid)
  assert.equal(detail.valid, true)
  assert.notEqual(detail.close?.executed_at, detail.verify?.executed_at)

  const invalid: ExecutionAction = {
    ...valid,
    evidence: [],
    actionLog: valid.actionLog.map((entry) => entry.action_type === "verify" ? { ...entry, actor_id: detail.close?.actor_id ?? null, executed_at: detail.close?.executed_at ?? entry.executed_at } : entry),
  }
  assert.equal(verificationDetails(invalid).valid, false)
})

test("anything not Verified by the next meeting carries into the agenda", () => {
  const footwear = executionActions.find((action) => action.id === "exec-footwear-ageing")!
  assert.equal(shouldCarryForward(footwear, EXECUTION_REPORT_AS_OF), true)
  assert.equal(shouldCarryForward(footwear, "2026-07-14T08:00:00+05:30"), false)
  const report = buildExecutionReport(executionActions, EXECUTION_REPORT_AS_OF)
  assert.deepEqual(report.carryForward.map((action) => action.id), ["exec-footwear-ageing"])
})

test("every commitment requires a metric, direction and check window", () => {
  assert.throws(() => createCommitment({ ...input("system_detected"), expectedMetric: { ...input("system_detected").expectedMetric, key: "" } }, EXECUTION_REPORT_AS_OF, "missing-metric"), /Expected metric is required/)
  assert.throws(() => createCommitment({ ...input("system_detected"), expectedMetric: { ...input("system_detected").expectedMetric, direction: "" as "up", checkWindowDays: 0 } }, EXECUTION_REPORT_AS_OF, "missing-window"), /Expected direction is required|Check window/)
})

test("outcomes show Resolved, Closed but not resolved, and Pending", () => {
  const outcomes = new Set(executionActions.map((action) => commitmentOutcome(action, EXECUTION_REPORT_AS_OF)))
  assert.deepEqual(outcomes, new Set(["Resolved", "Closed but not resolved", "Pending"]))
  const report = buildExecutionReport(executionActions, EXECUTION_REPORT_AS_OF)
  assert.equal(report.resolvedOutcomes, 2)
  assert.equal(report.closedButNotResolved, 1)
  assert.equal(report.pendingOutcomes, 4)
})

test("meeting and People cuts expose separate follow-through rates", () => {
  const report = buildExecutionReport(executionActions, EXECUTION_REPORT_AS_OF)
  assert.equal(report.meetings[0].meetingLabel, "Monthly Operations Review")
  assert.equal(report.meetings[0].closureRate, 75)
  assert.ok(report.people.every((person) => Number.isFinite(person.closureRate) && Number.isFinite(person.closedButNotResolvedRate)))
  assert.equal(report.people.find((person) => person.owner === "Rohan Iyer")?.closedButNotResolvedRate, 100)
})

test("previous-report chase separates owner non-execution from checker delay", () => {
  const report = buildExecutionReport(executionActions, EXECUTION_REPORT_AS_OF)
  const chase = buildActionChaseQueue(report.actions)
  assert.deepEqual(chase.map((action) => action.id), ["exec-chakan-demand", "exec-footwear-ageing"])
  assert.deepEqual(chase.map((action) => action.result), ["Not executed", "Verification overdue"])
})

test("owner proof enters Despatch and validation appends an independent event", () => {
  const queue = buildDespatchValidationQueue(executionActions, EXECUTION_REPORT_AS_OF)
  assert.deepEqual(queue.map((action) => action.id), ["exec-footwear-ageing"])
  const validated = validateActionProof(queue[0], "despatch-validation-team", "2026-07-16T09:00:00+05:30", "despatch-verify")
  assert.equal(commitmentStatus(validated), "Verified")
  assert.equal(validated.actionLog.at(-1)?.actor_id, "despatch-validation-team")
  assert.match(validated.actionLog.at(-1)?.note ?? "", /Despatch validated/)
})

test("previous-block delta includes verified closures and failed outcomes", () => {
  assert.deepEqual(commitmentBlockChanges(executionActions, EXECUTION_BLOCK_START, EXECUTION_REPORT_AS_OF), { verifiedClosures: 1, closedButNotResolved: 1 })
})
