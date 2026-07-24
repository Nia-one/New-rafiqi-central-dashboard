import { getDashboardData } from "./dashboardService";

import { parseDashboardContent } from "./dashboard-content";

function toObjects(rows: any[][]) {
  if (!rows?.length) return [];

  const headers = rows[0].map((h: any) => String(h).trim());

  return rows.slice(1).map((row) => {
    const obj: Record<string, any> = {};

    headers.forEach((header, index) => {
      obj[header] = row[index] ?? "";
    });

    return obj;
  });
}

function num(value: any) {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(
    String(value).replace(/[?,%]/g, "").trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function first(obj: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null &&
      String(obj[key]).trim() !== ""
    ) {
      return obj[key];
    }
  }

  return "";
}

function studioNumber(row: Record<string, any>, keys: string[]) {
  return num(first(row, keys));
}

export async function buildOpsData() {
  console.log('OPS_MAPPER_START');
  const data = await getDashboardData();

  console.log("Action Log (first 10 rows):");
console.log(data.actionLog?.slice(0, 10));

console.log("Incident Log (first 10 rows):");
console.log(data.incidentLog?.slice(0, 10));

console.log("Approval Log (first 10 rows):");
console.log(data.approvalLog?.slice(0, 10));

console.log("AVAILABLE SHEETS:", Object.keys(data));

console.log("Finance Daily (first 5 rows):");
console.log(data.financeDaily?.slice(0, 5));

console.log("Dashboard Overview (first 5 rows):");
console.log(data.dashboardOverview?.slice(0, 5));

console.log("DASHBOARD CONTENT RAW");
console.log(JSON.stringify(data.dashboardContent?.slice(0,10), null, 2));

console.log("CM HISTORY RAW");
console.log(JSON.stringify(data.cmHistory?.slice(0,5), null, 2));

console.log("ENTERPRISE DEMAND RAW");
console.log(JSON.stringify(data.enterpriseDemand?.slice(0,5), null, 2));

console.log("Enterprise Demand (first 5 rows):");
console.log(data.enterpriseDemand?.slice(0, 5));

console.log("Member Activation (first 5 rows):");
console.log(data.memberActivation?.slice(0, 5));

console.log("Hourly Heartbeat (first 5 rows):");
console.log(data.hourlyHeartbeat?.slice(0, 5));

console.log("CONSTRAINTS RAW:", data.constraints?.slice(0,10));
console.log("Evidence Log (first 5 rows):");
console.log(data.evidenceLog?.slice(0, 5));

  // Convert all Google Sheet tabs into objects
  const studios = toObjects(data.studioMaster);
  const people = toObjects(data.peopleRoster);
  const living = toObjects(data.livingHourly);

console.log("LIVING HOURLY SAMPLE");
console.log(JSON.stringify(living.slice(0,5), null, 2));

const occupiedNests = living.reduce(
  (sum, row) =>
    sum + num(first(row, [
      "occupied nests",
      "Occupied Nests",
      "occupied",
    ])),
  0
);
  const work = toObjects(data.workHourly);
  const essentials = toObjects(data.essentialsHourly);
  const finance = toObjects(data.financeDaily);
  const history = toObjects(data.cmHistory);
const constraints = toObjects(data.constraints);
const actionLog = toObjects(data.actionLog);
console.log("ACTION LOG OBJECTS SAMPLE");
console.log(JSON.stringify(actionLog.slice(0,5), null, 2));
const rootCause = toObjects(data.rootCause);
const actions = toObjects(data.actions);
const executionQueue = toObjects(data.executionQueue);
const previousBlocks = toObjects(data.previousBlock);
const enterpriseDemand = toObjects(data.enterpriseDemand);
console.log("Enterprise Demand Objects (first 3):");
console.log("Enterprise Demand Raw Rows:", data.enterpriseDemand.length);
console.log(enterpriseDemand.slice(0, 3));

  // Lightweight studio summary (used in upcoming mapping)
  const studioSummary = studios.map((studio) => ({
    id: first(studio, [
      "Studio ID",
      "studio id",
      "Studio_Id",
    ]),

    theatre: first(studio, [
      "Theatre",
      "Theatre Name",
      "theatre",
    ]),

    studio: first(studio, [
      "Studio Name",
      "Studio",
      "studio",
    ]),

    capacity: studioNumber(studio, [
      "Capacity",
      "Contracted Nests",
      "contracted nests",
    ]),

    liveCapacity: studioNumber(studio, [
      "Activation Ready Nests",
      "activation ready nests",
    ]),

    activeMembers: studioNumber(studio, [
      "Members Active",
      "members active",
    ]),

    status: first(studio, [
      "Status",
      "status",
    ]),
  }));

  const overview = data.dashboardOverview || [];

  // Convert Dashboard_Overview into key/value map
  const metrics = Object.fromEntries(
    overview.slice(1).map((row: any[]) => {
      const metric = row[0];
      const value = Number(row[1]);

      return [
        metric,
        Number.isFinite(value) ? value : row[1],
      ];
    })
  );

console.log(
  "GOOGLE METRICS\n" +
  JSON.stringify(metrics, null, 2)
);

console.log("POLICY REGISTRY RAW");
console.log(JSON.stringify(data.policyRegistry, null, 2));

console.log("SOURCE REGISTRY RAW");
console.log(JSON.stringify(data.sourceRegistry, null, 2));

const plans = {
  Demand_Contracted: num(metrics.Demand_Contracted),
  Capacity_Live: num(metrics.Capacity_Live),
  Members_Active: num(metrics.Members_Active),
  Attach: num(metrics.Attach),
  ARPU: num(metrics.ARPU),
  CM: num(metrics.Monthly_CM_Target),
};

  return {
  meta: {
    block: "",
    updatedAt: new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    month: new Date().toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    }),
    day: new Date().getDate(),
    daysInMonth: new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate(),
    daysLeft:
      new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ).getDate() - new Date().getDate(),
    theatresBehind: 0,
    illustrative: false,
  },

  monthlyCMTarget: num(metrics.Monthly_CM_Target),
  monthEndProjection: num(metrics.Month_End_Projection),
  askRateMultiple: 1,

  flywheel: {
    living: {
      demand: num(metrics.Demand_Contracted),
      supply: num(metrics.Capacity_Live),
    },

    work: {
      demand: work.length,
      supply: work.reduce(
        (sum, row) =>
          sum + num(first(row, [
            "available workers",
            "available workers count",
            "worker availability",
            "headcount available"
          ])),
        0
      ),
    },

    essentials: {
      eligible: num(metrics.Members_Active),
      purchasing: num(metrics.Attach),
    },
  },

  spine: [
    {
      id: "contracted",
      label: "Demand contracted",
      lane: "Demand",
      actual: num(metrics.Demand_Contracted),
      plan: plans.Demand_Contracted,
      unit: "members",
    },
    {
      id: "capacity",
      label: "Capacity live",
      lane: "Shram Park",
      actual: num(metrics.Capacity_Live),
      plan: plans.Capacity_Live,
      unit: "Nests",
    },
    {
      id: "active",
      label: "Members active",
      lane: "FONO",
      actual: num(metrics.Members_Active),
      plan: plans.Members_Active,
      unit: "members",
    },
    {
      id: "attach",
      label: "Attach",
      lane: "Essentials",
      actual: num(metrics.Attach),
      plan: plans.Attach,
      unit: "percent",
    },
    {
      id: "arpu",
      label: "ARPU",
      lane: "Economics",
      actual: num(metrics.ARPU),
      plan: plans.ARPU,
      unit: "INR",
    },
    {
      id: "cm",
      label: "CM",
      lane: "Economics",
      actual: num(metrics.CM),
      plan: plans.CM,
      unit: "INR",
    },
  ],

  rootCause: rootCause.map((row) => ({
    id: row.id,
    constraintId: row.constraintId,
    rootCause: row.rootCause,
    evidence: row.evidence,
    owner: row.owner,
    nextStep: row.nextStep,
  })),

  actions: actions.map((row) => ({
    id: row.id,
    constraintId: row.constraintId,
    action: row.action,
    owner: row.owner,
    status: row.status,
    dueDate: row.dueDate,
  })),

  executionQueue: executionQueue.map((row) => ({
    id: row.id,
    constraintId: row.constraintId,
    priority: row.priority,
    cmRisk: num(row.cmRisk),
    owner: row.owner,
    status: row.status,
  })),

  constraints: constraints.map((row) => ({
  id: row.id,
  title: row.title,
  where: row.where,
  idleUnits:
    num(row.idleUnits) ||
    Number(String(row.detail).match(/\d+/)?.[0] || 0),
  cmPerUnit:
    row.lane === "FONO" || row.lane === "Shram Park"
      ? 300
      : row.lane === "Essentials"
        ? 200
        : 0,
  riskHours: num(row.riskHours) || 24,
  detail: row.detail,
  owner: row.owner,
  next: row.next,
  lane: row.lane,
  stalledBlocks: num(row.stalledBlocks),
})),
  history: history.map((row) => ({
  day: new Date(row.business_date).getDate(),
  actual: num(row.actual),
})),
previousBlock: previousBlocks.length
  ? {
      cm: num(previousBlocks[0].cm),
      contracted: num(previousBlocks[0].contracted),
      membersActive: num(previousBlocks[0].membersActive),
      attach: num(previousBlocks[0].attach),
      closures: num(previousBlocks[0].closures),
      stockoutsClearedStudios: num(previousBlocks[0].stockoutsClearedStudios),
      stalledTheatre: previousBlocks[0].stalledTheatre || "",
      staleOwner: previousBlocks[0].staleOwner || "",
      staleHours: num(previousBlocks[0].staleHours),
    }
  : {
      cm: 0,
      contracted: 0,
      membersActive: 0,
      attach: 0,
      closures: 0,
      stockoutsClearedStudios: 0,
      stalledTheatre: "",
      staleOwner: "",
      staleHours: 0,
    },
  dashboardContent: parseDashboardContent(data.dashboardContent),
};
}






























