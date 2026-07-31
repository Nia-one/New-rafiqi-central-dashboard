import { config } from "dotenv";
import { syncShramParkDemandBotData } from "../lib/shramParkDemandBotSync";

config({ path: ".env.local" });

syncShramParkDemandBotData()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
