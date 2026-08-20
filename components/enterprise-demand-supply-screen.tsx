"use client"

import { useMemo, useState } from "react"
import type { DemandSupplyMatch } from "@/lib/enterprise-demand-supply-match"

export function EnterpriseDemandSupplyScreen({ rows }: { rows: DemandSupplyMatch[] }) {
  const theatres = useMemo(() => ["All theatres", ...Array.from(new Set(rows.map((row) => row.theatre))).sort()], [rows])
  const [theatre, setTheatre] = useState("All theatres")
  const filtered = rows.filter((row) => theatre === "All theatres" || row.theatre === theatre)
  const eligible = filtered.filter((row) => row.eligible)
  const firstMatches = eligible.filter((row) => row.rank === 1)
  return <div className="enterprise-match-screen">
    <section className="decision-bar"><div><span>ENTERPRISE DEMAND VS SUPPLY</span><strong>{firstMatches.length} demands have a first-choice property</strong></div><p>Source updates are reflected automatically on dashboard refresh.</p></section>
    <section className="business-report-panel">
      <div className="section-heading"><div><p className="pillar-kicker">THEATRE-WISE MATCHING</p><h2>Closest eligible property, ranked by motor-scooter route time and distance</h2></div><label>Theatre <select value={theatre} onChange={(event) => setTheatre(event.target.value)}>{theatres.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <div className="business-kpi-strip"><article><span>DEMANDS</span><strong>{new Set(filtered.map((row) => `${row.theatre}:${row.company}`)).size}</strong><small>with valid coordinates</small></article><article><span>SUPPLY OPTIONS</span><strong>{new Set(filtered.map((row) => `${row.theatre}:${row.property}`)).size}</strong><small>with valid coordinates</small></article><article><span>FIRST MATCHES</span><strong>{firstMatches.length}</strong><small>rank 1 eligible supply</small></article><article><span>ELIGIBLE PAIRS</span><strong>{eligible.length}</strong><small>within theatre rule</small></article></div>
      <div className="table-wrap"><table><thead><tr><th>THEATRE</th><th>ENTERPRISE</th><th>DEMAND STATUS</th><th>MATCH RANK</th><th>PROPERTY / LOCATION</th><th>HUNTED BY</th><th>BIKE DISTANCE</th><th>BIKE TIME</th><th>MATCH</th></tr></thead><tbody>{filtered.map((row) => <tr key={`${row.theatre}-${row.company}-${row.property}`}><td>{row.theatre}</td><td><strong>{row.company}</strong><small>{row.demandLocation || "Location not recorded"}</small></td><td>{row.demandStatus}</td><td>{row.rank ?? "—"}</td><td><strong>{row.property}</strong><small>{row.propertyOwner ? `Owner: ${row.propertyOwner}` : ""}</small></td><td>{row.hunter}</td><td>{row.bikeDistanceKm.toFixed(2)} km</td><td>{row.bikeMinutes.toFixed(1)} min</td><td>{row.eligible ? "Eligible" : "Outside rule"}</td></tr>)}</tbody></table></div>
      <p className="footer-note">Distance and duration come from OpenStreetMap road data through the free Valhalla motor_scooter router; no straight-line estimate is used. Coromandel rule: maximum 15 km and 30 bike minutes. Deccan rule: maximum 10 km when its source is connected. Public routing is fair-use and may occasionally be unavailable or rate-limited.</p>
    </section>
  </div>
}
