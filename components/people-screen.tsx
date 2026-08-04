import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { teamBlocks } from "@/lib/operating-data"
import { EXECUTION_REPORT_AS_OF } from "@/lib/execution-data"
import { buildExecutionReport, type ExecutionAction } from "@/lib/execution-control"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { DataTable } from "@/components/data-table"

function TeamCard({ team }: { team: (typeof teamBlocks)[number] }) {
  const ranked = [...team.people].sort((a,b) => b.conversion - a.conversion)
  return <article className="team-card"><header><span>{team.owner}</span><h2>{team.name}</h2></header><TodayMtdFunnel stages={team.stages} /><OperationalCardStack label={`${team.name} people performance`}>{ranked.map((person, index) => <OperationalCard key={person.name} title={person.name} status={index === 0 ? "On track" : index === ranked.length - 1 ? "Below floor" : "Attention"} fields={[{ label: "Owner", value: team.owner }, { label: "Period", value: `Last updated ${person.lastUpdated}` }, { label: "Conversion", value: `${person.conversion}%` }]} />)}</OperationalCardStack></article>
}

type LiveRow = Record<string, unknown>

function LivePeopleTable({ title, rows }: { title: string; rows: readonly LiveRow[] }) {
  if (!rows.length) return <section className="operating-section"><h2>{title}</h2><p className="footer-note">No verified records are available in the backend sheet.</p></section>
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => !key.startsWith("__"))
  return <section className="operating-section"><h2>{title}</h2><DataTable caption={title} columns={columns} rows={rows.map((row) => columns.map((key) => String(row[key] ?? "")))} /></section>
}

export function PeopleScreen({ commitments, liveData }: { commitments: ExecutionAction[]; liveData?: { dashboard: readonly LiveRow[]; performance: readonly LiveRow[]; followThrough: readonly LiveRow[]; roster: readonly LiveRow[] } | null }) {
  if (liveData !== undefined) return <DashboardSectionAccordion className="pillar-screen people-screen" ariaLabel="People sections" sections={[
    { title: "Main point", summary: liveData ? "Live People and roster records" : "Live snapshot unavailable" },
    { title: "People summary", summary: `${liveData?.dashboard.length ?? 0} summary records` },
    { title: "Follow-through", summary: `${liveData?.followThrough.length ?? 0} verified records` },
    { title: "Performance", summary: `${liveData?.performance.length ?? 0} performance records` },
    { title: "Roster", summary: `${liveData?.roster.length ?? 0} governed roster records` },
  ]}><div className="decision-bar"><div><span>MAIN POINT</span><strong>{liveData ? "People is driven by normalized roster and execution records below." : "People data is unavailable; no illustrative staff values are shown."}</strong></div><p>Only backend records are displayed.</p></div><LivePeopleTable title="People summary" rows={liveData?.dashboard ?? []} /><LivePeopleTable title="Follow-through by person" rows={liveData?.followThrough ?? []} /><LivePeopleTable title="People performance" rows={liveData?.performance ?? []} /><LivePeopleTable title="Governed roster" rows={liveData?.roster ?? []} /></DashboardSectionAccordion>
  const demand = teamBlocks.slice(0,3), supply = teamBlocks.slice(3)
  const followThrough = buildExecutionReport(commitments, EXECUTION_REPORT_AS_OF).people
  return <div className="pillar-screen people-screen"><div className="decision-bar"><div><span>MAIN POINT</span><strong>4 of 18 field staff need attention. Two teams have problems today.</strong></div><p>Marketing stays in the list. It is not marked "Not reporting" because orders update automatically.</p></div><section className="people-headline" data-kpi-group>{[["Employees","21"],["On plan","12"],["Behind","5"],["Critical","4"],["Median attainment","78%"],["Reviews due","6"],["Not reporting","4"]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{label === "Not reporting" ? "Field roles only" : "People Ops · 14:00"}</small></article>)}</section><section className="people-follow-through" aria-labelledby="people-follow-through-title"><header><div><p className="pillar-kicker">EXECUTION CONTROL</p><h2 id="people-follow-through-title">Follow-through by person</h2></div><p>Closure rate and result rate are separate. Illustrative commitments only.</p></header><OperationalCardStack label="Person follow-through leaderboard">{followThrough.map((person) => <OperationalCard key={person.owner} title={person.owner} domain={person.team} status={person.closedButNotResolvedRate > 0 ? "Attention" : "On track"} fields={[{ label: "Owner", value: person.owner }, { label: "Period", value: "Current illustrative commitments" }, { label: "Closure rate", value: `${person.closureRate}%` }, { label: "Committed / verified", value: `${person.commitments} / ${person.verified}` }, { label: "Carried", value: person.carriedForward }, { label: "Closed, not resolved", value: `${person.closedButNotResolvedRate}%` }]} />)}</OperationalCardStack></section><div className="people-columns"><section><p className="pillar-kicker">DEMAND</p><h2>Find demand and turn it into contracts.</h2>{demand.map(team => <TeamCard key={team.name} team={team} />)}</section><section><p className="pillar-kicker">SUPPLY</p><h2>Find Nests, activate Members, and deliver orders.</h2>{supply.map(team => <TeamCard key={team.name} team={team} />)}</section></div></div>
}
