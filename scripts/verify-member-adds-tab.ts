import {
  buildLiveNewAddsFillStatus,
  buildLiveNewAddsFillTasks,
  buildLiveNewAddsProof,
  buildLiveNewAddsTheatreProgress,
  buildLiveSelfDriveSnapshot,
  filterLiveSelfDriveSnapshot,
} from "../lib/live-mappers/self-drive"

const OFFICIAL_STUDIO_ID = "CRM-SRI-D01-S01"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const response = await fetch("http://localhost:3000/api/ops-data", { cache: "no-store" })
  if (!response.ok) throw new Error(`Live ops endpoint returned ${response.status}.`)
  const payload = await response.json()
  const snapshot = buildLiveSelfDriveSnapshot(payload.data)
  const officialStudio = snapshot.studios.find((row) => String(row["studio id"] || "") === OFFICIAL_STUDIO_ID)
  assert(officialStudio, `${OFFICIAL_STUDIO_ID} is missing from the live Studio_Master feed.`)
  assert(["true", "yes", "1", "active"].includes(String(officialStudio.active || "").toLowerCase()), `${OFFICIAL_STUDIO_ID} is not active.`)

  const livingRow = snapshot.living.find((row) => String(row["living hourly id"] || "") === "LIV-TEST-001")
  const activationRow = snapshot.activations.find((row) => String(row["activation id"] || "") === "ACTV-TEST-001")
  const incidentRows = snapshot.incidents.filter((row) => ["INC-TEST-001", "ENT-CALL-INC-TEST-001"].includes(String(row["incident id"] || "")))
  assert(livingRow?.["studio id"] === OFFICIAL_STUDIO_ID, "Living_Hourly is not connected to the official Studio ID.")
  assert(activationRow?.["studio id"] === OFFICIAL_STUDIO_ID, "Member_Activation is not connected to the official Studio ID.")
  assert(incidentRows.length === 2 && incidentRows.every((row) => row["studio id"] === OFFICIAL_STUDIO_ID), "Incident_Log is not connected to the official Studio ID.")

  const status = buildLiveNewAddsFillStatus(snapshot)
  const theatres = buildLiveNewAddsTheatreProgress(snapshot)
  const tasks = buildLiveNewAddsFillTasks(snapshot)
  const proof = buildLiveNewAddsProof(snapshot)
  assert(status.hasData && status.target === status.verified + status.gap, "Fill Status does not reconcile.")
  assert(theatres.length > 0 && theatres.reduce((sum, row) => sum + row.dailyTarget, 0) === status.target, "Theatre Progress does not reconcile with Fill Status.")
  assert(tasks.length > 0, "Spots to fill has no Sheet-backed tasks.")
  assert(proof.measures.length === 4 && proof.feedInputCount === 3, "Proof and controls is incomplete.")
  assert(proof.measures.every((measure) => !/not recorded|no verified|no history/i.test(measure.primary)), "Proof and controls still contains fallback data.")

  const theatreId = String(officialStudio["theatre id"] || "")
  const location = String(officialStudio.address || "")
  const personId = String(snapshot.people.find((row) => String(row["studio id"] || "") === OFFICIAL_STUDIO_ID)?.["actor id"] || "")
  assert(theatreId && location && personId, "Studio_Master or People_Roster is missing a Member Adds filter dimension.")

  const filters = [
    { name: "Theatre", values: { theatre: theatreId, location: "", studio: "", person: "" } },
    { name: "Location", values: { theatre: "", location, studio: "", person: "" } },
    { name: "Studio", values: { theatre: "", location: "", studio: OFFICIAL_STUDIO_ID, person: "" } },
    { name: "Person", values: { theatre: "", location: "", studio: "", person: personId } },
  ] as const
  const filterResults = filters.map(({ name, values }) => {
    const filtered = filterLiveSelfDriveSnapshot(snapshot, values)
    const filteredStatus = buildLiveNewAddsFillStatus(filtered)
    assert(filteredStatus.hasData && filteredStatus.target > 0, `${name} filter removed the connected Member Adds data.`)
    return { name, target: filteredStatus.target, verified: filteredStatus.verified, gap: filteredStatus.gap }
  })

  const activePolicies = snapshot.policies.filter((row) => String(row["policy id"] || "").startsWith("POL-NEW-ADDS-") && String(row.status || "").toLowerCase() === "active")
  assert(activePolicies.length >= 12, "Member Adds governance policies are incomplete.")

  console.log(JSON.stringify({
    component: "Self Drive > Member Adds (full tab)",
    sources: ["Living_Hourly", "Member_Activation", "Action_Log", "Evidence_Log", "Approval_Log", "Policy_Registry", "Studio_Master", "People_Roster", "Incident_Log"],
    status,
    theatreRows: theatres.length,
    fillTasks: tasks.length,
    proofMeasures: proof.measures.map((measure) => ({ id: measure.id, primary: measure.primary })),
    governedActions: proof.governedActionCount,
    auditEvents: proof.auditEventCount,
    quarantineCount: proof.loopHealth.quarantinedRecords,
    filterResults,
    officialStudioId: OFFICIAL_STUDIO_ID,
    verified: true,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
