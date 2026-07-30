import dotenv from "dotenv";
import { getDashboardData } from "../lib/dashboardService";

dotenv.config({ path: ".env.local" });

const count = (table: unknown[][] | undefined) => Math.max(0, (table?.length || 0) - 1);
const status = (required: Record<string, number>) => {
  const missing = Object.entries(required).filter(([, rows]) => rows === 0).map(([name]) => name);
  return { live: missing.length === 0, missing };
};

getDashboardData().then((data) => {
  const feeds = {
    Living_Hourly: count(data.livingHourly), Enterprise_Demand: count(data.enterpriseDemand),
    Essentials_Hourly: count(data.essentialsHourly), Essentials_Inventory: count(data.essentialsInventory),
    Work_Hourly: count(data.workHourly), Member_Activation: count(data.memberActivation),
    People_Roster: count(data.peopleRoster), People_Performance: count(data.peoplePerformance),
    People_Follow_Through: count(data.peopleFollowThrough), Member_NPS_Dashboard: count(data.memberNpsDashboard),
    Member_NPS_Feedback: count(data.memberNpsFeedback), Member_NPS_Responses: count(data.memberNpsResponses),
    Finance_Daily: count(data.financeDaily), Action_Log: count(data.actionLog), Incident_Log: count(data.incidentLog),
    Evidence_Log: count(data.evidenceLog), Approval_Log: count(data.approvalLog), Policy_Registry: count(data.policyRegistry),
    Learning_History: count(data.learningHistory), Studio_Master: count(data.studioMaster), Theatre_Master: count(data.theatreMaster),
  };
  const pick = (...names: (keyof typeof feeds)[]) => Object.fromEntries(names.map((name) => [name, feeds[name]]));
  const pages = {
    Self_Drive: {
      "Cash & Control": status(pick("Finance_Daily", "Policy_Registry")),
      "Enterprise Demand": status(pick("Enterprise_Demand")),
      "Member Adds": status(pick("Living_Hourly", "Member_Activation")),
      "Member Engagement": status(pick("Member_Activation", "Action_Log", "Evidence_Log")),
      "Member Savings": status(pick("Essentials_Hourly", "Essentials_Inventory")),
      "Nia Margins": status(pick("Living_Hourly", "Essentials_Hourly", "Finance_Daily")),
      "Nia Growth": status(pick("Enterprise_Demand", "Studio_Master", "Theatre_Master")),
      Despatch: status(pick("Action_Log", "Incident_Log", "People_Roster", "Evidence_Log")),
      "Your Sign-Off": status(pick("Approval_Log", "Action_Log", "Evidence_Log", "Policy_Registry")),
    },
    Self_Learn: {
      Overview: status(pick("Living_Hourly", "Enterprise_Demand", "Essentials_Hourly")),
      Living: status(pick("Living_Hourly", "Enterprise_Demand")),
      Work: status(pick("Work_Hourly")),
      Essentials: status(pick("Essentials_Hourly", "Essentials_Inventory")),
      "Member NPS": status(pick("Member_NPS_Dashboard", "Member_NPS_Feedback", "Member_NPS_Responses")),
      People: status(pick("People_Roster", "People_Performance", "People_Follow_Through")),
      "Learning history": status(pick("Learning_History")),
    },
  };
  console.log(JSON.stringify({ feeds, pages }, null, 2));
}).catch((error) => { console.error(error); process.exitCode = 1; });
