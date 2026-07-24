import assert from "node:assert/strict"
import test from "node:test"
import { buildRankedQueue, mismatchById } from "./allocation-engine"
import { teamBlocks, type FunnelStage } from "./operating-data"
import { diagnoseStage } from "./stage-diagnostics"

function findStage(teamName: string, stageLabel: string) {
  const team = teamBlocks.find((item) => item.name === teamName)
  const stage = team?.stages.find((item) => item.label === stageLabel)
  assert.ok(stage, `${teamName} / ${stageLabel} must exist`)
  return stage
}

test("Living, Essentials and People diagnostics match Overview action and owner exactly", () => {
  const queue = buildRankedQueue()
  const cases = [
    ["FONO Demand", "Members activated", "m-fono-idle-chakan"],
    ["Shram Park Supply", "Viable inside 2km", "m-sram-shortfall-sriperumbudur"],
    ["Essentials Supply", "Studio filled", "m-ess-stockout-hosur"],
  ] as const

  for (const [teamName, stageLabel, mismatchId] of cases) {
    const diagnostic = diagnoseStage(findStage(teamName, stageLabel))!
    const overview = queue.find((item) => item.id === mismatchId)!
    assert.equal(diagnostic.status, "not-working")
    assert.equal(diagnostic.mismatchId, overview.id)
    assert.equal(diagnostic.nextAction, overview.nextAction)
    assert.equal(diagnostic.accountableOwner, overview.accountableOwner)
  }
})

test("No-data mismatch blocks card action without changing the diagnostic reason", () => {
  const stale = mismatchById("m-ess-dataquality-sriperumbudur")!
  const stage: FunnelStage = {
    label: "Fill posted",
    today: 0,
    mtd: 18,
    todayConversion: 0,
    mtdConversion: 72,
    delta: "−2 vs MTD daily average",
    reason: "Zero movement today after daily movement this month.",
    diagnosticContext: { domain: stale.domain, joinKey: stale.joinKey },
  }
  const diagnostic = diagnoseStage(stage)!
  assert.equal(diagnostic.reason, "Zero movement today after daily movement this month.")
  assert.equal(diagnostic.nextAction, "No data: action pending verification")
  assert.equal(diagnostic.accountableOwner, "Finance analyst")
  assert.equal(diagnostic.forwardCmAtRisk24h, "No data")
})
