"use client"

import { Children, isValidElement, useId, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type DashboardSectionMeta = Readonly<{
  title: string
  summary: string
}>

export function DashboardSectionAccordion({
  children,
  sections,
  className,
  ariaLabel = "Dashboard sections",
  defaultOpenIndex,
  openIndex: controlledOpenIndex,
  onOpenIndexChange,
  ...props
}: {
  children: ReactNode
  sections: readonly DashboardSectionMeta[]
  ariaLabel?: string
  defaultOpenIndex?: number
  openIndex?: number
  onOpenIndexChange?: (index: number) => void
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "aria-label">) {
  const items = Children.toArray(children)
  const [uncontrolledOpenIndex, setUncontrolledOpenIndex] = useState(defaultOpenIndex ?? -1)
  const openIndex = controlledOpenIndex ?? uncontrolledOpenIndex
  const baseId = useId()

  function setOpenIndex(index: number) {
    if (controlledOpenIndex === undefined) setUncontrolledOpenIndex(index)
    onOpenIndexChange?.(index)
  }

  function focusTrigger(index: number) {
    document.getElementById(`${baseId}-trigger-${index}`)?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      focusTrigger((index + 1) % items.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      focusTrigger((index - 1 + items.length) % items.length)
    } else if (event.key === "Home") {
      event.preventDefault()
      focusTrigger(0)
    } else if (event.key === "End") {
      event.preventDefault()
      focusTrigger(items.length - 1)
    }
  }

  return <div {...props} className={cn("dashboard-accordion", className)} aria-label={ariaLabel}>
    {items.map((child, index) => {
      const meta = sections[index] ?? { title: `Section ${index + 1}`, summary: "Open to review this section." }
      const expanded = openIndex === index
      const triggerId = `${baseId}-trigger-${index}`
      const panelId = `${baseId}-panel-${index}`
      return <section className="dashboard-accordion-item" data-open={expanded ? "true" : "false"} key={isValidElement(child) && child.key ? child.key : index}>
        <h2 className="dashboard-accordion-heading">
          <button id={triggerId} type="button" className="dashboard-accordion-trigger" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenIndex(openIndex === index ? -1 : index)} onKeyDown={(event) => handleKeyDown(event, index)}>
            <span className="dashboard-accordion-title">{meta.title}</span>
            <span className="dashboard-accordion-summary">{meta.summary}</span>
            <ChevronDown className="dashboard-accordion-chevron" aria-hidden />
          </button>
        </h2>
        <div id={panelId} className="dashboard-accordion-panel" role="region" aria-labelledby={triggerId} hidden={!expanded}>
          {child}
        </div>
      </section>
    })}
  </div>
}





