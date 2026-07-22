import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { commitmentStatus, createCommitment, type CreateCommitmentInput } from "./execution-control"
import { memberFeedbackActions, memberFeedbackItems, npsResponses } from "./member-feedback-data"
import { buildFeedbackSummary, calculateNps, categoriseNps, CURRENT_NPS_MONTH, MEMBER_FEEDBACK_CAPTURE_FIELDS, MEMBER_FEEDBACK_TAXONOMY, npsFollowUpPrompt, recurringFeedback, shouldAskMonthlyNps } from "./member-feedback"

const memberFeedbackScreen = readFileSync(new URL("../components/member-feedback-screen.tsx", import.meta.url), "utf8")

test("NPS uses the standard Promoter, Passive and Detractor ranges", () => {
  for (const score of [9, 10]) assert.equal(categoriseNps(score), "Promoter")
  for (const score of [7, 8]) assert.equal(categoriseNps(score), "Passive")
  for (const score of [0, 1, 2, 3, 4, 5, 6]) assert.equal(categoriseNps(score), "Detractor")
  assert.throws(() => categoriseNps(11), /0 to 10/)
})

test("the chatbot capture contract covers all three pillars without prohibited housing labels", () => {
  assert.ok(MEMBER_FEEDBACK_TAXONOMY.Living.includes("Nest maintenance"))
  assert.ok(MEMBER_FEEDBACK_TAXONOMY.Work.includes("Job continuity"))
  assert.ok(MEMBER_FEEDBACK_TAXONOMY.Essentials.includes("Telehealth connection"))
  assert.ok(MEMBER_FEEDBACK_TAXONOMY.Essentials.includes("Curry quality"))
  for (const field of ["memberToken", "pillar", "category", "theatre", "studio", "summary", "rawConversationRef"]) assert.ok((MEMBER_FEEDBACK_CAPTURE_FIELDS as readonly string[]).includes(field))
  assert.doesNotMatch(JSON.stringify(MEMBER_FEEDBACK_TAXONOMY), /\b(room|bed|rent|accommodation|housing)\b/i)
})

test("monthly NPS is asked once and never during a live issue", () => {
  assert.equal(shouldAskMonthlyNps(null, CURRENT_NPS_MONTH, false), true)
  assert.equal(shouldAskMonthlyNps(CURRENT_NPS_MONTH, CURRENT_NPS_MONTH, false), false)
  assert.equal(shouldAskMonthlyNps("2026-06", CURRENT_NPS_MONTH, true), false)
  const memberMonths = npsResponses.map((response) => `${response.memberToken}:${response.month}`)
  assert.equal(new Set(memberMonths).size, memberMonths.length)
})

test("Passive and Detractor NPS responses create routable feedback reasons", () => {
  assert.equal(npsFollowUpPrompt(10), null)
  assert.match(npsFollowUpPrompt(8) ?? "", /one thing we could do better/i)
  assert.match(npsFollowUpPrompt(6) ?? "", /one thing we could do better/i)

  const currentFollowUps = npsResponses.filter((response) => response.month === CURRENT_NPS_MONTH && response.category !== "Promoter")
  assert.ok(currentFollowUps.every((response) => response.followUpText?.trim()))
  const linkedNpsIds = new Set(memberFeedbackItems.map((item) => item.npsResponseId).filter(Boolean))
  assert.ok(currentFollowUps.every((response) => linkedNpsIds.has(response.id)))
})

test("every feedback item uses the shared execution lifecycle and a named owner", () => {
  assert.equal(memberFeedbackActions.length, memberFeedbackItems.length)
  for (const item of memberFeedbackItems) {
    const action = memberFeedbackActions.find((candidate) => candidate.id === item.actionId)
    assert.ok(action)
    assert.equal(action.source, "member_feedback")
    assert.equal(action.memberToken, item.memberToken)
    assert.equal(action.pillar, item.pillar)
    assert.equal(action.category, item.category)
    assert.ok(action.owner.trim())
    assert.equal(action.actionLog[0]?.action_type, "detect")
    assert.ok(["Assigned", "Closed", "Verified"].includes(commitmentStatus(action)))
  }
})

test("member feedback can be created on the same commitment table", () => {
  const input: CreateCommitmentInput = {
    source: "member_feedback",
    title: "Restore the named Living service.",
    owner: "Aditi Rao",
    team: "Living services",
    theatre: "Deccan (Pune)",
    committedBy: "RafiQi feedback capture",
    dueAt: "2026-07-16T12:00:00+05:30",
    route: { screen: "Member Feedback" },
    expectedMetric: { key: "member_confirmation", label: "Member confirmation", direction: "up", checkWindowDays: 1, baselineValue: 0, actualValue: null, unit: "%" },
    memberToken: "Member TEST",
    pillar: "Living",
    category: "Housekeeping",
    studio: "Chakan 04",
    feedbackSummary: "Housekeeping service was missed.",
    rawConversationRef: "restricted://conversation/test",
  }
  const action = createCommitment(input, "2026-07-15T10:00:00+05:30", "feedback-test")
  assert.equal(action.source, "member_feedback")
  assert.equal(action.actionLog[0]?.action_type, "detect")
  assert.equal(action.actionLog[0]?.note, "Member feedback captured")
})

test("feedback aggregates state their population and calculate July NPS", () => {
  const summary = buildFeedbackSummary(memberFeedbackItems, memberFeedbackActions, npsResponses)
  assert.equal(summary.feedbackItems, 8)
  assert.equal(summary.openItems, 6)
  assert.equal(summary.immediateAttention, 4)
  assert.deepEqual(calculateNps(npsResponses.filter((response) => response.month === CURRENT_NPS_MONTH)), { score: -13, respondents: 8, promoters: 2, passives: 3, detractors: 3 })
  assert.equal(recurringFeedback(memberFeedbackItems)[0]?.category, "Curry quality")
  assert.match(memberFeedbackScreen, /Population:/)
  assert.match(memberFeedbackScreen, /of \{memberFeedbackItems\.length\}/)
})

test("the ops-facing tab never renders raw conversation references", () => {
  assert.ok(memberFeedbackItems.every((item) => item.rawConversationRef.startsWith("restricted://")))
  assert.doesNotMatch(memberFeedbackScreen, /rawConversationRef|restricted:\/\/conversation/)
  assert.match(memberFeedbackScreen, /Full conversations stay behind restricted references/)
})
