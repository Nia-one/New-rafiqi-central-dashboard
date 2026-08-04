type LiveRow = Record<string, unknown>

function rows(snapshot: any, key: string): LiveRow[] {
  return Array.isArray(snapshot?.[key]) ? snapshot[key] : []
}

function value(row: LiveRow, ...keys: string[]) {
  for (const key of keys) {
    const normalized = key.toLowerCase().replaceAll("_", " ")
    const match = Object.keys(row).find((candidate) => candidate.toLowerCase().replaceAll("_", " ") === normalized)
    if (match && String(row[match] ?? "").trim()) return String(row[match]).trim()
  }
  return ""
}

export function BlockRecap({ liveOpsData }: { liveOpsData?: any }) {
  const actions = rows(liveOpsData, "executionActions")
  const constraints = rows(liveOpsData, "constraints")
  const verified = actions.filter((row) => /verified|resolved/i.test(value(row, "status", "state")))
  const stalled = constraints.filter((row) => !/verified|resolved|closed|dismissed/i.test(value(row, "status", "state"))).slice(0, 5)
  const staleOwners = [...new Set(actions.filter((row) => /overdue|stale|breach/i.test(value(row, "status", "state", "result"))).map((row) => value(row, "owner", "owner name", "actor id")).filter(Boolean))]

  return <section className="story-section block-recap" aria-labelledby="recap-title">
    <header className="story-heading"><div><p className="story-kicker">05 · CURRENT GOVERNED UPDATE</p><h2 id="recap-title">What moved, what remains stalled, and whose update is overdue.</h2></div><p>Source-backed changes only.</p></header>
    <div className="recap-grid">
      <article><span>MOVED</span><ul>{verified.length ? verified.slice(0, 5).map((row, index) => <li key={`${value(row, "id", "action id")}-${index}`}><strong>{value(row, "status", "state") || "Verified"}</strong> {value(row, "title", "action", "objective") || "governed action"}</li>) : <li><strong>No verified movement</strong> in the connected source window</li>}</ul></article>
      <article><span>STILL STALLED</span><ul>{stalled.length ? stalled.map((row, index) => <li key={`${value(row, "id", "constraint id")}-${index}`}><strong>{value(row, "status", "state") || "Open"}</strong> {value(row, "title", "constraint", "label") || "governed constraint"}</li>) : <li><strong>No open constraint</strong> in governed data</li>}</ul></article>
      <article><span>NEWLY STALE</span><ul>{staleOwners.length ? staleOwners.map((owner) => <li key={owner}><strong>{owner}</strong> · update overdue</li>) : <li><strong>No overdue owner update</strong> in governed data</li>}</ul></article>
    </div>
  </section>
}
