import { formatInr } from "@/lib/ops-data"
import {
  NO_DATA,
  type ActionStatus,
  type AllocationDomain,
  type AttentionBucket,
  type Confidence,
  type JoinKey,
  type Measured,
  type Mismatch,
  type MismatchInput,
  type MismatchType,
  type RankedMismatch,
  type ScoreComponents,
} from "@/lib/allocation-types"
import { mismatchInputs, supplyOptions, type SupplyOption } from "@/lib/allocation-data"
import { THEATRES } from "@/lib/dashboard-model"
import { ACTION_LOG_REFERENCE_AT, deriveQueueItemState, latestAction, seedActionLog, type ActionLogEntry } from "@/lib/action-log"

/**
 * Single source of truth for the auditable priority weights. Kept outside React
 * so the review panel and the tests read exactly the same numbers.
 */
export const SCORE_CONFIG = {
  urgencyFloor: 1,
  urgencyCap: 2,
  confidence: { High: 1, Medium: 0.8, Low: 0.6 } as Record<Confidence, number>,
  attention: { Unassigned: 1.15, Blocked: 1.1, Assigned: 1, "In progress": 0.75 } as Record<AttentionBucket, number>,
} as const

/** Śram Park eligibility: within 2km, inside the 24h sourcing SLA, and produced by the required date. */
export const SHRAM_PARK_MAX_KM = 2
export const SHRAM_PARK_SLA_HOURS = 24
/** Essentials classification thresholds in days of cover. */
export const ESSENTIALS_SAFETY_DAYS = 1
export const ESSENTIALS_DEAD_STOCK_DAYS = 4

export function isNoData<T>(value: Measured<T>): value is typeof NO_DATA {
  return value === NO_DATA
}

/* ------------------------------------------------------------------ */
/* Domain-specific match keys : never one literal key across domains.  */
/* ------------------------------------------------------------------ */

export function shramParkMatchKey(key: JoinKey) {
  return [key.theatreId, key.factoryId ?? key.demandBatchId ?? "no-batch", key.requiredByAt ?? "no-date"].join(" | ")
}
export function fonoMatchKey(key: JoinKey) {
  return [key.theatreId, key.studioId ?? "no-studio", key.dateBucket ?? "no-date"].join(" | ")
}
export function essentialsMatchKey(key: JoinKey) {
  return [key.theatreId, key.studioId ?? "no-studio", key.skuId ?? "no-sku", key.dateBucket ?? "no-date"].join(" | ")
}
export function matchKeyFor(domain: AllocationDomain, key: JoinKey) {
  if (domain === "Śram Park") return shramParkMatchKey(key)
  if (domain === "FONO") return fonoMatchKey(key)
  return essentialsMatchKey(key)
}

export type ActionLogContext = {
  actionLog?: ActionLogEntry[]
  now?: string
}

type StageMismatchOptions = ActionLogContext & {
  fallbackInput?: MismatchInput
}

/**
 * Shared entity lookup used by both the Overview queue and contextual stage diagnostics.
 * If a newly diagnosed entity has no stored row yet, a fully specified fallback is
 * materialised through the same action-template contract as every other mismatch.
 */
export function getMismatchForStage(domain: AllocationDomain, joinKey: JoinKey, options: StageMismatchOptions = {}): Mismatch | undefined {
  const canonicalKey = matchKeyFor(domain, joinKey)
  const stored = mismatchInputs.find((input) => input.domain === domain && matchKeyFor(input.domain, input.joinKey) === canonicalKey)
  const source = stored ?? options.fallbackInput
  if (!source) return undefined

  const actionLog = options.actionLog ?? seedActionLog
  const logged = latestAction(source.id, actionLog)
  const workflow = logged
    ? deriveQueueItemState(source.id, actionLog, options.now ?? ACTION_LOG_REFERENCE_AT)
    : { status: source.actionStatus, ageHours: source.ageHours }
  return toMismatch({ ...source, domain, joinKey, actionStatus: workflow.status, ageHours: workflow.ageHours })
}

/* ------------------------------------------------------------------ */
/* Domain eligibility and classification.                              */
/* ------------------------------------------------------------------ */

export function isEligibleSupply(option: SupplyOption) {
  return (
    option.distanceKm <= SHRAM_PARK_MAX_KM &&
    option.responseHours <= SHRAM_PARK_SLA_HOURS &&
    option.availableByAt <= option.requiredByAt
  )
}

/** Index eligible options by their Śram Park match key for repeated lookups. */
export function eligibleSupplyByKey(options: SupplyOption[] = supplyOptions) {
  const map = new Map<string, SupplyOption[]>()
  for (const option of options) {
    if (!isEligibleSupply(option)) continue
    const key = [option.theatre, option.factory].join(" | ")
    map.set(key, [...(map.get(key) ?? []), option])
  }
  return map
}

export function fonoBalance(demandQty: number, supplyQty: number, ageHours: number) {
  const surplus = supplyQty - demandQty
  return { surplus, shortfall: surplus < 0 ? -surplus : 0, idleDays: Math.floor(ageHours / 24) }
}

export function classifyEssentials(daysCover: number): MismatchType {
  if (daysCover < ESSENTIALS_SAFETY_DAYS) return "stockout"
  if (daysCover >= ESSENTIALS_DEAD_STOCK_DAYS) return "dead-stock"
  return "stockout"
}

/** Common economic basis : everything converts to forward CM at risk over 24h. */
export function essentialsStockoutCm(expectedUnitsLost: number, cmPerUnit: number) {
  return expectedUnitsLost * cmPerUnit
}
export function essentialsDeadStockCm(units: number, markdownPerUnit: number) {
  return units * markdownPerUnit
}

/* ------------------------------------------------------------------ */
/* Workflow status → attention bucket, and the score multipliers.      */
/* ------------------------------------------------------------------ */

export function isUnresolved(status: ActionStatus) {
  return status !== "Verified" && status !== "Dismissed"
}

export function attentionBucketFor(status: ActionStatus): AttentionBucket | null {
  switch (status) {
    case "Detected":
    case "Agreed":
      return "Unassigned"
    case "Assigned":
      return "Assigned"
    case "Resolved":
    case "Closed":
      return "In progress"
    default:
      return null
  }
}

export function urgencyMultiplier(ageHours: number, thresholdHours: number) {
  if (ageHours <= thresholdHours) return SCORE_CONFIG.urgencyFloor
  const over = (ageHours - thresholdHours) / thresholdHours
  return Math.min(SCORE_CONFIG.urgencyCap, SCORE_CONFIG.urgencyFloor + over)
}

/* ------------------------------------------------------------------ */
/* Deterministic next-action templates : no free-form text.            */
/* ------------------------------------------------------------------ */

function pluralDays(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`
}

export function buildNextAction(input: MismatchInput): { nextAction: string; actionBlocked: boolean; missingField?: string } {
  const blocked = (field: string) => ({ nextAction: `Action blocked: missing ${field}`, actionBlocked: true, missingField: field })
  switch (input.actionTemplateId) {
    case "sram-shortfall": {
      if (isNoData(input.gapQty)) return blocked("gap quantity")
      if (!input.joinKey.factoryId) return blocked("factory")
      if ((input.actionStatus === "Resolved" || input.actionStatus === "Closed" || input.actionStatus === "Verified") && input.gapQty === 0 && !isNoData(input.supplyQty)) {
        return { nextAction: `Hold ${input.supplyQty} matched Nests for ${input.joinKey.factoryId} demand through activation on ${input.deadlineAt}.`, actionBlocked: false }
      }
      return { nextAction: `Source ${input.gapQty} viable Nests within ${SHRAM_PARK_MAX_KM}km of ${input.joinKey.factoryId} by ${input.deadlineAt}.`, actionBlocked: false }
    }
    case "fono-idle": {
      if (isNoData(input.gapQty)) return blocked("gap quantity")
      return { nextAction: `Assign occupancy owner for ${input.where}; ${input.gapQty} Nests unoccupied for ${pluralDays(Math.floor(input.ageHours / 24))} since go-live.`, actionBlocked: false }
    }
    case "ess-stockout": {
      if (!input.skuLabel) return blocked("SKU")
      if ((input.actionStatus === "Resolved" || input.actionStatus === "Closed" || input.actionStatus === "Verified") && input.gapQty === 0) {
        return { nextAction: `Keep ${input.skuLabel} availability at 100% at ${input.where} through ${input.deadlineAt}.`, actionBlocked: false }
      }
      if (isNoData(input.forwardCmAtRisk24h)) return blocked("forward CM at risk")
      return { nextAction: `Repool ${input.skuLabel} to ${input.where} before ${input.deadlineAt}; ${formatInr(input.forwardCmAtRisk24h, true)} CM at risk.`, actionBlocked: false }
    }
    case "ess-deadstock": {
      if (!input.skuLabel) return blocked("SKU")
      if (isNoData(input.forwardCmAtRisk24h)) return blocked("forward CM at risk")
      if (input.agedDays === undefined) return blocked("inventory age")
      return { nextAction: `Reprice, transfer or return ${input.skuLabel} at ${input.where}; ${formatInr(input.forwardCmAtRisk24h, true)} expected loss, aged ${pluralDays(input.agedDays)}.`, actionBlocked: false }
    }
    default:
      return blocked("action template")
  }
}

/* ------------------------------------------------------------------ */
/* Assemble the full mismatch contract and the auditable score.        */
/* ------------------------------------------------------------------ */

export function toMismatch(input: MismatchInput): Mismatch {
  const action = buildNextAction(input)
  return {
    ...input,
    attentionBucket: action.actionBlocked ? "Blocked" : attentionBucketFor(input.actionStatus) ?? "Assigned",
    nextAction: action.nextAction,
    actionBlocked: action.actionBlocked,
    missingField: action.missingField,
  }
}

export function scoreComponents(mismatch: Mismatch): Measured<ScoreComponents> {
  if (!isUnresolved(mismatch.actionStatus) || isNoData(mismatch.forwardCmAtRisk24h)) return NO_DATA
  const forwardCmAtRisk24h = mismatch.forwardCmAtRisk24h
  const urgency = urgencyMultiplier(mismatch.ageHours, mismatch.thresholdHours)
  const confidence = SCORE_CONFIG.confidence[mismatch.confidence]
  const attention = SCORE_CONFIG.attention[mismatch.attentionBucket]
  const rawPriority = forwardCmAtRisk24h * urgency * mismatch.recoverableShare * confidence * attention
  return {
    forwardCmAtRisk24h,
    urgencyMultiplier: urgency,
    recoverableShare: mismatch.recoverableShare,
    confidenceMultiplier: confidence,
    attentionMultiplier: attention,
    rawPriority,
  }
}

/** Open queue. Closed and Dismissed rows are excluded from scoring. */
export function buildRankedQueue(context: ActionLogContext = {}): RankedMismatch[] {
  const unresolved = mismatchInputs
    .map((input) => getMismatchForStage(input.domain, input.joinKey, context))
    .filter((mismatch): mismatch is Mismatch => mismatch !== undefined)
    .filter((mismatch) => isUnresolved(mismatch.actionStatus))

  const components = new Map<string, Measured<ScoreComponents>>()
  let maxRaw = 0
  for (const mismatch of unresolved) {
    const comp = scoreComponents(mismatch)
    components.set(mismatch.id, comp)
    if (!isNoData(comp)) maxRaw = Math.max(maxRaw, comp.rawPriority)
  }

  const ranked = unresolved.map<RankedMismatch>((mismatch) => {
    const comp = components.get(mismatch.id)!
    const priorityScore = isNoData(comp) || maxRaw === 0 ? NO_DATA : Math.round((comp.rawPriority / maxRaw) * 100)
    return { ...mismatch, priorityScore, scoreComponents: comp }
  })

  return ranked.sort((a, b) => {
    const aComp = a.scoreComponents
    const bComp = b.scoreComponents
    const aScored = !isNoData(aComp)
    const bScored = !isNoData(bComp)
    if (aScored !== bScored) return aScored ? -1 : 1
    if (!isNoData(aComp) && !isNoData(bComp) && bComp.rawPriority !== aComp.rawPriority) return bComp.rawPriority - aComp.rawPriority
    return a.id.localeCompare(b.id)
  })
}

export const ACTION_GRID_CATEGORIES = ["Living", "Work", "Essentials"] as const
export type ActionGridCategory = (typeof ACTION_GRID_CATEGORIES)[number]
export type DailyActionGrid = Record<ActionGridCategory, Record<(typeof THEATRES)[number], RankedMismatch[] | null>>

/**
 * Preserves the audited queue order while grouping open actions for the daily
 * Theatre × category matrix. A null cell means the feed is not instrumented.
 */
export function buildDailyActionGrid(context: ActionLogContext = {}): DailyActionGrid {
  const grid = Object.fromEntries(ACTION_GRID_CATEGORIES.map((category) => [
    category,
    Object.fromEntries(THEATRES.map((theatre) => [theatre, category === "Work" ? null : []])),
  ])) as DailyActionGrid

  for (const mismatch of buildRankedQueue(context)) {
    const category: ActionGridCategory = mismatch.domain === "Essentials" ? "Essentials" : "Living"
    const theatre = THEATRES.find((name) => name === mismatch.theatre)
    if (!theatre) continue
    const actions = grid[category][theatre]
    if (actions && actions.length < 3) actions.push(mismatch)
  }

  return grid
}

export function topUnresolved(context: ActionLogContext = {}): RankedMismatch | undefined {
  return buildRankedQueue(context)[0]
}

export function mismatchById(id: string, context: ActionLogContext = {}): Mismatch | undefined {
  const input = mismatchInputs.find((item) => item.id === id)
  return input ? getMismatchForStage(input.domain, input.joinKey, context) : undefined
}
