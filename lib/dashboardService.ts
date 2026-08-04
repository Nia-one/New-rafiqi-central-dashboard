import { batchGet } from "./googleSheets";

export type DashboardPeriod = "all" | `${number}-${string}`;

const PERIOD_FIELDS: Record<string, string[]> = {
  enterpriseDemand: ["opened at", "activation required at", "updated at"],
  memberActivation: ["activated at", "activation date", "captured at", "updated at"],
  hourlyHeartbeat: ["observed at", "expected at", "captured at", "updated at"],
  incidentLog: ["detected at", "opened at", "created at", "updated at"],
  actionLog: ["executed at", "detected at", "due at", "updated at"],
  evidenceLog: ["captured at", "verified at", "created at", "updated at"],
  approvalLog: ["proposed at", "approved at", "created at", "updated at"],
  livingHourly: ["captured at", "business date", "period start", "period end", "updated at", "month"],
  workHourly: ["captured at", "business date", "period start", "period end", "updated at", "month"],
  essentialsHourly: ["captured at", "business date", "period start", "period end", "updated at", "month"],
  financeDaily: ["business date", "date", "captured at", "period start", "period end", "month"],
  cashControlChannels: ["business date", "period start", "period end", "captured at", "updated at", "month"],
  dashboardOverview: ["as of", "snapshot at", "captured at", "updated at", "period end", "month"],
  cmHistory: ["business_date", "business date", "captured_at", "captured at", "month"],
  constraints: ["detected at", "deadline at", "updated at"],
  previousBlock: ["snapshot_time", "snapshot time", "captured at", "month"],
  rootCause: ["reviewed at", "updated at", "created at"],
  actions: ["due date", "created at", "updated at"],
  executionQueue: ["alert queued at", "created at", "updated at"],
  livingDashboard: ["as of", "captured at", "updated at", "period end", "month"],
  workDashboard: ["as of", "captured at", "updated at", "period end", "month"],
  essentialsDashboard: ["as of", "captured at", "updated at", "period end", "month"],
  essentialsCohorts: ["month", "period start", "period end", "captured at"],
  essentialsInventory: ["as of", "captured at", "updated at", "business date", "month"],
  memberNpsDashboard: ["month", "as of", "captured at", "updated at"],
  memberNpsFeedback: ["month", "collected at", "created at", "updated at"],
  memberNpsResponses: ["month", "collected at", "created at", "updated at"],
  peopleDashboard: ["month", "as of", "captured at", "updated at"],
  peoplePerformance: ["month", "period start", "period end", "captured at", "updated at"],
  peopleFollowThrough: ["month", "due at", "created at", "updated at"],
  learningHistory: ["proposed at", "observed at", "created at", "updated at", "month"],
};

function monthKey(input: unknown): string | null {
  const text = String(input ?? "").trim();
  if (!text) return null;
  const direct = text.match(/^(\d{4})[-/](\d{1,2})(?:$|[-/])/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}`;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  const date = new Date(parsed);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function tableMonths(table: unknown[][], fields: string[]) {
  if (!Array.isArray(table) || table.length < 2) return [];
  const allowed = new Set(["reporting month", ...fields.map((field) => field.toLowerCase())]);
  const headers = (table[0] ?? []).map((header) => String(header).trim().toLowerCase());
  const reportingMonthIndex = headers.indexOf("reporting month");
  const indexes = reportingMonthIndex >= 0 ? [reportingMonthIndex] : headers.map((header, index) => allowed.has(header) ? index : -1).filter((index) => index >= 0);
  return table.slice(1).flatMap((row) => indexes.map((index) => monthKey(row[index])).filter((value): value is string => Boolean(value)));
}

export function availableDashboardPeriods(data: Record<string, unknown>) {
  return [...new Set(Object.entries(PERIOD_FIELDS).flatMap(([key, fields]) => tableMonths((data[key] as unknown[][]) ?? [], fields)))].sort().reverse();
}

function filterTable(table: unknown[][], fields: string[], period: string) {
  if (!Array.isArray(table) || table.length < 2) return table;
  const allowed = new Set(["reporting month", ...fields.map((field) => field.toLowerCase())]);
  const headers = (table[0] ?? []).map((header) => String(header).trim().toLowerCase());
  const reportingMonthIndex = headers.indexOf("reporting month");
  const indexes = reportingMonthIndex >= 0 ? [reportingMonthIndex] : headers.map((header, index) => allowed.has(header) ? index : -1).filter((index) => index >= 0);
  if (!indexes.length) return table;
  return [table[0], ...table.slice(1).filter((row) => indexes.some((index) => monthKey(row[index]) === period))];
}

export function filterDashboardDataByPeriod<T extends Record<string, any>>(data: T, period: string): T {
  if (period === "all") return data;
  const filtered = { ...data };
  for (const [key, fields] of Object.entries(PERIOD_FIELDS)) filtered[key] = filterTable(data[key] ?? [], fields, period);
  return filtered;
}

export async function getDashboardData(period: string = "all") {
  const [
    sourceRegistry,
    policyRegistry,
    theatreMaster,
    studioMaster,
    peopleRoster,
    enterpriseDemand,
    memberActivation,
    hourlyHeartbeat,
    incidentLog,
    actionLog,
    evidenceLog,
    approvalLog,
    livingHourly,
    workHourly,
    essentialsHourly,
    financeDaily,
    cashControlChannels,
    dashboardOverview,
    cmHistory,
    constraints,
    previousBlock,
    rootCause,
    actions,
    executionQueue,
    dashboardContent,
    livingDashboard,
    workDashboard,
    essentialsDashboard,
    essentialsCohorts,
    essentialsInventory,
    memberNpsDashboard,
    memberNpsFeedback,
    memberNpsResponses,
    peopleDashboard,
    peoplePerformance,
    peopleFollowThrough,
    learningHistory,
  ] = await batchGet([
    "Source_Registry!A:Z",
    "Policy_Registry!A:Z",
    "Theatre_Master!A:Z",
    "Studio_Master!A:Z",
    "People_Roster!A:Z",
    "Enterprise_Demand!A:Z",
    "Member_Activation!A:Z",
    "Hourly_Heartbeat!A:Z",
    "Incident_Log!A:Z",
    "Action_Log!A:AZ",
    "Evidence_Log!A:Z",
    "Approval_Log!A:Z",
    "Living_Hourly!A:AZ",
    "Work_Hourly!A:AZ",
    "Essentials_Hourly!A:AZ",
    "Finance_Daily!A:AZ",
    "Cash_Control_Channels!A:Z",
    "Dashboard_Overview!A:Z",
    "CM_History!A:Z",
    "Constraints!A:Z",
    "Previous_Block!A:Z",
    "rootCause!A:Z",
    "actions!A:Z",
    "executionQueue!A:Z",
    "Dashboard_Content!A:I",
    "Living_Dashboard!A:J",
    "Work_Dashboard!A:J",
    "Essentials_Dashboard!A:J",
    "Essentials_Cohorts!A:Z",
    "Essentials_Inventory!A:Z",
    "Member_NPS_Dashboard!A:J",
    "Member_NPS_Feedback!A:Z",
    "Member_NPS_Responses!A:Z",
    "People_Dashboard!A:J",
    "People_Performance!A:Z",
    "People_Follow_Through!A:Z",
    "Learning_History!A:Z",
  ]);

  const snapshot = {
    sourceRegistry,
    policyRegistry,
    theatreMaster,
    studioMaster,
    peopleRoster,
    enterpriseDemand,
    memberActivation,
    hourlyHeartbeat,
    incidentLog,
    actionLog,
    evidenceLog,
    approvalLog,
    livingHourly,
    workHourly,
    essentialsHourly,
    financeDaily,
    cashControlChannels,
    dashboardOverview,
    cmHistory,
    constraints,
    previousBlock,
    rootCause,
    actions,
    executionQueue,
    dashboardContent,
    livingDashboard,
    workDashboard,
    essentialsDashboard,
    essentialsCohorts,
    essentialsInventory,
    memberNpsDashboard,
    memberNpsFeedback,
    memberNpsResponses,
    peopleDashboard,
    peoplePerformance,
    peopleFollowThrough,
    learningHistory,
  };
  const availablePeriods = availableDashboardPeriods(snapshot);
  const selectedPeriod = period === "all" || availablePeriods.includes(period) ? period : (availablePeriods[0] ?? "all");
  return { ...filterDashboardDataByPeriod(snapshot, selectedPeriod), availablePeriods, selectedPeriod };
}

/**
 * Adapter layer
 * Converts Google Sheets data into the structure expected by lib/ops-data.ts
 *
 * NOTE:
 * This is intentionally a placeholder.
 * We'll map each section (meta, spine, history, constraints, etc.)
 * in the next steps without changing any UI components.
 */
export async function buildOpsData() {
  const data = await getDashboardData();

  return {
    meta: {},
    monthlyCMTarget: 0,
    monthEndProjection: 0,
    askRateMultiple: 0,
    spine: [],
    constraints: [],
    history: [],
    previousBlock: {},
    rootCause: data.rootCause,
    actions: data.actions,
    executionQueue: data.executionQueue,

    // Temporary reference to the raw sheet data while we build the mapper
    _raw: data,
  };
}







