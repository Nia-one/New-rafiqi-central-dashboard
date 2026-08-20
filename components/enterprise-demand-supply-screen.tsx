"use client"

import { useMemo, useState } from "react"
import type { DemandSupplyMatch } from "@/lib/enterprise-demand-supply-match"

const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase()
const isVerifiedMatch = (row: DemandSupplyMatch) => normalized(row.verificationStatus) === "verified match" && normalized(row.verifiedProperty) === normalized(row.property) && Number.isFinite(row.verifiedDistanceKm) && Number.isFinite(row.verifiedBikeMinutes)
const googleMapsUrl = (row: DemandSupplyMatch) => row.demandLat !== undefined && row.demandLng !== undefined && row.propertyLat !== undefined && row.propertyLng !== undefined
  ? `https://www.google.com/maps/dir/${row.demandLat},${row.demandLng}/${row.propertyLat},${row.propertyLng}/`
  : ""

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
  const filtered = (view === "All evaluated properties" ? scoped : Array.from(new Set(scoped.map((row) => `${row.theatre}:${row.company}`))).map((key) => {
    const candidates = scoped.filter((row) => `${row.theatre}:${row.company}` === key)
    return candidates.find((row) => row.rank === 1) ?? [...candidates].sort((a, b) => a.bikeMinutes - b.bikeMinutes || a.bikeDistanceKm - b.bikeDistanceKm)[0]
  })).filter(Boolean)
  const firstMatches = filtered.filter((row) => row.eligible && row.rank === 1)
  const verifiedMatches = filtered.filter(isVerifiedMatch)
  const totalDemandCount = new Set([...filtered.map((row) => `${row.theatre}:${row.company}`), ...issues.filter((row) => row.dataIssueKind === "demand").map((row) => `${row.theatre}:${row.company}`)]).size
  const totalSupplyCount = new Set([...scoped.map((row) => `${row.theatre}:${row.property}`), ...issues.filter((row) => row.dataIssueKind === "supply").map((row) => `${row.theatre}:${row.property}`)]).size
  const hunterPerformance = Array.from(firstMatches.reduce((summary, row) => {
    const hunter = row.hunter.trim()
    if (hunter) summary.set(hunter, (summary.get(hunter) ?? 0) + 1)
    return summary
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  return <div className="enterprise-match-screen">
    {!embedded && <section className="decision-bar"><div><span>ENTERPRISE DEMAND VS SUPPLY</span><strong>{firstMatches.length} provisional matches · {verifiedMatches.length} verified matches</strong></div><p>Source updates are reflected automatically on dashboard refresh.</p></section>}
    <section className="business-report-panel">
      <div className="section-heading"><div><p className="pillar-kicker">{embedded ? "5 · " : ""}ENTERPRISE DEMAND VS SUPPLY</p><h2>Property shortlist with free Google Maps verification</h2></div></div>
      <div className="enterprise-match-filters">
        <label>Theatre<select aria-label="Match theatre" value={theatre} onChange={(event) => { setTheatre(event.target.value); setLocation("All locations"); setEnterprise("All enterprises") }}>{theatres.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Location<select aria-label="Match location" value={locations.includes(location) ? location : "All locations"} onChange={(event) => setLocation(event.target.value)}>{locations.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Enterprise<select aria-label="Match enterprise" value={enterprises.includes(enterprise) ? enterprise : "All enterprises"} onChange={(event) => setEnterprise(event.target.value)}>{enterprises.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>View<select aria-label="Match view" value={view} onChange={(event) => setView(event.target.value)}><option>Best option per demand</option><option>All evaluated properties</option></select></label>
      </div>
      {issues.length ? <div className="enterprise-data-issues" role="status">{issues.map((issue) => <article key={`${issue.theatre}:${issue.company}:${issue.property}`}><strong>{issue.theatre}: Coordinates unavailable</strong><span>{issue.dataIssue}</span><small>Record dashboard count mein included hai; route matching coordinates milne ke baad calculate hoga.</small></article>)}</div> : null}
      <div className="business-kpi-strip"><article><span>DEMANDS</span><strong>{totalDemandCount}</strong><small>{new Set(filtered.map((row) => `${row.theatre}:${row.company}`)).size} with valid coordinates</small></article><article><span>SUPPLY OPTIONS</span><strong>{totalSupplyCount}</strong><small>{new Set(scoped.map((row) => `${row.theatre}:${row.property}`)).size} with valid coordinates</small></article><article><span>PROVISIONAL MATCHES</span><strong>{firstMatches.length}</strong><small>free-router shortlist</small></article><article><span>VERIFIED MATCHES</span><strong>{verifiedMatches.length}</strong><small>verified route results</small></article><article><span>NO OPTION</span><strong>{filtered.filter((row) => !row.eligible).length}</strong><small>outside theatre criteria</small></article></div>
      <div className="hunter-performance-summary"><strong>PROPERTY HUNTER PERFORMANCE</strong><span>{hunterPerformance.length ? hunterPerformance.map(([hunter, matches]) => `${hunter}: ${matches} matched ${matches === 1 ? "property" : "properties"}`).join(" · ") : "Property Hunter names Y column mein pending hain"}</span></div>
      <div className="table-wrap"><table><thead><tr><th>THEATRE</th><th>ENTERPRISE / LOCATION</th><th>DEMAND STATUS</th><th>SALES PERSON</th><th>MATCH RANK</th><th>MATCHED PROPERTY</th><th>NEAREST CHECKED PROPERTY / LOCATION</th><th>PROPERTY HUNTER</th><th>AUTO ROUTE</th><th>GOOGLE MAPS CHECK</th><th>APPROVAL STATUS</th><th>CRITERIA</th></tr></thead><tbody>{filtered.map((row) => {
        const routeUrl = googleMapsUrl(row)
        const verified = isVerifiedMatch(row)
        return <tr key={`${row.theatre}-${row.company}-${row.property}`}><td>{row.theatre}</td><td><strong>{row.company}</strong><small>{row.demandLocation || "Location not recorded"}</small></td><td>{row.demandStatus}</td><td>{row.salesPerson || "Not available in sheet"}</td><td>{row.rank ?? "—"}</td><td><strong>{row.eligible || view === "All evaluated properties" ? row.property : "No option within criteria"}</strong><small>{row.propertyOwner ? `Owner: ${row.propertyOwner}` : ""}</small></td><td><strong>{row.property}</strong><small>{row.propertyOwner ? `Owner: ${row.propertyOwner}` : "Nearest available supply"}</small></td><td>{row.hunter || "Not available in sheet"}</td><td><strong>{row.bikeDistanceKm.toFixed(2)} km</strong><small>{row.bikeMinutes.toFixed(1)} min · estimated</small></td><td>{routeUrl ? <a className="google-maps-route-link" href={routeUrl} target="_blank" rel="noreferrer" aria-label={`Open Google Maps route for ${row.company} to ${row.property}`}>Open Google Maps ↗</a> : "Coordinates unavailable"}<small className="google-maps-route-note">{row.verifiedDistanceKm !== undefined && row.verifiedBikeMinutes !== undefined ? `${row.verifiedDistanceKm.toFixed(2)} km · ${row.verifiedBikeMinutes.toFixed(1)} min` : "Coordinate route · two-wheeler select karein"}</small></td><td><strong>{verified ? "Verified match" : row.verificationStatus || (row.eligible ? "Provisional match" : "Provisional no option")}</strong><small>{verified && row.verifiedBy ? `Verified by ${row.verifiedBy}` : "Verification pending"}</small></td><td>{row.rule}</td></tr>
      })}</tbody></table></div>
      <p className="footer-note">Automatic distance and duration use the free OpenStreetMap Valhalla motor_scooter router and remain provisional. A result is shown as “Verified match” only when the verified property, distance, time, and verification status are available. No paid Google API is used.</p>
    </section>
  </div>
}
