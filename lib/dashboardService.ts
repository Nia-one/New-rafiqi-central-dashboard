import { batchGet } from "./googleSheets";

export async function getDashboardData() {
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
    "Action_Log!A:Z",
    "Evidence_Log!A:Z",
    "Approval_Log!A:Z",
    "Living_Hourly!A:Z",
    "Work_Hourly!A:AZ",
    "Essentials_Hourly!A:Z",
    "Finance_Daily!A:Z",
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
  ]);

  return {
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
  };
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







