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
  const occupancySource = existing.length > 0 ? existing : fono
  const occupancyContracted = sum(occupancySource, "contracted nests")
  const occupancyOccupied = sum(occupancySource, "occupied nests")
  const fonoReady = sum(fono, "activation ready nests")
  const fonoOccupied = sum(fono, "occupied nests")
  const demandRequired = sum(demand, "headcount required")
  const demandMatched = sum(demand, "headcount matched")
  const spReady = sum(sp, "activation ready nests")
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

  const fonoSupply: FunnelStage[] = [stage("Contracted Nests", sum(fono, "contracted nests"), sum(fono, "contracted nests")), stage("Activation-ready Nests", fonoReady, fonoReady, sum(fono, "contracted nests")), stage("Occupied Nests", fonoOccupied, fonoOccupied, fonoReady)]
  const fonoDemand: FunnelStage[] = [stage("Demand required", demandRequired, demandRequired), stage("Demand matched", demandMatched, demandMatched, demandRequired), stage("Members active", fonoOccupied, fonoOccupied, demandMatched)]
  const demandStages: FunnelStage[] = [stage("Demand required", demandRequired, demandRequired), stage("Demand matched", demandMatched, demandMatched, demandRequired)]
  const supplyStages: FunnelStage[] = [stage("SP ready Nests", spReady, spReady), stage("SP occupied Nests", sum(sp, "occupied nests"), sum(sp, "occupied nests"), spReady)]

  const occupancyRows = occupancySource.map((row) => {
    const contracted = n(row["contracted nests"]); const occupied = n(row["occupied nests"])
    const studioId = value(row, "studio id")
    const studioName = studios.find((studio) => value(studio, "studio id") === studioId)?.["studio name"] || studioId
    return [studioName, value(row, "theatre id"), String(contracted), String(occupied), `${percent(occupied, contracted)}%`, String(Math.max(0, contracted - occupied))]
  })
  const demandRows = demand.map((row) => [value(row, "plant name") || value(row, "enterprise name"), String(n(row["headcount required"])), value(row, "theatre id"), displayDate(value(row, "activation required at")), person(value(row, "owner actor id")), displayDate(value(row, "opened at")), value(row, "status") || "Open"])
  const supplyRows = studios.filter((row) => value(row, "supply model").toUpperCase() === "SP").map((row) => [value(row, "studio name") || value(row, "studio id"), metricText("jco") || "Unassigned", metricText("relationship_manager") || "Unassigned", value(row, "studio name") || value(row, "studio id"), `${metricNumber("distance_km")} km`, `${metricNumber("response_hours")}h`, value(row, "contract status") || value(row, "readiness status") || "No data"])

  const spStudios = studios.filter((row) => value(row, "supply model").toUpperCase() === "SP")
  const proximityNodes: DemandProximityNode[] = demand.map((row, demandIndex) => {
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

  return { fonoSupply, fonoDemand, demandStages, supplyStages, occupancyRows, demandRows, supplyRows, proximityNodes, occupancyContracted, occupancyOccupied, occupancyPercent: percent(occupancyOccupied, occupancyContracted), fonoReady, fonoOccupied, demandRequired, demandMatched, spReady, metricNumber, metricOwner, metricTemplate }
}
