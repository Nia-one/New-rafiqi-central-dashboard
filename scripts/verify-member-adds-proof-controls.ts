import { buildLiveNewAddsProof, buildLiveSelfDriveSnapshot } from "../lib/live-mappers/self-drive"

async function main() {
  const response = await fetch("http://localhost:3000/api/ops-data", { cache: "no-store" })
  if (!response.ok) throw new Error(`Live ops endpoint returned ${response.status}.`)

  const payload = await response.json()
  const snapshot = buildLiveSelfDriveSnapshot(payload.data)
  const proof = buildLiveNewAddsProof(snapshot)
  const measure = (id: string) => proof.measures.find((item) => item.id === id)
  const source = measure("adds-by-source")
  const cac = measure("cac-payback")

  if (!source || source.primary === "Source not recorded") {
    throw new Error("The Sheet acquisition source did not reach the Proof and controls mapper.")
  }
  if (!cac || cac.primary === "No verified CAC") {
    throw new Error("The Sheet CAC/payback values did not reach the Proof and controls mapper.")
  }
  const memberAddsPolicies = snapshot.policies.filter((row) => String(row["policy id"] ?? "").startsWith("POL-NEW-ADDS-") && String(row.status ?? "").toLowerCase() === "active")
  const controlPolicies = memberAddsPolicies.filter((row) => !String(row["policy id"] ?? "").includes("-BLOCK-"))
  const safetyBoundaries = memberAddsPolicies.filter((row) => String(row["policy id"] ?? "").includes("-BLOCK-"))
  const expectedQuarantineCount = snapshot.living.filter((row) => String(row["supply model"] ?? "").trim().toLowerCase() !== "fono").length
  if (controlPolicies.length !== 4 || safetyBoundaries.length !== 8) {
    throw new Error(`Policy_Registry did not return the expected Member Adds governance rows (controls=${controlPolicies.length}, safety=${safetyBoundaries.length}).`)
  }
  if (proof.loopHealth.quarantinedRecords !== expectedQuarantineCount) {
    throw new Error(`Live quarantine count is not derived from the FONO validation boundary (expected=${expectedQuarantineCount}, actual=${proof.loopHealth.quarantinedRecords}).`)
  }

  console.log(JSON.stringify({
    component: "Self Drive > Member Adds > Proof and controls",
    sourceTabs: ["Living_Hourly", "Member_Activation", "Action_Log", "Evidence_Log", "Approval_Log", "Policy_Registry", "Studio_Master", "People_Roster"],
    measures: proof.measures,
    freshness: proof.loopHealth.feeds.map((feed) => ({ label: feed.label, lastUpdatedAt: feed.lastUpdatedAt, ageMinutes: feed.ageMinutes, ageLabel: feed.ageLabel, stale: feed.stale })),
    outcomeChecks: proof.loopHealth.verification,
    feeds: proof.feedInputCount,
    clocks: proof.clockInputCount,
    governedActions: proof.governedActionCount,
    auditEvents: proof.auditEventCount,
    quarantinedRecords: proof.loopHealth.quarantinedRecords,
    controlPolicies: controlPolicies.map((row) => row["policy id"]),
    safetyBoundaries: safetyBoundaries.map((row) => row["policy id"]),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
