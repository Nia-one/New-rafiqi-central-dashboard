"use client"

import { useMemo, useState } from "react"
import type { DemandSupplyMatch } from "@/lib/enterprise-demand-supply-match"

type FunnelTab = "matched" | "inventory" | "hunting" | "distance"
type MatchFilter = "all" | "full" | "partial" | "incomplete"
const n = (value: unknown) => { const cleaned = String(value ?? "").replace(/[^0-9.-]/g, ""); if (!cleaned) return null; const parsed = Number(cleaned); return Number.isFinite(parsed) ? parsed : null }
const key = (row: DemandSupplyMatch) => row.supplyId || `${row.theatre}:${row.property}:${row.propertyOwner}`
const money = (value?: string) => value ? `Rs ${value}` : "Not available"

export function EnterpriseSupplyFunnelScreen({ rows }: { rows: DemandSupplyMatch[] }) {
  const [tab, setTab] = useState<FunnelTab>("matched")
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all")
  const inventory = useMemo(() => {
    const liveInventory = rows.filter((row) => row.inventoryOnly)
    const supplyRows = liveInventory.length ? liveInventory : rows.filter((row) => row.supplyId && row.dataIssueKind !== "demand")
    return Array.from(new Map(supplyRows.map((row) => [key(row), row])).values())
  }, [rows])
  const matches = rows.filter((row) => !row.inventoryOnly && !row.dataIssue)
  const demandIssues = rows.filter((row) => row.dataIssueKind === "demand")
  const demandKeys = Array.from(new Set([...matches.map((row) => `${row.theatre}:${row.company}`), ...demandIssues.map((row) => `${row.theatre}:${row.company}`)]))
  const allDemands = demandKeys.map((demandKey) => {
    const candidates = matches.filter((row) => `${row.theatre}:${row.company}` === demandKey)
    const issue = demandIssues.find((row) => `${row.theatre}:${row.company}` === demandKey)
    const base = candidates[0] || issue!
    const neededWithout = n(base?.demandCapacityWithoutBunk)
    const neededWith = n(base?.demandCapacityWithBunk)
    const needed = neededWithout || neededWith
    const budget = n(base?.demandBudgetPerHead)
    const assessed = candidates.map((candidate) => {
      const candidateCapacity = n(neededWith ? candidate.supplyBunkCapacity : candidate.supplyCapacityWithoutBunk)
      const candidateCost = n(neededWith ? candidate.supplyCostWithBeds : candidate.supplyCostWithoutBeds)
      const candidateCapacityOk = needed !== null && candidateCapacity !== null ? candidateCapacity >= needed : null
      const candidateBudgetOk = budget !== null && candidateCost !== null ? candidateCost <= budget : null
      const candidateComplete = needed !== null && budget !== null && candidateCapacity !== null && candidateCost !== null
      const candidateStatus = !candidateComplete ? "incomplete" : candidate.eligible && candidateCapacityOk && candidateBudgetOk ? "full" : candidate.eligible && (candidateCapacityOk || candidateBudgetOk) ? "partial" : "outside"
      return { candidate, candidateStatus }
    })
    const priority = { full: 0, partial: 1, outside: 2, incomplete: 3 } as const
    const best = [...assessed].sort((a, b) => priority[a.candidateStatus] - priority[b.candidateStatus] || a.candidate.bikeDistanceKm - b.candidate.bikeDistanceKm || a.candidate.bikeMinutes - b.candidate.bikeMinutes)[0]?.candidate
    const capacity = best ? n(neededWith ? best.supplyBunkCapacity : best.supplyCapacityWithoutBunk) : null
    const cost = best ? n(neededWith ? best.supplyCostWithBeds : best.supplyCostWithoutBeds) : null
    const distanceOk = Boolean(best?.eligible)
    const capacityOk = needed !== null && capacity !== null ? capacity >= needed : null
    const budgetOk = budget !== null && cost !== null ? cost <= budget : null
    const complete = Boolean(best) && needed !== null && budget !== null && capacity !== null && cost !== null
    const status = !complete ? "incomplete" : distanceOk && capacityOk && budgetOk ? "full" : distanceOk && (capacityOk || budgetOk) ? "partial" : "outside"
    return { base, best, candidates, needed, budget, capacity, cost, distanceOk, capacityOk, budgetOk, status }
  })
  const full = allDemands.filter((row) => row.status === "full").length
  const partial = allDemands.filter((row) => row.status === "partial").length
  const incomplete = allDemands.filter((row) => row.status === "incomplete").length
  const demands = allDemands.filter((row) => matchFilter === "all" || row.status === matchFilter)
  // Preserve the total-lead KPI while Array.map naturally skips the sparse
  // slots added after the filtered client cards.
  if (matchFilter !== "all") demands.length = allDemands.length
  const routeReady = inventory.filter((row) => row.propertyLat !== undefined && row.propertyLng !== undefined && !row.dataIssue).length
  const capacityTotal = inventory.reduce((sum, row) => sum + (n(row.supplyCapacityWithoutBunk) || 0), 0)
  const costValues = inventory.map((row) => n(row.supplyCostWithoutBeds)).filter((value): value is number => value !== null)
  const dates = Array.from(new Set(inventory.map((row) => row.supplyDate).filter(Boolean)))
  const dayCounts = dates.map((date) => inventory.filter((row) => row.supplyDate === date).length)
  const matrixProperties = inventory.filter((row) => row.propertyLat !== undefined && row.propertyLng !== undefined && !row.dataIssue)

  return <section className="operating-section supply-funnel-screen" aria-label="Supply Funnel dashboard">
    <div className="enterprise-stage-heading"><div><p className="pillar-kicker">LIVE SUPPLY FUNNEL</p><h2>Demand suitability, inventory, hunting and distance grid</h2></div><p>{inventory.length} live source rows</p></div>
    <div className="supply-funnel-tabs" role="tablist" aria-label="Supply Funnel views">
      {([['matched','Client - Supply Matched'],['inventory','Property Inventory'],['hunting','Hunting Details'],['distance','Distance Grid']] as const).map(([id,label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id !== "matched") setMatchFilter("all") }}>{label}</button>)}
    </div>

    {tab === "matched" && <div className="supply-match-filters" role="group" aria-label="Filter clients by suitability">
      {([['all', `All (${allDemands.length})`], ['full', `Fully Suitable Studio (${full})`], ['partial', `Partially Suitable Studio (${partial})`], ['incomplete', `Client Data Incomplete (${incomplete})`]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={matchFilter === id} onClick={() => setMatchFilter(id)}>{label}</button>)}
    </div>}

    {tab === "matched" && <div role="tabpanel"><div className="supply-funnel-kpis"><article><span>Total B2B Lead</span><strong>{demands.length}</strong></article><article data-tone="good"><span>Fully Suitable</span><strong>{full}</strong></article><article data-tone="warn"><span>Partially Suitable</span><strong>{partial}</strong></article><article><span>Client Data Incomplete</span><strong>{incomplete}</strong></article></div><div className="supply-match-cards">{demands.map(({ base,best,candidates,needed,budget,capacity,cost,distanceOk,capacityOk,budgetOk,status }) => <details key={`${base.theatre}:${base.company}`}><summary><b data-status={status}>{status === 'full' ? 'Fully suitable' : status === 'partial' ? 'Partially suitable' : status === 'outside' ? 'Outside criteria' : 'Client/property data incomplete'}</b><strong>{base.company}</strong><span>{needed ?? '—'} people · {money(base.demandBudgetPerHead)}/head</span><em>→ {best?.property || 'Matching pending'}</em></summary><div className="supply-match-detail"><div className="supply-client-meta"><span>Contact<b>{[base.demandContactPerson, base.demandContactNumber].filter(Boolean).join(' · ') || 'Not available'}</b></span><span>Required headcount<b>{needed ?? 'Not specified'}</b></span><span>Budget<b>{budget === null ? 'Not specified' : `Rs ${budget} / head`}</b></span></div>{best ? <><h3>Recommended property · {best.property} <small>{best.propertyOwner || 'Owner not available'} · {best.supplyContact || 'Contact not available'}</small></h3><div className="supply-criteria"><span data-pass={distanceOk}>Distance<b>{best.bikeDistanceKm.toFixed(2)} km · {best.bikeMinutes.toFixed(1)} min</b></span><span data-pass={budgetOk === true}>Budget<b>{cost === null ? 'Property cost missing' : `Rs ${cost} vs Rs ${budget ?? '—'}`}</b></span><span data-pass={capacityOk === true}>Capacity<b>{capacity ?? '—'} available vs {needed ?? '—'} needed</b></span></div><p>Lead tracker: {base.demandAssignedProperty || 'Assigned property not recorded'} · {base.demandStatus || 'Status not recorded'} · {base.demandDistanceNote || 'No client distance note'}</p><div className="table-wrap"><table><thead><tr><th>OTHER CANDIDATE</th><th>DISTANCE / TIME</th><th>COST / HEAD</th><th>CAPACITY</th><th>ROUTE STATUS</th></tr></thead><tbody>{candidates.slice(0,8).map((candidate) => <tr key={`${base.company}:${key(candidate)}`}><td><strong>{candidate.property}</strong><small>{candidate.propertyOwner || 'Owner not available'}</small></td><td>{candidate.bikeDistanceKm.toFixed(2)} km · {candidate.bikeMinutes.toFixed(1)} min</td><td>{money(neededWith(base) ? candidate.supplyCostWithBeds : candidate.supplyCostWithoutBeds)}</td><td>{neededWith(base) ? candidate.supplyBunkCapacity || '—' : candidate.supplyCapacityWithoutBunk || '—'}</td><td>{candidate.eligible ? 'Within route rule' : 'Outside route rule'}</td></tr>)}</tbody></table></div></> : <p className="enterprise-data-note">{base.dataIssue || 'No routed property is available.'}</p>}</div></details>)}</div></div>}

    {tab === "inventory" && <div role="tabpanel"><div className="supply-funnel-kpis"><article><span>Properties Listed</span><strong>{inventory.length}</strong></article><article data-tone="good"><span>Route-ready Properties</span><strong>{routeReady}</strong></article><article data-tone="warn"><span>Total Capacity (Without Bunk)</span><strong>{capacityTotal}</strong></article><article><span>Avg Cost/Head</span><strong>{costValues.length ? `Rs ${Math.round(costValues.reduce((a,b)=>a+b,0)/costValues.length).toLocaleString('en-IN')}` : '—'}</strong></article></div><InventoryTable rows={inventory} /></div>}
    {tab === "hunting" && <div role="tabpanel"><div className="supply-funnel-kpis"><article><span>Properties Found</span><strong>{inventory.length}</strong></article><article data-tone="good"><span>Days Active</span><strong>{dates.length}</strong></article><article data-tone="warn"><span>Best Day</span><strong>{dayCounts.length ? Math.max(...dayCounts) : 0}</strong></article><article><span>Avg / Day</span><strong>{dates.length ? (inventory.length / dates.length).toFixed(1) : '—'}</strong></article></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>PROPERTY</th><th>OWNER / CONTACT</th><th>HUNTER</th><th>DATA STATUS</th></tr></thead><tbody>{inventory.map((row) => <tr key={`hunt:${key(row)}`}><td>{row.supplyDate || 'Not available'}</td><td><strong>{row.property}</strong><small>{row.supplyRoomType || 'Room type not available'}</small></td><td><strong>{row.propertyOwner || 'Owner not available'}</strong><small>{row.supplyContact || 'Contact not available'}</small></td><td>{row.hunter || 'Not assigned'}</td><td>{row.dataIssue || 'Route-ready'}</td></tr>)}</tbody></table></div></div>}
    {tab === "distance" && <div role="tabpanel"><div className="supply-funnel-kpis"><article><span>Client–Property Pairs</span><strong>{matches.length}</strong></article><article data-tone="good"><span>Closest Route</span><strong>{matches.length ? `${Math.min(...matches.map((row)=>row.bikeDistanceKm)).toFixed(2)} km` : '—'}</strong></article><article data-tone="warn"><span>Farthest Route</span><strong>{matches.length ? `${Math.max(...matches.map((row)=>row.bikeDistanceKm)).toFixed(2)} km` : '—'}</strong></article><article><span>Route-ready Supply</span><strong>{routeReady}</strong></article></div><div className="supply-distance-grid"><table><thead><tr><th>CLIENT</th>{matrixProperties.map((row) => <th key={`head:${key(row)}`}>{row.property}</th>)}</tr></thead><tbody>{demands.map(({base}) => <tr key={`grid:${base.company}`}><th>{base.company}</th>{matrixProperties.map((property) => { const pair = matches.find((row) => row.company === base.company && key(row) === key(property)); return <td key={`cell:${base.company}:${key(property)}`} data-distance={pair ? pair.bikeDistanceKm <= 3 ? 'near' : pair.bikeDistanceKm <= 8 ? 'mid' : 'far' : 'na'}>{pair ? pair.bikeDistanceKm.toFixed(2) : '—'}</td> })}</tr>)}</tbody></table></div><p className="footer-note">Distances are provisional motor-scooter route results from the free Valhalla/OpenStreetMap router. Blank cells mean a route result is unavailable.</p></div>}
  </section>
}

const neededWith = (row: DemandSupplyMatch) => Boolean(n(row.demandCapacityWithBunk))
function InventoryTable({ rows }: { rows: DemandSupplyMatch[] }) { return <div className="table-wrap"><table><thead><tr><th>LOCATION</th><th>OWNER / CONTACT</th><th>ROUTE STATUS</th><th>CAPACITY W/O BUNK</th><th>CAPACITY WITH BUNK</th><th>COST/HEAD W/O BUNK</th><th>COST/HEAD WITH BUNK</th><th>ROOMS</th><th>HUNTER</th><th>NEARBY FACILITIES</th></tr></thead><tbody>{rows.map((row) => <tr key={`inventory:${key(row)}`}><td><strong>{row.property}</strong><small>{row.supplyRoomType || 'Not available'}</small></td><td><strong>{row.propertyOwner || 'Not available'}</strong><small>{row.supplyContact || 'Not available'}</small></td><td>{row.dataIssue || 'Route-ready'}</td><td>{row.supplyCapacityWithoutBunk || '—'}</td><td>{row.supplyBunkCapacity || '—'}</td><td>{money(row.supplyCostWithoutBeds)}</td><td>{money(row.supplyCostWithBeds)}</td><td>{row.supplyTotalRooms || '—'}</td><td>{row.hunter || 'Not assigned'}</td><td>{row.supplyNearbyFacilities || 'Not available'}</td></tr>)}</tbody></table></div> }
