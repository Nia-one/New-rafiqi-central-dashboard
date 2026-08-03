import { isValidElement, type ReactNode } from "react"

export type OperationalTone = "critical" | "breach" | "attention" | "verified" | "neutral"
export type ActionStage = "detected" | "assigned" | "working" | "evidence" | "verified"
export type ActionSegmentKey = "fix-now" | "due-today" | "nia-recovering" | "waiting-sign-off" | "verified"
export type OperationalOptic = {
  label: string
  percent: number
  markerPercent?: number
}

const ACTION_STAGES: readonly { key: ActionStage; label: string }[] = [
  { key: "detected", label: "Detected" },
  { key: "assigned", label: "Assigned" },
  { key: "working", label: "Working" },
  { key: "evidence", label: "Evidence received" },
  { key: "verified", label: "Verified" },
]

const ACTION_PROGRESS: Readonly<Record<ActionStage, number>> = Object.freeze({
  detected: 10,
  assigned: 35,
  working: 60,
  evidence: 82,
  verified: 100,
})

const ACTION_SEGMENTS: Readonly<Record<ActionSegmentKey, { title: string; description: string; tone: OperationalTone }>> = Object.freeze({
  "fix-now": { title: "Fix now", description: "Recovery failed, a deadline was missed, or impact is critical.", tone: "critical" },
  "due-today": { title: "Due today", description: "Named actions that must close before the day ends.", tone: "breach" },
  "nia-recovering": { title: "Nia is recovering", description: "The system has assigned the work and is chasing a verified result.", tone: "attention" },
  "waiting-sign-off": { title: "Waiting for your sign-off", description: "Only material decisions requiring human authority appear here.", tone: "breach" },
  verified: { title: "Verified and closed", description: "Independent proof was accepted and the outcome is counted.", tone: "verified" },
})

export function operationalTone(value: string): OperationalTone {
  const state = value.toLowerCase()
  if (/(critical|blocked|below floor|failed|declined|rejected)/.test(state)) return "critical"
  if (/(breach|at risk|waiting|overdue|pending|exception|missed)/.test(state)) return "breach"
  if (/(attention|open|underway|progress|acknowledged|evidence received)/.test(state)) return "attention"
  if (/(verified|healthy|on track|covered|recovered|closed|ready)/.test(state)) return "verified"
  return "neutral"
}

export function actionStageFromStatus(value: string): ActionStage {
  const state = value.toLowerCase()
  if (/(verified|closed|complete|recovered|billing.live)/.test(state)) return "verified"
  if (/(evidence|proof|submitted)/.test(state)) return "evidence"
  if (/(working|progress|underway|reopened|retry|chased|acknowledged|escalated)/.test(state)) return "working"
  if (/(assigned|queued|open|pending|waiting|routed|gated)/.test(state)) return "assigned"
  return "detected"
}

export function OperationalCardStack({ children, label }: { children: ReactNode; label: string }) {
  return <div className="operational-card-stack" role="list" aria-label={label}>{children}</div>
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join(" ")
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children)
  return ""
}

function compactSignal(value: ReactNode, fallback: string, kind: "cause" | "action") {
  const source = textFromNode(value).replace(/\s+/g, " ").trim()
  if (!source) return fallback
  const lower = source.toLowerCase()

  if (kind === "cause") {
    if (lower.includes("two cycles") && lower.includes("base commitment")) return "Base commitment missed twice"
    if (lower.includes("loaded cac") && lower.includes("above")) return "CAC exceeds ₹100 ceiling"
    if (lower.includes("studio occupancy") && lower.includes("below")) return "Occupancy below 78% floor"
    if (lower.includes("fill task") && lower.includes("overdue")) return "Fill deadline missed"
    if (lower.includes("system escalated") && lower.includes("functional owner")) return "Functional owner escalation"
    if (lower.includes("continuity signal") && lower.includes("reopen")) return "New continuity signal reopened"
    if (lower.includes("human-controlled category") && lower.includes("pricing")) return "Human pricing decision required"
    if (lower.includes("supply-model") || lower.includes("supply model")) return "Supply-model approval required"
    if (lower.includes("billing-live") && lower.includes("overdue")) return "Billing-live proof overdue"
    if (lower.includes("not independently") || lower.includes("independent") && lower.includes("until")) return "Independent proof still pending"
    if (lower.includes("below target")) return "Target remains below plan"
    if (lower.includes("did not hold")) return "Verified result did not hold"
    if (lower.includes("cannot be counted")) return "Readiness proof remains incomplete"
    if (lower.includes("minutes") && lower.includes("signal")) return "Required signal is missing"
    if (lower.includes("repeated") && lower.includes("failure")) return "Failure repeated across cycles"
    if (lower.includes("price") && lower.includes("affect")) return "Pricing authority is required"
    if (lower.includes("no answer")) return "Owner has not responded"
  } else {
    if (lower.includes("after verified owner response")) return "Verify owner response"
    if (lower.includes("named owner") && lower.includes("proof")) return "Chase owner for proof"
    if (lower.includes("approve or decline")) return "Approve or decline"
    if (lower.includes("restore the verified franchisee")) return "Restore franchisee commitment"
    if (lower.includes("run the verified") && lower.includes("fill playbook")) return "Run verified fill playbook"
    if (lower.includes("retry the same") && lower.includes("fill task")) return "Retry same fill task"
    if (lower.includes("collect corrected evidence")) return "Correct and resubmit proof"
    if (lower.includes("billing-live verification queued")) return "Verify billing-live evidence"
    if (lower.includes("validate") && lower.includes("proof")) return "Validate submitted proof"
    if (lower.includes("submit") && lower.includes("proof")) return "Submit independently verified proof"
    if (lower.includes("acknowledge")) return "Check safety, then acknowledge"
    if (lower.includes("close") && lower.includes("due")) return "Close before due time"
    if (lower.includes("reopens") || lower.includes("reopened")) return "Reopen and recover result"
    if (lower.includes("reviews") || lower.includes("review")) return "Review and decide"
  }

  const words = source
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[.!,;:]+/g, "")
    .split(" ")
    .filter(Boolean)
  return words.slice(0, 4).join(" ") || fallback
}

function fallbackCause(domain: ReactNode, stage: ActionStage) {
  const context = textFromNode(domain).toLowerCase()
  if (context.includes("fono")) return "Vacancy not yet filled"
  if (context.includes("enterprise demand")) return "Readiness gap remains open"
  if (context.includes("member engagement")) return "Member recovery remains open"
  if (context.includes("member savings")) return "Savings gate remains broken"
  if (context.includes("nia growth")) return "Growth milestone remains open"
  if (stage === "evidence") return "Proof awaits independent verification"
  if (stage === "working") return "Expected result not recovered"
  if (stage === "assigned") return "Outcome not yet delivered"
  return "Issue awaiting assignment"
}

function progressFromFields(fields: readonly { label: string; value: ReactNode }[] | undefined, stage: ActionStage) {
  const progressValue = fields?.find((field) => field.label.toLowerCase() === "progress")?.value
  const match = textFromNode(progressValue).match(/(\d+(?:\.\d+)?)%/)
  if (match) return Math.min(100, Math.max(0, Number(match[1])))
  return ACTION_PROGRESS[stage]
}

function actionForTitle(title: ReactNode, current: string) {
  const source = textFromNode(title).toLowerCase()
  if (source.includes("two cycles") && source.includes("base commitment")) return "Start franchise review"
  if (source.includes("loaded cac") && source.includes("above")) return "Review CAC exception"
  if (source.includes("studio occupancy") && source.includes("below")) return "Restore studio occupancy"
  if (source.includes("fill task") && source.includes("overdue")) return "Escalate overdue fill"
  return current
}

export function ActionProgress({ current, percent = ACTION_PROGRESS[current] }: { current: ActionStage; percent?: number }) {
  const currentIndex = ACTION_STAGES.findIndex((stage) => stage.key === current)
  const label = ACTION_STAGES[currentIndex]?.label ?? current
  return <div className="action-progress" aria-label={`Progress: ${label} · ${percent}% complete`}>
    <div className="action-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${percent}% complete`}><i style={{ width: `${percent}%` }} /></div>
    <strong className="action-progress-pct">{percent}%</strong>
  </div>
}

export function OperationalOpticBar({ optic }: { optic: OperationalOptic }) {
  const percent = Math.min(100, Math.max(0, optic.percent))
  const markerPercent = optic.markerPercent === undefined ? undefined : Math.min(100, Math.max(0, optic.markerPercent))
  return <div className="operational-optic" aria-label={optic.label}>
    <div className="operational-optic-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={optic.label}>
      <i style={{ width: `${percent}%` }} />
      {markerPercent === undefined ? null : <b style={{ left: `${markerPercent}%` }} aria-hidden />}
    </div>
    <small>{optic.label}</small>
  </div>
}

export function ActionSegment({ segment, count, children, defaultOpen = segment !== "verified" }: { segment: ActionSegmentKey; count: number; children?: ReactNode; defaultOpen?: boolean }) {
  const meta = ACTION_SEGMENTS[segment]
  if (count === 0) return null
  return <details className={`action-segment action-segment-${meta.tone}`} data-action-segment={segment} data-tone={meta.tone} open={defaultOpen || undefined}>
    <summary><div><h2>{meta.title}</h2><p>{meta.description}</p></div><span>{count}</span></summary>
    <OperationalCardStack label={`${meta.title} actions`}>{children}</OperationalCardStack>
  </details>
}

export function OperationalCard({ title, subtitle, description, status, tone = operationalTone(status), domain, fields, story, progress, optic, action, children }: {
  title: ReactNode
  subtitle?: ReactNode
  description?: ReactNode
  status: string
  tone?: OperationalTone
  domain?: ReactNode
  fields?: readonly { label: string; value: ReactNode }[]
  story?: readonly { label: "Why it matters" | "What Nia already did" | "What happens next"; value: ReactNode }[]
  progress?: ActionStage
  optic?: OperationalOptic
  action?: ReactNode
  children?: ReactNode
}) {
  const summaryFields = fields?.slice(0, 2)
  const detailFields = fields?.slice(2)
  const hasDetails = Boolean(description || story?.length || children || detailFields?.length)
  const stage = progress ?? actionStageFromStatus(status)
  const progressPercent = progressFromFields(fields, stage)
  const reason = story?.find((item) => item.label === "Why it matters")?.value
  const next = story?.find((item) => item.label === "What happens next")?.value ?? description
  // Only surface a root cause when the card supplies a real written reason. A generic
  // fallback (e.g. "Vacancy not yet filled") only restates the card and adds noise.
  const hasWrittenCause = Boolean(textFromNode(reason).trim())
  const rootCause = hasWrittenCause ? compactSignal(reason, fallbackCause(domain, stage), "cause") : null
  const requiredAction = stage === "verified" ? "No further action" : action ?? actionForTitle(title, compactSignal(next, "Complete and submit proof", "action"))
  return <article className={`operational-card operational-card-${tone}`} data-tone={tone} role="listitem">
    <header><div><h3>{title}</h3>{subtitle ? <p className="operational-card-subtitle">{subtitle}</p> : null}{domain ? <p className="operational-card-domain">{domain}</p> : null}</div><span className="operational-card-status" data-tone={tone}>{status}</span></header>
    {summaryFields?.length ? <dl>{summaryFields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : null}
    {optic ? <OperationalOpticBar optic={optic} /> : <ActionProgress current={stage} percent={progressPercent} />}
    <dl className="operational-card-signals" data-single={rootCause ? undefined : "action"}>
      {rootCause ? <div><dt>Root cause</dt><dd>{rootCause}</dd></div> : null}
      <div><dt>Action</dt><dd>{requiredAction}</dd></div>
    </dl>
    {hasDetails ? <details className="operational-card-details">
      <summary>View detail</summary>
      {description ? <div className="operational-card-description">{description}</div> : null}
      {story?.length ? <dl className="operational-card-story">{story.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}
      {detailFields?.length ? <dl>{detailFields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : null}
      {children ? <footer>{children}</footer> : null}
    </details> : null}
  </article>
}
