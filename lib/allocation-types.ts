import type { DashboardRoute } from "@/lib/dashboard-model"

/** Sentinel used everywhere a value is genuinely unavailable. Never substitute 0. */
export const NO_DATA = "No data" as const
export type NoData = typeof NO_DATA
export type Measured<T> = T | NoData

export type AllocationDomain = "Shram Park" | "FONO" | "Work" | "Essentials"
export type MismatchType = "shortfall" | "idle-capacity" | "stockout" | "dead-stock"
export type Confidence = "High" | "Medium" | "Low"

/** Visible status is always derived from the append-only action log. */
export type ActionStatus = "Detected" | "Agreed" | "Assigned" | "Resolved" | "Closed" | "Verified" | "Dismissed"

/** Attention buckets that drive the score multiplier. */
export type AttentionBucket = "Unassigned" | "Blocked" | "Assigned" | "In progress"

export type JoinKey = {
  theatreId: string
  studioId?: string
  factoryId?: string
  demandBatchId?: string
  skuId?: string
  dateBucket?: string
  requiredByAt?: string
  coordinates?: { lat: number; lng: number }
}

export type PositiveOutlier = {
  id: string
  domain: AllocationDomain
  theatre: string
  where: string
  label: string
  owner: string
  forwardCmUpside24h: number
  confidence: Confidence
  status: "Verified" | "Sustaining"
  nextAction: string
  sourceUpdatedAt: string
  laneTarget: DashboardRoute
  evidence: string[]
}

export type RootCauseAnalysis = {
  /** Five reviewed steps in causal order. Evidence gaps must be stated, never inferred. */
  whys: readonly [string, string, string, string, string]
  rootCause: string
  recommendedSolution: string
  evidenceReferences: string[]
  review: {
    status: string
    reviewedBy: string
    reviewedAt: string
  }
}

export type ScoreComponents = {
  forwardCmAtRisk24h: number
  urgencyMultiplier: number
  recoverableShare: number
  confidenceMultiplier: number
  attentionMultiplier: number
  rawPriority: number
}

/** Raw illustrative input for one detected mismatch, before the engine derives action + score. */
export type MismatchInput = {
  id: string
  domain: AllocationDomain
  mismatchType: MismatchType
  theatre: string
  where: string
  label: string
  joinKey: JoinKey
  demandQty: Measured<number>
  supplyQty: Measured<number>
  gapQty: Measured<number>
  gapUnit: string
  ageHours: number
  thresholdHours: number
  deadlineAt: string
  forwardCmAtRisk24h: Measured<number>
  recoverableShare: number
  confidence: Confidence
  sourceUpdatedAt: string
  sourceLabel: string
  accountableOwner: string
  actionStatus: ActionStatus
  actionTemplateId: string
  /** Sheet-authored action copy takes precedence over a generated template. */
  nextAction?: string
  /** Alert-delivery state recorded by the connected execution queue. */
  alertStatus?: string
  alertQueuedAt?: string
  /** False when the connected sources do not contain age/SLA timing. */
  timingAvailable?: boolean
  /** False when recoverability or confidence is absent from the Sheet. */
  scoringInputsAvailable?: boolean
  laneTarget: DashboardRoute
  evidence: string[]
  rootCauseAnalysis: RootCauseAnalysis
  /** Essentials template parameters. */
  skuLabel?: string
  agedDays?: number
}

/** Full mismatch contract: every field the queue, panel and audit trail may read. */
export type Mismatch = MismatchInput & {
  attentionBucket: AttentionBucket
  nextAction: string
  actionBlocked: boolean
  missingField?: string
}

/** Mismatch after ranking against its peers. */
export type RankedMismatch = Mismatch & {
  priorityScore: Measured<number>
  scoreComponents: Measured<ScoreComponents>
}
