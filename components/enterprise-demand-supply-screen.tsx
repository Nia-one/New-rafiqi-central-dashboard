"use client"

import { useMemo, useState } from "react"
import type { DemandSupplyMatch } from "@/lib/enterprise-demand-supply-match"

export function EnterpriseDemandSupplyScreen({ rows, embedded = false }: { rows: DemandSupplyMatch[]; embedded?: boolean }) {
  const theatres = useMemo(() => ["All theatres", ...Array.from(new Set(rows.map((row) => row.theatre))).sort()], [rows])
  const [theatre, setTheatre] = useState("All theatres")
  const [location, setLocation] = useState("All locations")
  const [enterprise, setEnterprise] = useState("All enterprises")
  const [view, setView] = useState("Best option per demand")
  const issues = rows.filter((row) => row.dataIssue && (theatre === "All theatres" || row.theatre === theatre))
  const matchRows = rows.filter((row) => !row.dataIssue)
  const theatreRows = matchRows.filter((row) => theatre === "All theatres" || row.theatre === theatre)
  const locations = ["All locations", ...Array.from(new Set(theatreRows.map((row) => row.demandLocation || "Location not recorded"))).sort()]
  const enterprises = ["All enterprises", ...Array.from(new Set(theatreRows.map((row) => row.company))).sort()]
  const scoped = theatreRows.filter((row) => (location === "All locations" || (row.demandLocation || "Location not recorded") === location) && (enterprise === "All enterprises" || row.company === enterprise))
  const filtered = view === "All evaluated properties" ? scoped : Array.from(new Set(scoped.map((row) => `${row.theatre}:${row.company}`))).map((key) => {
    const candidates = scoped.filter((row) => `${row.theatre}:${row.company}` === key)
    return candidates.find((row) => row.rank === 1) ?? [...candidates].sort((a, b) => a.bikeMinutes - b.bikeMinutes || a.bikeDistanceKm - b.bikeDistanceKm)[0]
  }).filter(Boolean)
  const eligible = filtered.filter((row) => row.eligible)
  const firstMatches = eligible.filter((row) => row.rank === 1)
  return <div className="enterprise-match-screen">
    {!embedded && <section className="decision-bar"><div><span>ENTERPRISE DEMAND VS SUPPLY</span><strong>{firstMatches.length} demands have a first-choice property</strong></div><p>Source updates are reflected automatically on dashboard refresh.</p></section>}
    <section className="business-report-panel">
      <div className="section-heading"><div><p className="pillar-kicker">{embedded ? "5 · " : ""}ENTERPRISE DEMAND VS SUPPLY</p><h2>Best property option by exact motor-scooter route</h2></div></div>
      <div className="enterprise-match-filters">
        <label>Theatre<select aria-label="Match theatre" value={theatre} onChange={(event) => { setTheatre(event.target.value); setLocation("All locations"); setEnterprise("All enterprises") }}>{theatres.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Location<select aria-label="Match location" value={locations.includes(location) ? location : "All locations"} onChange={(event) => setLocation(event.target.value)}>{locations.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Enterprise<select aria-label="Match enterprise" value={enterprises.includes(enterprise) ? enterprise : "All enterprises"} onChange={(event) => setEnterprise(event.target.value)}>{enterprises.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>View<select aria-label="Match view" value={view} onChange={(event) => setView(event.target.value)}><option>Best option per demand</option><option>All evaluated properties</option></select></label>
      </div>
      {issues.length ? <div className="enterprise-data-issues" role="status">{issues.map((issue) => <article key={issue.theatre}><strong>{issue.theatre}: Data not available</strong><span>{issue.dataIssue}</span><small>Matching cannot be calculated until the required sheet data is available.</small></article>)}</div> : null}
      <div className="business-kpi-strip"><article><span>DEMANDS</span><strong>{new Set(filtered.map((row) => `${row.theatre}:${row.company}`)).size}</strong><small>with valid coordinates</small></article><article><span>SUPPLY OPTIONS</span><strong>{new Set(scoped.map((row) => `${row.theatre}:${row.property}`)).size}</strong><small>with valid coordinates</small></article><article><span>FIRST MATCHES</span><strong>{firstMatches.length}</strong><small>rank 1 eligible supply</small></article><article><span>NO OPTION</span><strong>{filtered.filter((row) => !row.eligible).length}</strong><small>outside theatre criteria</small></article></div>
      <div className="table-wrap"><table><thead><tr><th>THEATRE</th><th>ENTERPRISE / LOCATION</th><th>DEMAND STATUS</th><th>MATCH RANK</th><th>MATCHED PROPERTY</th><th>NEAREST CHECKED PROPERTY / LOCATION</th><th>HUNTED BY</th><th>BIKE DISTANCE</th><th>BIKE TIME</th><th>RESULT</th><th>CRITERIA</th></tr></thead><tbody>{filtered.map((row) => <tr key={`${row.theatre}-${row.company}-${row.property}`}><td>{row.theatre}</td><td><strong>{row.company}</strong><small>{row.demandLocation || "Location not recorded"}</small></td><td>{row.demandStatus}</td><td>{row.rank ?? "—"}</td><td><strong>{row.eligible || view === "All evaluated properties" ? row.property : "No option within criteria"}</strong><small>{row.eligible && row.propertyOwner ? `Owner: ${row.propertyOwner}` : row.propertyOwner && view === "All evaluated properties" ? `Owner: ${row.propertyOwner}` : ""}</small></td><td>{!row.eligible && view !== "All evaluated properties" ? <><strong>{row.property}</strong><small>{row.propertyOwner ? `Owner: ${row.propertyOwner}` : "Nearest available supply"}</small></> : "—"}</td><td>{row.eligible || view === "All evaluated properties" ? row.hunter : "—"}</td><td>{row.bikeDistanceKm.toFixed(2)} km</td><td>{row.bikeMinutes.toFixed(1)} min</td><td>{row.eligible ? "Matched" : "No option"}</td><td>{row.rule}</td></tr>)}</tbody></table></div>
      <p className="footer-note">Distance and duration come from OpenStreetMap road data through the free Valhalla motor_scooter router; no straight-line estimate is used. Coromandel rule: maximum 15 km and 30 bike minutes. Deccan rule: maximum 10 km. Future theatre demand and supply tab pairs are discovered automatically. Public routing is fair-use and may occasionally be unavailable or rate-limited.</p>
    </section>
  </div>
}
