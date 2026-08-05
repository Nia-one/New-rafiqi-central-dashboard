import dotenv from "dotenv"
import { buildOpsData } from "../lib/opsDataMapper"
import { buildLiveDespatchEscalations } from "../lib/live-mappers/despatch"

dotenv.config({ path: ".env.local" })

async function main() {
  const data = await buildOpsData()
  const rows = buildLiveDespatchEscalations({ actionLog: data.actionLog, incidentLog: data.incidentLog, people: data.people })
  console.log("LIVE_DESPATCH_VERIFICATION=" + JSON.stringify({
    actionLogRows: data.actionLog.length,
    incidentLogRows: data.incidentLog.length,
    peopleRows: data.people.length,
    visibleRows: rows.length,
    syntheticRows: rows.filter((row) => row.synthetic).length,
    sourceActionIds: rows.map((row) => row.sourceActionId),
  }))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
