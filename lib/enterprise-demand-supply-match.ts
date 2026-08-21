import { GoogleAuth } from "google-auth-library"
import { googleServiceAccountCredentials } from "./googleCredentials"

const SOURCE_ID = "1sD05271Z-MNEvS-1cRneavjF0XLmxdUhHczxZ1HlAVs"
const MATCH_RESULTS_TAB = "Enterprise-Match-Results"
const ENABLED_THEATRES = new Set(["coromandel"])
let lastVerifiedMatches: DemandSupplyMatch[] = []
export type DemandSupplyMatch = {
  theatre: string
  company: string
  demandStatus: string
  demandLocation: string
  property: string
  propertyOwner: string
  hunter: string
  salesPerson: string
  distanceKm: number
  bikeDistanceKm: number
  bikeMinutes: number
  eligible: boolean
  rank: number | null
  rule: string
  dataIssue?: string
  dataIssueKind?: "demand" | "supply" | "theatre"
  demandLat?: number
  demandLng?: number
  propertyLat?: number
  propertyLng?: number
  verifiedProperty?: string
  verifiedDistanceKm?: number
  verifiedBikeMinutes?: number
  verifiedBy?: string
  verificationStatus?: string
  supplyId?: string
  supplyDate?: string
  supplyContact?: string
  supplyRoomType?: string
  supplySize?: string
  supplyTotalRooms?: string
  supplyCapacityWithoutBunk?: string
  supplyCostWithoutBeds?: string
  supplyBunkCapacity?: string
  supplyCostWithBeds?: string
  supplyRoomRent?: string
  supplyAdvance?: string
  supplyEb?: string
  supplyDrainage?: string
  supplyNearbyFacilities?: string
  inventoryOnly?: boolean
}

type SourceConfig = { theatre: string; demandTab: string; supplyTab?: string; maxKm: number; maxMinutes?: number }
const THEATRE_RULES: Record<string, { maxKm: number; maxMinutes?: number }> = {
  coromandel: { maxKm: 15, maxMinutes: 30 },
  deccan: { maxKm: 10 },
}

function normalize(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() }
function enabledMatches(rows: DemandSupplyMatch[]) { return rows.filter((row) => ENABLED_THEATRES.has(normalize(row.theatre))) }

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
    const theatre = demandTab.replace(demandSuffix, "").replace(/(?:\s|-)+b2b$/i, "").trim()
    if (!ENABLED_THEATRES.has(normalize(theatre))) return []
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
    const [rows = []] = await readRanges([`'${MATCH_RESULTS_TAB}'!A2:W5000`])
    return rows.map((row) => {
      const theatre = value(row, 0)
      const company = value(row, 1)
      const property = value(row, 4)
      const demandIssue = normalize(property) === "matching pending"
      const supplyIssue = normalize(company) === "supply data pending"
      const theatreIssue = normalize(company) === "data not available"
      return { theatre, company, demandStatus: value(row, 2), demandLocation: value(row, 3), property, propertyOwner: value(row, 5), hunter: value(row, 6), salesPerson: value(row, 22), distanceKm: Number(row[7]) || 0, bikeDistanceKm: Number(row[8]) || 0, bikeMinutes: Number(row[9]) || 0, eligible: normalize(row[10]) === "true", rank: row[11] === "" || row[11] === undefined ? null : Number(row[11]), rule: value(row, 12), demandLat: Number(row[13]) || undefined, demandLng: Number(row[14]) || undefined, propertyLat: Number(row[15]) || undefined, propertyLng: Number(row[16]) || undefined, verifiedProperty: value(row, 17), verifiedDistanceKm: row[18] === "" || row[18] === undefined ? undefined : Number(row[18]), verifiedBikeMinutes: row[19] === "" || row[19] === undefined ? undefined : Number(row[19]), verifiedBy: value(row, 20), verificationStatus: value(row, 21), dataIssue: demandIssue ? `Demand coordinates not available for ${company}` : supplyIssue ? `Property coordinates not available for ${property}` : theatreIssue ? `${theatre}-Properties supply tab not available · Enterprise coordinates not available` : undefined, dataIssueKind: demandIssue ? "demand" as const : supplyIssue ? "supply" as const : theatreIssue ? "theatre" as const : undefined }
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

async function readLiveSupplyInventory(): Promise<DemandSupplyMatch[]> {
  const sources = await discoverSources()
  const active = sources.filter((source) => source.supplyTab)
  const tables = await readRanges(active.map((source) => `'${source.supplyTab}'!A1:Y1000`))
  return active.flatMap((source, tableIndex) => {
    const table = tables[tableIndex] ?? []
    const headers = table[0] ?? []
    const index = (names: string[], fallback = -1) => columnIndex(headers, names, fallback)
    return table.slice(1).flatMap((row, rowIndex) => {
      if (!row.some((cell) => String(cell ?? "").trim())) return []
      const sourceRow = rowIndex + 2
      const propertyName = value(row, index(["Property Location", "Property Name", "Location", "Supply Location"], 1))
      const coordinate = parseCoordinate(row[index(["Google Location", "Lat & Long", "Latitude Longitude"], 2)])
      const property = propertyName || `Property name pending (row ${sourceRow})`
      const nameMissing = !propertyName
      return [{ theatre: source.theatre, company: "Supply inventory", demandStatus: "Not applicable", demandLocation: coordinate ? "Coordinates available" : "Coordinates unavailable", property, propertyOwner: value(row, index(["Owner Name", "Property Owner", "Owner"], 3)), hunter: value(row, index(["Hunted By", "Hunting Person", "Property Hunter", "Property Hunting Person"], -1)), salesPerson: "", distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: nameMissing ? "Property name required" : coordinate ? "Live supply inventory" : "Coordinates required", dataIssue: nameMissing ? `Property/location name is blank in source row ${sourceRow}` : coordinate ? undefined : `Property coordinates not available for ${property}`, dataIssueKind: "supply" as const, inventoryOnly: true, supplyId: `${normalize(source.theatre)}:row-${sourceRow}`, propertyLat: coordinate?.lat, propertyLng: coordinate?.lng, supplyDate: value(row, index(["Date"], 0)), supplyContact: value(row, index(["Contact", "Contact Number"], 4)), supplyRoomType: value(row, index(["Room Type", "Room Tye"], 5)), supplySize: value(row, index(["Size, ft", "Size"], 6)), supplyTotalRooms: value(row, index(["Total Rooms"], 7)), supplyCapacityWithoutBunk: value(row, index(["Without Bunk beds Capacity"], 8)), supplyCostWithoutBeds: value(row, index(["Cost (W/o Beds)", "Cost Without Beds"], 9)), supplyBunkCapacity: value(row, index(["Bunk Bed Capacity"], 10)), supplyCostWithBeds: value(row, index(["Cost with Beds"], 11)), supplyRoomRent: value(row, index(["Room rent", "Room Rent"], 12)), supplyAdvance: value(row, index(["Advance"], 13)), supplyEb: value(row, index(["EB"], 14)), supplyDrainage: value(row, index(["Drainage"], 15)), supplyNearbyFacilities: value(row, index(["Near By facilities", "Nearby Facilities"], 16)) }]
    })
  })
}

async function attachLiveInventory(rows: DemandSupplyMatch[]) {
  try {
    const inventory = enabledMatches(await readLiveSupplyInventory())
    return inventory.length ? [...rows.filter((row) => row.dataIssueKind !== "supply" && !row.inventoryOnly), ...inventory] : rows
  } catch (error) {
    console.warn("Live supply inventory unavailable; retaining persisted supply summary.", error)
    return rows
  }
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
  const ranges = SOURCES.flatMap((source) => [`'${source.demandTab}'!A1:U1000`, ...(source.supplyTab ? [`'${source.supplyTab}'!A1:Y1000`] : [])])
  const tables = await readRanges(ranges)
  const output: DemandSupplyMatch[] = []
  let tableIndex = 0

  for (const source of SOURCES) {
    const demandTable = tables[tableIndex++] ?? []
    const supplyTable = source.supplyTab ? tables[tableIndex++] ?? [] : []
    const demandHeaders = demandTable[0] ?? []
    const supplyHeaders = supplyTable[0] ?? []
    const demandCoordinateIndex = columnIndex(demandHeaders, ["Google Location", "Lat & Long", "Latitude Longitude"], -1)
    const demandRecords = demandTable.slice(1).map((row) => ({ company: value(row, columnIndex(demandHeaders, ["Company Name", "Enterprise Name", "Client Name"], 0)), status: value(row, columnIndex(demandHeaders, ["Current Status", "Demand Status", "Status"], 17)), location: value(row, columnIndex(demandHeaders, ["Company Location", "Demand Location", "Location"], 4)), salesPerson: value(row, columnIndex(demandHeaders, ["Sales Person", "Sales Persona", "Sales Owner", "Lead Owner", "JCO"], -1)), coordinate: demandCoordinateIndex >= 0 ? parseCoordinate(row[demandCoordinateIndex]) : null })).filter((row) => row.company)
    if (!source.supplyTab || !demandRecords.some((row) => row.coordinate)) {
      const issues = [!source.supplyTab ? `${source.theatre}-Properties supply tab not available` : "", !demandRecords.some((row) => row.coordinate) ? "Enterprise coordinates not available" : ""].filter(Boolean)
      demandRecords.forEach((row) => output.push({ theatre: source.theatre, company: row.company, demandStatus: row.status || "Not updated", demandLocation: row.location || "Location not recorded", property: "Matching pending", propertyOwner: "", hunter: "", salesPerson: row.salesPerson, distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} motor-scooter minutes`, dataIssue: issues.join(" · "), dataIssueKind: "demand" }))
      continue
    }
    const demands = demandRecords.filter((row): row is typeof row & { coordinate: { lat: number; lng: number } } => Boolean(row.coordinate))
    const supplyColumn = (names: string[], fallback = -1) => columnIndex(supplyHeaders, names, fallback)
    const allSupplies = supplyTable.slice(1).map((row, index) => {
      const sourceRow = index + 2
      const property = value(row, supplyColumn(["Property Location", "Property Name", "Location", "Supply Location"], 1))
      const coordinate = parseCoordinate(row[supplyColumn(["Google Location", "Lat & Long", "Latitude Longitude"], 2)])
      const hasSourceData = row.some((cell) => String(cell ?? "").trim())
      return {
        supplyId: `${normalize(source.theatre)}:row-${sourceRow}`,
        property: property || `Property name pending (row ${sourceRow})`, propertyNameMissing: !property, coordinate,
        owner: value(row, supplyColumn(["Owner Name", "Property Owner", "Owner"], 3)),
        hunter: value(row, supplyColumn(["Hunted By", "Hunting Person", "Property Hunter", "Property Hunting Person"], -1)),
        supplyDate: value(row, supplyColumn(["Date"], 0)), supplyContact: value(row, supplyColumn(["Contact", "Contact Number"], 4)),
        supplyRoomType: value(row, supplyColumn(["Room Type", "Room Tye"], 5)), supplySize: value(row, supplyColumn(["Size, ft", "Size"], 6)),
        supplyTotalRooms: value(row, supplyColumn(["Total Rooms"], 7)), supplyCapacityWithoutBunk: value(row, supplyColumn(["Without Bunk beds Capacity"], 8)),
        supplyCostWithoutBeds: value(row, supplyColumn(["Cost (W/o Beds)", "Cost Without Beds"], 9)), supplyBunkCapacity: value(row, supplyColumn(["Bunk Bed Capacity"], 10)),
        supplyCostWithBeds: value(row, supplyColumn(["Cost with Beds"], 11)), supplyRoomRent: value(row, supplyColumn(["Room rent", "Room Rent"], 12)),
        supplyAdvance: value(row, supplyColumn(["Advance"], 13)), supplyEb: value(row, supplyColumn(["EB"], 14)),
        supplyDrainage: value(row, supplyColumn(["Drainage"], 15)), supplyNearbyFacilities: value(row, supplyColumn(["Near By facilities", "Nearby Facilities"], 16)),
        hasSourceData,
      }
    }).filter((row) => row.hasSourceData)
    const supplies = allSupplies.filter((row): row is typeof row & { coordinate: { lat: number; lng: number } } => Boolean(row.coordinate) && !row.propertyNameMissing)
    const supplyFields = (row: typeof allSupplies[number]) => ({ supplyId: row.supplyId, supplyDate: row.supplyDate, supplyContact: row.supplyContact, supplyRoomType: row.supplyRoomType, supplySize: row.supplySize, supplyTotalRooms: row.supplyTotalRooms, supplyCapacityWithoutBunk: row.supplyCapacityWithoutBunk, supplyCostWithoutBeds: row.supplyCostWithoutBeds, supplyBunkCapacity: row.supplyBunkCapacity, supplyCostWithBeds: row.supplyCostWithBeds, supplyRoomRent: row.supplyRoomRent, supplyAdvance: row.supplyAdvance, supplyEb: row.supplyEb, supplyDrainage: row.supplyDrainage, supplyNearbyFacilities: row.supplyNearbyFacilities })
    if (!supplies.length) {
      output.push({ theatre: source.theatre, company: "Data not available", demandStatus: "Matching cannot be calculated", demandLocation: "Coordinates available", property: "Data not available", propertyOwner: "", hunter: "", salesPerson: "", distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} motor-scooter minutes`, dataIssue: "Supply property coordinates not available", dataIssueKind: "theatre" })
      continue
    }
    demandRecords.filter((row) => !row.coordinate).forEach((row) => output.push({ theatre: source.theatre, company: row.company, demandStatus: row.status || "Not updated", demandLocation: row.location || "Location not recorded", property: "Matching pending", propertyOwner: "", hunter: "", salesPerson: row.salesPerson, distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: "Coordinates required", dataIssue: `Demand coordinates not available for ${row.company}`, dataIssueKind: "demand" }))
    allSupplies.filter((row) => !row.coordinate || row.propertyNameMissing).forEach((row) => output.push({ theatre: source.theatre, company: "Supply data pending", demandStatus: "Matching cannot be calculated", demandLocation: row.coordinate ? "Coordinates available" : "Coordinates unavailable", property: row.property, propertyOwner: row.owner, hunter: row.hunter, salesPerson: "", distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: row.propertyNameMissing ? "Property name required" : "Coordinates required", dataIssue: row.propertyNameMissing ? `Property/location name is blank in source row ${row.supplyId.split("-").pop()}` : `Property coordinates not available for ${row.property}`, dataIssueKind: "supply", ...supplyFields(row) }))

    let matrix: RouteMatrixElement[]
    try {
      matrix = await bikeRouteMatrix(demands.map((row) => row.coordinate!), supplies.map((row) => row.coordinate!))
    } catch (error) {
      const stored = await readStoredMatches()
      if (stored.length) {
        console.warn("Live motor-scooter router unavailable; serving the last verified persisted match matrix.", error)
        const liveInventory = allSupplies.map((row) => ({ theatre: source.theatre, company: "Supply inventory", demandStatus: "Not applicable", demandLocation: row.coordinate ? "Coordinates available" : "Coordinates unavailable", property: row.property, propertyOwner: row.owner, hunter: row.hunter, salesPerson: "", distanceKm: 0, bikeDistanceKm: 0, bikeMinutes: 0, eligible: false, rank: null, rule: row.propertyNameMissing ? "Property name required" : row.coordinate ? "Live supply inventory" : "Coordinates required", dataIssue: row.propertyNameMissing ? `Property/location name is blank in source row ${row.supplyId.split("-").pop()}` : row.coordinate ? undefined : `Property coordinates not available for ${row.property}`, dataIssueKind: "supply" as const, inventoryOnly: true, propertyLat: row.coordinate?.lat, propertyLng: row.coordinate?.lng, ...supplyFields(row) }))
        return [...stored.filter((row) => row.dataIssueKind !== "supply"), ...liveInventory]
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
          property: candidate.supply.property, propertyOwner: candidate.supply.owner, hunter: candidate.supply.hunter, salesPerson: demand.salesPerson,
          distanceKm: Number(candidate.bikeDistanceKm.toFixed(2)), bikeDistanceKm: Number(candidate.bikeDistanceKm.toFixed(2)), bikeMinutes: Number(candidate.bikeMinutes.toFixed(1)),
          eligible: candidate.eligible, rank: candidate.eligible ? eligibleRank : null,
          rule: source.maxMinutes === undefined ? `Within ${source.maxKm} km` : `Within ${source.maxKm} km and ${source.maxMinutes} motor-scooter minutes`,
          demandLat: demand.coordinate.lat, demandLng: demand.coordinate.lng,
          propertyLat: candidate.supply.coordinate!.lat, propertyLng: candidate.supply.coordinate!.lng,
          ...supplyFields(candidate.supply),
        })
      }
    }
  }
  return output
}

export async function loadEnterpriseDemandSupplyMatches(): Promise<DemandSupplyMatch[]> {
  try {
    const calculated = enabledMatches(await calculateEnterpriseDemandSupplyMatches())
    if (calculated.length) {
      const stored = enabledMatches(await readStoredMatches())
      const storedByPair = new Map(stored.map((row) => [`${normalize(row.theatre)}:${normalize(row.company)}:${normalize(row.property)}`, row]))
      const merged = calculated.map((row) => {
        const previous = storedByPair.get(`${normalize(row.theatre)}:${normalize(row.company)}:${normalize(row.property)}`)
        if (!previous) return row
        return { ...row, verifiedProperty: previous.verifiedProperty, verifiedDistanceKm: previous.verifiedDistanceKm, verifiedBikeMinutes: previous.verifiedBikeMinutes, verifiedBy: previous.verifiedBy, verificationStatus: previous.verificationStatus }
      })
      lastVerifiedMatches = merged
      return merged
    }
    const stored = enabledMatches(await readStoredMatches())
    if (stored.length) {
      const current = await attachLiveInventory(stored)
      lastVerifiedMatches = current
      return current
    }
    return enabledMatches(lastVerifiedMatches)
  } catch (error) {
    const stored = enabledMatches(await readStoredMatches())
    if (stored.length) {
      console.warn("Live Enterprise matching inputs unavailable; serving the last verified persisted match matrix.", error)
      const current = await attachLiveInventory(stored)
      lastVerifiedMatches = current
      return current
    }
    if (lastVerifiedMatches.length) {
      console.warn("Live and persisted Enterprise matching inputs unavailable; serving the last successful in-process match matrix.", error)
      return enabledMatches(lastVerifiedMatches)
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
    const duplicateRange = `'${source.supplyTab}'!Y1:Y1000`
    const duplicateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(duplicateRange)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
    if (duplicateResponse.ok) {
      const duplicateJson = await duplicateResponse.json() as { values?: string[][] }
      if (normalize(duplicateJson.values?.[0]?.[0]) === "matching rule") {
        const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(duplicateRange)}:clear`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}", cache: "no-store" })
        if (!clearResponse.ok) throw new Error(`Unable to clear duplicate ${source.supplyTab} match column: ${clearResponse.status} ${await clearResponse.text()}`)
      }
    }
    const hunterHeaderRange = `'${source.supplyTab}'!Y1`
    const hunterHeaderResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(hunterHeaderRange)}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ range: hunterHeaderRange, majorDimension: "ROWS", values: [["Property Hunter"]] }), cache: "no-store" })
    if (!hunterHeaderResponse.ok) throw new Error(`Unable to prepare ${source.supplyTab} property hunter column: ${hunterHeaderResponse.status} ${await hunterHeaderResponse.text()}`)
    changedRows += values.length
  }
  const metadataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}?fields=sheets.properties(sheetId,title,gridProperties(columnCount))`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!metadataResponse.ok) throw new Error(`Unable to inspect persisted match tab: ${metadataResponse.status} ${await metadataResponse.text()}`)
  const metadata = await metadataResponse.json() as { sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { columnCount?: number } } }[] }
  const matchSheet = (metadata.sheets ?? []).find((sheet) => sheet.properties?.title === MATCH_RESULTS_TAB)
  if (!matchSheet) {
    const createResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: MATCH_RESULTS_TAB, gridProperties: { rowCount: 5000, columnCount: 22, frozenRowCount: 1 } } } }] }), cache: "no-store" })
    if (!createResponse.ok) throw new Error(`Unable to create persisted match tab: ${createResponse.status} ${await createResponse.text()}`)
  } else if ((matchSheet.properties?.gridProperties?.columnCount ?? 0) < 22) {
    const appendResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests: [{ appendDimension: { sheetId: matchSheet.properties?.sheetId, dimension: "COLUMNS", length: 22 - (matchSheet.properties?.gridProperties?.columnCount ?? 0) } }] }), cache: "no-store" })
    if (!appendResponse.ok) throw new Error(`Unable to add verification columns: ${appendResponse.status} ${await appendResponse.text()}`)
  }
  const storedValues = matches.map((row) => [row.theatre, row.company, row.demandStatus, row.demandLocation, row.property, row.propertyOwner, row.hunter, row.distanceKm, row.bikeDistanceKm, row.bikeMinutes, row.eligible, row.rank ?? "", row.rule, row.demandLat ?? "", row.demandLng ?? "", row.propertyLat ?? "", row.propertyLng ?? ""])
  const storedRange = `'${MATCH_RESULTS_TAB}'!A1:Q${Math.max(2, storedValues.length + 1)}`
  const storedResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(storedRange)}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ range: storedRange, majorDimension: "ROWS", values: [["Theatre", "Enterprise Name", "Demand Status", "Demand Location", "Property", "Property Owner", "Property Hunter", "Distance KM", "Bike Route Distance KM", "Bike Travel Time Min", "Eligible", "Match Rank", "Matching Rule", "Demand Latitude", "Demand Longitude", "Property Latitude", "Property Longitude"], ...storedValues] }), cache: "no-store" })
  if (!storedResponse.ok) throw new Error(`Unable to persist match matrix: ${storedResponse.status} ${await storedResponse.text()}`)
  const verificationHeaderRange = `'${MATCH_RESULTS_TAB}'!R1:V1`
  const verificationHeaderResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_ID}/values/${encodeURIComponent(verificationHeaderRange)}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ range: verificationHeaderRange, majorDimension: "ROWS", values: [["Google Maps Verified Property", "Google Maps Distance KM", "Google Maps Bike Time Min", "Verified By", "Verification Status"]] }), cache: "no-store" })
  if (!verificationHeaderResponse.ok) throw new Error(`Unable to prepare Google Maps verification columns: ${verificationHeaderResponse.status} ${await verificationHeaderResponse.text()}`)
  return { changedRows, source: SOURCE_ID, syncedAt: new Date().toISOString() }
}
