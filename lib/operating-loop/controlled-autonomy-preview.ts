import { autonomyPoliciesAt, buildShadowAutonomyEvaluation, evaluateAutonomyReadiness, type ExpectedSignal, type FinalDisposition, type HumanDecision, type ShadowRecommendation } from "@/lib/operating-loop/autonomy-control"
import { buildExceptionOnlyPeopleProjection, buildRoutineLoopSnapshot, type NonPerformanceSignal, type PeopleIntervention, type RoutineException, type RoutineLoopEvent, type RoutineLoopState } from "@/lib/operating-loop/exception-only-operations"
import { SYNTHETIC_AS_OF } from "@/lib/operating-loop/fixtures"
import { buildSyntheticPlatformLearningQueue, type PlatformLearningQueueEntry } from "@/lib/operating-loop/platform-learning"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"

function routineEvent(exceptionId: string, version: number, state: RoutineLoopState, occurredAt: string, note: string, verificationOutcome?: "Passed" | "Failed"): RoutineLoopEvent {
  return { eventId: `${exceptionId}-EVT-${version}`, state, occurredAt, actorId: state === "Independently verified" ? "ACT-VERIFY" : "ACT-ORCHESTRATOR", note, evidenceRef: `protected://phase5/routine/${exceptionId.toLowerCase()}/${version}`, ...(verificationOutcome ? { verificationOutcome } : {}) }
}

const ROUTINE_EXCEPTIONS: readonly RoutineException[] = [
  {
    exceptionId: "ROUT-ESS-001", domain: "Essentials", title: "Restore stock availability", ownerActorId: "ACT-EAE", verifierActorId: "ACT-VERIFY", state: "Closed", botReminderCount: 2, evidenceCount: 2, assignedThroughBot: true, managementInterventionRequired: false, externalMessageSent: false,
    history: [
      routineEvent("ROUT-ESS-001", 1, "Detected", "2026-07-17T06:55:00+05:30", "The governed stockout signal was detected."),
      routineEvent("ROUT-ESS-001", 2, "Assigned through bot", "2026-07-17T07:00:00+05:30", "A synthetic shadow-bot route assigned the internal owner; no external message was sent."),
      routineEvent("ROUT-ESS-001", 3, "Chased", "2026-07-17T07:12:00+05:30", "The system recorded the first SLA chase without management intervention."),
      routineEvent("ROUT-ESS-001", 4, "Evidence collected", "2026-07-17T07:24:00+05:30", "Protected proof was attached by the owner."),
      routineEvent("ROUT-ESS-001", 5, "Independently verified", "2026-07-17T07:35:00+05:30", "An independent verifier confirmed the synthetic outcome.", "Passed"),
      routineEvent("ROUT-ESS-001", 6, "Closed", "2026-07-17T07:36:00+05:30", "The system closed the routine exception after passed verification."),
    ],
  },
  {
    exceptionId: "ROUT-CONT-001", domain: "Member Continuity", title: "Recover a cross-pillar interruption", ownerActorId: "ACT-THEATRE", verifierActorId: "ACT-VERIFY", state: "Reopened", botReminderCount: 1, evidenceCount: 2, assignedThroughBot: true, managementInterventionRequired: false, externalMessageSent: false,
    history: [
      routineEvent("ROUT-CONT-001", 1, "Detected", "2026-07-17T06:50:00+05:30", "The governed continuity signal was detected."),
      routineEvent("ROUT-CONT-001", 2, "Assigned through bot", "2026-07-17T06:56:00+05:30", "A synthetic shadow-bot route assigned the internal owner; no external message was sent."),
      routineEvent("ROUT-CONT-001", 3, "Chased", "2026-07-17T07:08:00+05:30", "The system recorded an SLA chase."),
      routineEvent("ROUT-CONT-001", 4, "Evidence collected", "2026-07-17T07:28:00+05:30", "Cross-pillar proof was collected under protected references."),
      routineEvent("ROUT-CONT-001", 5, "Independently verified", "2026-07-17T07:42:00+05:30", "The initial recovery evidence passed independent review.", "Passed"),
      routineEvent("ROUT-CONT-001", 6, "Closed", "2026-07-17T07:43:00+05:30", "The system closed the verified routine exception."),
      routineEvent("ROUT-CONT-001", 7, "Reopened", "2026-07-17T07:55:00+05:30", "A new verified continuity signal caused the system to reopen the same governed exception."),
    ],
  },
  {
    exceptionId: "ROUT-WORK-001", domain: "Work", title: "Resolve missing activation proof", ownerActorId: "ACT-JCO", verifierActorId: "ACT-VERIFY", state: "Escalated", botReminderCount: 3, evidenceCount: 1, assignedThroughBot: true, managementInterventionRequired: false, externalMessageSent: false,
    history: [
      routineEvent("ROUT-WORK-001", 1, "Detected", "2026-07-17T06:40:00+05:30", "The governed proof gap was detected."),
      routineEvent("ROUT-WORK-001", 2, "Assigned through bot", "2026-07-17T06:45:00+05:30", "A synthetic shadow-bot route assigned the internal owner; no external message was sent."),
      routineEvent("ROUT-WORK-001", 3, "Chased", "2026-07-17T07:00:00+05:30", "The system recorded repeated SLA chases."),
      routineEvent("ROUT-WORK-001", 4, "Evidence collected", "2026-07-17T07:25:00+05:30", "Protected activation proof was collected."),
      routineEvent("ROUT-WORK-001", 5, "Independently verified", "2026-07-17T07:40:00+05:30", "Independent review failed the incomplete proof.", "Failed"),
      routineEvent("ROUT-WORK-001", 6, "Escalated", "2026-07-17T07:41:00+05:30", "The system escalated to the governed functional owner without central management intervention."),
    ],
  },
]

const PEOPLE_SIGNALS: readonly NonPerformanceSignal[] = [
  { signalId: "PERF-EAE-01", actorId: "ACT-EAE", displayName: "Studio EAE", role: "EAE", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", governedGoal: "Every assigned Member exception has a verified resolved outcome by due time.", governedSla: "Proof and independent verification by the action due time.", actualOutcome: "0 verified resolutions for the due action.", impact: "One Member continuity case remained unresolved beyond SLA.", occurredAt: "2026-07-14T17:00:00+05:30", verificationStatus: "Verified", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://phase5/people/eae/recurrence-1" },
  { signalId: "PERF-EAE-02", actorId: "ACT-EAE", displayName: "Studio EAE", role: "EAE", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", governedGoal: "Every assigned Member exception has a verified resolved outcome by due time.", governedSla: "Proof and independent verification by the action due time.", actualOutcome: "0 verified resolutions for the due action.", impact: "A second Member continuity case remained unresolved beyond SLA after counselling.", occurredAt: "2026-07-16T17:00:00+05:30", verificationStatus: "Verified", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://phase5/people/eae/recurrence-2" },
  { signalId: "PERF-EAE-03", actorId: "ACT-EAE", displayName: "Studio EAE", role: "EAE", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", governedGoal: "Every assigned Member exception has a verified resolved outcome by due time.", governedSla: "Proof and independent verification by the action due time.", actualOutcome: "0 verified resolutions for the due action.", impact: "Three verified recurrences left two Members beyond the governed continuity SLA.", occurredAt: "2026-07-17T07:45:00+05:30", verificationStatus: "Verified", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://phase5/people/eae/recurrence-3" },
  { signalId: "PERF-JCO-01", actorId: "ACT-JCO", displayName: "Demand JCO", role: "JCO", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", governedGoal: "Every assigned activation has verified proof by due time.", governedSla: "Proof and independent verification by the action due time.", actualOutcome: "One activation proof missed its due time.", impact: "One activation remained pending.", occurredAt: "2026-07-17T07:20:00+05:30", verificationStatus: "Verified", independentlyVerifiedBy: "ACT-VERIFY", evidenceRef: "protected://phase5/people/jco/single-event" },
  { signalId: "PERF-POOR-01", actorId: "ACT-PENDING", displayName: "Pending source actor", role: "EAE", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", governedGoal: "Every assigned exception has a verified resolved outcome.", governedSla: "By the action due time.", actualOutcome: "Source timestamp is missing.", impact: "Impact cannot be verified.", occurredAt: "2026-07-16T08:00:00+05:30", verificationStatus: "Poor data", independentlyVerifiedBy: null, evidenceRef: "protected://phase5/people/pending/poor-data-1" },
  { signalId: "PERF-POOR-02", actorId: "ACT-PENDING", displayName: "Pending source actor", role: "EAE", metricId: "MET-PEOPLE-RESOLVED-OUTCOME", governedGoal: "Every assigned exception has a verified resolved outcome.", governedSla: "By the action due time.", actualOutcome: "Owner linkage conflicts across sources.", impact: "Impact cannot be verified.", occurredAt: "2026-07-17T07:00:00+05:30", verificationStatus: "Poor data", independentlyVerifiedBy: null, evidenceRef: "protected://phase5/people/pending/poor-data-2" },
]

const PEOPLE_INTERVENTIONS: readonly PeopleIntervention[] = [
  { interventionId: "INT-EAE-BOT-01", actorId: "ACT-EAE", type: "Bot reminder", occurredAt: "2026-07-14T16:20:00+05:30", performedBy: "ACT-ORCHESTRATOR", evidenceRef: "protected://phase5/people/eae/bot-reminder-1" },
  { interventionId: "INT-EAE-COUNSEL-01", actorId: "ACT-EAE", type: "Counselling", occurredAt: "2026-07-15T12:00:00+05:30", performedBy: "ACT-THEATRE", evidenceRef: "protected://phase5/people/eae/counselling-1" },
  { interventionId: "INT-EAE-BOT-02", actorId: "ACT-EAE", type: "Bot reminder", occurredAt: "2026-07-16T16:20:00+05:30", performedBy: "ACT-ORCHESTRATOR", evidenceRef: "protected://phase5/people/eae/bot-reminder-2" },
]

const EXPECTED_SIGNALS: readonly ExpectedSignal[] = [
  { signalId: "SIG-ESS-STOCKOUT", domain: "Essentials", label: "Curry stockout requires an internal recovery task.", occurredAt: "2026-07-17T06:55:00+05:30", independentLabelRef: "protected://phase5/signals/essentials-stockout" },
  { signalId: "SIG-CONTINUITY-RISK", domain: "Member Continuity", label: "Cross-pillar interruption requires owner review.", occurredAt: "2026-07-17T07:05:00+05:30", independentLabelRef: "protected://phase5/signals/continuity-risk" },
  { signalId: "SIG-PAYOUT-EXCEPTION", domain: "People and Execution", label: "Payout exception requires a human financial review.", occurredAt: "2026-07-17T07:12:00+05:30", independentLabelRef: "protected://phase5/signals/payout-exception" },
  { signalId: "SIG-FINANCE-GUARDRAIL", domain: "Finance and Expansion", label: "Cash guardrail breach requires Pushkar review.", occurredAt: "2026-07-17T07:14:00+05:30", independentLabelRef: "protected://phase5/signals/finance-guardrail" },
]

const RECOMMENDATIONS: readonly ShadowRecommendation[] = [
  { recommendationId: "REC-ESS-001", expectedSignalId: "SIG-ESS-STOCKOUT", domain: "Essentials", title: "Assign stock-availability investigation", rationale: "The governed availability record is zero while Member demand remains open.", agentVersion: "orchestrator-shadow-v5.0", recommendedAt: "2026-07-17T07:00:00+05:30", governedChanges: ["operational"], sourceRefs: ["protected://phase5/recommendations/ess-stockout"] },
  { recommendationId: "REC-PEOPLE-001", expectedSignalId: null, domain: "People and Execution", title: "Send a second reporting reminder", rationale: "The agent interpreted a delayed heartbeat as a missing report; independent review found it current.", agentVersion: "orchestrator-shadow-v5.0", recommendedAt: "2026-07-17T07:05:00+05:30", governedChanges: ["operational"], sourceRefs: ["protected://phase5/recommendations/people-reminder"] },
  { recommendationId: "REC-CONT-001", expectedSignalId: "SIG-CONTINUITY-RISK", domain: "Member Continuity", title: "Assign continuity recovery to the Studio EAE", rationale: "Living and Work interruption signals share one governed Member token.", agentVersion: "orchestrator-shadow-v5.0", recommendedAt: "2026-07-17T07:10:00+05:30", governedChanges: ["operational"], sourceRefs: ["protected://phase5/recommendations/continuity-recovery"] },
  { recommendationId: "REC-FIN-001", expectedSignalId: "SIG-FINANCE-GUARDRAIL", domain: "Finance and Expansion", title: "Hold the proposed Studio commitment", rationale: "Projected cash falls below the governed minimum cash guardrail.", agentVersion: "orchestrator-shadow-v5.0", recommendedAt: "2026-07-17T07:15:00+05:30", governedChanges: ["money", "commercial"], sourceRefs: ["protected://phase5/recommendations/finance-hold"] },
]

const DECISIONS: readonly HumanDecision[] = [
  { decisionId: "DEC-ESS-001", recommendationId: "REC-ESS-001", outcome: "Accepted", decidedBy: "ACT-ESSENTIALS", decidedAt: "2026-07-17T07:10:00+05:30", actualDecision: "Accepted the internal investigation; no order, payment or supplier message was sent.", evidenceRef: "protected://phase5/decisions/ess-stockout" },
  { decisionId: "DEC-PEOPLE-001", recommendationId: "REC-PEOPLE-001", outcome: "Rejected", decidedBy: "ACT-THEATRE", decidedAt: "2026-07-17T07:15:00+05:30", actualDecision: "Rejected after the current reporting record was independently confirmed.", evidenceRef: "protected://phase5/decisions/people-reminder" },
  { decisionId: "DEC-CONT-001", recommendationId: "REC-CONT-001", outcome: "Overridden", decidedBy: "ACT-THEATRE", decidedAt: "2026-07-17T07:22:00+05:30", actualDecision: "Overrode the owner assignment to the Theatre lead because the interruption crossed two Studios.", evidenceRef: "protected://phase5/decisions/continuity-recovery" },
  { decisionId: "DEC-FIN-001", recommendationId: "REC-FIN-001", outcome: "Accepted", decidedBy: "Pushkar", decidedAt: "2026-07-17T07:30:00+05:30", actualDecision: "Accepted the shadow recommendation for evaluation; no commitment, pricing or money movement occurred.", evidenceRef: "protected://phase5/decisions/finance-hold" },
]

const DISPOSITIONS: readonly FinalDisposition[] = [
  { dispositionId: "DSP-ESS-001", recommendationId: "REC-ESS-001", outcome: "Verified", independentlyVerified: true, verifiedBy: "ACT-VERIFY", completedAt: "2026-07-17T07:35:00+05:30", actualOutcome: "The internal investigation was correctly assigned and evidenced in the synthetic ledger.", evidenceRef: "protected://phase5/dispositions/ess-stockout", reversed: false, reopened: false },
  { dispositionId: "DSP-PEOPLE-001", recommendationId: "REC-PEOPLE-001", outcome: "Not required", independentlyVerified: false, verifiedBy: null, completedAt: "2026-07-17T07:16:00+05:30", actualOutcome: "The rejected recommendation produced no action to verify.", evidenceRef: "protected://phase5/dispositions/people-reminder", reversed: false, reopened: false },
  { dispositionId: "DSP-CONT-001", recommendationId: "REC-CONT-001", outcome: "Verified", independentlyVerified: true, verifiedBy: "ACT-VERIFY", completedAt: "2026-07-17T07:50:00+05:30", actualOutcome: "The human-selected Theatre owner completed the synthetic recovery review.", evidenceRef: "protected://phase5/dispositions/continuity-recovery", reversed: false, reopened: false },
  { dispositionId: "DSP-FIN-001", recommendationId: "REC-FIN-001", outcome: "Failed", independentlyVerified: true, verifiedBy: "ACT-FIN-VERIFY", completedAt: SYNTHETIC_AS_OF, actualOutcome: "Independent review found stale forecast lineage; the evaluation was reversed and reopened for corrected evidence.", evidenceRef: "protected://phase5/dispositions/finance-hold", reversed: true, reopened: true },
]

export function buildControlledAutonomyPreview(learningQueue: readonly PlatformLearningQueueEntry[] = buildSyntheticPlatformLearningQueue()) {
  const evaluation = buildShadowAutonomyEvaluation({ expectedSignals: EXPECTED_SIGNALS, recommendations: RECOMMENDATIONS, decisions: DECISIONS, dispositions: DISPOSITIONS, recordedAt: SYNTHETIC_AS_OF })
  const policies = autonomyPoliciesAt(SYNTHETIC_AS_OF)
  const routineLoop = buildRoutineLoopSnapshot(ROUTINE_EXCEPTIONS)
  const peopleExceptions = buildExceptionOnlyPeopleProjection(PEOPLE_SIGNALS, PEOPLE_INTERVENTIONS)
  const awaitingSignOff = learningQueue.filter((entry) => entry.evaluation.requiredDisposition === "Human sign-off").length
  const loopHealth = buildLoopHealth({
    asOf: SYNTHETIC_AS_OF,
    feeds: [{ feedId: "platform-learning-queue", label: "Evaluated learning queue", lastUpdatedAt: SYNTHETIC_AS_OF, cadenceMinutes: 1_440, critical: true, affectedClaims: ["Your Sign-Off queue", "Learning history"] }],
    clocks: [],
    verification: { claimed: awaitingSignOff, verified: 0, awaiting: awaitingSignOff, reopened: 0, oldestAwaitingAt: awaitingSignOff > 0 ? SYNTHETIC_AS_OF : null },
    quarantinedRecords: 0,
  })
  return Object.freeze({
    phase: "Phase 5 only" as const,
    mode: "Shadow only" as const,
    writesEnabled: false as const,
    liveReadsEnabled: false as const,
    externalMessagesEnabled: false as const,
    executionAdapterAvailable: false as const,
    source: Object.freeze({ name: "Phase 5 synthetic shadow evaluation", asOf: SYNTHETIC_AS_OF, freshness: "Current" as const, synthetic: true as const }),
    routineLoop,
    peopleExceptions,
    evaluation,
    learningQueue: Object.freeze([...learningQueue]),
    loopHealth,
    policies,
    readiness: Object.freeze({
      lowRisk: evaluateAutonomyReadiness(evaluation.metrics, ["operational"], policies),
      highRisk: evaluateAutonomyReadiness(evaluation.metrics, ["money", "commercial"], policies),
    }),
    systemScorecard: Object.freeze([
      Object.freeze({ label: "Routine-loop ownership", value: `${routineLoop.records.length} system-owned · 0 management-routed`, source: "Action_Log · synthetic shadow route", status: "Covered" as const }),
      Object.freeze({ label: "People exceptions surfaced", value: `${peopleExceptions.surfaced.length} repeated · ${peopleExceptions.withheld.length} withheld`, source: "Verified recurrence + intervention history", status: "Covered" as const }),
      Object.freeze({ label: "Hours saved", value: "No data", source: "No governed definition or source coverage", status: "No data" as const }),
      Object.freeze({ label: "Cost per verified outcome", value: "No data", source: "No governed definition or source coverage", status: "No data" as const }),
      Object.freeze({ label: "Audit completeness", value: `${((evaluation.metrics.auditCompleteness ?? 0) * 100).toFixed(1)}%`, source: "Action_Log + Evidence_Log + Approval_Log", status: "Covered" as const }),
    ]),
  })
}

export type ControlledAutonomyPreview = ReturnType<typeof buildControlledAutonomyPreview>
