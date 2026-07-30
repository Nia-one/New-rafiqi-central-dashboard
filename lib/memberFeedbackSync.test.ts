import assert from "node:assert/strict";
import test from "node:test";
import { deriveMemberFeedback } from "./memberFeedbackSync";

test("derives backend NPS, feedback and latest-month dashboard metrics from one input", () => {
  const result = deriveMemberFeedback([
    { "member token": "Member A", score: 10, feedback: "Great", "collected at": "2026-06-01", studio: "S1" },
    { "member token": "Member B", score: 6, feedback: "Fix food", "collected at": "2026-07-01", studio: "S1" },
    { "member token": "Member C", score: 9, feedback: "Good", "collected at": "2026-07-02", studio: "S2" },
  ], "2026-07-30T10:00:00.000Z");
  assert.equal(result.responses.length, 3);
  assert.equal(result.feedback.length, 3);
  assert.equal(result.dashboard.find((row) => row.key === "member_nps_feedback_score")?.["value number"], 0);
  assert.equal(result.dashboard.find((row) => row.key === "member_nps_feedback_respondents")?.["value number"], 2);
  assert.equal(result.dashboard.find((row) => row.key === "member_nps_feedback_immediate")?.["value number"], 1);
});

test("rejects incomplete and out-of-range submissions", () => {
  const result = deriveMemberFeedback([
    { "member token": "", score: 9, "collected at": "2026-07-01" },
    { "member token": "Member A", score: 11, "collected at": "2026-07-01" },
  ]);
  assert.equal(result.responses.length, 0);
  assert.equal(result.skipped, 2);
});
