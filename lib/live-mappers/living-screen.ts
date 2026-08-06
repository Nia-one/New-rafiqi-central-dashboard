import type { DemandProximityNode, FunnelStage } from "@/lib/operating-data"

type Row = Record<string, any>
const n = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "").trim()
const percent = (numerator: number, denominator: number) => denominator > 0 ? Math.round(numerator / denominator * 100) : 0
const displayDate = (input: string) => {
  const date = new Date(input)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date) : (input || "No data")
}

function stage(label: string, today: number, mtd: number, previous: number | null = null): FunnelStage {
  return { label, today, mtd, todayConversion: previous && previous > 0 ? percent(today, previous) : null, mtdConversion: previous && previous > 0 ? percent(mtd, previous) : null, delta: "Live Sheet" }
}

const demandChannel = (row: Row) => {
  const identity = `${value(row, "demand id")} ${value(row, "source submission id")} ${value(row, "enterprise id")}`.toUpperCase()
  if (identity.includes("SP-BOT") || identity.includes("UI_SHRAMPARK_SUPPLY")) return "SP"
  if (identity.includes("FONO") || identity.includes("UI_FONO_SUPPLY")) return "FONO"
  return "OTHER"
}
const stageBucket = (row: Row) => {
  const state = `${value(row, "status")} ${value(row, "certainty")}`.toLowerCase()
  if (/drop|lost|reject|cancel/.test(state)) return "Dropped"
  if (/contracted|onboarded|takeover pending|agreement signed|\bwon\b|live/.test(state)) return "Contracted"
  if (/contracting|negotiat|contract review|proposal/.test(state)) return "Contracting"
  return "Lead"
}

function groupedCounts(rows: Row[], owner: (row: Row) => string) {
  const stages = ["Lead", "Contracting", "Contracted", "Dropped"]
  const stageCounts = stages.map((stage) => ({ stage, count: rows.filter((row) => stageBucket(row) === stage).length, requirement: rows.filter((row) => stageBucket(row) === stage).reduce((sum, row) => sum + n(row["headcount required"]), 0) }))
  const byOwner = [...new Set(rows.map(owner).filter(Boolean))].map((name) => {
    const owned = rows.filter((row) => owner(row) === name)
    return { owner: name, total: owned.length, ...Object.fromEntries(stages.map((stage) => [stage.toLowerCase(), owned.filter((row) => stageBucket(row) === stage).length])) }
  }).sort((a, b) => b.total - a.total || a.owner.localeCompare(b.owner))
  return { stageCounts, byOwner }
}

export function buildLivingScreenData(ops: any) {
  const living: Row[] = ops?.living ?? []
  const studios: Row[] = ops?.studios ?? []
  const demand: Row[] = ops?.enterpriseDemand ?? []
  const people: Row[] = ops?.people ?? []
  const dashboard: Row[] = ops?.livingDashboard ?? []
  const person = (actorId: string) => people.find((row) => value(row, "actor id") === actorId)?.["display name"] || actorId || "Unassigned"
  const existing = living.filter((row) => value(row, "supply model").toUpperCase() === "EXISTING")
  const fono = living.filter((row) => value(row, "supply model").toUpperCase() === "FONO")
  const sp = living.filter((row) => value(row, "supply model").toUpperCase() === "SP")
  const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + n(row[key]), 0)
  const latestExistingByStudio = new Map<string, Row>()
  for (const row of existing) {
    const studioId = value(row, "studio id")
    if (!studioId) continue
    const previous = latestExistingByStudio.get(studioId)
    const rowTime = Date.parse(value(row, "updated at") || "1970-01-01")
    const previousTime = Date.parse(value(previous, "updated at") || "1970-01-01")
    if (!previous || rowTime >= previousTime) latestExistingByStudio.set(studioId, row)
  }
  const existingCurrent = [...latestExistingByStudio.values()]
  // UI_Occupancy/EXISTING is its own governed ledger. It must remain separate
  // from FONO and SP acquisition rows even when a Studio ID happens to match.
  const governedFono = fono
  const governedSp = sp
  const fonoDemandRows = demand.filter((row) => demandChannel(row) === "FONO")
  const spDemandRows = demand.filter((row) => demandChannel(row) === "SP")
  // Current channel supply is governed by the FONO/SP demand feeds. Living
  // Hourly currently contains only the independent EXISTING snapshot, so use
  // an explicit channel row there when present and otherwise the channel feed.
  const fonoContracted = governedFono.length ? sum(governedFono, "contracted nests") : sum(fonoDemandRows, "headcount required")
  const fonoReady = governedFono.length ? sum(governedFono, "activation ready nests") : sum(fonoDemandRows, "headcount matched")
  const fonoOccupied = governedFono.length ? sum(governedFono, "occupied nests") : sum(fonoDemandRows, "headcount matched")
  const demandRequired = sum(spDemandRows, "headcount required")
  const demandMatched = sum(spDemandRows, "headcount matched")
  const spContracted = governedSp.length ? sum(governedSp, "contracted nests") : demandRequired
  const spReady = governedSp.length ? sum(governedSp, "activation ready nests") : demandMatched
  const spOccupied = governedSp.length ? sum(governedSp, "occupied nests") : demandMatched
  const occupancyContracted = fonoContracted + spContracted
  const occupancyOccupied = fonoOccupied + spOccupied
  const dashboardMetric = (key: string) => dashboard.find((row) => value(row, "key") === key)
  const metricNumber = (key: string) => n(dashboardMetric(key)?.["value number"])
  const metricOwner = (key: string) => person(value(dashboardMetric(key), "owner actor id"))
  const metricText = (key: string) => value(dashboardMetric(key), "value text")
  const metricTemplate = (key: string, fallback: string) => {
    const template = metricText(key) || fallback
    return template
      .replaceAll("{demandRequired}", demandRequired.toLocaleString("en-IN"))
      .replaceAll("{demandMatched}", demandMatched.toLocaleString("en-IN"))
      .replaceAll("{fonoOccupied}", fonoOccupied.toLocaleString("en-IN"))
      .replaceAll("{fonoReady}", fonoReady.toLocaleString("en-IN"))
      .replaceAll("{spReady}", spReady.toLocaleString("en-IN"))
      .replaceAll("{liveCapacity}", (fonoReady + spReady).toLocaleString("en-IN"))
      .replaceAll("{fonoStudios}", occupancyRows.length.toLocaleString("en-IN"))
      .replaceAll("{occupancyContracted}", occupancyContracted.toLocaleString("en-IN"))
      .replaceAll("{occupancyOccupied}", occupancyOccupied.toLocaleString("en-IN"))
      .replaceAll("{demandRows}", demandRows.length.toLocaleString("en-IN"))
      .replaceAll("{openDemandNodes}", proximityNodes.filter((node) => node.status.toLowerCase() !== "matched" && node.members > 0).length.toLocaleString("en-IN"))
  }

  const fonoSupply: FunnelStage[] = [stage("Contracted Nests", fonoContracted, fonoContracted), stage("Activation-ready Nests", fonoReady, fonoReady, fonoContracted), stage("Occupied Nests", fonoOccupied, fonoOccupied, fonoReady)]
  const fonoPipeline = groupedCounts(fonoDemandRows, (row) => person(value(row, "owner actor id")))
  const spPipeline = groupedCounts(spDemandRows, (row) => person(value(row, "owner actor id")))
  const fonoDemand: FunnelStage[] = fonoPipeline.stageCounts.map((item, index, items) => stage(item.stage, item.count, item.count, index ? items[index - 1].count : null))
  const fonoRequirementStages: FunnelStage[] = fonoPipeline.stageCounts.map((item, index, items) => stage(item.stage, item.requirement, item.requirement, index ? items[index - 1].requirement : null))
  const demandStages: FunnelStage[] = spPipeline.stageCounts.map((item, index, items) => stage(item.stage, item.count, item.count, index ? items[index - 1].count : null))
  const supplyStages: FunnelStage[] = [stage("SP ready Nests", spReady, spReady), stage("SP occupied Nests", spOccupied, spOccupied, spReady)]

  const occupancyRows = governedFono.filter((row) => n(row["contracted nests"]) > 0).map((row) => {
    const contracted = n(row["contracted nests"]); const occupied = n(row["occupied nests"])
    const studioId = value(row, "studio id")
    const studioName = value(row, "studio name") || studios.find((studio) => value(studio, "studio id") === studioId)?.["studio name"] || studioId
    return [studioName, value(row, "theatre id"), String(contracted), String(occupied), `${percent(occupied, contracted)}%`, String(Math.max(0, contracted - occupied)), person(value(row, "owner actor id") || value(row, "next action owner actor id"))]
  })
  const existingOccupancyRows = existingCurrent.filter((row) => n(row["contracted nests"]) > 0).map((row) => {
    const contracted = n(row["contracted nests"]); const occupied = n(row["occupied nests"])
    const studioId = value(row, "studio id")
    const studioName = value(row, "studio name") || studios.find((studio) => value(studio, "studio id") === studioId)?.["studio name"] || studioId
    return [studioName, value(row, "theatre id"), String(contracted), String(occupied), String(Math.max(0, contracted - occupied)), `${percent(occupied, contracted)}%`, displayDate(value(row, "updated at"))]
  })
  const existingByTheatre = [...new Set(existingCurrent.map((row) => value(row, "theatre id")).filter(Boolean))].map((theatreId) => {
    const rows = existingCurrent.filter((row) => value(row, "theatre id") === theatreId)
    const contracted = sum(rows, "contracted nests"); const occupied = sum(rows, "occupied nests")
    return [theatreId, String(rows.length), String(contracted), String(occupied), String(Math.max(0, contracted - occupied)), `${percent(occupied, contracted)}%`]
  })
  const existingContracted = sum(existingCurrent, "contracted nests")
  const existingOccupied = sum(existingCurrent, "occupied nests")
  const demandRows = spDemandRows.map((row) => [value(row, "plant name") || value(row, "enterprise name"), "1", value(row, "theatre id"), displayDate(value(row, "activation required at")), person(value(row, "owner actor id")), displayDate(value(row, "opened at")), stageBucket(row)])
  const supplyRows = studios.filter((row) => value(row, "supply model").toUpperCase() === "SP").map((row) => [value(row, "studio name") || value(row, "studio id"), metricText("jco") || "Unassigned", metricText("relationship_manager") || "Unassigned", value(row, "studio name") || value(row, "studio id"), `${metricNumber("distance_km")} km`, `${metricNumber("response_hours")}h`, value(row, "contract status") || value(row, "readiness status") || "No data"])

  const spStudios = studios.filter((row) => value(row, "supply model").toUpperCase() === "SP")
  const proximityNodes: DemandProximityNode[] = spDemandRows.map((row, demandIndex) => {
    const demandLat = n(row.latitude); const demandLon = n(row.longitude)
    const options = spStudios.map((studio, index) => {
      const studioLat = n(studio.latitude); const studioLon = n(studio.longitude)
      const latDelta = (demandLat - studioLat) * 111
      const lonDelta = (demandLon - studioLon) * 111 * Math.cos(demandLat * Math.PI / 180)
      const hasCoordinates = demandLat !== 0 && demandLon !== 0 && studioLat !== 0 && studioLon !== 0
      return {
        id: value(studio, "studio id") || `sp-${index + 1}`,
        name: value(studio, "studio name") || value(studio, "studio id"),
        distanceKm: hasCoordinates ? Math.round(Math.sqrt(latDelta ** 2 + lonDelta ** 2) * 10) / 10 : 999,
        angle: Math.round((360 / Math.max(1, spStudios.length)) * index + 18),
      }
    }).sort((a, b) => a.distanceKm - b.distanceKm)
    const required = n(row["headcount required"]); const matched = n(row["headcount matched"])
    const opened = new Date(value(row, "opened at")); const activation = new Date(value(row, "activation required at"))
    return {
      id: value(row, "demand id") || `demand-${demandIndex + 1}`,
      demandName: value(row, "plant name") || value(row, "enterprise name") || "Unnamed demand",
      shortName: value(row, "plant name") || "Demand",
      location: value(row, "theatre id") || "No theatre",
      members: Math.max(0, required - matched),
      activation: displayDate(value(row, "activation required at")),
      activationOrder: Number.isFinite(activation.getTime()) ? activation.getTime() : Number.MAX_SAFE_INTEGER,
      unmatchedDays: Number.isFinite(opened.getTime()) ? Math.max(0, Math.floor((Date.now() - opened.getTime()) / 86400000)) : 0,
      owner: person(value(row, "owner actor id")),
      status: required <= matched ? "Matched" : (value(row, "status") || "Open"),
      options,
    }
  })

  const fonoStudioCount = new Set(governedFono.map((row) => value(row, "studio id")).filter(Boolean)).size
  const fonoReadyStudioCount = new Set(governedFono.filter((row) => n(row["activation ready nests"]) > 0).map((row) => value(row, "studio id")).filter(Boolean)).size
  const fonoOccupiedStudioCount = new Set(governedFono.filter((row) => n(row["occupied nests"]) > 0).map((row) => value(row, "studio id")).filter(Boolean)).size
  const fonoOwner = person(governedFono.map((row) => value(row, "next action owner actor id")).find(Boolean) || fonoDemandRows.map((row) => value(row, "owner actor id")).find(Boolean) || "")
  return { fonoSupply, fonoDemand, fonoRequirementStages, demandStages, supplyStages, occupancyRows, existingOccupancyRows, existingByTheatre, existingContracted, existingOccupied, existingVacant: Math.max(0, existingContracted - existingOccupied), existingOccupancyPercent: percent(existingOccupied, existingContracted), demandRows, supplyRows, proximityNodes, fonoPipeline, spPipeline, occupancyContracted, occupancyOccupied, occupancyPercent: percent(occupancyOccupied, occupancyContracted), fonoReady, fonoOccupied, fonoOwner, fonoStudioCount, fonoReadyStudioCount, fonoOccupiedStudioCount, demandRequired, demandMatched, spReady, metricNumber, metricOwner, metricTemplate }
}
