import { buildLiveMemberEngagementBackground, buildLiveSelfDriveSnapshot } from "../lib/live-mappers/self-drive"

async function main() {
  const response = await fetch("http://localhost:3000/api/ops-data")
  if (!response.ok) throw new Error(`Ops data request failed: ${response.status}`)
  const body = await response.json()
  const result = buildLiveMemberEngagementBackground(buildLiveSelfDriveSnapshot(body.data))
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
