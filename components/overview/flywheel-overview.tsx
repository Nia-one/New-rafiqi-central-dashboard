import { ArrowRight, ArrowUpRight, CircleAlert } from "lucide-react"
import { THEATRES, type DashboardRoute } from "@/lib/dashboard-model"
import { ACTION_GRID_CATEGORIES, buildDailyActionGrid, buildRankedQueue, isNoData } from "@/lib/allocation-engine"
import type { AllocationDomain, RankedMismatch } from "@/lib/allocation-types"
import { formatInr } from "@/lib/ops-data"
import { contentValue } from "@/lib/dashboard-content"
import type { ExecutionAction } from "@/lib/execution-control"
import { AllocationAttentionQueue } from "./allocation-attention-queue"
import { BlockRecap } from "./block-recap"

type Pair = { side: "Demand" | "Supply"; label: string; value: string; note: string }
type Pillar = {
  name: "Living" | "Work" | "Essentials"
  description: string
  pairs: Pair[]
  domains: AllocationDomain[]
}

const spineValue = (spine: any[], id: string) => {
  const metric = spine.find((item) => item.id === id)
  return metric ? metric.actual.toLocaleString("en-IN") : "Not yet instrumented"
}

function metricMoved(mismatch: RankedMismatch) {
  if (mismatch.domain === "Essentials") return mismatch.mismatchType === "dead-stock" ? "CM" : "Attach rate"
  if (mismatch.domain === "Work") return "Members matched"
  if (mismatch.mismatchType === "shortfall") return "Live capacity"
  return "Members active"
}

function cmAtRisk(mismatch: RankedMismatch) {
  return isNoData(mismatch.forwardCmAtRisk24h) ? "No data" : formatInr(mismatch.forwardCmAtRisk24h, true)
}

function Bottleneck({ mismatch, priority, onNavigate }: { mismatch: RankedMismatch; priority: boolean; onNavigate: (route: DashboardRoute, mismatchId?: string) => void }) {
  return <article className={`flywheel-bottleneck ${priority ? "priority" : ""}`}>
    <div className="flywheel-bottleneck-top">
      <span className="flywheel-rank">{priority ? "01" : ""}</span>
      <div>
        {priority && <span className="flywheel-priority"><CircleAlert aria-hidden /> Highest priority</span>}
        <h4>{mismatch.label}</h4>
        <p>{mismatch.theatre} · {mismatch.where}</p>
      </div>
      <strong>{cmAtRisk(mismatch)}<small>CM at risk · 24h</small></strong>
    </div>
    <p className="flywheel-mismatch"><b>Mismatch</b> · <span className="semantic-demand-text">{isNoData(mismatch.demandQty) ? "No data" : mismatch.demandQty.toLocaleString("en-IN")} demand</span> vs <span className="semantic-supply-text">{isNoData(mismatch.supplyQty) ? "No data" : mismatch.supplyQty.toLocaleString("en-IN")} supply</span></p>
    <div className="flywheel-action"><span>Action</span><p>{mismatch.nextAction}</p></div>
    <div className="flywheel-bottleneck-footer"><span><b>Owner</b> {mismatch.accountableOwner}</span><span><b>Moves</b> {metricMoved(mismatch)}</span><button onClick={() => onNavigate(mismatch.laneTarget, mismatch.id)}>Open details <ArrowUpRight aria-hidden /></button></div>
  </article>
}

function DailyAction({ mismatch, onNavigate }: { mismatch: RankedMismatch; onNavigate: (route: DashboardRoute, mismatchId?: string) => void }) {
  return <article className="daily-action-card">
    <div className="daily-action-meta">
      <span>{isNoData(mismatch.priorityScore) ? "No score" : `P${mismatch.priorityScore}`}</span>
      <span>{mismatch.actionStatus}</span>
    </div>
    <p>{mismatch.nextAction}</p>
    <div className="daily-action-analysis daily-action-root-cause"><span>Root cause</span><p>{mismatch.rootCauseAnalysis.rootCause}</p></div>
    <div className="daily-action-analysis daily-action-solution"><span>Recommended solution</span><p>{mismatch.rootCauseAnalysis.recommendedSolution}</p></div>
    <div className="daily-action-footer">
      <span><b>Owner</b> {mismatch.accountableOwner}</span>
      <button type="button" onClick={() => onNavigate(mismatch.laneTarget, mismatch.id)} aria-label={`Open details for ${mismatch.label}`}>Open details <ArrowUpRight aria-hidden /></button>
    </div>
  </article>
}

function DailyActionMatrix({ allocationData, onNavigate, workConnected }: { allocationData?: any; onNavigate: (route: DashboardRoute, mismatchId?: string) => void; workConnected: boolean }) {
  const grid = buildDailyActionGrid({}, allocationData?.mismatchInputs)

  return <section className="daily-action-grid-section" aria-labelledby="daily-action-grid-title">
    <header className="flywheel-section-heading"><div><p className="story-kicker">04 · TODAY&apos;S ACTION GRID</p><h2 id="daily-action-grid-title">Quick actions by Theatre and category.</h2></div><p>Scan each Theatre for its three highest-priority open actions today.</p></header>
    <div className="daily-action-grid-scroll" tabIndex={0} role="region" aria-label="Daily action grid; scroll horizontally to see every Theatre">
      <table className="daily-action-grid">
        <caption className="sr-only">Categories in rows and Theatres in columns, with up to three ranked actions in each cell.</caption>
        <thead><tr><th scope="col" className="daily-action-corner">Category</th>{THEATRES.map((theatre) => <th scope="col" key={theatre}>{theatre}</th>)}</tr></thead>
        <tbody>{ACTION_GRID_CATEGORIES.map((category) => <tr key={category}>
          <th scope="row" className="daily-action-category"><div className="daily-action-category-label"><strong>{category}</strong><span>{category === "Work" && !workConnected ? "Feed needed" : "Open actions"}</span></div></th>
          {THEATRES.map((theatre) => {
            const actions = grid[category][theatre]
            return <td key={theatre} className={actions === null ? "daily-action-unavailable" : ""}>
              {actions === null ? <div className="daily-action-empty"><strong>Not yet instrumented</strong><p>Connect Work demand and worker availability.</p></div> : actions.length > 0 ? <div className="daily-action-list">{actions.map((action) => <DailyAction key={action.id} mismatch={action}
    onNavigate={onNavigate} />)}</div> : <div className="daily-action-empty"><strong>No open action</strong><p>No unresolved action in the current queue.</p></div>}
            </td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </section>
}

function PillarCard({ pillar, index }: { pillar: Pillar; index: number }) {
  return <article id={pillar.name.toLowerCase().replaceAll(" ", "-")} className={`flywheel-pillar flywheel-${pillar.name.toLowerCase()}`}>
    <header><span className="flywheel-pillar-number">0{index + 1}</span><div><h3>{pillar.name}</h3><p>{pillar.description}</p></div></header>
    <div className="flywheel-pairs">{pillar.pairs.map((pair) => <div className={`flywheel-pair semantic-${pair.side.toLowerCase()}`} key={pair.side}><span>{pair.side}</span><strong>{pair.value}</strong><p>{pair.label}</p><small>{pair.note}</small></div>)}</div>
  </article>
}

export function FlywheelOverview({ liveOpsData, allocationData, commitments, onShowExecution, onNavigate }: { liveOpsData: any; allocationData?: any; commitments: ExecutionAction[]; onShowExecution: () => void; onNavigate: (route: DashboardRoute, mismatchId?: string) => void }) {
  const workConnected = liveOpsData.flywheel.work.demand > 0 || liveOpsData.flywheel.work.supply > 0
  const content = liveOpsData.dashboardContent
  const flywheelContent = (key: string, fallback: string) =>
    contentValue(content, "Overview", "continuity_flywheel", key, fallback)
  const pillars: Pillar[] = [
  {
    name: "Living",
    description: flywheelContent("living_description", "Stage 1 · A Nest creates the stable base and brings the Member into the flywheel."),
    pairs: [
      { side: "Demand", label: flywheelContent("living_demand_label", "Named enterprise requirement"), value: spineValue(liveOpsData.spine, "contracted"), note: flywheelContent("living_demand_note", "Members contracted") },
      { side: "Supply", label: flywheelContent("living_supply_label", "Live Nests"), value: spineValue(liveOpsData.spine, "capacity"), note: flywheelContent("living_supply_note", "Capacity live") },
    ],
    domains: ["Shram Park", "FONO"],
  },
  {
    name: "Work",
    description: flywheelContent("work_description", "Stage 2 · Employment access supports income continuity for Members."),
    pairs: [
      { side: "Demand", label: flywheelContent("work_demand_label", "Open employer headcount"), value: liveOpsData.flywheel.work.demand.toLocaleString("en-IN"), note: flywheelContent("work_demand_note", "Work_Hourly · open headcount") },
      { side: "Supply", label: flywheelContent("work_supply_label", "Members matched to work"), value: liveOpsData.flywheel.work.supply.toLocaleString("en-IN"), note: flywheelContent("work_supply_note", "Work_Hourly · matched headcount") },
    ],
    domains: ["Work"],
  },
  {
    name: "Essentials",
    description: flywheelContent("essentials_description", "Stage 3 · Lower-cost Essentials protect savings and encourage another order."),
    pairs: [
      { side: "Demand", label: flywheelContent("essentials_demand_label", "Eligible / purchasing Members"), value: `${liveOpsData.flywheel.essentials.eligible.toLocaleString("en-IN")} / ${liveOpsData.flywheel.essentials.purchasing.toLocaleString("en-IN")}`, note: flywheelContent("essentials_demand_note", "Eligible / purchasing · live") },
      { side: "Supply", label: flywheelContent("essentials_supply_label", "SKU fulfilment"), value: liveOpsData.flywheel.essentials.fulfilled.toLocaleString("en-IN"), note: flywheelContent("essentials_supply_note", "Essentials_Hourly · orders fulfilled") },
    ],
    domains: ["Essentials"],
  },
]

const queue = buildRankedQueue({}, allocationData?.mismatchInputs)
  const top = queue.find((item) => !isNoData(item.priorityScore))
  const bottlenecks = pillars.map((pillar) => ({ pillar, items: queue.filter((item) => pillar.domains.includes(item.domain)).filter((item) => !isNoData(item.demandQty) && !isNoData(item.supplyQty) && !isNoData(item.gapQty)).slice(0, 3) }))

  return <div className="flywheel-overview">
    <section className="flywheel-loop-section" aria-labelledby="loop-title">
      <header className="flywheel-section-heading"><div><p className="story-kicker">{flywheelContent("kicker", "01 · THE CONTINUITY FLYWHEEL")}</p><h2 id="loop-title">{flywheelContent("headline", "One system. Three connected pillars.")}</h2></div><p>{flywheelContent("intro", "Living brings the Member in. Work and Essentials deepen continuity without starting a new relationship.")}</p></header>
      <p className="flywheel-stage-line"><span>{flywheelContent("stage_living", "Community Living")}</span><ArrowRight aria-hidden /><span>{flywheelContent("stage_work", "Access to work")}</span><ArrowRight aria-hidden /><span>{flywheelContent("stage_essentials", "Lower-cost Essentials")}</span><ArrowRight aria-hidden /><span>{flywheelContent("stage_stability", "Greater stability")}</span><ArrowRight aria-hidden /><span>{flywheelContent("stage_demand", "Stronger Living demand")}</span></p>
      <div className="flywheel-loop" role="list" aria-label="Living, Work and Essentials flywheel">
        {pillars.map((pillar, index) => <div className="flywheel-loop-item" role="listitem" key={pillar.name}><PillarCard pillar={pillar} index={index} />{index < pillars.length - 1 && <ArrowRight className="flywheel-arrow" aria-hidden />}</div>)}
        <div className="flywheel-return" aria-hidden><ArrowRight /><span>{flywheelContent("return_caption", "Member stability strengthens Living demand")}</span></div>
      </div>
      <p className="flywheel-loop-caption"><span>{flywheelContent("loop_caption", "One Member relationship")}</span><b>·</b><span>Living</span><ArrowRight aria-hidden /><span>Work</span><ArrowRight aria-hidden /><span>Essentials</span><ArrowRight aria-hidden /><span>Living</span></p>
    </section>

    <section className="flywheel-bottlenecks-section" aria-labelledby="bottleneck-title">
      <header className="flywheel-section-heading"><div><p className="story-kicker">02 · WHAT TO FIX TODAY</p><h2 id="bottleneck-title">Start with the largest demand–supply gap.</h2></div><p>Each line has one action, one owner, and the metric it should move.</p></header>
      <div className="flywheel-bottleneck-groups">{bottlenecks.map(({ pillar, items }) => <section id={pillar.name} className={`flywheel-bottleneck-group flywheel-${pillar.name.toLowerCase()}`} key={pillar.name}><header><div><h3>{pillar.name}</h3><p>{pillar.name === "Work" ? (workConnected ? `${liveOpsData.flywheel.work.demand.toLocaleString("en-IN")} open roles and ${liveOpsData.flywheel.work.supply.toLocaleString("en-IN")} matched Members from Work_Hourly.` : "Work source data is not available.") : `${items.length} bottleneck${items.length === 1 ? "" : "s"} found in the current data.`}</p></div><span>{pillar.name === "Work" ? (workConnected ? "Source connected" : "Feed needed") : `${items.length} open`}</span></header>{pillar.name === "Work" ? <div className="flywheel-not-instrumented"><strong>{workConnected ? "Work feed connected" : "Work source data needed"}</strong><p>{workConnected ? "Open headcount and matched headcount are calculated from Work_Hourly. Add a Work constraint only when an allocation action is required." : "Add employer requests and worker availability to Work_Hourly before ranking Work bottlenecks."}</p></div> : items.length > 0 ? items.map((item) => <Bottleneck key={item.id} mismatch={item} priority={item.id === top?.id}     onNavigate={onNavigate} />) : <div className="flywheel-not-instrumented"><strong>No open mismatch</strong><p>There is no open demand–supply gap in the current data.</p></div>}</section>)}</div>
    </section>

    <AllocationAttentionQueue allocationData={allocationData} commitments={commitments} liveOpsData={liveOpsData} onShowExecution={onShowExecution} onNavigate={(route, mismatchId) => onNavigate(route, mismatchId)} />

    <DailyActionMatrix     
    allocationData={allocationData}
    onNavigate={onNavigate}
    workConnected={workConnected} />

    <BlockRecap liveOpsData={liveOpsData} />
  </div>
}




















