import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { reportingMonthFromDate, REPORTING_MONTH_HEADER } from "./reportingMonth";

// Nia Essentials Operations. Keep the canonical source here as a safe
// production fallback; the previous fallback contained an I/l typo and could
// silently make a cold deployment read a different/non-existent workbook.
// Canonical Essentials Bot workbook. The character before `UC0oY` is an
// uppercase I (not a lowercase l); Google returns 404 for the look-alike ID.
const SOURCE_SHEET_ID = process.env.ESSENTIALS_BOT_SHEET_ID || "1C8y3uVxp5toMwLBPGVWbltOoNX_hVuKtvyfiqIUC0oY";
const COST_INPUT_TAB = "Rafiqi_Order_Item_Costs";

const HISTORICAL_ORDER_RECOVERY = [
  { id: "da4ae525-8963-45ef-8112-423697cdaa0b", order_number: "NIA-OFF-20260811-015", studio_id: "9621b0a7-cfe3-4d1b-8014-d7fc1298b453", order_date: "2026-08-11T12:00:00+05:30", order_status: "Confirmed", payment_mode: "Offline", payment_status: "Paid", subtotal: 57, delivery_charge: 0, discount_amount: 0, grand_total: 57, remarks: "Recovered from Drive revision", created_at: "2026-08-11T12:00:00+05:30", updated_at: "2026-08-11T15:30:00+05:30", studio_name: "Nia Nest Umapahti", theatre_name: "Wellington", theatre_code: "WLG" },
  { id: "5a7e5702-926d-4722-8054-fdd496515d77", order_number: "NIA-OFF-20260811-016", studio_id: "9621b0a7-cfe3-4d1b-8014-d7fc1298b453", order_date: "2026-08-11T12:00:00+05:30", order_status: "Confirmed", payment_mode: "Offline", payment_status: "Paid", subtotal: 36, delivery_charge: 0, discount_amount: 0, grand_total: 36, remarks: "Recovered from Drive revision", created_at: "2026-08-11T12:00:00+05:30", updated_at: "2026-08-11T15:30:00+05:30", studio_name: "Nia Nest Umapahti", theatre_name: "Wellington", theatre_code: "WLG" },
  { id: "ac25fac0-50f8-493b-9a2a-e03c77b82f70", order_number: "NIA-OFF-20260811-017", studio_id: "9621b0a7-cfe3-4d1b-8014-d7fc1298b453", order_date: "2026-08-11T12:00:00+05:30", order_status: "Confirmed", payment_mode: "Offline", payment_status: "Paid", subtotal: 76, delivery_charge: 0, discount_amount: 0, grand_total: 76, remarks: "Recovered from Drive revision", created_at: "2026-08-11T12:00:00+05:30", updated_at: "2026-08-11T15:30:00+05:30", studio_name: "Nia Nest Umapahti", theatre_name: "Wellington", theatre_code: "WLG" },
] as const;

const HISTORICAL_ITEM_RECOVERY = [
  { id: "bf11799b-2b14-4ea4-b042-5ce29bdf0eb9", order_id: "da4ae525-8963-45ef-8112-423697cdaa0b", product_id: "d7adbd2e-abd3-4c05-92fa-48699d128f31", product_code: "PRD0041", product_name: "Britannia Good Day Butter Cookies", quantity: 6, unit_price: 9.5, total_price: 57, created_at: "2026-08-11T12:00:00+05:30", updated_at: "2026-08-11T15:30:00+05:30", purchase_rate: 9, selling_price: 9.5, revenue: 57, cost: 54, gross_profit: 3, order_number: "NIA-OFF-20260811-015", studio_id: "9621b0a7-cfe3-4d1b-8014-d7fc1298b453", product_mrp: 10, nia_savings: 0.5 },
  { id: "20180275-5163-4223-b457-29f6e855307f", order_id: "5a7e5702-926d-4722-8054-fdd496515d77", product_id: "7f1504f7-ca3b-40f1-be7d-b75eb240a73a", product_code: "PRD0042", product_name: "Parle-G Glucose Biscuit", quantity: 4, unit_price: 9, total_price: 36, created_at: "2026-08-11T12:00:00+05:30", updated_at: "2026-08-11T15:30:00+05:30", purchase_rate: 9, selling_price: 9, revenue: 36, cost: 36, gross_profit: 0, order_number: "NIA-OFF-20260811-016", studio_id: "9621b0a7-cfe3-4d1b-8014-d7fc1298b453", product_mrp: 10, nia_savings: 1 },
  { id: "d535c829-2885-4bbf-a83e-424967745a0a", order_id: "ac25fac0-50f8-493b-9a2a-e03c77b82f70", product_id: "28a5288c-0699-4812-b3c3-777b64704321", product_code: "PRD0040", product_name: "Banana Chips", quantity: 8, unit_price: 9.5, total_price: 76, created_at: "2026-08-11T12:00:00+05:30", updated_at: "2026-08-11T15:30:00+05:30", purchase_rate: 9, selling_price: 9.5, revenue: 76, cost: 72, gross_profit: 4, order_number: "NIA-OFF-20260811-017", studio_id: "9621b0a7-cfe3-4d1b-8014-d7fc1298b453", product_mrp: 10, nia_savings: 0.5 },
] as const;
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
const FULFILLED_STATUSES = new Set(["delivered", "fulfilled", "complete", "completed"]);
const COLLECTED_PAYMENT_STATUSES = new Set(["paid", "collected", "captured", "settled", "completed", "complete"]);

export const isFulfilledEssentialsOrder = (deliveryStatus: unknown, orderStatus: unknown) =>
  FULFILLED_STATUSES.has(norm(deliveryStatus)) || FULFILLED_STATUSES.has(norm(orderStatus));

export const essentialsCollectedAmount = (collectedAmount: unknown, paymentStatus: unknown, billedAmount: unknown) => {
  const explicitlyCollected = num(collectedAmount);
  if (explicitlyCollected > 0) return explicitlyCollected;
  return COLLECTED_PAYMENT_STATUSES.has(norm(paymentStatus)) ? num(billedAmount) : 0;
};

export const latestEssentialsTimestamp = (current: unknown, candidate: unknown) => {
  const currentText = String(current || "");
  const candidateText = String(candidate || "");
  const currentTime = Date.parse(currentText);
  const candidateTime = Date.parse(candidateText);
  if (!Number.isFinite(candidateTime)) return currentText;
  return !Number.isFinite(currentTime) || candidateTime > currentTime ? candidateText : currentText;
};
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
  return { addedToTabs: data.map((entry) => entry.range.split("!")[0]), formulasAdded: inventoryFormulaData.map((entry) => entry.range) };
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
  const updates: { range: string; values: unknown[][] }[] = [];
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
      updates.push({ range: `${tabName}!A${rowNumber}`, values: [output] });
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
    const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,gridProperties.rowCount)" });
    const target = metadata.data.sheets?.find((sheet) => sheet.properties?.title === tabName)?.properties;
    const requiredRows = startRow + append.length - 1;
    if (target?.sheetId != null && (target.gridProperties?.rowCount || 0) < requiredRows) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: target.sheetId, gridProperties: { rowCount: requiredRows } }, fields: "gridProperties.rowCount" } }] },
      });
    }
    updates.push({ range: `${tabName}!A${startRow}`, values: append });
  }
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } });
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
    "theatre_name", "studio_code", "studio_name",
  ];
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SOURCE_SHEET_ID, fields: "sheets.properties(sheetId,title)" });
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === COST_INPUT_TAB)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SOURCE_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: COST_INPUT_TAB, gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: headers.length } } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `${COST_INPUT_TAB}!A1:M1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  const headerResponse = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: `${COST_INPUT_TAB}!1:1`, valueRenderOption: "UNFORMATTED_VALUE" });
  const existingHeaders = (headerResponse.data.values?.[0] || []).map(String);
  const mergedHeaders = [...existingHeaders];
  headers.forEach((header) => {
    if (!mergedHeaders.some((existing) => norm(existing) === norm(header))) mergedHeaders.push(header);
  });
  if (mergedHeaders.length !== existingHeaders.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `${COST_INPUT_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [mergedHeaders] },
    });
  }

  const current = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: `${COST_INPUT_TAB}!A:M`, valueRenderOption: "UNFORMATTED_VALUE" });
  const rows = (current.data.values || []) as unknown[][];
  const currentHeaders = (rows[0] || headers).map(String);

  const preservedCosts = new Map(rows.slice(1).map((row) => [norm(cell(row, currentHeaders, "order_item_id")), {
    direct: num(cell(row, currentHeaders, "direct_fulfilment_cost")), packaging: num(cell(row, currentHeaders, "packaging_cost")), delivery: num(cell(row, currentHeaders, "delivery_cost")),
  }]));
  const rebuiltRows = items.rows.map((item) => {
    const costs = preservedCosts.get(norm(cell(item, items.headers, "id", "order_item_id"))) || { direct: 0.5, packaging: 0.5, delivery: 0.5 };
    const fulfilment = costs.direct + costs.packaging + costs.delivery;
    return [cell(item, items.headers, "id", "order_item_id"), cell(item, items.headers, "order_number"), cell(item, items.headers, "product_code"), cell(item, items.headers, "product_name"), costs.direct, costs.packaging, costs.delivery, fulfilment, num(cell(item, items.headers, "gross_profit")) - fulfilment, cell(item, items.headers, "updated_at"), "", "", ""];
  });
  await sheets.spreadsheets.values.clear({ spreadsheetId: SOURCE_SHEET_ID, range: `${COST_INPUT_TAB}!A2:M1000` });
  if (rebuiltRows.length) await sheets.spreadsheets.values.update({ spreadsheetId: SOURCE_SHEET_ID, range: `${COST_INPUT_TAB}!A2:M${rebuiltRows.length + 1}`, valueInputOption: "RAW", requestBody: { values: rebuiltRows } });

  const formulas = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SOURCE_SHEET_ID,
    ranges: [`${COST_INPUT_TAB}!A2`, `${COST_INPUT_TAB}!B2`, `${COST_INPUT_TAB}!C2`, `${COST_INPUT_TAB}!D2`, `${COST_INPUT_TAB}!H2`, `${COST_INPUT_TAB}!I2`, `${COST_INPUT_TAB}!J2`, `${COST_INPUT_TAB}!K2`, `${COST_INPUT_TAB}!L2`, `${COST_INPUT_TAB}!M2`],
    valueRenderOption: "FORMULA",
  });
  const formulaData: { range: string; values: string[][] }[] = [];
  if (!formulas.data.valueRanges?.[0].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!A2`, values: [["=ARRAYFORMULA(IF(Order_Items!A2:A=\"\",\"\",Order_Items!A2:A))"]] });
  }
  if (!formulas.data.valueRanges?.[1].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!B2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFNA(VLOOKUP(A2:A,Order_Items!A:P,16,FALSE),\"\")))"]] });
  }
  if (!formulas.data.valueRanges?.[2].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!C2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFNA(VLOOKUP(A2:A,Order_Items!A:D,4,FALSE),\"\")))"]] });
  }
  if (!formulas.data.valueRanges?.[3].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!D2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFNA(VLOOKUP(A2:A,Order_Items!A:E,5,FALSE),\"\")))"]] });
  }
  if (!formulas.data.valueRanges?.[4].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!H2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",N(E2:E)+N(F2:F)+N(G2:G)))"]] });
  }
  if (!formulas.data.valueRanges?.[5].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!I2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFNA(VLOOKUP(A2:A,Order_Items!A:O,15,FALSE),0)-N(H2:H)))"]] });
  }
  if (!formulas.data.valueRanges?.[6].values?.[0]?.[0]) {
    formulaData.push({ range: `${COST_INPUT_TAB}!J2`, values: [["=ARRAYFORMULA(IF(A2:A=\"\",\"\",IFNA(VLOOKUP(A2:A,Order_Items!A:J,10,FALSE),\"\")))"]] });
  }
  formulaData.push({ range: `${COST_INPUT_TAB}!K2`, values: [["=MAP(B2:B,LAMBDA(order_no,IF(order_no=\"\",\"\",IFNA(XLOOKUP(XLOOKUP(order_no,Orders!B:B,Orders!E:E),Studio_Master!A:A,Studio_Master!E:E),\"UNRESOLVED\"))))"]] });
  formulaData.push({ range: `${COST_INPUT_TAB}!L2`, values: [["=MAP(B2:B,LAMBDA(order_no,IF(order_no=\"\",\"\",IFNA(XLOOKUP(XLOOKUP(order_no,Orders!B:B,Orders!E:E),Studio_Master!A:A,Studio_Master!B:B),\"\"))))"]] });
  formulaData.push({ range: `${COST_INPUT_TAB}!M2`, values: [["=MAP(B2:B,LAMBDA(order_no,IF(order_no=\"\",\"\",IFNA(XLOOKUP(XLOOKUP(order_no,Orders!B:B,Orders!E:E),Studio_Master!A:A,Studio_Master!C:C),\"\"))))"]] });
  if (formulaData.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SOURCE_SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data: formulaData } });
  }

  const byItemId = new Map<string, { direct: number; packaging: number; delivery: number }>();
  rebuiltRows.forEach((row) => {
    const id = norm(cell(row, currentHeaders, "order_item_id"));
    if (!id) return;
    byItemId.set(id, {
      direct: num(cell(row, currentHeaders, "direct_fulfilment_cost")),
      packaging: num(cell(row, currentHeaders, "packaging_cost")),
      delivery: num(cell(row, currentHeaders, "delivery_cost")),
    });
  });
  return { byItemId, inserted: 0, preserved: byItemId.size };
}

async function readEssentialSummaryInputs() {
  const sheets = await client();
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SOURCE_SHEET_ID,
    ranges: [`${COST_INPUT_TAB}!R2:X200`, `${COST_INPUT_TAB}!AB2:AF5`],
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  type StudioSummary = { theatre: string; studioName: string; studioId: string; activeMembers: number; buyingMembers: number; buyingValue: number; studioRevenue: number };
  const studios = new Map<string, StudioSummary>();
  const studioRows: StudioSummary[] = [];
  for (const row of (response.data.valueRanges?.[0].values || []) as unknown[][]) {
    const studioName = String(row[1] || "").trim();
    const studioId = String(row[2] || "").trim();
    if (!studioName || !studioId) continue;
    const summary = { theatre: String(row[0] || "").trim(), studioName, studioId, activeMembers: num(row[3]), buyingMembers: num(row[4]), buyingValue: num(row[5]), studioRevenue: num(row[6]) };
    studioRows.push(summary);
    studios.set(norm(studioId), summary);
    studios.set(norm(studioName), summary);
  }
  const categories = new Map<string, { curryUniqueMembers: number; curryBuyingValue: number; internetEquipmentUniqueMembers: number; internetEquipmentBuyingValue: number }>();
  for (const row of (response.data.valueRanges?.[1].values || []) as unknown[][]) {
    const theatre = String(row[0] || "").trim();
    if (!theatre) continue;
    categories.set(norm(theatre), { curryUniqueMembers: num(row[1]), curryBuyingValue: num(row[2]), internetEquipmentUniqueMembers: num(row[3]), internetEquipmentBuyingValue: num(row[4]) });
  }
  return { studios, studioRows, categories };
}

export async function syncEssentialsBotData() {
  const source = await client();
  const ranges = ["Orders!A:AZ", "Order_Items!A:AZ", "Delivery_Status!A:AZ", "Customer_Master!A:AZ", "Guest_Master!A:AZ", "Inventory_Master!A:AZ", "Studio_Master!A:Q", "Product_Master!A:AZ"];
  const result = await source.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_SHEET_ID, ranges });
  const rawTables = (result.data.valueRanges || []).map((v) => (v.values || []) as unknown[][]);
  const recoveryWrites: { range: string; values: unknown[][] }[] = [];
  for (const [index, tabName, records] of [[0, "Orders", HISTORICAL_ORDER_RECOVERY], [1, "Order_Items", HISTORICAL_ITEM_RECOVERY]] as const) {
    const headers = (rawTables[index]?.[0] || []).map(String);
    const existingIds = new Set((rawTables[index] || []).slice(1).map((row) => norm(row[0])).filter(Boolean));
    const missing = records.filter((record) => !existingIds.has(norm(record.id)));
    if (!headers.length || !missing.length) continue;
    const values = missing.map((record) => headers.map((header) => (record as Record<string, unknown>)[header] ?? ""));
    recoveryWrites.push({ range: `${tabName}!A${rawTables[index].length + 1}`, values });
    rawTables[index].push(...values);
  }
  if (recoveryWrites.length) {
    const writer = await client(true);
    await writer.spreadsheets.values.batchUpdate({ spreadsheetId: SOURCE_SHEET_ID, requestBody: { valueInputOption: "RAW", data: recoveryWrites } });
  }
  // The Bot creates Orders before their delivery workflow row. Materialise a
  // Pending delivery record immediately so every tab can join the same order
  // set and a new order is never dropped by a missing Delivery_Status row.
  const orderHeaders = (rawTables[0]?.[0] || []).map(String);
  const deliveryHeaders = (rawTables[2]?.[0] || []).map(String);
  const deliveryOrderIds = new Set((rawTables[2] || []).slice(1).map((row) => norm(cell(row, deliveryHeaders, "order_id"))).filter(Boolean));
  const missingDeliveryRows = (rawTables[0] || []).slice(1).filter((row) => {
    const orderId = norm(cell(row, orderHeaders, "id", "order_id"));
    return orderId && !deliveryOrderIds.has(orderId);
  }).map((order) => {
    const record: Record<string, unknown> = {
      order_id: cell(order, orderHeaders, "id", "order_id"),
      delivery_status: "Pending",
      delivery_owner: "Essentials Bot",
      updated_at: cell(order, orderHeaders, "updated_at", "created_at", "order_date") || new Date().toISOString(),
    };
    return deliveryHeaders.map((header) => record[norm(header).replaceAll(" ", "_")] ?? "");
  });
  if (deliveryHeaders.length && missingDeliveryRows.length) {
    const writer = await client(true);
    await writer.spreadsheets.values.append({ spreadsheetId: SOURCE_SHEET_ID, range: "Delivery_Status!A:F", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: missingDeliveryRows } });
    rawTables[2].push(...missingDeliveryRows);
  }
  const mirrors = await mirrorBotTables(rawTables);
  const [orders, items, deliveries, customers, guests, inventory, studioMaster, products] = rawTables.map((values) => table(values));
  // Never reconcile the governed backend from a partial/blank Bot response.
  // A temporary Sheets read/schema problem must preserve the last successful
  // dashboard snapshot instead of making yesterday's orders disappear.
  if (!orders.headers.length || !items.headers.length || !inventory.headers.length || !products.headers.length) {
    throw new Error("Essentials Bot returned an incomplete Products/Inventory/Orders/Order_Items snapshot; previous governed data was preserved.");
  }
  const productByCode = new Map<string, unknown[]>();
  for (const row of products.rows) {
    for (const ref of [cell(row, products.headers, "product_code"), cell(row, products.headers, "sku"), cell(row, products.headers, "id", "product_id")]) {
      const key = norm(ref);
      if (key) productByCode.set(key, row);
    }
  }
  const inventoryByProduct = new Map<string, unknown[]>();
  for (const row of inventory.rows) {
    for (const productRef of [cell(row, inventory.headers, "product_code"), cell(row, inventory.headers, "product_id"), cell(row, inventory.headers, "id")]) {
      const key = norm(productRef);
      if (key) inventoryByProduct.set(key, row);
    }
  }
  const studioDirectory = new Map<string, { id: string; code: string; name: string; theatre: string; active: boolean }>();
  for (const row of studioMaster.rows) {
    const entry = {
      id: String(cell(row, studioMaster.headers, "id", "studio_id") || "").trim(),
      code: String(cell(row, studioMaster.headers, "studio_code") || "").trim(),
      name: String(cell(row, studioMaster.headers, "studio_name") || "").trim(),
      theatre: String(cell(row, studioMaster.headers, "theatre_name", "theatre_code") || "UNRESOLVED").trim(),
      active: ["true", "yes", "1", "active"].includes(norm(cell(row, studioMaster.headers, "is_active"))),
    };
    for (const alias of [entry.id, entry.code, entry.name]) if (String(alias || "").trim()) studioDirectory.set(norm(alias), entry);
  }
  const costInputs = await syncCostInputRows(items);
  const summaryInputs = await readEssentialSummaryInputs();
  for (const summary of summaryInputs.studioRows) {
    const directory = studioDirectory.get(norm(summary.studioId));
    if (directory?.id) summaryInputs.studios.set(norm(directory.id), summary);
  }
  const customerById = new Map(customers.rows.map((r) => [norm(cell(r, customers.headers, "id")), r]));
  const guestById = new Map(guests.rows.map((r) => [norm(cell(r, guests.headers, "id")), r]));
  const deliveryByOrder = new Map(deliveries.rows.map((r) => [norm(cell(r, deliveries.headers, "order_id")), r]));
  const itemByOrder = new Map<string, unknown[][]>();
  items.rows.forEach((r) => { const key = norm(cell(r, items.headers, "order_id")); if (key) itemByOrder.set(key, [...(itemByOrder.get(key) || []), r]); });
  const eligibleByStudio = new Map<string, Set<string>>();
  const eligibleStudioMeta = new Map<string, { studio: string; studioName: string; theatre: string }>();
  const registerEligible = (row: unknown[], headers: string[], kind: string) => {
    const rawStudio = String(cell(row, headers, "studio_id", "studio", "studio_code") || "").trim();
    const directory = studioDirectory.get(norm(rawStudio)) || studioDirectory.get(norm(cell(row, headers, "studio_name")));
    if (!directory?.active) return;
    const studio = directory?.id || rawStudio;
    const member = String(cell(row, headers, "id", "customer_id", "guest_id", "mobile", "phone") || "").trim();
    if (!studio || !member) return;
    const key = norm(studio);
    const theatre = directory?.theatre || String(cell(row, headers, "theatre_code", "theatre_name", "theatre") || "UNRESOLVED").trim();
    const studioName = directory?.name || String(cell(row, headers, "studio_name") || studio).trim();
    const members = eligibleByStudio.get(key) || new Set<string>();
    members.add(`${kind}:${norm(member)}`);
    eligibleByStudio.set(key, members);
    eligibleStudioMeta.set(key, { studio, studioName, theatre });
  };
  customers.rows.forEach((row) => registerEligible(row, customers.headers, "customer"));
  guests.rows.forEach((row) => registerEligible(row, guests.headers, "guest"));
  type Group = { studio: string; studioName: string; theatre: string; captured: string; members: Set<string>; placed: number; fulfilled: number; billed: number; collected: number; cogs: number; fulfilment: number; savings: number; unresolved: number };
  type CohortMember = { dates: number[]; products: Set<string> };
  type CohortGroup = { studio: string; theatre: string; captured: string; members: Map<string, CohortMember>; gmv: number; products: Set<string> };
  const groups = new Map<string, Group>();
  const cohortGroups = new Map<string, CohortGroup>();
  const activationGroups = new Map<string, Record<string, unknown>>();
  for (const row of orders.rows) {
    const orderId = norm(cell(row, orders.headers, "id", "order_id"));
    const customer = customerById.get(norm(cell(row, orders.headers, "customer_id")));
    const guest = guestById.get(norm(cell(row, orders.headers, "guest_id")));
    const rawStudio = String(cell(row, orders.headers, "studio_id") || (customer && cell(customer, customers.headers, "studio_id", "studio_code")) || (guest && cell(guest, guests.headers, "studio_id", "studio_code")) || `AUTO-STUDIO-${stableToken(orderId)}`);
    const studioDirectoryEntry = studioDirectory.get(norm(rawStudio)) || studioDirectory.get(norm(cell(row, orders.headers, "studio_name")));
    const studio = studioDirectoryEntry?.id || rawStudio;
    const theatre = String(cell(row, orders.headers, "theatre_code", "theatre_name") || (customer && cell(customer, customers.headers, "theatre_code", "theatre_name")) || (guest && cell(guest, guests.headers, "theatre_code", "theatre_name")) || "UNRESOLVED");
    const studioName = studioDirectoryEntry?.name || String(cell(row, orders.headers, "studio_name") || (customer && cell(customer, customers.headers, "studio_name")) || (guest && cell(guest, guests.headers, "studio_name")) || studio);
    const captured = String(cell(row, orders.headers, "updated_at", "order_date", "created_at"));
    // The Essentials page is a current cumulative operating view. Keep one
    // row per Studio so point-in-time eligible Members are never double-counted
    // when the same Studio receives orders in several hours.
    const key = studio;
    const g = groups.get(key) || { studio, studioName, theatre, captured, members: new Set<string>(), placed: 0, fulfilled: 0, billed: 0, collected: 0, cogs: 0, fulfilment: 0, savings: 0, unresolved: 0 };
    g.placed++;
    g.members.add(norm(cell(row, orders.headers, "customer_id", "guest_id", "customer_mobile")) || orderId);
    if (studio.startsWith("AUTO-STUDIO-")) g.unresolved++;
    const delivery = deliveryByOrder.get(orderId);
    const recordedDeliveryStatus = norm((delivery && cell(delivery, deliveries.headers, "delivery_status")) || cell(row, orders.headers, "order_status"));
    if (isFulfilledEssentialsOrder(recordedDeliveryStatus, cell(row, orders.headers, "order_status"))) g.fulfilled++;
    const billedAmount = num(cell(row, orders.headers, "grand_total", "subtotal"));
    g.billed += billedAmount;
    g.collected += essentialsCollectedAmount(cell(row, orders.headers, "collected_amount"), cell(row, orders.headers, "payment_status"), billedAmount);
    g.captured = latestEssentialsTimestamp(g.captured, captured);
    const memberKey = norm(cell(row, orders.headers, "customer_id", "guest_id", "customer_mobile")) || orderId;
    const cohort = cohortGroups.get(norm(studio)) || { studio, theatre, captured, members: new Map<string, CohortMember>(), gmv: 0, products: new Set<string>() };
    const cohortMember = cohort.members.get(memberKey) || { dates: [], products: new Set<string>() };
    const capturedTime = Date.parse(captured);
    if (Number.isFinite(capturedTime)) cohortMember.dates.push(capturedTime);
    cohort.gmv += num(cell(row, orders.headers, "grand_total", "subtotal"));
    cohort.captured = captured || cohort.captured;
    for (const item of itemByOrder.get(orderId) || []) {
      const qty = num(cell(item, items.headers, "quantity")) || 1;
      const product = String(cell(item, items.headers, "product_code") || cell(item, items.headers, "product_id") || cell(item, items.headers, "id") || "").trim();
      const inventoryRow = inventoryByProduct.get(norm(product));
      if (product) { cohort.products.add(product); cohortMember.products.add(product); }
      const savedCosts = costInputs.byItemId.get(norm(cell(item, items.headers, "id", "order_item_id")));
      g.cogs += num(cell(item, items.headers, "cost")) || qty * num(cell(item, items.headers, "purchase_rate"));
      g.fulfilment += savedCosts
        ? savedCosts.direct + savedCosts.packaging + savedCosts.delivery
        : num(cell(item, items.headers, "direct_fulfilment_cost")) + num(cell(item, items.headers, "packaging_cost")) + num(cell(item, items.headers, "delivery_cost"));
      // Member saving is owned by the Essentials Bot. Prefer its explicit
      // order-item value, then Inventory_Master, then derive MRP - selling.
      const itemSaving = cell(item, items.headers, "nia_savings", "member_savings");
      const inventorySaving = inventoryRow ? cell(inventoryRow, inventory.headers, "member_savings") : "";
      const mrp = num(cell(item, items.headers, "mrp") || (inventoryRow && cell(inventoryRow, inventory.headers, "mrp")));
      const selling = num(cell(item, items.headers, "selling_price", "unit_price", "price") || (inventoryRow && cell(inventoryRow, inventory.headers, "selling_price")));
      const savingPerUnit = String(itemSaving ?? "").trim() !== ""
        ? num(itemSaving)
        : String(inventorySaving ?? "").trim() !== "" ? num(inventorySaving) : Math.max(0, mrp - selling);
      g.savings += qty * savingPerUnit;
    }
    cohort.members.set(memberKey, cohortMember);
    cohortGroups.set(norm(studio), cohort);
    groups.set(key, g);

    // Bot orders are already a member-activation signal. Keep these records bot-owned
    // so operators do not duplicate the same activation in TEAM_MEMBER_ACTIVATION.
    const customerRef = cell(row, orders.headers, "customer_id") || cell(row, orders.headers, "guest_id") || cell(row, orders.headers, "customer_mobile") || orderId;
    const memberToken = `BOT-MEMBER-${stableToken(customerRef, studio)}`;
    const activationId = `BOT-ACTV-${stableToken(customerRef, studio)}`;
    const prior = activationGroups.get(activationId);
    const billed = num(cell(row, orders.headers, "grand_total", "subtotal"));
    const collected = essentialsCollectedAmount(cell(row, orders.headers, "collected_amount"), cell(row, orders.headers, "payment_status"), billed);
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
  // Eligibility is a population metric, not an order metric. Emit Studios with
  // eligible Members even when they have no order yet so attach rate uses the
  // complete Bot population on both Essentials and Business Report screens.
  for (const [key, meta] of eligibleStudioMeta) {
    if (!groups.has(key)) groups.set(key, { studio: meta.studio, studioName: meta.studioName, theatre: meta.theatre, captured: "", members: new Set<string>(), placed: 0, fulfilled: 0, billed: 0, collected: 0, cogs: 0, fulfilment: 0, savings: 0, unresolved: 0 });
  }
  // UI_Occupancy is the authoritative population frame. Do not retain Studios
  // that exist only in Studio_Master, Guest_Master, or historical Bot orders.
  const reportGroups = new Map<string, Group>();
  for (const summary of summaryInputs.studioRows) {
    const directory = studioDirectory.get(norm(summary.studioId));
    const sourceGroup = directory?.id ? groups.get(directory.id) || groups.get(norm(directory.id)) : groups.get(summary.studioId) || groups.get(norm(summary.studioId));
    const key = norm(summary.studioId);
    reportGroups.set(key, sourceGroup
      ? { ...sourceGroup, studio: summary.studioId, studioName: summary.studioName, theatre: summary.theatre }
      : { studio: summary.studioId, studioName: summary.studioName, theatre: summary.theatre, captured: "", members: new Set<string>(), placed: 0, fulfilled: 0, billed: 0, collected: 0, cogs: 0, fulfilment: 0, savings: 0, unresolved: 0 });
  }
  const categoryApplied = new Set<string>();
  const hourly = [...reportGroups.entries()].map(([key, g]) => {
    // Studio names are not unique (for example, Krishna Kumar appears more
    // than once). The UI Occupancy Studio ID is the governed join key.
    const summary = summaryInputs.studios.get(norm(g.studio)) || summaryInputs.studios.get(norm(g.studioName));
    const theatre = summary?.theatre || g.theatre;
    const theatreKey = norm(theatre);
    const category = categoryApplied.has(theatreKey) ? undefined : summaryInputs.categories.get(theatreKey);
    if (category) categoryApplied.add(theatreKey);
    return ({
    "essentials hourly id": `BOT-ESS-${key.replace(/[^A-Za-z0-9]+/g, "-")}`, "theatre id": theatre, "studio id": g.studio,
    "eligible members": summary?.activeMembers ?? (eligibleByStudio.get(norm(g.studio))?.size || g.members.size),
    "buying members": summary?.buyingMembers ?? g.members.size, "orders placed": g.placed, "orders fulfilled": g.fulfilled,
    "essentials billed inr": summary?.buyingValue ?? g.billed, "essentials collected inr": g.collected, "product cogs inr": g.cogs,
    "direct fulfilment cost inr": g.fulfilment, "member savings inr": g.savings, "nia margin inr": g.billed - g.cogs - g.fulfilment,
    "studio revenue inr": summary?.studioRevenue || "",
    // Write explicit zeroes for non-summary rows. Blank values are preserved by
    // upsert, which would otherwise leave a prior category allocation behind
    // when the first Studio for a Theatre changes between syncs.
    "curry unique members": category?.curryUniqueMembers ?? 0, "curry buying value inr": category?.curryBuyingValue ?? 0,
    "internet equipment unique members": category?.internetEquipmentUniqueMembers ?? 0, "internet equipment buying value inr": category?.internetEquipmentBuyingValue ?? 0,
    "attach pct": (summary?.activeMembers ?? (eligibleByStudio.get(norm(g.studio))?.size || g.members.size)) > 0
      ? (summary?.buyingMembers ?? g.members.size) / (summary?.activeMembers ?? (eligibleByStudio.get(norm(g.studio))?.size || g.members.size)) : "",
    "primary blocker": g.unresolved ? `${g.unresolved} order(s) missing studio mapping` : "", "updated at": g.captured, "captured at": g.captured, [REPORTING_MONTH_HEADER]: reportingMonthFromDate(g.captured),
  }); });
  const quarantined: Record<string, unknown>[] = [];
  const inventoryRows = inventory.rows.map((r) => {
    const productCode = cell(r, inventory.headers, "product_code");
    const productId = cell(r, inventory.headers, "product_id");
    const inventoryId = cell(r, inventory.headers, "id");
    const product = productByCode.get(norm(productCode)) || productByCode.get(norm(productId));
    const rawStudio = cell(r, inventory.headers, "studio_id", "studio_code");
    const studio = studioDirectory.get(norm(rawStudio));
    return ({
    // Human-readable source SKU is the governed display key; retain UUIDs only
    // for internal joins, never as the operator-facing label.
    "sku": (product && cell(product, products.headers, "sku")) || productCode || productId || inventoryId,
    "product name": (product && cell(product, products.headers, "product_name", "name", "title")) || cell(r, inventory.headers, "product_name", "name"),
    "category": (product && cell(product, products.headers, "category", "category_name")) || cell(r, inventory.headers, "category", "category_name"),
    "brand": (product && cell(product, products.headers, "brand", "brand_name")) || cell(r, inventory.headers, "brand", "brand_name"),
    "studio": studio?.name || studio?.code || (rawStudio ? `Unmapped studio (${rawStudio})` : "Warehouse"),
    "supply model": "Existing bot", "stockout": num(cell(r, inventory.headers, "available_stock")) <= 0 ? "Yes" : "No",
    "mrp": cell(r, inventory.headers, "mrp"), "selling": cell(r, inventory.headers, "selling_price"),
    "savings": cell(r, inventory.headers, "member_savings"),
    "fill": num(cell(r, inventory.headers, "total_stock")) > 0
      ? num(cell(r, inventory.headers, "available_stock")) / num(cell(r, inventory.headers, "total_stock")) : "",
    "days cover": cell(r, inventory.headers, "days_cover"), "zero sale": cell(r, inventory.headers, "zero_sale"),
    "owned inventory value": cell(r, inventory.headers, "owned_inventory_value"),
    "owner": cell(r, inventory.headers, "warehouse_location") || "Essentials",
  }); });
  const retention = (members: CohortMember[], days: number) => {
    const windowMs = days * 86_400_000;
    const retained = members.filter((member) => {
      const dates = [...member.dates].sort((a, b) => a - b);
      return dates.length > 1 && dates.some((date, index) => index > 0 && date - dates[0] <= windowMs);
    }).length;
    return members.length ? retained / members.length : "";
  };
  const cohortRows = [...cohortGroups.values()].map((group) => {
    const members = [...group.members.values()];
    const buyers = members.length;
    const eligible = eligibleByStudio.get(norm(group.studio))?.size || buyers;
    const ordersCount = members.reduce((sum, member) => sum + member.dates.length, 0);
    return {
      "cohort id": `BOT-ESS-GROUP-${stableToken(group.studio)}`,
      "member group": group.studio,
      "theatre": group.theatre,
      "eligible": eligible,
      "buyers": buyers,
      "attach": eligible ? buyers / eligible : "",
      "gmv": group.gmv,
      "aov": ordersCount ? group.gmv / ordersCount : "",
      "frequency": buyers ? ordersCount / buyers : "",
      "d30": retention(members, 30),
      "d60": retention(members, 60),
      "d90": retention(members, 90),
      "churn": "",
      "products / member": buyers ? members.reduce((sum, member) => sum + member.products.size, 0) / buyers : "",
      "captured at": group.captured,
      [REPORTING_MONTH_HEADER]: reportingMonthFromDate(group.captured),
    };
  });
  const totalEligible = hourly.reduce((sum, row) => sum + num(row["eligible members"]), 0);
  const totalBuyers = hourly.reduce((sum, row) => sum + num(row["buying members"]), 0);
  const totalBilled = hourly.reduce((sum, row) => sum + num(row["essentials billed inr"]), 0);
  const totalMargin = hourly.reduce((sum, row) => sum + num(row["nia margin inr"]), 0);
  const totalSavings = hourly.reduce((sum, row) => sum + num(row["member savings inr"]), 0);
  const latestCaptured = hourly.map((row) => String(row["captured at"] || "")).filter(Boolean).sort().at(-1) || new Date().toISOString();
  const metricRow = (key: string, valueText: string) => ({ key, "value text": valueText, "updated at": latestCaptured });
  const dashboardRows = [
    metricRow("essentials_main_kicker", "MAIN POINT"),
    metricRow("essentials_main_headline", `${totalBuyers.toLocaleString("en-IN")} Members bought Essentials from ${totalEligible.toLocaleString("en-IN")} eligible Members; CM is ${totalBilled ? Math.round(totalMargin / totalBilled * 1_000) / 10 : 0}%.`),
    metricRow("essentials_main_explanation", "Marketing brings Member demand. EAE and Merchandising manage stock, fulfilled orders, savings and working capital."),
    metricRow("essentials_headline_eligible", totalEligible.toLocaleString("en-IN")),
    metricRow("essentials_headline_attach", totalEligible ? `${Math.round(totalBuyers / totalEligible * 100)}%` : "—"),
    metricRow("essentials_headline_gmv", `₹${totalBilled.toLocaleString("en-IN")}`),
    metricRow("essentials_headline_arpu", totalBuyers ? `₹${Math.round(totalBilled / totalBuyers).toLocaleString("en-IN")}` : "—"),
    metricRow("essentials_headline_cm", `₹${totalMargin.toLocaleString("en-IN")}`),
    metricRow("essentials_headline_savings", `₹${totalSavings.toLocaleString("en-IN")}`),
  ];
  await ensureBackendColumns("Essentials_Hourly", ["studio revenue inr", "curry unique members", "curry buying value inr", "internet equipment unique members", "internet equipment buying value inr"]);
  await ensureBackendColumns("Essentials_Inventory", ["product name", "category", "brand", "owned inventory value"]);
  await ensureBackendColumns("Essentials_Cohorts", ["cohort id", "member group", "theatre", "eligible", "buyers", "attach", "gmv", "aov", "frequency", "d30", "d60", "d90", "churn", "products / member", "captured at", REPORTING_MONTH_HEADER]);
  await ensureBackendColumns("Essentials_Dashboard", ["key", "value text", "updated at"]);
  const essentialsHourly = await upsert("Essentials_Hourly", "essentials hourly id", [...hourly, ...quarantined]);
  const essentialsInventory = await upsert("Essentials_Inventory", "sku", inventoryRows);
  const essentialsCohorts = await upsert("Essentials_Cohorts", "cohort id", cohortRows);
  const essentialsDashboard = await upsert("Essentials_Dashboard", "key", dashboardRows);
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
  const removedStaleCohorts = await reconcileBotOwnedRows("Essentials_Cohorts", "cohort id", new Set(cohortRows.map((row) => norm(row["cohort id"]))), (row, headers) => norm(cell(row, headers, "cohort id")).startsWith("bot-ess-group-"));
  return {
    mirrors,
    sourceRows: { products: products.rows.length, orders: orders.rows.length, items: items.rows.length, deliveries: deliveries.rows.length, inventory: inventory.rows.length, studios: studioMaster.rows.length },
    costInputs: { inserted: costInputs.inserted, preserved: costInputs.preserved },
    unresolvedStudioOrders,
    essentialsHourly: { ...essentialsHourly, removedStale: removedStaleHourly },
    essentialsInventory: { ...essentialsInventory, removedStale: removedStaleInventory },
    essentialsCohorts: { ...essentialsCohorts, removedStale: removedStaleCohorts },
    essentialsDashboard,
    memberActivations,
  };
}
