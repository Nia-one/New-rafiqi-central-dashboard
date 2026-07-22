type Row = Record<string, unknown>;

const number = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[,₹%]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const value = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const found = row[key];
    if (
      found !== undefined &&
      found !== null &&
      String(found).trim() !== ""
    ) {
      return found;
    }
  }
  return undefined;
};

const purchaseEvents = (model: any) =>
  (model.events || []).filter(
    (event: Row) =>
      String(value(event, "event_type", "event type") || "").toLowerCase() ===
      "purchase"
  );

const enrichPurchaseEvents = (model: any) => {
  const purchases = purchaseEvents(model);

  const locations: Row[] = model.locations || [];
  const people: Row[] = model.people || [];

  const peopleByName = new Map(
    people.map((row) => [
      String(value(row, "person", "person_name", "name") || "").trim(),
      row,
    ])
  );

  const locationByStudio = new Map(
    locations.map((row) => [
      String(value(row, "studio_name", "studio") || "").trim(),
      row,
    ])
  );

  return purchases.map((event: Row) => {
    // Already enriched
    if (value(event, "studio_name")) {
      return event;
    }

    const person = String(
      value(event, "person", "person_name", "name") || ""
    ).trim();

    const personRow = peopleByName.get(person);

    if (!personRow) {
      return event;
    }

    const studioName = String(
      value(personRow, "studio_name", "studio") || ""
    ).trim();

    const locationRow = locationByStudio.get(studioName);

    if (!locationRow) {
      return event;
    }

    return {
      ...event,
      theatre: value(locationRow, "theatre"),
      location: value(locationRow, "location"),
      studio_name: value(locationRow, "studio_name"),
      studio: value(locationRow, "studio_name"),
      studio_code: value(locationRow, "studio_code", "studio_id"),
    };
  });
};

export function buildOverview(model: any) {
  const locations: Row[] = model.locations || [];
  const inventory: Row[] = model.inventory || [];
  const dashboard: Row[] = model.dashboard || [];

  const purchases = enrichPurchaseEvents(model);

  const metric = (code: string) =>
    dashboard.find(
      (row) => row["system metric code"] === code
    );

  const gmv = purchases.reduce(
    (sum: number, event: Row) =>
      sum +
      number(
        value(
          event,
          "amount",
          "value",
          "gmv",
          "total_amount"
        )
      ),
    0
  );

  const activeMembers = locations.reduce(
    (sum, row) =>
      sum +
      number(
        value(
          row,
          "active_members",
          "active members"
        )
      ),
    0
  );

  const capacity = locations.reduce(
    (sum, row) =>
      sum +
      number(
        value(
          row,
          "capacity",
          "nests",
          "supply"
        )
      ),
    0
  );

  const liveStudios = locations.filter(
    (row) =>
      String(value(row, "status") || "").toLowerCase() === "live"
  ).length;

  const paidOrders = purchases.length;

  const attachRate = activeMembers
    ? Number(((paidOrders / activeMembers) * 100).toFixed(2))
    : null;

  const arpu = activeMembers
    ? Number((gmv / activeMembers).toFixed(2))
    : null;

  const inventoryValue = inventory.reduce(
    (sum, row) =>
      sum +
      number(
        value(
          row,
          "inventory_value",
          "inventory value",
          "on_hand_value"
        )
      ),
    0
  );

  const cmRow = metric("CM");

  const cm = number(
    value(cmRow || {}, "actual MTD", "actual_mtd")
  );

  const cmTarget = number(
    value(cmRow || {}, "monthly target", "target")
  );

  const stockouts = inventory.filter((row) => {
    const status = String(
      value(row, "stock_status", "status") || ""
    ).toLowerCase();

    return (
      status.includes("stockout") ||
      number(value(row, "days_cover", "days cover")) <= 0
    );
  }).length;

  return {
    capacity,
    activeMembers,
    paidOrders,
    gmv,
    attachRate,
    arpu,
    inventoryValue,
    cm,
    cmTarget,
    stockouts,
    liveStudios,
    supplySites: locations.length,
    demandBeds: paidOrders,
    totalMembers: activeMembers,
  };
}