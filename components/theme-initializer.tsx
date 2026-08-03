"use client"

import { useLayoutEffect } from "react"

export function ThemeInitializer() {
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem("nia-theme")
      const theme = saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
      document.documentElement.setAttribute("data-theme", theme)
    } catch {
      document.documentElement.setAttribute("data-theme", "dark")
    }
  }, [])

  return null
}
