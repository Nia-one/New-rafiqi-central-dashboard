"use client"

import { useEffect } from "react"

const RETRY_KEY = "rafiqi-dashboard-render-retry"

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const now = Date.now()
    let state = { count: 0, at: now }
    try {
      state = JSON.parse(sessionStorage.getItem(RETRY_KEY) || JSON.stringify(state))
    } catch {}
    if (now - state.at > 30_000) state = { count: 0, at: now }
    if (state.count >= 2) return
    sessionStorage.setItem(RETRY_KEY, JSON.stringify({ count: state.count + 1, at: now }))
    const timer = window.setTimeout(() => reset(), 900)
    return () => window.clearTimeout(timer)
  }, [reset])

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif" }}>
    <section style={{ width: "min(520px, 100%)", border: "1px solid #d7dee7", borderRadius: 12, padding: 28, background: "#fff" }}>
      <strong style={{ display: "block", marginBottom: 10, fontSize: 20 }}>Live data refresh retry ho raha hai</strong>
      <p style={{ margin: "0 0 18px", color: "#536273", lineHeight: 1.5 }}>Temporary source response ki wajah se view complete nahi hua. Dashboard automatically retry karta hai.</p>
      <button type="button" onClick={() => { sessionStorage.removeItem(RETRY_KEY); reset() }} style={{ border: 0, borderRadius: 7, padding: "10px 16px", background: "#111827", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Retry now</button>
    </section>
  </main>
}
