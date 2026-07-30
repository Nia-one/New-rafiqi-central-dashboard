import dotenv from "dotenv";
import { getDashboardData } from "../lib/dashboardService";

dotenv.config({ path: ".env.local" });
getDashboardData()
  .then((data) => console.log(JSON.stringify({
    connected: true,
    livingRows: data.livingHourly?.length || 0,
    enterpriseDemandRows: data.enterpriseDemand?.length || 0,
    essentialsHourlyRows: data.essentialsHourly?.length || 0,
    essentialsInventoryRows: data.essentialsInventory?.length || 0,
  }, null, 2)))
  .catch((error) => { console.error(error); process.exitCode = 1; });
