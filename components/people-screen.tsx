import { TodayMtdFunnel } from "@/components/today-mtd-funnel"
import type { FunnelStage } from "@/lib/operating-data"
import { OperationalCard, OperationalCardStack } from "@/components/operational-card"
import { Fragment } from "react"

type LiveTeam = {
  name: string
  owner: string
  stages: FunnelStage[]
  people: { name: string; progress: number; updatedAt: string; action: string; attention: boolean }[]
}

function TeamCard({ team }: { team: LiveTeam }) {
  const ranked = [...team.people].sort((a, b) => b.progress - a.progress)
  return <article className="team-card"><header><span>{team.owner}</span><h2>{team.name}</h2></header><TodayMtdFunnel stages={team.stages} /><OperationalCardStack label={`${team.name} people performance`}>{ranked.map((person) => <OperationalCard key={person.name} title={person.name} status={person.attention ? "Attention" : "On track"} action={person.action} fields={[{ label: "Owner", value: team.owner }, { label: "Period", value: `Updated ${person.updatedAt}` }, { label: "Progress", value: `${person.progress}%` }]} />)}</OperationalCardStack></article>
}

function dashboardValue(rows: any[], key: string, fallback: string) {
  const row = rows.find((item) => item.key === key)
  return String(row?.["value text"] || row?.value || fallback)
}

function valueNumber(value: any) {
  const parsed = Number(String(value ?? "").replace(/[,%]/g, "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function roundedPercent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

function text(row: any, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function total(rows: any[], ...keys: string[]) {
  return rows.reduce((sum, row) => sum + valueNumber(text(row, ...keys)), 0)
}

function snapshotStages(entries: { label: string; value: number }[]): FunnelStage[] {
  return entries.map((entry, index) => ({
    label: entry.label,
    today: entry.value,
    mtd: entry.value,
    todayConversion: index === 0 ? null : roundedPercent(entry.value, entries[index - 1].value),
    mtdConversion: index === 0 ? null : roundedPercent(entry.value, entries[index - 1].value),
    delta: "Current Google Sheet snapshot",
  }))
}

export function PeopleScreen({ liveOpsData }: { liveOpsData?: any }) {
  const dashboard = liveOpsData?.peopleDashboard || []
  const peoplePerformance = liveOpsData?.peoplePerformance || []
  const followThrough = (liveOpsData?.peopleFollowThrough || []).map((row: any) => {
    const commitments = valueNumber(row.commitments)
    const verified = valueNumber(row.verified)
    const carriedForward = valueNumber(row["carried forward"])
    const closedButNotResolved = valueNumber(row["closed but not resolved"])
    return {
      owner: String(row["display name"] || row["actor id"] || "Unassigned"),
      team: String(row.team || "Unassigned"),
      updatedAt: String(row["updated at"] || "No timestamp"),
      progress: valueNumber(row["progress pct"]),
      nextAction: String(row["next action"] || "No next action entered"),
      commitments,
      verified,
      carriedForward,
      closureRate: roundedPercent(verified, commitments),
      closedButNotResolvedRate: roundedPercent(closedButNotResolved, commitments),
    }
  }).filter((person: any) => person.owner !== "Unassigned")
  const mainKicker = dashboardValue(dashboard, "people_main_kicker", "MAIN POINT")
  const criticalPeople = peoplePerformance.filter((person: any) => String(person.status || "").trim().toLowerCase() === "critical")
  const onPlanPeople = peoplePerformance.filter((person: any) => String(person.status || "").trim().toLowerCase() === "on plan")
  const behindPeople = peoplePerformance.filter((person: any) => String(person.status || "").trim().toLowerCase() === "behind")
  const reviewsDue = peoplePerformance.filter((person: any) => String(person["review due"] || "").trim().toLowerCase() === "yes")
  const notReporting = peoplePerformance.filter((person: any) => String(person["reporting status"] || "").trim().toLowerCase() === "not reporting")
  const attainmentValues = peoplePerformance.map((person: any) => Number(String(person["attainment pct"] || "").replace("%", ""))).filter(Number.isFinite).sort((a: number, b: number) => a - b)
  const medianAttainment = attainmentValues.length ? (attainmentValues.length % 2 ? attainmentValues[(attainmentValues.length - 1) / 2] : (attainmentValues[attainmentValues.length / 2 - 1] + attainmentValues[attainmentValues.length / 2]) / 2) : null
  const affectedTeams = new Set(criticalPeople.map((person: any) => String(person.team || "").trim()).filter(Boolean))
  const totalPeople = peoplePerformance.length
  const criticalCount = criticalPeople.length
  const teamCount = affectedTeams.size
  const mainHeadline = totalPeople ? `${criticalCount} of ${totalPeople} field staff need attention. ${teamCount} ${teamCount === 1 ? "team has" : "teams have"} problems today.` : dashboardValue(dashboard, "people_main_headline", "People data has not been configured.")
  const mainDetail = totalPeople ? "People status is calculated from the People_Performance records in the connected Google Sheet." : dashboardValue(dashboard, "people_main_detail", "Update People_Dashboard to set this page's operating message.")
  const headlineMetrics = totalPeople ? [
    { label: "Employees", value: String(totalPeople), note: "People_Performance" },
    { label: "On plan", value: String(onPlanPeople.length), note: "Status = On plan" },
    { label: "Behind", value: String(behindPeople.length), note: "Status = Behind" },
    { label: "Critical", value: String(criticalCount), note: "Status = Critical" },
    { label: "Median attainment", value: medianAttainment === null ? "No data" : `${medianAttainment}%`, note: "Attainment across people" },
    { label: "Reviews due", value: String(reviewsDue.length), note: "Review due = Yes" },
    { label: "Not reporting", value: String(notReporting.length), note: "Reporting status = Not reporting" },
  ] : [
    ["employees", "Employees", "No data", "People_Performance required"],
    ["on_plan", "On plan", "No data", "People_Performance required"],
    ["behind", "Behind", "No data", "People_Performance required"],
    ["critical", "Critical", "No data", "People_Performance required"],
    ["median_attainment", "Median attainment", "No data", "People_Performance required"],
    ["reviews_due", "Reviews due", "No data", "People_Performance required"],
    ["not_reporting", "Not reporting", "No data", "People_Performance required"],
  ].map(([key, label, value, note]) => ({ label: dashboardValue(dashboard, `people_headline_${key}_label`, label), value, note: dashboardValue(dashboard, `people_headline_${key}_note`, note) }))

  const followThroughKicker = dashboardValue(dashboard, "people_follow_through_kicker", "EXECUTION CONTROL")
  const followThroughTitle = dashboardValue(dashboard, "people_follow_through_heading", "Follow-through by person")
  const followThroughDetail = dashboardValue(dashboard, "people_follow_through_detail", "Closure and result rates are calculated from People_Follow_Through.")
  const enterpriseDemand = liveOpsData?.enterpriseDemand || []
  const living = liveOpsData?.living || []
  const essentials = Array.isArray(liveOpsData?.essentials) ? liveOpsData.essentials : (liveOpsData?.essentials ? [liveOpsData.essentials] : [])
  const essentialsCohorts = Array.isArray(liveOpsData?.essentialsCohorts) ? liveOpsData.essentialsCohorts : (liveOpsData?.essentialsCohorts ? [liveOpsData.essentialsCohorts] : [])
  const essentialsInventory = liveOpsData?.essentialsInventory || []
  const fonoLiving = living.filter((row: any) => /^fono$/i.test(text(row, "supply model")))
  const spLiving = living.filter((row: any) => /^(sp|shram\s*park)$/i.test(text(row, "supply model")))
  const followThroughByOwner = new Map(followThrough.map((person: any) => [person.owner.toLowerCase(), person]))
  const peopleFor = (pattern: RegExp) => peoplePerformance.filter((person: any) => pattern.test(String(person.team || ""))).map((person: any) => {
    const name = String(person["display name"] || person["actor id"] || "Unassigned")
    const followUp: any = followThroughByOwner.get(name.toLowerCase())
    const status = String(person.status || "")
    return { name, progress: followUp?.progress ?? valueNumber(person["attainment pct"]), updatedAt: String(person["updated at"] || "No timestamp"), action: followUp?.nextAction || "No next action entered", attention: /behind|critical/i.test(status) }
  })
  const demand: LiveTeam[] = [
    fonoLiving.length ? { name: "FONO Demand", owner: "Theatre Ops team", stages: snapshotStages([{ label: "Named requirements", value: total(enterpriseDemand, "headcount required") }, { label: "Demand matched", value: total(enterpriseDemand, "headcount matched") }, { label: "Members activated", value: total(fonoLiving, "occupied nests") }]), people: peopleFor(/member activation/i) } : null,
    enterpriseDemand.length ? { name: "Shram Park Demand", owner: "JCO team", stages: snapshotStages([{ label: "Headcount required", value: total(enterpriseDemand, "headcount required") }, { label: "Headcount matched", value: total(enterpriseDemand, "headcount matched") }, { label: "Headcount remaining", value: total(enterpriseDemand, "headcount remaining") }]), people: peopleFor(/enterprise demand/i) } : null,
    essentials.length || essentialsCohorts.length ? { name: "Essentials Demand", owner: "Marketing team", stages: snapshotStages([{ label: "Eligible Members", value: total(essentialsCohorts, "eligible") || total(essentials, "eligible members") }, { label: "Buying Members", value: total(essentialsCohorts, "buyers") || total(essentials, "buying members") }, { label: "Orders fulfilled", value: total(essentials, "orders fulfilled") }]), people: peopleFor(/essentials|marketing/i) } : null,
  ].filter(Boolean) as LiveTeam[]
  const supply: LiveTeam[] = [
    fonoLiving.length ? { name: "FONO Supply", owner: "Franchise Acquisition team", stages: snapshotStages([{ label: "Contracted Nests", value: total(fonoLiving, "contracted nests") }, { label: "Activation-ready Nests", value: total(fonoLiving, "activation ready nests") }, { label: "Occupied Nests", value: total(fonoLiving, "occupied nests") }]), people: peopleFor(/fono acquisition/i) } : null,
    spLiving.length ? { name: "Shram Park Supply", owner: "RM team", stages: snapshotStages([{ label: "Contracted Nests", value: total(spLiving, "contracted nests") }, { label: "Activation-ready Nests", value: total(spLiving, "activation ready nests") }, { label: "Occupied Nests", value: total(spLiving, "occupied nests") }]), people: peopleFor(/field delivery/i) } : null,
    essentialsInventory.length || essentials.length ? { name: "Essentials Supply", owner: "EAE / Merchandiser team", stages: snapshotStages([{ label: "SKUs tracked", value: essentialsInventory.length }, { label: "In-stock SKUs", value: essentialsInventory.filter((row: any) => !/^yes$/i.test(text(row, "stockout"))).length }, { label: "Orders fulfilled", value: total(essentials, "orders fulfilled") }]), people: peopleFor(/essentials|merch|eae/i) } : null,
  ].filter(Boolean) as LiveTeam[]

  return <div className="pillar-screen people-screen"><div className="decision-bar"><div><span>{mainKicker}</span><strong>{mainHeadline}</strong></div><p>{mainDetail}</p></div><section className="people-headline" data-kpi-group>{headlineMetrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</section><section className="people-follow-through" aria-labelledby="people-follow-through-title"><header><div><p className="pillar-kicker">{followThroughKicker}</p><h2 id="people-follow-through-title">{followThroughTitle}</h2></div><p>{followThroughDetail}</p></header><OperationalCardStack label="Person follow-through leaderboard">{followThrough.map((person: any) => <OperationalCard key={person.owner} title={person.owner} domain={person.team} status={person.closedButNotResolvedRate > 0 || person.carriedForward > 0 ? "Attention" : "On track"} action={person.nextAction} fields={[{ label: "Owner", value: person.owner }, { label: "Period", value: `Updated ${person.updatedAt}` }, { label: "Progress", value: `${person.progress}%` }, { label: "Closure rate", value: `${person.closureRate}%` }, { label: "Committed / verified", value: `${person.commitments} / ${person.verified}` }, { label: "Carried", value: person.carriedForward }, { label: "Closed, not resolved", value: `${person.closedButNotResolvedRate}%` }]} />)}</OperationalCardStack></section><div className="people-columns"><section className="people-lane-heading"><p className="pillar-kicker">DEMAND</p><h2>Find demand and turn it into contracts.</h2></section><section className="people-lane-heading"><p className="pillar-kicker">SUPPLY</p><h2>Find Nests, activate Members, and deliver orders.</h2></section>{demand.map((team, index) => <Fragment key={team.name}><TeamCard team={team} />{supply[index] ? <TeamCard team={supply[index]} /> : <div />}</Fragment>)}</div></div>
}
