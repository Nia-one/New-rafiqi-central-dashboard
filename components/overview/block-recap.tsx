import { commitmentBlockChanges } from "@/lib/execution-control"

export function BlockRecap({ liveOpsData }: { liveOpsData: any }) {
  const unresolved = (liveOpsData.constraints ?? []).filter(
    (item: any) => item.stalledBlocks >= 2
  )

  const history = [...(liveOpsData.history ?? [])]
    .filter((point: any) => Number.isFinite(Number(point.actual)))
    .sort((left: any, right: any) => Date.parse(left.capturedAt || left.businessDate || "") - Date.parse(right.capturedAt || right.businessDate || ""))
  const latestCmPoint = history.at(-1)
  const currentCm = Number(latestCmPoint?.actual ?? liveOpsData.spine?.find((item: any) => item.id === "cm")?.actual ?? 0)
  const previousCm = Number(liveOpsData.previousBlock?.cm ?? 0)
  const cmMoved = currentCm - previousCm
  const snapshotAt = String(latestCmPoint?.capturedAt || liveOpsData?.meta?.snapshotAt || "")
  const snapshotMs = Date.parse(snapshotAt)
  const recordedBlockStart = String(liveOpsData.previousBlock?.snapshotTime || "")
  const blockStart = Number.isFinite(Date.parse(recordedBlockStart))
    ? recordedBlockStart
    : Number.isFinite(snapshotMs)
    ? new Date(snapshotMs - 2 * 60 * 60 * 1000).toISOString()
    : snapshotAt
  const executionChanges = commitmentBlockChanges(
    liveOpsData?.executionActions ?? [],
    blockStart,
    snapshotAt
  )
  const staleOwner = (liveOpsData?.executionActions ?? [])
    .filter((action: any) => !["Verified", "Dismissed"].includes(action.status))
    .find((action: any) => {
      const latest = action.actionLog?.at(-1)?.executed_at
      return latest && Number.isFinite(Date.parse(blockStart)) && Date.parse(latest) < Date.parse(blockStart)
    })?.owner || ""

  return (
    <section className="story-section block-recap" aria-labelledby="recap-title">
      <header className="story-heading">
        <div>
          <p className="story-kicker">
            05 · SINCE THE LAST 2-HOUR UPDATE
          </p>

          <h2 id="recap-title">
            {`${cmMoved >= 0 ? "+" : ""}${cmMoved.toLocaleString("en-IN")} CM updated in the last block.`}
          </h2>
        </div>

        <p>Important changes only.</p>
      </header>

      <div className="recap-grid">

        {/* MOVED */}
        <article>
          <span>MOVED</span>

          <ul>
            <li>
              <strong>{cmMoved >= 0 ? "+" : ""}{cmMoved.toLocaleString("en-IN")}</strong>{" "}
              CM since the previous recorded snapshot
            </li>

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
            {staleOwner ? (
              <li>
                <strong>
                  {staleOwner}
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
