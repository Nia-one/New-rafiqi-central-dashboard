"use client"

import { useEffect } from "react"

const RETRY_GUARD_KEY = "rafiqi-dashboard-last-recovery"
const RETRY_COOLDOWN_MS = 60_000

function reloadDashboard() {
  const url = new URL(window.location.href)
  url.searchParams.set("recovery", String(Date.now()))
  window.location.replace(url.toString())
}

export default function DashboardError() {
  useEffect(() => {
    const lastRetry = Number(window.sessionStorage.getItem(RETRY_GUARD_KEY) || 0)
    if (Date.now() - lastRetry < RETRY_COOLDOWN_MS) return
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(RETRY_GUARD_KEY, String(Date.now()))
      reloadDashboard()
    }, 12_000)
    return () => window.clearTimeout(timer)
  }, [])

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif" }}>
    <section style={{ width: "min(520px, 100%)", border: "1px solid #d7dee7", borderRadius: 12, padding: 28, background: "#fff" }}>
      <strong style={{ display: "block", marginBottom: 10, fontSize: 20 }}>Live data refresh retry ho raha hai</strong>
      <p style={{ margin: "0 0 18px", color: "#536273", lineHeight: 1.5 }}>Temporary source response ki wajah se view complete nahi hua. Dashboard 12 seconds mein safely reload hoga.</p>
      <button type="button" onClick={reloadDashboard} style={{ border: 0, borderRadius: 7, padding: "10px 16px", background: "#111827", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Reload dashboard</button>
    </section>
  </main>
}
