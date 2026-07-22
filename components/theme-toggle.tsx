"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

// Toggles the document theme by setting `data-theme` on <html> via setAttribute
// (never a JSX attribute, so the shared-shell contract stays intact) and persists
// the choice. The initial value is applied pre-paint by the inline script in layout.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme")
    setTheme(current === "light" ? "light" : "dark")
  }, [])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.setAttribute("data-theme", next)
    try {
      localStorage.setItem("nia-theme", next)
    } catch {
      // Ignore storage failures (private mode, disabled cookies); theme still applies for the session.
    }
  }

  const nextLabel = theme === "dark" ? "light" : "dark"
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${nextLabel} theme`} title={`Switch to ${nextLabel} theme`}>
      {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </button>
  )
}
