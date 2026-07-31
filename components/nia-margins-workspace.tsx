import { LoopHealthStrip } from "@/components/loop-health-strip"
import { MeasureViz } from "@/components/measure-viz"
import type { NiaMarginsPreview } from "@/lib/operating-loop/nia-margins-loop"
import { dashboardDisplayLabel } from "@/lib/dashboard-model"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import styles from "@/components/nia-margins-workspace.module.css"
import { approvalsForDomain } from "@/lib/live-approvals"
import { buildLoopHealth } from "@/lib/operating-loop/loop-health"

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function rowText(row: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function rowNumber(row: Record<string, unknown> | undefined, ...keys: string[]) {
  const raw = rowText(row, ...keys)
  if (!raw) return null
  const value = Number(raw.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(value) ? value : null
}

function latestTimestamp(rows: readonly Record<string, unknown>[], ...keys: string[]) {
  return rows.flatMap((row) => keys.map((key) => rowText(row, key)))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || ""
}

function earliestTimestamp(rows: readonly Record<string, unknown>[], ...keys: string[]) {
  return rows.flatMap((row) => keys.map((key) => rowText(row, key)))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] || ""
}

export function NiaMarginsWorkspace({ preview, liveData }: { preview: NiaMarginsPreview; liveData?: any }) {
  const isLive = Boolean(liveData)
  const financeRows = Array.isArray(liveData?.finance) ? liveData.finance as Record<string, unknown>[] : []
  const livingRows = Array.isArray(liveData?.living) ? liveData.living as Record<string, unknown>[] : []
  const actionRows = Array.isArray(liveData?.actions) ? liveData.actions as Record<string, unknown>[] : []
  const evidenceRows = Array.isArray(liveData?.evidence) ? liveData.evidence as Record<string, unknown>[] : []
  const policyRows = Array.isArray(liveData?.policies) ? liveData.policies as Record<string, unknown>[] : []
  const peopleRows = Array.isArray(liveData?.people) ? liveData.people as Record<string, unknown>[] : []
  const studioRows = Array.isArray(liveData?.studios) ? liveData.studios as Record<string, unknown>[] : []
  const learningRows = Array.isArray(liveData?.learningHistory) ? liveData.learningHistory as Record<string, unknown>[] : []
  const latestFinanceDate = financeRows.map((row) => rowText(row, "business date", "updated at", "reported at")).filter(Boolean).sort((left, right) => (Date.parse(right) || 0) - (Date.parse(left) || 0))[0] || ""
  const currentFinanceRows = latestFinanceDate ? financeRows.filter((row) => rowText(row, "business date", "updated at", "reported at") === latestFinanceDate) : []
  const recordedCm2Rows = currentFinanceRows.filter((row) => rowNumber(row, "cm2 inr") !== null)
  const totalCm2Inr = recordedCm2Rows.reduce((sum, row) => sum + (rowNumber(row, "cm2 inr") ?? 0), 0)
  const occupiedNests = livingRows.reduce((sum, row) => sum + (rowNumber(row, "occupied nests") ?? 0), 0)
  const liveFullUseCm2Inr = recordedCm2Rows.length && occupiedNests > 0 ? Math.round(totalCm2Inr / occupiedNests) : null
  const marginPolicy = policyRows.find((row) => {
    const descriptor = `${rowText(row, "policy id")} ${rowText(row, "policy name", "name")} ${rowText(row, "source note")}`.toLowerCase()
    return /nia margin|full.?use cm2|margin control/.test(descriptor) && rowText(row, "status").toLowerCase() === "approved"
  })
  const liveFullUseTargetInr = rowNumber(marginPolicy, "policy value", "value")
  const marginActions = actionRows.filter((row) => /nia margin|cm1|cm2|unit economics|margin recovery/.test(`${rowText(row, "operating objective", "title")} ${rowText(row, "expected metric")}`.toLowerCase()))
  const marginActionIds = new Set(marginActions.map((row) => rowText(row, "action id", "id")).filter(Boolean))
  const marginEvidence = evidenceRows.filter((row) => marginActionIds.has(rowText(row, "linked id")))
  const verifiedMarginOutcomes = marginEvidence.filter((row) => ["verified", "approved", "accepted"].includes(rowText(row, "verification status", "status").toLowerCase())).length
  const reopenedMarginOutcomes = marginEvidence.filter((row) => ["reopened", "rejected", "failed"].includes(rowText(row, "verification status", "status").toLowerCase())).length
    + marginActions.filter((row) => ["reopened", "escalated", "failed"].includes(rowText(row, "state", "status").toLowerCase())).length
  const claimedMarginOutcomes = Math.max(marginActions.length, marginEvidence.length)
  const awaitingMarginOutcomes = Math.max(0, claimedMarginOutcomes - verifiedMarginOutcomes - reopenedMarginOutcomes)
  const asOf = rowText(liveData, "asOf") || new Date().toISOString()
  const feedDefinitions = [
    { id: "FINANCE-DAILY", label: "Finance CM2", rows: financeRows.filter((row) => rowText(row, "finance daily id") && latestTimestamp([row], "updated at", "reported at", "business date")), cadence: 1_440, claims: ["Recorded CM2"] },
    { id: "LIVING-HOURLY", label: "Living occupancy", rows: livingRows.filter((row) => rowText(row, "living hourly id") && latestTimestamp([row], "updated at", "captured at")), cadence: 240, claims: ["Occupied Nests"] },
    { id: "WORK-HOURLY", label: "Work contribution", rows: (Array.isArray(liveData?.work) ? liveData.work as Record<string, unknown>[] : []).filter((row) => rowText(row, "work hourly id") && latestTimestamp([row], "updated at", "captured at")), cadence: 240, claims: ["Work CM2"] },
    { id: "ESSENTIALS-HOURLY", label: "Essentials contribution", rows: (Array.isArray(liveData?.essentials) ? liveData.essentials as Record<string, unknown>[] : []).filter((row) => rowText(row, "essentials hourly id") && latestTimestamp([row], "updated at", "captured at")), cadence: 240, claims: ["Essentials CM2"] },
  ]
  const baseLiveMarginHealth = isLive ? buildLoopHealth({
    asOf,
    feeds: feedDefinitions.filter((feed) => feed.rows.length).map((feed) => ({ feedId: feed.id, label: feed.label, lastUpdatedAt: latestTimestamp(feed.rows, "updated at", "reported at", "captured at", "business date"), cadenceMinutes: feed.cadence, critical: true, affectedClaims: feed.claims })),
    clocks: marginActions.filter((row) => rowText(row, "action id", "id") && Number.isFinite(Date.parse(rowText(row, "due at")))).map((row) => ({ clockId: `LIVE-NIA-MARGIN-${rowText(row, "action id", "id")}`, label: rowText(row, "operating objective", "title") || "Margin recovery", ownerRole: rowText(row, "owner actor id") || "No owner recorded", dueAt: rowText(row, "due at"), state: ["verified", "closed", "resolved"].includes(rowText(row, "state", "status").toLowerCase()) ? "Recovered" as const : "Running" as const })),
    verification: { claimed: claimedMarginOutcomes, verified: verifiedMarginOutcomes, awaiting: awaitingMarginOutcomes, reopened: reopenedMarginOutcomes, oldestAwaitingAt: awaitingMarginOutcomes ? earliestTimestamp([...marginEvidence, ...marginActions], "uploaded at", "proposed at", "assigned at", "updated at") || asOf : null },
    quarantinedRecords: financeRows.filter((row) => !rowText(row, "finance daily id") || rowNumber(row, "cm2 inr") === null).length,
  }) : null
  const liveMarginHealth = baseLiveMarginHealth && liveFullUseCm2Inr === null
    ? Object.freeze({
        ...baseLiveMarginHealth,
        state: "Cannot confirm" as const,
        overviewAnswerAllowed: false,
        reasons: Object.freeze([...baseLiveMarginHealth.reasons, "Finance CM2 is missing for the latest period"]),
      })
    : baseLiveMarginHealth
  const marginHealth = liveMarginHealth ?? preview.loopHealth
  const marginAction = marginActions[0]
  const liveOwnerReference = rowText(marginAction, "owner actor id") || rowText(currentFinanceRows[0], "reported by actor id")
  const liveOwnerPerson = peopleRows.find((row) => {
    const reference = liveOwnerReference.toLowerCase()
    return rowText(row, "actor id").toLowerCase() === reference
      || rowText(row, "display name", "name").toLowerCase() === reference
  })
  const recordedOwnerName = /^(yes|no|true|false)$/i.test(liveOwnerReference) ? "" : liveOwnerReference
  const contractedNests = livingRows.reduce((sum, row) => sum + (rowNumber(row, "contracted nests") ?? 0), 0)
  const liveOccupancyPct = contractedNests > 0 ? Math.round(occupiedNests / contractedNests * 1_000) / 10 : null
  const occupancyPolicy = policyRows.find((row) => {
    const descriptor = `${rowText(row, "policy id")} ${rowText(row, "policy name", "name")} ${rowText(row, "source note")}`.toLowerCase()
    return /occupancy/.test(descriptor) && rowText(row, "status").toLowerCase() === "approved"
  })
  const liveOccupancyTargetPct = rowNumber(occupancyPolicy, "policy value", "value")
  const pillarCm2 = {
    living: currentFinanceRows.some((row) => rowNumber(row, "living cm2 inr") !== null) ? currentFinanceRows.reduce((sum, row) => sum + (rowNumber(row, "living cm2 inr") ?? 0), 0) : null,
    work: currentFinanceRows.some((row) => rowNumber(row, "work cm2 inr") !== null) ? currentFinanceRows.reduce((sum, row) => sum + (rowNumber(row, "work cm2 inr") ?? 0), 0) : null,
    essentials: currentFinanceRows.some((row) => rowNumber(row, "essentials cm2 inr") !== null) ? currentFinanceRows.reduce((sum, row) => sum + (rowNumber(row, "essentials cm2 inr") ?? 0), 0) : null,
  }
  const livePillarCm2Inr = Object.values(pillarCm2).every((value) => value !== null) ? (pillarCm2.living ?? 0) + (pillarCm2.work ?? 0) + (pillarCm2.essentials ?? 0) : null
  const negativeContributionStudios = recordedCm2Rows.filter((row) => (rowNumber(row, "cm2 inr") ?? 0) < 0).length
  const recordedGrossMargins = currentFinanceRows.flatMap((row) => rowNumber(row, "studio gross margin pct", "gross margin pct") ?? [])
  const liveStudioGrossMarginPct = recordedGrossMargins.length ? Math.round(recordedGrossMargins.reduce((sum, value) => sum + value, 0) / recordedGrossMargins.length * 10) / 10 : null
  const pillarControl = (label: string) => {
    const policy = policyRows.find((row) => {
      const descriptor = `${rowText(row, "policy id")} ${rowText(row, "policy name", "name")} ${rowText(row, "source note")}`.toLowerCase()
      return descriptor.includes(label.toLowerCase()) && /cm2|margin|contribution/.test(descriptor) && rowText(row, "status").toLowerCase() === "approved"
    })
    return rowNumber(policy, "policy value", "value")
  }
  const pillarRows = [
    { label: "Living", value: isLive ? pillarCm2.living : preview.measures.pillarCm2Inr.living, target: isLive ? pillarControl("Living") : 300 },
    { label: "Work", value: isLive ? pillarCm2.work : preview.measures.pillarCm2Inr.work, target: isLive ? pillarControl("Work") : 1_000 },
    { label: "Essentials", value: isLive ? pillarCm2.essentials : preview.measures.pillarCm2Inr.essentials, target: isLive ? pillarControl("Essentials") : 200 },
  ]
  const verdictCm2Inr = isLive ? liveFullUseCm2Inr : preview.measures.fullUseCm2Inr
  const verdictTargetInr = isLive ? liveFullUseTargetInr : preview.measures.fullUseTargetInr
  const hasVerdict = verdictCm2Inr !== null && verdictTargetInr !== null
  const behind = hasVerdict ? verdictCm2Inr < verdictTargetInr : !isLive && preview.measures.fullUseCm2Inr < preview.measures.fullUseTargetInr
  const gapInr = verdictCm2Inr !== null && verdictTargetInr !== null ? Math.max(0, verdictTargetInr - verdictCm2Inr) : 0
  const verdictLabel = isLive && verdictCm2Inr === null
    ? liveOccupancyPct === null ? "Cannot calculate · CM2 and occupancy missing" : "Cannot calculate · Finance CM2 missing"
    : isLive && verdictTargetInr === null ? "Control not recorded" : behind ? `Below control · ${inr(gapInr)}/unit to recover` : "At or above control"
  const marginApproval = approvalsForDomain(liveData, "nia-margins", true)[0]
  const liveOwner = rowText(liveOwnerPerson, "display name", "name") || marginApproval?.owner || recordedOwnerName || "No owner recorded"
  const decisionOwner = isLive ? liveOwner : marginApproval?.owner || (preview.diagnoses[0] ? dashboardDisplayLabel(preview.diagnoses[0].ownerRole) : "Finance JCO")
  const decisionDue = isLive ? marginApproval?.dueAt : marginApproval?.dueAt || preview.actions[0]?.dueAt
  const decisionTitle = !isLive
    ? `Recover the ${inr(gapInr)}/unit full-use CM2 gap by verifying the attributed Studio actions.`
    : marginApproval
      ? marginApproval.title
      : verdictCm2Inr === null
        ? liveOccupancyPct === null ? "Record current CM2 and occupancy before assigning a margin decision." : "Record current CM2 before assigning a margin decision."
        : verdictTargetInr === null
          ? "Record and approve the per-unit CM2 control before assigning recovery."
          : behind
            ? `Recover the ${inr(gapInr)}/unit full-use CM2 gap by verifying the attributed Studio actions.`
            : "No CM2 recovery decision is required while the approved control is met."
  const decisionReason = !isLive
    ? `Recovery closes only on protected billed-revenue and direct-cost proof; accountability sits with ${decisionOwner} until full-use CM2 clears the ${inr(preview.measures.fullUseTargetInr)} control.`
    : marginApproval
      ? marginApproval.businessReason || "The authorised owner records the decision in Approval_Log; no margin control or recovery claim changes automatically."
      : verdictCm2Inr === null
        ? liveOccupancyPct === null ? "Finance_Daily CM2 and Living_Hourly occupancy are missing, so a recovery gap cannot be calculated." : "Finance_Daily CM2 is missing, so a recovery gap cannot be calculated."
        : verdictTargetInr === null
          ? `Current full-use CM2 is ${inr(verdictCm2Inr)}, but Policy_Registry has no approved per-unit control; no gap is claimed.`
          : behind
            ? `Recovery closes only on protected billed-revenue and direct-cost proof; accountability sits with ${decisionOwner} until full-use CM2 clears the ${inr(verdictTargetInr)} control.`
            : `Current full-use CM2 clears the ${inr(verdictTargetInr)} approved control; continued monitoring remains read-only.`
  const verdictAnswer = !isLive ? preview.answer : verdictCm2Inr === null ? "Full-use CM2 cannot be calculated from the current Finance_Daily and Living_Hourly rows." : verdictTargetInr === null ? `Full-use CM2 is ${inr(verdictCm2Inr)}; an approved per-unit control is not recorded in Policy_Registry.` : behind ? `Full-use CM2 is ${inr(verdictCm2Inr)}, ${inr(gapInr)} below the approved ${inr(verdictTargetInr)} control.` : `Full-use CM2 is ${inr(verdictCm2Inr)}, at or above the approved ${inr(verdictTargetInr)} control.`
  const verdictQuestion = isLive ? "Does the latest recorded CM2 per occupied Nest clear the approved Policy_Registry control?" : preview.question
  const verdictProgress = isLive ? `${verifiedMarginOutcomes}/${claimedMarginOutcomes} verified` : `${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} verified`
  const verdictMode = isLive ? "Google Sheet · read-only" : preview.mode
  const liveProfitDrivers = marginActions.map((action) => {
    const studioId = rowText(action, "studio id", "studio code")
    const studio = studioRows.find((row) => rowText(row, "studio id", "studio code") === studioId)
    const ownerActorId = rowText(action, "owner actor id")
    const ownerPerson = peopleRows.find((row) => rowText(row, "actor id") === ownerActorId)
    const baseline = rowNumber(action, "baseline value")
    const target = rowNumber(action, "target value")
    const unit = rowText(action, "unit", "target unit") || "recorded units"
    return {
      id: rowText(action, "action id", "id"),
      studio: rowText(studio, "studio name", "studio") || studioId || "Studio not recorded",
      context: [rowText(studio, "supply model"), rowText(action, "state", "status")].filter(Boolean).join(" · ") || "Context not recorded",
      cause: rowText(action, "operating objective", "title") || "Operating cause not recorded",
      variance: baseline !== null && target !== null ? `${Math.abs(target - baseline).toLocaleString("en-IN")} ${unit} from recorded target` : "Baseline or target not recorded",
      owner: rowText(ownerPerson, "display name") || ownerActorId || "No owner recorded",
      route: rowText(action, "expected metric") || "Expected metric not recorded",
      state: rowText(action, "state", "status") || "State not recorded",
    }
  })
  const marginLearning = learningRows.find((row) => rowText(row, "domain").toLowerCase() === "nia margins")
  const liveEscalatedMargins = marginActions.filter((row) => ["escalated", "failed", "blocked"].includes(rowText(row, "state", "status").toLowerCase())).length
  const measureFullUseCm2 = isLive ? liveFullUseCm2Inr : preview.measures.fullUseCm2Inr
  const measureFullUseTarget = isLive ? liveFullUseTargetInr : preview.measures.fullUseTargetInr
  const measurePillarCm2 = isLive ? livePillarCm2Inr : preview.measures.pillarCm2Inr.living + preview.measures.pillarCm2Inr.work + preview.measures.pillarCm2Inr.essentials
  const measureOccupancyPct = isLive ? liveOccupancyPct : preview.measures.occupancyPct
  const measureOccupancyTargetPct = isLive ? liveOccupancyTargetPct : preview.measures.occupancyTargetPct
  const measureNegativeStudios = isLive ? recordedCm2Rows.length ? negativeContributionStudios : null : preview.measures.negativeContributionStudios
  const measureGrossMarginPct = isLive ? liveStudioGrossMarginPct : preview.measures.studioGrossMarginPct
  const headlineMeasuresSummary = `${measureFullUseCm2 === null ? "CM2 unavailable" : `${inr(measureFullUseCm2)} full-use CM2`} · ${measureOccupancyPct === null ? "occupancy unavailable" : `${measureOccupancyPct}% occupancy`}`
  const marginImplicationSummary = !isLive
    ? "The gap is concentrated in measured Studio causes."
    : measureFullUseCm2 === null
      ? "Margin implication cannot be calculated."
      : measureFullUseTarget === null
        ? "An approved CM2 control is required before calculating a gap."
        : measureFullUseCm2 >= measureFullUseTarget
          ? "No full-use CM2 gap is recorded."
          : measureOccupancyPct !== null && measureOccupancyTargetPct !== null && measureOccupancyPct < measureOccupancyTargetPct
            ? "Occupancy is a measured contributor to the CM2 gap."
            : measurePillarCm2 === null
              ? "The CM2 gap is recorded, but its pillar cause cannot be attributed."
              : "The CM2 gap requires review against the recorded pillar contribution."
  const marginImplication = !isLive
    ? "So what: the full-use CM2 gap is driven by a small number of measured Studio operating causes, not a structural pricing problem, so it is recoverable through Studio actions."
    : measureFullUseCm2 === null
      ? measureOccupancyPct === null
        ? "So what: Finance_Daily CM2 and Living_Hourly occupancy are missing, so no margin implication can be confirmed."
        : "So what: Finance_Daily CM2 is missing, so no margin implication can be confirmed."
      : measureFullUseTarget === null
        ? `So what: full-use CM2 is ${inr(measureFullUseCm2)}, but Policy_Registry has no approved per-unit control, so the page cannot claim a gap or its cause.`
        : measureFullUseCm2 >= measureFullUseTarget
          ? `So what: full-use CM2 of ${inr(measureFullUseCm2)} clears the approved ${inr(measureFullUseTarget)} control, so no recovery gap is currently recorded.`
          : measureOccupancyPct !== null && measureOccupancyTargetPct !== null && measureOccupancyPct < measureOccupancyTargetPct
            ? `So what: full-use CM2 is ${inr(measureFullUseTarget - measureFullUseCm2)} below control and occupancy is ${measureOccupancyTargetPct - measureOccupancyPct} percentage points below its approved control; occupancy is a measured contributor, but the page does not infer unrecorded pillar costs.`
            : measurePillarCm2 === null
              ? `So what: full-use CM2 is ${inr(measureFullUseTarget - measureFullUseCm2)} below control, but Finance_Daily does not record all three pillar CM2 fields, so the operating cause cannot yet be attributed.`
              : `So what: full-use CM2 is ${inr(measureFullUseTarget - measureFullUseCm2)} below control; review the recorded Living, Work, and Essentials contribution before assigning recovery.`
  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Nia Margins sections" sections={[
    { title: "Margin verdict", summary: verdictLabel },
    { title: "Loop health", summary: `${isLive && liveFullUseCm2Inr === null ? "Cannot confirm · Finance CM2 missing" : marginHealth.state} · ${marginHealth.verification.verified}/${marginHealth.verification.claimed} verified` },
    { title: "Headline measures", summary: headlineMeasuresSummary },
    { title: "Margin implication", summary: marginImplicationSummary },
    { title: "Profit drivers and learning", summary: isLive ? `${liveFullUseCm2Inr === null ? "Finance CM2 pending · " : ""}${marginActions.length} governed actions · ${liveEscalatedMargins} escalations` : `${preview.actions.length} governed actions · ${preview.despatchEscalations.length} escalations` },
    { title: "Decision required", summary: `${marginApproval ? marginApproval.title : decisionTitle} · owner ${decisionOwner}` },
  ]}>
    <header className={styles.headline}>
      <div><h2>{verdictAnswer}</h2><p>{verdictQuestion}</p></div>
      <dl>
        <div className={styles.verdictCell}><dt>Verdict</dt><dd><b className={styles.verdictPill} data-state={behind ? "behind" : "on-track"}>{verdictLabel}</b></dd></div>
        <div><dt>Owner</dt><dd>{decisionOwner}</dd></div>
        <div><dt>Progress</dt><dd>{verdictProgress}</dd></div>
        <div><dt>Mode</dt><dd>{verdictMode}</dd></div>
      </dl>
    </header>
    <LoopHealthStrip health={marginHealth} />
    <div className={styles.measures} data-kpi-group aria-label="Nia Margins measures">
      <article className={styles.measure}><span>Full-use CM2</span><strong>{measureFullUseCm2 === null ? "No data" : inr(measureFullUseCm2)}</strong>{measureFullUseCm2 !== null && measureFullUseTarget !== null ? <MeasureViz showCaption={false} value={inr(measureFullUseCm2)} target={inr(measureFullUseTarget)} /> : null}<small>{measureFullUseCm2 === null ? "CM2 not recorded in Finance_Daily" : measureFullUseTarget === null ? "Approved Policy_Registry control not recorded" : `Target ${inr(measureFullUseTarget)}`}</small></article>
      <article className={styles.measure}><span>Pillar CM2</span><strong>{measurePillarCm2 === null ? "No data" : inr(measurePillarCm2)}</strong><small>{measurePillarCm2 === null ? "Pillar CM2 fields not recorded in Finance_Daily" : "Living · Work · Essentials"}</small></article>
      <article className={styles.measure}><span>Occupancy</span><strong>{measureOccupancyPct === null ? "No data" : `${measureOccupancyPct}%`}</strong>{measureOccupancyPct !== null && measureOccupancyTargetPct !== null ? <MeasureViz showCaption={false} value={`${measureOccupancyPct}%`} target={`${measureOccupancyTargetPct}%`} /> : null}<small>{measureOccupancyTargetPct === null ? "Approved occupancy control not recorded" : `Control ${measureOccupancyTargetPct}% · ramp separate`}</small></article>
      <article className={styles.measure}><span>Studio health</span><strong>{measureNegativeStudios === null ? "No data" : measureNegativeStudios}</strong><small>{measureNegativeStudios === null ? "Studio CM2 not recorded" : `${measureNegativeStudios} negative`} · GM {measureGrossMarginPct === null ? "not recorded" : `${measureGrossMarginPct}%`}</small></article>
    </div>
    <p className={styles.soWhat}>{marginImplication}</p>
    <div className={styles.body}>
      <article className={styles.panel}>
        <h3>What’s moving profit</h3><p>Collection leakage stays in Cash &amp; Control.</p>
        <div className={styles.waterfall} aria-label="Recorded CM2 by pillar">
          {pillarRows.map((row) => <div className={styles.barRow} key={row.label}><span>{row.label}</span><div className={styles.barTrack}>{row.value !== null && row.target !== null ? <div className={styles.barFill} style={{ width: `${Math.min(100, Math.max(0, row.value / row.target * 100))}%` }} /> : null}</div><b>{row.value === null ? "Finance input pending" : inr(row.value)}</b></div>)}
        </div>
        <div className={styles.diagnoses} aria-label="Attributed Studio actions">
          {isLive ? (liveProfitDrivers.length ? liveProfitDrivers.map((item) => <div className={styles.diagnosis} key={item.id}>
            <div><strong>{item.studio}</strong><span>{item.context}</span></div>
            <div><strong>{item.cause}</strong><small>{item.variance}</small></div>
            <div><strong>{item.owner}</strong><small>{item.route}</small></div>
            <span className={styles.status}>{item.state}</span>
          </div>) : <p>No Nia Margins action is recorded in the user-input TEAM_REQ_ACTION_LOG tab.</p>) : preview.diagnoses.map((item) => <div className={styles.diagnosis} key={item.studioId}>
            <div><strong>{item.studioName}</strong><span>{item.supplyModel} · {item.ramp ? `Ramp day` : `${item.occupancyPct}% occupied`}</span></div>
            <div><strong>{item.primaryCause}</strong><small>{inr(item.studioTotalCm2GapInr)} vs control</small></div>
            <div><strong>{dashboardDisplayLabel(item.ownerRole)}</strong><small>Route to {dashboardDisplayLabel(item.routeTo)}</small></div>
            <span className={styles.status}>{item.actionState}</span>
          </div>)}
        </div>
        <div className={styles.learning} aria-label="Margin recovery evidence">
          <div><span>Action chain</span><strong>{isLive ? marginActions.length : preview.actions.length} governed actions</strong><p>Each action requires protected billed-revenue and direct-cost proof before a different actor can verify it.</p></div>
          <div><span>Recovery</span><strong>{isLive ? `${verifiedMarginOutcomes} verified · ${reopenedMarginOutcomes} reopened` : `${preview.actions.filter((action) => action.state === "Verified").length} verified · ${preview.actions.filter((action) => action.state === "Reopened").length} reopened`}</strong><p>Claimed activity does not close a margin exception.</p></div>
          <div><span>Despatch</span><strong>{isLive ? liveEscalatedMargins : preview.despatchEscalations.length} sustained exception{(isLive ? liveEscalatedMargins : preview.despatchEscalations.length) === 1 ? "" : "s"}</strong><p>Only repeated or explicitly escalated failures are emitted to Despatch.</p></div>
        </div>
        <p className={styles.soWhat}>So what: each attributed action must close on protected billed-revenue and direct-cost proof, so claimed fixes do not recover the gap until independently verified.</p>
      </article>
      <aside className={styles.panel} aria-label="Self Learn recommendation">
        <h3>Early patterns to watch</h3><p>Recommendations only; definitions stay fixed.</p>
        <div className={styles.learning}>
          <div><span>Attribution</span><strong>{isLive ? rowText(marginLearning, "attribution") || "Not recorded" : preview.learning.attributionLabel}</strong></div>
          <div><span>Confidence</span><strong>{isLive ? rowText(marginLearning, "confidence") || "Not recorded" : preview.learning.confidence}</strong><p>{isLive ? rowText(marginLearning, "observed") || "No Nia Margins observation is recorded in the user-input TEAM_LEARNING_HISTORY tab." : preview.learning.confidenceReasons.join(" · ")}</p></div>
          <div><span>Materiality</span><strong>{isLive ? marginApproval ? "Human approval pending" : "Not recorded" : preview.learning.material ? "Material" : "Non-material"}</strong><p>{isLive ? marginApproval?.businessReason || "No linked materiality approval is recorded." : preview.learning.materialityReasons.join(" · ") || "Inside approved bounds"}</p></div>
          <div><span>Disposition</span><strong>{isLive ? rowText(marginLearning, "disposition") || "Not recorded" : preview.learning.requiredDisposition}</strong><p>{isLive ? rowText(marginLearning, "proposed change", "expected effect") || "No recommendation is recorded in the user-input TEAM_LEARNING_HISTORY tab." : "Self Learn cannot change CM definitions, prices, terms or Studio status."}</p></div>
        </div>
        <p className={styles.soWhat}>{isLive ? `So what: ${rowText(marginLearning, "disposition") || "no learning disposition is recorded"}; no recommendation changes margin definitions, prices, terms, or Studio status automatically.` : "So what: these are recommendations to watch, not adopted changes, so nothing here alters margin definitions until a human approves it."}</p>
      </aside>
    </div>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>{decisionTitle}</strong>
        <p>{decisionReason}</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{decisionOwner}</dd></div>
        {decisionDue ? <div><dt>By</dt><dd><time dateTime={decisionDue}>{date(decisionDue)}</time></dd></div> : <div><dt>Done when</dt><dd>{isLive && verdictCm2Inr === null ? "CM2 recorded" : isLive && verdictTargetInr === null ? "Approved control recorded" : "Full-use CM2 ≥ control"}</dd></div>}
      </dl>
    </section>
  </DashboardSectionAccordion>
}
