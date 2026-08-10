import { config } from "dotenv"
import { syncFonoTrackerData } from "../lib/fonoTrackerSync"

config({ path: ".env.local" })

syncFonoTrackerData()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => { console.error(error); process.exitCode = 1 })
