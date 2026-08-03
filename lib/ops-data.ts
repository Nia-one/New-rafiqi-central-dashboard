import source from "@/data/ops-data.json"
import { ACTION_LOG_BLOCK_START, ACTION_LOG_REFERENCE_AT, actorStalenessHours, closuresBetween, seedActionLog, type ActionLogEntry } from "@/lib/action-log"

export type Lane = "Śram Park" | "FONO" | "Demand" | "Essentials" | "Economics"
export type SpineMetric = (typeof source.spine)[number]
export type Constraint = (typeof source.constraints)[number]

export const opsData = source
export const APPROVED_SPINE_LABELS = ["Demand contracted", "Capacity live", "Members active", "Attach", "ARPU", "CM"] as const

export function formatInr(value: number, compact = false) {
  if (compact) {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${Math.round(value / 1000)}k`
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
}

export function formatSpineValue(metric: SpineMetric) {
  if (metric.id === "cm") return formatInr(metric.actual, true)
  if (metric.unit === "INR") return formatInr(metric.actual)
  if (metric.unit === "percent") return `${metric.actual}%`
  return metric.actual.toLocaleString("en-IN")
}

export function formatBlockChange(change: { value: number; unit: string }) {
  if (change.unit === "INR") return formatInr(change.value, true)
  if (change.unit === "percentage points") return `${change.value}pp`
  return change.value.toLocaleString("en-IN")
}

export function metricVariance(metric: SpineMetric) { return metric.actual - metric.plan }
export function metricPace(metric: SpineMetric) { return Math.round((metric.actual / metric.plan) * 100) }
export function rankedConstraints() { return [...opsData.constraints].sort((a, b) => b.impact - a.impact) }
export function largestLeak() { return rankedConstraints()[0] }

export function trajectory() {
  const { day, daysInMonth } = opsData.meta
  const current = opsData.history.at(-1)!.actual
  const target = opsData.monthlyCMTarget
  const projection = opsData.monthEndProjection
  const remaining = opsData.meta.daysLeft
  const askRate = Math.round((target - current) / remaining)
  const targetAt = (pointDay: number) => Math.round((target / daysInMonth) * pointDay)
  const projectionAt = (pointDay: number) => Math.round(current + ((projection - current) / remaining) * (pointDay - day))
  const actualPoints = opsData.history.map((point) => ({
    ...point,
    target: targetAt(point.day),
    projection: point.day === day ? current : null as number | null,
    actual: point.actual as number | null,
  }))
  const extension = Array.from({ length: remaining }, (_, index) => {
    const pointDay = day + index + 1
    return { day: pointDay, actual: null, target: targetAt(pointDay), projection: projectionAt(pointDay) }
  })
  return { current, target, projection, askRate, askRateMultiple: opsData.askRateMultiple, points: [...actualPoints, ...extension] }
}

export function operatingLede() {
  const leak = largestLeak()
  const gap = opsData.monthlyCMTarget - trajectory().current
  return `${formatInr(gap, true)} remains to the full-month CM (contribution margin) target. ${opsData.meta.daysLeft} days remain. ${opsData.meta.theatresBehind} theatres are behind. ${leak.title} is the main problem.`
}

export function blockNarrative(entries: ActionLogEntry[] = seedActionLog, now = ACTION_LOG_REFERENCE_AT) {
  const block = opsData.previousBlock
  const closures = closuresBetween(entries, ACTION_LOG_BLOCK_START, now)
  const staleHours = actorStalenessHours("jco-c", entries, now) ?? 0
  return `Since 12:00: +${closures} closures, stockouts cleared at ${block.stockoutsClearedStudios} Studios, ${block.stalledTheatre} still stalled, ${block.staleOwner} now stale ${staleHours}h.`
}

export function blockChanges() {
  const current = Object.fromEntries(opsData.spine.map((metric) => [metric.id, metric.actual]))
  return [
    { label: "CM landed", value: current.cm - opsData.previousBlock.cm, unit: "INR" },
    { label: "Demand contracted", value: current.contracted - opsData.previousBlock.contracted, unit: "members" },
    { label: "Members active", value: current.active - opsData.previousBlock.membersActive, unit: "members" },
    { label: "Attach", value: current.attach - opsData.previousBlock.attach, unit: "percentage points" },
  ].filter((change) => Math.abs(change.value) > 0)
}

export function laneHeadline(lane: string) {
  if (lane === "People") return "Five people need attention. Three are Stalled and two are Stale."
  const constraint = rankedConstraints().find((item) => item.lane === lane)
  const metric = opsData.spine.find((item) => item.lane === lane)
  if (!metric) return "Every number needs one meaning, level, source and owner."
  const variance = metricVariance(metric)
  const varianceText = metric.unit === "percent" ? `${variance >= 0 ? "+" : ""}${variance} percentage points` : `${variance >= 0 ? "+" : ""}${variance.toLocaleString("en-IN")} ${metric.unit}`
  const core = `${metric.label} is at ${metricPace(metric)}% of plan (${varianceText}).`
  return constraint ? `${core} ${constraint.title} is the highest-value issue on this page.` : core
}

export function assertOperatingModel() {
  const run = trajectory()
  const labels = opsData.spine.map((metric) => metric.label)
  if (labels.length !== 6 || labels.some((label, index) => label !== APPROVED_SPINE_LABELS[index])) throw new Error("Operating spine labels or order changed")
  if (run.points.some((point, index) => index > 0 && point.target < run.points[index - 1].target)) throw new Error("CM target path must be monotonic")
  if (run.points.at(-1)?.target !== opsData.monthlyCMTarget) throw new Error("CM target endpoint must equal monthly target")
  const projectionStart = run.points.find((point) => point.day === opsData.meta.day)?.projection
  if (projectionStart !== run.current) throw new Error("CM projection must start at latest actual")
  if (run.points.some((point, index) => index > opsData.meta.day - 1 && point.projection !== null && run.points[index - 1].projection !== null && point.projection < run.points[index - 1].projection!)) throw new Error("CM projection must be monotonic")
}

assertOperatingModel()
