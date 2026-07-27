import { buildLiveNewAddsFillStatus, buildLiveNewAddsFillTasks, buildLiveNewAddsTheatreProgress, buildLiveSelfDriveSnapshot } from "../lib/live-mappers/self-drive"

async function main() {
  const response = await fetch("http://localhost:3000/api/ops-data")
  if (!response.ok) throw new Error(`Live ops endpoint returned ${response.status}.`)
  const payload = await response.json()
  const snapshot = buildLiveSelfDriveSnapshot(payload.data)
  const status = buildLiveNewAddsFillStatus(snapshot)
  const theatres = buildLiveNewAddsTheatreProgress(snapshot)
  const fillTasks = buildLiveNewAddsFillTasks(snapshot)

  if (!status.hasData) throw new Error("No live FONO data reached Member Adds.")
  if (status.target !== status.verified + status.gap) throw new Error("Fill target does not reconcile to verified plus gap.")
  if (status.owner === "Unassigned") throw new Error("The FONO fill owner did not resolve through People_Roster.")

  console.log(JSON.stringify({
    source: ["Living_Hourly", "Member_Activation", "People_Roster"],
    ...status,
    theatres,
    fillTasks: fillTasks.map((task) => ({ actionId: task.actionId, studio: task.studioId, theatre: task.theatre, owner: task.ownerRole, dueAt: task.dueAt, state: task.state, action: task.nextAction, expectedOutcome: task.expectedOutcome })),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
