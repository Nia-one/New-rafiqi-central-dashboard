import { commitmentStatus, type ExecutionAction } from "@/lib/execution-control"

export const MEMBER_FEEDBACK_AS_OF = "2026-07-15T14:00:00+05:30"
export const CURRENT_NPS_MONTH = "2026-07"
export const NPS_QUESTION = "On a scale of 0 to 10, how likely are you to recommend Nia to a friend or co-worker?"
export const NPS_FOLLOW_UP = "What's the one thing we could do better?"

export const MEMBER_FEEDBACK_TAXONOMY = {
  Living: ["Nest maintenance", "Housekeeping", "Safety and security", "Connectivity and utilities", "Community conflict", "Membership fee"],
  Work: ["Job continuity", "Placement delay", "Wage or payment", "Placement fit", "Employer treatment", "Contract or paperwork"],
  Essentials: ["Telehealth connection", "Curry quality", "Curry availability", "Consumables order", "Savings or remit", "Financial services", "Document custody", "Account or app guidance"],
  General: ["General Member feedback"],
} as const

export const MEMBER_FEEDBACK_CAPTURE_FIELDS = ["memberToken", "pillar", "category", "theatre", "studio", "summary", "rawConversationRef"] as const

export type FeedbackPillar = "Living" | "Work" | "Essentials" | "General"
export type ExitRisk = "Immediate attention" | "Watch closely" | "Monitor"
export type NpsCategory = "Promoter" | "Passive" | "Detractor"

export type MemberFeedbackItem = {
  id: string
  actionId: string
  memberToken: string
  pillar: FeedbackPillar
  category: string
  theatre: string
  studio: string
  summary: string
  capturedAt: string
  source: "Chatbot" | "Monthly NPS"
  exitRisk: ExitRisk
  rawConversationRef: string
  npsResponseId: string | null
}

export function mapSheetFeedbackItem(row: Record<string, unknown>): MemberFeedbackItem {
  const pillar = String(row.pillar)
  const risk = String(row["exit risk"])
  return {
    id: String(row.id || ""), actionId: String(row["action id"] || ""), memberToken: String(row["member token"] || ""),
    pillar: (["Living", "Work", "Essentials", "General"].includes(pillar) ? pillar : "General") as FeedbackPillar,
    category: String(row.category || "General Member feedback"), theatre: String(row.theatre || ""), studio: String(row.studio || ""),
    summary: String(row.summary || ""), capturedAt: String(row["captured at"] || ""), source: String(row.source) === "Chatbot" ? "Chatbot" : "Monthly NPS",
    exitRisk: (["Immediate attention", "Watch closely", "Monitor"].includes(risk) ? risk : "Monitor") as ExitRisk,
    rawConversationRef: "", npsResponseId: row["nps response id"] ? String(row["nps response id"]) : null,
  }
}

export type NpsResponse = {
  id: string
  memberToken: string
  score: number
  category: NpsCategory
  followUpText: string | null
  collectedAt: string
  month: string
  theatre: string
  studio: string
}

export function categoriseNps(score: number): NpsCategory {
  if (!Number.isInteger(score) || score < 0 || score > 10) throw new Error("NPS score must be a whole number from 0 to 10")
  if (score >= 9) return "Promoter"
  if (score >= 7) return "Passive"
  return "Detractor"
}

export function npsFollowUpPrompt(score: number) {
  return categoriseNps(score) === "Promoter" ? null : NPS_FOLLOW_UP
}

export function shouldAskMonthlyNps(lastAskedMonth: string | null, currentMonth: string, hasActiveIssue: boolean) {
  return !hasActiveIssue && lastAskedMonth !== currentMonth
}

export function calculateNps(responses: NpsResponse[]) {
  const respondents = responses.length
  const promoters = responses.filter((response) => response.category === "Promoter").length
  const passives = responses.filter((response) => response.category === "Passive").length
  const detractors = responses.filter((response) => response.category === "Detractor").length
  const rawScore = respondents === 0 ? null : ((promoters - detractors) / respondents) * 100
  const score = rawScore === null ? null : rawScore < 0 ? -Math.round(Math.abs(rawScore)) : Math.round(rawScore)
  return { score, respondents, promoters, passives, detractors }
}

export function npsByMonth(responses: NpsResponse[]) {
  return [...new Set(responses.map((response) => response.month))]
    .sort()
    .map((month) => ({ month, ...calculateNps(responses.filter((response) => response.month === month)) }))
}

export function npsByDimension(responses: NpsResponse[], dimension: "theatre" | "studio", month: string) {
  const monthResponses = responses.filter((response) => response.month === month)
  return [...new Set(monthResponses.map((response) => response[dimension]))]
    .map((name) => ({ name, ...calculateNps(monthResponses.filter((response) => response[dimension] === name)) }))
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || a.name.localeCompare(b.name))
}

export function recurringFeedback(items: MemberFeedbackItem[]) {
  const groups = new Map<string, { pillar: FeedbackPillar; category: string; count: number; immediateAttention: number }>()
  for (const item of items) {
    const key = `${item.pillar}:${item.category}`
    const current = groups.get(key) ?? { pillar: item.pillar, category: item.category, count: 0, immediateAttention: 0 }
    current.count += 1
    if (item.exitRisk === "Immediate attention") current.immediateAttention += 1
    groups.set(key, current)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.immediateAttention - a.immediateAttention || a.category.localeCompare(b.category))
}

export function feedbackAgeHours(item: MemberFeedbackItem, asOf = MEMBER_FEEDBACK_AS_OF) {
  return Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(item.capturedAt)) / 3_600_000))
}

export function buildFeedbackSummary(items: MemberFeedbackItem[], actions: ExecutionAction[], responses: NpsResponse[]) {
  const actionById = new Map(actions.map((action) => [action.id, action]))
  const currentResponses = responses.filter((response) => response.month === CURRENT_NPS_MONTH)
  const open = items.filter((item) => {
    const action = actionById.get(item.actionId)
    return action ? !["Verified", "Dismissed"].includes(commitmentStatus(action)) : true
  })
  return {
    feedbackItems: items.length,
    openItems: open.length,
    immediateAttention: open.filter((item) => item.exitRisk === "Immediate attention").length,
    currentNps: calculateNps(currentResponses),
  }
}
