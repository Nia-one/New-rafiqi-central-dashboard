"use client"

import { useMemo, useState } from "react"
import { ArrowUpRight, Bot, FileLock2, LineChart as LineChartIcon, MessageCircleMore, ShieldCheck } from "lucide-react"
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { commitmentStatus, type ExecutionAction } from "@/lib/execution-control"
import { buildFeedbackSummary, feedbackAgeHours, npsByDimension, npsByMonth, NPS_QUESTION, recurringFeedback, type ExitRisk, type MemberFeedbackItem, type NpsResponse } from "@/lib/member-feedback"
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

function FeedbackQueue({ actions, items: sourceItems, onOpenExecution, onOpenDespatch }: { actions: ExecutionAction[]; items: readonly MemberFeedbackItem[]; onOpenExecution: () => void; onOpenDespatch: () => void }) {
  const actionById = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions])
  const items = [...sourceItems].sort((a, b) => riskRank[a.exitRisk] - riskRank[b.exitRisk] || feedbackAgeHours(b) - feedbackAgeHours(a))

  function openAction(item: MemberFeedbackItem) {
    const action = actionById.get(item.actionId)
    if (action && commitmentStatus(action) === "Closed") onOpenDespatch()
    else onOpenExecution()
  }

  return <section className="feedback-section" aria-labelledby="feedback-queue-title">
    <header className="feedback-section-heading">
      <div><p className="story-kicker">EARLY WARNING QUEUE</p><h2 id="feedback-queue-title">Act before the Member decides to leave.</h2></div>
      <p>Population: all {items.length} governed feedback items captured in this view.</p>
    </header>
    <OperationalCardStack label="Member feedback early warning queue">
      {items.map((item) => {
          const action = actionById.get(item.actionId)
          const status = action ? commitmentStatus(action) : "Detected"
          return <OperationalCard key={item.id} title={item.summary} domain={`${item.memberToken} · ${item.pillar} · ${item.category}`} status={item.exitRisk} fields={[{ label: "Owner", value: action ? `${action.owner} · ${action.team}` : "Owner pending" }, { label: "Period", value: `${formatAge(feedbackAgeHours(item))} since capture` }, { label: "Action status", value: status }, { label: "Studio / Theatre", value: `${item.studio} · ${item.theatre}` }, { label: "Source", value: item.source }]}><button type="button" onClick={() => openAction(item)}>{status === "Closed" ? "Open in Despatch" : "Open action"}<ArrowUpRight aria-hidden /></button></OperationalCard>
        })}
    </OperationalCardStack>
    <p className="feedback-population">Showing {items.length} of {sourceItems.length} governed feedback items. Member tokens are anonymised.</p>
  </section>
}

function NpsPatterns({ responses, items }: { responses: NpsResponse[]; items: readonly MemberFeedbackItem[] }) {
  const trend = npsByMonth(responses).map((point) => ({ ...point, label: formatMonth(point.month) }))
  const current = trend.at(-1) ?? { month: "", label: "No data", score: null, respondents: 0, promoters: 0, passives: 0, detractors: 0 }
  const previous = trend.at(-2) ?? current
  const currentMonth = current.month
  const theatreNps = currentMonth ? npsByDimension(responses, "theatre", currentMonth) : []
  const recurring = recurringFeedback([...items])
  const movement = (current.score ?? 0) - (previous.score ?? 0)
  const currentMonthLabel = currentMonth ? formatMonth(currentMonth) : "Current"

  return <div className="feedback-patterns">
    <section className="feedback-section feedback-nps-section" aria-labelledby="feedback-nps-title">
      <header className="feedback-section-heading">
        <div><p className="story-kicker">MONTHLY NPS</p><h2 id="feedback-nps-title">{currentMonthLabel} NPS is {current.score ?? "not recorded"}. Fix the reasons behind the movement.</h2></div>
        <p>{current.respondents} responses in {currentMonthLabel}. NPS = Promoters minus Detractors as a share of respondents.</p>
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
          <p><strong>{Math.abs(movement)} points {movement < 0 ? "lower" : "higher"}</strong> than the previous recorded month. The score is based on {current.respondents} {currentMonthLabel} responses.</p>
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
        <header className="feedback-section-heading"><div><p className="story-kicker">NPS BY THEATRE</p><h2 id="feedback-theatre-title">Start with the lowest Member signal.</h2></div><p>Population: {current.respondents} {currentMonthLabel} responses across {theatreNps.length} Theatres.</p></header>
        <div className="feedback-table-wrap" role="region" aria-label="NPS by Theatre" tabIndex={0}>
          <table className="feedback-aggregate-table"><thead><tr><th scope="col">Theatre</th><th scope="col" className="numeric">NPS</th><th scope="col" className="numeric">Responses</th><th scope="col" className="numeric">Detractors</th></tr></thead><tbody>{theatreNps.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td className="numeric"><strong>{row.score}</strong></td><td className="numeric">{row.respondents}</td><td className="numeric">{row.detractors}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="feedback-section" aria-labelledby="feedback-recurring-title">
        <header className="feedback-section-heading"><div><p className="story-kicker">RECURRING CAUSES</p><h2 id="feedback-recurring-title">Fix the pattern, not only the latest item.</h2></div><p>Population: all {items.length} governed feedback items.</p></header>
        <ol className="feedback-recurring-list">{recurring.map((row, index) => <li key={`${row.pillar}-${row.category}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{row.category}</strong><p>{row.pillar} · {row.count} of {items.length} feedback items</p></div><b>{row.immediateAttention} immediate</b></li>)}</ol>
      </section>
    </div>
  </div>
}

export function MemberFeedbackScreen({ actions, items = [], responses = [], sourceAsOf = "", onOpenExecution, onOpenDespatch }: { actions: ExecutionAction[]; items?: readonly MemberFeedbackItem[]; responses?: NpsResponse[]; sourceAsOf?: string; onOpenExecution: () => void; onOpenDespatch: () => void }) {
  const [view, setView] = useState<FeedbackView>("Early warning")
  const summary = buildFeedbackSummary([...items], actions, responses)

  return <DashboardSectionAccordion key={view} className="member-feedback-screen" ariaLabel="Member NPS sections" sections={[
    { title: "Connector status", summary: items.length || responses.length ? "Governed Member feedback sources connected." : "No governed Member feedback records available." },
    { title: "Closure loop", summary: "Member speaks · RafiQi structures · owner fixes · Despatch verifies" },
    { title: "Feedback summary", summary: `${summary.openItems} open · ${summary.currentNps.score === null ? "No NPS data" : `NPS ${summary.currentNps.score}`} from ${summary.currentNps.respondents} responses` },
    { title: "View", summary: `${view} · switch between action queue and NPS patterns` },
    { title: view, summary: view === "Early warning" ? `${summary.immediateAttention} items need immediate attention` : `July NPS ${summary.currentNps.score} · recurring causes retained`, lens: view === "Early warning" ? "operate" : undefined },
    { title: "Privacy", summary: "Anonymised Member tokens only; conversations remain restricted." },
  ]}>
    <section className="feedback-connector-note" aria-label="Member feedback data connection status">
      <div><Bot aria-hidden /><p><strong>{items.length || responses.length ? "Governed Member feedback sources are connected." : "No governed feedback records are available."}</strong><span>Recorded feedback and NPS responses create Member actions in the shared execution log.</span></p></div>
      <p>{sourceAsOf ? `Live snapshot · ${sourceAsOf}` : "No source timestamp"}</p>
    </section>

    <section className="feedback-loop-band" aria-label="Member feedback closure loop">
      <div><MessageCircleMore aria-hidden /><strong>Member speaks</strong><span>Natural conversation</span></div><i aria-hidden>→</i>
      <div><Bot aria-hidden /><strong>RafiQi structures</strong><span>Pillar, cause, Studio</span></div><i aria-hidden>→</i>
      <div><ShieldCheck aria-hidden /><strong>Owner fixes</strong><span>Action and proof</span></div><i aria-hidden>→</i>
      <div><FileLock2 aria-hidden /><strong>Despatch verifies</strong><span>Member hears closure</span></div>
    </section>

    <section className="feedback-summary" data-kpi-group aria-label="Member feedback summary">
      <article><span>Feedback captured</span><strong>{summary.feedbackItems}</strong><p>All governed feedback items</p></article>
      <article><span>Still open</span><strong>{summary.openItems}</strong><p>Of {summary.feedbackItems} captured items</p></article>
      <article><span>Immediate attention</span><strong>{summary.immediateAttention}</strong><p>Of {summary.openItems} open items</p></article>
      <article><span>July NPS</span><strong>{summary.currentNps.score}</strong><p>{summary.currentNps.respondents} Member responses</p></article>
      <article><span>Detractors</span><strong>{summary.currentNps.detractors}</strong><p>Of {summary.currentNps.respondents} July responses</p></article>
    </section>

    <div className="feedback-view-switch" role="tablist" aria-label="Member feedback views">
      {(["Early warning", "NPS and patterns"] as FeedbackView[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "is-active" : ""} onClick={() => setView(item)}>{item}</button>)}
    </div>

    {view === "Early warning" ? <FeedbackQueue actions={actions} items={items} onOpenExecution={onOpenExecution} onOpenDespatch={onOpenDespatch} /> : <NpsPatterns responses={responses} items={items} />}

    <section className="feedback-privacy-note"><FileLock2 aria-hidden /><div><strong>Member privacy is part of the operating design.</strong><p>This tab shows anonymised Member tokens, category, Studio, summary and action state. Full conversations stay behind restricted references and are never shown here.</p></div></section>
  </DashboardSectionAccordion>
}
