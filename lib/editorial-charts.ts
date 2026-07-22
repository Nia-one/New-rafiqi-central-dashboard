import { opsData } from "@/lib/ops-data"

export const EDITORIAL_CHART_COPY = {
  living: { title: "Demand is the largest gap to plan.", reads: "Compare actual results with the plan for three Living measures. The largest gap shows the main problem.", takeaway: "Demand is 188 below plan. Capacity is 30 below plan." },
  essentials: { title: "Attach rose by 2 percentage points this block. It is still 4 percentage points below plan.", reads: "Compare Attach in the previous block, current block, and plan. The line shows whether more Members are buying.", takeaway: "Previous block 39%. Current 41%. Plan 45%." },
  cmBridge: { title: "Utilities reduce CM by ₹2.5L between CM1 and CM2.", reads: "This chart starts with CM1 and subtracts utilities to show CM2.", takeaway: "CM1 ₹16.1L less Utilities ₹2.5L gives CM2 ₹13.6L." },
  arpu: { title: "Rajputana has the highest ARPU. Wellington is ₹54 below the network average.", reads: "Compare each Theatre's ARPU with the network average. The distance shows how far each Theatre is above or below it.", takeaway: "Network average ₹1,742 is a reference, not a Theatre." },
  people: { title: "5 of 10 named people need attention.", reads: "This chart shows who is current, stalled, or stale. Stalled and stale people need attention.", takeaway: "Vikram Singh is the stalled RM shown here." },
} as const

export const livingComparison = [
  { label: "Demand contracted", actual: 862, plan: 1050, gap: 188 },
  { label: "Capacity live", actual: 920, plan: 950, gap: 30 },
  { label: "Members active", actual: 2314, plan: 2500, gap: 186 },
] as const

const attach = opsData.spine.find((metric) => metric.id === "attach")!
export const attachSlope = [
  { label: "Previous block", value: opsData.previousBlock.attach },
  { label: "Current", value: attach.actual },
  { label: "Plan", value: attach.plan },
]

export const cmBridge = [
  { label: "CM1", value: 1610000 },
  { label: "Utilities", value: -250000 },
  { label: "CM2", value: 1360000 },
] as const

export const studioArpu = [
  { theatre: "Rajputana", value: 1806, kind: "theatre" },
  { theatre: "Coromandel", value: 1721, kind: "theatre" },
  { theatre: "Wellington", value: 1688, kind: "theatre" },
] as const
export const networkAverage = { label: "Network average", value: 1742, kind: "reference" } as const

export const peopleInterventions = [
  { label: "Current", value: 5, percent: 50 },
  { label: "Stalled", value: 3, percent: 30 },
  { label: "Stale", value: 2, percent: 20 },
] as const

export const CHART_SOURCE_NOTE = "Sample operating data · Jul 2026"
