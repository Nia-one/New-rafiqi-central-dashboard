import { ArrowUpRight } from "lucide-react"
import type { DashboardRoute } from "@/lib/dashboard-model"
import { positiveOutliers } from "@/lib/operating-data"
import { formatInr } from "@/lib/ops-data"

export function AllocationPositivePanel({ onNavigate }: { onNavigate: (route: DashboardRoute, id?: string) => void }) {
  return <section className="story-section positive-section" aria-labelledby="positive-title"><header className="story-heading"><div><p className="story-kicker">03 · WHAT’S WORKING</p><h2 id="positive-title">Protect the matches that add the most CM.</h2></div><p>These matches are ordered by the CM they can add in the next 24 hours.</p></header><ol className="positive-list">{positiveOutliers.map((item, index) => <li key={item.id}><span className="positive-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.label}</strong><p>{item.theatre} · {item.where}</p><small>{item.owner} · {item.status} → {item.nextAction}</small></div><dl><div><dt>CM added in 24 hours</dt><dd>{formatInr(item.forwardCmUpside24h, true)}</dd></div><div><dt>Confidence</dt><dd>{item.confidence}</dd></div></dl><button onClick={() => onNavigate(item.laneTarget, item.id)}>Open page<ArrowUpRight aria-hidden /></button></li>)}</ol></section>
}
