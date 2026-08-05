import { blockChanges, blockNarrative, formatBlockChange, opsData, rankedConstraints } from "@/lib/ops-data"
import { EXECUTION_BLOCK_START, EXECUTION_REPORT_AS_OF, executionActions } from "@/lib/execution-data"
import { commitmentBlockChanges } from "@/lib/execution-control"

export function BlockRecap() {
  const unresolved = rankedConstraints().filter((item) => item.stalledBlocks >= 2)
  const executionChanges = commitmentBlockChanges(executionActions, EXECUTION_BLOCK_START, EXECUTION_REPORT_AS_OF)
  return (
    <section className="story-section block-recap" aria-labelledby="recap-title">
      <header className="story-heading"><div><p className="story-kicker">05 · SINCE THE LAST 2-HOUR UPDATE</p><h2 id="recap-title">{blockNarrative()}</h2></div><p>Important changes only.</p></header>
      <div className="recap-grid">
        <article><span>MOVED</span><ul>{blockChanges().map((change) => <li key={change.label}><strong>+{formatBlockChange(change)}</strong> {change.label.toLowerCase()}</li>)}<li><strong>+{executionChanges.verifiedClosures}</strong> Verified closure{executionChanges.verifiedClosures === 1 ? "" : "s"}</li><li><strong>{executionChanges.closedButNotResolved}</strong> closed but not resolved</li></ul></article>
        <article><span>STILL STALLED</span><ul>{unresolved.map((item) => <li key={item.id}><strong>{item.stalledBlocks} blocks</strong> {item.title.toLowerCase()}</li>)}</ul></article>
        <article><span>NEWLY STALE</span><ul>{opsData.previousBlock.staleOwners.map((owner) => <li key={owner}><strong>{owner}</strong> · update overdue</li>)}</ul></article>
      </div>
    </section>
  )
}
