import { ChevronDown } from "lucide-react"
import type { ReportAccordion, ReportTone } from "@/lib/report-meaning"
import { assertSoWhat, describeTitleIssue } from "@/lib/report-meaning"
import { EvidenceBlock } from "./evidence-block"

// Closed-row status signal. Mirrors the Peak's tone vocabulary so a reader scanning
// only the closed rows still reads each action's urgency at a glance. Deliberately
// kept OUT of the action title so the closed read-through stays a clean, quantified
// top-to-bottom argument rather than a string of adjectives.
const TONE_STATUS: Record<ReportTone, string> = {
  critical: "Critical",
  breach: "At risk",
  attention: "Attention",
  verified: "Confirmed",
  neutral: "Open",
}

// The middle of the pyramid. The CLOSED summary is a compact accordion control:
// a step number, the quantified action title, a tone status chip and a chevron —
// and nothing else, so the read-through of closed titles stands alone. The "So
// What", owner, due date and evidence are all revealed inside the open body.
export function ActionAccordion({ accordion, index }: { accordion: ReportAccordion; index?: number }) {
  const issue = describeTitleIssue(accordion.actionTitle)
  if (issue) {
    throw new Error(`ActionAccordion "${accordion.actionTitle}" ${issue}.`)
  }
  const soWhat = assertSoWhat(accordion.soWhat, `Accordion "${accordion.actionTitle}"`)
  const tone = accordion.tone ?? "neutral"
  const step = typeof index === "number" ? String(index + 1).padStart(2, "0") : null
  return (
    <details className="report-action" data-tone={accordion.tone ?? undefined} open={accordion.defaultOpen || undefined}>
      <summary>
        {step ? (
          <span className="report-action-index" aria-hidden>
            {step}
          </span>
        ) : null}
        <span className="report-action-title">{accordion.actionTitle}</span>
        <span className="report-action-status" data-tone={tone}>
          {TONE_STATUS[tone]}
        </span>
        <ChevronDown className="report-action-chevron" aria-hidden />
      </summary>
      <div className="report-action-body">
        <div className="report-action-brief">
          <p className="report-action-sowhat">{soWhat}</p>
          {accordion.owner || accordion.dueDate ? (
            <div className="report-action-assignment">
              {accordion.owner ? <span className="report-action-tag">Owner: {accordion.owner}</span> : null}
              {accordion.dueDate ? <span className="report-action-tag">Due: {accordion.dueDate}</span> : null}
            </div>
          ) : null}
        </div>
        {accordion.evidence.map((evidence) => (
          <EvidenceBlock key={evidence.id} evidence={evidence} />
        ))}
      </div>
    </details>
  )
}

export function ActionAccordionStack({ accordions, label }: { accordions: readonly ReportAccordion[]; label: string }) {
  return (
    <div className="report-actions" role="group" aria-label={label}>
      {accordions.map((accordion, i) => (
        <ActionAccordion key={accordion.id} accordion={accordion} index={i} />
      ))}
    </div>
  )
}
