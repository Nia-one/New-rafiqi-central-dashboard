import type { ActionLogEntry, ActionType } from "@/lib/action-log"
import type { ActionStatus } from "@/lib/allocation-types"
import type { MemberFeedbackCommitment } from "@/lib/execution-control"
import { categoriseNps, type MemberFeedbackItem, type NpsResponse } from "@/lib/member-feedback"

type LogStep = [ActionType, ActionStatus | null, ActionStatus, string, string | null, string?]

function history(actionId: string, steps: LogStep[]): ActionLogEntry[] {
  return steps.map(([actionType, previousStatus, newStatus, executedAt, actorId, note], index) => ({
    id: `log-${actionId}-${index + 1}`,
    queue_item_id: actionId,
    actor_id: actorId,
    action_type: actionType,
    previous_status: previousStatus,
    new_status: newStatus,
    executed_at: executedAt,
    ...(note ? { note } : {}),
  }))
}

export const memberFeedbackItems: MemberFeedbackItem[] = [
  { id: "feedback-001", actionId: "feedback-action-housekeeping", memberToken: "Member 4C21", pillar: "Living", category: "Housekeeping", theatre: "Deccan (Pune)", studio: "Chakan 04", summary: "Housekeeping was missed twice this week.", capturedAt: "2026-07-14T09:00:00+05:30", source: "Monthly NPS", exitRisk: "Immediate attention", rawConversationRef: "restricted://conversation/feedback-001", npsResponseId: "nps-jul-03" },
  { id: "feedback-002", actionId: "feedback-action-replacement", memberToken: "Member 8H07", pillar: "Work", category: "Job continuity", theatre: "Wellington (Karnataka)", studio: "Hosur 01", summary: "The Member lost a job and needs a new placement.", capturedAt: "2026-07-15T07:00:00+05:30", source: "Monthly NPS", exitRisk: "Immediate attention", rawConversationRef: "restricted://conversation/feedback-002", npsResponseId: "nps-jul-06" },
  { id: "feedback-003", actionId: "feedback-action-curry-quality", memberToken: "Member 9S14", pillar: "Essentials", category: "Curry quality", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02", summary: "Curry quality fell below the Member's expectation twice.", capturedAt: "2026-07-14T16:00:00+05:30", source: "Chatbot", exitRisk: "Immediate attention", rawConversationRef: "restricted://conversation/feedback-003", npsResponseId: null },
  { id: "feedback-004", actionId: "feedback-action-connectivity", memberToken: "Member 2G88", pillar: "Living", category: "Connectivity", theatre: "Rajputana (NCR)", studio: "Gurgaon 05", summary: "Connectivity was unstable during two evening shifts.", capturedAt: "2026-07-12T10:00:00+05:30", source: "Chatbot", exitRisk: "Monitor", rawConversationRef: "restricted://conversation/feedback-004", npsResponseId: null },
  { id: "feedback-005", actionId: "feedback-action-curry-availability", memberToken: "Member 6S32", pillar: "Essentials", category: "Curry availability", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02", summary: "The preferred Curry option was unavailable on two evenings.", capturedAt: "2026-07-15T11:00:00+05:30", source: "Monthly NPS", exitRisk: "Watch closely", rawConversationRef: "restricted://conversation/feedback-005", npsResponseId: "nps-jul-04" },
  { id: "feedback-006", actionId: "feedback-action-savings", memberToken: "Member 1H42", pillar: "Essentials", category: "Savings transaction", theatre: "Wellington (Karnataka)", studio: "Hosur 01", summary: "A savings transaction was delayed beyond the promised time.", capturedAt: "2026-07-10T15:00:00+05:30", source: "Monthly NPS", exitRisk: "Monitor", rawConversationRef: "restricted://conversation/feedback-006", npsResponseId: "nps-jul-02" },
  { id: "feedback-007", actionId: "feedback-action-membership-fee", memberToken: "Member 3C19", pillar: "Living", category: "Membership fee", theatre: "Deccan (Pune)", studio: "Chakan 04", summary: "The Member could not understand a Membership fee adjustment.", capturedAt: "2026-07-14T07:00:00+05:30", source: "Monthly NPS", exitRisk: "Immediate attention", rawConversationRef: "restricted://conversation/feedback-007", npsResponseId: "nps-jul-07" },
  { id: "feedback-008", actionId: "feedback-action-curry-follow-up", memberToken: "Member 5S41", pillar: "Essentials", category: "Curry quality", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02", summary: "The Member asked for more consistent Curry temperature.", capturedAt: "2026-07-14T18:00:00+05:30", source: "Monthly NPS", exitRisk: "Watch closely", rawConversationRef: "restricted://conversation/feedback-008", npsResponseId: "nps-jul-05" },
]

const feedbackByAction = new Map(memberFeedbackItems.map((item) => [item.actionId, item]))

function feedbackAction(input: Omit<MemberFeedbackCommitment, "source" | "memberToken" | "pillar" | "category" | "studio" | "feedbackSummary" | "rawConversationRef" | "npsResponseId" | "meetingId" | "meetingLabel" | "meetingDate" | "decisionText" | "nextMeetingDue">): MemberFeedbackCommitment {
  const feedback = feedbackByAction.get(input.id)
  if (!feedback) throw new Error(`Missing feedback item for ${input.id}`)
  return {
    ...input,
    source: "member_feedback",
    memberToken: feedback.memberToken,
    pillar: feedback.pillar,
    category: feedback.category,
    studio: feedback.studio,
    feedbackSummary: feedback.summary,
    rawConversationRef: feedback.rawConversationRef,
    npsResponseId: feedback.npsResponseId,
    meetingId: null,
    meetingLabel: null,
    meetingDate: null,
    decisionText: null,
    nextMeetingDue: null,
  }
}

/** Illustrative feedback actions. Chatbot capture and NPS ingestion are not connected yet. */
export const memberFeedbackActions: MemberFeedbackCommitment[] = [
  feedbackAction({ id: "feedback-action-housekeeping", title: "Restore the Chakan 04 housekeeping roster and confirm service with the Member.", owner: "Aditi Rao", team: "Living services", theatre: "Deccan (Pune)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-14T18:00:00+05:30", evidence: [], affectedMembers: 1, expectedMetric: { key: "member_service_confirmation", label: "Member confirms service restored", direction: "up", checkWindowDays: 1, baselineValue: 0, actualValue: null, unit: "%" }, actionLog: history("feedback-action-housekeeping", [["detect", null, "Detected", "2026-07-14T09:00:00+05:30", null, "Member feedback captured."], ["assign", "Detected", "Assigned", "2026-07-14T09:10:00+05:30", "aditi-rao", "Owner alert prepared."]]), route: { screen: "Member Feedback" } }),
  feedbackAction({ id: "feedback-action-replacement", title: "Start re-placement for the Hosur 01 Member within four hours.", owner: "Kavya S", team: "Work continuity", theatre: "Wellington (Karnataka)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-15T11:00:00+05:30", evidence: [], affectedMembers: 1, expectedMetric: { key: "placement_started", label: "Re-placement process started", direction: "up", checkWindowDays: 1, baselineValue: 0, actualValue: null, unit: "%" }, actionLog: history("feedback-action-replacement", [["detect", null, "Detected", "2026-07-15T07:00:00+05:30", null, "Member feedback captured."], ["assign", "Detected", "Assigned", "2026-07-15T07:07:00+05:30", "kavya-s", "Owner alert prepared."]]), route: { screen: "Member Feedback" } }),
  feedbackAction({ id: "feedback-action-curry-quality", title: "Replace the Sriperumbudur 02 Curry batch and verify the next meal quality.", owner: "Lakshmi S", team: "Essentials", theatre: "Coromandel (Tamil Nadu)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-15T12:00:00+05:30", evidence: ["Replacement batch reference CUR-218", "Member follow-up scheduled"], affectedMembers: 1, expectedMetric: { key: "next_meal_positive", label: "Member confirms next meal quality", direction: "up", checkWindowDays: 1, baselineValue: 0, actualValue: null, unit: "%" }, actionLog: history("feedback-action-curry-quality", [["detect", null, "Detected", "2026-07-14T16:00:00+05:30", null, "Member feedback captured."], ["assign", "Detected", "Assigned", "2026-07-14T16:08:00+05:30", "lakshmi-s", "Owner alert prepared."], ["resolve", "Assigned", "Resolved", "2026-07-15T08:30:00+05:30", "lakshmi-s", "Replacement batch delivered."], ["close", "Resolved", "Closed", "2026-07-15T09:00:00+05:30", "lakshmi-s", "Owner submitted proof for Despatch."]]), route: { screen: "Member Feedback" } }),
  feedbackAction({ id: "feedback-action-connectivity", title: "Restore stable connectivity at Gurgaon 05 and confirm it with the Member.", owner: "Vikram Singh", team: "Living services", theatre: "Rajputana (NCR)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-13T12:00:00+05:30", evidence: ["Connectivity check GGN-117", "Member confirmation"], affectedMembers: 1, expectedMetric: { key: "connectivity_confirmation", label: "Member confirms stable connectivity", direction: "up", checkWindowDays: 1, baselineValue: 48, actualValue: 100, unit: "%" }, actionLog: history("feedback-action-connectivity", [["detect", null, "Detected", "2026-07-12T10:00:00+05:30", null, "Member feedback captured."], ["assign", "Detected", "Assigned", "2026-07-12T10:06:00+05:30", "vikram-singh"], ["resolve", "Assigned", "Resolved", "2026-07-13T08:30:00+05:30", "vikram-singh"], ["close", "Resolved", "Closed", "2026-07-13T09:00:00+05:30", "vikram-singh"], ["verify", "Closed", "Verified", "2026-07-13T09:30:00+05:30", "despatch-validation-team", "Despatch validated Member confirmation."]]), route: { screen: "Member Feedback" } }),
  feedbackAction({ id: "feedback-action-curry-availability", title: "Restore the preferred Curry option at Sriperumbudur 02 before the evening service.", owner: "Rohan Iyer", team: "Essentials", theatre: "Coromandel (Tamil Nadu)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-15T18:00:00+05:30", evidence: [], affectedMembers: 1, expectedMetric: { key: "curry_availability", label: "Preferred Curry option available", direction: "up", checkWindowDays: 1, baselineValue: 50, actualValue: null, unit: "%" }, actionLog: history("feedback-action-curry-availability", [["detect", null, "Detected", "2026-07-15T11:00:00+05:30", null, "Monthly NPS follow-up captured."], ["assign", "Detected", "Assigned", "2026-07-15T11:05:00+05:30", "rohan-iyer"]]), route: { screen: "Member Feedback" } }),
  feedbackAction({ id: "feedback-action-savings", title: "Complete the delayed savings transaction and confirm the value date.", owner: "Priya Menon", team: "Essentials", theatre: "Wellington (Karnataka)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-11T12:00:00+05:30", evidence: ["Transaction reference SAV-442", "Member confirmation"], affectedMembers: 1, expectedMetric: { key: "savings_completed", label: "Savings transaction completed", direction: "up", checkWindowDays: 1, baselineValue: 0, actualValue: 100, unit: "%" }, actionLog: history("feedback-action-savings", [["detect", null, "Detected", "2026-07-10T15:00:00+05:30", null, "Member feedback captured."], ["assign", "Detected", "Assigned", "2026-07-10T15:04:00+05:30", "priya-menon"], ["resolve", "Assigned", "Resolved", "2026-07-11T09:00:00+05:30", "priya-menon"], ["close", "Resolved", "Closed", "2026-07-11T09:20:00+05:30", "priya-menon"], ["verify", "Closed", "Verified", "2026-07-11T09:45:00+05:30", "despatch-validation-team"]]), route: { screen: "Member Feedback" } }),
  feedbackAction({ id: "feedback-action-membership-fee", title: "Explain the Chakan 04 Membership fee adjustment and confirm Member understanding.", owner: "Neha Kulkarni", team: "Living services", theatre: "Deccan (Pune)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-15T10:00:00+05:30", evidence: [], affectedMembers: 1, expectedMetric: { key: "fee_understanding", label: "Member confirms fee understanding", direction: "up", checkWindowDays: 1, baselineValue: 0, actualValue: null, unit: "%" }, actionLog: history("feedback-action-membership-fee", [["detect", null, "Detected", "2026-07-14T07:00:00+05:30", null, "Monthly NPS follow-up captured."], ["assign", "Detected", "Assigned", "2026-07-14T07:08:00+05:30", "neha-kulkarni"]]), route: { screen: "Member Feedback" } }),
  feedbackAction({ id: "feedback-action-curry-follow-up", title: "Standardise Curry service temperature and confirm the next two meals.", owner: "Lakshmi S", team: "Essentials", theatre: "Coromandel (Tamil Nadu)", committedBy: "RafiQi feedback capture", dueAt: "2026-07-16T12:00:00+05:30", evidence: [], affectedMembers: 1, expectedMetric: { key: "meal_temperature_confirmation", label: "Two meals confirmed by Member", direction: "up", checkWindowDays: 2, baselineValue: 0, actualValue: null, unit: " meals" }, actionLog: history("feedback-action-curry-follow-up", [["detect", null, "Detected", "2026-07-14T18:00:00+05:30", null, "Member feedback captured."], ["assign", "Detected", "Assigned", "2026-07-14T18:05:00+05:30", "lakshmi-s"]]), route: { screen: "Member Feedback" } }),
]

const npsSeed: Array<Omit<NpsResponse, "category">> = [
  { id: "nps-may-01", memberToken: "Member A01", score: 9, followUpText: null, collectedAt: "2026-05-03T10:00:00+05:30", month: "2026-05", theatre: "Rajputana (NCR)", studio: "Gurgaon 05" },
  { id: "nps-may-02", memberToken: "Member A02", score: 9, followUpText: null, collectedAt: "2026-05-05T10:00:00+05:30", month: "2026-05", theatre: "Deccan (Pune)", studio: "Chakan 04" },
  { id: "nps-may-03", memberToken: "Member A03", score: 10, followUpText: null, collectedAt: "2026-05-08T10:00:00+05:30", month: "2026-05", theatre: "Wellington (Karnataka)", studio: "Hosur 01" },
  { id: "nps-may-04", memberToken: "Member A04", score: 8, followUpText: "More Curry choices.", collectedAt: "2026-05-11T10:00:00+05:30", month: "2026-05", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
  { id: "nps-may-05", memberToken: "Member A05", score: 7, followUpText: "Faster service updates.", collectedAt: "2026-05-14T10:00:00+05:30", month: "2026-05", theatre: "Deccan (Pune)", studio: "Chakan 04" },
  { id: "nps-may-06", memberToken: "Member A06", score: 6, followUpText: "Improve connectivity.", collectedAt: "2026-05-18T10:00:00+05:30", month: "2026-05", theatre: "Rajputana (NCR)", studio: "Gurgaon 05" },
  { id: "nps-may-07", memberToken: "Member A07", score: 6, followUpText: "More predictable housekeeping.", collectedAt: "2026-05-22T10:00:00+05:30", month: "2026-05", theatre: "Deccan (Pune)", studio: "Chakan 04" },
  { id: "nps-jun-01", memberToken: "Member B01", score: 10, followUpText: null, collectedAt: "2026-06-02T10:00:00+05:30", month: "2026-06", theatre: "Rajputana (NCR)", studio: "Gurgaon 05" },
  { id: "nps-jun-02", memberToken: "Member B02", score: 9, followUpText: null, collectedAt: "2026-06-05T10:00:00+05:30", month: "2026-06", theatre: "Deccan (Pune)", studio: "Chakan 04" },
  { id: "nps-jun-03", memberToken: "Member B03", score: 9, followUpText: null, collectedAt: "2026-06-07T10:00:00+05:30", month: "2026-06", theatre: "Wellington (Karnataka)", studio: "Hosur 01" },
  { id: "nps-jun-04", memberToken: "Member B04", score: 10, followUpText: null, collectedAt: "2026-06-10T10:00:00+05:30", month: "2026-06", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
  { id: "nps-jun-05", memberToken: "Member B05", score: 8, followUpText: "Faster Work matches.", collectedAt: "2026-06-13T10:00:00+05:30", month: "2026-06", theatre: "Wellington (Karnataka)", studio: "Hosur 01" },
  { id: "nps-jun-06", memberToken: "Member B06", score: 7, followUpText: "Clearer Membership fee messages.", collectedAt: "2026-06-16T10:00:00+05:30", month: "2026-06", theatre: "Deccan (Pune)", studio: "Chakan 04" },
  { id: "nps-jun-07", memberToken: "Member B07", score: 6, followUpText: "Improve Curry availability.", collectedAt: "2026-06-20T10:00:00+05:30", month: "2026-06", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
  { id: "nps-jun-08", memberToken: "Member B08", score: 5, followUpText: "Resolve service requests faster.", collectedAt: "2026-06-24T10:00:00+05:30", month: "2026-06", theatre: "Rajputana (NCR)", studio: "Gurgaon 05" },
  { id: "nps-jul-01", memberToken: "Member 2G88", score: 9, followUpText: null, collectedAt: "2026-07-02T10:00:00+05:30", month: "2026-07", theatre: "Rajputana (NCR)", studio: "Gurgaon 05" },
  { id: "nps-jul-02", memberToken: "Member 1H42", score: 8, followUpText: "Faster savings confirmation.", collectedAt: "2026-07-04T10:00:00+05:30", month: "2026-07", theatre: "Wellington (Karnataka)", studio: "Hosur 01" },
  { id: "nps-jul-03", memberToken: "Member 4C21", score: 8, followUpText: "Keep housekeeping predictable.", collectedAt: "2026-07-06T10:00:00+05:30", month: "2026-07", theatre: "Deccan (Pune)", studio: "Chakan 04" },
  { id: "nps-jul-04", memberToken: "Member 6S32", score: 7, followUpText: "Keep Curry choices available.", collectedAt: "2026-07-08T10:00:00+05:30", month: "2026-07", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
  { id: "nps-jul-05", memberToken: "Member 5S41", score: 6, followUpText: "Keep Curry temperature consistent.", collectedAt: "2026-07-10T10:00:00+05:30", month: "2026-07", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
  { id: "nps-jul-06", memberToken: "Member 8H07", score: 5, followUpText: "Help me find Work again.", collectedAt: "2026-07-12T10:00:00+05:30", month: "2026-07", theatre: "Wellington (Karnataka)", studio: "Hosur 01" },
  { id: "nps-jul-07", memberToken: "Member 3C19", score: 4, followUpText: "Explain Membership fee changes clearly.", collectedAt: "2026-07-14T10:00:00+05:30", month: "2026-07", theatre: "Deccan (Pune)", studio: "Chakan 04" },
  { id: "nps-jul-08", memberToken: "Member 9S14", score: 10, followUpText: null, collectedAt: "2026-07-15T09:00:00+05:30", month: "2026-07", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
]

export const npsResponses: NpsResponse[] = npsSeed.map((response) => ({ ...response, category: categoriseNps(response.score) }))
