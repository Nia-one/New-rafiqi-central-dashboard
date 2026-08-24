"use client"

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif" }}>
    <section style={{ width: "min(520px, 100%)", border: "1px solid #d7dee7", borderRadius: 12, padding: 28, background: "#fff" }}>
      <strong style={{ display: "block", marginBottom: 10, fontSize: 20 }}>Live data refresh retry ho raha hai</strong>
      <p style={{ margin: "0 0 18px", color: "#536273", lineHeight: 1.5 }}>Temporary source response ki wajah se view complete nahi hua. Dashboard automatically retry karta hai.</p>
      <button type="button" onClick={() => reset()} style={{ border: 0, borderRadius: 7, padding: "10px 16px", background: "#111827", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Retry now</button>
    </section>
  </main>
}
