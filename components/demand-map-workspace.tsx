"use client"

import { useState } from "react"
import { ArrowLeft, Download, LockKeyhole, MapPinned, ShieldCheck } from "lucide-react"
import { SRAM_PARK_SCOUT_PREVIEW, scoutFixtureCsv } from "@/lib/sram-park-scout-preview"

function downloadFixtureCsv() {
  const url = URL.createObjectURL(new Blob([scoutFixtureCsv()], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "synthetic-sp-scout-route.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export function DemandMapWorkspace({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("Protected references shown; raw coordinates are not projected.")
  const preview = SRAM_PARK_SCOUT_PREVIEW

  function exportCsv() {
    downloadFixtureCsv()
    setMessage("Synthetic fixture CSV prepared locally. No external system was contacted.")
  }

  return <section className="scout-map" aria-label="Synthetic Shram Park scout map">
    <header className="scout-map-header">
      <div>
        <button type="button" onClick={onClose} className="scout-back"><ArrowLeft aria-hidden />Route plan</button>
        <p className="scout-kicker">Synthetic map · SP only</p>
        <h2>Factory-gate-centred route geometry</h2>
        <p>This illustration uses normalized fixture positions. Raw GPS, owner details and field photographs never enter this view.</p>
      </div>
      <button type="button" className="scout-export" onClick={exportCsv}><Download aria-hidden />Export fixture CSV</button>
    </header>

    <div className="scout-map-grid">
      <div className="scout-map-canvas" aria-label="Ring 1, Ring 2 and beyond 5 kilometre candidate positions">
        <div className="scout-map-boundary scout-map-reject"><span>Beyond 5 km · reject</span></div>
        <div className="scout-map-boundary scout-map-ring-two"><span>Ring 2 · 2–5 km · gated</span></div>
        <div className="scout-map-boundary scout-map-ring-one"><span>Ring 1 · 0–2 km · first</span></div>
        <div className="scout-map-gate"><MapPinned aria-hidden /><strong>{preview.trigger.gateId}</strong><span>Factory gate</span></div>
        {preview.mapPlot.map((point) => <article key={point.id} className={`scout-map-point ${point.state === "Rejected" ? "is-rejected" : point.state === "Human review" ? "is-review" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }}>
          <span aria-hidden />
          <div><strong>{point.label}</strong><small>{point.ring} · {point.state}</small></div>
        </article>)}
      </div>

      <aside className="scout-map-rail">
        <section>
          <p className="scout-kicker">Map boundary</p>
          <h3>Reference, not tracking</h3>
          <ul>
            <li><ShieldCheck aria-hidden /><span><strong>Protected centroid</strong><small>{preview.trigger.sourceRef}</small></span></li>
            <li><LockKeyhole aria-hidden /><span><strong>Raw location withheld</strong><small>Role-based access applies outside this projection.</small></span></li>
            <li><LockKeyhole aria-hidden /><span><strong>No live assignment</strong><small>Map points cannot create a field route.</small></span></li>
          </ul>
        </section>
        <section>
          <p className="scout-kicker">Candidate outcome</p>
          <div className="scout-map-outcomes">
            <span>Recommended for review<strong>{preview.candidates.filter((item) => item.disposition === "Recommended for review").length}</strong></span>
            <span>Rejected / blocked<strong>{preview.candidates.filter((item) => item.disposition === "Rejected" || item.disposition === "Blocked").length}</strong></span>
            <span>Quarantined<strong>{preview.candidates.filter((item) => item.disposition === "Quarantined").length}</strong></span>
            <span>Human review<strong>{preview.candidates.filter((item) => item.disposition === "Shared-catchment review").length}</strong></span>
          </div>
        </section>
        <p className="scout-map-message" aria-live="polite">{message}</p>
      </aside>
    </div>
  </section>
}
