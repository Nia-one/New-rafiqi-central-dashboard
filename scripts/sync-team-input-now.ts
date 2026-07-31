import { config } from "dotenv";
import { syncTeamInputs } from "../lib/teamInputSync";

config({ path: ".env.local" });

syncTeamInputs()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
