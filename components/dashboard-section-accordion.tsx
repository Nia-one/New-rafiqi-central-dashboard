"use client"

import { Children, isValidElement, useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react"
import { useLens, type OperatingLens } from "@/components/lens"
import { cn } from "@/lib/utils"

export type DashboardSectionMeta = Readonly<{
  title: string
  summary: string
  status?: "good" | "warn" | "bad"
  /** Presentation lens this section belongs to. Omit for sections shown in both. */
  lens?: OperatingLens
  visual?: Readonly<{
    kind: "progress" | "coverage" | "split" | "stages"
    value: number
    max: number
    secondaryValue?: number
    label: string
  }>
}>

export const OUTLINE_FOCUS_EVENT = "rafiqi-outline-focus"

export function requestOutlineFocus(targetId: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(OUTLINE_FOCUS_EVENT, { detail: targetId }))
}

function clampPercent(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(Math.max((value / max) * 100, 0), 100)
}

function SummaryVisual({ visual }: { visual: NonNullable<DashboardSectionMeta["visual"]> }) {
  const primary = clampPercent(visual.value, visual.max)
  const secondary = Math.min(clampPercent(visual.secondaryValue ?? 0, visual.max), 100 - primary)
  const style = {
    "--summary-primary": `${primary}%`,
    "--summary-secondary": `${secondary}%`,
  } as CSSProperties

  if (visual.kind === "stages") {
    const stageCount = Math.min(Math.max(Math.round(visual.max), 1), 12)
    const completed = Math.min(Math.max(Math.round(visual.value), 0), stageCount)
    return <span className="dashboard-summary-chart" data-kind="stages" role="img" aria-label={visual.label}>
      {Array.from({ length: stageCount }, (_, index) => <i data-complete={index < completed ? "true" : "false"} key={index} />)}
    </span>
  }

  return <span className="dashboard-summary-chart" data-kind={visual.kind} role="img" aria-label={visual.label} style={style}>
    <i className="dashboard-summary-chart-primary" />
    {visual.kind === "split" ? <i className="dashboard-summary-chart-secondary" /> : null}
    {visual.kind === "coverage" ? <b aria-hidden /> : null}
  </span>
}

// The section outline is a persistent horizontal list of named steps above
// exactly one focused, full-width section card on the canvas.
// Every section stays mounted (hidden, not removed) so deep links, tests and
// static rendering keep the complete document; focus is presentation state.
export function DashboardSectionAccordion({
  children,
  sections,
  className,
  ariaLabel = "Dashboard sections",
  ...props
}: {
  children: ReactNode
  sections: readonly DashboardSectionMeta[]
  ariaLabel?: string
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "aria-label">) {
  const items = Children.toArray(children)
  const lens = useLens()
  const actionFirstTitles = new Set(["Decision required", "Decision status", "What needs doing next", "Recommendation", "Main point", "Learning summary", "Work data requirement", "Finance control status", "Connector status", "Do this now"])
  const actionIndex = sections.findIndex((section) => actionFirstTitles.has(section.title))
  const displayOrder = useMemo(() => {
    const ordered = actionIndex > 0
      ? [actionIndex, ...items.map((_, index) => index).filter((index) => index !== actionIndex)]
      : items.map((_, index) => index)
    return ordered.filter((sourceIndex) => {
      const sectionLens = sections[sourceIndex]?.lens
      return lens === null || sectionLens === undefined || sectionLens === lens
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionIndex, items.length, lens, sections])
  const [focus, setFocus] = useState(0)
  const safeFocus = Math.min(focus, Math.max(displayOrder.length - 1, 0))

  useEffect(() => {
    setFocus(0)
  }, [lens, displayOrder.length])

  useEffect(() => {
    function onFocusRequest(event: Event) {
      const targetId = (event as CustomEvent<string>).detail
      if (!targetId) return
      const element = document.getElementById(targetId)
      const host = element?.closest<HTMLElement>("[data-dashboard-section-index]")
      if (!host) return
      const index = Number(host.getAttribute("data-dashboard-section-index"))
      if (Number.isFinite(index)) setFocus(index)
    }
    window.addEventListener(OUTLINE_FOCUS_EVENT, onFocusRequest)
    return () => window.removeEventListener(OUTLINE_FOCUS_EVENT, onFocusRequest)
  }, [])

  return <div {...props} className={cn("dashboard-accordion", className)} data-outline="true" aria-label={ariaLabel}>
    <nav className="dashboard-outline-pane" aria-label={`${ariaLabel} outline`}>
      <ol>
        {displayOrder.map((sourceIndex, displayIndex) => {
          const meta = sections[sourceIndex] ?? { title: `Section ${sourceIndex + 1}`, summary: "Open to review this section." }
          return <li key={`${meta.title}-${sourceIndex}`}>
            <button type="button" aria-current={displayIndex === safeFocus ? "true" : undefined} data-status={meta.status} onClick={() => setFocus(displayIndex)}>
              <i aria-hidden data-status={meta.status} />
              <span><strong>{meta.title}</strong><small>{meta.summary}</small></span>
            </button>
          </li>
        })}
      </ol>
    </nav>
    <div className="dashboard-outline-canvas">
      {displayOrder.map((sourceIndex, displayIndex) => {
        const child = items[sourceIndex]
        const meta = sections[sourceIndex] ?? { title: `Section ${sourceIndex + 1}`, summary: "Open to review this section." }
        const titleId = `dashboard-section-${displayIndex}-${meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        return <section className="dashboard-accordion-item" data-dashboard-section-index={displayIndex} data-dashboard-decision={displayIndex === 0 && actionFirstTitles.has(meta.title) ? "true" : undefined} hidden={displayIndex !== safeFocus} key={isValidElement(child) && child.key ? child.key : sourceIndex}>
          <header className="dashboard-section-header">
            <h2 id={titleId} className="dashboard-accordion-title">{meta.title}</h2>
            <span className="dashboard-accordion-summary" data-status={meta.status}>
              <span>{meta.summary}</span>
              {meta.visual ? <SummaryVisual visual={meta.visual} /> : null}
            </span>
          </header>
          <div className="dashboard-accordion-panel" role="region" aria-labelledby={titleId}>
            {child}
          </div>
        </section>
      })}
    </div>
  </div>
}
