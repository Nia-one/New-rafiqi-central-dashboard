import assert from "node:assert/strict"
import test from "node:test"
import { appendEvidence, createOperatingAction, transitionAction, type OperatingAction } from "@/lib/operating-loop/action-engine"
import {
  LIVING_SUPPLY_FIXTURE,
  buildLivingSupplyReport,
  createLivingGapEvent,
  livingOccupancyBand,
  livingSupplyPoliciesAt,
  routeLivingGap,
  verifyLivingSupplyClosure,
  type FonoGapContext,
  type LivingGapEvent,
  type SpGapContext,
} from "@/lib/operating-loop/living-supply-model"

const at = "2026-07-17T08:00:00+05:30"
const lineage = LIVING_SUPPLY_FIXTURE[0].lineage
const policies = livingSupplyPoliciesAt(at)

const cycle = (trigger: "Incident" | "Hourly heartbeat" = "Hourly heartbeat") => ({ cycleId: "CYCLE-1", trigger, triggerId: "TRIGGER-1", occurredAt: at }) as const

test("Living refresh renders FONO first, SP second, and only then a combined roll-up", () => {
  const report = buildLivingSupplyReport(LIVING_SUPPLY_FIXTURE, at)
  assert.deepEqual(report.channelOrder, ["FONO", "SP"])
  assert.deepEqual(report.channels.map((channel) => channel.supplyModel), ["FONO", "SP"])
  assert.equal(report.combined?.supplyModel, "Combined")
  assert.equal(report.combinedState, "Visible after FONO and SP")
  assert.equal(buildLivingSupplyReport(LIVING_SUPPLY_FIXTURE.filter((row) => row.supplyModel === "FONO"), at).combined, null)
})

test("Living economics preserve billed ARPU, separate leakage, and explicit CM source gaps", () => {
  const report = buildLivingSupplyReport(LIVING_SUPPLY_FIXTURE, at)
  const fono = report.channels[0]
  assert.equal(fono.billedArpu.value, (2_704_000 + 1_720_000) / (530 + 344))
  assert.equal(fono.collectionLeakage.value, (2_704_000 + 1_720_000) - (2_584_000 + 1_600_000))
  assert.equal(fono.cm1.state, "No data")
  assert.equal(fono.cm2.state, "No data")
  assert.equal(JSON.stringify(report).includes("Float"), false)
})

test("FONO sourcing and SP park readiness remain visible before aggregation", () => {
  const report = buildLivingSupplyReport(LIVING_SUPPLY_FIXTURE, at)
  assert.deepEqual(report.fono && { franchisee: report.fono.franchiseeSourcedMembers, nia: report.fono.niaFilledMembers }, { franchisee: 527, nia: 347 })
  assert.equal(report.fono?.niaFillRate.definitionRef, "MET-FONO-NIA-FILL@v1")
  assert.equal(report.spParks[0].blockingMilestone, "Hardware and amenity readiness")
  assert.equal(report.spParks[0].readiness.hardwareAmenities, "Blocked")
  assert.equal(report.spParks[0].capexExposureInr, 4_800_000)
  assert.match(report.spParks[0].lineage.studioMasterRowIdentity, /Studio_Master/)
})

test("versioned provisional policy keeps SP escalation faster than FONO", () => {
  assert.equal(policies.breakevenOccupancy, 0.78)
  assert.equal(policies.amberOccupancyFloor, 0.6)
  assert.equal(policies.spEscalationCycles, 1)
  assert.equal(policies.fonoEscalationCycles, 2)
  assert.ok(policies.spEscalationCycles < policies.fonoEscalationCycles)
  assert.equal(policies.provisional, true)
  assert.equal(policies.calibrationNote, "Calibrate after the first real SP")
  assert.match(policies.operatingCycleDefinition, /incident trigger or hourly heartbeat, whichever occurs first/i)
})

test("occupancy bands use the governed Amber and breakeven policies", () => {
  assert.equal(livingOccupancyBand(0.78, policies), "healthy")
  assert.equal(livingOccupancyBand(0.779, policies), "watch")
  assert.equal(livingOccupancyBand(0.6, policies), "watch")
  assert.equal(livingOccupancyBand(0.599, policies), "low")
})

test("routing uses the channel-correct sequence and governed cycle threshold", () => {
  const fonoBase: FonoGapContext = { supplyModel: "FONO", studioId: "ST-FONO", franchiseePipelineHealthy: false, baseCommitmentMet: false, niaDemandSupportActive: false, occupancyRatio: 0.6, consecutiveBelowBreakevenCycles: 1, cycle: cycle(), lineage }
  assert.equal(routeLivingGap(fonoBase, policies).primaryRoute, "Franchisee pipeline / base commitment")
  assert.equal(routeLivingGap({ ...fonoBase, franchiseePipelineHealthy: true, baseCommitmentMet: true }, policies).primaryRoute, "Nia demand channels")
  assert.equal(routeLivingGap({ ...fonoBase, franchiseePipelineHealthy: true, baseCommitmentMet: true, niaDemandSupportActive: true, consecutiveBelowBreakevenCycles: 2 }, policies).primaryRoute, "Franchise review")

  const spBase: SpGapContext = { supplyModel: "SP", studioId: "ST-SP", enterpriseDemandNests: 120, enterpriseContractCoveredNests: 80, activationReadyNests: 100, blockingMilestone: "Hardware readiness", unresolvedCycles: 1, cycle: cycle("Incident"), lineage }
  assert.equal(routeLivingGap(spBase, policies).primaryRoute, "Enterprise contract coverage")
  const readiness = routeLivingGap({ ...spBase, enterpriseContractCoveredNests: 120 }, policies)
  assert.equal(readiness.primaryRoute, "SP readiness / capacity")
  assert.equal(readiness.blockingMilestone, "Hardware readiness")
  assert.equal(readiness.escalationRequired, true)
})

function verifiedAction(event: LivingGapEvent): OperatingAction {
  let action = createOperatingAction({ actionId: "ACTION-LIVING-1", demandId: "DEMAND-1", studioId: event.studioId, supplyModel: event.supplyModel, playbook: event.playbook, title: "Resolve supply gap", ownerActorId: "OWNER", verifierActorId: "VERIFIER", dueAt: "2026-07-18T08:00:00+05:30", governedChanges: ["operational"], metricId: "MET-LIVING-OCCUPANCY", expectedImpact: "Restore occupancy", confidence: 0.8, at, actorId: "ORCHESTRATOR" })
  const move = (to: Parameters<typeof transitionAction>[1]["to"], actorId: string, verifierActorId?: string) => { action = transitionAction(action, { to, actorId, verifierActorId, occurredAt: at, note: to, expectedVersion: action.version }) }
  move("Proposed", "ORCHESTRATOR")
  move("Auto-approved", "ORCHESTRATOR")
  move("Assigned", "LEAD")
  move("In progress", "OWNER")
  action = appendEvidence(action, { evidenceId: "EVIDENCE-1", protectedRef: "protected://living/1", submittedBy: "OWNER", submittedAt: at, description: "Governed closure proof" }, action.version)
  move("Proof submitted", "OWNER")
  move("Verified", "VERIFIER", "VERIFIER")
  return action
}

test("verification fails when supply context is missing or the playbook is mismatched", () => {
  const context: FonoGapContext = { supplyModel: "FONO", studioId: "ST-FONO", franchiseePipelineHealthy: true, baseCommitmentMet: true, niaDemandSupportActive: false, occupancyRatio: 0.8, consecutiveBelowBreakevenCycles: 0, cycle: cycle(), lineage }
  const event = createLivingGapEvent(context, policies)
  const action = verifiedAction(event)
  assert.throws(() => verifyLivingSupplyClosure({ event, action, supplyModel: null, playbook: "FONO gap", verifierActorId: "VERIFIER", verifiedAt: at }), /requires the governed supply_model/)
  assert.throws(() => verifyLivingSupplyClosure({ event, action, supplyModel: "FONO", playbook: "SP gap", verifierActorId: "VERIFIER", verifiedAt: at }), /must match/)
  assert.equal(verifyLivingSupplyClosure({ event, action, supplyModel: "FONO", playbook: "FONO gap", verifierActorId: "VERIFIER", verifiedAt: at }).result, "Verified")
})
