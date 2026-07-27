"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react"
import { recoverMemberSavingsTask, type MemberSavingsPreview, type MemberSavingsShadowOutcome, type SavingsTaskPreview, type SavingsVerification } from "@/lib/operating-loop/member-savings-loop"
import { actionStageFromStatus, OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { TokenSelect } from "@/components/token-select"
import { MeasureViz } from "@/components/measure-viz"
import { compactAge } from "@/lib/operating-loop/loop-health"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { approvalsForDomain } from "@/lib/live-approvals"
import { buildLiveMemberSavingsFreshness, buildLiveMemberSavingsHealth } from "@/lib/live-mappers/self-drive"
import styles from "./member-savings-workspace.module.css"

type Props = { preview: MemberSavingsPreview; liveData?: any }

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function date(value: string) {
  return `${dateFormatter.format(new Date(value))} IST`
}

function averageRecordedPercent(rows: readonly Record<string, unknown>[], field: string) {
  const values = rows.flatMap((row) => {
    const raw = row[field]
    if (raw === null || raw === undefined || String(raw).trim() === "") return []
    const value = Number(raw)
    return Number.isFinite(value) ? [value] : []
  })
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function percent(value: number) {
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`
}

function recordedNumber(row: Record<string, unknown>, field: string) {
  const raw = row[field]
  if (raw === null || raw === undefined || String(raw).trim() === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function DualGateMatrix({ preview }: Props) {
  const maxValue = Math.max(...preview.services.flatMap((service) => [service.memberSavingsInr, Math.max(0, service.niaMarginInr)]), 1)
  return <div className={styles.matrix} role="img" aria-label="Paired bars comparing recorded Member savings and Nia margin by service and Studio">
    <div className={styles.matrixLegend}><span><i className={styles.savingsKey} />Verified Member saving</span><span><i className={styles.marginKey} />Verified Nia margin</span><small>₹ per fulfilled unit · prices hidden</small></div>
    <div className={styles.zeroRule}><span>Both values must be above ₹0</span></div>
    {preview.services.map((service) => <article className={styles.serviceRow} data-gate-status={service.status} key={service.serviceId}>
      <div className={styles.serviceIdentity}><strong>{service.serviceName}</strong><span>{service.studio}</span></div>
      <div className={styles.barPair}>
        <div><span>Member</span><i className={styles.savingsBar} style={{ width: `${Math.max(2, service.memberSavingsInr / maxValue * 100)}%` }} /><b>₹{service.memberSavingsInr}</b></div>
        <div><span>Nia</span>{service.niaMarginInr > 0 ? <i className={styles.marginBar} style={{ width: `${Math.max(2, service.niaMarginInr / maxValue * 100)}%` }} /> : <i className={styles.failedBar} /> }<b>{service.niaMarginInr > 0 ? `₹${service.niaMarginInr}` : `−₹${Math.abs(service.niaMarginInr)}`}</b></div>
      </div>
      <div className={service.status === "Pass" ? styles.passLabel : styles.exceptionLabel}><span>{service.status}</span><small>{service.statusReason}</small></div>
    </article>)}
  </div>
}

export function MemberSavingsWorkspace({ preview: fixturePreview, liveData }: Props) {
  const isLive = Boolean(liveData)
  const liveFreshness = isLive ? buildLiveMemberSavingsFreshness(liveData) : null
  const liveHealth = isLive ? buildLiveMemberSavingsHealth(liveData) : null
  const essentials = liveData?.essentials?.[0]
  const finance = liveData?.finance?.[0]
  const savings = Number(essentials?.["member savings inr"] ?? 0)
  const margin = Number(essentials?.["nia margin inr"] ?? finance?.["cm2 inr"] ?? 0)
  const livePolicyApprovals = approvalsForDomain(liveData, "member-savings")
  const savingsAction = liveData?.actionLog?.find((row: Record<string, unknown>) => {
    const source = `${row["operating objective"] ?? ""} ${row["expected metric"] ?? ""}`.toLowerCase()
    return source.includes("savings") || source.includes("essentials pricing")
  })
  const ownerActorId = String(savingsAction?.["owner actor id"] ?? essentials?.["next action owner actor id"] ?? "").trim()
  const ownerPerson = liveData?.people?.find((row: Record<string, unknown>) => String(row["actor id"] ?? "").trim() === ownerActorId)
  const owner = String(ownerPerson?.["display name"] || livePolicyApprovals[0]?.owner || ownerActorId || fixturePreview.summary.owner)
  const memberSavingsPass = savings > 0
  const niaMarginPass = margin > 0
  const gap = Number(!memberSavingsPass) + Number(!niaMarginPass)
  const liveQuestion = `Are recorded Member savings of ₹${savings.toLocaleString("en-IN")} and Nia margin of ₹${margin.toLocaleString("en-IN")} both above ₹0?`
  const pendingApprovals = livePolicyApprovals.filter((approval) => approval.pending)
  const approvalNote = pendingApprovals.length
    ? `${pendingApprovals.length} governed price or supplier decision${pendingApprovals.length === 1 ? "" : "s"} awaiting human approval`
    : "No governed price or supplier decision is awaiting approval"
  const liveEssentialsRows = Array.isArray(liveData?.essentials) ? liveData.essentials : []
  const liveGateRows = liveEssentialsRows.filter((row: Record<string, unknown>) => {
    return recordedNumber(row, "member savings inr") !== null && recordedNumber(row, "nia margin inr") !== null
  })
  const studioNameById = new Map((Array.isArray(liveData?.studios) ? liveData.studios : []).map((row: Record<string, unknown>) => [String(row["studio id"] ?? "").trim(), String(row["studio name"] ?? "").trim()]))
  const liveServices: MemberSavingsPreview["services"] = Object.freeze(liveGateRows.map((row: Record<string, unknown>, index: number) => {
    const serviceId = String(row["essentials hourly id"] ?? `ESSENTIALS-${index + 1}`).trim()
    const studioId = String(row["studio id"] ?? "").trim()
    const memberSavingsInr = recordedNumber(row, "member savings inr") ?? 0
    const niaMarginInr = recordedNumber(row, "nia margin inr") ?? 0
    const attachFloor = recordedNumber(row, "attach floor pct")
    const status = memberSavingsInr > 0 && niaMarginInr > 0 ? "Pass" as const : "Exception" as const
    const statusReason = status === "Pass" ? "Both recorded gates pass" : memberSavingsInr <= 0 && niaMarginInr <= 0 ? "Member savings and Nia margin gates fail" : memberSavingsInr <= 0 ? "Member savings gate fails" : "Nia margin gate fails"
    return Object.freeze({
      serviceId,
      serviceName: `Essentials service · ${serviceId}`,
      studio: studioNameById.get(studioId) || studioId || "Studio not recorded",
      memberSavingsInr,
      niaMarginInr,
      status,
      statusReason,
      attachPct: recordedNumber(row, "attach pct") ?? 0,
      repeatPct: recordedNumber(row, "repeat pct") ?? 0,
      peerBandLabel: attachFloor === null ? "No governed floor recorded" : `floor ${percent(attachFloor)}`,
      repeatBaselinePct: recordedNumber(row, "repeat baseline pct") ?? 0,
    })
  }))
  const passingGateRows = liveServices.filter((service) => service.status === "Pass").length
  const failingGateRows = Math.max(0, liveGateRows.length - passingGateRows)
  const serviceGateSummary = liveServices.length === 0 ? "No recorded services" : failingGateRows === 0 ? `All ${liveServices.length} recorded ${liveServices.length === 1 ? "service passes" : "services pass"}` : `${failingGateRows} ${failingGateRows === 1 ? "service fails" : "services fail"} the dual gate`
  const serviceGateImplication = liveServices.length === 0 ? "So what: no service-level savings and margin row is recorded in Essentials_Hourly." : failingGateRows === 0 ? `So what: all ${liveServices.length} recorded ${liveServices.length === 1 ? "service clears" : "services clear"} both the Member-savings and Nia-margin gates.` : `So what: ${failingGateRows} recorded ${failingGateRows === 1 ? "service needs" : "services need"} cost or attach recovery while preserving Member savings.`
  const dualGateImplicationSummary = isLive
    ? liveGateRows.length === 0
      ? "No eligible service gate data is recorded."
      : failingGateRows === 0
        ? "All recorded services pass both gates."
        : failingGateRows === 1
          ? "Recovery belongs on the single failing service."
          : `Recovery belongs on ${failingGateRows} failing services.`
    : "Recovery belongs on the single failing service."
  const dualGateImplication = isLive
    ? liveGateRows.length === 0
      ? "So what: no eligible Essentials_Hourly service row is recorded, so the dual-gate implication cannot yet be confirmed."
      : failingGateRows === 0
        ? `So what: ${passingGateRows} of ${liveGateRows.length} recorded ${liveGateRows.length === 1 ? "service clears" : "services clear"} both gates, so no dual-gate recovery is currently required.`
        : `So what: ${passingGateRows} of ${liveGateRows.length} recorded ${liveGateRows.length === 1 ? "service clears" : "services clear"} both gates; recovery belongs on the ${failingGateRows === 1 ? "single failing service" : `${failingGateRows} failing services`}, not a category-wide reprice.`
    : "So what: 3 of 4 services clear both gates, so the single failing service is where recovery effort belongs, not a category-wide reprice."
  const attachPct = averageRecordedPercent(liveEssentialsRows, "attach pct")
  const attachFloorPct = averageRecordedPercent(liveEssentialsRows, "attach floor pct")
  const repeatPct = averageRecordedPercent(liveEssentialsRows, "repeat pct")
  const repeatBaselinePct = averageRecordedPercent(liveEssentialsRows, "repeat baseline pct")
  const hasAttachRepeat = attachPct !== null && repeatPct !== null
  const hasAttachRepeatComparators = attachFloorPct !== null && repeatBaselinePct !== null
  const verifiedSavingsOutcomes = liveHealth?.verification.verified ?? 0
  const openSavingsActions = liveHealth ? liveHealth.verification.awaiting + liveHealth.verification.reopened : 0
  const liveMeasures: MemberSavingsPreview["measures"] = Object.freeze([
    Object.freeze({ id: "verified-savings" as const, label: verifiedSavingsOutcomes > 0 ? "Verified Member savings" : "Recorded Member savings", value: `₹${savings.toLocaleString("en-IN")}`, target: "Above ₹0", detail: verifiedSavingsOutcomes > 0 ? `${verifiedSavingsOutcomes} independently verified outcome${verifiedSavingsOutcomes === 1 ? "" : "s"}` : "Independent verification is awaiting Evidence_Log" }),
    Object.freeze({ id: "attach-repeat" as const, label: "Attach and repeat", value: hasAttachRepeat ? `${percent(attachPct)} / ${percent(repeatPct)}` : "No data", target: hasAttachRepeatComparators ? `Floor ${percent(attachFloorPct)} / baseline ${percent(repeatBaselinePct)}` : "Governed comparison unavailable", detail: hasAttachRepeat ? `Calculated from ${liveEssentialsRows.length} Essentials_Hourly row${liveEssentialsRows.length === 1 ? "" : "s"}` : "No attach or repeat metric is recorded in the connected Sheet feeds" }),
    Object.freeze({ id: "dual-gate" as const, label: "Services passing both gates", value: liveGateRows.length ? `${passingGateRows}/${liveGateRows.length}` : "No data", target: "Savings + margin", detail: liveGateRows.length ? "Calculated from Essentials_Hourly" : "No eligible Essentials_Hourly row is recorded" }),
    Object.freeze({ id: "exceptions" as const, label: "At-risk recovery", value: `${openSavingsActions} open`, target: `${verifiedSavingsOutcomes} verified`, detail: "Calculated from Action_Log and Evidence_Log" }),
  ])
  const preview: MemberSavingsPreview = {
    ...fixturePreview,
    loopHealth: liveHealth ?? fixturePreview.loopHealth,
    quarantineCount: liveFreshness?.quarantinedRecords ?? fixturePreview.quarantineCount,
    headline: liveData ? `Members saved ₹${savings.toLocaleString("en-IN")}; Nia margin is ₹${margin.toLocaleString("en-IN")}.` : fixturePreview.headline,
    summary: {
      ...fixturePreview.summary,
      target: "Savings and margin above ₹0",
      current: `₹${savings.toLocaleString("en-IN")} / ₹${margin.toLocaleString("en-IN")}`,
      gap: String(gap),
      owner,
      progress: gap === 0 ? "100%" : "0%",
      verifiedResult: gap === 0 ? "Both live data gates passed" : "One or more live data gates failed",
    },
    measures: isLive ? liveMeasures : fixturePreview.measures,
    services: isLive ? liveServices : fixturePreview.services,
  }
  const [tasks, setTasks] = useState<readonly SavingsTaskPreview[]>(preview.tasks)
  const [selected, setSelected] = useState<Record<string, MemberSavingsShadowOutcome>>(() => Object.fromEntries(preview.tasks.map((task) => [task.actionId, "Unresolved"])) as Record<string, MemberSavingsShadowOutcome>)
  const [audit, setAudit] = useState<readonly { id: string; actionId: string; outcome: MemberSavingsShadowOutcome; verification: SavingsVerification["status"]; route: string; at: string }[]>([])

  function recordShadowOutcome(actionId: string) {
    const outcome = selected[actionId] ?? "Unresolved"
    const at = new Date().toISOString()
    const task = tasks.find((candidate) => candidate.actionId === actionId)
    if (!task) return
    const transition = recoverMemberSavingsTask(task, outcome)
    setTasks((current) => current.map((candidate) => candidate.actionId === actionId ? transition.task : candidate))
    setAudit((current) => [...current, Object.freeze({ id: `shadow-${actionId}-${Date.parse(at)}`, actionId, outcome, verification: transition.verification.status, route: transition.route, at })])
  }

  return <DashboardSectionAccordion className={styles.workspace} ariaLabel="Member Savings sections" sections={[
    { title: "Data freshness", summary: isLive ? `Google Sheet refresh ${date(liveFreshness!.asOf)} · ${liveFreshness!.feeds.length} connected feeds${liveFreshness!.staleFeedCount ? ` · ${liveFreshness!.staleFeedCount} stale` : ""}` : `Last refresh ${date(preview.source.lastRefreshAt)} · ${preview.quarantineCount} quarantined` },
    { title: "Savings command", summary: `${preview.summary.gap} failing the dual gate · owner ${preview.summary.owner}` },
    { title: "Loop health", summary: `${preview.loopHealth.state} · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} confirmed` },
    { title: "Savings vs goal", summary: `${preview.summary.current} current · ${preview.summary.target} target` },
    { title: "Headline measures", summary: `${preview.measures.length} dual-gate controls at a glance` },
    { title: "Dual-gate implication", summary: dualGateImplicationSummary },
    { title: "Savings, margin and repeat", summary: preview.services.length ? `${preview.services.filter((service) => service.status === "Pass").length}/${preview.services.length} services pass` : "No recorded services" },
    { title: "Service implication", summary: "Fix cost or attach without withdrawing Member savings." },
    { title: "Services needing action", summary: `${tasks.length} service actions open` },
    { title: "Issues needing review", summary: `${preview.despatchEscalations.length} repeated failures need help` },
    { title: "Background record", summary: `${audit.length} local shadow events · governed controls retained` },
    { title: "Decision required", summary: `Recover ${preview.summary.gap} dual-gate failure` },
    { title: "Source and confidence", summary: isLive ? `${liveFreshness!.feeds.length} connected Sheet feeds · ${preview.loopHealth.verification.verified}/${preview.loopHealth.verification.claimed} outcomes verified` : `${preview.source.name} · Production confidence Low` },
  ]}>
    <div className={styles.freshness} role="status">
      {isLive && liveFreshness!.staleFeedCount === 0 ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
      <strong>{isLive ? liveFreshness!.staleFeedCount ? `${liveFreshness!.staleFeedCount} connected source${liveFreshness!.staleFeedCount === 1 ? " is" : "s are"} stale` : "Google Sheet sources current" : "Stale synthetic fixture"}</strong>
      <span>{isLive ? `Sheet snapshot ${date(liveFreshness!.asOf)} · ${liveFreshness!.feeds.length} connected feeds` : `Last refresh ${date(preview.source.lastRefreshAt)} · no live connection`}</span>
      <b>{preview.quarantineCount} protected-input rows quarantined</b>
    </div>

    <section className={styles.taskBand} aria-labelledby="member-savings-heading">
      <div>
        <span>{isLive ? "Google Sheet · live read-only" : `${preview.fixtureLabel} · ${preview.mode}`}</span>
        <h2 id="member-savings-heading">{preview.headline}</h2>
        <p>{isLive ? liveQuestion : preview.question}</p>
      </div>
      <div className={styles.ownerSummary}><b className={styles.verdictPill} data-state={gap === 0 ? "on-track" : "behind"}>{gap === 0 ? "Dual gate passed" : "Dual-gate breach"} · {preview.summary.gap} failing</b><span>Current owner</span><strong>{preview.summary.owner}</strong><small>{isLive ? approvalNote : "Human approval retained for price and supplier decisions"}</small></div>
    </section>

    <section className={styles.loopHealthStrip} data-health-state={preview.loopHealth.state} aria-label="Data and check status">
      {(() => {
        const lh = preview.loopHealth
        const stale = lh.feeds.filter((feed) => feed.stale)
        const oldest = [...lh.feeds].sort((a, b) => b.ageMinutes - a.ageMinutes)[0]
        const breached = lh.clocks.filter((clock) => clock.breached).length
        const running = lh.clocks.filter((clock) => clock.state === "Running").length
        const { verified, awaiting, reopened } = lh.verification
        const total = verified + awaiting + reopened
        const segments = [{ v: verified, t: "good" }, { v: awaiting, t: "warn" }, { v: reopened, t: "bad" }] as const
        return <>
          <article><span>Data freshness</span><strong>{stale.length} stale</strong><small>{oldest ? `Oldest ${compactAge(oldest.ageMinutes)}` : "All current"}</small></article>
          <article><span>Clocks running</span><strong>{running} active · {breached} breached</strong><small>{breached > 0 ? `${breached} owner wait` : "None breached"}</small></article>
          <article><span>Outcome checks</span><strong>{verified} of {lh.verification.claimed} confirmed</strong>
            <div className="loop-health-verify-bar" role="img" aria-label={`${verified} confirmed, ${awaiting} waiting, ${reopened} reopened`}>
              {total === 0 ? <i data-tone="empty" style={{ width: "100%" }} /> : segments.filter((s) => s.v > 0).map((s) => <i key={s.t} data-tone={s.t} style={{ width: `${(s.v / total) * 100}%` }} />)}
            </div>
          </article>
        </>
      })()}
    </section>

    <section className={styles.flow} aria-label="Savings vs monthly goal">
      {([
        ["Target", preview.summary.target], ["Current", preview.summary.current], ["Gap", preview.summary.gap],
        ["Owner", preview.summary.owner], ["Progress", preview.summary.progress], ["Verified result", preview.summary.verifiedResult],
      ] as const).map(([label, value], index) => <div className={label === "Gap" ? styles.gapFlow : undefined} key={label}><span>{label}</span><strong>{value}</strong>{index < 5 ? <ArrowRight aria-hidden /> : null}</div>)}
    </section>

    <section className={styles.measures} data-kpi-group aria-label="Four key numbers">
      {preview.measures.map((measure) => <article data-measure-id={measure.id} key={measure.id}><span>{measure.label}</span><strong>{measure.value}</strong><MeasureViz value={measure.value} target={measure.target} fallback={<b>{measure.target}</b>} /><small>{measure.detail}</small></article>)}
    </section>
    <p className={styles.soWhat}>{dualGateImplication}</p>

    <div className={styles.primaryGrid}>
      <section className={styles.panel} aria-label="Savings and profit check">
        <header><div><span>Savings and profit check</span><strong>{isLive ? serviceGateSummary : "1 service fails the margin test"}</strong></div><p>{isLive ? "Google Sheet · live read-only" : "Confirmed outcomes · synthetic"}</p></header>
        <DualGateMatrix preview={preview} />
      </section>

      <section className={`${styles.panel} ${styles.healthPanel}`} aria-label="Usage and repeat trends">
        <header><div><span>Usage and repeat trends</span><strong>{isLive ? preview.services.length ? `Attach and repeat recorded for ${preview.services.length} ${preview.services.length === 1 ? "service" : "services"}` : "No attach or repeat data recorded" : "Attach and repeat tracked locally"}</strong></div><p>{isLive ? "Essentials_Hourly observations" : "Studio baselines only"}</p></header>
        <div className={styles.usageList}>{preview.services.map((service) => <article key={service.serviceId}><div><strong>{service.serviceName}</strong><span>{service.studio}</span></div><dl><div><dt>Attach</dt><dd>{service.attachPct}%</dd></div><div><dt>Repeat</dt><dd>{service.repeatPct}%</dd></div></dl><small>Peer: {service.peerBandLabel} · own baseline {service.repeatBaselinePct}%</small></article>)}</div>
        <div className={styles.rule}><ShieldCheck aria-hidden /><span><strong>Recovery rule</strong>Actual attach or repeat must recover against current governed evidence. A visit does not close.</span></div>
      </section>
    </div>
    <p className={styles.soWhat}>{isLive ? serviceGateImplication : "So what: the failing service loses Nia margin while still saving the Member, so it needs a cost or attach fix, not withdrawal of the saving."}</p>

    <section className={styles.workPanel} aria-label="Services needing action now">
      <header><div><span>Services needing action now</span><strong>{tasks.length} service actions open</strong></div><p>Preview only</p></header>
      <OperationalCardStack label="Member Savings action work">{tasks.map((task) => <OperationalCard key={task.actionId} title={task.issue} domain={`${task.service} · ${task.actionId}`} status={task.state} progress={actionStageFromStatus(task.state)} fields={[{ label: "Owner", value: task.owner }, { label: "Due", value: <time dateTime={task.dueAt}>{date(task.dueAt)}</time> }, { label: "Expected metric", value: task.expectedMetric }, { label: "Progress", value: task.progress }, { label: "Verified result", value: task.verifiedResult }]}><div className={styles.shadowControl}><TokenSelect ariaLabel={`Shadow outcome for ${task.service}`} value={selected[task.actionId] ?? "Unresolved"} options={["Unresolved", "Evidence received", "Failed evidence", "Systemic pattern"] as const} onChange={(outcome) => setSelected((current) => ({ ...current, [task.actionId]: outcome }))} /><button type="button" onClick={() => recordShadowOutcome(task.actionId)}>Record locally</button><small>No price, supplier or external action</small></div></OperationalCard>)}</OperationalCardStack>
      <p className={styles.soWhat}>So what: each action closes only on verified attach or repeat evidence, so a Member visit alone does not count as recovery.</p>
    </section>

    <section className={styles.exceptions} aria-label="Issues needing your review">
      <header><div><span>Issues needing your review</span><strong>{preview.despatchEscalations.length} repeated failures need help</strong></div><p>Evidence retained</p></header>
      <OperationalCardStack label="Issues needing your review">{preview.despatchEscalations.map((row) => <OperationalCard key={row.escalationId} title={row.title} status={row.severity} domain="Member Savings" fields={[{ label: "Owner", value: row.ownerRole }, { label: "Due", value: <time dateTime={row.dueAt}>{date(row.dueAt)}</time> }, { label: "Despatch", value: row.status }]} progress={row.status === "Acknowledged" ? "working" : "assigned"} story={[{ label: "Why it matters", value: row.reason }, { label: "What Nia already did", value: `Confirmed the repeated dual-gate failure and routed it to ${row.ownerRole}.` }, { label: "What happens next", value: "Recover both Member savings and Nia margin, then submit verified evidence." }]} />)}<OperationalCard title="Repricing proposal" status="Recommendation only" domain="Member Savings" fields={[{ label: "Owner", value: "Pushkar" }]} story={[{ label: "Why it matters", value: "Price changes affect both Member savings and Nia margin." }, { label: "What Nia already did", value: "Prepared an evidence-backed recommendation without changing the price." }, { label: "What happens next", value: "Pushkar reviews and approves or declines the proposal." }]} progress="evidence" /></OperationalCardStack>
    </section>

    <details className={styles.auditDetails}>
      <summary><ChevronDown aria-hidden />Full background record</summary>
      <div className={styles.auditBody}>
        <section><strong>Versioned controls and pending approvals</strong><div className={styles.auditTable}><table><thead><tr><th>Policy</th><th>Value</th><th>Version</th><th>Status</th></tr></thead><tbody>{liveData ? (livePolicyApprovals.length ? livePolicyApprovals.map((approval) => <tr key={approval.approvalId}><td>{approval.title}</td><td>{approval.proposedTerms || approval.expectedResult || "No value recorded"}</td><td>{approval.approvalId}</td><td>{approval.decision}</td></tr>) : <tr><td>No linked policy approval</td><td>No Approval_Log record</td><td>—</td><td>Not recorded</td></tr>) : preview.policyRegistry.map((policy) => <tr key={policy.policyId}><td>{policy.name}</td><td>{policy.value === null ? "No value approved" : `${policy.value} ${policy.unit}`}</td><td>v{policy.version}</td><td>{policy.status}</td></tr>)}</tbody></table></div></section>
        <section><strong>Weekly savings-message inputs</strong>{preview.weeklyMessageInputs.map((input) => <dl key={input.serviceRef}><div><dt>Service</dt><dd>Protected service reference</dd></div><div><dt>Verified saving</dt><dd>{input.verifiedSavingsInr === null ? "Unavailable" : `₹${input.verifiedSavingsInr}`}</dd></div><div><dt>Freshness</dt><dd>{input.dataFreshness}</dd></div><div><dt>Mode</dt><dd>{input.mode} · sent {String(input.sent)}</dd></div></dl>)}</section>
        <section><strong>Shared learning-control inputs</strong>{preview.learningInputs.map((input) => <dl className={styles.learningGrid} key={input.action_id}><div><dt>Proposed change</dt><dd>{input.proposed_change}</dd></div><div><dt>Expected effect</dt><dd>{input.expected_effect}</dd></div><div><dt>Evidence</dt><dd>{input.evidence_cycles} cycles · n={input.sample_size} · {input.verification_rate_pct}% verified</dd></div><div><dt>Attribution</dt><dd>{input.attribution_grade} · {input.confounders.join(", ")}</dd></div><div><dt>Forecast error</dt><dd>{input.forecast_error_pct}%</dd></div><div><dt>Fresh / reversible</dt><dd>{String(input.critical_data_fresh)} / {String(input.reversible)}</dd></div><div><dt>Approved boundary</dt><dd>{String(input.inside_approved_boundary)} · reverses human decision {String(input.reverses_human_decision)}</dd></div><div><dt>Human controls</dt><dd>{input.affected_human_controlled_categories.join(", ") || "No category changed"}</dd></div><div><dt>Effects</dt><dd>{input.target_effect} {input.channel_effect} {input.cm_effect} {input.cash_effect}</dd></div><div><dt>Confidence / adoption</dt><dd>{input.production_confidence} · auto-adopt {String(input.auto_adopt)}</dd></div><div><dt>Rollback</dt><dd>{input.rollback_trigger}</dd></div></dl>)}</section>
        <section><strong>Append-only local shadow audit</strong>{audit.length > 0 ? <ol>{audit.map((entry) => <li key={entry.id}><CheckCircle2 aria-hidden /><span><b>{entry.outcome} · {entry.verification}</b>{entry.actionId} · {entry.route}</span><time dateTime={entry.at}>{date(entry.at)}</time></li>)}</ol> : <p>No local shadow outcome recorded.</p>}</section>
        <section><strong>Structural action boundary</strong><p>{Object.entries(preview.blockedCapabilities).map(([capability, enabled]) => `${capability}: ${enabled ? "enabled" : "blocked"}`).join(" · ")}</p><p>RafiQi may detect, assign and verify in synthetic shadow state. It cannot change price, contact a supplier or Member, sign a contract, move money, delist a service, call externally, write Production or adopt policy.</p></section>
      </div>
    </details>

    <section className={styles.askBand} aria-label="Decision required">
      <div className={styles.askCopy}>
        <span>Decision required</span>
        <strong>Recover the {preview.summary.gap} failing the dual gate so both Member savings and Nia margin clear ₹0.</strong>
        <p>Repricing stays a recommendation only; accountability sits with {preview.summary.owner} until verified attach or margin evidence closes the gate.</p>
      </div>
      <dl className={styles.askMeta}>
        <div><dt>Owner</dt><dd>{preview.summary.owner}</dd></div>
        <div><dt>By</dt><dd><time dateTime={preview.tasks[0].dueAt}>{date(preview.tasks[0].dueAt)}</time></dd></div>
      </dl>
    </section>

    <footer className={styles.sourceNote}><FileCheck2 aria-hidden /><span>{preview.source.name} · as of {date(preview.source.asOf)} · protected references only</span><Clock3 aria-hidden /><span>Production confidence Low · pending thresholds do not block shadow progress</span></footer>
  </DashboardSectionAccordion>
}
