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

export function LearningHistoryWorkspace({ entries }: { entries: readonly LearningHistoryEntry[] }) {
  const awaiting = entries.filter((entry) => needsApproval(entry.disposition)).length
  return <DashboardSectionAccordion className="learning-history" ariaLabel="Learning history sections" sections={[
    { title: "Learning summary", summary: `${awaiting} recommendation${awaiting === 1 ? "" : "s"} awaiting approval` },
    { title: "Verified outcome learnings", summary: `${entries.length} governed recommendations` },
    { title: "Adoption rule", summary: "Material changes are never adopted automatically." },
  ]}>
    <header>
      <div><h2 id="learning-history-title">What Nia learned from verified outcomes</h2><p>Small, reversible improvements can be logged. Material changes always wait for sign-off.</p></div>
      <strong>{entries.filter((entry) => needsApproval(entry.disposition)).length} awaiting approval</strong>
    </header>
    <div className="learning-history-list">
      {entries.map((entry, index) => {
        const gate = needsApproval(entry.disposition)
        return <article key={`${entry.domain}-${entry.proposedChange}-${index}`} className="learning-card" data-gate={gate ? "sign-off" : "monitor"}>
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
    <p className="learning-history-rule">No material target, channel, CM, cash, pricing or human-authority change is adopted automatically.</p>
  </DashboardSectionAccordion>
}
