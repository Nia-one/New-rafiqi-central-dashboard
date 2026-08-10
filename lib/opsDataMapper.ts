import { getDashboardData } from "./dashboardService";

import { parseDashboardContent } from "./dashboard-content";
import type { ActionLogEntry } from "./action-log";
import type { ActionStatus } from "./allocation-types";
import type { ExecutionAction } from "./execution-control";
import type { DashboardRoute } from "./dashboard-model";

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

const SHEETS_SERIAL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MIN_SOURCE_DATE_UTC = Date.UTC(2000, 0, 1);

function plausibleSourceDate(date: Date): Date | null {
  const timestamp = date.getTime();
  // Reject malformed calendar values such as 01 Jan 46244. A source timestamp
  // may be future-dated for a reporting boundary, but never by decades.
  return Number.isFinite(timestamp) && timestamp >= MIN_SOURCE_DATE_UTC && timestamp <= Date.now() + 366 * 86_400_000
    ? date
    : null;
}

/** Normalise Google Sheets/Excel serial dates as well as ordinary date strings. */
function parseSourceDate(value: any): Date | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const text = String(value).trim();
  const serial = Number(text);
  if (/^\d+(?:\.\d+)?$/.test(text) && Number.isFinite(serial) && serial >= 20_000 && serial <= 80_000) {
    const date = new Date(SHEETS_SERIAL_EPOCH_UTC + serial * 86_400_000);
    return plausibleSourceDate(date);
  }

  // Do not accidentally treat ordinary metric values (for example, 500) as dates.
  if (!/[\-/:T]/.test(text)) return null;
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? null : plausibleSourceDate(new Date(timestamp));
}

/**
 * Hourly source tabs are append-only.  Dashboard "current" measures must use
 * one newest observation per entity; otherwise yesterday's occupancy is added
 * to today's occupancy every time a user pastes a fresh daily snapshot.
 */
function latestRowsByKey(rows: Record<string, any>[], keyNames: string[]) {
  const latest = new Map<string, { row: Record<string, any>; at: number; index: number }>();

  rows.forEach((row, index) => {
    const key = keyNames
      .map((name) => String(row[name] ?? "").trim())
      .find(Boolean);
    if (!key) return;

    const rawTimestamp = row["updated at"] ?? row["updated_at"] ?? row["reporting date"] ?? row["reporting month"];
    const parsedTimestamp = parseSourceDate(rawTimestamp);
    const at = parsedTimestamp ? parsedTimestamp.getTime() : Number.NEGATIVE_INFINITY;
    const prior = latest.get(key);
    if (!prior || at > prior.at || (at === prior.at && index > prior.index)) {
      latest.set(key, { row, at, index });
    }
  });

  return [...latest.values()].sort((a, b) => a.index - b.index).map(({ row }) => row);
}

function latestLivingRows(rows: Record<string, any>[]) {
  const keyed = rows.map((row) => ({
    ...row,
    "__living stream key": `${String(row["supply model"] ?? row["Supply Model"] ?? "").trim().toUpperCase()}::${String(row["studio id"] ?? row["Studio ID"] ?? row.studio ?? "").trim()}`,
  }))
  return latestRowsByKey(keyed, ["__living stream key"]).map(({ ["__living stream key"]: _key, ...row }) => row)
}

/**
 * Overview is a derived view.  Its reporting period must come from a source
 * row in the connected workbook, rather than from the machine running the
 * dashboard.  This accepts the timestamp column conventions used across the
 * operational tabs and returns the newest source snapshot.
 */
function latestSourceSnapshot(...tables: any[][][]): Date | null {
  const timestampHeaders = new Set([
    "updated at", "updated_at", "captured at", "captured_at", "as of",
    "as_of", "snapshot at", "snapshot_at", "timestamp", "event time",
    "event_time",
  ]);
  const periodFallbackHeaders = new Set(["period end", "period_end"]);

  const findLatest = (allowedHeaders: Set<string>) => {
    let latest: Date | null = null;

    for (const table of tables) {
      if (!table?.length) continue;
      const headers = (table[0] || []).map((header: any) =>
        String(header).trim().toLowerCase()
      );
      const timestampColumns = headers
        .map((header: string, index: number) =>
          allowedHeaders.has(header) ? index : -1
        )
        .filter((index: number) => index >= 0);

      for (const row of table.slice(1)) {
        for (const index of timestampColumns) {
          const candidate = parseSourceDate(row[index]);
          if (candidate && (!latest || candidate > latest)) latest = candidate;
        }
      }
    }

    return latest;
  };

  // Prefer an actual event/update timestamp. A reporting period end is only a
  // fallback, otherwise a future period boundary can be mistaken for a refresh.
  return findLatest(timestampHeaders) ?? findLatest(periodFallbackHeaders);
}

/**
 * Returns the latest reporting date from an explicitly named source column.
 * This is deliberately separate from `latestSourceSnapshot`: an update time
 * in another operational feed must not change the finance calendar used for
 * CM pacing and month-end projection.
 */
function latestDateForHeaders(table: any[][], headerNames: string[]): Date | null {
  if (!table?.length) return null;

  const requestedHeaders = new Set(headerNames.map((header) => header.toLowerCase()));
  const columns = (table[0] || [])
    .map((header: any, index: number) =>
      requestedHeaders.has(String(header).trim().toLowerCase()) ? index : -1
    )
    .filter((index: number) => index >= 0);

  let latest: Date | null = null;
  for (const row of table.slice(1)) {
    for (const index of columns) {
      const candidate = parseSourceDate(row[index]);
      if (candidate && (!latest || candidate > latest)) latest = candidate;
    }
  }

  return latest;
}

function sourceCalendarMeta(snapshot: Date | null) {
  if (!snapshot) {
    return {
      snapshotAt: "",
      updatedAt: "No source timestamp",
      month: "Source period pending",
      day: 0,
      daysInMonth: 0,
      daysLeft: 0,
    };
  }

  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(snapshot);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  const day = part("day");
  const month = part("month");
  const year = part("year");
  const daysInMonth = new Date(year, month, 0).getDate();

  return {
    snapshotAt: snapshot.toISOString(),
    updatedAt: new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(snapshot),
    month: new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "long",
      year: "numeric",
    }).format(snapshot),
    day,
    daysInMonth,
    daysLeft: Math.max(0, daysInMonth - day),
  };
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

function summarizeLiving(rows: Record<string, any>[]) {
  const contracted = rows.reduce(
    (s, r) =>
      s +
      num(
        first(r, [
          "contracted nests",
          "Contracted Nests",
          "capacity",
        ])
      ),
    0
  );

  const activationReady = rows.reduce(
    (s, r) =>
      s +
      num(
        first(r, [
          "activation ready nests",
          "Activation Ready Nests",
        ])
      ),
    0
  );

  const occupied = rows.reduce(
    (s, r) =>
      s +
      num(
        first(r, [
          "occupied nests",
          "Occupied Nests",
        ])
      ),
    0
  );

  const billed = rows.reduce(
    (s, r) =>
      s +
      num(
        first(r, [
          "living billed",
          "living billed inr",
          "Living Billed",
          "billed",
        ])
      ),
    0
  );

  const collected = rows.reduce(
    (s, r) =>
      s +
      num(
        first(r, [
          "living collected",
          "living collected inr",
          "Living Collected",
          "collected",
        ])
      ),
    0
  );

  return {
    contracted,
    activationReady,
    occupied,
    occupancy:
      activationReady === 0
        ? 0
        : occupied / activationReady,
    billed,
    collected,
    leakage: billed - collected,
  };
}

export async function buildOpsData(period: string = "all") {
  console.log('OPS_MAPPER_START');
  const data = await getDashboardData(period);

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
  const theatres = toObjects(data.theatreMaster);
  const people = toObjects(data.peopleRoster);
  // Each supply model is a separate ledger. The same Studio can legitimately
  // appear in FONO/SP and in the independent Existing Occupancy snapshot.
  const living = latestLivingRows(toObjects(data.livingHourly));
  const livingDashboard = toObjects(data.livingDashboard);

console.log("LIVING HOURLY SAMPLE");
console.log(JSON.stringify(living.slice(0,5), null, 2));

const fonoOccupancyLive = living
  .filter((row) => first(row, [
    "supply model",
    "Supply Model"
  ]) === "FONO")
  .map((row) => ({
    studio: first(row, ["studio id", "Studio ID", "studio"]),
    theatre: first(row, ["theatre id", "Theatre ID", "theatre"]),
    available: num(first(row, ["activation ready nests", "Activation Ready Nests"])),
    occupied: num(first(row, ["occupied nests", "Occupied Nests"])),
    occupancy: num(first(row, ["occupancy ratio", "Occupancy Ratio"])),
  }));

const fonoRows = living.filter(
  (row) =>
    String(
      first(row, [
        "supply model",
        "Supply Model",
      ])
    ).trim().toUpperCase() === "FONO"
);

const spRows = living.filter(
  (row) =>
    String(
      first(row, [
        "supply model",
        "Supply Model",
      ])
    ).trim().toUpperCase() === "SP"
);

// Existing Occupancy is an independent operating snapshot. It must never be
// treated as Shram Park or included in the FONO + SP Living comparison.
const existingRows = living.filter(
  (row) => String(first(row, ["supply model", "Supply Model"])).trim().toUpperCase() === "EXISTING"
);
const channelLiving = [...fonoRows, ...spRows];
const occupiedNests = channelLiving.reduce(
  (sum, row) => sum + num(first(row, ["occupied nests", "Occupied Nests", "occupied"])),
  0
);

const livingSummary = {
  fono: summarizeLiving(fonoRows),
  sp: summarizeLiving(spRows),
  combined: summarizeLiving(channelLiving),
  existing: summarizeLiving(existingRows),
};

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

  // Dashboard_Overview stores approved plans and editorial configuration only.
  // Actual operating results below are calculated from the source tabs.
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

  const peopleByActorId = Object.fromEntries(
    people.map((person) => [
      String(first(person, ["actor id", "Actor ID"])).trim(),
      first(person, ["display name", "Display Name", "name", "Name"]),
    ])
  );
  const ownerName = (actorId: any) => {
    const id = String(actorId || "").trim();
    return peopleByActorId[id] || id || "Owner not configured";
  };
  const sumField = (rows: Record<string, any>[], keys: string[]) =>
    rows.reduce((sum, row) => sum + num(first(row, keys)), 0);

  // Overview is a master view: derive these actuals from their authoritative
  // operational tabs instead of asking Operations to maintain a duplicate
  // Dashboard_Overview number for each one.
  const contractedActual = sumField(enterpriseDemand, ["headcount matched", "Headcount Matched"]);
  const capacityActual = sumField(channelLiving, ["contracted nests", "Contracted Nests"]);
  const activeActual = occupiedNests;
  const eligibleActual = sumField(essentials, ["eligible members", "Eligible Members"]);
  const buyersActual = sumField(essentials, ["buying members", "Buying Members"]);
  const fulfilledActual = sumField(essentials, ["orders fulfilled", "Orders Fulfilled"]);
  const essentialsBilledActual = sumField(essentials, ["essentials billed inr", "Essentials Billed INR"]);
  const workDemandActual = sumField(work, ["open headcount", "Open Headcount"]);
  const workSupplyActual = sumField(work, ["matched headcount", "Matched Headcount"]);
  const attachActual = eligibleActual > 0 ? Math.round((buyersActual / eligibleActual) * 100) : 0;
  const arpuActual = buyersActual > 0 ? Math.round(essentialsBilledActual / buyersActual) : 0;
  const cmActual = sumField(finance, ["cm2 inr", "CM2 INR"]);
  const demandOwner = ownerName(first(enterpriseDemand[0] || {}, ["owner actor id", "Owner Actor ID"]));
  const livingOwner = ownerName(first(living[0] || {}, ["next action owner actor id", "Next Action Owner Actor ID"]));
  const essentialsOwner = ownerName(first(essentials[0] || {}, ["next action owner actor id", "Next Action Owner Actor ID"]));
  const financeOwner = ownerName(first(finance[0] || {}, ["owner actor id", "Owner Actor ID", "finance owner actor id"]));

// Use the newest timestamp written by any connected operational source. This
// keeps Overview in step with the source tabs without a duplicate Overview
// period field for Operations to maintain.
const overviewSnapshot = latestSourceSnapshot(
  data.dashboardOverview,
  data.livingHourly,
  data.livingDashboard,
  data.workHourly,
  data.workDashboard,
  data.essentialsHourly,
  data.essentialsDashboard,
  data.essentialsCohorts,
  data.essentialsInventory,
  data.financeDaily,
  data.peopleRoster,
  data.peopleDashboard,
  data.peoplePerformance,
  data.peopleFollowThrough,
  data.enterpriseDemand,
  data.memberActivation,
  data.memberNpsDashboard,
  data.memberNpsFeedback,
  data.memberNpsResponses,
  data.learningHistory
);
const reportingPeriod = sourceCalendarMeta(overviewSnapshot);
// CM is a financial measure, so its forecast calendar is the latest finance
// business date.  It must never be advanced by updates in a different source
// tab (for example, People or Member NPS).
const financeBusinessDate = latestDateForHeaders(data.financeDaily, [
  "business date",
  "business_date",
]);
const cmReportingPeriod = sourceCalendarMeta(financeBusinessDate ?? overviewSnapshot);
// Overview consumes the same Action_Log that Operations updates.  This avoids
// a second, Overview-only action register and keeps the roll-up auditable.
const executionActions: ExecutionAction[] = actionLog.map((row, index) => {
  const id = String(first(row, ["action id", "Action ID", "id"]) || `sheet-action-${index + 1}`).trim();
  const actorId = first(row, ["owner actor id", "Owner Actor ID"]);
  const detectedAt = String(
    first(row, ["proposed at", "Proposed At", "updated at", "Updated At"]) || reportingPeriod.snapshotAt
  );
  const metric = String(first(row, ["expected metric", "Expected Metric"]) || "Operating outcome").trim();
  const evidence = String(first(row, ["required evidence", "Required Evidence"]) || "").trim();
  const sourceState = String(first(row, ["state", "State"]) || "Detected").trim();
  const status: ActionStatus = (["Detected", "Agreed", "Assigned", "Resolved", "Closed", "Verified", "Dismissed"] as const).includes(sourceState as ActionStatus)
    ? sourceState as ActionStatus
    : "Detected";
  const actionType = status === "Agreed" ? "agree" : status === "Assigned" ? "assign" : status === "Resolved" ? "resolve" : status === "Closed" ? "close" : status === "Verified" ? "verify" : status === "Dismissed" ? "dismiss" : "detect";

  return {
    source: "system_detected",
    id,
    title: String(first(row, ["operating objective", "Operating Objective", "title", "expected metric"]) || "Action").trim(),
    owner: ownerName(actorId),
    team: String(first(row, ["team", "lane", "approval tier"]) || "Operations").trim(),
    theatre: String(first(row, ["theatre", "theatre id", "where"]) || "Not recorded").trim(),
    committedBy: ownerName(actorId),
    dueAt: String(first(row, ["due at", "Due At"]) || reportingPeriod.snapshotAt),
    evidence: evidence ? [evidence] : [],
    affectedMembers: num(first(row, ["affected members", "idle units", "matched headcount"])),
    expectedMetric: {
      key: metric,
      label: metric,
      direction: "up",
      checkWindowDays: 1,
      baselineValue: num(first(row, ["baseline value", "Baseline Value"])),
      actualValue: null,
      unit: "",
    },
    actionLog: [{
      id: `${id}-detected`,
      queue_item_id: id,
      actor_id: String(actorId || "").trim() || null,
      action_type: actionType,
      previous_status: null,
      new_status: status,
      executed_at: detectedAt,
      note: String(first(row, ["operating objective", "Operating Objective", "title"]) || "").trim() || undefined,
    }] satisfies ActionLogEntry[],
    route: { screen: "Overview" } as DashboardRoute,
    mismatchId: String(first(row, ["incident id", "Incident ID"]) || "").trim() || undefined,
    meetingId: null,
    meetingLabel: null,
    meetingDate: null,
    decisionText: null,
    nextMeetingDue: null,
  };
});
// Finance provides the current CM snapshot. Project it using the elapsed
// source-period pace so Overview does not depend on a separately keyed-in
// month-end actual/projection.
const cmProjection = cmReportingPeriod.day > 0
  ? Math.round((cmActual / cmReportingPeriod.day) * cmReportingPeriod.daysInMonth)
  : 0;
const monthlyCMTarget = num(metrics.Monthly_CM_Target);
const remainingCmGap = Math.max(0, monthlyCMTarget - cmActual);
const requiredDailyCmPace = cmReportingPeriod.daysLeft > 0
  ? remainingCmGap / cmReportingPeriod.daysLeft
  : 0;
const currentDailyCmPace = cmReportingPeriod.day > 0
  ? cmActual / cmReportingPeriod.day
  : 0;
const askRateMultiple = currentDailyCmPace > 0
  ? requiredDailyCmPace / currentDailyCmPace
  : 0;

  return {
  availablePeriods: data.availablePeriods,
  selectedPeriod: data.selectedPeriod,
  meta: {
    block: "",
    ...reportingPeriod,
    theatresBehind: 0,
    illustrative: false,
  },
  cmReportingPeriod,

  monthlyCMTarget,
  monthEndProjection: cmProjection || cmActual || num(metrics.Month_End_Projection),

  sourceRegistry: toObjects(data.sourceRegistry),
  policyRegistry: toObjects(data.policyRegistry),
  ownerRegistry: toObjects(data.ownerRegistry),

  living,
  finance,
  studios,
  theatres,
  enterpriseDemand,
  memberActivation: toObjects(data.memberActivation),
  incidentLog: toObjects(data.incidentLog),
  actionLog,
  executionActions,
  evidenceLog: toObjects(data.evidenceLog),
  approvalLog: toObjects(data.approvalLog),
  work,
  essentials,
  people,
  askRateMultiple,

  flywheel: {
    living: {
      demand: contractedActual,
      supply: capacityActual,
      occupied: occupiedNests,
    },

    work: {
      demand: workDemandActual,
      supply: workSupplyActual,
    },

    essentials: {
      eligible: eligibleActual,
      purchasing: buyersActual,
      fulfilled: fulfilledActual,
    },
  },

  spine: [
    {
      id: "contracted",
      label: "Demand contracted",
      lane: "Demand",
      actual: contractedActual,
      plan: plans.Demand_Contracted,
      unit: "members",
      owner: demandOwner,
    },
    {
      id: "capacity",
      label: "Capacity live",
      lane: "Shram Park",
      actual: capacityActual,
      plan: plans.Capacity_Live,
      unit: "Nests",
      owner: livingOwner,
    },
    {
      id: "active",
      label: "Members active",
      lane: "FONO",
      actual: activeActual,
      plan: plans.Members_Active,
      unit: "members",
      owner: livingOwner,
    },
    {
      id: "attach",
      label: "Attach",
      lane: "Essentials",
      actual: attachActual,
      plan: plans.Attach,
      unit: "percent",
      owner: essentialsOwner,
    },
    {
      id: "arpu",
      label: "ARPU",
      lane: "Economics",
      actual: arpuActual,
      plan: plans.ARPU,
      unit: "INR",
      owner: essentialsOwner,
    },
    {
      id: "cm",
      label: "CM",
      lane: "Economics",
      actual: cmActual,
      plan: plans.CM,
      unit: "INR",
      owner: financeOwner,
    },
  ],

  rootCause: rootCause.map((row) => ({
    id: row.id,
    constraintId: row.constraintId,
    rootCause: row.rootCause,
    evidence: row.evidence,
    owner: row.owner,
    nextStep: row.nextStep,
    why1: row.why1,
    why2: row.why2,
    why3: row.why3,
    why4: row.why4,
    why5: row.why5,
    reviewStatus: row.reviewStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
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
    alertStatus: row.alertStatus,
    alertQueuedAt: row.alertQueuedAt,
  })),

  constraints: constraints.map((row) => ({
  id: row.id,
  title: row.title,
  where: row.where,
  theatre: row.theatre || "",
  impact: String(row.impact ?? "").trim() === "" ? null : num(row.impact),
  idleUnits: String(row.idleUnits ?? "").trim() === "" ? null : num(row.idleUnits),
  cmPerUnit: String(row.cmPerUnit ?? "").trim() === "" ? null : num(row.cmPerUnit),
  riskHours: String(row.riskHours ?? "").trim() === "" ? null : num(row.riskHours),
  ageHours: String(row.ageHours ?? "").trim() === "" ? null : num(row.ageHours),
  thresholdHours: String(row.thresholdHours ?? "").trim() === ""
    ? (String(row.riskHours ?? "").trim() === "" ? null : num(row.riskHours))
    : num(row.thresholdHours),
  recoverableShare: String(row.recoverableShare ?? "").trim() === "" ? null : num(row.recoverableShare),
  confidence: row.confidence || "",
  deadlineAt: row.deadlineAt || "",
  detail: row.detail,
  owner: row.owner,
  next: row.next,
  lane: row.lane,
  stalledBlocks: num(row.stalledBlocks),
})),
  history: history.map((row) => ({
  day: new Date(row.business_date).getDate(),
  actual: num(row.actual),
  businessDate: row.business_date || "",
  capturedAt: row.captured_at || row.capturedAt || row.business_date || "",
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
      snapshotTime: previousBlocks[0].snapshot_time || previousBlocks[0].snapshotTime || "",
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
      snapshotTime: "",
    },

    livingSummary,
  fonoOccupancy: fonoOccupancyLive,
  livingDashboard,
  workDashboard: toObjects(data.workDashboard),
  essentialsDashboard: toObjects(data.essentialsDashboard),
  essentialsCohorts: toObjects(data.essentialsCohorts),
  essentialsInventory: toObjects(data.essentialsInventory),
  memberNpsDashboard: toObjects(data.memberNpsDashboard),
  memberNpsFeedback: toObjects(data.memberNpsFeedback),
  memberNpsResponses: toObjects(data.memberNpsResponses),
  peopleDashboard: toObjects(data.peopleDashboard),
  peoplePerformance: toObjects(data.peoplePerformance),
  peopleFollowThrough: toObjects(data.peopleFollowThrough),
  learningHistory: toObjects(data.learningHistory),
  cashControlChannels: toObjects(data.cashControlChannels),

  dashboardContent: parseDashboardContent(data.dashboardContent),
};
}


































