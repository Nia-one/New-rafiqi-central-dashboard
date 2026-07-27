import { dashboardDisplayLabel } from "@/lib/dashboard-model"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"

export type LearningHistoryEntry = Readonly<{
  domain: string
  observed: string
  proposedChange: string
  expectedEffect: string
  attribution: string
  confidence: string
  disposition: string
}>

function needsApproval(disposition: string) {
  return disposition.includes("sign-off") || disposition.includes("approval")
}

export function LearningHistoryWorkspace({
  entries,
  title = "What Nia learned from verified outcomes",
  subtitle = "Small, reversible improvements can be logged. Material changes always wait for sign-off.",
  adoptionRule = "No material target, channel, CM, cash, pricing or human-authority change is adopted automatically.",
  summaryLabel = "Learning summary",
  verifiedLearningsLabel = "Verified outcome learnings",
  adoptionRuleLabel = "Adoption rule",
}: {
  entries: readonly LearningHistoryEntry[]
  title?: string
  subtitle?: string
  adoptionRule?: string
  summaryLabel?: string
  verifiedLearningsLabel?: string
  adoptionRuleLabel?: string
}) {
  const requiringApproval = entries.filter((entry) => needsApproval(entry.disposition)).length
  return <DashboardSectionAccordion className="learning-history" ariaLabel="Learning history sections" sections={[
    { title: summaryLabel, summary: `${requiringApproval} recommendation${requiringApproval === 1 ? "" : "s"} require approval` },
    { title: verifiedLearningsLabel, summary: `${entries.length} governed recommendations` },
    { title: adoptionRuleLabel, summary: adoptionRule },
  ]}>
    <header>
      <div><h2 id="learning-history-title">{title}</h2><p>{subtitle}</p></div>
      <strong>{requiringApproval} require approval</strong>
    </header>
    <div className="learning-history-list">
      {entries.map((entry, index) => {
        const gate = needsApproval(entry.disposition)
        return <article key={`${entry.domain}-${index}`} className="learning-card" data-gate={gate ? "sign-off" : "monitor"}>
          <header>
            <strong>{dashboardDisplayLabel(entry.domain)}</strong>
            <span className="learning-card-disposition" data-tone={gate ? "action" : "neutral"}>{entry.disposition}</span>
          </header>
          <div className="learning-card-block">
            <span className="learning-card-label">What happened</span>
            <p>{entry.observed}</p>
          </div>
          <div className="learning-card-block">
            <span className="learning-card-label">What Nia recommends</span>
            <strong>{entry.proposedChange}</strong>
            <p>{entry.expectedEffect}</p>
          </div>
          <footer className="learning-card-meta">{entry.attribution} · {entry.confidence} confidence</footer>
        </article>
      })}
    </div>
    <p className="learning-history-rule">{adoptionRule}</p>
  </DashboardSectionAccordion>
}
