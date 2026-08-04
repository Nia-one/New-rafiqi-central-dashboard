import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { teamBlocks } from "@/lib/operating-data"
import { EXECUTION_REPORT_AS_OF } from "@/lib/execution-data"
import { buildExecutionReport, type ExecutionAction } from "@/lib/execution-control"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"

function TeamCard({ team }: { team: (typeof teamBlocks)[number] }) {
  const ranked = [...team.people].sort((a,b) => b.conversion - a.conversion)
  return <article className="team-card"><header><span>{team.owner}</span><h2>{team.name}</h2></header><TodayMtdFunnel stages={team.stages} /><OperationalCardStack label={`${team.name} people performance`}>{ranked.map((person, index) => <OperationalCard key={person.name} title={person.name} status={index === 0 ? "On track" : index === ranked.length - 1 ? "Below floor" : "Attention"} fields={[{ label: "Owner", value: team.owner }, { label: "Period", value: `Last updated ${person.lastUpdated}` }, { label: "Conversion", value: `${person.conversion}%` }]} />)}</OperationalCardStack></article>
}

type LiveRow = Record<string, unknown>

function rowValue(row: LiveRow, ...keys: string[]) {
  for (const key of keys) {
    const normalized = key.toLowerCase().replaceAll("_", " ")
    const found = Object.keys(row).find((candidate) => candidate.toLowerCase().replaceAll("_", " ") === normalized)
    if (found && String(row[found] ?? "").trim()) return String(row[found]).trim()
  }
  return ""
}

function LivePeopleCards({ rows, label }: { rows: readonly LiveRow[]; label: string }) {
  if (!rows.length) return <p className="footer-note">No verified {label.toLowerCase()} records are available.</p>
  return <OperationalCardStack label={label}>{rows.map((row, index) => {
    const title = rowValue(row, "display name", "owner name", "owner", "actor id") || `Record ${index + 1}`
    const team = rowValue(row, "team", "role", "vertical") || "Not recorded"
    const status = rowValue(row, "status", "state", "performance status") || "Recorded"
    const fields = Object.entries(row).filter(([key]) => !key.startsWith("__") && !["display name", "owner name", "owner"].includes(key.toLowerCase())).slice(0, 6).map(([key, value]) => ({ label: key.replaceAll("_", " "), value: String(value ?? "") || "Not recorded" }))
    return <OperationalCard key={`${title}-${index}`} title={title} domain={team} status={status} fields={fields} />
  })}</OperationalCardStack>
}

export function PeopleScreen({ commitments, liveData = null }: { commitments: ExecutionAction[]; liveData?: { dashboard: readonly LiveRow[]; performance: readonly LiveRow[]; followThrough: readonly LiveRow[]; roster: readonly LiveRow[] } | null }) {
  if (liveData !== undefined) {
    const dashboard = liveData?.dashboard ?? [], performance = liveData?.performance ?? [], followThroughRows = liveData?.followThrough ?? []
    const headline = dashboard[0] ? Object.entries(dashboard[0]).filter(([key]) => !key.startsWith("__")).slice(0, 7) : []
    const demandRows = performance.filter((row) => /demand|marketing|sales|jco/i.test(rowValue(row, "team", "role", "vertical")))
    const supplyRows = performance.filter((row) => !demandRows.includes(row))
    return <div className="pillar-screen people-screen">
      <div className="decision-bar"><div><span>MAIN POINT</span><strong>{liveData ? "People performance and follow-through are driven by governed roster and execution records." : "People data is unavailable; no illustrative staff values are shown."}</strong></div><p>Missing values remain missing; no staff performance is inferred.</p></div>
      <section className="people-headline" data-kpi-group>{headline.length ? headline.map(([label, value]) => <article key={label}><span>{label.replaceAll("_", " ")}</span><strong>{String(value ?? "")}</strong><small>Governed People dashboard</small></article>) : <article><span>DATA STATUS</span><strong>—</strong><small>No verified summary records</small></article>}</section>
      <section className="people-follow-through" aria-labelledby="people-follow-through-title"><header><div><p className="pillar-kicker">EXECUTION CONTROL</p><h2 id="people-follow-through-title">Follow-through by person</h2></div><p>Closure and verified result remain separate.</p></header><LivePeopleCards rows={followThroughRows} label="Person follow-through leaderboard" /></section>
      <div className="people-columns"><section><p className="pillar-kicker">DEMAND</p><h2>Find demand and turn it into contracts.</h2><LivePeopleCards rows={demandRows} label="Demand people performance" /></section><section><p className="pillar-kicker">SUPPLY</p><h2>Find Nests, activate Members, and deliver orders.</h2><LivePeopleCards rows={supplyRows} label="Supply people performance" /></section></div>
    </div>
  }
  const demand = teamBlocks.slice(0,3), supply = teamBlocks.slice(3)
  const followThrough = buildExecutionReport(commitments, EXECUTION_REPORT_AS_OF).people
  return <div className="pillar-screen people-screen"><div className="decision-bar"><div><span>MAIN POINT</span><strong>4 of 18 field staff need attention. Two teams have problems today.</strong></div><p>Marketing stays in the list. It is not marked "Not reporting" because orders update automatically.</p></div><section className="people-headline" data-kpi-group>{[["Employees","21"],["On plan","12"],["Behind","5"],["Critical","4"],["Median attainment","78%"],["Reviews due","6"],["Not reporting","4"]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{label === "Not reporting" ? "Field roles only" : "People Ops · 14:00"}</small></article>)}</section><section className="people-follow-through" aria-labelledby="people-follow-through-title"><header><div><p className="pillar-kicker">EXECUTION CONTROL</p><h2 id="people-follow-through-title">Follow-through by person</h2></div><p>Closure rate and result rate are separate. Illustrative commitments only.</p></header><OperationalCardStack label="Person follow-through leaderboard">{followThrough.map((person) => <OperationalCard key={person.owner} title={person.owner} domain={person.team} status={person.closedButNotResolvedRate > 0 ? "Attention" : "On track"} fields={[{ label: "Owner", value: person.owner }, { label: "Period", value: "Current illustrative commitments" }, { label: "Closure rate", value: `${person.closureRate}%` }, { label: "Committed / verified", value: `${person.commitments} / ${person.verified}` }, { label: "Carried", value: person.carriedForward }, { label: "Closed, not resolved", value: `${person.closedButNotResolvedRate}%` }]} />)}</OperationalCardStack></section><div className="people-columns"><section><p className="pillar-kicker">DEMAND</p><h2>Find demand and turn it into contracts.</h2>{demand.map(team => <TeamCard key={team.name} team={team} />)}</section><section><p className="pillar-kicker">SUPPLY</p><h2>Find Nests, activate Members, and deliver orders.</h2>{supply.map(team => <TeamCard key={team.name} team={team} />)}</section></div></div>
}
