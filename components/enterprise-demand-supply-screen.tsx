"use client"

import { useMemo, useState } from "react"
import type { DemandSupplyMatch } from "@/lib/enterprise-demand-supply-match"

const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase()
const supplyKey = (row: DemandSupplyMatch) => row.supplyId || `${row.theatre}:${row.property}`
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
  const [coverage, setCoverage] = useState("All demand")
  const [showSupplyDetails, setShowSupplyDetails] = useState(false)
  const issues = rows.filter((row) => row.dataIssue && (theatre === "All theatres" || row.theatre === theatre))
  const matchRows = rows.filter((row) => !row.dataIssue)
  const theatreRows = matchRows.filter((row) => theatre === "All theatres" || row.theatre === theatre)
  const locations = ["All locations", ...Array.from(new Set(theatreRows.map((row) => row.demandLocation || "Location not recorded"))).sort()]
  const enterprises = ["All enterprises", ...Array.from(new Set(theatreRows.map((row) => row.company))).sort()]
  const baseScoped = theatreRows.filter((row) => (location === "All locations" || (row.demandLocation || "Location not recorded") === location) && (enterprise === "All enterprises" || row.company === enterprise))
  const demandHasEligible = new Map(Array.from(new Set(baseScoped.map((row) => `${row.theatre}:${row.company}`))).map((key) => [key, baseScoped.some((row) => `${row.theatre}:${row.company}` === key && row.eligible)]))
  const scoped = baseScoped.filter((row) => coverage === "All demand" || (coverage === "Matched demand" ? demandHasEligible.get(`${row.theatre}:${row.company}`) : coverage === "No eligible option" ? !demandHasEligible.get(`${row.theatre}:${row.company}`) : false))
  const filtered = (view === "All evaluated properties" ? scoped : Array.from(new Set(scoped.map((row) => `${row.theatre}:${row.company}`))).map((key) => {
    const candidates = scoped.filter((row) => `${row.theatre}:${row.company}` === key)
    return candidates.find((row) => row.rank === 1) ?? [...candidates].sort((a, b) => a.bikeMinutes - b.bikeMinutes || a.bikeDistanceKm - b.bikeDistanceKm)[0]
  })).filter(Boolean)
  const visibleIssues = issues.filter((row) => {
    if (row.dataIssueKind === "demand") {
      return (location === "All locations" || (row.demandLocation || "Location not recorded") === location)
        && (enterprise === "All enterprises" || row.company === enterprise)
        && (coverage === "All demand" || coverage === "Data pending")
    }
    return location === "All locations" && enterprise === "All enterprises" && coverage === "All demand"
  })
  const firstMatches = filtered.filter((row) => row.eligible && row.rank === 1)
  const verifiedMatches = filtered.filter(isVerifiedMatch)
  const totalDemandCount = new Set([...filtered.map((row) => `${row.theatre}:${row.company}`), ...visibleIssues.filter((row) => row.dataIssueKind === "demand").map((row) => `${row.theatre}:${row.company}`)]).size
  const totalSupplyCount = new Set([...scoped.map(supplyKey), ...visibleIssues.filter((row) => row.dataIssueKind === "supply").map(supplyKey)]).size
  const listedSupplyCount = new Set([...theatreRows.map(supplyKey), ...issues.filter((row) => row.dataIssueKind === "supply").map(supplyKey)]).size
  const supplyRecords = Array.from(new Map([...theatreRows, ...issues.filter((row) => row.dataIssueKind === "supply")].map((row) => [supplyKey(row), row])).values())
  const routeReadySupplyCount = supplyRecords.filter((row) => row.propertyLat !== undefined && row.propertyLng !== undefined && !row.dataIssue).length
  const hunterPerformance = Array.from(firstMatches.reduce((summary, row) => {
    const hunter = row.hunter.trim()
    if (hunter) summary.set(hunter, (summary.get(hunter) ?? 0) + 1)
    return summary
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  return <div className="enterprise-match-screen">
    {!embedded && <section className="decision-bar"><div><span>ENTERPRISE DEMAND VS SUPPLY</span><strong>{firstMatches.length} provisional matches · {verifiedMatches.length} verified matches</strong></div><p>Source updates are reflected automatically on dashboard refresh.</p></section>}
    <section className="business-report-panel">
      <div className="section-heading enterprise-match-heading"><p className="pillar-kicker">{embedded ? "5 · " : ""}ENTERPRISE DEMAND VS SUPPLY</p><h2>Demand → supply shortlist · free map check</h2></div>
      <div className="enterprise-match-filters">
        <label>Theatre<select aria-label="Match theatre" value={theatre} onChange={(event) => { setTheatre(event.target.value); setLocation("All locations"); setEnterprise("All enterprises") }}>{theatres.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Location<select aria-label="Match location" value={locations.includes(location) ? location : "All locations"} onChange={(event) => setLocation(event.target.value)}>{locations.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Enterprise<select aria-label="Match enterprise" value={enterprises.includes(enterprise) ? enterprise : "All enterprises"} onChange={(event) => setEnterprise(event.target.value)}>{enterprises.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Coverage<select aria-label="Match coverage" value={coverage} onChange={(event) => setCoverage(event.target.value)}><option>All demand</option><option>Matched demand</option><option>No eligible option</option><option>Data pending</option></select></label>
        <label>View<select aria-label="Match view" value={view} onChange={(event) => setView(event.target.value)}><option>Best option per demand</option><option>All evaluated properties</option></select></label>
      </div>
      <div className="business-kpi-strip"><article><span>DEMANDS</span><strong>{totalDemandCount}</strong><small>{new Set(filtered.map((row) => `${row.theatre}:${row.company}`)).size} with valid coordinates</small></article><article className="clickable-kpi"><button type="button" aria-expanded={showSupplyDetails} onClick={() => setShowSupplyDetails((open) => !open)}><span>SUPPLY OPTIONS</span><strong>{totalSupplyCount}</strong><small>{routeReadySupplyCount} named and route-ready · view full data</small></button></article><article><span>PROVISIONAL MATCHES</span><strong>{firstMatches.length}</strong><small>free-router shortlist</small></article><article><span>VERIFIED MATCHES</span><strong>{verifiedMatches.length}</strong><small>verified route results</small></article><article><span>NO OPTION</span><strong>{filtered.filter((row) => !row.eligible).length}</strong><small>outside theatre criteria</small></article></div>
      {showSupplyDetails && <section className="supply-detail-panel" aria-label="Supply option details"><div className="supply-detail-heading"><strong>SUPPLY OPTION DETAILS</strong><span>{supplyRecords.length} source rows · {routeReadySupplyCount} named and route-ready</span></div><div className="table-wrap"><table><thead><tr><th>PROPERTY / OWNER</th><th>CONTACT / HUNTER</th><th>ROOM TYPE / SIZE</th><th>ROOMS / CAPACITY</th><th>COST / RENT / ADVANCE</th><th>EB / DRAINAGE</th><th>NEARBY FACILITIES</th><th>DATA STATUS</th></tr></thead><tbody>{supplyRecords.map((row) => <tr key={`supply:${supplyKey(row)}`}><td><strong>{row.property}</strong><small>{row.propertyOwner || "Owner not available"} · {row.supplyDate || "Date not available"}</small></td><td><strong>{row.supplyContact || "Contact not available"}</strong><small>{row.hunter || "Property hunter not available"}</small></td><td><strong>{row.supplyRoomType || "Not available"}</strong><small>{row.supplySize || "Size not available"}</small></td><td><strong>{row.supplyTotalRooms || "—"} rooms</strong><small>{row.supplyCapacityWithoutBunk || "—"} without bunk · {row.supplyBunkCapacity || "—"} bunk</small></td><td><strong>{row.supplyCostWithoutBeds || "—"} / {row.supplyCostWithBeds || "—"}</strong><small>Rent {row.supplyRoomRent || "—"} · Advance {row.supplyAdvance || "—"}</small></td><td><strong>{row.supplyEb || "Not available"}</strong><small>{row.supplyDrainage || "Drainage not available"}</small></td><td>{row.supplyNearbyFacilities || "Not available"}</td><td><strong>{row.dataIssue ? "Incomplete source row" : "Route-ready"}</strong><small>{row.dataIssue || "Coordinates and property name available"}</small></td></tr>)}</tbody></table></div></section>}
      <div className="hunter-performance-summary"><strong>PROPERTY HUNTER PERFORMANCE</strong><span>{hunterPerformance.length ? hunterPerformance.map(([hunter, matches]) => `${hunter}: ${matches} matched ${matches === 1 ? "property" : "properties"}`).join(" · ") : "Property Hunter names Y column mein pending hain"}</span></div>
      <div className="table-wrap"><table><thead><tr><th>THEATRE</th><th>DEMAND / LOCATION</th><th>DEMAND STATUS / OWNER</th><th>SUPPLY FUNNEL</th><th>BEST PROPERTY</th><th>PROPERTY HUNTER</th><th>DISTANCE / TIME</th><th>MAP CHECK</th><th>DECISION STATUS</th></tr></thead><tbody>{filtered.map((row) => {
        const routeUrl = googleMapsUrl(row)
        const verified = isVerifiedMatch(row)
        const candidates = baseScoped.filter((candidate) => candidate.theatre === row.theatre && candidate.company === row.company)
        const eligibleCount = candidates.filter((candidate) => candidate.eligible).length
        return <tr key={`${row.theatre}-${row.company}-${row.property}`}><td>{row.theatre}</td><td><strong>{row.company}</strong><small>{row.demandLocation || "Location not recorded"}</small></td><td><strong>{row.demandStatus}</strong><small>{row.salesPerson || "Sales person not available"}</small></td><td><strong>{listedSupplyCount} hunted</strong><small>{candidates.length} route checked · {eligibleCount} within criteria</small></td><td><strong>{row.eligible || view === "All evaluated properties" ? row.property : "No option within criteria"}</strong><small>{row.propertyOwner ? `Owner: ${row.propertyOwner}` : "Owner not available"}</small></td><td>{row.hunter || "Not available in sheet"}</td><td><strong>{row.bikeDistanceKm.toFixed(2)} km</strong><small>{row.bikeMinutes.toFixed(1)} min · estimated</small></td><td>{routeUrl ? <a className="google-maps-route-link" href={routeUrl} target="_blank" rel="noreferrer" aria-label={`Open Google Maps route for ${row.company} to ${row.property}`}>Open route ↗</a> : "Coordinates unavailable"}</td><td><strong>{verified ? "Verified match" : row.verificationStatus || (row.eligible ? "Provisional match" : "Provisional no option")}</strong><small>{verified && row.verifiedBy ? `Verified by ${row.verifiedBy}` : `${row.rule} · verification pending`}</small></td></tr>
      })}{visibleIssues.map((row) => <tr className="enterprise-data-issue-row" key={`issue:${row.theatre}:${row.company}:${row.property}`}>
        <td>{row.theatre}</td>
        <td><strong>{row.dataIssueKind === "demand" ? row.company : "—"}</strong><small>{row.dataIssueKind === "demand" ? row.demandLocation : "Demand not applicable"}</small></td>
        <td><strong>Coordinates unavailable</strong><small>{row.salesPerson || "Sales person not available"}</small></td>
        <td><strong>{listedSupplyCount} hunted</strong><small>0 route checked · 0 within criteria</small></td>
        <td><strong>{row.dataIssueKind === "supply" ? row.property : "Matching pending"}</strong><small>{row.dataIssue}</small></td>
        <td>{row.hunter || "Not available in sheet"}</td>
        <td><strong>Not calculated</strong><small>{row.dataIssueKind === "demand" ? "Demand coordinates missing" : row.rule === "Property name required" ? "Property name missing" : "Property coordinates missing"}</small></td>
        <td>{row.demandLocation === "Coordinates available" ? "Property name required" : "Coordinates unavailable"}</td>
        <td><strong>Data pending</strong><small>{row.rule} · included in count</small></td>
      </tr>)}</tbody></table></div>
      <p className="footer-note">Automatic distance and duration use the free OpenStreetMap Valhalla motor_scooter router and remain provisional. A result is shown as “Verified match” only when the verified property, distance, time, and verification status are available. No paid Google API is used.</p>
    </section>
  </div>
}
