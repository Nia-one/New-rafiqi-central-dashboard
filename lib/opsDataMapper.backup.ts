import { getDashboardData } from "./dashboardService";

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
    String(value).replace(/[₹,%]/g, "").trim()
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

  // Convert all Google Sheet tabs into objects
  const studios = toObjects(data.studioMaster);
  const people = toObjects(data.peopleRoster);
  const living = toObjects(data.livingHourly);
  const work = toObjects(data.workHourly);
  const essentials = toObjects(data.essentialsHourly);
  const finance = toObjects(data.financeDaily);

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

  return {};
  test: true,
    meta: {
      block:
        metrics.Current_Block ??
        metrics.Block ??
        "",

      updatedAt:
        metrics.Last_Updated ??
        metrics.Updated_At ??
        "",

      month:
        metrics.Month ??
        "",

      day:
        num(metrics.Day),

      daysInMonth:
        num(metrics.Days_In_Month),

      daysLeft:
        num(metrics.Days_Left),

      theatresBehind:
        num(metrics.Theatres_Behind),

      illustrative: false,
    },

    monthlyCMTarget: num(metrics.Monthly_CM_Target),

    monthEndProjection: num(metrics.Month_End_Projection),

    askRateMultiple: 1,

    spine: [
      {
        id: "contracted",
        label: "Demand contracted",
        lane: "Demand",
        actual: num(metrics.Demand_Contracted),
        plan: 0,
        unit: "members",
      },
      {
        id: "capacity",
        label: "Capacity live",
        lane: "Śram Park",
        actual: num(metrics.Capacity_Live),
        plan: 0,
        unit: "nests",
      },
      {
        id: "active",
        label: "Members active",
        lane: "FONO",
        actual: num(metrics.Members_Active),
        plan: 0,
        unit: "members",
      },
      {
        id: "attach",
        label: "Attach",
        lane: "Essentials",
        actual: num(metrics.Attach),
        plan: 0,
        unit: "%",
      },
      {
        id: "arpu",
        label: "ARPU",
        lane: "Economics",
        actual: num(metrics.ARPU),
        plan: 0,
        unit: "₹",
      },
      {
        id: "cm",
        label: "CM",
        lane: "Economics",
        actual: num(metrics.CM),
        plan: 0,
        unit: "₹",
      },
    ],

    constraints: [],

history: finance
  .filter(
    (row) =>
      first(row, ["Day", "day"]) !== "" &&
      first(row, ["CM", "Contribution Margin", "cm"]) !== ""
  )
  .map((row) => ({
    day: num(first(row, ["Day", "day"])),
    actual: num(first(row, ["CM", "Contribution Margin", "cm"])),
  })),

previousBlock: {
  cm: num(metrics.Previous_Block_CM),

  contracted: num(metrics.Previous_Block_Demand),

  membersActive: num(metrics.Previous_Block_Active),

  attach: num(metrics.Previous_Block_Attach),

  closures: num(metrics.Previous_Block_Closures),

  stockoutsClearedStudios: num(
    metrics.Previous_Block_Stockouts_Cleared
  ),

  stalledTheatre:
    metrics.Previous_Block_Stalled_Theatre ?? "",

  staleOwner:
    metrics.Previous_Block_Stale_Owner ?? "",

  staleHours: num(metrics.Previous_Block_Stale_Hours),

  staleOwners:
    metrics.Previous_Block_Stale_Owner
      ? [metrics.Previous_Block_Stale_Owner]
      : [],
},

    // First mapped entity from Studio_Master
    studios: studioSummary,
  };
}



