import { GoogleAuth } from "google-auth-library"
import { googleServiceAccountCredentials } from "./googleCredentials"

const SOURCE_ID = "1sD05271Z-MNEvS-1cRneavjF0XLmxdUhHczxZ1HlAVs"
const MATCH_RESULTS_TAB = "Enterprise-Match-Results"
let lastVerifiedMatches: DemandSupplyMatch[] = []
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
  dataIssue?: string
}

type SourceConfig = { theatre: string; demandTab: string; supplyTab?: string; maxKm: number; maxMinutes?: number }
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

async function readStoredMatches(): Promise<DemandSupplyMatch[]> {
  try {
    const [rows = []] = await readRanges([`'${MATCH_RESULTS_TAB}'!A2:M5000`])
    return rows.map((row) => {
      const theatre = value(row, 0)
      const company = value(row, 1)
      return { theatre, company, demandStatus: value(row, 2), demandLocation: value(row, 3), property: value(row, 4), propertyOwner: value(row, 5), hunter: value(row, 6), distanceKm: Number(row[7]) || 0, bikeDistanceKm: Number(row[8]) || 0, bikeMinutes: Number(row[9]) || 0, eligible: normalize(row[10]) === "true", rank: row[11] === "" || row[11] === undefined ? null : Number(row[11]), rule: value(row, 12), dataIssue: company === "Data not available" ? `${theatre}-Properties supply tab not available · Enterprise coordinates not available` : undefined }
    }).filter((row) => row.theatre && row.company && row.property)
  } catch {
    return []
  }
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

async function calculateEnterpriseDemandSupplyMatches(): Promise<DemandSupplyMatch[]> {
  const SOURCES = await discoverSources()
  const ranges = SOURCES.flatMap((source) => [`'${source.demandTab}'!A1:U1000`, ...(source.supplyTab ? [`'${source.supplyTab}'!A1:R1000`] : [])])
  const tables = await readRanges(ranges)
  const output: DemandSupplyMatch[] = []
  let tableIndex = 0

  for (const source of SOURCES) {
    const demandTable = tables[tableIndex++] ?? []
    const supplyTable = source.supplyTab ? tables[tableIndex++] ?? [] : []
    const demandHeaders = demandTable[0] ?? []
    const supplyHeaders = supplyTable[0] ?? []
    const demandCoordinateIndex = columnIndex(demandHeaders, ["Google Location", "Lat & Long", "Latitude Longitude"], -1)
    const demandRecords = demandTable.slice(1).map((row) => ({ company: value(row, columnIndex(demandHeaders, ["Company Name", "Enterprise Name", "Client Name"], 0)), status: value(row, columnIndex(demandHeaders, ["Current Status", "Demand Status", "Status"], 17)), location: value(row, columnIndex(demandHeaders, ["Company Location", "Demand Location", "Location"], 4)), coordinate: demandCoordinateIndex >= 0 ? parseCoordinate(row[demandCoordinateIndex]) : null })).filter((row) => row.company)
    if (!source.supplyTab || !demandRecords.some((row) => row.coordinate)) {
      const issues = [!source.supplyTab ? `${source.theatre}-Properties supply tab not available` : "", !demandRecords.some((row) => row.coordinate) ? "Enterprise coordinates not available" : ""].filter(Boolean)
      output.push({ theatre: source.theatre, company: "Data not available", demandStatus: "Matching cannot be calculated", demandLocation: "Coordinates not available", property: "Data not available", propertyOwner: "", hunter: "", distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} motor-scooter minutes`, dataIssue: issues.join(" · ") })
      continue
    }
    const demands = demandRecords.filter((row): row is typeof row & { coordinate: { lat: number; lng: number } } => Boolean(row.coordinate))
    const supplies = supplyTable.slice(1).map((row) => ({ property: value(row, columnIndex(supplyHeaders, ["Property Location", "Property Name", "Location", "Supply Location"], 1)), coordinate: parseCoordinate(row[columnIndex(supplyHeaders, ["Google Location", "Lat & Long", "Latitude Longitude"], 2)]), owner: value(row, columnIndex(supplyHeaders, ["Owner Name", "Property Owner", "Owner"], 3)), hunter: value(row, columnIndex(supplyHeaders, ["Hunted By", "Hunting Person", "Property Hunter", "EB"], 15)) })).filter((row) => row.property && row.coordinate)
    if (!supplies.length) {
      output.push({ theatre: source.theatre, company: "Data not available", demandStatus: "Matching cannot be calculated", demandLocation: "Coordinates available", property: "Data not available", propertyOwner: "", hunter: "", distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} motor-scooter minutes`, dataIssue: "Supply property coordinates not available" })
      continue
    }

    let matrix: RouteMatrixElement[]
    try {
      matrix = await bikeRouteMatrix(demands.map((row) => row.coordinate!), supplies.map((row) => row.coordinate!))
    } catch (error) {
      const stored = await readStoredMatches()
      if (stored.length) {
        console.warn("Live motor-scooter router unavailable; serving the last verified persisted match matrix.", error)
        return stored
      }
      throw error
    }
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

export async function loadEnterpriseDemandSupplyMatches(): Promise<DemandSupplyMatch[]> {
  try {
    const calculated = await calculateEnterpriseDemandSupplyMatches()
    if (calculated.length) {
      lastVerifiedMatches = calculated
      return calculated
    }
    const stored = await readStoredMatches()
    if (stored.length) {
      lastVerifiedMatches = stored
      return stored
    }
    return lastVerifiedMatches
  } catch (error) {
    const stored = await readStoredMatches()
    if (stored.length) {
      console.warn("Live Enterprise matching inputs unavailable; serving the last verified persisted match matrix.", error)
      lastVerifiedMatches = stored
      return stored
    }
    if (lastVerifiedMatches.length) {
      console.warn("Live and persisted Enterprise matching inputs unavailable; serving the last successful in-process match matrix.", error)
      return lastVerifiedMatches
    }
    throw error
  }
}

export async function syncEnterpriseSupplyMatchColumns() {
  const SOURCES = await discoverSources()
  const matches = await loadEnterpriseDemandSupplyMatches()
  const token = await accessToken("https://www.googleapis.com/auth/spreadsheets")
  let changedRows = 0
  for (const source of SOURCES) {
    if (!source.supplyTab) continue
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
  const metadataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}?fields=sheets.properties(title)`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!metadataResponse.ok) throw new Error(`Unable to inspect persisted match tab: ${metadataResponse.status} ${await metadataResponse.text()}`)
  const metadata = await metadataResponse.json() as { sheets?: { properties?: { title?: string } }[] }
  if (!(metadata.sheets ?? []).some((sheet) => sheet.properties?.title === MATCH_RESULTS_TAB)) {
    const createResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: MATCH_RESULTS_TAB, gridProperties: { rowCount: 5000, columnCount: 13, frozenRowCount: 1 } } } }] }), cache: "no-store" })
    if (!createResponse.ok) throw new Error(`Unable to create persisted match tab: ${createResponse.status} ${await createResponse.text()}`)
  }
  const storedValues = matches.map((row) => [row.theatre, row.company, row.demandStatus, row.demandLocation, row.property, row.propertyOwner, row.hunter, row.distanceKm, row.bikeDistanceKm, row.bikeMinutes, row.eligible, row.rank ?? "", row.rule])
  const storedRange = `'${MATCH_RESULTS_TAB}'!A1:M${Math.max(2, storedValues.length + 1)}`
  const storedResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(storedRange)}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ range: storedRange, majorDimension: "ROWS", values: [["Theatre", "Enterprise Name", "Demand Status", "Demand Location", "Property", "Property Owner", "Hunted By", "Distance KM", "Bike Route Distance KM", "Bike Travel Time Min", "Eligible", "Match Rank", "Matching Rule"], ...storedValues] }), cache: "no-store" })
  if (!storedResponse.ok) throw new Error(`Unable to persist match matrix: ${storedResponse.status} ${await storedResponse.text()}`)
  return { changedRows, source: SOURCE_ID, syncedAt: new Date().toISOString() }
}
