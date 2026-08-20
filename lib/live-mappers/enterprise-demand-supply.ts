type Row = Record<string, unknown>

const value = (row: Row, ...keys: string[]) => {
  const normalized = new Map(Object.entries(row).map(([key, cell]) => [key.toLowerCase().replaceAll("_", " ").trim(), cell]))
  for (const key of keys) {
    const cell = normalized.get(key.toLowerCase().replaceAll("_", " ").trim())
    if (String(cell ?? "").trim()) return String(cell).trim()
  }
  return ""
}

const sourceId = (row: Row) => value(row, "source submission id", "demand id").toUpperCase()
const isProperty = (row: Row) => sourceId(row).startsWith("FONO-TRACKER-") && !sourceId(row).includes("MEMBER-ADDS") && value(row, "property for", "property purpose").toLowerCase() === "enterprise"
const isEnterpriseDemand = (row: Row) => sourceId(row).startsWith("UI-ENTERPRISE-DEMAND-") || value(row, "source submission id").toUpperCase().startsWith("UI-ENTERPRISE-DEMAND-")

export type EnterpriseDemandSupplyRow = {
  demandId: string
  enterpriseId: string
  company: string
  theatre: string
  demandStatus: string
  property: string
  location: string
  hunter: string
  propertyStatus: string
  matchStatus: string
}

export function buildEnterpriseDemandSupplyStatus(rows: readonly Row[]) {
  const demands = rows.filter(isEnterpriseDemand)
  const properties = rows.filter(isProperty)
  const demandById = new Map(demands.map((row) => [value(row, "demand id", "record id"), row]))
  const demandByEnterprise = new Map(demands.map((row) => [value(row, "enterprise id"), row]).filter(([key]) => key))

  const matchedPropertyIds = new Set<string>()
  const statusRows: EnterpriseDemandSupplyRow[] = properties.map((property) => {
    const linkedDemandId = value(property, "linked demand id")
    const enterpriseId = value(property, "enterprise id")
    const demand = demandById.get(linkedDemandId) ?? demandByEnterprise.get(enterpriseId)
    if (demand) matchedPropertyIds.add(value(demand, "demand id", "record id"))
    return {
      demandId: value(demand ?? property, "demand id", "record id") || linkedDemandId,
      enterpriseId: value(demand ?? property, "enterprise id"),
      company: value(demand ?? property, "enterprise name", "company name") || "Unmapped enterprise",
      theatre: value(demand ?? property, "theatre id", "theatre", "theater" ) || "Unassigned",
      demandStatus: value(demand ?? {}, "status", "certainty", "stage") || "Not linked",
      property: value(property, "plant name", "studio name") || "Property not named",
      location: value(property, "property location", "location", "plant name") || "Location not recorded",
      hunter: value(property, "hunter name", "business owner", "owner actor id") || "Unassigned",
      propertyStatus: value(property, "property status", "status", "certainty") || "Not recorded",
      matchStatus: value(property, "match status") || (demand ? "Mapped" : "Unmapped"),
    }
  })

  for (const demand of demands) {
    const demandId = value(demand, "demand id", "record id")
    if (matchedPropertyIds.has(demandId)) continue
    statusRows.push({
      demandId,
      enterpriseId: value(demand, "enterprise id"),
      company: value(demand, "enterprise name", "company name") || "Enterprise not named",
      theatre: value(demand, "theatre id", "theatre", "theater") || "Unassigned",
      demandStatus: value(demand, "status", "certainty", "stage") || "Open",
      property: "No property linked",
      location: "—",
      hunter: "Unassigned",
      propertyStatus: "Not started",
      matchStatus: "Unmapped",
    })
  }

  const performanceMap = new Map<string, { theatre: string; hunter: string; hunted: number; mapped: number; contracted: number }>()
  for (const row of statusRows.filter((row) => row.property !== "No property linked")) {
    const key = `${row.theatre}\u0000${row.hunter}`
    const current = performanceMap.get(key) ?? { theatre: row.theatre, hunter: row.hunter, hunted: 0, mapped: 0, contracted: 0 }
    current.hunted += 1
    if (!/unmapped|not linked/i.test(row.matchStatus)) current.mapped += 1
    if (/contracted|onboarded|approved|selected/i.test(`${row.propertyStatus} ${row.matchStatus}`)) current.contracted += 1
    performanceMap.set(key, current)
  }

  return {
    rows: statusRows.sort((a, b) => a.theatre.localeCompare(b.theatre) || a.company.localeCompare(b.company) || a.property.localeCompare(b.property)),
    performance: [...performanceMap.values()].sort((a, b) => a.theatre.localeCompare(b.theatre) || b.mapped - a.mapped || a.hunter.localeCompare(b.hunter)),
  }
}
