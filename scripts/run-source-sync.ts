import dotenv from "dotenv";
import { syncAllSources } from "../lib/sourceSync";

dotenv.config({ path: ".env.local" });

syncAllSources()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => { console.error(error); process.exitCode = 1; });
