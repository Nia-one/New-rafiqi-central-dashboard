import "dotenv/config"
import { getSheet } from "../lib/googleSheets"

async function run() {
  console.log("\n--- Action_Log ---")
  console.log(await getSheet("Action_Log!1:2"))

  console.log("\n--- Evidence_Log ---")
  console.log(await getSheet("Evidence_Log!1:2"))

  console.log("\n--- Approval_Log ---")
  console.log(await getSheet("Approval_Log!1:2"))
}

run().catch(console.error)