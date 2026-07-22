import { Megaphone } from "lucide-react"
import type { ReportPeak } from "@/lib/report-meaning"

// Pinned to UTC (like the evidence footer) so the Peak's "As of" timestamp renders
// byte-identically on the server and the client's first paint. A formatter without a
// fixed timeZone resolves to the machine's local zone, so the server (UTC) and the
// browser would disagree and trip a hydration mismatch on the always-visible Peak.
const AS_OF = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })

const TONE_LABEL: Record<NonNullable<ReportPeak["tone"]>, string> = {
  critical: "Action required",
  breach: "At risk",
  attention: "Needs attention",
  verified: "Confirmed",
  neutral: "Summary",
}

// The uncollapsible top of the pyramid. Rendered as a <section>, never inside a
// <details>, so the full Situation → Complication → Recommendation narrative and
// the single Ask (with its accountable owner and due date) are always visible.
export function ReportHeader({ peak }: { peak: ReportPeak }) {
  const asOf = Number.isFinite(Date.parse(peak.asOf)) ? `As of ${AS_OF.format(new Date(peak.asOf))} UTC` : null
  return (
    <section className="report-peak" data-tone={peak.tone ?? undefined} aria-label="Report headline">
      <div className="report-peak-eyebrow">
        <span>{TONE_LABEL[peak.tone ?? "neutral"]}</span>
        {asOf ? <span>{asOf}</span> : null}
      </div>

      <p className="report-peak-objective">
        <b>Objective: </b>
        {peak.objective}
      </p>

      <h2 className="report-peak-answer">{peak.recommendation}</h2>

      <div className="report-peak-scr">
        <p>
          <b>Situation</b>
          {peak.situation}
        </p>
        <p>
          <b>Complication</b>
          {peak.complication}
        </p>
      </div>

      <div className="report-peak-ask">
        <Megaphone aria-hidden />
        <p className="report-peak-ask-body">
          <b>Ask: </b>
          {peak.ask}
        </p>
        <p className="report-peak-ask-meta">
          <span>Owner: {peak.owner}</span>
          <span>Due: {peak.dueDate}</span>
        </p>
      </div>
    </section>
  )
}
