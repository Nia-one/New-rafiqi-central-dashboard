import { getDashboardData } from "./dashboardService";

export async function getDashboardBackend() {
  const sheets = await getDashboardData();

  return {
    overview: {},
    living: {},
    work: {},
    essentials: {},
    people: {},
    economics: {},
    definitions: {},
    despatch: {},
    operatingLoop: {},

    raw: sheets,
  };
}