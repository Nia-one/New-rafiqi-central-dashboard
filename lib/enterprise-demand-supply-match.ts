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
const THEATRE_RULES: Record<string, { maxKm: number; maxMinutes?: number }> = {
  coromandel: { maxKm: 15, maxMinutes: 30 },
  deccan: { maxKm: 10 },
}

function normalize(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() }

async function discoverSources(): Promise<SourceConfig[]> {
  const token = await accessToken()
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}?fields=sheets.properties(title)`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!response.ok) throw new Error(`Unable to inspect Enterprise demand/supply tabs: ${response.status} ${await response.text()}`)
  const json = await response.json() as { sheets?: { properties?: { title?: string } }[] }
  const titles = (json.sheets ?? []).map((sheet) => String(sheet.properties?.title ?? "").trim()).filter(Boolean)
  const demandSuffix = /(?:\s|-)+(req|requirement|requirements|demand)$/i
  const supplySuffixes = ["properties", "property", "supply"]
  return titles.flatMap((demandTab) => {
    if (!demandSuffix.test(demandTab)) return []
    const theatre = demandTab.replace(demandSuffix, "").trim()
    const supplyTab = titles.find((title) => supplySuffixes.some((suffix) => normalize(title) === normalize(`${theatre} ${suffix}`)))
    if (!supplyTab) return []
    return [{ theatre, demandTab, supplyTab, ...(THEATRE_RULES[normalize(theatre)] ?? { maxKm: 10 }) }]
  })
}

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
function columnIndex(headers: string[], names: string[], fallback = -1) {
  const normalized = headers.map(normalize)
  for (const name of names) {
    const exact = normalized.indexOf(normalize(name))
    if (exact >= 0) return exact
  }
  return fallback
}

type RouteMatrixElement = { originIndex?: number; destinationIndex?: number; distanceMeters?: number; duration?: string; condition?: string; status?: { code?: number; message?: string } }

const VALHALLA_ENDPOINT = "https://valhalla1.openstreetmap.de/sources_to_targets"
const ROUTE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const routeCache = new Map<string, { expiresAt: number; rows: RouteMatrixElement[] }>()

async function bikeRouteMatrix(origins: { lat: number; lng: number }[], destinations: { lat: number; lng: number }[]) {
  if (!origins.length || !destinations.length) throw new Error(`Routing requires coordinates; received ${origins.length} demand origins and ${destinations.length} supply destinations.`)
  const cacheKey = JSON.stringify({ origins, destinations, costing: "motor_scooter" })
  const cached = routeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.rows
  const rows: RouteMatrixElement[] = []
  for (let originStart = 0; originStart < origins.length; originStart += 10) {
    for (let destinationStart = 0; destinationStart < destinations.length; destinationStart += 10) {
      const originChunk = origins.slice(originStart, originStart + 10)
      const destinationChunk = destinations.slice(destinationStart, destinationStart + 10)
      const response = await fetch(VALHALLA_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "RafiQi-Central/1.0 (enterprise-demand-supply-matching)" }, body: JSON.stringify({ sources: originChunk.map(({ lat, lng }) => ({ lat, lon: lng })), targets: destinationChunk.map(({ lat, lng }) => ({ lat, lon: lng })), costing: "motor_scooter", units: "kilometers" }), cache: "no-store" })
      if (!response.ok) throw new Error(`Valhalla motor-scooter routing failed: ${response.status} ${await response.text()}`)
      const json = await response.json() as { sources_to_targets?: { from_index: number; to_index: number; distance?: number; time?: number }[][] }
      rows.push(...(json.sources_to_targets ?? []).flat().filter((row) => Number.isFinite(row.distance) && Number.isFinite(row.time)).map((row) => ({ originIndex: originStart + row.from_index, destinationIndex: destinationStart + row.to_index, distanceMeters: Number(row.distance) * 1000, duration: `${Number(row.time)}s`, condition: "ROUTE_EXISTS" })))
    }
  }
  routeCache.set(cacheKey, { expiresAt: Date.now() + ROUTE_CACHE_TTL_MS, rows })
  return rows
}

export async function loadEnterpriseDemandSupplyMatches(): Promise<DemandSupplyMatch[]> {
  const SOURCES = await discoverSources()
  const ranges = SOURCES.flatMap((source) => [`'${source.demandTab}'!A1:U1000`, `'${source.supplyTab}'!A1:R1000`])
  const tables = await readRanges(ranges)
  const output: DemandSupplyMatch[] = []

  for (const [sourceIndex, source] of SOURCES.entries()) {
    const demandTable = tables[sourceIndex * 2] ?? []
    const supplyTable = tables[sourceIndex * 2 + 1] ?? []
    const demandHeaders = demandTable[0] ?? []
    const supplyHeaders = supplyTable[0] ?? []
    const demands = demandTable.slice(1).map((row) => ({ company: value(row, columnIndex(demandHeaders, ["Company Name", "Enterprise Name", "Client Name"], 0)), status: value(row, columnIndex(demandHeaders, ["Current Status", "Demand Status", "Status"], 17)), location: value(row, columnIndex(demandHeaders, ["Company Location", "Demand Location", "Location"], 4)), coordinate: parseCoordinate(row[columnIndex(demandHeaders, ["Google Location", "Lat & Long", "Latitude Longitude"], 6)]) })).filter((row) => row.company && row.coordinate)
    const supplies = supplyTable.slice(1).map((row) => ({ property: value(row, columnIndex(supplyHeaders, ["Property Location", "Property Name", "Location", "Supply Location"], 1)), coordinate: parseCoordinate(row[columnIndex(supplyHeaders, ["Google Location", "Lat & Long", "Latitude Longitude"], 2)]), owner: value(row, columnIndex(supplyHeaders, ["Owner Name", "Property Owner", "Owner"], 3)), hunter: value(row, columnIndex(supplyHeaders, ["Hunted By", "Hunting Person", "Property Hunter", "EB"], 15)) })).filter((row) => row.property && row.coordinate)

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
          rule: source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} motor-scooter minutes`,
        })
      }
    }
  }
  return output
}

export async function syncEnterpriseSupplyMatchColumns() {
  const SOURCES = await discoverSources()
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
        : [source.theatre, "No eligible demand", "", "", "Outside rule", source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} motor-scooter minutes`]
    })
    const body = { range: `'${source.supplyTab}'!S1:X${Math.max(2, values.length + 1)}`, majorDimension: "ROWS", values: [["Theatre", "Nearest Demand Client", "Bike Route Distance (KM)", "Bike Travel Time (Min)", "Match Status", "Matching Rule"], ...values] }
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(body.range)}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
    if (!response.ok) throw new Error(`Unable to update ${source.supplyTab} match columns: ${response.status} ${await response.text()}`)
    changedRows += values.length
  }
  return { changedRows, source: SOURCE_ID, syncedAt: new Date().toISOString() }
}
