type SheetRow = Record<string, unknown>

const amountFields = ["living billed inr", "living collected inr", "work billed inr", "work collected inr", "essentials billed inr", "essentials collected inr", "total billed inr", "total collected inr", "current due inr", "overdue inr", "opex mtd inr", "opex forecast inr", "opex cap inr", "cash balance inr", "cash target inr", "cm target inr", "cm1 inr", "cm2 inr"] as const
const timestampFields = ["updated at", "reported at", "business date"] as const

const text = (row: SheetRow, key: string) => String(row[key] ?? "").trim()

const timestamp = (row: SheetRow) => timestampFields.map((key) => text(row, key)).find((value) => value && Number.isFinite(Date.parse(value))) || ""

export function optionalSheetNumber(value: unknown): number | null {
  if (value === undefined || value === null || !String(value).trim()) return null
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

export function latestFinanceSnapshots(rows: readonly SheetRow[]): readonly SheetRow[] {
  const latest = new Map<string, SheetRow>()
  for (const row of rows) {
    const key = text(row, "studio id") || text(row, "theatre id") || text(row, "finance daily id") || `finance-${latest.size}`
    const existing = latest.get(key)
    if (!existing || Date.parse(timestamp(row) || "1970-01-01") > Date.parse(timestamp(existing) || "1970-01-01")) latest.set(key, row)
  }
  return [...latest.values()]
}

export function aggregateLatestFinanceSnapshots(rows: readonly SheetRow[]): SheetRow | undefined {
  const snapshots = latestFinanceSnapshots(rows)
  if (!snapshots.length) return undefined
  const aggregate: SheetRow = { "updated at": snapshots.map(timestamp).filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "" }
  for (const field of amountFields) {
    const values = snapshots.map((row) => optionalSheetNumber(row[field])).filter((value): value is number => value !== null)
    if (values.length) aggregate[field] = values.reduce((sum, value) => sum + value, 0)
  }
  const cashStatuses = snapshots.map((row) => text(row, "cash guardrail status")).filter(Boolean)
  aggregate["cash guardrail status"] = cashStatuses.some((status) => /breach|at risk|fail/i.test(status)) ? "At risk" : cashStatuses.length && cashStatuses.every((status) => /protected|within control|passed|healthy/i.test(status)) ? "Protected" : cashStatuses[0] || ""
  for (const field of ["destination approved", "destination owner actor id", "decision due at"] as const) {
    aggregate[field] = snapshots.map((row) => text(row, field)).find(Boolean) || ""
  }
  return aggregate
}
