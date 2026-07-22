import type { FunnelStage } from "@/lib/operating-data"
import { diagnoseStage } from "@/lib/stage-diagnostics"

type FunnelMode = "today" | "mtd"

function getCount(stage: FunnelStage, mode: FunnelMode) {
  return mode === "today" ? stage.today : stage.mtd
}

function getConversion(stage: FunnelStage, mode: FunnelMode) {
  return mode === "today" ? stage.todayConversion : stage.mtdConversion
}

function getBottleneckIndex(stages: FunnelStage[], mode: FunnelMode) {
  if (mode === "today") {
    const explicitIssue = stages.findIndex((stage) => stage.signal === "issue")
    if (explicitIssue >= 0 && getConversion(stages[explicitIssue], mode) !== null) return explicitIssue
  }

  return stages.reduce((lowestIndex, stage, index) => {
    const conversion = getConversion(stage, mode)
    if (conversion === null) return lowestIndex
    if (lowestIndex < 0 || conversion < (getConversion(stages[lowestIndex], mode) ?? Number.POSITIVE_INFINITY)) return index
    return lowestIndex
  }, -1)
}

function funnelTitle(stages: FunnelStage[], mode: FunnelMode, bottleneckIndex: number) {
  const period = mode === "today" ? "Today" : "This month"
  if (bottleneckIndex < 0) return `${period}: no slow step is visible.`
  const stage = stages[bottleneckIndex]
  const next = stages[bottleneckIndex + 1]
  const conversion = getConversion(stage, mode)
  if (!next || conversion === null) return `${period}: ${stage.label} is the end stage.`
  return `${period}: ${stage.label} → ${next.label} is the slowest step at ${conversion}%.`
}

function Funnel({ title, stages, mode }: { title: string; stages: FunnelStage[]; mode: FunnelMode }) {
  const baseline = getCount(stages[0], mode)
  const bottleneckIndex = getBottleneckIndex(stages, mode)
  const visualWidth = (retained: number) => 20 + Math.max(0, Math.min(retained, 100)) * 0.8
  const stageRows = stages.map((stage, index) => {
    const count = getCount(stage, mode)
    const conversion = getConversion(stage, mode)
    const previousCount = index === 0 ? null : getCount(stages[index - 1], mode)
    const retained = baseline > 0 ? Math.round((count / baseline) * 100) : 0
    const nextCount = index < stages.length - 1 ? getCount(stages[index + 1], mode) : null
    const nextRetained = nextCount === null || baseline <= 0 ? null : Math.round((nextCount / baseline) * 100)
    const topWidth = visualWidth(retained)
    const bottomWidth = nextRetained === null ? Math.max(14, topWidth * 0.72) : visualWidth(Math.min(retained, nextRetained))
    const topInset = (100 - topWidth) / 2
    const bottomInset = (100 - bottomWidth) / 2

    return {
      stage,
      count,
      conversion,
      retained,
      changeFromPrior: previousCount === null ? null : count - previousCount,
      isBottleneck: index === bottleneckIndex,
      clipPath: `polygon(${topInset}% 0, ${100 - topInset}% 0, ${100 - bottomInset}% 100%, ${bottomInset}% 100%)`,
    }
  })

  const insightTitle = funnelTitle(stages, mode, bottleneckIndex)
  return <figure className="funnel-visual"><figcaption><div><span>{title}</span><h4>{insightTitle}</h4></div><p><b>How to read it</b> Wider shapes mean more remains from the first stage.</p></figcaption><div className="funnel-visual-body">
    <ol className="funnel-shape" aria-label={`${title} funnel volumes`}>{stageRows.map(({ stage, count, retained, isBottleneck, clipPath }) => <li className={isBottleneck ? "is-bottleneck" : undefined} key={stage.label} aria-label={`${stage.label}: ${count.toLocaleString("en-IN")}, ${retained}% remains`}><div className="funnel-segment" style={{ clipPath }}><b>{count.toLocaleString("en-IN")}</b></div></li>)}</ol>
    <ol className="funnel-annotations">{stageRows.map(({ stage, conversion, retained, changeFromPrior, isBottleneck }, index) => <li className={isBottleneck ? "is-bottleneck" : undefined} key={stage.label}><div className="funnel-stage-title"><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage.label}</strong>{isBottleneck && <b>Slowest step</b>}</div><p><span>{retained}% remains</span><span>{conversion === null ? "Last step" : `${conversion}% to next step`}</span>{changeFromPrior !== null && <span>{changeFromPrior < 0 ? `−${Math.abs(changeFromPrior).toLocaleString("en-IN")} from last step` : `+${changeFromPrior.toLocaleString("en-IN")} from last step`}</span>}</p>{mode === "today" && <em>{stage.delta}</em>}</li>)}</ol>
  </div></figure>
}

export function TodayMtdFunnel({ stages }: { stages: FunnelStage[] }) {
  const diagnostics = stages.map(diagnoseStage).filter((diagnostic) => diagnostic !== null)
  return <div className="today-mtd-block"><div className="today-mtd-grid"><Funnel title="Today" stages={stages} mode="today" /><Funnel title="This month" stages={stages} mode="mtd" /></div>{diagnostics.length > 0 && <div className="funnel-signals">{diagnostics.map((diagnostic) => <p className={diagnostic.status === "not-working" ? "signal-issue" : "signal-positive"} data-diagnostic-status={diagnostic.status} data-mismatch-id={diagnostic.mismatchId} key={diagnostic.stageLabel}><strong>{diagnostic.status === "not-working" ? "Not working today" : "Working today"} · {diagnostic.stageLabel}</strong><span>{diagnostic.reason}</span>{diagnostic.nextAction && <span><b>Action</b> · {diagnostic.nextAction}</span>}{diagnostic.accountableOwner && <span><b>Owner</b> · {diagnostic.accountableOwner}</span>}{diagnostic.forwardCmAtRisk24h && <span><b>CM at risk in 24 hours</b> · {diagnostic.forwardCmAtRisk24h}</span>}</p>)}</div>}</div>
}
