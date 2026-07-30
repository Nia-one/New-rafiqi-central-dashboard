"use client"

import { useState } from "react"
import { AlertTriangle, Check, ChevronRight, Clock3, FileCheck2, LockKeyhole, MapPin, ShieldCheck } from "lucide-react"
import {
  ENTERPRISE_DEMAND_DISPOSITIONS,
  recordJourneyDisposition,
  type EnterpriseDemandLoopPreview,
  type EnterpriseDisposition,
  type JourneyStep,
} from "@/lib/operating-loop/enterprise-demand-loop"
import { LoopHealthStrip } from "@/components/loop-health-strip"
import { buildLoopHealth, type LoopHealth, type LoopHealthFeedInput } from "@/lib/operating-loop/loop-health"
import { actionStageFromStatus, ActionSegment, type ActionSegmentKey, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { approvalsForDomain } from "@/lib/live-approvals"

type Props = { preview: EnterpriseDemandLoopPreview; liveData?: any }

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function parsedTimestamp(value: unknown) {
  const raw = String(value ?? "").trim()
  const indianDate = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/)
  if (indianDate) return Date.UTC(Number(indianDate[3]), Number(indianDate[2]) - 1, Number(indianDate[1]))
  return Date.parse(raw)
}

function date(value: string) {
  const timestamp = parsedTimestamp(value)
  if (!Number.isFinite(timestamp)) return "Not available"
  return `${dateFormatter.format(new Date(timestamp))} IST`
}

function liveText(row: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  if (!row) return ""
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function validTimestamp(value: unknown) {
  const timestamp = parsedTimestamp(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : ""
}

function sheetNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function distanceAndBearing(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const earthRadiusKm = 6371
  const latitudeDelta = radians(toLat - fromLat)
  const longitudeDelta = radians(toLng - fromLng)
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(longitudeDelta / 2) ** 2
  const distanceKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const y = Math.sin(longitudeDelta) * Math.cos(radians(toLat))
  const x = Math.cos(radians(fromLat)) * Math.sin(radians(toLat)) - Math.sin(radians(fromLat)) * Math.cos(radians(toLat)) * Math.cos(longitudeDelta)
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  return { distanceKm, bearing }
}

function latestTimestamp(rows: readonly Record<string, unknown>[]) {
  return rows.flatMap((row) => ["updated at", "captured at", "proposed at", "uploaded at", "decided at", "verified at", "closed at", "opened at"].map((key) => validTimestamp(row[key])))
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? ""
}

function liveEnterpriseDemandLoopHealth(liveData: any, approvals: ReturnType<typeof approvalsForDomain>, fallback: LoopHealth) {
  const demand = Array.isArray(liveData?.enterpriseDemand) ? liveData.enterpriseDemand as Record<string, unknown>[] : []
  const linkedActions = approvals.map((approval) => approval.actionRow).filter((row): row is Record<string, unknown> => Boolean(row))
  const rawActions = Array.isArray(liveData?.actions) ? liveData.actions as Record<string, unknown>[] : []
  const actionsById = new Map<string, Record<string, unknown>>()
  for (const row of [...linkedActions, ...rawActions]) {
    const actionId = liveText(row, ["action id", "id"])
    const description = [liveText(row, ["operating objective", "title"]), liveText(row, ["expected metric"]), liveText(row, ["required evidence"])].join(" ").toLowerCase()
    if (actionId && (linkedActions.includes(row) || /enterprise|named demand|headcount|demand|matching/.test(description))) actionsById.set(actionId, row)
  }
  const actions = [...actionsById.values()].filter((row) => liveText(row, ["state", "status"]).toLowerCase() !== "dismissed")
  const actionIds = new Set(actions.map((row) => liveText(row, ["action id", "id"])))
  const proofEvidenceIds = new Set(actions.map((row) => liveText(row, ["proof evidence id"])).filter(Boolean))
  const allEvidence = Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : []
  const evidence = allEvidence.filter((row) => actionIds.has(liveText(row, ["linked id"])) || proofEvidenceIds.has(liveText(row, ["evidence id", "id"])))
  const approvalRows = approvals.map((approval) => approval.approvalRow)
  const asOf = validTimestamp(liveData?.asOf) || latestTimestamp([...demand, ...actions, ...evidence, ...approvalRows])
  if (!liveData || !asOf || demand.length === 0) return { connected: false, health: fallback }

  const feeds: LoopHealthFeedInput[] = [
    { feedId: "enterprise-demand", label: "Enterprise Demand · signed arrival", lastUpdatedAt: latestTimestamp(demand) || asOf, cadenceMinutes: 1440, critical: true, affectedClaims: ["signed target", "arrival", "named demand"] },
  ]
  if (actions.length) feeds.push({ feedId: "enterprise-actions", label: "Action Log · demand recovery", lastUpdatedAt: latestTimestamp(actions) || asOf, cadenceMinutes: 240, critical: true, affectedClaims: ["owner", "next action", "closure state"] })
  if (evidence.length) feeds.push({ feedId: "enterprise-evidence", label: "Evidence Log · readiness proof", lastUpdatedAt: latestTimestamp(evidence) || asOf, cadenceMinutes: 1440, critical: true, affectedClaims: ["verified ready"] })
  if (approvalRows.length) feeds.push({ feedId: "enterprise-approvals", label: "Approval Log · demand exceptions", lastUpdatedAt: latestTimestamp(approvalRows) || latestTimestamp(actions) || asOf, cadenceMinutes: 1440, critical: false, affectedClaims: ["approval status"] })

  const stateOf = (row: Record<string, unknown>) => liveText(row, ["state", "status"]).toLowerCase()
  // Action_Log remains authoritative when governed demand actions exist. Until
  // those rows are created, each live Enterprise_Demand row is itself a
  // measurable outcome: fully matched is verified; a remaining gap is waiting.
  // This keeps FONO Funnel and Shram Park bot demand visible in Loop Health
  // instead of incorrectly reporting 0 of 0.
  // The workspace headline and key numbers operate on the first (latest after
  // dashboard sorting) demand row, so fallback health must use that same scope.
  // Counting the whole month here makes one selected task appear as dozens of
  // unrelated outcomes.
  const demandOutcomeRows = actions.length === 0 ? demand.slice(0, 1).filter((row) => sheetNumber(row["headcount required"]) > 0) : []
  const demandIsVerified = (row: Record<string, unknown>) => sheetNumber(row["headcount matched"]) >= sheetNumber(row["headcount required"])
  const demandIsReopened = (row: Record<string, unknown>) => stateOf(row) === "reopened"
  const claimed = actions.length || demandOutcomeRows.length
  const verified = actions.length
    ? actions.filter((row) => ["verified", "closed", "resolved"].includes(stateOf(row))).length
    : demandOutcomeRows.filter(demandIsVerified).length
  const reopenedRows = actions.length
    ? actions.filter((row) => stateOf(row) === "reopened")
    : demandOutcomeRows.filter((row) => !demandIsVerified(row) && demandIsReopened(row))
  const awaitingRows = actions.length
    ? actions.filter((row) => !["verified", "closed", "resolved", "reopened"].includes(stateOf(row)))
    : demandOutcomeRows.filter((row) => !demandIsVerified(row) && !demandIsReopened(row))
  const awaitingTimestampKeys = actions.length
    ? ["proposed at", "updated at", "due at"]
    : ["updated at"]
  const oldestAwaitingAt = awaitingRows.flatMap((row) => awaitingTimestampKeys.map((key) => validTimestamp(row[key]))).filter(Boolean).sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? (awaitingRows.length ? asOf : null)
  const clocks = awaitingRows.map((row, index) => {
    const dueAt = validTimestamp(row[actions.length ? "due at" : "activation required at"])
    const openedAt = validTimestamp(row["opened at"])
    // Reject ambiguous sheet dates that parse before the demand even opened
    // (for example 1-8-2026 being interpreted as January 8).
    const credibleDueAt = !actions.length && dueAt && openedAt && Date.parse(dueAt) < Date.parse(openedAt) ? "" : dueAt
    return {
      clockId: liveText(row, actions.length ? ["action id", "id"] : ["demand id", "id"]) || `enterprise-outcome-${index}`,
      label: actions.length
        ? liveText(row, ["operating objective", "title"]) || "Enterprise Demand action"
        : `${liveText(row, ["enterprise name"]) || "Enterprise demand"} readiness gap`,
      ownerRole: liveText(row, ["owner actor id", "owner"]) || "Unassigned",
      dueAt: credibleDueAt,
      state: "Running" as const,
    }
  }).filter((clock) => clock.dueAt)
  const incidents = Array.isArray(liveData?.incidents) ? liveData.incidents as Record<string, unknown>[] : []
  const quarantinedRecords = demand.filter((row) => /quarantined|rejected/.test(liveText(row, ["status", "state"]).toLowerCase())).length
    + incidents.filter((row) => /enterprise|demand/.test(liveText(row, ["domain", "incident type"]).toLowerCase()) && liveText(row, ["state", "status"]).toLowerCase() === "quarantined").length

  return { connected: true, health: buildLoopHealth({ asOf, feeds, clocks, verification: { claimed, verified, awaiting: awaitingRows.length, reopened: reopenedRows.length, oldestAwaitingAt }, quarantinedRecords }) }
}

function slicePath(index: number, total = 8) {
  const start = (index / total) * Math.PI * 2 - Math.PI / 2
  const end = ((index + 1) / total) * Math.PI * 2 - Math.PI / 2
  const point = (angle: number) => ({ x: 50 + Math.cos(angle) * 42, y: 50 + Math.sin(angle) * 42 })
  const first = point(start)
  const last = point(end)
  return `M 50 50 L ${first.x.toFixed(2)} ${first.y.toFixed(2)} A 42 42 0 0 1 ${last.x.toFixed(2)} ${last.y.toFixed(2)} Z`
}

function RingPlan({ steps, live = false }: { steps: readonly JourneyStep[]; live?: boolean }) {
  return <div className="enterprise-ring-visual">
    <svg viewBox="0 0 420 238" role="img" aria-label={`${live ? "Sheet-driven" : "Synthetic"} demand-node plan with Ring 1 from zero to two kilometres and Ring 2 from two to five kilometres`}>
      <title>Enterprise plant at the centre; plotted studios are calculated from recorded coordinates.</title>
      <circle className="enterprise-ring-two" cx="210" cy="119" r="96" />
      <circle className="enterprise-ring-one" cx="210" cy="119" r="43" />
      <text className="enterprise-ring-label" x="210" y="17" textAnchor="middle">Ring 2 · 2–5 km</text>
      <text className="enterprise-ring-label" x="210" y="69" textAnchor="middle">Ring 1 · 0–2 km</text>
      <g className="enterprise-plant-node"><circle cx="210" cy="119" r="25" /><text x="210" y="116" textAnchor="middle">PLANT</text><text x="210" y="130" textAnchor="middle">GATE</text></g>
      {steps.filter((step) => step.ring !== "Beyond 5 km").map((step, index) => {
        const radius = Math.min(step.distanceKm, 5) / 5 * 91
        const radians = step.bearing * Math.PI / 180 - Math.PI / 2
        const x = 210 + Math.cos(radians) * radius
        const y = 119 + Math.sin(radians) * radius
        return <g className={`enterprise-plan-point is-${step.supplyModel.toLowerCase()}`} key={step.stepId} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
          {step.supplyModel === "SP" ? <rect x="-9" y="-9" width="18" height="18" rx="2" /> : <circle r="9" />}
          <text x="0" y="3" textAnchor="middle">{index + 1}</text>
        </g>
      })}
    </svg>
    <div className="enterprise-ring-legend" aria-label="Demand plan legend">
      <span><i className="is-fono" />FONO call</span><span><i className="is-sp" />SP visit</span><span><LockKeyhole aria-hidden />Beyond 5 km blocked</span>
    </div>
  </div>
}

function PizzaProgress({ preview }: { preview: EnterpriseDemandLoopPreview }) {
  return <div className="enterprise-pizza-layout">
    <div className="enterprise-pizza-chart">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${preview.progressPercent}% of steps to completion finished`}>
        <title>{`${preview.progressPercent}% of steps to completion finished`}</title>
        {preview.progress.map((stage, index) => <path className={stage.complete ? "is-complete" : "is-open"} d={slicePath(index)} key={stage.stage} />)}
        <circle cx="50" cy="50" r="19" />
        <text x="50" y="48" textAnchor="middle">{preview.progress.filter((stage) => stage.complete).length}/8</text>
        <text x="50" y="60" textAnchor="middle">{preview.progressPercent}%</text>
      </svg>
    </div>
    <ol className="enterprise-stage-counts">
      {preview.progress.map((stage, index) => <li className={stage.complete ? "is-complete" : undefined} key={stage.stage}><b>{index + 1}</b><span><strong>{stage.stage}</strong><small>{stage.count}/{stage.target}</small></span></li>)}
    </ol>
  </div>
}

const JOURNEY_SEGMENT_ORDER: readonly ActionSegmentKey[] = ["fix-now", "due-today", "nia-recovering", "waiting-sign-off", "verified"]

function segmentForStep(step: JourneyStep): ActionSegmentKey {
  if (step.state === "Verified ready" || step.state === "Closed") return "verified"
  if (step.humanApprovalRequired || step.state === "Human-approved exception") return "waiting-sign-off"
  if (step.state === "Reopened" || step.state === "Retry scheduled" || step.state === "Evidence pending" || step.state === "Ring 2 gated") return "nia-recovering"
  return "due-today"
}

function defaultNextAction(outcome: EnterpriseDisposition) {
  if (outcome === "No answer") return "Retry scheduled in two hours"
  if (outcome === "Verified ready" || outcome === "Evidence pending") return "Independent verification queued"
  if (outcome === "Commercial exception") return "Route to Pushkar for approval"
  if (outcome === "Spec mismatch") return "Collect corrective spec evidence"
  if (outcome === "Unsuitable") return "Close candidate and continue ordered plan"
  return "Continue the governed next step"
}

export function EnterpriseDemandWorkspace({ preview: fixturePreview, liveData }: Props) {
  const hasLiveSnapshot = Boolean(liveData)
  const demandRows = Array.isArray(liveData?.enterpriseDemand) ? liveData.enterpriseDemand as Record<string, unknown>[] : []
  const isFonoRow = (row: Record<string, unknown>) => liveText(row, ["demand id"]).toUpperCase().startsWith("OPS-RPT-FONO-")
  const portfolioShortfallRows = demandRows.filter((row) => {
    const status = liveText(row, ["status", "certainty"]).toLowerCase()
    return isFonoRow(row) && /^lead$/.test(status) && sheetNumber(row["headcount required"]) > 0
  })
  const fonoSupplyRows = demandRows.filter((row) => isFonoRow(row) && /contracting|contracted|onboarded|signed|committed|won|commercial/.test(liveText(row, ["status", "certainty"]).toLowerCase()))
  const demand: any = portfolioShortfallRows[0] || demandRows[0]
  const portfolioTargetNests = portfolioShortfallRows.reduce((total, row) => total + sheetNumber(row["headcount required"]), 0)
  const portfolioSupplyNests = fonoSupplyRows.reduce((total, row) => total + sheetNumber(row["headcount required"]), 0)
  // Portfolio balance is the full potential still sitting in the Lead stage.
  // Contracting/Contracted/Onboarded supply is reported separately and must
  // not reduce this Lead-stage balance.
  const portfolioGapNests = portfolioTargetNests
  const livePolicyApprovals = approvalsForDomain(liveData, "enterprise-demand")
  const committedNests = demand ? sheetNumber(demand["headcount required"]) : hasLiveSnapshot ? 0 : fixturePreview.activeNode.committedNests
  // Read readiness from the selected demand row. A global Living capacity
  // total cannot verify fulfilment of one named enterprise requirement.
  const verifiedReadyNests = demand ? Math.min(committedNests, sheetNumber(demand["headcount matched"])) : hasLiveSnapshot ? 0 : fixturePreview.activeNode.verifiedReadyNests
  const preview: EnterpriseDemandLoopPreview = {
    ...fixturePreview,
    headline: demand ? `${demand["enterprise name"] || "Enterprise"} needs ${committedNests} verified ready Nests.` : hasLiveSnapshot ? "No Enterprise Demand row matches the current filters." : fixturePreview.headline,
    activeNode: {
      ...fixturePreview.activeNode,
      enterpriseName: demand?.["enterprise name"] || (hasLiveSnapshot ? "No matching enterprise" : fixturePreview.activeNode.enterpriseName),
      plantName: demand?.["plant name"] || (hasLiveSnapshot ? "" : fixturePreview.activeNode.plantName),
      committedNests,
      verifiedReadyNests,
      readinessGap: Math.max(0, committedNests - verifiedReadyNests),
      ownerActorId: demand?.["owner actor id"] || (hasLiveSnapshot ? "Owner not recorded" : fixturePreview.activeNode.ownerActorId),
      arrivalAt: demand?.["activation required at"] || (hasLiveSnapshot ? "" : fixturePreview.activeNode.arrivalAt),
    },
  }
  const [localSteps, setLocalSteps] = useState<readonly JourneyStep[]>(() => preview.journeyPlan.steps)
  const [selectedOutcomes, setSelectedOutcomes] = useState<Record<string, EnterpriseDisposition>>(() => Object.fromEntries(preview.journeyPlan.steps.map((step) => [step.stepId, "No answer"])) as Record<string, EnterpriseDisposition>)
  const [shadowAudit, setShadowAudit] = useState<readonly { eventId: string; stepId: string; outcome: EnterpriseDisposition; occurredAt: string; nextAction: string }[]>([])
  const behind = preview.activeNode.readinessGap > 0
  const verdictLabel = !demand && hasLiveSnapshot ? "No matching Enterprise Demand data" : behind ? `Behind · ${preview.activeNode.readinessGap} Nests to close` : "On track for arrival"
  const liveEnterpriseApproval = livePolicyApprovals[0]
  const liveEnterpriseAction = liveEnterpriseApproval?.actionRow
  const ownerActorId = preview.activeNode.ownerActorId
  const ownerPerson = (liveData?.people ?? []).find((row: Record<string, unknown>) => liveText(row, ["actor id"]) === ownerActorId)
  const ownerLabel = liveText(ownerPerson, ["display name"]) || ownerActorId
  const taskProgressPercent = demand && committedNests > 0 ? Math.min(100, Math.max(0, Math.round((verifiedReadyNests / committedNests) * 100))) : hasLiveSnapshot ? 0 : preview.progressPercent
  const taskState = demand
    ? liveEnterpriseApproval?.pending ? "Pending approval" : liveText(liveEnterpriseAction, ["state", "status"]) || liveText(demand, ["status"]) || "Open"
    : hasLiveSnapshot ? "No matching demand" : preview.activeNode.state
  const taskSourceLabel = hasLiveSnapshot ? `Priority lead · ${portfolioShortfallRows.length} FONO Leads · Google Sheet live` : `${preview.fixtureLabel} · ${preview.mode}`
  const taskGoverningCopy = demand
    ? `${verifiedReadyNests} of ${committedNests} Nests are verified ready for ${liveText(demand, ["role required"]) || "the named role"}${liveText(demand, ["shift"]) ? ` on the ${liveText(demand, ["shift"])} shift` : ""}; close the remaining ${preview.activeNode.readinessGap} before ${date(preview.activeNode.arrivalAt)}.`
    : hasLiveSnapshot ? "No signed Enterprise Demand row is available for the selected filters; no fixture value is substituted." : "Work Ring 1 (0–2 km) to exhaustion before opening the 5 km search; recover verified-ready capacity, then submit contract-matched proof."
  const liveLoop = liveEnterpriseDemandLoopHealth(liveData, livePolicyApprovals, fixturePreview.loopHealth)
  const loopHealth = hasLiveSnapshot && !demand ? buildLoopHealth({
    asOf: validTimestamp(liveData?.asOf) || new Date().toISOString(),
    feeds: [{ feedId: "enterprise-demand-empty", label: "Enterprise Demand · no matching row", lastUpdatedAt: "1970-01-01T00:00:00.000Z", cadenceMinutes: 1440, critical: true, affectedClaims: ["signed target", "arrival", "named demand"] }],
    clocks: [],
    verification: { claimed: 0, verified: 0, awaiting: 0, reopened: 0, oldestAwaitingAt: null },
  }) : liveLoop.health
  const livingRows = Array.isArray(liveData?.living) ? liveData.living as Record<string, unknown>[] : []
  const readyBySupply = livingRows.reduce((totals, row) => {
    const model = liveText(row, ["supply model"]).toUpperCase()
    const ready = Number(row["activation ready nests"] ?? 0)
    if (model === "FONO") totals.FONO += Number.isFinite(ready) ? ready : 0
    if (model === "SP" || model === "SHRAM PARK") totals.SP += Number.isFinite(ready) ? ready : 0
    return totals
  }, { FONO: 0, SP: 0 })
  const demandReference = demand ? liveText(demand, ["contract id", "demand id", "enterprise id"]) || "Reference not recorded" : hasLiveSnapshot ? "No demand reference" : preview.activeNode.contractId
  const selectedDemandId = liveText(demand, ["demand id"])
  const selectedDemandSupply = selectedDemandId.toUpperCase().startsWith("SP-BOT-") ? "SP"
    : selectedDemandId.toUpperCase().startsWith("OPS-RPT-FONO-") ? "FONO"
      : ""
  const selectedReadyBySupply = selectedDemandSupply === "FONO"
    ? { FONO: verifiedReadyNests, SP: 0 }
    : selectedDemandSupply === "SP"
      ? { FONO: 0, SP: verifiedReadyNests }
      : readyBySupply
  const arrivalTimestamp = validTimestamp(preview.activeNode.arrivalAt)
  const asOfTimestamp = validTimestamp(liveData?.asOf)
  const hoursToArrival = arrivalTimestamp && asOfTimestamp ? Math.max(0, (Date.parse(arrivalTimestamp) - Date.parse(asOfTimestamp)) / 3_600_000) : null
  const daysToArrival = hoursToArrival === null ? null : Math.ceil(hoursToArrival / 24)
  const requiredRunRate = hoursToArrival === null
    ? "No deadline"
    : preview.activeNode.readinessGap <= 0
      ? "0 Nests/hour"
      : hoursToArrival > 0
        ? (() => {
            const nestsPerHour = Math.ceil(preview.activeNode.readinessGap / hoursToArrival)
            return `${nestsPerHour} ${nestsPerHour === 1 ? "Nest" : "Nests"}/hour`
          })()
        : "Overdue"
  const overdueFollowUps = loopHealth.clocks.filter((clock) => clock.breached).length
  const demandLatitude = sheetNumber(demand?.latitude)
  const demandLongitude = sheetNumber(demand?.longitude)
  const peopleRows = Array.isArray(liveData?.people) ? liveData.people as Record<string, unknown>[] : []
  const personLabel = (actorId: string) => liveText(peopleRows.find((row) => liveText(row, ["actor id"]) === actorId), ["display name"]) || actorId || "Unassigned"
  const actionRows = Array.isArray(liveData?.actions) ? liveData.actions as Record<string, unknown>[] : []
  const enterpriseActionRows = actionRows.filter((row) => /enterprise|named demand|headcount|demand|matching/.test([liveText(row, ["operating objective", "title"]), liveText(row, ["expected metric"]), liveText(row, ["required evidence"])].join(" ").toLowerCase()))
  const incidentRows = Array.isArray(liveData?.incidents) ? liveData.incidents as Record<string, unknown>[] : []
  const incidentStudioById = new Map(incidentRows.map((row) => [liveText(row, ["incident id", "id"]), liveText(row, ["studio id"])]).filter(([incidentId, studioId]) => Boolean(incidentId && studioId)))
  const actionByStudioId = new Map<string, Record<string, unknown>>()
  for (const row of enterpriseActionRows) {
    const studioId = liveText(row, ["studio id"]) || incidentStudioById.get(liveText(row, ["incident id"])) || ""
    if (studioId) actionByStudioId.set(studioId, row)
  }
  const evidenceRows = Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : []
  const evidenceByActionId = new Map<string, Record<string, unknown>[]>()
  for (const row of evidenceRows) {
    const linkedId = liveText(row, ["linked id"])
    if (!linkedId) continue
    evidenceByActionId.set(linkedId, [...(evidenceByActionId.get(linkedId) ?? []), row])
  }
  const activationRows = (Array.isArray(liveData?.activations) ? liveData.activations as Record<string, unknown>[] : []).filter((row) => liveText(row, ["demand id"]) === liveText(demand || {}, ["demand id"]) || liveText(row, ["enterprise id"]) === liveText(demand || {}, ["enterprise id"]))
  const livingByStudioId = new Map(livingRows.map((row) => [liveText(row, ["studio id"]), row]).filter(([studioId]) => Boolean(studioId)))
  const liveCandidateRows = demand && demandLatitude && demandLongitude && Array.isArray(liveData?.studios)
    ? (liveData.studios as Record<string, unknown>[]).flatMap((studio, index) => {
        const latitude = sheetNumber(studio.latitude)
        const longitude = sheetNumber(studio.longitude)
        const capacityNests = sheetNumber(studio["activation ready nests"])
        const supplyModel = liveText(studio, ["supply model", "operating model"]).toUpperCase()
        if (!latitude || !longitude || capacityNests <= 0 || !["FONO", "SP"].includes(supplyModel)) return []
        const geo = distanceAndBearing(demandLatitude, demandLongitude, latitude, longitude)
        if (geo.distanceKm > 5) return []
        return [{ studio, index, capacityNests, supplyModel: supplyModel as "FONO" | "SP", ...geo }]
      }).sort((left, right) => left.distanceKm - right.distanceKm)
    : []
  const liveRing1PotentialNests = liveCandidateRows.filter((candidate) => candidate.distanceKm <= 2).reduce((total, candidate) => total + candidate.capacityNests, 0)
  const liveRing2Unlocked = liveRing1PotentialNests < preview.activeNode.readinessGap
  let assignedNextStep = false
  const liveSteps: readonly JourneyStep[] = liveCandidateRows.map((candidate, orderIndex) => {
    const studioId = liveText(candidate.studio, ["studio id"])
    const stepAction = actionByStudioId.get(studioId)
    const actionId = liveText(stepAction, ["action id", "id"])
    const stepEvidence = evidenceByActionId.get(actionId) ?? []
    const actionState = liveText(stepAction, ["state", "status"]).toLowerCase()
    const readinessState = liveText(candidate.studio, ["readiness status"]).toLowerCase()
    const hasVerifiedEvidence = stepEvidence.some((row) => /verified|approved|confirmed/.test(liveText(row, ["verification status", "status"]).toLowerCase()))
    const ring = candidate.distanceKm <= 2 ? "Ring 1" as const : "Ring 2" as const
    const recordedActionDueAt = validTimestamp(stepAction?.["due at"])
    const livingActionDueAt = validTimestamp(livingByStudioId.get(studioId)?.["next action due at"])
    const calculatedDueAt = asOfTimestamp
      ? new Date(Math.min(arrivalTimestamp ? Date.parse(arrivalTimestamp) : Number.POSITIVE_INFINITY, Date.parse(asOfTimestamp) + (orderIndex + 1) * 60 * 60 * 1000)).toISOString()
      : arrivalTimestamp
    const currentLivingDueAt = livingActionDueAt && (!asOfTimestamp || Date.parse(livingActionDueAt) >= Date.parse(asOfTimestamp)) ? livingActionDueAt : ""
    const dueAt = recordedActionDueAt || currentLivingDueAt || calculatedDueAt || arrivalTimestamp
    const recordedActionOverdue = Boolean(recordedActionDueAt && asOfTimestamp && Date.parse(recordedActionDueAt) < Date.parse(asOfTimestamp))
    let state: JourneyStep["state"]
    if (ring === "Ring 2" && !liveRing2Unlocked) state = "Ring 2 gated"
    else if (/closed|resolved/.test(actionState)) state = "Closed"
    else if (hasVerifiedEvidence || /verified/.test(readinessState) || actionState === "verified") state = "Verified ready"
    else if (actionState === "reopened" || recordedActionOverdue) state = "Reopened"
    else if (stepEvidence.length > 0 || /ready/.test(readinessState)) state = "Evidence pending"
    else if (!assignedNextStep) { assignedNextStep = true; state = "Next" }
    else state = "Queued"
    const stepOwnerActorId = liveText(stepAction, ["owner actor id", "owner"]) || liveText(livingByStudioId.get(studioId), ["next action owner actor id"]) || ownerActorId
    return Object.freeze({
      stepId: studioId || `studio-candidate-${candidate.index}`,
      nodeId: demandReference,
      candidateName: liveText(candidate.studio, ["studio name", "studio id"]) || "Unnamed studio",
      actionKind: candidate.supplyModel === "SP" ? "Visit" as const : "Call" as const,
      supplyModel: candidate.supplyModel,
      playbook: candidate.supplyModel,
      ring,
      distanceKm: Math.round(candidate.distanceKm * 10) / 10,
      bearing: candidate.bearing,
      capacityNests: candidate.capacityNests,
      ownerActorId: stepOwnerActorId,
      dueAt,
      state,
      humanApprovalRequired: false,
      independentlyVerifiedNests: /verified/.test(liveText(candidate.studio, ["readiness status"]).toLowerCase()) ? candidate.capacityNests : 0,
      history: [],
      version: 1,
    })
  })
  const steps = liveData ? liveSteps : localSteps
  const nextStep = steps.find((step) => step.state === "Next") ?? steps.find((step) => step.state !== "Ring 2 gated") ?? null
  const ring1PotentialNests = liveData ? liveRing1PotentialNests : preview.journeyPlan.ring1PotentialNests
  const ring2Unlocked = liveData ? liveRing2Unlocked : preview.journeyPlan.ring2Unlocked
  const enterpriseActionIds = new Set(enterpriseActionRows.map((row) => liveText(row, ["action id", "id"])).filter(Boolean))
  const enterpriseEvidenceRows = (Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : []).filter((row) => enterpriseActionIds.has(liveText(row, ["linked id"])))
  const verifiedEvidenceCount = enterpriseEvidenceRows.filter((row) => /verified|approved|confirmed/.test(liveText(row, ["verification status", "status"]).toLowerCase())).length
  const billedActivationCount = activationRows.filter((row) => sheetNumber(row["membership billed inr"]) > 0).length
  const liveProgress = [
    { stage: "Triggered" as const, count: demand ? 1 : 0, target: 1, complete: Boolean(demand) },
    { stage: "Plan built" as const, count: steps.length ? 1 : 0, target: 1, complete: steps.length > 0 },
    { stage: "Calls underway" as const, count: enterpriseActionRows.length, target: Math.max(1, steps.length), complete: steps.length > 0 && enterpriseActionRows.length >= steps.length },
    { stage: "Evidence received" as const, count: enterpriseEvidenceRows.length, target: Math.max(1, enterpriseActionRows.length), complete: enterpriseActionRows.length > 0 && enterpriseEvidenceRows.length >= enterpriseActionRows.length },
    { stage: "Independently verified" as const, count: verifiedEvidenceCount, target: Math.max(1, enterpriseActionRows.length), complete: enterpriseActionRows.length > 0 && verifiedEvidenceCount >= enterpriseActionRows.length },
    { stage: "Capacity covered" as const, count: verifiedReadyNests, target: committedNests, complete: verifiedReadyNests >= committedNests },
    { stage: "Members arrived" as const, count: activationRows.length, target: committedNests, complete: activationRows.length >= committedNests },
    { stage: "Billing live" as const, count: billedActivationCount, target: committedNests, complete: billedActivationCount >= committedNests },
  ]
  const liveProgressPercent = Math.round(liveProgress.filter((stage) => stage.complete).length / liveProgress.length * 100)
  const progressPreview = liveData ? ({ ...preview, progress: liveProgress, progressPercent: liveProgressPercent } as EnterpriseDemandLoopPreview) : preview
  const studioRows = Array.isArray(liveData?.studios) ? liveData.studios as Record<string, unknown>[] : []
  const demandSupplyModel = (row: Record<string, unknown>) => {
    const demandId = liveText(row, ["demand id"]).toUpperCase()
    if (demandId.startsWith("OPS-RPT-FONO-")) return "FONO" as const
    if (demandId.startsWith("SP-BOT-")) return "SP" as const
    return null
  }
  const cumulativeDemandTotals = (model: "FONO" | "SP") => demandRows.filter((row) => demandSupplyModel(row) === model).reduce<{ demands: number; required: number; matched: number; remaining: number }>((totals, row) => {
    const required = sheetNumber(row["headcount required"])
    const matched = Math.min(required, sheetNumber(row["headcount matched"]))
    totals.demands += 1
    totals.required += required
    totals.matched += matched
    totals.remaining += Math.max(0, required - matched)
    return totals
  }, { demands: 0, required: 0, matched: 0, remaining: 0 })
  const demandModelById = new Map(demandRows.flatMap((row) => {
    const id = liveText(row, ["demand id"])
    const model = demandSupplyModel(row)
    return id && model ? [[id, model] as const] : []
  }))
  const demandModelByEnterpriseId = new Map(demandRows.flatMap((row) => {
    const id = liveText(row, ["enterprise id"])
    const model = demandSupplyModel(row)
    return id && model ? [[id, model] as const] : []
  }))
  const allActivationRows = Array.isArray(liveData?.activations) ? liveData.activations as Record<string, unknown>[] : []
  const cumulativeActivationTotals = (model: "FONO" | "SP") => allActivationRows.reduce<{ arrived: number; billed: number }>((totals, row) => {
    const activationModel = demandModelById.get(liveText(row, ["demand id"])) || demandModelByEnterpriseId.get(liveText(row, ["enterprise id"]))
    if (activationModel !== model) return totals
    totals.arrived += 1
    if (sheetNumber(row["membership billed inr"]) > 0) totals.billed += 1
    return totals
  }, { arrived: 0, billed: 0 })
  const fonoDemandTotals = cumulativeDemandTotals("FONO")
  const spDemandTotals = cumulativeDemandTotals("SP")
  const fonoActivationTotals = cumulativeActivationTotals("FONO")
  const spActivationTotals = cumulativeActivationTotals("SP")
  const commercialStage = (row: Record<string, unknown>) => {
    const status = liveText(row, ["status", "certainty"]).toLowerCase()
    if (/closed|lost|cancelled|no action/.test(status)) return null
    if (/contracted|onboarded|signed|committed|won/.test(status)) return "contracted" as const
    if (/contracting|commercial|proposal|quote|escalate/.test(status)) return "contracting" as const
    return "lead" as const
  }
  const fonoStageNests = demandRows.filter((row) => demandSupplyModel(row) === "FONO").reduce((totals, row) => {
    const stage = commercialStage(row)
    if (stage) totals[stage] += sheetNumber(row["headcount required"])
    return totals
  }, { lead: 0, contracting: 0, contracted: 0 })
  const spStageLeadCounts = demandRows.filter((row) => demandSupplyModel(row) === "SP").reduce<Map<string, number>>((totals, row) => {
    const stage = liveText(row, ["certainty", "status"]) || "Follow Up Action not recorded"
    totals.set(stage, (totals.get(stage) || 0) + 1)
    return totals
  }, new Map())
  const spStageLaneItems = [...spStageLeadCounts.entries()].map(([stage, count]) => ({ label: stage, count }))
  const fonoPotentialNests = fonoStageNests.lead + fonoStageNests.contracting + fonoStageNests.contracted
  const spLeadCount = spStageLaneItems.reduce((total, stage) => total + stage.count, 0)
  const supplyLanes = liveData ? [
    { supplyModel: "FONO" as const, stages: [
      { label: "Lead · potential Nests", count: fonoStageNests.lead },
      { label: "Contracting · potential Nests", count: fonoStageNests.contracting },
      { label: "Contracted · potential Nests", count: fonoStageNests.contracted },
      { label: "Total potential Nests", count: fonoPotentialNests },
      { label: "Members arrived", count: fonoActivationTotals.arrived },
      { label: "Billing", count: fonoActivationTotals.billed },
    ] },
    { supplyModel: "SP" as const, stages: [
      ...spStageLaneItems,
      { label: "Total visits / leads", count: spLeadCount },
    ] },
  ] : preview.supplyLanes
  const channelProgressSummary = liveData ? `FONO ${fonoPotentialNests} potential Nests · SP ${spLeadCount} leads` : "FONO and SP are tracked separately."
  const channelProgressImplication = liveData
    ? `So what: cumulative source records show ${fonoPotentialNests} FONO potential Nests by commercial stage and ${spLeadCount} SP leads by follow-up stage; SP current manpower is excluded from demand and matched Nests.`
    : "So what: FONO and SP progress on different stage sequences, so each channel needs its own follow-up, not one blended number."
  const nearbyPlanImplication = liveData
    ? steps.length === 0
      ? "So what: no coordinate-qualified Studio_Master capacity is recorded within 5 km, so the nearby recovery plan cannot be confirmed."
      : ring1PotentialNests >= preview.activeNode.readinessGap
        ? `So what: ${ring1PotentialNests} Ring 1 Nests cover the ${preview.activeNode.readinessGap}-Nest gap, so the 5 km search remains closed.`
        : `So what: Ring 1 is ${Math.max(0, preview.activeNode.readinessGap - ring1PotentialNests)} Nests short, so the 5 km search is open and the ordered Ring 2 candidates remain visible.`
    : "So what: nearby Ring 1 capacity covers the gap, so no 5 km expansion is needed or permitted yet."
  const arrivalImplicationSummary = hasLiveSnapshot
    ? !demand
      ? "No matching arrival data"
      : preview.activeNode.readinessGap <= 0
      ? "Signed target covered for arrival"
      : arrivalTimestamp
        ? `${preview.activeNode.readinessGap} Nests must close before ${date(arrivalTimestamp)}`
        : `${preview.activeNode.readinessGap} Nests remain · arrival date not recorded`
    : `${preview.activeNode.readinessGap} Nests must close before arrival`
  const arrivalImplicationDetail = hasLiveSnapshot
    ? !demand
      ? "So what: no signed demand or arrival deadline matches the selected filters, so no readiness conclusion is calculated."
      : preview.activeNode.readinessGap <= 0
      ? `So what: all ${preview.activeNode.committedNests} signed Nests are verified ready for the recorded arrival.`
      : hoursToArrival === null || !arrivalTimestamp
        ? `So what: ${preview.activeNode.readinessGap} Nests remain, but the Sheet has no valid arrival deadline for calculating the recovery rate.`
        : hoursToArrival > 0
          ? `So what: ${preview.activeNode.readinessGap} Nests must clear at ${requiredRunRate} before ${date(arrivalTimestamp)}, or the signed ${preview.activeNode.committedNests}-Nest capacity misses its committed date.`
          : `So what: the arrival deadline has passed with ${preview.activeNode.readinessGap} Nests still unverified; the overdue recovery action remains open.`
    : "So what: the gap must clear at the required hourly rate before the arrival date, or the signed capacity misses the committed date."

  function recordShadowOutcome(stepId: string) {
    const outcome = selectedOutcomes[stepId] ?? "No answer"
    const occurredAt = new Date().toISOString()
    const dueAt = new Date(Date.parse(occurredAt) + 2 * 60 * 60 * 1000).toISOString()
    const nextAction = defaultNextAction(outcome)
    setLocalSteps((current) => current.map((step) => step.stepId === stepId ? recordJourneyDisposition(step, {
      outcome,
      evidenceRef: `protected://shadow-disposition/${stepId}/${Date.parse(occurredAt)}`,
      nextAction,
      ownerActorId: step.ownerActorId,
      dueAt,
      capacityAffected: step.capacityNests,
      readinessProbability: outcome === "Verified ready" ? 0.9 : outcome === "No answer" ? 0.35 : 0.55,
      occurredAt,
    }) : step))
    setShadowAudit((current) => [...current, Object.freeze({ eventId: `shadow-${stepId}-${Date.parse(occurredAt)}`, stepId, outcome, occurredAt, nextAction })])
  }

  function renderStepCard(step: JourneyStep, index: number) {
    const studioAction = actionByStudioId.get(step.stepId)
    const studioLiving = livingByStudioId.get(step.stepId)
    const studioEvidence = evidenceByActionId.get(liveText(studioAction, ["action id", "id"])) ?? []
    const recordedNextAction = liveText(studioAction, ["operating objective", "title", "required evidence"])
      || liveText(studioLiving, ["next action"])
      || `${step.actionKind} ${step.candidateName}`
    const latestDisposition = studioEvidence.map((row) => liveText(row, ["verification status", "status"])).find(Boolean)
      || liveText(studioAction, ["state", "status"])
      || liveText((liveData?.studios ?? []).find((row: Record<string, unknown>) => liveText(row, ["studio id"]) === step.stepId), ["readiness status"])
      || "Not recorded"
    const isOverdue = Boolean(liveData && asOfTimestamp && step.dueAt && Date.parse(step.dueAt) < Date.parse(asOfTimestamp) && !["Verified ready", "Closed"].includes(step.state))
    const fields = [
      { label: "Capacity", value: `${step.capacityNests} Nests` },
      { label: "Owner", value: liveData ? personLabel(step.ownerActorId) : step.ownerActorId },
      { label: isOverdue ? "Overdue since" : "Due", value: <time dateTime={step.dueAt}>{date(step.dueAt)}</time> },
      { label: "Latest disposition", value: liveData ? latestDisposition : step.history.at(-1)?.outcome ?? "No disposition yet" },
    ]
    const localControl = <div className="enterprise-shadow-control"><TokenSelect ariaLabel={`Disposition for ${step.candidateName}`} disabled={step.state === "Ring 2 gated" || step.humanApprovalRequired} value={selectedOutcomes[step.stepId] ?? "No answer"} options={ENTERPRISE_DEMAND_DISPOSITIONS} onChange={(outcome) => setSelectedOutcomes((current) => ({ ...current, [step.stepId]: outcome }))} /><button type="button" disabled={step.state === "Ring 2 gated" || step.humanApprovalRequired} onClick={() => recordShadowOutcome(step.stepId)}>Record</button><small>{step.state === "Ring 2 gated" ? "Ring 1 must close first" : step.humanApprovalRequired ? "Human approval required" : "Local preview only"}</small></div>
    return <OperationalCard key={step.stepId} title={`${index + 1}. ${step.actionKind} · ${step.candidateName}`} domain={`${step.supplyModel} · ${step.playbook} · ${step.distanceKm} km · ${step.ring}`} status={step.state} progress={actionStageFromStatus(step.state)} action={recordedNextAction} description={liveData ? undefined : <p>{recordedNextAction}</p>} fields={fields}>{liveData ? null : localControl}</OperationalCard>
  }

  const journeyBySegment = JOURNEY_SEGMENT_ORDER.map((segment) => ({
    segment,
    entries: steps.map((step, index) => ({ step, index })).filter((entry) => segmentForStep(entry.step) === segment),
  })).filter((group) => group.entries.length > 0)

  const demandId = liveText(demand, ["demand id"])
  const enterpriseId = liveText(demand, ["enterprise id"])
  const enterpriseName = liveText(demand, ["enterprise name"]) || "Named enterprise"
  const enterpriseIncidentRows = incidentRows.filter((row) => {
    const domain = liveText(row, ["domain", "incident type"]).toLowerCase()
    return domain.includes("enterprise demand")
      || Boolean(demandId && liveText(row, ["demand id"]) === demandId)
      || Boolean(enterpriseId && liveText(row, ["enterprise id"]) === enterpriseId)
  })
  const enterpriseIncidentIds = new Set(enterpriseIncidentRows.map((row) => liveText(row, ["incident id", "id"])).filter(Boolean))
  const approvalActionIds = new Set(livePolicyApprovals.map((approval) => approval.linkedActionId).filter(Boolean))
  const liveExceptionActions = actionRows.filter((row) => {
    const actionId = liveText(row, ["action id", "id"])
    const incidentId = liveText(row, ["incident id"])
    const description = [liveText(row, ["operating objective", "title"]), liveText(row, ["expected metric"]), liveText(row, ["required evidence"])].join(" ").toLowerCase()
    const state = liveText(row, ["state", "status"]).toLowerCase()
    return !/closed|resolved|verified|dismissed/.test(state)
      && (approvalActionIds.has(actionId) || enterpriseIncidentIds.has(incidentId) || /enterprise demand|named demand|headcount|matching/.test(description))
  })
  const actionByIncidentId = new Map(liveExceptionActions.map((row) => [liveText(row, ["incident id"]), row]).filter(([incidentId]) => Boolean(incidentId)))
  const studioNameById = new Map((liveData?.studios ?? []).map((row: Record<string, unknown>) => [liveText(row, ["studio id"]), liveText(row, ["studio name", "studio id"])]).filter(([studioId]) => Boolean(studioId)))
  const liveExceptions: Array<{
    exceptionId: string
    issue: string
    owner: string
    dueAt: string
    status: string
    action: string
    why: string
    did: string
    next: string
  }> = []

  if (liveData) for (const shortfallDemand of portfolioShortfallRows) {
    const shortfallDemandId = liveText(shortfallDemand, ["demand id"])
    const shortfallEnterpriseId = liveText(shortfallDemand, ["enterprise id"])
    const shortfallEnterpriseName = liveText(shortfallDemand, ["enterprise name", "plant name"]) || "Named enterprise"
    const required = sheetNumber(shortfallDemand["headcount required"])
    const shortfallOwnerId = liveText(shortfallDemand, ["owner actor id", "owner"])
    const shortfallOwner = personLabel(shortfallOwnerId)
    const shortfallDueAt = validTimestamp(shortfallDemand["activation required at"]) || asOfTimestamp
    liveExceptions.push({
      exceptionId: `demand-shortfall-${shortfallDemandId || shortfallEnterpriseId || liveExceptions.length}`,
      issue: `${required} potential Nests · ${shortfallEnterpriseName}`,
      owner: shortfallOwner,
      dueAt: shortfallDueAt,
      status: `Lead · ${required} potential Nests`,
      action: "Advance the Lead to Contracting",
      why: `${required} potential Nests remain in the FONO Funnel Lead stage.`,
      did: `Read the Lead stage and ${required} Nests Potential directly from the FONO Funnel row.`,
      next: `Advance the commercial stage and record the next action before ${shortfallDueAt ? date(shortfallDueAt) : "the recorded deadline"}.`,
    })
  }

  if (liveData) {
    for (const approval of livePolicyApprovals.filter((row) => row.pending)) {
      liveExceptions.push({
        exceptionId: `approval-${approval.approvalId}`,
        issue: liveText(approval.actionRow, ["operating objective", "title"]) || approval.title,
        owner: approval.owner,
        dueAt: validTimestamp(approval.dueAt) || arrivalTimestamp || asOfTimestamp,
        status: `${approval.decision} human approval`,
        action: "Review and decide",
        why: approval.businessReason || "This governed exception cannot proceed without the recorded named authority.",
        did: `Recorded ${approval.approvalId} and routed it to ${approval.owner}.`,
        next: approval.expectedResult ? `Approve or reject the proposed terms for: ${approval.expectedResult}.` : "Record the authorised approval decision in Approval_Log.",
      })
    }

    for (const incident of enterpriseIncidentRows) {
      const state = liveText(incident, ["state", "status"]) || "Open"
      if (/closed|resolved|dismissed/.test(state.toLowerCase())) continue
      const incidentId = liveText(incident, ["incident id", "id"])
      const incidentAction = actionByIncidentId.get(incidentId)
      if (incidentAction && approvalActionIds.has(liveText(incidentAction, ["action id", "id"]))) continue
      const studioId = liveText(incident, ["studio id"])
      const studioName = studioNameById.get(studioId) || studioId || "Studio not recorded"
      const ownerId = liveText(incidentAction, ["owner actor id", "owner"]) || liveText(incident, ["owner actor id", "owner"])
      const severity = liveText(incident, ["severity"])
      const objective = liveText(incidentAction, ["operating objective", "title"]) || liveText(incident, ["short description"]) || "Resolve enterprise demand incident"
      liveExceptions.push({
        exceptionId: `incident-${incidentId}`,
        issue: `${liveText(incident, ["incident type"]) || "Enterprise demand issue"} · ${studioName}`,
        owner: personLabel(ownerId),
        dueAt: validTimestamp(incidentAction?.["due at"]) || validTimestamp(incident["due at"]) || arrivalTimestamp || asOfTimestamp,
        status: [severity, state].filter(Boolean).join(" · "),
        action: objective,
        why: liveText(incident, ["severity reason", "short description"]) || "The open incident affects the named enterprise readiness plan.",
        did: `Linked ${incidentId}${incidentAction ? ` to ${liveText(incidentAction, ["action id", "id"])}` : " to the current demand plan"} and assigned ${personLabel(ownerId)}.`,
        next: liveText(incidentAction, ["required evidence"]) || "Resolve the incident and submit independent readiness evidence.",
      })
    }
  }

  const displayedExceptions = liveData ? liveExceptions : preview.exceptions.map((exception) => ({
    ...exception,
    status: exception.progress,
    action: "Submit independently verified proof",
    why: "The signed enterprise arrival cannot be counted as ready while this exception remains open.",
    did: `Created the exception and assigned ${exception.owner}.`,
    next: "Close the readiness gap and submit contract-matched proof for independent verification.",
  }))

  const enterpriseAuditActions = actionRows.filter((row) => {
    const actionId = liveText(row, ["action id", "id"])
    const incidentId = liveText(row, ["incident id"])
    const description = [liveText(row, ["operating objective", "title"]), liveText(row, ["expected metric"]), liveText(row, ["required evidence"])].join(" ").toLowerCase()
    return approvalActionIds.has(actionId) || enterpriseIncidentIds.has(incidentId) || /enterprise demand|named demand|headcount|matching/.test(description)
  })
  const enterpriseAuditActionIds = new Set(enterpriseAuditActions.map((row) => liveText(row, ["action id", "id"])).filter(Boolean))
  const enterpriseAuditEvidence = evidenceRows.filter((row) => enterpriseAuditActionIds.has(liveText(row, ["linked id"])))
  const backgroundEvents = liveData ? [
    ...enterpriseIncidentRows.map((row, index) => ({
      id: `incident-${liveText(row, ["incident id", "id"]) || index}`,
      kind: `Incident · ${liveText(row, ["state", "status"]) || "Recorded"}`,
      detail: liveText(row, ["short description", "incident type"]) || "Enterprise Demand incident",
      at: latestTimestamp([row]) || asOfTimestamp,
    })),
    ...enterpriseAuditActions.map((row, index) => ({
      id: `action-${liveText(row, ["action id", "id"]) || index}`,
      kind: `Action · ${liveText(row, ["state", "status"]) || "Recorded"}`,
      detail: liveText(row, ["operating objective", "title"]) || "Enterprise Demand action",
      at: latestTimestamp([row]) || asOfTimestamp,
    })),
    ...enterpriseAuditEvidence.map((row, index) => ({
      id: `evidence-${liveText(row, ["evidence id", "id"]) || index}`,
      kind: `Evidence · ${liveText(row, ["verification status", "status"]) || "Recorded"}`,
      detail: liveText(row, ["evidence type", "evidence id", "id"]) || "Readiness evidence",
      at: latestTimestamp([row]) || asOfTimestamp,
    })),
    ...livePolicyApprovals.map((approval) => ({
      id: `approval-${approval.approvalId}`,
      kind: `Approval · ${approval.decision}`,
      detail: `${approval.title} · ${approval.owner}`,
      at: latestTimestamp([approval.approvalRow]) || validTimestamp(approval.decidedAt) || asOfTimestamp,
    })),
  ].filter((event) => event.at).sort((left, right) => Date.parse(right.at) - Date.parse(left.at)) : []
  const pendingEnterpriseApprovals = livePolicyApprovals.filter((approval) => approval.pending).length
  const openEnterpriseIncidents = enterpriseIncidentRows.filter((row) => !/closed|resolved|dismissed/.test(liveText(row, ["state", "status"]).toLowerCase())).length
  const pendingEnterpriseEvidence = enterpriseAuditEvidence.filter((row) => !/verified|accepted|confirmed|closed/.test(liveText(row, ["verification status", "status"]).toLowerCase())).length
  const backgroundSummary = liveData
    ? `${backgroundEvents.length} Sheet audit events · governed controls retained`
    : `${shadowAudit.length} local dispositions · policies retained`
  const decisionGap = hasLiveSnapshot ? portfolioGapNests : preview.activeNode.readinessGap
  const decisionSummary = !demand && hasLiveSnapshot ? "No matching demand decision" : decisionGap > 0 ? `${decisionGap} potential Nests across ${portfolioShortfallRows.length} FONO Leads` : "No FONO Lead-stage potential recorded"
  const decisionHeadline = !demand && hasLiveSnapshot
    ? "No Enterprise Demand decision is required for the selected filters."
    : decisionGap > 0
    ? `Advance ${decisionGap} potential Nests across ${portfolioShortfallRows.length} FONO Lead-stage opportunities.`
    : `No FONO Lead-stage potential requires advancement.`
  const decisionDetail = hasLiveSnapshot
    ? !demand
      ? "No matching signed demand, governed action, or arrival deadline is available; the dashboard will update automatically when a matching Sheet row is recorded."
      : decisionGap > 0
      ? portfolioShortfallRows.length > 1
        ? `${portfolioShortfallRows.length} Lead-stage rows contain ${portfolioTargetNests} potential Nests; Contracting, Contracted and Onboarded supply (${portfolioSupplyNests} Nests) is shown separately and is not subtracted. Current occupancy is excluded.`
        : ring2Unlocked
        ? `${ring1PotentialNests} Ring 1 Nests do not cover the ${decisionGap}-Nest gap, so the calculated Ring 2 search is open; ${ownerLabel} remains accountable until verified capacity is confirmed.`
        : `${ring1PotentialNests} Ring 1 Nests cover the ${decisionGap}-Nest gap, so the calculated Ring 2 search remains closed; ${ownerLabel} remains accountable until verified capacity is confirmed.`
      : `No readiness gap remains; the recorded evidence and arrival outcome remain visible for independent verification.`
    : "Approve the ordered 2 km plan; the 5 km search stays closed and accountability sits with Ops Control until verified capacity is confirmed."
  const decisionDueAt = arrivalTimestamp || asOfTimestamp || preview.activeNode.arrivalAt
  const decisionOwnerLabel = hasLiveSnapshot && portfolioShortfallRows.length > 1 ? "Named row owners" : ownerLabel
  const ownerDisplay = (row: Record<string, unknown>) => {
    const ownerId = liveText(row, ["owner actor id", "owner"])
    const resolved = personLabel(ownerId)
    if (resolved && resolved !== ownerId) return resolved
    if (ownerId.startsWith("ACT-")) return ownerId.slice(4).toLowerCase().replace(/(^|-)\w/g, (match) => match.replace("-", " ").toUpperCase())
    return ownerId || "Unassigned"
  }
  const fonoOwnerBreakdown = [...portfolioShortfallRows.reduce<Map<string, { leads: number; nests: number }>>((totals, row) => {
    const owner = ownerDisplay(row)
    const current = totals.get(owner) || { leads: 0, nests: 0 }
    totals.set(owner, { leads: current.leads + 1, nests: current.nests + sheetNumber(row["headcount required"]) })
    return totals
  }, new Map()).entries()].map(([owner, totals]) => ({ owner, ...totals })).sort((left, right) => right.nests - left.nests)
  const spOutstandingRows = demandRows.filter((row) => demandSupplyModel(row) === "SP" && !/closed|lost|cancelled|dismissed/.test(liveText(row, ["status", "certainty"]).toLowerCase()))
  const spOwnerBreakdown = [...spOutstandingRows.reduce<Map<string, number>>((totals, row) => {
    const owner = ownerDisplay(row)
    totals.set(owner, (totals.get(owner) || 0) + 1)
    return totals
  }, new Map()).entries()].map(([owner, leads]) => ({ owner, leads })).sort((left, right) => right.leads - left.leads)
  const connectedSourceFeeds = liveData ? [
    { name: "Enterprise_Demand", rows: liveData.enterpriseDemand },
    { name: "Studio_Master", rows: liveData.studios },
    { name: "Living_Hourly", rows: liveData.living },
    { name: "Member_Activation", rows: liveData.activations },
    { name: "Action_Log", rows: liveData.actions },
    { name: "Evidence_Log", rows: liveData.evidence },
    { name: "Incident_Log", rows: liveData.incidents },
    { name: "Approval_Log", rows: liveData.approvals },
    { name: "People_Roster", rows: liveData.people },
  ].filter((feed) => Array.isArray(feed.rows) && feed.rows.length > 0) : []
  const staleSourceFeeds = loopHealth.feeds.filter((feed) => feed.stale).length
  const sourceSummary = liveData
    ? `${connectedSourceFeeds.length} connected Sheet feeds · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} outcomes verified`
    : `${preview.source.name} · synthetic shadow`
  const sourceDetail = liveData
    ? `${connectedSourceFeeds.map((feed) => feed.name).join(" · ")} · as of ${date(asOfTimestamp || preview.source.asOf)}`
    : `${preview.source.name} · as of ${date(preview.source.asOf)} · protected references only · synthetic/shadow`
  const confidenceDetail = liveData
    ? `${loopHealth.state} · ${staleSourceFeeds} stale · ${loopHealth.verification.awaiting} awaiting verification · ${loopHealth.verification.reopened} reopened · read-only; no automated external action`
    : "RafiQi Inside may summarise later; Ops Control owns execution and verified closure."

  return <DashboardSectionAccordion className="enterprise-demand-loop" ariaLabel="Enterprise Demand sections" sections={[
    { title: "Today’s task", summary: verdictLabel },
    { title: "Loop health", summary: `${loopHealth.state} · ${loopHealth.verification.verified}/${loopHealth.verification.claimed} verified` },
    { title: "Key numbers", summary: `${preview.activeNode.verifiedReadyNests}/${preview.activeNode.committedNests} Nests verified ready` },
    { title: "Arrival implication", summary: arrivalImplicationSummary },
    { title: "Nearby plan and next action", summary: `Ring 1 has ${ring1PotentialNests} Nests · ${nextStep?.actionKind ?? "waiting"}` },
    { title: "Progress by channel", summary: channelProgressSummary },
    { title: "Calls and visits", summary: `${steps.length} Studio candidates · 2 km first${liveData ? " · Sheet-driven" : ""}` },
    { title: "Issues needing help", summary: `${displayedExceptions.length} human-owned exceptions` },
    { title: "Background record", summary: backgroundSummary },
    { title: "Decision required", summary: decisionSummary },
    { title: "Source and confidence", summary: sourceSummary },
  ]}>
    <section className="enterprise-today-task" aria-labelledby="enterprise-today-title">
      <div>
        <span>{taskSourceLabel}</span>
        <h2 id="enterprise-today-title">{preview.headline}</h2>
        <p className="enterprise-governing">{taskGoverningCopy}</p>
      </div>
      <b className="enterprise-verdict" data-state={behind ? "behind" : "on-track"}>{verdictLabel}</b>
      <dl>
        <div><dt>Owner</dt><dd>{ownerLabel}</dd></div>
        <div><dt>Progress</dt><dd>{taskProgressPercent}% · {taskState}</dd></div>
        <div><dt>Verified result</dt><dd>{preview.activeNode.verifiedReadyNests}/{preview.activeNode.committedNests} Nests</dd></div>
      </dl>
    </section>

    <LoopHealthStrip health={loopHealth} />

    <section className={`enterprise-headline-measures${loopHealth.feeds.some((feed) => feed.stale) ? " has-stale-input" : ""}`} aria-label="Key numbers at glance">
      <article><span>Signed target</span><strong>{preview.activeNode.committedNests}</strong><small>Nests · {demandReference}</small></article>
      <ChevronRight aria-hidden />
      <article><span>Verified ready</span><strong>{preview.activeNode.verifiedReadyNests}</strong><small>{liveData ? `FONO ${selectedReadyBySupply.FONO} · SP ${selectedReadyBySupply.SP}` : `FONO ${preview.activeNode.verifiedReadyBySupply.FONO} · SP ${preview.activeNode.verifiedReadyBySupply.SP}`}</small></article>
      <ChevronRight aria-hidden />
      <article className="is-gap"><span>Gap to close</span><strong>{preview.activeNode.readinessGap}</strong><small>{liveData ? daysToArrival === null ? "Arrival date not recorded" : daysToArrival > 0 ? `${daysToArrival} days to arrival` : "Arrival due" : `${preview.activeNode.daysToArrival} days to arrival`}</small></article>
      <ChevronRight aria-hidden />
      <article><span>Required run rate</span><strong>{liveData ? requiredRunRate : `${Math.ceil((preview.activeNode.dailyPlan.plannedStops + preview.activeNode.dailyPlan.missedStopsCarried - preview.activeNode.dailyPlan.completedStops) / 6)} Nests/hour`}</strong><small>{liveData ? overdueFollowUps : preview.activeNode.dailyPlan.missedStopsCarried} missed follow-ups rolled forward</small></article>
    </section>
    <p className="enterprise-so-what">{arrivalImplicationDetail}</p>

    <div className="enterprise-first-viewport">
      <section className="enterprise-primary-panel enterprise-plan-panel" aria-labelledby="enterprise-plan-title">
        <header><div><span>Space available nearby</span><h2 id="enterprise-plan-title">{ring1PotentialNests} Nests available within 2 km</h2></div><p>Gap {preview.activeNode.readinessGap} · 5 km search {ring2Unlocked ? "open" : "closed"}</p></header>
        <RingPlan steps={steps} live={Boolean(liveData)} />
        <p className="enterprise-so-what">{nearbyPlanImplication}</p>
      </section>

      <section className="enterprise-primary-panel enterprise-progress-panel" aria-labelledby="enterprise-progress-title">
        <header><div><span>Do this next</span><h2 id="enterprise-progress-title">{nextStep ? `${nextStep.actionKind} ${nextStep.candidateName}` : "No action ready"}</h2></div><p>{nextStep ? `${ownerLabel} · due ${date(nextStep.dueAt)}` : "Waiting for coordinate-qualified capacity"}</p></header>
        <PizzaProgress preview={progressPreview} />
        <p className="enterprise-so-what">{liveData ? `So what: ${liveProgress.filter((stage) => stage.complete).length} of 8 stages are complete; only Sheet-recorded evidence, verified capacity, arrivals and billing advance the plan.` : "So what: only verified-and-billing stages count as done, so early-stage progress does not yet reduce the arrival risk."}</p>
      </section>
    </div>

    <section className="enterprise-supply-lanes" aria-labelledby="enterprise-lanes-title">
      <header><div><span>Progress by channel</span><h2 id="enterprise-lanes-title">FONO and SP tracked separately</h2></div><p>Contract readiness by channel</p></header>
      {supplyLanes.map((lane) => <article data-supply-lane={lane.supplyModel} key={lane.supplyModel}>
        <strong>{lane.supplyModel}</strong>
        <ol>{lane.stages.map((stage, index) => <li key={stage.label}><span>{stage.label}</span><b>{stage.count}</b>{index < lane.stages.length - 1 ? <ChevronRight aria-hidden /> : null}</li>)}</ol>
      </article>)}
      <p className="enterprise-so-what">{channelProgressImplication}</p>
    </section>

    <section className="enterprise-work-panel" aria-labelledby="enterprise-work-title">
      <header><div><span>Calls and visits plan</span><h2 id="enterprise-work-title">{steps.length} Studio candidates in the calculated plan</h2></div><p>2 km first · {liveData ? "Sheet-driven plan" : "preview only"}</p></header>
      {steps.length > 0 ? <div className="enterprise-journey-segments">{journeyBySegment.map((group) => <ActionSegment key={group.segment} segment={group.segment} count={group.entries.length}>{group.entries.map((entry) => renderStepCard(entry.step, entry.index))}</ActionSegment>)}</div> : <div className="enterprise-empty-state"><LockKeyhole aria-hidden /><strong>No eligible calls or stops.</strong><span>Quarantine, evidence and safety reasons remain visible in audit details.</span></div>}
    </section>

    <section className="enterprise-exceptions" aria-labelledby="enterprise-exceptions-title">
      <header><div><span>Issues needing your help</span><h2 id="enterprise-exceptions-title">{displayedExceptions.length} issues need human help</h2></div><p>{liveData ? "Google Sheet · automatically derived" : "Ops Control owns closure"}</p></header>
      {displayedExceptions.length > 0 ? <OperationalCardStack label="All Enterprise Demand exceptions">{displayedExceptions.map((exception) => <OperationalCard key={exception.exceptionId} title={exception.issue} status={exception.status} domain="Enterprise Demand" action={exception.action} fields={[{ label: "Owner", value: exception.owner }, { label: "Due", value: <time dateTime={exception.dueAt}>{date(exception.dueAt)}</time> }]} progress={actionStageFromStatus(exception.status)} story={[{ label: "Why it matters", value: exception.why }, { label: "What Nia already did", value: exception.did }, { label: "What happens next", value: exception.next }]} />)}</OperationalCardStack> : <div className="enterprise-empty-state"><Check aria-hidden /><strong>No open Enterprise Demand exception.</strong><span>The section will repopulate automatically when a Sheet-backed shortfall, incident, or approval needs human help.</span></div>}
    </section>

    <details className="enterprise-audit-details">
      <summary><FileCheck2 aria-hidden />Full background record</summary>
      <div className="enterprise-audit-body">
        <section><h2>Contract-specific readiness</h2><dl>{liveData ? <><div><dt>Enterprise / plant</dt><dd>{enterpriseName} · {liveText(demand, ["plant name", "plant", "location"]) || "Plant not recorded"}</dd></div><div><dt>Demand reference</dt><dd>{demandReference}</dd></div><div><dt>Role / shift</dt><dd>{liveText(demand, ["role required", "role"]) || "Role not recorded"} / {liveText(demand, ["shift"]) || "Shift not recorded"}</dd></div><div><dt>Signed / ready</dt><dd>{committedNests} / {verifiedReadyNests} Nests</dd></div><div><dt>Status</dt><dd>{liveText(demand, ["certainty", "demand certainty"]) || "Certainty not recorded"} / {liveText(demand, ["status", "state"]) || "Status not recorded"}</dd></div><div><dt>Arrival</dt><dd>{arrivalTimestamp ? date(arrivalTimestamp) : "Arrival not recorded"}</dd></div></> : <><div><dt>Enterprise / plant</dt><dd>{preview.activeNode.enterpriseName} · {preview.activeNode.plantName}</dd></div><div><dt>Signed contract</dt><dd>{preview.activeNode.contractId}</dd></div><div><dt>Services</dt><dd>{preview.activeNode.contractedServices.join(", ") || "No additional contracted services"}</dd></div><div><dt>Spec / terms</dt><dd>{preview.activeNode.specStatus} / {preview.activeNode.termsStatus}</dd></div><div><dt>Plant reference</dt><dd>{preview.activeNode.plantReference}</dd></div><div><dt>Arrival</dt><dd>{date(preview.activeNode.arrivalAt)}</dd></div></>}</dl></section>
        <section><h2>{liveData ? "Calculated plan and evidence controls" : "Priority overrides and field safety"}</h2>{liveData ? <><ol><li><b>1</b><span>{ring1PotentialNests} Ring 1 Nests recorded</span></li><li><b>2</b><span>{preview.activeNode.readinessGap} Nests remain to be independently verified</span></li><li><b>3</b><span>Ring 2 search {ring2Unlocked ? "open" : "closed"} by the calculated capacity rule</span></li><li><b>4</b><span>{steps.length} Studio candidates in the Sheet-driven plan</span></li><li><b>5</b><span>{pendingEnterpriseEvidence} linked evidence records await verification</span></li></ol><p>{pendingEnterpriseApprovals} named approvals pending · no duplicate Operations input.</p></> : <><ol>{preview.protectedPriorities.map((priority, index) => <li key={priority}><b>{index + 1}</b><span>{priority}</span></li>)}<li><b>5</b><span>Enterprise Demand journey plan</span></li></ol><p>Approved daylight hours · three check-ins · no trespass · consent before non-public access · hazard controls · no unsafe solo visit · emergency stop-work path.</p></>}</section>
        <section><h2>Governed registry</h2><div className="enterprise-audit-table"><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Source</th></tr></thead><tbody>{liveData ? (livePolicyApprovals.length ? livePolicyApprovals.map((approval) => <tr key={approval.approvalId}><td>{approval.title}</td><td>{approval.proposedTerms || approval.expectedResult || "No value recorded"}</td><td>{approval.approvalId}</td><td>Approval_Log · {approval.decision}</td></tr>) : <tr><td>No linked approval</td><td>No Approval_Log record</td><td>—</td><td>Not recorded</td></tr>) : preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.policyId}</td><td>{policy.value} {policy.unit}</td><td>v{policy.version}</td><td>{policy.source}</td></tr>)}</tbody></table></div></section>
        <section><h2>{liveData ? "Append-only Sheet audit" : "Append-only synthetic audit"}</h2>{liveData ? (backgroundEvents.length > 0 ? <ol>{backgroundEvents.map((event) => <li key={event.id}><b>{event.kind}</b><span>{event.detail}</span><time dateTime={event.at}>{date(event.at)}</time></li>)}</ol> : <p>No Enterprise Demand audit event recorded in the connected Sheet feeds.</p>) : (shadowAudit.length > 0 ? <ol>{shadowAudit.map((event) => <li key={event.eventId}><b>{event.outcome}</b><span>{event.stepId} · {event.nextAction}</span><time dateTime={event.occurredAt}>{date(event.occurredAt)}</time></li>)}</ol> : <p>No local shadow disposition recorded.</p>)}</section>
        <section><h2>Structural action boundary</h2>{liveData ? <><p>{openEnterpriseIncidents} open Enterprise Demand incidents · {enterpriseAuditActions.length} governed actions · {pendingEnterpriseApprovals} named approvals pending.</p><p>RafiQi calculates, ranks and displays the recorded plan; Approval_Log remains the authority for governed decisions, and no duplicate Operations entry is required in this component.</p></> : <><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>Pricing and terms deviations route to Pushkar. RafiQi identifies, assigns, follows up and verifies in shadow state; it cannot message, call, contract, pay, commit capital, assign live routes, track GPS or write Production.</p></>}</section>
      </div>
    </details>

    <section className="enterprise-ask" aria-label="Decision required">
      <div>
        <span>Decision required</span>
        <strong>{decisionHeadline}</strong>
        <p>{decisionDetail}</p>
      </div>
      {liveData ? <div className="enterprise-owner-breakdown" aria-label="Outstanding leads by channel and owner">
        <section><b>FONO · Lead stage</b>{fonoOwnerBreakdown.length ? <ul>{fonoOwnerBreakdown.map((item) => <li key={`fono-${item.owner}`}><span>{item.owner}</span><strong>{item.leads} leads · {item.nests} Nests</strong></li>)}</ul> : <p>No outstanding FONO Leads</p>}</section>
        <section><b>SP · Follow-ups open</b>{spOwnerBreakdown.length ? <ul>{spOwnerBreakdown.map((item) => <li key={`sp-${item.owner}`}><span>{item.owner}</span><strong>{item.leads} leads</strong></li>)}</ul> : <p>No outstanding SP follow-ups</p>}</section>
      </div> : null}
      <dl>
        <div><dt>Owner</dt><dd>{liveData ? decisionOwnerLabel : preview.activeNode.ownerActorId}</dd></div>
        <div><dt>By</dt><dd><time dateTime={decisionDueAt}>{date(decisionDueAt)}</time></dd></div>
      </dl>
    </section>

    <footer className="enterprise-source-note"><ShieldCheck aria-hidden /><span>{sourceDetail}</span><Clock3 aria-hidden /><span>{confidenceDetail}</span></footer>
  </DashboardSectionAccordion>
}
