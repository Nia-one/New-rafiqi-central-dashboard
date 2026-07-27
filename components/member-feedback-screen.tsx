"use client"

import { useMemo, useState } from "react"
import { ArrowUpRight, Bot, FileLock2, LineChart as LineChartIcon, MessageCircleMore, ShieldCheck } from "lucide-react"
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { commitmentStatus, type ExecutionAction } from "@/lib/execution-control"
import { memberFeedbackItems, npsResponses } from "@/lib/member-feedback-data"
import { buildFeedbackSummary, categoriseNps, feedbackAgeHours, npsByDimension, npsByMonth, NPS_QUESTION, recurringFeedback, type ExitRisk, type MemberFeedbackItem, type NpsResponse } from "@/lib/member-feedback"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"

type FeedbackView = "Early warning" | "NPS and patterns"

const riskRank: Record<ExitRisk, number> = { "Immediate attention": 0, "Watch closely": 1, Monitor: 2 }
const npsConfig = { score: { label: "NPS", color: "var(--chart-1)" } }

function formatAge(hours: number) {
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const remainder = hours % 24
  return remainder ? `${days}d ${remainder}h` : `${days}d`
}
function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(`${month}-01T00:00:00+05:30`))
}

function StatusLabel({ status }: { status: ReturnType<typeof commitmentStatus> }) {
  return <span className={`feedback-status feedback-status-${status.toLowerCase()}`}>{status}</span>
}

function FeedbackQueue({ actions, items, onOpenExecution, onOpenDespatch }: { actions: ExecutionAction[]; items: MemberFeedbackItem[]; onOpenExecution: () => void; onOpenDespatch: () => void }) {
  const actionById = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions])
  const sortedItems = [...items].sort((a, b) => riskRank[a.exitRisk] - riskRank[b.exitRisk] || feedbackAgeHours(b) - feedbackAgeHours(a))

  function openAction(item: MemberFeedbackItem) {
    const action = actionById.get(item.actionId)
    if (action && commitmentStatus(action) === "Closed") onOpenDespatch()
    else onOpenExecution()
  }

  return <section className="feedback-section" aria-labelledby="feedback-queue-title">
    <header className="feedback-section-heading">
      <div><p className="story-kicker">EARLY WARNING QUEUE</p><h2 id="feedback-queue-title">Act before the Member decides to leave.</h2></div>
      <p>Population: all {sortedItems.length} feedback items returned by the Google Sheet.</p>
    </header>
    <OperationalCardStack label="Member feedback early warning queue">
      {sortedItems.map((item) => {
          const action = actionById.get(item.actionId)
          const status = action ? commitmentStatus(action) : "Detected"
          return <OperationalCard key={item.id} title={item.summary} domain={`${item.memberToken} · ${item.pillar} · ${item.category}`} status={item.exitRisk} fields={[{ label: "Owner", value: action ? `${action.owner} · ${action.team}` : "Owner pending" }, { label: "Period", value: `${formatAge(feedbackAgeHours(item))} since capture` }, { label: "Action status", value: status }, { label: "Studio / Theatre", value: `${item.studio} · ${item.theatre}` }, { label: "Source", value: item.source }]}><button type="button" onClick={() => openAction(item)}>{status === "Closed" ? "Open in Despatch" : "Open action"}<ArrowUpRight aria-hidden /></button></OperationalCard>
        })}
    </OperationalCardStack>
    <p className="feedback-population">Showing {sortedItems.length} Sheet-backed feedback items. Member tokens are anonymised.</p>
  </section>
}

function NpsPatterns({ items, responses }: { items: MemberFeedbackItem[]; responses: NpsResponse[] }) {
  const trend = npsByMonth(responses).map((point) => ({ ...point, label: formatMonth(point.month) }))
  const current = trend.at(-1) ?? { month: "", label: "Current", score: null, respondents: 0, promoters: 0, passives: 0, detractors: 0 }
  const previous = trend.at(-2) ?? current
  const theatreNps = npsByDimension(responses, "theatre", current.month)
  const recurring = recurringFeedback(items)
  const movement = (current.score ?? 0) - (previous.score ?? 0)

  return <div className="feedback-patterns">
    <section className="feedback-section feedback-nps-section" aria-labelledby="feedback-nps-title">
      <header className="feedback-section-heading">
        <div><p className="story-kicker">MONTHLY NPS</p><h2 id="feedback-nps-title">{current.label} NPS is {current.score ?? "No data"}. Fix the reasons behind the signal.</h2></div>
        <p>{current.respondents} responses in {current.label}. NPS = Promoters minus Detractors as a share of respondents.</p>
      </header>
      <div className="feedback-nps-layout">
        <div className="feedback-chart">
          <ChartContainer config={npsConfig} className="feedback-chart-canvas">
            <LineChart accessibilityLayer data={trend} margin={{ top: 28, right: 28, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis domain={[-25, 35]} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="linear" dataKey="score" stroke="var(--color-score)" strokeWidth={2.5} dot={{ r: 5, fill: "var(--color-score)" }}>
                <LabelList dataKey="score" position="top" />
              </Line>
            </LineChart>
          </ChartContainer>
          <p><strong>{Math.abs(movement)} points {movement < 0 ? "lower" : "higher"}</strong> than the previous recorded month. The score is based on {current.respondents} {current.label} responses.</p>
        </div>
        <aside className="feedback-nps-rule">
          <LineChartIcon aria-hidden />
          <strong>Ask once per Member each month.</strong>
          <p>Ask only at a natural moment, never while resolving a live issue.</p>
          <blockquote>{NPS_QUESTION}</blockquote>
          <small>Passive and Detractor replies create a feedback item with a named owner.</small>
        </aside>
      </div>
    </section>

    <div className="feedback-pattern-grid">
      <section className="feedback-section" aria-labelledby="feedback-theatre-title">
        <header className="feedback-section-heading"><div><p className="story-kicker">NPS BY THEATRE</p><h2 id="feedback-theatre-title">Start with the lowest Member signal.</h2></div><p>Population: {current.respondents} {current.label} responses across {theatreNps.length} Theatres.</p></header>
        <div className="feedback-table-wrap" role="region" aria-label="NPS by Theatre" tabIndex={0}>
          <table className="feedback-aggregate-table"><thead><tr><th scope="col">Theatre</th><th scope="col" className="numeric">NPS</th><th scope="col" className="numeric">Responses</th><th scope="col" className="numeric">Detractors</th></tr></thead><tbody>{theatreNps.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td className="numeric"><strong>{row.score}</strong></td><td className="numeric">{row.respondents}</td><td className="numeric">{row.detractors}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="feedback-section" aria-labelledby="feedback-recurring-title">
        <header className="feedback-section-heading"><div><p className="story-kicker">RECURRING CAUSES</p><h2 id="feedback-recurring-title">Fix the pattern, not only the latest item.</h2></div><p>Population: all {items.length} Sheet-backed feedback items.</p></header>
        <ol className="feedback-recurring-list">{recurring.map((row, index) => <li key={`${row.pillar}-${row.category}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{row.category}</strong><p>{row.pillar} · {row.count} of {memberFeedbackItems.length} feedback items</p></div><b>{row.immediateAttention} immediate</b></li>)}</ol>
      </section>
    </div>
  </div>
}

export function MemberFeedbackScreen({ actions, onOpenExecution, onOpenDespatch, liveOpsData }: { actions: ExecutionAction[]; onOpenExecution: () => void; onOpenDespatch: () => void; liveOpsData?: any }) {
  const [view, setView] = useState<FeedbackView>("Early warning")
  const [openSection, setOpenSection] = useState(-1)
  const liveFeedbackRows = liveOpsData?.memberNpsFeedback ?? []
  const liveResponseRows = liveOpsData?.memberNpsResponses ?? []
  const feedbackItems: MemberFeedbackItem[] = liveFeedbackRows.length ? liveFeedbackRows.map((row: Record<string, any>) => ({
    id: String(row.id || ""), actionId: String(row["action id"] || ""), memberToken: String(row["member token"] || ""), pillar: (["Living", "Work", "Essentials", "General"].includes(String(row.pillar)) ? row.pillar : "General") as MemberFeedbackItem["pillar"], category: String(row.category || "General Member feedback"), theatre: String(row.theatre || ""), studio: String(row.studio || ""), summary: String(row.summary || ""), capturedAt: String(row["captured at"] || ""), source: String(row.source) === "Chatbot" ? "Chatbot" : "Monthly NPS", exitRisk: (["Immediate attention", "Watch closely", "Monitor"].includes(String(row["exit risk"])) ? row["exit risk"] : "Monitor") as ExitRisk, rawConversationRef: String(row["raw conversation ref"] || ""), npsResponseId: row["nps response id"] ? String(row["nps response id"]) : null,
  })) : memberFeedbackItems
  const responses: NpsResponse[] = liveResponseRows.length ? liveResponseRows.map((row: Record<string, any>) => {
    const score = Number(row.score)
    return { id: String(row.id || ""), memberToken: String(row["member token"] || ""), score, category: categoriseNps(score), followUpText: row["follow up text"] ? String(row["follow up text"]) : null, collectedAt: String(row["collected at"] || ""), month: String(row.month || String(row["collected at"] || "").slice(0, 7)), theatre: String(row.theatre || ""), studio: String(row.studio || "") }
  }) : npsResponses
  const summary = buildFeedbackSummary(feedbackItems, actions, responses)
  const dashboard = liveOpsData?.memberNpsDashboard ?? []
  const dashboardValue = (key: string, fallback: string) => String(dashboard.find((row: Record<string, any>) => String(row.key || "").trim() === key)?.["value text"] || fallback)
  const dashboardMetric = (key: string, fallback: number) => { const raw = dashboard.find((row: Record<string, any>) => String(row.key || "").trim() === key)?.["value number"]; if (raw === undefined || raw === null || raw === "") return fallback; const value = Number(raw); return Number.isFinite(value) ? value : fallback }
  const feedbackCaptured = dashboardMetric("member_nps_feedback_captured", summary.feedbackItems)
  const feedbackOpen = dashboardMetric("member_nps_feedback_open", summary.openItems)
  const feedbackImmediate = dashboardMetric("member_nps_feedback_immediate", summary.immediateAttention)
  const feedbackScore = dashboardMetric("member_nps_feedback_score", summary.currentNps.score)
  const feedbackRespondents = dashboardMetric("member_nps_feedback_respondents", summary.currentNps.respondents)
  const feedbackDetractors = dashboardMetric("member_nps_feedback_detractors", summary.currentNps.detractors)

  return <DashboardSectionAccordion className="member-feedback-screen" ariaLabel="Member NPS sections" openIndex={openSection} onOpenIndexChange={setOpenSection} sections={[
    { title: dashboardValue("member_nps_connector_title", "Connector status"), summary: dashboardValue("member_nps_connector_summary", "Capture is designed; chatbot and NPS connectors are not live.") },
    { title: dashboardValue("member_nps_closure_title", "Closure loop"), summary: dashboardValue("member_nps_closure_summary", "Member speaks · RafiQi structures · owner fixes · Despatch verifies") },
    { title: dashboardValue("member_nps_feedback_title", "Feedback summary"), summary: dashboardValue("member_nps_feedback_summary", "{open} open · NPS {score} from {respondents} responses").replaceAll("{open}", String(feedbackOpen)).replaceAll("{score}", String(feedbackScore)).replaceAll("{respondents}", String(feedbackRespondents)) },
    { title: "View", summary: `${view} · switch between action queue and NPS patterns` },
    { title: view, summary: view === "Early warning" ? `${summary.immediateAttention} items need immediate attention` : `July NPS ${summary.currentNps.score} · recurring causes retained` },
    { title: dashboardValue("member_nps_privacy_title", "Privacy"), summary: dashboardValue("member_nps_privacy_summary", "Anonymised Member tokens only; conversations remain restricted.") },
  ]}>
    <section className="feedback-connector-note" aria-label="Member feedback data connection status">
      <div><Bot aria-hidden /><p><strong>{dashboardValue("member_nps_connector_headline", "Capture is designed. The connectors are not live yet.")}</strong><span>{dashboardValue("member_nps_connector_detail", "Chatbot and NPS responses will create Member feedback actions in the shared execution log.")}</span></p></div>
      <p>{dashboardValue("member_nps_connector_timestamp", "Illustrative operating data · 15 Jul, 14:00 IST")}</p>
    </section>

    <section className="feedback-loop-band" aria-label="Member feedback closure loop">
      <div><MessageCircleMore aria-hidden /><strong>{dashboardValue("member_nps_closure_stage_1", "Member speaks")}</strong><span>{dashboardValue("member_nps_closure_stage_1_note", "Natural conversation")}</span></div><i aria-hidden>→</i>
      <div><Bot aria-hidden /><strong>{dashboardValue("member_nps_closure_stage_2", "RafiQi structures")}</strong><span>{dashboardValue("member_nps_closure_stage_2_note", "Pillar, cause, Studio")}</span></div><i aria-hidden>→</i>
      <div><ShieldCheck aria-hidden /><strong>{dashboardValue("member_nps_closure_stage_3", "Owner fixes")}</strong><span>{dashboardValue("member_nps_closure_stage_3_note", "Action and proof")}</span></div><i aria-hidden>→</i>
      <div><FileLock2 aria-hidden /><strong>{dashboardValue("member_nps_closure_stage_4", "Despatch verifies")}</strong><span>{dashboardValue("member_nps_closure_stage_4_note", "Member hears closure")}</span></div>
    </section>

    <section className="feedback-summary" data-kpi-group aria-label="Member feedback summary">
      <article><span>{dashboardValue("member_nps_feedback_captured_label", "Feedback captured")}</span><strong>{feedbackCaptured}</strong><p>{dashboardValue("member_nps_feedback_captured_note", "All feedback items captured")}</p></article>
      <article><span>{dashboardValue("member_nps_feedback_open_label", "Still open")}</span><strong>{feedbackOpen}</strong><p>{dashboardValue("member_nps_feedback_open_note", "Of {captured} captured items").replaceAll("{captured}", String(feedbackCaptured))}</p></article>
      <article><span>{dashboardValue("member_nps_feedback_immediate_label", "Immediate attention")}</span><strong>{feedbackImmediate}</strong><p>{dashboardValue("member_nps_feedback_immediate_note", "Of {open} open items").replaceAll("{open}", String(feedbackOpen))}</p></article>
      <article><span>{dashboardValue("member_nps_feedback_score_label", "July NPS")}</span><strong>{feedbackScore}</strong><p>{dashboardValue("member_nps_feedback_score_note", "{respondents} Member responses").replaceAll("{respondents}", String(feedbackRespondents))}</p></article>
      <article><span>{dashboardValue("member_nps_feedback_detractors_label", "Detractors")}</span><strong>{feedbackDetractors}</strong><p>{dashboardValue("member_nps_feedback_detractors_note", "Of {respondents} July responses").replaceAll("{respondents}", String(feedbackRespondents))}</p></article>
    </section>

    <div className="feedback-view-switch" role="tablist" aria-label="Member feedback views">
      {(["Early warning", "NPS and patterns"] as FeedbackView[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "is-active" : ""} onClick={() => { setView(item); setOpenSection(4) }}>{item}</button>)}
    </div>

    {view === "Early warning" ? <FeedbackQueue actions={actions} items={feedbackItems} onOpenExecution={onOpenExecution} onOpenDespatch={onOpenDespatch} /> : <NpsPatterns items={feedbackItems} responses={responses} />}

    <section className="feedback-privacy-note"><FileLock2 aria-hidden /><div><strong>{dashboardValue("member_nps_privacy_headline", "Member privacy is part of the operating design.")}</strong><p>{dashboardValue("member_nps_privacy_detail", "This tab shows anonymised Member tokens, category, Studio, summary and action state. Full conversations stay behind restricted references and are never shown here.")}</p></div></section>
  </DashboardSectionAccordion>
}
