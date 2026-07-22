"use client"

import { useState } from "react"
import { AlertTriangle, Check, CircleDot, Download, FileCheck2, LockKeyhole, Map, MapPinned, Route, Shield, ShieldCheck, Target, TimerReset } from "lucide-react"
import { DemandMapWorkspace } from "@/components/demand-map-workspace"
import { SCOUT_WEDGES } from "@/lib/sram-park-scout-route"
import { SRAM_PARK_SCOUT_PREVIEW, scoutFixtureCsv } from "@/lib/sram-park-scout-preview"

const wedgeLabelPositions = [
  { x: 102, y: 30 }, { x: 138, y: 48 }, { x: 157, y: 84 }, { x: 138, y: 122 },
  { x: 102, y: 140 }, { x: 65, y: 122 }, { x: 47, y: 84 }, { x: 65, y: 48 },
]

const candidateOutcomeLabels: Record<string, string> = {
  "Recommended for review": "Review",
  "Shared-catchment review": "Human review",
  Rejected: "Rejected",
  Quarantined: "Quarantined",
  Blocked: "Blocked",
}

function moneyLakh(value: number | null) {
  return value === null ? "—" : `₹${(value / 100000).toFixed(2)}L`
}

function downloadFixtureCsv() {
  const url = URL.createObjectURL(new Blob([scoutFixtureCsv()], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "synthetic-sp-scout-route.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function RouteGeometry() {
  const verified = new Set(SRAM_PARK_SCOUT_PREVIEW.coverage.verifiedWedges)
  return <div className="scout-geometry">
    <div className="scout-ring-copy">
      <span><i className="is-ring-one" />Ring 1<strong>[0–2 km]</strong><small>Active first</small></span>
      <span><i className="is-ring-two" />Ring 2<strong>(2–5 km]</strong><small>Gated</small></span>
      <span><i className="is-reject" />Beyond 5 km<strong>Reject</strong><small>Human exception only</small></span>
    </div>
    <svg viewBox="0 0 204 168" role="img" aria-label="Factory gate centred two-ring map with eight wedges">
      <circle cx="102" cy="84" r="70" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="5 4" />
      <circle cx="102" cy="84" r="48" fill="var(--surface-subtle)" stroke="var(--nia-blue-soft)" strokeWidth="1.5" />
      {[0, 45, 90, 135].map((degrees) => {
        const radians = degrees * Math.PI / 180
        const dx = Math.cos(radians) * 70
        const dy = Math.sin(radians) * 70
        return <line key={degrees} x1={102 - dx} y1={84 - dy} x2={102 + dx} y2={84 + dy} stroke="var(--surface)" strokeWidth="2" />
      })}
      <circle cx="102" cy="84" r="25" fill="var(--nia-blue)" stroke="var(--nia-blue-deep)" strokeWidth="1.5" />
      {SCOUT_WEDGES.map((wedge, index) => <g key={wedge}>
        <circle cx={wedgeLabelPositions[index].x} cy={wedgeLabelPositions[index].y} r="9" fill={verified.has(wedge) ? "var(--nia-blue-deep)" : "var(--surface)"} stroke={verified.has(wedge) ? "var(--nia-blue-deep)" : "var(--border-strong)"} />
        <text x={wedgeLabelPositions[index].x} y={wedgeLabelPositions[index].y + 3} textAnchor="middle" fontSize="7" fontWeight="700" fill={verified.has(wedge) ? "var(--surface)" : "var(--ink-soft)"}>{wedge}</text>
      </g>)}
      <text x="102" y="81" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--surface)">GATE</text>
      <text x="102" y="91" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--surface)">SP-A</text>
    </svg>
  </div>
}

function RegistryPanel() {
  const registry = SRAM_PARK_SCOUT_PREVIEW.registry
  const rows = [
    ["Trigger", registry.triggerStage, "Locked", "POL-SP-SCOUT-TRIGGER-STAGE@v1"],
    ["Ring 1 / Ring 2", `${registry.ring1MaxKm} km / ${registry.ring2MaxKm} km`, "Locked", "POL-SP-SCOUT-RING-1-MAX@v1"],
    ["Wedge duration", `${registry.wedgeMinutes} min`, "Provisional", "POL-SP-SCOUT-WEDGE-MINUTES@v1"],
    ["Target rent", `₹${registry.targetRentPerNestInr.toLocaleString("en-IN")}/Nest`, "Provisional", "POL-SP-SCOUT-TARGET-RENT@v1"],
    ["Billed ARPU", `₹${registry.billedArpuInr.toLocaleString("en-IN")}`, "Provisional", "POL-SP-SCOUT-BILLED-ARPU@v1"],
    ["Shuttle ceiling", `₹${registry.shuttleCeilingPerNestInr.toLocaleString("en-IN")}/Nest`, "Provisional", "POL-SP-SCOUT-SHUTTLE-CEILING@v1"],
    ["Daylight window", registry.approvedHours, "Provisional", "POL-SP-SCOUT-APPROVED-HOURS@v1"],
  ]
  return <section className="scout-section">
    <header><div><p className="scout-kicker">Decision registry</p><h2>{registry.version}</h2></div><p>{registry.provisionalPolicyRefs.length} assumptions remain visibly provisional.</p></header>
    <div className="scout-registry-table" role="table" aria-label="Scout decision registry">
      <div role="row" className="scout-table-head"><span role="columnheader">Control</span><span role="columnheader">Value</span><span role="columnheader">State</span><span role="columnheader">Version</span></div>
      {rows.map((row) => <div role="row" key={row[0]}><strong role="cell">{row[0]}</strong><span role="cell">{row[1]}</span><span role="cell" className={row[2] === "Locked" ? "is-locked" : "is-provisional"}>{row[2]}</span><small role="cell">{row[3]}</small></div>)}
    </div>
  </section>
}

export function ScoutersJourneyPlan() {
  const [view, setView] = useState<"route" | "map" | "registry">("route")
  const [message, setMessage] = useState("Read-only preview. No live route exists.")
  const preview = SRAM_PARK_SCOUT_PREVIEW

  function exportCsv() {
    downloadFixtureCsv()
    setMessage("Synthetic fixture CSV prepared locally; no external system was contacted.")
  }

  if (view === "map") return <DemandMapWorkspace onClose={() => setView("route")} />
  if (view === "registry") return <div className="scout-route-screen">
    <div className="scout-viewbar" aria-label="Scout route views">
      <button type="button" onClick={() => setView("route")}><Route aria-hidden />Route plan</button>
      <button type="button" onClick={() => setView("map")}><Map aria-hidden />Synthetic map</button>
      <button type="button" className="active" aria-pressed="true"><FileCheck2 aria-hidden />Registry</button>
    </div>
    <RegistryPanel />
    <div className="scout-action-boundary"><Shield aria-hidden /><strong>Recommendation only</strong><span>Registry values cannot contact, message, lease, pay, commit capital, assign live work or write Production.</span></div>
  </div>

  const visibleQueue = preview.queue.filter((item) => ["GATE-SP-A", "GATE-SP-B", "GATE-SP-C", "GATE-SP-D"].includes(item.gateId))
  return <div className="scout-route-screen">
    <section className="scout-status-strip">
      <div className="scout-status-title"><Target aria-hidden /><span><small>Shadow trigger</small><strong>{preview.trigger.gateId} entered {preview.trigger.stage} at 08:40</strong></span></div>
      <dl><div><dt>Verification</dt><dd>{preview.trigger.verificationState}</dd></div><div><dt>Mode</dt><dd>{preview.mode}</dd></div><div><dt>Source</dt><dd>Synthetic fixture engine</dd></div></dl>
      <div className="scout-badges"><span>SP ONLY</span><span>SHADOW MODE</span><span>SYNTHETIC</span><span>READ ONLY</span></div>
    </section>

    <section className="scout-first-grid" aria-label="Scout route first viewport summary">
      <article>
        <header><span>1</span><h2>What triggered the sweep?</h2></header>
        <div className="scout-trigger-detail">
          <CircleDot aria-hidden />
          <dl><div><dt>Fire signal</dt><dd>Negotiation</dd></div><div><dt>Factory gate</dt><dd>{preview.trigger.gateId}</dd></div><div><dt>Timing</dt><dd>Same operating day</dd></div><div><dt>Lineage</dt><dd>Protected · Verified</dd></div></dl>
        </div>
        <p className="scout-card-note">Qualified stays blocked. Floor Signed continues only an already-triggered sweep.</p>
      </article>

      <article>
        <header><span>2</span><h2>Where are Ring 1 and Ring 2?</h2></header>
        <RouteGeometry />
      </article>

      <article>
        <header><span>3</span><h2>What must the scout return with?</h2></header>
        <ul className="scout-return-list">{preview.returnPackage.map((item) => <li key={item}><Check aria-hidden />{item}</li>)}</ul>
        <p className="scout-card-note">Independent verification is required before any wedge can close.</p>
      </article>

      <article>
        <header><span>4</span><h2>What is blocked pending evidence?</h2></header>
        <ul className="scout-block-list">{preview.evidenceBlocks.map((item) => <li key={item}><LockKeyhole aria-hidden /><span>{item}</span></li>)}</ul>
        <p className="scout-card-note">Failed verification reopens; history is append-only.</p>
      </article>
    </section>

    <section className="scout-priority-ladder" aria-label="Protected priority ladder">
      <div><ShieldCheck aria-hidden /><span><small>Protected priority ladder</small><strong>Scout sweeps are fifth, never absolute.</strong></span></div>
      <ol>{preview.protectedPriority.map((item) => <li key={item.rank}><b>{item.rank}</b><span><strong>{item.label}</strong><small>{item.note}</small></span></li>)}</ol>
    </section>

    <div className="scout-viewbar" aria-label="Scout route views">
      <button type="button" className="active" aria-pressed="true"><Route aria-hidden />Route plan</button>
      <button type="button" onClick={() => setView("map")}><Map aria-hidden />Synthetic map</button>
      <button type="button" onClick={() => setView("registry")}><FileCheck2 aria-hidden />Registry</button>
      <button type="button" onClick={exportCsv}><Download aria-hidden />Export fixture CSV</button>
      <span aria-live="polite">{message}</span>
    </div>

    <div className="scout-work-grid">
      <section className="scout-section scout-queue">
        <header><div><p className="scout-kicker">Daily gate queue</p><h2>Demand pulls supply.</h2></div><p>Queue value uses visible {preview.registry.version} assumptions.</p></header>
        <div className="scout-queue-table" role="table" aria-label="Synthetic SP gate queue">
          <div role="row" className="scout-table-head"><span role="columnheader">Gate</span><span role="columnheader">Stage</span><span role="columnheader">Queue value</span><span role="columnheader">Ring 1</span><span role="columnheader">Decision</span></div>
          {visibleQueue.map((item) => <div role="row" key={item.gateId}>
            <strong role="cell">{item.gateId}<small>{item.supplyModel ?? "Missing"}</small></strong>
            <span role="cell">{item.stage}</span>
            <span role="cell">{moneyLakh(item.queueValueInr)}</span>
            <span role="cell">{item.gateId === "GATE-SP-A" ? `${preview.coverage.verifiedWedges.length}/8` : item.disposition === "Blocked" ? "—" : "0/8"}</span>
            <span role="cell" className={`scout-decision is-${item.disposition.toLowerCase().replaceAll(" ", "-")}`}>{item.disposition}</span>
          </div>)}
        </div>
      </section>

      <section className="scout-section scout-coverage">
        <header><div><p className="scout-kicker">Ring coverage</p><h2>{preview.trigger.gateId}</h2></div><p>{preview.coverage.verifiedWedges.length} verified · {preview.coverage.awaitingWedges.length} awaiting</p></header>
        <div className="scout-wedges">{SCOUT_WEDGES.map((wedge) => {
          const verified = preview.coverage.verifiedWedges.includes(wedge)
          return <span key={wedge} className={verified ? "is-verified" : ""}><b>{wedge}</b>{verified ? <Check aria-hidden /> : <CircleDot aria-hidden />}<small>{verified ? "Verified" : "Awaiting"}</small></span>
        })}</div>
        <div className="scout-ring-gate"><LockKeyhole aria-hidden /><span><strong>Ring 2 stays locked</strong><small>All eight Ring 1 wedges must close dry at POL-SP-SCOUT-TARGET-RENT@v1.</small></span></div>
      </section>
    </div>

    <section className="scout-section scout-candidates">
      <header><div><p className="scout-kicker">Candidate evidence projection</p><h2>Fit score ranks. It never approves.</h2></div><p>Raw coordinates, photographs and owner data are excluded.</p></header>
      <div className="scout-candidate-grid">{preview.candidates.slice(0, 5).map((item) => <article key={item.candidateId}>
        <div><strong>{item.candidateId}</strong><span className={`scout-decision is-${item.disposition.toLowerCase().replaceAll(" ", "-")}`}>{candidateOutcomeLabels[item.disposition]}</span></div>
        <dl><div><dt>Ring / wedge</dt><dd>{item.ring ?? "No projection"} · {item.wedge ?? "—"}</dd></div><div><dt>Fit score</dt><dd>{item.fitScore?.score ?? "No data"}</dd></div><div><dt>Authority</dt><dd>None</dd></div></dl>
        <p>{item.reasons[0]}</p>
      </article>)}</div>
    </section>

    <section className="scout-safety-strip">
      <TimerReset aria-hidden /><div><strong>Field-person safety gate</strong><span>Approved daylight hours · three check-ins · no trespass · consent before non-public access · hazard controls · no unsafe solo visit · emergency stop-work path.</span></div><b>STRUCTURAL BLOCK</b>
    </section>

    <div className="scout-action-boundary"><AlertTriangle aria-hidden /><strong>Recommendation only</strong><span>Cannot contact, message, lease, pay, commit capital, assign a live route, track GPS, take photographs or write Production.</span></div>
  </div>
}
