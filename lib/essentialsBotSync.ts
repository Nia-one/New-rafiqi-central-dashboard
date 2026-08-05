import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { reportingMonthFromDate, REPORTING_MONTH_HEADER } from "./reportingMonth";

const SOURCE_SHEET_ID = process.env.ESSENTIALS_BOT_SHEET_ID || "1C8y3uVxp5toMwLBPGVWbltOoNX_hVuKtvyfiqIUC0oY";
const BOT_MIRRORS = [
  ["Orders", "BOT_ESS_ORDERS"],
  ["Order_Items", "TEAM_ESSENTIALS_BOT"],
  ["Delivery_Status", "BOT_ESS_DELIVERY_STATUS"],
  ["Customer_Master", "BOT_ESS_CUSTOMER_MASTER"],
  ["Guest_Master", "BOT_ESS_GUEST_MASTER"],
  ["Inventory_Master", "TEAM_ESSENTIALS_INVENTORY"],
] as const;
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const num = (v: unknown) => Number(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const stableToken = (...parts: unknown[]) => crypto.createHash("sha1").update(parts.map(norm).join("|")).digest("hex").slice(0, 16).toUpperCase();
const cell = (row: unknown[], headers: string[], ...names: string[]) => {
  const wanted = new Set(names.map(norm));
  const i = headers.findIndex((h) => wanted.has(norm(h)));
  return i < 0 ? "" : row[i];
};
const table = (values: unknown[][]) => ({ headers: (values[0] || []).map(String), rows: values.slice(1).filter((r) => r.some((c) => String(c ?? "").trim())) });
const hour = (v: unknown) => { const d = new Date(String(v || "")); return Number.isNaN(d.getTime()) ? "undated" : d.toISOString().slice(0, 13); };
const columnLetter = (index: number) => {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value--;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
};

function credentials() {
  return googleServiceAccountCredentials();
}
async function client(write = false) {
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: [write ? "https://www.googleapis.com/auth/spreadsheets" : "https://www.googleapis.com/auth/spreadsheets.readonly"] });
  return google.sheets({ version: "v4", auth });
}

async function mirrorBotTables(valueRanges: unknown[][][]) {
  const spreadsheetId = process.env.GOOGLE_LEGACY_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU";
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing");
  const sheets = await client(true);
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const existing = new Map((metadata.data.sheets || []).map((sheet) => [sheet.properties?.title || "", sheet.properties?.sheetId]));
  if (existing.has("00_READ_ME")) {
    return { skipped: true, reason: "Fresh dashboard workbook keeps bot mirrors protected; bot data syncs directly to backend." };
  }
  const missing = BOT_MIRRORS.filter(([, target]) => !existing.has(target));
  if (missing.length) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: missing.map(([, title]) => ({ addSheet: { properties: { title } } })) } });
    added.data.replies?.forEach((reply, index) => existing.set(missing[index][1], reply.addSheet?.properties?.sheetId));
  }
  const red = { red: 0.8, green: 0.05, blue: 0.05 };
  const white = { red: 1, green: 1, blue: 1 };
  const requests = BOT_MIRRORS.flatMap(([, target], index) => {
    const sheetId = existing.get(target);
    const width = Math.max(1, valueRanges[index]?.[0]?.length || 1);
    return sheetId == null ? [] : [
      { updateSheetProperties: { properties: { sheetId, tabColorStyle: { rgbColor: red }, gridProperties: { frozenRowCount: 1 } }, fields: "tabColorStyle,gridProperties.frozenRowCount" } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: width }, cell: { userEnteredFormat: { backgroundColor: red, textFormat: { foregroundColor: white, bold: true }, wrapStrategy: "WRAP" }, note: "RED = BOT MIRROR. Do not edit; refreshed automatically from the Essentials Bot source." }, fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy),note" } },
    ];
  });
  await sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: BOT_MIRRORS.map(([, target]) => `'${target}'!A:AZ`) } });
  const data = BOT_MIRRORS.map(([, target], index) => ({ range: `'${target}'!A1`, values: valueRanges[index] || [] })).filter((entry) => entry.values.length);
  if (data.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data } });
  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  return Object.fromEntries(BOT_MIRRORS.map(([source, target], index) => [target, { source, rows: Math.max(0, (valueRanges[index] || []).length - 1) }]));
}

export async function ensureEssentialsBotSchema() {
  const sheets = await client(true);
  const required: Record<string, string[]> = {
    Orders: ["payment_collected_at", "collected_amount"],
    Delivery_Status: ["order_id", "dispatched_at", "delivered_at", "delivery_status", "delivery_owner", "updated_at"],
    Order_Items: ["direct_fulfilment_cost", "packaging_cost", "delivery_cost", "total_fulfilment_cost", "nia_contribution_margin"],
  };
  const tabs = Object.keys(required);
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_SHEET_ID, ranges: tabs.map((tab) => `${tab}!1:1`) });
  const data: { range: string; values: string[][] }[] = [];
  tabs.forEach((tab, index) => {
    const headers = (response.data.valueRanges?.[index].values?.[0] || []).map(String);
    const missing = required[tab].filter((wanted) => !headers.some((existing) => norm(existing) === norm(wanted)));
    if (missing.length) data.push({ range: `${tab}!A1`, values: [[...headers, ...missing]] });
  });
  if (data.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SOURCE_SHEET_ID, requestBody: { valueInputOption: "RAW", data } });

  // Calculated columns remain formula-owned; users only maintain the three cost inputs.
  const finalHeaders = [...((response.data.valueRanges?.[2].values?.[0] || []).map(String))];
  required.Order_Items.forEach((header) => {
    if (!finalHeaders.some((existing) => norm(existing) === norm(header))) finalHeaders.push(header);
  });
  const findColumn = (...names: string[]) => {
    const wanted = new Set(names.map(norm));
    const index = finalHeaders.findIndex((header) => wanted.has(norm(header)));
    return index < 0 ? "" : columnLetter(index);
  };
  const direct = findColumn("direct_fulfilment_cost");
  const packaging = findColumn("packaging_cost");
  const delivery = findColumn("delivery_cost");
  const total = findColumn("total_fulfilment_cost");
  const margin = findColumn("nia_contribution_margin");
  const grossProfit = findColumn("gross_profit", "gross_profit_amount");
  const revenue = findColumn("total_price", "line_total", "selling_amount", "revenue");
  const cost = findColumn("cost", "purchase_cost", "purchase_rate");
  const quantity = findColumn("quantity", "qty");
  const formulaRanges = [`Order_Items!${total}2`, `Order_Items!${margin}2`];
  const existingFormulas = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_SHEET_ID, ranges: formulaRanges, valueRenderOption: "FORMULA" });
  const formulaData: { range: string; values: string[][] }[] = [];
  if (!existingFormulas.data.valueRanges?.[0].values?.[0]?.[0]) {
    formulaData.push({ range: formulaRanges[0], values: [[`=ARRAYFORMULA(IF(A2:A="","",N(${direct}2:${direct})+N(${packaging}2:${packaging})+N(${delivery}2:${delivery})))`]] });
  }
  if (!existingFormulas.data.valueRanges?.[1].values?.[0]?.[0]) {
    const baseMargin = grossProfit
      ? `N(${grossProfit}2:${grossProfit})`
      : revenue && cost
        ? `N(${revenue}2:${revenue})-(N(${cost}2:${cost})${quantity ? `*IF(N(${quantity}2:${quantity})=0,1,N(${quantity}2:${quantity}))` : ""})`
        : "0";
    formulaData.push({ range: formulaRanges[1], values: [[`=ARRAYFORMULA(IF(A2:A="","",${baseMargin}-N(${total}2:${total})))`]] });
  }
  if (formulaData.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SOURCE_SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: formulaData } });
  return { addedToTabs: data.map((entry) => entry.range.split("!")[0]), formulasAdded: formulaData.map((entry) => entry.range) };
}

async function upsert(tabName: string, keyHeader: string, records: Record<string, unknown>[]) {
  if (!records.length) return { inserted: 0, updated: 0 };
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const sheets = await client(true);
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A:AZ` });
  const rows = (result.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((h) => norm(h) === norm(keyHeader));
  if (keyIndex < 0) throw new Error(`${tabName} is missing ${keyHeader}`);
  const existing = new Map<string, number>();
  rows.slice(1).forEach((row, index) => { const key = norm(row[keyIndex]); if (key) existing.set(key, index + 2); });
  const append: unknown[][] = [];
  let updated = 0;
  for (const record of records) {
    const key = norm(record[keyHeader]);
    if (!key) continue;
    const rowNumber = existing.get(key);
    const prior = rowNumber ? (rows[rowNumber - 1] || []) : [];
    const output = headers.map((header, index) => {
      const incoming = record[header];
      return incoming === undefined || incoming === null || incoming === "" ? (prior[index] ?? "") : incoming;
    });
    if (rowNumber) {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tabName}!A${rowNumber}`, valueInputOption: "USER_ENTERED", requestBody: { values: [output] } });
      updated++;
    } else append.push(output);
  }
  if (append.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${tabName}!A:AZ`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: append } });
  return { inserted: append.length, updated };
}

async function reconcileBotOwnedRows(tabName: string, keyHeader: string, desiredKeys: Set<string>, owns: (row: unknown[], headers: string[]) => boolean) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const sheets = await client(true);
  const [values, metadata] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A:AZ` }),
    sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" }),
  ]);
  const rows = (values.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === norm(keyHeader));
  const sheetId = metadata.data.sheets?.find((sheet) => sheet.properties?.title === tabName)?.properties?.sheetId;
  if (keyIndex < 0 || sheetId == null) return 0;
  const stale = rows.slice(1).map((row, index) => ({ row, rowIndex: index + 1 })).filter(({ row }) => owns(row, headers) && !desiredKeys.has(norm(row[keyIndex])));
  if (stale.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: stale.sort((a, b) => b.rowIndex - a.rowIndex).map(({ rowIndex }) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } })) } });
  return stale.length;
}

export async function syncEssentialsBotData() {
  const source = await client();
  const ranges = ["Orders!A:AZ", "Order_Items!A:AZ", "Delivery_Status!A:AZ", "Customer_Master!A:AZ", "Guest_Master!A:AZ", "Inventory_Master!A:AZ"];
  const result = await source.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_SHEET_ID, ranges });
  const rawTables = (result.data.valueRanges || []).map((v) => (v.values || []) as unknown[][]);
  const mirrors = await mirrorBotTables(rawTables);
  const [orders, items, deliveries, customers, guests, inventory] = rawTables.map((values) => table(values));
  const customerById = new Map(customers.rows.map((r) => [norm(cell(r, customers.headers, "id")), r]));
  const guestById = new Map(guests.rows.map((r) => [norm(cell(r, guests.headers, "id")), r]));
  const deliveryByOrder = new Map(deliveries.rows.map((r) => [norm(cell(r, deliveries.headers, "order_id")), r]));
  const itemByOrder = new Map<string, unknown[][]>();
  items.rows.forEach((r) => { const key = norm(cell(r, items.headers, "order_id")); if (key) itemByOrder.set(key, [...(itemByOrder.get(key) || []), r]); });
  const eligibleByStudio = new Map<string, Set<string>>();
  const registerEligible = (row: unknown[], headers: string[], kind: string) => {
    const studio = String(cell(row, headers, "studio_id", "studio", "studio_code") || "").trim();
    const member = String(cell(row, headers, "id", "customer_id", "guest_id", "mobile", "phone") || "").trim();
    if (!studio || !member) return;
    const key = norm(studio);
    const members = eligibleByStudio.get(key) || new Set<string>();
    members.add(`${kind}:${norm(member)}`);
    eligibleByStudio.set(key, members);
  };
  customers.rows.forEach((row) => registerEligible(row, customers.headers, "customer"));
  guests.rows.forEach((row) => registerEligible(row, guests.headers, "guest"));
  type Group = { studio: string; theatre: string; captured: string; members: Set<string>; placed: number; fulfilled: number; billed: number; collected: number; cogs: number; fulfilment: number; savings: number; unresolved: number };
  const groups = new Map<string, Group>();
  const activationGroups = new Map<string, Record<string, unknown>>();
  for (const row of orders.rows) {
    const orderId = norm(cell(row, orders.headers, "id", "order_id"));
    const customer = customerById.get(norm(cell(row, orders.headers, "customer_id")));
    const guest = guestById.get(norm(cell(row, orders.headers, "guest_id")));
    const studio = String(cell(row, orders.headers, "studio_id") || (customer && cell(customer, customers.headers, "studio_id")) || (guest && cell(guest, guests.headers, "studio_id")) || "UNRESOLVED");
    const theatre = String(cell(row, orders.headers, "theatre_code", "theatre_name") || (customer && cell(customer, customers.headers, "theatre_code", "theatre_name")) || (guest && cell(guest, guests.headers, "theatre_code", "theatre_name")) || "UNRESOLVED");
    const captured = String(cell(row, orders.headers, "updated_at", "order_date", "created_at"));
    const key = `${studio}|${hour(captured)}`;
    const g = groups.get(key) || { studio, theatre, captured, members: new Set<string>(), placed: 0, fulfilled: 0, billed: 0, collected: 0, cogs: 0, fulfilment: 0, savings: 0, unresolved: 0 };
    g.placed++;
    g.members.add(norm(cell(row, orders.headers, "customer_id", "guest_id", "customer_mobile")) || orderId);
    if (studio === "UNRESOLVED") g.unresolved++;
    const delivery = deliveryByOrder.get(orderId);
    const deliveryStatus = norm((delivery && cell(delivery, deliveries.headers, "delivery_status")) || cell(row, orders.headers, "order_status"));
    if (["delivered", "fulfilled", "complete", "completed"].includes(deliveryStatus)) g.fulfilled++;
    g.billed += num(cell(row, orders.headers, "grand_total", "subtotal"));
    if (["paid", "collected", "complete", "completed"].includes(norm(cell(row, orders.headers, "payment_status")))) g.collected += num(cell(row, orders.headers, "collected_amount", "grand_total"));
    for (const item of itemByOrder.get(orderId) || []) {
      const qty = num(cell(item, items.headers, "quantity")) || 1;
      g.cogs += num(cell(item, items.headers, "cost")) || qty * num(cell(item, items.headers, "purchase_rate"));
      g.fulfilment += num(cell(item, items.headers, "direct_fulfilment_cost")) + num(cell(item, items.headers, "packaging_cost")) + num(cell(item, items.headers, "delivery_cost"));
      g.savings += qty * num(cell(item, items.headers, "nia_savings"));
    }
    groups.set(key, g);

    // Bot orders are already a member-activation signal. Keep these records bot-owned
    // so operators do not duplicate the same activation in TEAM_MEMBER_ACTIVATION.
    const customerRef = cell(row, orders.headers, "customer_id") || cell(row, orders.headers, "guest_id") || cell(row, orders.headers, "customer_mobile") || orderId;
    const memberToken = `BOT-MEMBER-${stableToken(customerRef, studio)}`;
    const activationId = `BOT-ACTV-${stableToken(customerRef, studio)}`;
    const prior = activationGroups.get(activationId);
    const billed = num(cell(row, orders.headers, "grand_total", "subtotal"));
    const collected = ["paid", "collected", "complete", "completed"].includes(norm(cell(row, orders.headers, "payment_status")))
      ? num(cell(row, orders.headers, "collected_amount", "grand_total")) : num(cell(row, orders.headers, "collected_amount"));
    activationGroups.set(activationId, {
      "activation id": activationId,
      "member token": memberToken,
      "activated at": prior?.["activated at"] || captured,
      "theatre id": theatre,
      "studio id": studio,
      "membership billed inr": num(prior?.["membership billed inr"]) + billed,
      "membership collected inr": num(prior?.["membership collected inr"]) + collected,
      "collection leakage inr": Math.max(0, num(prior?.["membership billed inr"]) + billed - num(prior?.["membership collected inr"]) - collected),
      "verification status": prior?.["verification status"] || "Pending",
      "source submission id": `BOT-ESS-${orderId}`,
      "acquisition source": "Essentials Bot",
      "updated at": captured || new Date().toISOString(),
      [REPORTING_MONTH_HEADER]: reportingMonthFromDate(captured || new Date().toISOString()),
    });
  }
  const unresolvedStudioOrders = [...groups.values()]
    .filter((group) => group.studio === "UNRESOLVED")
    .reduce((sum, group) => sum + group.placed, 0);
  const hourly = [...groups.entries()].filter(([, group]) => group.studio !== "UNRESOLVED").map(([key, g]) => ({
    "essentials hourly id": `BOT-ESS-${key.replace(/[^A-Za-z0-9]+/g, "-")}`, "theatre id": g.theatre, "studio id": g.studio,
    "eligible members": eligibleByStudio.get(norm(g.studio))?.size || g.members.size,
    "buying members": g.members.size, "orders placed": g.placed, "orders fulfilled": g.fulfilled,
    "essentials billed inr": g.billed, "essentials collected inr": g.collected, "product cogs inr": g.cogs,
    "direct fulfilment cost inr": g.fulfilment, "member savings inr": g.savings, "nia margin inr": g.billed - g.cogs - g.fulfilment,
    "attach pct": (eligibleByStudio.get(norm(g.studio))?.size || g.members.size) > 0
      ? g.members.size / (eligibleByStudio.get(norm(g.studio))?.size || g.members.size) : "",
    "primary blocker": g.unresolved ? `${g.unresolved} order(s) missing studio mapping` : "", "updated at": g.captured, "captured at": g.captured, [REPORTING_MONTH_HEADER]: reportingMonthFromDate(g.captured),
  }));
  const quarantined = [...groups.entries()].filter(([, group]) => group.studio === "UNRESOLVED").map(([key, g]) => ({
    "essentials hourly id": `BOT-ESS-${key.replace(/[^A-Za-z0-9]+/g, "-")}`,
    "theatre id": "UNRESOLVED", "studio id": "UNRESOLVED", "buying members": 0, "orders placed": 0,
    "orders fulfilled": 0, "essentials billed inr": 0, "essentials collected inr": 0, "product cogs inr": 0,
    "direct fulfilment cost inr": 0, "member savings inr": 0, "nia margin inr": 0,
    "primary blocker": `${g.placed} order(s) quarantined: missing studio mapping`, "updated at": g.captured, "captured at": g.captured, [REPORTING_MONTH_HEADER]: reportingMonthFromDate(g.captured),
  }));
  const inventoryRows = inventory.rows.map((r) => ({
    "sku": cell(r, inventory.headers, "product_code", "product_id", "id"), "studio": cell(r, inventory.headers, "studio_id") || "Warehouse",
    "supply model": "Existing bot", "stockout": num(cell(r, inventory.headers, "available_stock")) <= 0 ? "Yes" : "No",
    "days cover": "", "zero sale": "", "owner": cell(r, inventory.headers, "warehouse_location") || "Essentials",
  }));
  const essentialsHourly = await upsert("Essentials_Hourly", "essentials hourly id", [...hourly, ...quarantined]);
  const essentialsInventory = await upsert("Essentials_Inventory", "sku", inventoryRows);
  const memberActivations = await upsert("Member_Activation", "activation id", [...activationGroups.values()]);
  const removedStaleHourly = await reconcileBotOwnedRows("Essentials_Hourly", "essentials hourly id", new Set([...hourly, ...quarantined].map((row) => norm(row["essentials hourly id"]))), (row, headers) => norm(cell(row, headers, "essentials hourly id")).startsWith("bot-ess-"));
  const removedStaleInventory = await reconcileBotOwnedRows("Essentials_Inventory", "sku", new Set(inventoryRows.map((row) => norm(row.sku))), (row, headers) => norm(cell(row, headers, "supply model")) === "existing bot");
  return {
    mirrors,
    sourceRows: { orders: orders.rows.length, items: items.rows.length, deliveries: deliveries.rows.length, inventory: inventory.rows.length },
    unresolvedStudioOrders,
    essentialsHourly: { ...essentialsHourly, removedStale: removedStaleHourly },
    essentialsInventory: { ...essentialsInventory, removedStale: removedStaleInventory },
    memberActivations,
  };
}
