import { buildLivingScreenData } from "@/lib/live-mappers/living-screen"
import { buildEssentialsReport } from "@/lib/live-mappers/essentials-report"

type Row = Record<string, unknown>

const normalized = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim()
const raw = (row: Row | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const wanted = normalized(key)
    const found = Object.keys(row ?? {}).find((candidate) => normalized(candidate) === wanted)
    if (found) return row?.[found]
  }
  return undefined
}
const number = (row: Row | undefined, ...keys: string[]) => {
  const parsed = Number(String(raw(row, ...keys) ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}
const sum = (rows: readonly Row[], ...keys: string[]) => rows.reduce((total, row) => total + number(row, ...keys), 0)
const theatre = (value: unknown) => {
  const input = String(value ?? "").trim().toLowerCase()
  if (/rajputana|^(?:th-)?(?:rn|rjt)$/.test(input)) return "Rajputana"
  if (/wellington|^(?:th-)?wlg$/.test(input)) return "Wellington"
  if (/coromandel|^(?:th-)?(?:coro|crm)$/.test(input)) return "Coromandel"
  if (/deccan|^(?:th-)?dcn$/.test(input)) return "Deccan"
  return String(value ?? "").trim() || "Unassigned"
}
const stage = (row: Row) => {
  const state = `${raw(row, "status") ?? ""} ${raw(row, "certainty") ?? ""}`.toLowerCase()
  if (/drop|lost|reject|cancel|closed/.test(state)) return "Dropped"
  if (/contracted|onboard|agreement signed|\bwon\b|live/.test(state)) return "Contracted"
  if (/interest|proposal|quote/.test(state)) return "Interested"
  if (/contracting|negotiat|proposal|commercial/.test(state)) return "Contracting"
  return "Lead"
}
export function buildBusinessReportData(ops: any) {
  const living = buildLivingScreenData(ops)
  // For the current operating model Enterprise Demand mirrors the governed
  // Shram Park Bot demand lane. Do not mix in the separate offline Enterprise
  // workspace ledger; that produced two extra rows and divergent stages.
  const demandRows: Row[] = ops?.enterpriseDemand ?? []
  const enterpriseById = new Map<string, Row>()
  demandRows.forEach((row, index) => {
    const id = String(raw(row, "demand id") ?? `row-${index}`).trim()
    if (id.toUpperCase().startsWith("SP-BOT-")) enterpriseById.set(id, row)
  })
  const enterpriseRows = [...enterpriseById.values()]
  const essentials: Row[] = ops?.essentials ?? []
  const work: Row[] = ops?.work ?? []
  const finance: Row[] = ops?.finance ?? []
  const livingRows: Row[] = ops?.living ?? []

  const occupancyByTheatre = living.existingByTheatre.map((row) => ({
    theatre: theatre(row[0]),
    studios: Number(row[1]) || 0,
    contracted: Number(row[2]) || 0,
    occupied: Number(row[3]) || 0,
    vacant: Number(row[4]) || 0,
    occupancyPct: Number(String(row[5]).replace("%", "")) || 0,
  })).sort((a, b) => b.occupancyPct - a.occupancyPct)

  const stageNames = ["Lead", "Interested", "Contracting", "Contracted", "Dropped"] as const
  const stageCounts = (rows: readonly Row[]) => Object.fromEntries(stageNames.map((name) => [name, rows.filter((row) => stage(row) === name).length])) as Record<(typeof stageNames)[number], number>
  const enterpriseStages = stageCounts(enterpriseRows)
  // Reuse Living's canonical, de-duplicated FONO demand pipeline so every
  // source page and the board report refresh from one calculation.
  const fonoStages = living.fonoPipeline.report.totals
  const enterpriseByTheatre = [...new Set(enterpriseRows.map((row) => theatre(raw(row, "theatre id", "theatre"))))].map((name) => ({ theatre: name, records: enterpriseRows.filter((row) => theatre(raw(row, "theatre id", "theatre")) === name).length })).sort((a, b) => b.records - a.records)

  const essentialsReport = buildEssentialsReport(essentials)
  const essentialsRevenue = essentialsReport.revenue
  const essentialsMargin = essentialsReport.margin
  const explicitWorkMargin = sum(work, "contribution margin inr", "nia margin inr", "work cm inr")
  const livingCm = (row: Row) => number(row, "living cm2 inr", "living cm inr")
  const studioTheatre = new Map(livingRows.map((row) => [String(raw(row, "studio id") ?? ""), raw(row, "theatre id", "theatre")]))
  const financeTheatre = (row: Row) => theatre(raw(row, "theatre id", "theatre", "theatre name") ?? studioTheatre.get(String(raw(row, "studio id") ?? "")))
  const livingCmTheatres = [...new Set(finance.map(financeTheatre).filter((name) => name !== "Unassigned"))]
    .map((name) => ({ theatre: name, cmInr: finance.filter((row) => financeTheatre(row) === name).reduce((total, row) => total + livingCm(row), 0) }))
    .filter((row) => row.cmInr !== 0)
    .sort((a, b) => b.cmInr - a.cmInr)
  const explicitFinanceMargin = livingCmTheatres.reduce((total, row) => total + row.cmInr, 0)
  const actualContribution = explicitWorkMargin + explicitFinanceMargin + essentialsMargin
  const projectedRevenue = sum(finance, "total billed inr", "projected revenue inr") + sum(work, "work billed inr", "work revenue") + essentialsRevenue

  return {
    asOf: String(ops?.meta?.updatedAt || ops?.fetchedAt || "Not recorded"),
    occupancy: {
      contracted: living.existingContracted,
      occupied: living.existingOccupied,
      vacant: living.existingVacant,
      percent: living.existingOccupancyPercent,
      byTheatre: occupancyByTheatre,
    },
    projectedRevenue,
    contribution: {
      actual: actualContribution,
      work: explicitWorkMargin,
      living: explicitFinanceMargin,
      livingByTheatre: livingCmTheatres,
      essentials: essentialsMargin,
      pipeline: 0,
      pipelineRecorded: false,
    },
    fono: { records: living.fonoPipeline.report.byTheatre.length, stages: fonoStages, byTheatre: living.fonoPipeline.report.byTheatre },
    enterprise: { records: enterpriseRows.length, stages: enterpriseStages, byTheatre: enterpriseByTheatre },
    essentials: essentialsReport,
  }
}

export type BusinessReportData = ReturnType<typeof buildBusinessReportData>
