import assert from "node:assert/strict"

import {
  buildLiveMemberEngagementCommand,
  buildLiveMemberEngagementFreshness,
  buildLiveMemberEngagementLoopHealth,
  buildLiveSelfDriveSnapshot,
} from "../lib/live-mappers/self-drive"

async function main() {
  const response = await fetch("http://localhost:3000/api/ops-data", { cache: "no-store" })
  assert.equal(response.ok, true, `ops-data request failed with ${response.status}`)

  const payload = await response.json() as { data?: Record<string, unknown> }
  assert.ok(payload.data, "ops-data response did not contain data")

  const snapshot = buildLiveSelfDriveSnapshot(payload.data)
  const freshness = buildLiveMemberEngagementFreshness(snapshot)
  const command = buildLiveMemberEngagementCommand(snapshot)
  const loopHealth = buildLiveMemberEngagementLoopHealth(snapshot)

  assert.equal(freshness.connected, true, "Member Engagement is not connected")
  assert.equal(freshness.feeds.length, 3, "Member Engagement must expose three source feeds")
  assert.deepEqual(
    freshness.feeds.map((feed) => feed.label),
    ["Member feedback", "Member NPS responses", "Member recovery actions"],
  )
  assert.equal(freshness.quarantinedRecords, 0, "Current source rows failed schema validation")
  assert.equal(command.hasData, true, "Retention command has no live source data")
  assert.equal(command.openSignals, 3, "Unexpected open Member signal count")
  assert.equal(command.recoveryGap, 12, "Recovery gap was not derived from target minus baseline")
  assert.equal(command.owner, "ACT-PRIYA", "Retention owner was not read from Action_Log")
  assert.equal(loopHealth.clocks.length, 1, "Recovery clock was not read from Action_Log")
  assert.equal(loopHealth.verification.claimed, 3, "Member feedback claims were not counted")
  assert.equal(loopHealth.verification.verified, 0, "Unexpected verified Member feedback")
  assert.equal(loopHealth.verification.awaiting, 3, "Awaiting evidence count is incorrect")

  console.log(JSON.stringify({
    connected: freshness.connected,
    sheetSnapshot: freshness.asOf,
    connectedFeeds: freshness.feeds.map((feed) => ({
      source: feed.label,
      ageMinutes: feed.ageMinutes,
      stale: feed.stale,
    })),
    staleFeedCount: freshness.staleFeedCount,
    quarantinedRecords: freshness.quarantinedRecords,
    retentionCommand: command,
    loopHealth: {
      state: loopHealth.state,
      staleFeeds: loopHealth.feeds.filter((feed) => feed.stale).length,
      runningClocks: loopHealth.clocks.filter((clock) => clock.state === "Running").length,
      breachedClocks: loopHealth.clocks.filter((clock) => clock.breached).length,
      verification: loopHealth.verification,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
