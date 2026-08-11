import { buildLivingScreenData } from "@/lib/live-mappers/living-screen"
import { buildEssentialsReport } from "@/lib/live-mappers/essentials-report"
import { ENTERPRISE_PIPELINE_STAGES, enterprisePipelineStage } from "@/lib/enterprise-pipeline-stage"

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
const stage = (row: Row) => enterprisePipelineStage(raw(row, "stage", "certainty"), raw(row, "status"))
export function buildBusinessReportData(ops: any) {
  const living = buildLivingScreenData(ops)
  // Prefer the explicit Enterprise Demand input tab. Retain the governed bot
  // lane only as a backwards-compatible fallback while older payloads refresh.
  const demandRows: Row[] = ops?.enterpriseDemand ?? []
  const sheetDemandById = new Map<string, Row>()
  const fallbackDemandById = new Map<string, Row>()
  const supplyById = new Map<string, Row>()
  demandRows.forEach((row, index) => {
    const id = String(raw(row, "demand id") ?? `row-${index}`).trim()
    const sourceId = String(raw(row, "source submission id") ?? id).toUpperCase()
    if (sourceId.startsWith("UI-ENTERPRISE-DEMAND-")) sheetDemandById.set(id.toUpperCase(), row)
    else if (sourceId.startsWith("UI-ENTERPRISE-SUPPLY-") || id.toUpperCase().startsWith("MEMBER-ADDS-UI-ENTERPRISE-SUPPLY-")) supplyById.set(id.toUpperCase(), row)
    else if (id.toUpperCase().startsWith("SP-BOT-")) fallbackDemandById.set(id.toUpperCase(), row)
  })
  const enterpriseRows = [...(sheetDemandById.size ? sheetDemandById : fallbackDemandById).values()]
  const enterpriseSupplyRows = [...supplyById.values()]
  // Business Report uses the same active-pipeline population as the Enterprise
  // workspace. Drop, blank and invalid stages belong to Exceptions and must not
  // inflate the headline or Theatre totals while being absent from the funnel.
  const activeEnterpriseRows = enterpriseRows.filter((row) => stage(row) !== null)
  const activeEnterpriseSupplyRows = enterpriseSupplyRows.filter((row) => stage(row) !== null)
  const essentials: Row[] = ops?.essentials ?? []
  const work: Row[] = ops?.work ?? []
  const finance: Row[] = ops?.finance ?? []
  const actions: Row[] = ops?.actionLog ?? []
  const livingRows: Row[] = ops?.living ?? []

  const occupancyByTheatre = living.existingByTheatre.map((row) => ({
    theatre: theatre(row[0]),
    studios: Number(row[1]) || 0,
    contracted: Number(row[2]) || 0,
    occupied: Number(row[3]) || 0,
    vacant: Number(row[4]) || 0,
    occupancyPct: Number(String(row[5]).replace("%", "")) || 0,
  })).sort((a, b) => b.occupancyPct - a.occupancyPct)

  const stageCounts = (rows: readonly Row[]) => Object.fromEntries(ENTERPRISE_PIPELINE_STAGES.map((name) => [name, rows.filter((row) => stage(row) === name).length])) as Record<(typeof ENTERPRISE_PIPELINE_STAGES)[number], number>
  const enterpriseStages = stageCounts(activeEnterpriseRows)
  const enterpriseSupplyStages = stageCounts(activeEnterpriseSupplyRows)
  // Reuse Living's canonical, de-duplicated FONO demand pipeline so every
  // source page and the board report refresh from one calculation.
  const fonoStages = living.fonoPipeline.report.totals
  const enterpriseByTheatre = [...new Set(activeEnterpriseRows.map((row) => theatre(raw(row, "theatre id", "theatre"))))].map((name) => {
    const rows = activeEnterpriseRows.filter((row) => theatre(raw(row, "theatre id", "theatre")) === name)
    return { theatre: name, ...stageCounts(rows), records: rows.length }
  }).sort((a, b) => b.records - a.records)

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
  const componentInputs = actions.filter((row) => String(raw(row, "action id") ?? "").toUpperCase().startsWith("OPS-RPT-CM-COMP-"))
    .map((row) => {
      const type = /pipeline/i.test(String(raw(row, "expected metric") ?? "")) ? "Pipeline" : "Actual"
      const notes = String(raw(row, "notes") ?? "")
      return { component: String(raw(row, "operating objective") ?? "Unassigned"), type, cmInr: number(row, "baseline value", "expected financial impact inr"), revenueInr: number(row, "target value"), volume: Number(notes.match(/(?:^|\|)volume=([0-9.-]+)/i)?.[1] || 0) }
    })
  const livingInput = componentInputs.find((row) => row.type === "Actual" && normalized(row.component) === "living")
  const manualActuals = componentInputs.filter((row) => row.type === "Actual" && normalized(row.component) !== "living")
  const manualPipeline = componentInputs.filter((row) => row.type === "Pipeline")
  const governedLivingCm = livingInput?.cmInr || explicitFinanceMargin
  const actualContribution = componentInputs.length ? governedLivingCm + manualActuals.reduce((total, row) => total + row.cmInr, 0) : explicitWorkMargin + explicitFinanceMargin + essentialsMargin
  const financeLivingRevenue = sum(finance, "total billed inr", "projected revenue inr")
  const governedLivingRevenue = livingInput?.revenueInr || financeLivingRevenue
  const projectedRevenue = componentInputs.length ? governedLivingRevenue + [...manualActuals, ...manualPipeline].reduce((total, row) => total + row.revenueInr, 0) : financeLivingRevenue + sum(work, "work billed inr", "work revenue") + essentialsRevenue
  const pipelineContribution = manualPipeline.reduce((total, row) => total + row.cmInr, 0)
  const contributionComponents = [...manualActuals, { component: "Living", type: "Actual", cmInr: governedLivingCm, revenueInr: governedLivingRevenue, volume: 0 }, ...manualPipeline]

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
      living: governedLivingCm,
      livingByTheatre: livingCmTheatres,
      essentials: essentialsMargin,
      pipeline: pipelineContribution,
      pipelineRecorded: manualPipeline.length > 0,
      components: contributionComponents,
    },
    fono: { records: living.fonoPipeline.report.byTheatre.length, stages: fonoStages, byTheatre: living.fonoPipeline.report.byTheatre },
    enterprise: { records: activeEnterpriseRows.length, sourceRecords: enterpriseRows.length, excludedRecords: enterpriseRows.length - activeEnterpriseRows.length, supplyRecords: activeEnterpriseSupplyRows.length, stages: enterpriseStages, supplyStages: enterpriseSupplyStages, byTheatre: enterpriseByTheatre },
    essentials: essentialsReport,
  }
}

export type BusinessReportData = ReturnType<typeof buildBusinessReportData>
