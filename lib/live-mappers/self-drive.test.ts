import assert from "node:assert/strict"
import test from "node:test"
import { buildLiveMarginInputs, buildLiveMemberEngagementActions, buildLiveMemberEngagementBackground, buildLiveMemberEngagementCommand, buildLiveMemberEngagementFreshness, buildLiveMemberEngagementHeadlineMeasures, buildLiveMemberEngagementLoopHealth, buildLiveMemberEngagementRepeatIssues, buildLiveMemberSavingsFreshness, buildLiveMemberSavingsHealth, buildLiveMemberSavingsTasks, buildLiveNiaGrowthProjection, buildLiveNewAddsFillStatus, buildLiveNewAddsFillTasks, buildLiveNewAddsProof, buildLiveNewAddsTheatreProgress, buildLiveNewAddsVacancyGroups, buildLiveSelfDriveSnapshot, filterLiveSelfDriveSnapshot } from "./self-drive"

const snapshot = buildLiveSelfDriveSnapshot({
  meta: { updatedAt: "2026-07-26T12:00:00+05:30" },
  monthlyCMTarget: 1000,
  theatres: [
    { "theatre id": "T1", "theatre name": "North", geography: "Delhi" },
    { "theatre id": "T2", "theatre name": "South", geography: "Chennai" },
  ],
  studios: [
    { "studio id": "S1", "studio name": "One", "theatre id": "T1", address: "Delhi", active: "TRUE" },
    { "studio id": "S2", "studio name": "Two", "theatre id": "T2", address: "Chennai", active: "TRUE" },
  ],
  people: [
    { "actor id": "P1", "display name": "A", "theatre id": "T1", "studio id": "S1" },
    { "actor id": "P2", "display name": "B", "theatre id": "T2", "studio id": "S2" },
  ],
  finance: [
    { "finance daily id": "F1", "theatre id": "T1", "studio id": "S1", "cash balance inr": "100" },
    { "finance daily id": "F2", "theatre id": "T2", "studio id": "S2", "cash balance inr": "200" },
  ],
  actionLog: [
    { "action id": "A1", "owner actor id": "P1", state: "Proposed" },
    { "action id": "A2", "owner actor id": "P2", state: "Proposed" },
  ],
  approvalLog: [
    { "approval id": "AP1", "linked action id": "A1", "approver actor id": "P1" },
    { "approval id": "AP2", "linked action id": "A2", "approver actor id": "P2" },
  ],
  evidenceLog: [
    { "evidence id": "E1", "linked id": "A1", "uploaded by actor id": "P1" },
    { "evidence id": "E2", "linked id": "A2", "uploaded by actor id": "P2" },
  ],
  learningHistory: [
    { "learning id": "L1", "owner actor id": "P1", domain: "Living", observed: "North result" },
    { "learning id": "L2", "owner actor id": "P2", domain: "Living", observed: "South result" },
  ],
})

test("margin inputs exclude incomplete or impossible capacity rows", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-29T18:30:00+05:30" },
    living: [
      { "living hourly id": "L-VALID", "studio id": "S-VALID", "theatre id": "T1", "contracted nests": 100, "occupied nests": 83 },
      { "living hourly id": "L-MISSING-CAPACITY", "studio id": "S-ZERO", "theatre id": "T1", "contracted nests": 0, "occupied nests": 20 },
      { "living hourly id": "L-OVER-CAPACITY", "studio id": "S-OVER", "theatre id": "T1", "contracted nests": 50, "occupied nests": 72 },
    ],
  })

  const inputs = buildLiveMarginInputs(live)

  assert.deepEqual(inputs.map((input) => input.studioId), ["S-VALID"])
  assert.equal(inputs[0].contractedNests, 100)
  assert.equal(inputs[0].occupiedNests, 83)
})

test("theatre and location filters retain only linked operating records", () => {
  const filtered = filterLiveSelfDriveSnapshot(snapshot, { theatre: "T1", location: "Delhi", studio: "", person: "" })
  assert.deepEqual(filtered.finance.map((row) => row["finance daily id"]), ["F1"])
  assert.deepEqual(filtered.actions.map((row) => row["action id"]), ["A1"])
  assert.deepEqual(filtered.approvals.map((row) => row["approval id"]), ["AP1"])
  assert.deepEqual(filtered.evidence.map((row) => row["evidence id"]), ["E1"])
  assert.deepEqual(filtered.learningHistory.map((row) => row["learning id"]), ["L1"])
})

test("person filter follows the owner and keeps global targets", () => {
  const filtered = filterLiveSelfDriveSnapshot(snapshot, { theatre: "", location: "", studio: "", person: "P2" })
  assert.deepEqual(filtered.actions.map((row) => row["action id"]), ["A2"])
  assert.equal(filtered.monthlyCMTarget, 1000)
  assert.equal(filtered.finance.length, 2)
})

test("unknown location returns no dimensional rows", () => {
  const filtered = filterLiveSelfDriveSnapshot(snapshot, { theatre: "", location: "Unknown", studio: "", person: "" })
  assert.equal(filtered.finance.length, 0)
  assert.equal(filtered.financeSource.length, 2, "connected Finance_Daily source health must survive an empty filter result")
  assert.equal(filtered.actions.length, 0)
  assert.equal(filtered.theatres.length, 0)
})

test("location is resolved through Studio_Master so one theatre may have multiple locations", () => {
  const multiLocation = buildLiveSelfDriveSnapshot({
    theatres: [{ "theatre id": "T1", "theatre name": "Rajputana", geography: "Farukhnagar / Manesar", active: "TRUE" }],
    studios: [
      { "studio id": "FN", "theatre id": "T1", address: "Farukhnagar", active: "TRUE" },
      { "studio id": "MNS", "theatre id": "T1", address: "Manesar", active: "TRUE" },
    ],
    living: [
      { "living hourly id": "L-FN", "theatre id": "T1", "studio id": "FN" },
      { "living hourly id": "L-MNS", "theatre id": "T1", "studio id": "MNS" },
    ],
  })
  const filtered = filterLiveSelfDriveSnapshot(multiLocation, { theatre: "T1", location: "Manesar", studio: "", person: "" })
  assert.deepEqual(filtered.studios.map((row) => row["studio id"]), ["MNS"])
  assert.deepEqual(filtered.living.map((row) => row["living hourly id"]), ["L-MNS"])
})

test("studio and location filters do not repeat theatre-only totals as studio results", () => {
  const granular = buildLiveSelfDriveSnapshot({
    theatres: [{ "theatre id": "T1", active: "TRUE" }],
    studios: [{ "studio id": "S1", "theatre id": "T1", address: "Delhi", active: "TRUE" }],
    finance: [{ "finance daily id": "F-THEATRE", "theatre id": "T1", "cash balance inr": 100 }],
  })
  const filtered = filterLiveSelfDriveSnapshot(granular, { theatre: "T1", location: "Delhi", studio: "S1", person: "" })
  assert.equal(filtered.finance.length, 0)
  assert.equal(filtered.financeSource.length, 1)
})

test("Member Engagement name-based Sheet rows follow theatre and studio filters", () => {
  const live = buildLiveSelfDriveSnapshot({
    theatres: [
      { "theatre id": "T1", "theatre name": "Deccan (Pune)", active: "TRUE" },
      { "theatre id": "T2", "theatre name": "Coromandel (Tamil Nadu)", active: "TRUE" },
    ],
    studios: [
      { "studio id": "S1", "studio name": "Chakan 04", "theatre id": "T1", address: "Pune", active: "TRUE" },
      { "studio id": "S2", "studio name": "Sriperumbudur 02", "theatre id": "T2", address: "Sriperumdur", active: "TRUE" },
    ],
    memberNpsFeedback: [
      { id: "F1", theatre: "Deccan (Pune)", studio: "Chakan 04" },
      { id: "F2", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
    ],
    memberNpsResponses: [
      { id: "R1", theatre: "Deccan (Pune)", studio: "Chakan 04" },
      { id: "R2", theatre: "Coromandel (Tamil Nadu)", studio: "Sriperumbudur 02" },
    ],
  })

  const filtered = filterLiveSelfDriveSnapshot(live, { theatre: "T2", location: "Sriperumdur", studio: "S2", person: "" })
  assert.deepEqual(filtered.memberNpsFeedback.map((row) => row.id), ["F2"])
  assert.deepEqual(filtered.memberNpsResponses.map((row) => row.id), ["R2"])
})

test("Member Adds uses only contracted FONO Funnel Nest potential and excludes SP and existing Studios", () => {
  const live = buildLiveSelfDriveSnapshot({
    enterpriseDemand: [
      { "demand id": "OPS-RPT-FONO-1", status: "Onboarded", "headcount required": "96", "headcount matched": "72", "owner actor id": "P1" },
      { "demand id": "SP-BOT-1", status: "Contracted", "headcount required": "150", "headcount matched": "110", "owner actor id": "P1" },
    ],
    living: [{ "studio id": "EXISTING-1", "supply model": "EXISTING", "contracted nests": "1000", "occupied nests": "900" }],
    people: [{ "actor id": "P1", "display name": "Priya" }],
  })

  assert.deepEqual(buildLiveNewAddsFillStatus(live), {
    hasData: true,
    target: 96,
    verified: 72,
    gap: 24,
    progressPercent: 75,
    owner: "Priya",
  })
  assert.deepEqual(buildLiveNewAddsTheatreProgress(live).map((row) => [row.theatre, row.dailyTarget, row.verifiedBillingLiveFills, row.vacantNests]), [
    ["FONO", 96, 72, 24],
  ])
})

test("Member Adds vacancy list groups only contracted FONO opportunities", () => {
  const live = buildLiveSelfDriveSnapshot({
    enterpriseDemand: [
      { "demand id": "OPS-RPT-FONO-1", status: "Contracted", "enterprise name": "Alpha", "headcount required": "100", "headcount matched": "80" },
      { "demand id": "OPS-RPT-FONO-2", status: "Onboarded", "enterprise name": "Beta", "headcount required": "50", "headcount matched": "45" },
      { "demand id": "SP-BOT-1", status: "Contracted", "enterprise name": "Park One", "headcount required": "100", "headcount matched": "60" },
      { "demand id": "OPS-RPT-FONO-LEAD", status: "Lead", "headcount required": "999", "headcount matched": "0" },
    ],
  })
  assert.deepEqual(buildLiveNewAddsVacancyGroups(live).map((group) => [group.theatre, group.contractedNests, group.occupiedNests, group.pendingNests]), [
    ["FONO", 150, 125, 25],
  ])
})

test("Member Adds vacancy owner comes from the contracted supply record", () => {
  const live = buildLiveSelfDriveSnapshot({
    theatres: [{ "theatre id": "T-NORTH", "theatre name": "North", "lead actor id": "P-NORTH" }],
    people: [{ "actor id": "P-NORTH", "display name": "North Lead" }],
    enterpriseDemand: [{ "demand id": "OPS-RPT-FONO-1", status: "Contracted", "headcount required": "20", "headcount matched": "10", "owner actor id": "P-NORTH" }],
  })
  assert.equal(buildLiveNewAddsTheatreProgress(live)[0].ownerRole, "North Lead")
  assert.equal(buildLiveNewAddsFillStatus(live).owner, "North Lead")
})

test("Member Adds accepts canonical FONO-TRACKER backend IDs", () => {
  const live = buildLiveSelfDriveSnapshot({
    enterpriseDemand: [
      { "demand id": "FONO-TRACKER-1", "source submission id": "FONO-TRACKER-1", status: "Onboarded (Takeover Pending)", "headcount required": "52", "headcount matched": "52" },
      { "demand id": "FONO-TRACKER-LEAD", status: "Lead", "headcount required": "150", "headcount matched": "0" },
      { "demand id": "FONO-TRACKER-CONTRACTING", status: "Contracting", "headcount required": "424", "headcount matched": "0" },
    ],
  })

  assert.deepEqual(buildLiveNewAddsFillStatus(live), {
    hasData: true,
    target: 52,
    verified: 52,
    gap: 0,
    progressPercent: 100,
    owner: "Living Operations",
  })
})

test("Member Adds proof and controls never retain synthetic KPI values", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T13:37:00+05:30" },
    theatres: [{ "theatre id": "T1", "theatre name": "Coromandel" }],
    enterpriseDemand: [
      { "demand id": "OPS-RPT-FONO-1", status: "Contracted", "enterprise name": "Sriperumbudur 01", "headcount required": "96", "headcount matched": "72", "owner actor id": "P1", "updated at": "2026-07-26T13:32:00+05:30" },
      { "demand id": "SP-BOT-LEAD", status: "Lead", "headcount required": "20", "headcount matched": "10" },
    ],
    living: [
      { "theatre id": "T1", "studio id": "FONO-1", "supply model": "FONO", "activation ready nests": "96", "occupied nests": "72", "next action owner actor id": "P1", "updated at": "2026-07-26T13:32:00+05:30" },
      { "theatre id": "T1", "studio id": "SP-1", "supply model": "SP", "activation ready nests": "20", "occupied nests": "10" },
    ],
    people: [{ "actor id": "P1", "display name": "Priya" }],
    memberActivation: [
      { "activation id": "ACTV-1", "member token": "M1", "studio id": "OPS-RPT-FONO-1", "verification status": "Verified", "membership billed inr": "1500", "activated at": "2026-07-26T10:00:00+05:30", "verified at": "2026-07-26T10:30:00+05:30", "updated at": "2026-07-26T13:27:00+05:30" },
      { "activation id": "ACTV-1-DUPLICATE", "member token": "M1", "studio id": "OPS-RPT-FONO-1", "verification status": "Verified", "membership billed inr": "1500", "activated at": "2026-07-26T10:00:00+05:30", "verified at": "2026-07-26T10:30:00+05:30", "updated at": "2026-07-26T13:27:00+05:30" },
    ],
    incidentLog: [{ "incident id": "I1", domain: "Living", "theatre id": "T1", "studio id": "FONO-1" }],
    actionLog: [{ "action id": "A1", "studio id": "OPS-RPT-FONO-1", "owner actor id": "P1", "due at": "2026-07-22T16:00:00+05:30", state: "Detected", "updated at": "2026-07-26T13:17:00+05:30" }],
    evidenceLog: [
      { "evidence id": "E1", "linked id": "A1", "uploaded at": "2026-07-26T12:00:00+05:30", "updated at": "2026-07-26T13:22:00+05:30", "verification status": "Pending" },
      { "evidence id": "E1", "linked id": "A1", "uploaded at": "2026-07-26T12:00:00+05:30", "updated at": "2026-07-26T13:22:00+05:30", "verification status": "Pending" },
    ],
  })
  const proof = buildLiveNewAddsProof(live)
  assert.equal(proof.measures[0].primary, "24 Nests still to fill")
  assert.equal(proof.measures[0].secondary, "72 of 96 contracted/onboarded FONO Nests filled · 75%")
  assert.equal(proof.measures[1].primary, "Source not recorded")
  assert.equal(proof.measures[2].primary, "No verified CAC")
  assert.equal(proof.measures[3].primary, "30 minutes")
  assert.deepEqual(proof.loopHealth.verification, { claimed: 2, verified: 1, awaiting: 1, reopened: 0, oldestAwaitingAt: "2026-07-26T12:00:00+05:30", backlogAgeHours: 1, backlogBeyondLimit: false })
  assert.equal(proof.loopHealth.clocks[0].breached, true)
  assert.deepEqual(proof.loopHealth.feeds.map((feed) => feed.ageMinutes), [0, 10, 15])
  assert.equal(proof.loopHealth.quarantinedRecords, 0)
})

test("Member Adds returns an honest no-data state instead of a fixture fallback", () => {
  assert.deepEqual(buildLiveNewAddsFillStatus(buildLiveSelfDriveSnapshot({})), {
    hasData: false,
    target: 0,
    verified: 0,
    gap: 0,
    progressPercent: 0,
    owner: "Unassigned",
  })
})

test("Nia Growth summary derives its target, current and owner from separate FONO and Shram Park demand", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T12:00:00+05:30" },
    enterpriseDemand: [
      { "demand id": "OPS-RPT-FONO-1", "role required": "Living supply", "headcount required": "120", "headcount matched": "96", "owner actor id": "P1", "updated at": "2026-07-26T12:00:00+05:30" },
      { "demand id": "SP-BOT-1", "headcount required": "180", "headcount matched": "84", "owner actor id": "P2", "updated at": "2026-07-26T12:00:00+05:30" },
    ],
    people: [
      { "actor id": "P1", "display name": "Priya" },
      { "actor id": "P2", "display name": "Ravi" },
    ],
  })
  const projection = buildLiveNiaGrowthProjection(live)
  assert.equal(projection.summary.target, "300 required Nests")
  assert.equal(projection.summary.current, "180 matched Nests")
  assert.equal(projection.summary.gap, "120 Nests")
  assert.equal(projection.summary.owner, "Priya")
  assert.match(projection.measures[0].value, /180/)
  assert.match(projection.measures[0].detail, /FONO Funnel and Shram Park/)
  assert.equal(projection.measures[1].target, "Approved readiness SLA not recorded")
  assert.match(projection.measures[2].value, /FONO 96/)
  assert.match(projection.measures[2].detail, /Studio occupancy is not inferred/)
})

test("Nia Growth totals exclude demand rows quarantined for missing freshness evidence", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T12:00:00+05:30" },
    enterpriseDemand: [
      { "demand id": "OPS-RPT-FONO-1", "headcount required": "120", "headcount matched": "96", "updated at": "2026-07-26T12:00:00+05:30" },
      { "demand id": "SP-BOT-1", "headcount required": "200", "headcount matched": "150", "updated at": "" },
    ],
  })
  const projection = buildLiveNiaGrowthProjection(live)
  assert.equal(projection.summary.target, "120 required Nests")
  assert.equal(projection.summary.current, "96 matched Nests")
  assert.equal(projection.summary.gap, "24 Nests")
})

test("Self Drive snapshot uses ingestion time instead of Sheet update time for freshness", () => {
  const live = buildLiveSelfDriveSnapshot({ meta: { updatedAt: "2026-07-26T12:00:00+05:30" }, fetchedAt: "2026-07-28T12:00:00+05:30" })
  assert.equal(live.asOf, "2026-07-28T12:00:00+05:30")
})

test("Member Adds ignores existing Studio occupancy rows", () => {
  const live = buildLiveSelfDriveSnapshot({
    theatres: [{ "theatre id": "T1", "theatre name": "Coromandel" }],
    living: [{ "theatre id": "T1", "studio id": "SP-1", "supply model": "SP", "activation ready nests": "20", "occupied nests": "10" }],
    incidentLog: [{ "incident id": "I-SP", domain: "Living", "theatre id": "T1", "studio id": "SP-1" }],
    actionLog: [{ "action id": "A-SP", "incident id": "I-SP", "operating objective": "Complete park readiness", state: "Detected" }],
  })
  const proof = buildLiveNewAddsProof(live)
  assert.equal(proof.measures[0].primary, "0 Nests still to fill")
  assert.equal(proof.loopHealth.verification.claimed, 0)
  assert.equal(proof.loopHealth.quarantinedRecords, 0)
})

test("Member Adds does not treat the existing Studios tab as FONO or SP supply", () => {
  const live = buildLiveSelfDriveSnapshot({
    theatres: [{ "theatre id": "T1", "theatre name": "Coromandel" }],
    living: [
      { "theatre id": "T1", "studio id": "STUDIO-1", "supply model": "EXISTING", "source submission id": "OPS-RPT-OCC-SRC-1", "contracted nests": "100", "occupied nests": "82" },
      { "theatre id": "T1", "studio id": "SP-1", "supply model": "SP", "contracted nests": "50", "occupied nests": "10" },
    ],
  })

  assert.equal(buildLiveNewAddsFillStatus(live).hasData, false)
})

test("Member Adds fill tasks use Action_Log rows linked to contracted FONO supply", () => {
  const live = buildLiveSelfDriveSnapshot({
    theatres: [{ "theatre id": "T1", "theatre name": "Coromandel" }],
    studios: [{ "studio id": "FONO-1", "studio name": "Nia Nest Menaka", "theatre id": "T1" }],
    living: [{ "theatre id": "T1", "studio id": "FONO-1", "supply model": "FONO" }],
    enterpriseDemand: [{ "demand id": "OPS-RPT-FONO-1", status: "Contracted", "headcount required": "20", "headcount matched": "10" }],
    people: [{ "actor id": "P1", "display name": "Priya" }],
    actionLog: [{ "action id": "A-DIRECT", "studio id": "OPS-RPT-FONO-1", "operating objective": "Recover FONO fill readiness", "owner actor id": "P1", "due at": "2026-07-27T16:00:00+05:30", state: "Detected" }],
  })

  assert.deepEqual(buildLiveNewAddsFillTasks(live).map((row) => row.actionId), ["A-DIRECT"])
})

test("Member Adds fill tasks come only from contracted FONO supply actions", () => {
  const live = buildLiveSelfDriveSnapshot({
    theatres: [{ "theatre id": "T1", "theatre name": "Coromandel" }],
    studios: [{ "studio id": "FONO-1", "studio name": "Nia Nest Menaka", "theatre id": "T1" }],
    living: [
      { "theatre id": "T1", "studio id": "FONO-1", "supply model": "FONO" },
      { "theatre id": "T1", "studio id": "SP-1", "supply model": "SP" },
    ],
    enterpriseDemand: [
      { "demand id": "OPS-RPT-FONO-1", status: "Contracted", "headcount required": "20", "headcount matched": "10" },
      { "demand id": "SP-BOT-1", status: "Lead", "headcount required": "20", "headcount matched": "0" },
    ],
    people: [{ "actor id": "P1", "display name": "Priya" }],
    incidentLog: [
      { "incident id": "I-FONO", domain: "Living", "theatre id": "FONO", "studio id": "OPS-RPT-FONO-1", "owner actor id": "P1" },
      { "incident id": "I-SP", domain: "Living", "theatre id": "T1", "studio id": "SP-1", "owner actor id": "P1" },
    ],
    actionLog: [
      { "action id": "A-FONO", "incident id": "I-FONO", "operating objective": "Allocate demand to ready nests", "owner actor id": "P1", "due at": "2026-07-27T16:00:00+05:30", "required evidence": "Verified activation records", state: "Detected" },
      { "action id": "A-SP", "incident id": "I-SP", "operating objective": "Complete park readiness", state: "Detected" },
      { "action id": "A-FIN", "operating objective": "Approve cost exception", state: "Proposed" },
    ],
  })

  assert.deepEqual(buildLiveNewAddsFillTasks(live).map((row) => ({
    actionId: row.actionId,
    studioId: row.studioId,
    theatre: row.theatre,
    ownerRole: row.ownerRole,
    dueAt: row.dueAt,
    expectedOutcome: row.expectedOutcome,
    state: row.state,
    nextAction: row.nextAction,
  })), [{
    actionId: "A-FONO",
    studioId: "OPS-RPT-FONO-1",
    theatre: "FONO",
    ownerRole: "Priya",
    dueAt: "2026-07-27T16:00:00+05:30",
    expectedOutcome: "Verified activation records",
    state: "Assigned",
    nextAction: "Allocate demand to ready nests",
  }])
})

test("Member Engagement command stays honest when feedback exists without a governed action", () => {
  const live = buildLiveSelfDriveSnapshot({
    memberNpsFeedback: [{ id: "FB-1", "member token": "Member A", "captured at": "2026-07-26T16:30:00+05:30", "action id": "A-1" }],
  })
  const command = buildLiveMemberEngagementCommand(live)
  assert.equal(command.hasData, false)
  assert.equal(command.owner, "Unassigned")
  assert.equal(command.openSignals, 1)
})

test("Member Engagement freshness uses the three connected Sheet feeds and validates rows", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T17:00:00+05:30" },
    memberNpsFeedback: [{ id: "FB-1", "member token": "Member A", "captured at": "2026-07-26T16:30:00+05:30" }],
    memberNpsResponses: [{ id: "NPS-1", "member token": "Member A", score: "8", "collected at": "2026-07-18T10:00:00+05:30" }],
    actionLog: [{ "action id": "SD-ACTION-ENG-1", "operating objective": "Member engagement recovery", "owner actor id": "P1", "due at": "2026-07-27T14:00:00+05:30", "proposed at": "2026-07-26T16:00:00+05:30" }],
  })
  const freshness = buildLiveMemberEngagementFreshness(live)
  assert.equal(freshness.connected, true)
  assert.equal(freshness.feeds.length, 3)
  assert.equal(freshness.quarantinedRecords, 0)
  assert.deepEqual(freshness.feeds.map((feed) => feed.label), ["Member feedback", "Member NPS responses", "Member recovery actions"])
})

test("Member Engagement command derives its gap and owner from the Sheet action", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T17:00:00+05:30" },
    memberNpsFeedback: [
      { id: "FB-1", "action id": "feedback-1", "member token": "Member A", "captured at": "2026-07-26T16:30:00+05:30" },
      { id: "FB-2", "action id": "feedback-2", "member token": "Member B", "captured at": "2026-07-26T16:30:00+05:30" },
    ],
    actionLog: [{ "action id": "SD-ACTION-ENG-1", "operating objective": "Approve member engagement recovery policy", "baseline value": "8", "target value": "20", "owner actor id": "ACT-PRIYA", state: "Proposed", "due at": "2026-07-27T14:00:00+05:30" }],
    people: [{ "actor id": "ACT-PRIYA", "display name": "Priya Rao (Test)" }],
    evidenceLog: [],
  })
  const command = buildLiveMemberEngagementCommand(live)
  assert.equal(command.hasData, true)
  assert.equal(command.openSignals, 2)
  assert.equal(command.baselineRecovered, 8)
  assert.equal(command.targetRecovered, 20)
  assert.equal(command.recoveryGap, 12)
  assert.equal(command.owner, "Priya Rao (Test)")
  assert.equal(command.ownerActorId, "ACT-PRIYA")
  assert.equal(command.state, "Proposed")
})

test("Member Engagement action cards join feedback, actions, evidence and people without local input", () => {
  const live = buildLiveSelfDriveSnapshot({
    memberNpsFeedback: [
      { id: "FB-1", "action id": "ENG-1", "member token": "C-041", category: "Housekeeping", summary: "Housekeeping recovery is required" },
      { id: "FB-2", "action id": "ENG-2", "member token": "C-103", category: "Food quality", summary: "Replacement batch is required" },
    ],
    actionLog: [
      { "action id": "ENG-1", "operating objective": "Recover housekeeping", "owner actor id": "P1", "due at": "2026-07-27T15:00:00+05:30", "required evidence": "Recovery proof", state: "Proof submitted" },
      { "action id": "ENG-2", "operating objective": "Recover food quality", "owner actor id": "P1", "due at": "2026-07-27T17:00:00+05:30", state: "Reopened", "reopen reason": "Evidence did not confirm recovery" },
    ],
    evidenceLog: [
      { "evidence id": "E1", "linked id": "ENG-1", "verification status": "Pending" },
      { "evidence id": "E2", "linked id": "ENG-2", "verification status": "Rejected", "rejected reason": "Rejected proof" },
    ],
    people: [{ "actor id": "P1", "display name": "Priya Rao" }],
  })
  const actions = buildLiveMemberEngagementActions(live)
  assert.deepEqual(actions.map((row) => [row.memberLabel, row.owner, row.state, row.action]), [
    ["Protected Member · C-041", "Priya Rao", "Awaiting verification", "Recover housekeeping"],
    ["Protected Member · C-103", "Priya Rao", "Reopened", "Recover food quality"],
  ])
  assert.match(actions[0].progress, /pending independent verification/)
  assert.equal(actions[1].progress, "Evidence did not confirm recovery")
})

test("Member Engagement repeat issues join incidents, actions, evidence and people", () => {
  const live = buildLiveSelfDriveSnapshot({
    incidentLog: [
      { "incident id": "ME-INC-1", domain: "Member Engagement", "incident type": "Recurring service issue", "short description": "Repeated housekeeping friction", severity: "High", "severity reason": "The same service failure returned", "owner actor id": "P1", "due at": "2026-07-27T15:00:00+05:30", state: "Open" },
      { "incident id": "ME-INC-CLOSED", domain: "Member Engagement", "incident type": "Recurring service issue", "short description": "Closed issue", severity: "High", state: "Open" },
    ],
    actionLog: [
      { "action id": "ME-ACT-1", "incident id": "ME-INC-1", "operating objective": "Recover housekeeping", "owner actor id": "P1", "due at": "2026-07-27T16:00:00+05:30", "required evidence": "Verified service recovery", state: "Proof submitted" },
      { "action id": "ME-ACT-CLOSED", "incident id": "ME-INC-CLOSED", "operating objective": "Close issue", "owner actor id": "P1", state: "Closed" },
    ],
    evidenceLog: [{ "evidence id": "ME-EVD-1", "linked id": "ME-ACT-1", "verification status": "Pending" }],
    people: [{ "actor id": "P1", "display name": "Priya Rao" }],
  })
  assert.deepEqual(buildLiveMemberEngagementRepeatIssues(live), [{
    incidentId: "ME-INC-1",
    title: "Repeated housekeeping friction",
    severity: "High",
    owner: "Priya Rao",
    dueAt: "2026-07-27T16:00:00+05:30",
    state: "Awaiting verification",
    action: "Recover housekeeping",
    whyItMatters: "The same service failure returned",
    alreadyDid: "Recorded ME-INC-1 and routed ME-ACT-1 to Priya Rao.",
    whatHappensNext: "Verified service recovery",
  }])
})

test("Member Engagement background replaces every fixture block with joined Sheet records", () => {
  const live = buildLiveSelfDriveSnapshot({
    memberNpsDashboard: [
      { key: "member_engagement_survey_nps_score", "value number": "41" },
      { key: "member_engagement_survey_nps_responses", "value number": "32" },
      { key: "member_engagement_survey_nps_method", "value text": "Approved survey responses only" },
      { key: "member_engagement_behavioural_nps_score", "value number": "34" },
      { key: "member_engagement_behavioural_nps_records", "value number": "57" },
      { key: "member_engagement_behavioural_nps_weeks", "value number": "6" },
      { key: "member_engagement_behavioural_nps_method", "value text": "Own-baseline behaviour and verified recovery" },
      { key: "member_engagement_exit_reason_service_friction", label: "Service friction", "value number": "5", "value text": "3" },
      { key: "member_engagement_forecast_error", "value text": "8%" },
    ],
    incidentLog: [{ "incident id": "ME-INC-1", domain: "Member Engagement", "short description": "Repeated housekeeping friction", state: "Open", "reported at": "2026-07-26T09:00:00+05:30" }],
    actionLog: [{ "action id": "ME-ACT-1", "incident id": "ME-INC-1", "operating objective": "Recover housekeeping", state: "Proof submitted", "updated at": "2026-07-26T10:00:00+05:30" }],
    evidenceLog: [{ "evidence id": "ME-EVD-1", "linked id": "ME-ACT-1", "verification status": "Verified", "evidence type": "Recovery proof", "uploaded at": "2026-07-26T11:00:00+05:30" }],
    approvalLog: [{ "approval id": "ME-APR-1", "linked action id": "ME-ACT-1", decision: "Pending", title: "Member Engagement recovery approval", "requested at": "2026-07-26T12:00:00+05:30" }],
    policyRegistry: [{ "policy id": "POL-MEMBER-ENGAGEMENT-RETENTION", name: "Member Engagement retention floor" }],
    learningHistory: [{ domain: "Member Engagement", "proposed change": "Re-rank recovery work", "expected effect": "Improve verified recovery", attribution: "Observed", confidence: "Low", disposition: "Human sign-off", observed: "Recovery speed improved", notes: "Rollback if verification worsens" }],
  })

  const background = buildLiveMemberEngagementBackground(live)
  assert.equal(background.eventCount, 4)
  assert.deepEqual({ ...background.source, asOf: "<timestamp>" }, {
    connected: true,
    count: 7,
    names: "Member_NPS_Dashboard · Incident_Log · Action_Log · Evidence_Log · Approval_Log · Policy_Registry · Learning_History",
    asOf: "<timestamp>",
    confidence: "Low",
    adoption: "Human sign-off",
  })
  assert.ok(Number.isFinite(Date.parse(background.source.asOf)))
  assert.deepEqual(background.nps, {
    survey: { score: "41", method: "Approved survey responses only", inputs: "32 recorded responses" },
    behavioural: { score: "34", method: "Own-baseline behaviour and verified recovery", inputs: "57 protected Member records · 6-week observation window" },
    gap: "7 points",
  })
  assert.deepEqual(background.exitMovements, [{ reason: "Service friction", current: "5", baseline: "3" }])
  assert.equal(background.learning.proposedChange, "Re-rank recovery work")
  assert.equal(background.learning.evidence, "1 linked evidence records · 100% verified")
  assert.equal(background.learning.forecastError, "8%")
  assert.match(background.boundary.summary, /1 governed Member Engagement controls/)
  assert.deepEqual(background.auditEvents.map((event) => event.type), ["Approval", "Evidence", "Action", "Incident"])
})

test("Member Engagement Loop health derives clocks and verification from governed Sheet records", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T17:00:00+05:30" },
    memberNpsFeedback: [
      { id: "FB-1", "action id": "SD-ACTION-ENG-1", "member token": "Member A", "captured at": "2026-07-26T10:00:00+05:30" },
      { id: "FB-2", "action id": "feedback-2", "member token": "Member B", "captured at": "2026-07-25T10:00:00+05:30" },
    ],
    memberNpsResponses: [{ id: "NPS-1", "member token": "Member A", score: "7", "collected at": "2026-07-26T12:00:00+05:30" }],
    actionLog: [{ "action id": "SD-ACTION-ENG-1", "operating objective": "Member engagement recovery", "owner actor id": "ACT-PRIYA", state: "Proposed", "due at": "2026-07-27T14:00:00+05:30", "proposed at": "2026-07-26T14:00:00+05:30" }],
    evidenceLog: [{ "evidence id": "E-1", "linked id": "SD-ACTION-ENG-1", "verification status": "Verified" }],
  })
  const health = buildLiveMemberEngagementLoopHealth(live)
  assert.equal(health.clocks.length, 1)
  assert.equal(health.clocks[0].ownerRole, "ACT-PRIYA")
  assert.equal(health.clocks[0].state, "Running")
  assert.equal(health.verification.claimed, 2)
  assert.equal(health.verification.verified, 1)
  assert.equal(health.verification.awaiting, 1)
  assert.equal(health.verification.reopened, 0)
})

test("Member Engagement headline measures use Sheet observations and governed thresholds", () => {
  const live = buildLiveSelfDriveSnapshot({
    memberNpsDashboard: [
      { key: "member_engagement_m6_retention_pct", "value number": "68" },
      { key: "member_engagement_monthly_churn_pct", "value number": "5.5" },
      { key: "member_engagement_exit_reasons_verified", "value number": "2" },
      { key: "member_engagement_exit_reasons_claimed", "value number": "3" },
      { key: "member_engagement_at_risk_recovered", "value number": "8" },
      { key: "member_engagement_at_risk_total", "value number": "20" },
      { key: "member_engagement_interventions", "value number": "14" },
      { key: "member_engagement_recovery_awaiting", "value number": "3" },
      { key: "member_engagement_recovery_reopened", "value number": "1" },
      { key: "member_engagement_closure_rule", "value text": "A recovery counts only when independent evidence confirms the Member outcome." },
      { key: "member_engagement_retention_2026_01", label: "Jan 2026", "value number": "52", "value text": "100,94,89,84,79,73,68" },
      { key: "member_engagement_retention_2026_02", label: "Feb 2026", "value number": "48", "value text": "100,93,89,85,81,76,70" },
      { key: "member_engagement_retention_2026_03", label: "Mar 2026", "value number": "57", "value text": "100,95,91,87,83,78,72" },
    ],
    policyRegistry: [
      { "policy id": "POL-RETENTION-M6-WARNING", value: "0.65" },
      { "policy id": "POL-MONTHLY-CHURN-REFERENCE", value: "0.06" },
    ],
  })
  const headline = buildLiveMemberEngagementHeadlineMeasures(live)
  assert.equal(headline.hasData, true)
  assert.deepEqual(headline.measures.map((measure) => [measure.value, measure.target]), [
    ["68%", "65% floor"],
    ["5.5%", "6% control"],
    ["2/3", "1 awaiting"],
    ["8/20", "14 interventions"],
  ])
  assert.match(headline.implication, /68% against the 65% floor/)
  assert.equal(headline.retentionImplicationSummary, "1 exit reason awaits independent verification.")
  assert.equal(headline.retentionFloor, 65)
  assert.equal(headline.cohortSummary, "All 3 recorded M6 cohorts are at or above the 65% floor.")
  assert.deepEqual(headline.retentionCurves.map((curve) => [curve.cohort, curve.memberCount, curve.values]), [
    ["Jan 2026", 52, [100, 94, 89, 84, 79, 73, 68]],
    ["Feb 2026", 48, [100, 93, 89, 85, 81, 76, 70]],
    ["Mar 2026", 57, [100, 95, 91, 87, 83, 78, 72]],
  ])
  assert.deepEqual(headline.recovery, {
    verified: 8,
    total: 20,
    interventions: 14,
    awaiting: 3,
    reopened: 1,
    closureRule: "A recovery counts only when independent evidence confirms the Member outcome.",
  })
})

test("Member Savings freshness uses only connected and valid Sheet records", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T17:00:00+05:30" },
    essentials: [
      { "essentials hourly id": "ESS-1", "member savings inr": "2400", "nia margin inr": "3500", "captured at": "2026-07-26T16:55:00+05:30" },
      { "essentials hourly id": "", "captured at": "2026-07-26T16:55:00+05:30" },
    ],
    actionLog: [{ "action id": "SD-ACTION-SAV-1", "operating objective": "Approve Essentials pricing exception", "owner actor id": "ACT-PRIYA", state: "Proposed", "due at": "2026-07-27T14:00:00+05:30", "proposed at": "2026-07-26T16:50:00+05:30" }],
    evidenceLog: [{ "evidence id": "E-SAV-1", "linked id": "SD-ACTION-SAV-1", "verification status": "Verified", "uploaded at": "2026-07-26T16:40:00+05:30" }],
    approvalLog: [{ "approval id": "AP-SAV-1", "linked action id": "SD-ACTION-SAV-1", decision: "Pending", "requested at": "2026-07-26T16:45:00+05:30" }],
  })
  const freshness = buildLiveMemberSavingsFreshness(live)
  assert.equal(freshness.connected, true)
  assert.deepEqual(freshness.feeds.map((feed) => feed.label), [
    "Essentials savings and margin",
    "Member Savings actions",
    "Independent savings evidence",
    "Savings approvals",
  ])
  assert.equal(freshness.quarantinedRecords, 1)
})

test("Member Savings loop state derives clocks and verification from governed Sheet records", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T17:00:00+05:30" },
    essentials: [{ "essentials hourly id": "ESS-1", "captured at": "2026-07-26T16:55:00+05:30" }],
    actionLog: [{ "action id": "SD-ACTION-SAV-1", "operating objective": "Member Savings recovery", "owner actor id": "ACT-PRIYA", state: "Proposed", "due at": "2026-07-27T14:00:00+05:30", "proposed at": "2026-07-26T16:50:00+05:30" }],
    evidenceLog: [{ "evidence id": "E-SAV-1", "linked id": "SD-ACTION-SAV-1", "verification status": "Verified", "uploaded at": "2026-07-26T16:40:00+05:30" }],
  })
  const health = buildLiveMemberSavingsHealth(live)
  assert.equal(health.clocks.length, 1)
  assert.equal(health.clocks[0].ownerRole, "ACT-PRIYA")
  assert.equal(health.verification.claimed, 1)
  assert.equal(health.verification.verified, 1)
  assert.equal(health.verification.awaiting, 0)
})

test("Member Savings uses the Sheet snapshot time when an awaiting row has no event timestamp", () => {
  const asOf = "2026-07-26T17:00:00+05:30"
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: asOf },
    actionLog: [{
      "action id": "SD-ACTION-SAV-NO-TIMESTAMP",
      "operating objective": "Member Savings recovery",
      "owner actor id": "ACT-PRIYA",
      state: "Proposed",
    }],
  })

  const health = buildLiveMemberSavingsHealth(live)

  assert.equal(health.verification.awaiting, 1)
  assert.equal(health.verification.oldestAwaitingAt, asOf)
  assert.equal(health.verification.backlogAgeHours, 0)
})

test("Member Savings tasks derive from governed Action_Log rows instead of the preview fixture", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T16:55:00+05:30" },
    essentials: [{ "essentials hourly id": "ESS-1", "member savings inr": "2400", "nia margin inr": "3500", "captured at": "2026-07-26T16:55:00+05:30" }],
    actionLog: [{ "action id": "SD-ACTION-SAV-2", "studio id": "S1", "operating objective": "Member Savings recovery", "expected metric": "Attach", "owner actor id": "ACT-PRIYA", state: "Detected", "next action": "Submit attach recovery evidence", "due at": "2026-07-27T14:00:00+05:30", "proposed at": "2026-07-26T16:50:00+05:30" }],
    evidenceLog: [{ "evidence id": "E-SAV-2", "linked id": "SD-ACTION-SAV-2", "verification status": "Pending", notes: "Attach recovery proof awaiting review", "uploaded at": "2026-07-26T16:54:00+05:30" }],
    people: [{ "actor id": "ACT-PRIYA", "display name": "Priya Rao" }],
    studios: [{ "studio id": "S1", studio: "Sriperumbudur 01" }],
  })
  const tasks = buildLiveMemberSavingsTasks(live)
  assert.deepEqual(tasks.map((task) => ({ actionId: task.actionId, service: task.service, owner: task.owner, expectedMetric: task.expectedMetric, progress: task.progress, verifiedResult: task.verifiedResult, state: task.state })), [{ actionId: "SD-ACTION-SAV-2", service: "Sriperumbudur 01", owner: "Priya Rao", expectedMetric: "Attach", progress: "Submit attach recovery evidence", verifiedResult: "Attach recovery proof awaiting review", state: "Awaiting verification" }])
})

test("Member Savings removes a live action after linked independent evidence verifies it", () => {
  const live = buildLiveSelfDriveSnapshot({
    meta: { updatedAt: "2026-07-26T17:00:00+05:30" },
    actionLog: [{ "action id": "SD-ACTION-SAV-VERIFIED", "operating objective": "Member Savings recovery", "owner actor id": "ACT-PRIYA", state: "Assigned" }],
    evidenceLog: [{ "evidence id": "E-SAV-VERIFIED", "linked id": "SD-ACTION-SAV-VERIFIED", "verification status": "Verified", "verified at": "2026-07-26T16:59:00+05:30" }],
  })

  assert.deepEqual(buildLiveMemberSavingsTasks(live), [])
})

test("Living summary excludes Existing Occupancy from the FONO and SP channel comparison", () => {
  const live = buildLiveSelfDriveSnapshot({
    living: [
      { "studio id": "F1", "supply model": "FONO", "activation ready nests": "100", "occupied nests": "80" },
      { "studio id": "P1", "supply model": "SP", "activation ready nests": "200", "occupied nests": "150" },
      { "studio id": "E1", "supply model": "EXISTING", "activation ready nests": "4988", "occupied nests": "4575" },
    ],
  })

  assert.equal(live.summary.readyNests, 300)
  assert.equal(live.summary.occupiedNests, 230)
})

test("Existing Occupancy is never silently classified as FONO in margin inputs", () => {
  const unresolved = buildLiveSelfDriveSnapshot({
    living: [{ "living hourly id": "E-1", "studio id": "E1", "supply model": "EXISTING", "contracted nests": "100", "occupied nests": "90" }],
  })
  assert.deepEqual(buildLiveMarginInputs(unresolved), [])

  const governed = buildLiveSelfDriveSnapshot({
    living: [{ "living hourly id": "E-2", "studio id": "E2", "supply model": "EXISTING", "contracted nests": "100", "occupied nests": "90" }],
    studios: [{ "studio id": "E2", "supply model": "SP" }],
  })
  assert.equal(buildLiveMarginInputs(governed)[0]?.supplyModel, "SP")
})
