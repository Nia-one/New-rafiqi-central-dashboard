import { approvalsForDomain } from "../lib/live-approvals"
import { buildLiveNewAddsFillStatus, buildLiveNewAddsTheatreProgress, buildLiveSelfDriveSnapshot } from "../lib/live-mappers/self-drive"

async function main() {
  const response = await fetch("http://localhost:3000/api/ops-data", { cache: "no-store" })
  if (!response.ok) throw new Error(`Live ops endpoint returned ${response.status}.`)

  const payload = await response.json()
  const snapshot = buildLiveSelfDriveSnapshot(payload.data)
  const fill = buildLiveNewAddsFillStatus(snapshot)
  const theatresBehind = buildLiveNewAddsTheatreProgress(snapshot).filter((row) => row.dailyTarget > row.verifiedBillingLiveFills)
  const pendingApprovals = approvalsForDomain(snapshot, "new-adds", true)

  if (!fill.hasData) throw new Error("The Decision required control has no linked FONO source data.")
  if (!fill.owner) throw new Error("The Decision required control has no Sheet-derived owner.")

  console.log(JSON.stringify({
    component: "Self Drive > Member Adds > Decision required",
    sourceTabs: ["Living_Hourly", "Member_Activation", "Action_Log", "Evidence_Log", "Approval_Log", "People_Roster", "Studio_Master"],
    verifiedFillGap: fill.gap,
    owner: fill.owner,
    pendingSignOffs: pendingApprovals.map((row) => ({ id: row.approvalId, title: row.title, owner: row.owner, dueAt: row.dueAt })),
    theatresBelowTarget: theatresBehind.map((row) => row.theatre),
    doneWhen: "Verified gap reaches 0",
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
