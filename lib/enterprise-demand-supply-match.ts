import { GoogleAuth } from "google-auth-library"
import { googleServiceAccountCredentials } from "./googleCredentials"

const SOURCE_ID = "1sD05271Z-MNEvS-1cRneavjF0XLmxdUhHczxZ1HlAVs"
export type DemandSupplyMatch = {
  theatre: string
  company: string
  demandStatus: string
  demandLocation: string
  property: string
  propertyOwner: string
  hunter: string
  distanceKm: number
  bikeDistanceKm: number
  bikeMinutes: number
  eligible: boolean
  rank: number | null
  rule: string
}

type SourceConfig = { theatre: string; demandTab: string; supplyTab: string; maxKm: number; maxMinutes?: number }
const SOURCES: readonly SourceConfig[] = [
  { theatre: "Coromandel", demandTab: "Coromandel-Req", supplyTab: "Coromandel-Properties", maxKm: 15, maxMinutes: 30 },
]

function parseCoordinate(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase()
  const parts = [...text.matchAll(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])/g)]
  if (parts.length < 2) return null
  const convert = (part: RegExpMatchArray) => {
    const decimal = Number(part[1]) + Number(part[2]) / 60 + Number(part[3]) / 3600
    return /[SW]/.test(part[4]) ? -decimal : decimal
  }
  return { lat: convert(parts[0]), lng: convert(parts[1]) }
}

async function accessToken(scope = "https://www.googleapis.com/auth/spreadsheets.readonly") {
  const auth = new GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: [scope] })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  const value = typeof token === "string" ? token : token?.token
  if (!value) throw new Error("Unable to authenticate the Enterprise demand/supply source.")
  return value
}

async function readRanges(ranges: string[]) {
  const token = await accessToken()
  const params = new URLSearchParams()
  ranges.forEach((range) => params.append("ranges", range))
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values:batchGet?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!response.ok) throw new Error(`Enterprise demand/supply source unavailable: ${response.status} ${await response.text()}`)
  const json = await response.json() as { valueRanges?: { values?: string[][] }[] }
  return (json.valueRanges ?? []).map((range) => range.values ?? [])
}

function value(row: string[], index: number) { return String(row[index] ?? "").trim() }

type RouteMatrixElement = { originIndex?: number; destinationIndex?: number; distanceMeters?: number; duration?: string; condition?: string; status?: { code?: number; message?: string } }

async function bikeRouteMatrix(origins: { lat: number; lng: number }[], destinations: { lat: number; lng: number }[]) {
  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY ?? "").trim()
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is required for exact two-wheeler distance and travel time.")
  if (origins.length * destinations.length > 100) throw new Error("A two-wheeler Route Matrix request cannot exceed 100 origin/destination pairs.")
  const waypoint = (coordinate: { lat: number; lng: number }) => ({ waypoint: { location: { latLng: { latitude: coordinate.lat, longitude: coordinate.lng } } } })
  const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition,status" },
    body: JSON.stringify({ origins: origins.map(waypoint), destinations: destinations.map(waypoint), travelMode: "TWO_WHEELER", routingPreference: "TRAFFIC_AWARE" }),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Google Maps two-wheeler routing failed: ${response.status} ${await response.text()}`)
  return await response.json() as RouteMatrixElement[]
}

export async function loadEnterpriseDemandSupplyMatches(): Promise<DemandSupplyMatch[]> {
  const ranges = SOURCES.flatMap((source) => [`'${source.demandTab}'!A1:U1000`, `'${source.supplyTab}'!A1:R1000`])
  const tables = await readRanges(ranges)
  const output: DemandSupplyMatch[] = []

  for (const [sourceIndex, source] of SOURCES.entries()) {
    const demandRows = (tables[sourceIndex * 2] ?? []).slice(1)
    const supplyRows = (tables[sourceIndex * 2 + 1] ?? []).slice(1)
    const demands = demandRows.map((row) => ({ company: value(row, 0), status: value(row, 16), location: value(row, 17), coordinate: parseCoordinate(row[18]) })).filter((row) => row.company && row.coordinate)
    const supplies = supplyRows.map((row) => ({ property: value(row, 1), coordinate: parseCoordinate(row[2]), owner: value(row, 3), hunter: value(row, 15) })).filter((row) => row.property && row.coordinate)

    const matrix = await bikeRouteMatrix(demands.map((row) => row.coordinate!), supplies.map((row) => row.coordinate!))
    for (const [demandIndex, demand] of demands.entries()) {
      const candidates = supplies.map((supply, supplyIndex) => {
        const route = matrix.find((element) => element.originIndex === demandIndex && element.destinationIndex === supplyIndex)
        if (!route || route.condition !== "ROUTE_EXISTS" || !route.distanceMeters || !route.duration) return null
        const bikeDistanceKm = route.distanceMeters / 1000
        const bikeMinutes = Number(route.duration.replace(/s$/, "")) / 60
        const eligible = bikeDistanceKm <= source.maxKm && (source.maxMinutes === undefined || bikeMinutes <= source.maxMinutes)
        return { supply, bikeDistanceKm, bikeMinutes, eligible }
      }).filter((row): row is NonNullable<typeof row> => row !== null).sort((a, b) => a.bikeMinutes - b.bikeMinutes || a.bikeDistanceKm - b.bikeDistanceKm)
      let eligibleRank = 0
      for (const candidate of candidates) {
        if (candidate.eligible) eligibleRank += 1
        output.push({
          theatre: source.theatre, company: demand.company, demandStatus: demand.status || "Not updated", demandLocation: demand.location,
          property: candidate.supply.property, propertyOwner: candidate.supply.owner, hunter: candidate.supply.hunter || "Unassigned",
          distanceKm: Number(candidate.bikeDistanceKm.toFixed(2)), bikeDistanceKm: Number(candidate.bikeDistanceKm.toFixed(2)), bikeMinutes: Number(candidate.bikeMinutes.toFixed(1)),
          eligible: candidate.eligible, rank: candidate.eligible ? eligibleRank : null,
          rule: source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} estimated minutes`,
        })
      }
    }
  }
  return output
}

export async function syncEnterpriseSupplyMatchColumns() {
  const matches = await loadEnterpriseDemandSupplyMatches()
  const token = await accessToken("https://www.googleapis.com/auth/spreadsheets")
  let changedRows = 0
  for (const source of SOURCES) {
    const sourceMatches = matches.filter((row) => row.theatre === source.theatre)
    const properties = Array.from(new Set(sourceMatches.map((row) => row.property)))
    const values = properties.map((property) => {
      const candidates = sourceMatches.filter((row) => row.property === property && row.eligible).sort((a, b) => a.bikeMinutes - b.bikeMinutes || a.bikeDistanceKm - b.bikeDistanceKm)
      const nearest = candidates[0]
      return nearest
        ? [source.theatre, nearest.company, nearest.bikeDistanceKm, nearest.bikeMinutes, "Eligible", nearest.rule]
        : [source.theatre, "No eligible demand", "", "", "Outside rule", source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} estimated minutes`]
    })
    const body = { range: `'${source.supplyTab}'!S1:X${Math.max(2, values.length + 1)}`, majorDimension: "ROWS", values: [["Theatre", "Nearest Demand Client", "Bike Route Distance (KM)", "Bike Travel Time (Min)", "Match Status", "Matching Rule"], ...values] }
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(body.range)}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
    if (!response.ok) throw new Error(`Unable to update ${source.supplyTab} match columns: ${response.status} ${await response.text()}`)
    changedRows += values.length
  }
  return { changedRows, source: SOURCE_ID, syncedAt: new Date().toISOString() }
}
