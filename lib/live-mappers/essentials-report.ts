type Row = Record<string, unknown>

const normalizeKey = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim()
const raw = (row: Row | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const wanted = normalizeKey(key)
    const found = Object.keys(row ?? {}).find((candidate) => normalizeKey(candidate) === wanted)
    if (found) return row?.[found]
  }
  return undefined
}
const number = (row: Row | undefined, ...keys: string[]) => {
  const parsed = Number(String(raw(row, ...keys) ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}
const theatreName = (value: unknown) => {
  const input = String(value ?? "").trim().toLowerCase()
  if (/rajputana|^(?:th-)?(?:rn|rjt)$/.test(input)) return "Rajputana"
  if (/wellington|^(?:th-)?wlg$/.test(input)) return "Wellington"
  if (/coromandel|^(?:th-)?(?:coro|cor|crm)$/.test(input)) return "Coromandel"
  if (/deccan|^(?:th-)?dcn$/.test(input)) return "Deccan"
  return String(value ?? "").trim() || "Unassigned"
}

export function buildEssentialsReport(rows: readonly Row[]) {
  const grouped = new Map<string, { theatre: string; eligibleMembers: number; buyingMembers: number; revenue: number; studioRevenue: number; margin: number; savings: number; curryUniqueMembers: number; curryBuyingValue: number; internetEquipmentUniqueMembers: number; internetEquipmentBuyingValue: number }>()
  for (const row of rows) {
    const name = theatreName(raw(row, "theatre id", "theatre", "theatre name"))
    const current = grouped.get(name) ?? { theatre: name, eligibleMembers: 0, buyingMembers: 0, revenue: 0, studioRevenue: 0, margin: 0, savings: 0, curryUniqueMembers: 0, curryBuyingValue: 0, internetEquipmentUniqueMembers: 0, internetEquipmentBuyingValue: 0 }
    current.eligibleMembers += number(row, "eligible members")
    current.buyingMembers += number(row, "buying members") + number(row, "curry unique members") + number(row, "internet equipment unique members")
    current.revenue += number(row, "essentials billed inr") + number(row, "curry buying value inr") + number(row, "internet equipment buying value inr")
    current.studioRevenue += number(row, "studio revenue inr")
    current.margin += number(row, "nia margin inr")
    current.savings += number(row, "member savings inr")
    current.curryUniqueMembers += number(row, "curry unique members")
    current.curryBuyingValue += number(row, "curry buying value inr")
    current.internetEquipmentUniqueMembers += number(row, "internet equipment unique members")
    current.internetEquipmentBuyingValue += number(row, "internet equipment buying value inr")
    grouped.set(name, current)
  }
  const byTheatre = [...grouped.values()].map((row) => ({ ...row,
    attachPct: row.eligibleMembers ? Math.round(row.buyingMembers / row.eligibleMembers * 1_000) / 10 : 0,
    attachRevenuePct: row.studioRevenue ? Math.round(row.revenue / row.studioRevenue * 10_000) / 100 : 0,
  })).sort((a, b) => b.attachPct - a.attachPct)
  const totals = byTheatre.reduce((result, row) => ({ eligibleMembers: result.eligibleMembers + row.eligibleMembers, buyingMembers: result.buyingMembers + row.buyingMembers, revenue: result.revenue + row.revenue, studioRevenue: result.studioRevenue + row.studioRevenue, margin: result.margin + row.margin, savings: result.savings + row.savings, curryUniqueMembers: result.curryUniqueMembers + row.curryUniqueMembers, curryBuyingValue: result.curryBuyingValue + row.curryBuyingValue, internetEquipmentUniqueMembers: result.internetEquipmentUniqueMembers + row.internetEquipmentUniqueMembers, internetEquipmentBuyingValue: result.internetEquipmentBuyingValue + row.internetEquipmentBuyingValue }), { eligibleMembers: 0, buyingMembers: 0, revenue: 0, studioRevenue: 0, margin: 0, savings: 0, curryUniqueMembers: 0, curryBuyingValue: 0, internetEquipmentUniqueMembers: 0, internetEquipmentBuyingValue: 0 })
  return { ...totals,
    attachPct: totals.eligibleMembers ? Math.round(totals.buyingMembers / totals.eligibleMembers * 1_000) / 10 : 0,
    attachRevenuePct: totals.studioRevenue ? Math.round(totals.revenue / totals.studioRevenue * 10_000) / 100 : 0,
    byTheatre,
  }
}
