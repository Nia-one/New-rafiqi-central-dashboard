"use client"

import { ChevronDown } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"

export type OperatingTone = "neutral" | "critical" | "attention" | "verified"

export function ContextStrip({ items, label = "Page context" }: {
  items: readonly { label: string; value: ReactNode; tone?: OperatingTone }[]
  label?: string
}) {
  return <dl className="operating-context-strip" aria-label={label}>
    {items.map((item) => <div data-tone={item.tone ?? "neutral"} key={item.label}>
      <dt>{item.label}</dt>
      <dd>{item.value}</dd>
    </div>)}
  </dl>
}

export function OwnerDueRow({ owner, due, progress, outcome }: {
  owner: ReactNode
  due: ReactNode
  progress: ReactNode
  outcome: ReactNode
}) {
  return <dl className="operating-owner-due">
    <div><dt>Owner</dt><dd>{owner}</dd></div>
    <div><dt>Due</dt><dd>{due}</dd></div>
    <div><dt>Progress</dt><dd>{progress}</dd></div>
    <div><dt>Expected verified outcome</dt><dd>{outcome}</dd></div>
  </dl>
}

export function DecisionBand({ label = "Do this now", title, description, owner, due, progress, outcome, tone = "neutral", progressValue }: {
  label?: string
  title: ReactNode
  description: ReactNode
  owner: ReactNode
  due: ReactNode
  progress: ReactNode
  outcome: ReactNode
  tone?: OperatingTone
  progressValue?: number
}) {
  const safeProgress = Math.min(100, Math.max(0, progressValue ?? 0))
  return <section className="operating-decision-band" data-tone={tone} aria-label={label}>
    <div className="operating-decision-copy"><span>{label}</span><h2>{title}</h2><p>{description}</p></div>
    <OwnerDueRow owner={owner} due={due} progress={progress} outcome={outcome} />
    {progressValue !== undefined ? <div className="operating-decision-progress" aria-label={`${safeProgress}% complete`} style={{ "--operating-progress": `${safeProgress}%` } as CSSProperties}><i /></div> : null}
  </section>
}

export function MetricStrip({ items, label }: {
  items: readonly { label: string; value: ReactNode; note?: ReactNode; tone?: OperatingTone }[]
  label: string
}) {
  return <dl className="operating-metric-strip" aria-label={label}>
    {items.map((item) => <div data-tone={item.tone ?? "neutral"} key={item.label}>
      <dt>{item.label}</dt><dd>{item.value}</dd>{item.note ? <small>{item.note}</small> : null}
    </div>)}
  </dl>
}

export function ChartPanel({ title, takeaway, children, className = "" }: {
  title: string
  takeaway?: ReactNode
  children: ReactNode
  className?: string
}) {
  return <section className={`operating-chart-panel ${className}`.trim()}>
    <header><h2>{title}</h2>{takeaway ? <p>{takeaway}</p> : null}</header>
    <div className="operating-chart-body">{children}</div>
  </section>
}

export function ReadonlyMetricRow({ label, value, description, tone = "neutral" }: {
  label: string
  value: ReactNode
  description?: ReactNode
  tone?: OperatingTone
}) {
  return <div className="operating-readonly-row" data-tone={tone}>
    <span>{label}</span><strong>{value}</strong>{description ? <small>{description}</small> : null}
  </div>
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return <div className="operating-segmented-control" role="tablist" aria-label={label}>
    {options.map((option) => <button type="button" role="tab" aria-selected={value === option.value} tabIndex={value === option.value ? 0 : -1} onClick={() => onChange(option.value)} key={option.value}>{option.label}</button>)}
  </div>
}

export function CompactDisclosure({ summary, children, className = "" }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return <details className={`operating-compact-disclosure ${className}`.trim()}>
    <summary>{summary}<ChevronDown aria-hidden /></summary>
    <div>{children}</div>
  </details>
}
