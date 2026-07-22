"use client"

import { useEffect, useState } from "react"
import type { ReportConfig } from "@/lib/report-meaning"
import { buildReport } from "@/lib/report-meaning"
import { ReportHeader, ActionAccordionStack } from "@/components/report"

// Dev-only harness for the Report Meaning Layer kit. It builds (and thereby
// validates) a sample report, then renders the Peak + action stack. The local
// theme switch drives `data-theme` on <html> via setAttribute — the same
// mechanism ThemeToggle uses, so it honours the shared-shell contract (never a
// JSX attribute) and exercises the real light/dark token cascade. The prior
// value is restored on unmount, so visiting the preview never changes the app
// theme once you navigate away. Nothing here is wired into a product screen.
export function PreviewHarness({ config }: { config: ReportConfig }) {
  const [theme, setTheme] = useState<"dark" | "light">("light")
  const report = buildReport(config)

  useEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute("data-theme")
    root.setAttribute("data-theme", theme)
    return () => {
      if (previous) root.setAttribute("data-theme", previous)
    }
  }, [theme])

  return (
    <div className="report-kit-preview-shell">
      <header className="report-kit-preview-bar">
        <div>
          <p className="report-kit-preview-eyebrow">Report Meaning Layer — component preview</p>
          <h1 className="report-kit-preview-title">Collapsible pyramid kit</h1>
        </div>
        <div className="report-kit-preview-switch" role="group" aria-label="Preview theme">
          <button type="button" data-active={theme === "light"} onClick={() => setTheme("light")}>
            Light
          </button>
          <button type="button" data-active={theme === "dark"} onClick={() => setTheme("dark")}>
            Dark
          </button>
        </div>
      </header>

      <div className="report-meaning">
        <ReportHeader peak={report.peak} />
        <ActionAccordionStack accordions={report.accordions} label="Recommended actions" />
      </div>
    </div>
  )
}
