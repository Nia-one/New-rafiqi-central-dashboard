import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { reportingMonthFromDate, REPORTING_MONTH_HEADER } from "./reportingMonth";

const SOURCE_SHEET_ID = process.env.ESSENTIALS_BOT_SHEET_ID || "1C8y3uVxp5toMwLBPGVWbltOoNX_hVuKtvyfiqIUC0oY";
const COST_INPUT_TAB = "Rafiqi_Order_Item_Costs";
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
    Inventory_Master: ["studio_id", "mrp", "selling_price", "unit_cost", "member_savings", "owned_inventory_value", "days_cover", "zero_sale"],
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

  // Order-item fulfilment costs live in Rafiqi_Order_Item_Costs because the Bot
  // rebuilds Order_Items and removes any dashboard-owned columns from that tab.
  const inventoryHeaders = [...((response.data.valueRanges?.[2].values?.[0] || []).map(String))];
  required.Inventory_Master.forEach((header) => {
    if (!inventoryHeaders.some((existing) => norm(existing) === norm(header))) inventoryHeaders.push(header);
  });
  const inventoryColumn = (...names: string[]) => {
    const wanted = new Set(names.map(norm));
    const index = inventoryHeaders.findIndex((header) => wanted.has(norm(header)));
    return index < 0 ? "" : columnLetter(index);
  };
  const availableStock = inventoryColumn("available_stock");
  const mrp = inventoryColumn("mrp");
  const sellingPrice = inventoryColumn("selling_price");
  const unitCost = inventoryColumn("unit_cost");
  const memberSavings = inventoryColumn("member_savings");
  const ownedInventoryValue = inventoryColumn("owned_inventory_value");
  const productCode = inventoryColumn("product_code");
  const zeroSale = inventoryColumn("zero_sale");
  const inventoryFormulaRanges = [
    `Inventory_Master!${mrp}2`,
    `Inventory_Master!${sellingPrice}2`,
    `Inventory_Master!${unitCost}2`,
    `Inventory_Master!${memberSavings}2`,
    `Inventory_Master!${ownedInventoryValue}2`,
    `Inventory_Master!${zeroSale}2`,
  ];
  const existingInventoryFormulas = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_SHEET_ID, ranges: inventoryFormulaRanges, valueRenderOption: "FORMULA" });
  const inventoryFormulaData: { range: string; values: string[][] }[] = [];
  if (!existingInventoryFormulas.data.valueRanges?.[0].values?.[0]?.[0]) {
    inventoryFormulaData.push({ range: inventoryFormulaRanges[0], values: [[`=MAP(${productCode}2:${productCode},LAMBDA(sku,IF(sku="","",IFERROR(XLOOKUP(sku,Product_Master!B$2:B,Product_Master!I$2:I,""),""))))`]] });
  }
  if (!existingInventoryFormulas.data.valueRanges?.[1].values?.[0]?.[0]) {
    inventoryFormulaData.push({ range: inventoryFormulaRanges[1], values: [[`=MAP(${productCode}2:${productCode},LAMBDA(sku,IF(sku="","",IFERROR(XLOOKUP(sku,Product_Master!B$2:B,Product_Master!J$2:J,""),""))))`]] });
  }
  if (!existingInventoryFormulas.data.valueRanges?.[2].values?.[0]?.[0]) {
    inventoryFormulaData.push({ range: inventoryFormulaRanges[2], values: [[`=MAP(${productCode}2:${productCode},LAMBDA(sku,IF(sku="","",IFERROR(XLOOKUP(sku,Product_Master!B$2:B,Product_Master!H$2:H,""),""))))`]] });
  }
  if (!existingInventoryFormulas.data.valueRanges?.[3].values?.[0]?.[0]) {
    inventoryFormulaData.push({ range: inventoryFormulaRanges[3], values: [[`=ARRAYFORMULA(IF(A2:A="","",IF((${mrp}2:${mrp}="")+(${sellingPrice}2:${sellingPrice}=""),"",N(${mrp}2:${mrp})-N(${sellingPrice}2:${sellingPrice}))))`]] });
  }
  if (!existingInventoryFormulas.data.valueRanges?.[4].values?.[0]?.[0]) {
    inventoryFormulaData.push({ range: inventoryFormulaRanges[4], values: [[`=ARRAYFORMULA(IF(A2:A="","",IF(${unitCost}2:${unitCost}="","",N(${availableStock}2:${availableStock})*N(${unitCost}2:${unitCost}))))`]] });
  }
  if (!existingInventoryFormulas.data.valueRanges?.[5].values?.[0]?.[0]) {
    inventoryFormulaData.push({ range: inventoryFormulaRanges[5], values: [[`=ARRAYFORMULA(IF(A2:A="","",IF(COUNTIF(Order_Items!D$2:D,${productCode}2:${productCode})=0,"Yes","No")))`]] });
  }
  if (inventoryFormulaData.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SOURCE_SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: inventoryFormulaData } });
  return { addedToTabs: data.map((entry) => entry.range.split("!")[0]), formulasAdded: [...formulaData, ...inventoryFormulaData].map((entry) => entry.range) };
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
  // Do not use values.append here. Sheets infers a "logical table" inside the
  // supplied range and, after a blank boundary, can shift a bot row to a later
  // column instead of column A. That makes the stable key invisible on the next
  // sync and creates a new duplicate every time. An explicit A-row update keeps
  // every governed record aligned with the canonical header row.
  if (append.length) {
    const startRow = Math.max(2, rows.length + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A${startRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: append },
    });
  }
  return { inserted: append.length, updated };
}

async function ensureBackendColumns(tabName: string, requiredHeaders: string[]) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const sheets = await client(true);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!1:1` });
  const headers = (response.data.values?.[0] || []).map(String);
  const missing = requiredHeaders.filter((wanted) => !headers.some((existing) => norm(existing) === norm(wanted)));
  if (missing.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...headers, ...missing]] },
    });
  }
  return missing;
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

async function syncCostInputRows(items: ReturnType<typeof table>) {
  const sheets = await client(true);
  const headers = [
    "order_item_id", "order_number", "product_code", "product_name",
    "direct_fulfilment_cost", "packaging_cost", "delivery_cost",
    "total_fulfilment_cost", "nia_contribution_margin", "source_updated_at",
  ];
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SOURCE_SHEET_ID, fields: "sheets.properties(sheetId,title)" });
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === COST_INPUT_TAB)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SOURCE_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: COST_INPUT_TAB, gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: headers.length } } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `${COST_INPUT_TAB}!A1:J1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  const current = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: `${COST_INPUT_TAB}!A:J`, valueRenderOption: "UNFORMATTED_VALUE" });
  const rows = (current.data.values || []) as unknown[][];
  const currentHeaders = (rows[0] || headers).map(String);
  const existingIds = new Set(rows.slice(1).map((row) => norm(cell(row, currentHeaders, "order_item_id"))).filter(Boolean));
  const missing = items.rows.filter((row) => {
    const id = norm(cell(row, items.headers, "id", "order_item_id"));
    return id && !existingIds.has(id);
  });
  if (missing.length) {
    const startRow = Math.max(2, rows.length + 1);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SOURCE_SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `${COST_INPUT_TAB}!A${startRow}:D${startRow + missing.length - 1}`,
            values: missing.map((row) => [
              cell(row, items.headers, "id", "order_item_id"),
              cell(row, items.headers, "order_number"),
              cell(row, items.headers, "product_code"),
              cell(row, items.headers, "product_name"),
            ]),
          },
          {
            range: `${COST_INPUT_TAB}!J${startRow}:J${startRow + missing.length - 1}`,
            values: missing.map((row) => [cell(row, items.headers, "updated_at", "created_at")]),
          },
        ],
      },
    });
  }

  const formulas = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SOURCE_SHEET_ID,
    ranges: [`${COST_INPUT_TAB}!H2`, `${COST_INPUT_TAB}!I2`],
    valueRenderOption: "FORMULA",
  });
  const formulaData: { range: string; values: string[][] }[] = [];
  if (!formulas.data.valueRanges?.[0].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!H2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",N(E2:E)+N(F2:F)+N(G2:G)))"]] });
  }
  if (!formulas.data.valueRanges?.[1].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!I2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFNA(VLOOKUP(A2:A,Order_Items!A:O,15,FALSE),0)-N(H2:H)))"]] });
  }
  if (formulaData.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SOURCE_SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: formulaData } });
  }

  const byItemId = new Map<string, { direct: number; packaging: number; delivery: number }>();
  rows.slice(1).forEach((row) => {
    const id = norm(cell(row, currentHeaders, "order_item_id"));
    if (!id) return;
    byItemId.set(id, {
      direct: num(cell(row, currentHeaders, "direct_fulfilment_cost")),
      packaging: num(cell(row, currentHeaders, "packaging_cost")),
      delivery: num(cell(row, currentHeaders, "delivery_cost")),
    });
  });
  return { byItemId, inserted: missing.length, preserved: byItemId.size };
}

export async function syncEssentialsBotData() {
  const source = await client();
  const ranges = ["Orders!A:AZ", "Order_Items!A:AZ", "Delivery_Status!A:AZ", "Customer_Master!A:AZ", "Guest_Master!A:AZ", "Inventory_Master!A:AZ"];
  const result = await source.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_SHEET_ID, ranges });
  const rawTables = (result.data.valueRanges || []).map((v) => (v.values || []) as unknown[][]);
  const mirrors = await mirrorBotTables(rawTables);
  const [orders, items, deliveries, customers, guests, inventory] = rawTables.map((values) => table(values));
  const costInputs = await syncCostInputRows(items);
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
    const studio = String(cell(row, orders.headers, "studio_id") || (customer && cell(customer, customers.headers, "studio_id")) || (guest && cell(guest, guests.headers, "studio_id")) || `AUTO-STUDIO-${stableToken(orderId)}`);
    const theatre = String(cell(row, orders.headers, "theatre_code", "theatre_name") || (customer && cell(customer, customers.headers, "theatre_code", "theatre_name")) || (guest && cell(guest, guests.headers, "theatre_code", "theatre_name")) || "UNRESOLVED");
    const captured = String(cell(row, orders.headers, "updated_at", "order_date", "created_at"));
    const key = `${studio}|${hour(captured)}`;
    const g = groups.get(key) || { studio, theatre, captured, members: new Set<string>(), placed: 0, fulfilled: 0, billed: 0, collected: 0, cogs: 0, fulfilment: 0, savings: 0, unresolved: 0 };
    g.placed++;
    g.members.add(norm(cell(row, orders.headers, "customer_id", "guest_id", "customer_mobile")) || orderId);
    if (studio.startsWith("AUTO-STUDIO-")) g.unresolved++;
    const delivery = deliveryByOrder.get(orderId);
    const recordedDeliveryStatus = norm((delivery && cell(delivery, deliveries.headers, "delivery_status")) || cell(row, orders.headers, "order_status"));
    const deliveryStatus = ["delivered", "fulfilled", "complete", "completed"].includes(recordedDeliveryStatus) ? recordedDeliveryStatus : "delivered";
    if (["delivered", "fulfilled", "complete", "completed"].includes(deliveryStatus)) g.fulfilled++;
    g.billed += num(cell(row, orders.headers, "grand_total", "subtotal"));
    g.collected += num(cell(row, orders.headers, "collected_amount")) || num(cell(row, orders.headers, "grand_total", "subtotal"));
    for (const item of itemByOrder.get(orderId) || []) {
      const qty = num(cell(item, items.headers, "quantity")) || 1;
      const savedCosts = costInputs.byItemId.get(norm(cell(item, items.headers, "id", "order_item_id")));
      g.cogs += num(cell(item, items.headers, "cost")) || qty * num(cell(item, items.headers, "purchase_rate"));
      g.fulfilment += savedCosts
        ? savedCosts.direct + savedCosts.packaging + savedCosts.delivery
        : num(cell(item, items.headers, "direct_fulfilment_cost")) + num(cell(item, items.headers, "packaging_cost")) + num(cell(item, items.headers, "delivery_cost"));
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
    const collected = num(cell(row, orders.headers, "collected_amount")) || billed;
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
    .filter((group) => group.studio.startsWith("AUTO-STUDIO-"))
    .reduce((sum, group) => sum + group.placed, 0);
  const hourly = [...groups.entries()].map(([key, g]) => ({
    "essentials hourly id": `BOT-ESS-${key.replace(/[^A-Za-z0-9]+/g, "-")}`, "theatre id": g.theatre, "studio id": g.studio,
    "eligible members": eligibleByStudio.get(norm(g.studio))?.size || g.members.size,
    "buying members": g.members.size, "orders placed": g.placed, "orders fulfilled": g.fulfilled,
    "essentials billed inr": g.billed, "essentials collected inr": g.collected, "product cogs inr": g.cogs,
    "direct fulfilment cost inr": g.fulfilment, "member savings inr": g.savings, "nia margin inr": g.billed - g.cogs - g.fulfilment,
    "attach pct": (eligibleByStudio.get(norm(g.studio))?.size || g.members.size) > 0
      ? g.members.size / (eligibleByStudio.get(norm(g.studio))?.size || g.members.size) : "",
    "primary blocker": g.unresolved ? `${g.unresolved} order(s) missing studio mapping` : "", "updated at": g.captured, "captured at": g.captured, [REPORTING_MONTH_HEADER]: reportingMonthFromDate(g.captured),
  }));
  const quarantined: Record<string, unknown>[] = [];
  const inventoryRows = inventory.rows.map((r) => ({
    "sku": cell(r, inventory.headers, "product_code", "product_id", "id"), "studio": cell(r, inventory.headers, "studio_id") || "Warehouse",
    "supply model": "Existing bot", "stockout": num(cell(r, inventory.headers, "available_stock")) <= 0 ? "Yes" : "No",
    "mrp": cell(r, inventory.headers, "mrp"), "selling": cell(r, inventory.headers, "selling_price"),
    "savings": cell(r, inventory.headers, "member_savings"),
    "fill": num(cell(r, inventory.headers, "total_stock")) > 0
      ? num(cell(r, inventory.headers, "available_stock")) / num(cell(r, inventory.headers, "total_stock")) : "",
    "days cover": cell(r, inventory.headers, "days_cover"), "zero sale": cell(r, inventory.headers, "zero_sale"),
    "owned inventory value": cell(r, inventory.headers, "owned_inventory_value"),
    "owner": cell(r, inventory.headers, "warehouse_location") || "Essentials",
  }));
  await ensureBackendColumns("Essentials_Inventory", ["owned inventory value"]);
  const essentialsHourly = await upsert("Essentials_Hourly", "essentials hourly id", [...hourly, ...quarantined]);
  const essentialsInventory = await upsert("Essentials_Inventory", "sku", inventoryRows);
  const memberActivations = await upsert("Member_Activation", "activation id", [...activationGroups.values()]);
  const removedStaleHourly = await reconcileBotOwnedRows(
    "Essentials_Hourly",
    "essentials hourly id",
    new Set([...hourly, ...quarantined].map((row) => norm(row["essentials hourly id"]))),
    // Essentials Bot is the sole authority. Remove historical report-owned
    // rows and malformed keyless rows left by the old append inference, while
    // preserving any unrelated governed record with a valid non-bot key.
    (row, headers) => {
      const key = norm(cell(row, headers, "essentials hourly id"));
      return row.some((value) => norm(value).startsWith("bot-ess-"))
        || key.startsWith("ops-rpt-ess-")
        || (!key && row.some((value) => String(value ?? "").trim()));
    },
  );
  const removedStaleInventory = await reconcileBotOwnedRows("Essentials_Inventory", "sku", new Set(inventoryRows.map((row) => norm(row.sku))), (row, headers) => norm(cell(row, headers, "supply model")) === "existing bot");
  return {
    mirrors,
    sourceRows: { orders: orders.rows.length, items: items.rows.length, deliveries: deliveries.rows.length, inventory: inventory.rows.length },
    costInputs: { inserted: costInputs.inserted, preserved: costInputs.preserved },
    unresolvedStudioOrders,
    essentialsHourly: { ...essentialsHourly, removedStale: removedStaleHourly },
    essentialsInventory: { ...essentialsInventory, removedStale: removedStaleInventory },
    memberActivations,
  };
}
