import type { ReactNode } from "react"

export function EditorialChartFrame({ id, title, reads, takeaway, children, annotation, table, source, compact = false }: { id: string; title: string; reads: string; takeaway: string; children: ReactNode; annotation?: ReactNode; table: ReactNode; source: string; compact?: boolean }) {
  return <section className={`editorial-chart${compact ? " editorial-chart-compact" : ""}`} aria-labelledby={`${id}-title`}>
    <header><div>{!compact && <p className="story-kicker">WHAT THIS CHART SHOWS</p>}<h2 id={`${id}-title`}>{title}</h2><p className="chart-reads">{reads}</p></div>{!compact && <p>{takeaway}</p>}</header>
    <div className="editorial-chart-layout"><div className="editorial-chart-plot h-[320px] w-full">{children}</div>{annotation && <aside>{annotation}</aside>}</div>
    <div className="sr-only">{table}</div>
    <p className="chart-source">Source: {source}</p>
  </section>
}

