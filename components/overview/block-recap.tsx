import { EXECUTION_BLOCK_START, EXECUTION_REPORT_AS_OF, executionActions } from "@/lib/execution-data"
import { commitmentBlockChanges } from "@/lib/execution-control"

export function BlockRecap({ liveOpsData }: { liveOpsData: any }) {
  const unresolved = (liveOpsData.constraints ?? []).filter(
    (item: any) => item.stalledBlocks >= 2
  )

  const executionChanges = commitmentBlockChanges(
    executionActions,
    EXECUTION_BLOCK_START,
    EXECUTION_REPORT_AS_OF
  )

  return (
    <section className="story-section block-recap" aria-labelledby="recap-title">
      <header className="story-heading">
        <div>
          <p className="story-kicker">
            05 · SINCE THE LAST 2-HOUR UPDATE
          </p>

          <h2 id="recap-title">
            {`${liveOpsData.previousBlock.cm.toLocaleString("en-IN")} CM updated in the last block.`}
          </h2>
        </div>

        <p>Important changes only.</p>
      </header>

      <div className="recap-grid">

        {/* MOVED */}
        <article>
          <span>MOVED</span>

          <ul>
            {(liveOpsData.history ?? []).map((change: any) => (
              <li key={change.day}>
                <strong>
                  {change.actual?.toLocaleString("en-IN") ?? "0"}
                </strong>{" "}
                CM recorded on day {change.day}
              </li>
            ))}

            <li>
              <strong>
                +{executionChanges.verifiedClosures}
              </strong>{" "}
              Verified closure
              {executionChanges.verifiedClosures === 1 ? "" : "s"}
            </li>

            <li>
              <strong>
                {executionChanges.closedButNotResolved}
              </strong>{" "}
              closed but not resolved
            </li>
          </ul>
        </article>


        {/* STILL STALLED */}
        <article>
          <span>STILL STALLED</span>

          <ul>
            {unresolved.length > 0 ? (
              unresolved.map((item: any) => (
                <li key={item.id}>
                  <strong>
                    {item.stalledBlocks} blocks
                  </strong>{" "}
                  {item.title?.toLowerCase()}
                </li>
              ))
            ) : (
              <li>No active stalled items</li>
            )}
          </ul>
        </article>


        {/* NEWLY STALE */}
        <article>
          <span>NEWLY STALE</span>

          <ul>
            {liveOpsData.previousBlock.staleOwner ? (
              <li>
                <strong>
                  {liveOpsData.previousBlock.staleOwner}
                </strong>{" "}
                · update overdue
              </li>
            ) : (
              <li>No stale owner</li>
            )}
          </ul>
        </article>

      </div>
    </section>
  )
}