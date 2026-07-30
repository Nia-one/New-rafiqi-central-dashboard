import dotenv from "dotenv"
import { syncVerticalInputs } from "../lib/verticalInputSync"

dotenv.config({ path: ".env.local" })

syncVerticalInputs()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
