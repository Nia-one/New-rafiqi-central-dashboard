import dotenv from "dotenv";
import { syncTeamOccupancyFromStudios } from "../lib/verticalInputSync";

dotenv.config({ path: ".env.local" });

syncTeamOccupancyFromStudios()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
