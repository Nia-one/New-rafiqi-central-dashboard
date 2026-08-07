import { google } from "googleapis";
import { createHash } from "node:crypto";
import { googleServiceAccountCredentials } from "./googleCredentials";

const SOURCE_ID = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "1e54fm3oUeseNzsTFG8O4XweRnWVU2n8OvBc7MLOu6nE";
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const num = (value: unknown) => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
const iso = (value: unknown) => { const parsed = new Date(String(value ?? "")); return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(); };
const month = (value: unknown) => iso(value).slice(0, 7);
type Table = { headers: string[]; rows: unknown[][] };
const cell = (table: Table, row: unknown[], ...names: string[]) => { const wanted = new Set(names.map(norm)); const index = table.headers.findIndex((header) => wanted.has(norm(header))); return index < 0 ? "" : row[index] ?? ""; };
const preferredCell = (table: Table, row: unknown[], ...names: string[]) => {
  for (const name of names) {
    const index = table.headers.findIndex((header) => norm(header) === norm(name));
    if (index >= 0 && row[index] !== undefined && row[index] !== null && String(row[index]).trim() !== "") return row[index];
  }
  return "";
};

const systemHeader = (header: string) => ["record id", "reporting date", "reporting time", "last updated", "sample live"].includes(norm(header));
const indiaDateTime = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now).reduce<Record<string, string>>((output, part) => {
    if (part.type !== "literal") output[part.type] = part.value;
    return output;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
};

export function prepareFreshInputRow(tab: string, headers: string[], input: unknown[], sourceRowNumber: number, now = new Date()) {
  const row = [...input];
  const index = (name: string) => headers.findIndex((header) => norm(header) === norm(name));
  const sampleLiveIndex = index("Sample_Live");
  if (sampleLiveIndex < 0 || norm(row[sampleLiveIndex]) !== "live") return { row, updates: [] as { columnIndex: number; value: string }[], isLive: false };

  const { date, time } = indiaDateTime(now);
  const updates: { columnIndex: number; value: string }[] = [];
  const setWhenBlank = (name: string, value: string) => {
    const columnIndex = index(name);
    if (columnIndex >= 0 && String(row[columnIndex] ?? "").trim() === "") {
      row[columnIndex] = value;
      updates.push({ columnIndex, value });
    }
  };
  const stableContent = headers.map((header, columnIndex) => systemHeader(header) ? "" : String(row[columnIndex] ?? "").trim()).join("|");
  const tabCode = tab.replace(/^UI_/, "").replace(/[^A-Za-z0-9]+/g, "-").toUpperCase();
  const digest = createHash("sha256").update(`${tab}|${sourceRowNumber}|${stableContent}`).digest("hex").slice(0, 12).toUpperCase();
  setWhenBlank("Record_ID", `UI-${tabCode}-${digest}`);
  setWhenBlank("Reporting_Date", date);
  setWhenBlank("Reporting_Time", time);
  setWhenBlank("Last_Updated", now.toISOString());
  return { row, updates, isLive: true };
}

async function upsertOwned(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, target: string, keyHeader: string, records: Record<string, unknown>[]) {
  if (!records.length) return 0;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${target}'!A:AZ` });
  const rows = (response.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === norm(keyHeader));
  if (keyIndex < 0) throw new Error(`${target} is missing ${keyHeader}`);
  const byKey = new Map(rows.slice(1).map((row, index) => [norm(row[keyIndex]), index + 2] as const).filter(([key]) => key));
  const updates: { range: string; values: unknown[][] }[] = [], appends: unknown[][] = [];
  for (const record of records) {
    const key = norm(record[keyHeader]); if (!key) continue;
    const output = headers.map((header) => record[norm(header)] ?? record[header] ?? "");
    const rowNumber = byKey.get(key);
    if (rowNumber) updates.push({ range: `'${target}'!A${rowNumber}`, values: [output] }); else appends.push(output);
  }
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } });
  if (appends.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `'${target}'!A:AZ`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: appends } });
  return updates.length + appends.length;
}

export async function syncFreshDashboardInputs() {
  const backendId = process.env.GOOGLE_SHEET_ID; if (!backendId) throw new Error("GOOGLE_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  // Essentials demand and FONO demand/supply are automated sources. Keeping
  // them out of this manual connector prevents duplicate operator input.
  const tabs = ["UI_Occupancy", "UI_Shrampark_Supply", "UI_Enterprise_Demand", "UI_Enterprise_Supply", "UI_Finance", "UI_Collections", "UI_People", "UI_Actions", "UI_Approvals", "UI_Evidence", "UI_Targets"];
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_ID, ranges: tabs.map((tab) => `'${tab}'!A:AN`) });
  const sourceUpdates: { range: string; values: string[][] }[] = [];
  const tables = new Map(tabs.map((tab, index) => {
    const values = (response.data.valueRanges?.[index]?.values || []) as unknown[][];
    const headerIndex = values.findIndex((row) => row.some((value) => norm(value) === "record id"));
    const headers = (values[headerIndex] || []).map(String);
    const rows = values.slice(headerIndex + 1).map((row, rowOffset) => {
      const sourceRowNumber = headerIndex + rowOffset + 2;
      const prepared = prepareFreshInputRow(tab, headers, row, sourceRowNumber);
      for (const update of prepared.updates) {
        const column = update.columnIndex + 1;
        let letters = "", remaining = column;
        while (remaining > 0) { const remainder = (remaining - 1) % 26; letters = String.fromCharCode(65 + remainder) + letters; remaining = Math.floor((remaining - 1) / 26); }
        sourceUpdates.push({ range: `'${tab}'!${letters}${sourceRowNumber}`, values: [[update.value]] });
      }
      return prepared;
    }).filter((prepared) => prepared.isLive).map((prepared) => prepared.row);
    const table: Table = { headers, rows };
    return [tab, table] as const;
  }));
  if (sourceUpdates.length) {
    try {
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SOURCE_ID, requestBody: { valueInputOption: "USER_ENTERED", data: sourceUpdates } });
    } catch (error) {
      const status = (error as { code?: number; status?: number }).code ?? (error as { status?: number }).status;
      if (status !== 403) throw error;
      console.warn(`Fresh input source is read-only for the sync identity; ${sourceUpdates.length} generated values were used for this sync but could not be persisted.`);
    }
  }
  const t = (name: string) => tables.get(name)!;
  const map = (name: string, mapper: (row: unknown[], table: Table) => Record<string, unknown>) => t(name).rows.map((row) => mapper(row, t(name)));
  const common = (row: unknown[], table: Table) => ({ "source submission id": cell(table, row, "Record_ID"), "updated at": iso(cell(table, row, "Last_Updated", "Reporting_Date")), "reporting month": month(cell(table, row, "Reporting_Date")) });

  const occupancy = map("UI_Occupancy", (row, table) => ({ "living hourly id": cell(table, row, "Record_ID"), "theatre id": cell(table, row, "Theatre_ID"), "studio id": cell(table, row, "Studio_ID"), "supply model": "EXISTING", "contracted nests": num(cell(table, row, "Contracted_Nests")), "activation ready nests": num(cell(table, row, "Activation_Ready_Nests")), "occupied nests": num(cell(table, row, "Occupied_Nests")), "occupancy ratio": num(cell(table, row, "Occupancy_Pct")), ...common(row, table) }));
  // FONO is projected exclusively from the imported Business Report `Fono
  // Funnel` tab by syncFonoTrackerData(). Keeping UI_FONO_Supply out prevents
  // duplicate or stale manual FONO rows.
  const supplyTabs = ["UI_Shrampark_Supply", "UI_Enterprise_Supply"];
  const supply = supplyTabs.flatMap((name) => map(name, (row, table) => {
    const available = num(cell(table, row, "Available_Nests", "Nests_Count"));
    const ready = num(cell(table, row, "Verified_Ready_Nests")) || available;
    return { "living hourly id": cell(table, row, "Record_ID"), "theatre id": cell(table, row, "Theatre_ID"), "studio id": cell(table, row, "Studio_ID") || cell(table, row, "Supply_Option_ID"), "supply model": name === "UI_Shrampark_Supply" ? "SP" : cell(table, row, "Supply_Model") || "ENTERPRISE", "contracted nests": available, "activation ready nests": ready, "occupied nests": 0, "occupancy ratio": 0, ...common(row, table) };
  }));
  const demand = map("UI_Enterprise_Demand", (row, table) => ({ "demand id": cell(table, row, "Record_ID"), "enterprise id": cell(table, row, "Enterprise_ID") || `ENT-${cell(table, row, "Record_ID")}`, "enterprise name": cell(table, row, "Enterprise_Name", "Demand_Source"), "plant id": cell(table, row, "Plant_ID") || cell(table, row, "Studio_ID"), "plant name": preferredCell(table, row, "Plant_Name", "Studio_Name"), "role required": cell(table, row, "Role_Required") || "Living supply", "skill required": cell(table, row, "Skill_Required"), shift: cell(table, row, "Shift"), "headcount required": num(cell(table, row, "Headcount_Required", "Required_Members")), "headcount matched": num(cell(table, row, "Headcount_Matched", "Matched_Members")), "activation required at": iso(preferredCell(table, row, "Activation_Required_At", "Reporting_Date")), certainty: cell(table, row, "Certainty"), status: cell(table, row, "Status") || "Open", "owner actor id": cell(table, row, "Business_Owner"), "opened at": iso(cell(table, row, "Reporting_Date")), ...common(row, table) }));
  const memberAdds = supplyTabs.flatMap((name) => map(name, (row, table) => {
    const recordId = String(cell(table, row, "Record_ID"));
    const required = num(cell(table, row, "Nests_Count", "Available_Nests", "Verified_Ready_Nests"));
    return { "demand id": `MEMBER-ADDS-${recordId}`, "enterprise id": name, "enterprise name": name === "UI_Shrampark_Supply" ? "Shrampark" : "Enterprise", "plant id": cell(table, row, "Studio_ID", "Supply_Option_ID"), "plant name": cell(table, row, "Studio_Name", "Factory_Name"), "role required": "Member Adds", "headcount required": required, "headcount matched": num(cell(table, row, "Member_Adds")), "activation required at": iso(cell(table, row, "Reporting_Date")), certainty: "Live input", status: cell(table, row, "Status") || "Live", "owner actor id": cell(table, row, "Business_Owner"), "opened at": iso(cell(table, row, "Reporting_Date")), ...common(row, table) };
  }));
  const finance = map("UI_Finance", (row, table) => ({ "finance daily id": cell(table, row, "Record_ID"), "business date": cell(table, row, "Reporting_Date"), "theatre id": cell(table, row, "Theatre_ID"), "studio id": cell(table, row, "Studio_ID"), "total billed inr": num(cell(table, row, "Billed_Cash_INR")), "total collected inr": num(cell(table, row, "Collected_Cash_INR")), "opex mtd inr": num(cell(table, row, "Opex_INR")), "cm1 inr": num(cell(table, row, "Revenue_INR")) - num(cell(table, row, "Direct_Cost_INR")), "cm2 inr": num(cell(table, row, "Revenue_INR")) - num(cell(table, row, "Direct_Cost_INR")) - num(cell(table, row, "Opex_INR")), "living cm2 inr": num(cell(table, row, "Living_CM_INR")), "work cm2 inr": num(cell(table, row, "Work_CM_INR")), "essentials cm2 inr": num(cell(table, row, "Essentials_CM_INR")), notes: cell(table, row, "Remarks"), ...common(row, table) }));
  const collections = map("UI_Collections", (row, table) => ({
    "finance daily id": cell(table, row, "Record_ID"),
    "business date": cell(table, row, "Reporting_Date"),
    "theatre name": cell(table, row, "Theatre_Name"),
    "theatre id": cell(table, row, "Theatre_ID"),
    "studio id": cell(table, row, "Studio_ID"),
    "studio name": cell(table, row, "Studio_Name"),
    location: cell(table, row, "Location"),
    "business owner": cell(table, row, "Business_Owner"),
    "invoice id": cell(table, row, "Invoice_ID"),
    "customer or member ref": cell(table, row, "Customer_or_Member_Ref"),
    "total billed inr": num(cell(table, row, "Billed_INR")),
    "total collected inr": num(cell(table, row, "Collected_INR")),
    "current due inr": num(cell(table, row, "Billed_INR")) - num(cell(table, row, "Collected_INR")),
    "due date": cell(table, row, "Due_Date"),
    "finance reviewer": cell(table, row, "Finance_Reviewer"),
    "reconciliation status": cell(table, row, "Status"),
    notes: cell(table, row, "Remarks"),
    "evidence ref": cell(table, row, "Evidence_Ref"),
    ...common(row, table),
  }));
  const people = map("UI_People", (row, table) => ({ "actor id": cell(table, row, "Record_ID"), "display name": cell(table, row, "Person_Name"), role: cell(table, row, "Role"), "theatre id": cell(table, row, "Theatre_ID"), "studio id": cell(table, row, "Studio_ID"), "active shift": norm(cell(table, row, "Status")) === "inactive" ? "Inactive" : "Active", ...common(row, table) }));
  const peoplePerformance = map("UI_People", (row, table) => {
    const target = num(cell(table, row, "Target"));
    const actual = num(cell(table, row, "Actual"));
    const accountabilityArea = cell(table, row, "Accountability_Area", "Supply_Model", "Vertical");
    return { "actor id": cell(table, row, "Record_ID"), "display name": cell(table, row, "Person_Name"), team: cell(table, row, "Team"), lane: accountabilityArea, status: cell(table, row, "Status"), "attainment pct": target > 0 ? Math.round(actual / target * 100) : 0, "review due": cell(table, row, "Review_Due_Date"), "reporting status": "Reporting", target, actual, "accountability area": accountabilityArea, "accountability scope": cell(table, row, "Accountability_Scope"), "theatre id": cell(table, row, "Theatre_ID"), "studio id": cell(table, row, "Studio_ID"), role: cell(table, row, "Role"), "evidence ref": cell(table, row, "Evidence_Ref"), ...common(row, table) };
  });
  const actions = map("UI_Actions", (row, table) => ({ "action id": cell(table, row, "Record_ID"), "operating objective": cell(table, row, "Operating_Objective"), "expected metric": cell(table, row, "Expected_Metric"), "baseline value": cell(table, row, "Baseline_Value"), "target value": cell(table, row, "Target_Value"), "owner actor id": cell(table, row, "Action_Owner", "Business_Owner"), "due at": cell(table, row, "Due_At"), "required evidence": cell(table, row, "Required_Evidence"), "approval tier": cell(table, row, "Approval_Tier"), state: cell(table, row, "State", "Status"), "studio id": cell(table, row, "Studio_ID"), ...common(row, table) }));
  const approvals = map("UI_Approvals", (row, table) => ({ "approval id": cell(table, row, "Record_ID"), "linked action id": cell(table, row, "Linked_Action_ID"), "decision type": cell(table, row, "Decision_Type"), "amount inr": num(cell(table, row, "Amount_INR")), "current terms": cell(table, row, "Current_Terms"), "proposed terms": cell(table, row, "Proposed_Terms"), "business reason": cell(table, row, "Business_Reason"), "expected result": cell(table, row, "Expected_Result"), "approver actor id": cell(table, row, "Approver"), decision: cell(table, row, "Decision"), "decision reason": cell(table, row, "Decision_Reason"), "decided at": cell(table, row, "Decided_At"), ...common(row, table) }));
  const evidence = map("UI_Evidence", (row, table) => ({ "evidence id": cell(table, row, "Record_ID"), "linked type": "Action", "linked id": cell(table, row, "Linked_Action_ID"), "evidence type": cell(table, row, "Evidence_Type"), "protected url": cell(table, row, "Source_Reference", "Evidence_Ref"), "uploaded by actor id": cell(table, row, "Uploaded_By"), "uploaded at": cell(table, row, "Captured_At"), "verification status": cell(table, row, "Verification_Status"), notes: cell(table, row, "Remarks"), ...common(row, table) }));
  const targets = map("UI_Targets", (row, table) => ({ "policy id": cell(table, row, "Record_ID"), "policy name": `${cell(table, row, "Mode")} · ${cell(table, row, "Page")} · ${cell(table, row, "KPI_Name")}`, "policy value": cell(table, row, "Target_Value"), unit: cell(table, row, "Unit"), "effective from": cell(table, row, "Effective_From"), "approved by": cell(table, row, "Approver"), status: cell(table, row, "Status"), "source note": cell(table, row, "Remarks"), ...common(row, table) }));
  const specs = [["Living_Hourly", "living hourly id", [...occupancy, ...supply]], ["Enterprise_Demand", "demand id", [...demand, ...memberAdds]], ["Finance_Daily", "finance daily id", [...finance, ...collections]], ["People_Roster", "actor id", people], ["People_Performance", "actor id", peoplePerformance], ["Action_Log", "action id", actions], ["Approval_Log", "approval id", approvals], ["Evidence_Log", "evidence id", evidence], ["Policy_Registry", "policy id", targets]] as const;
  const written: Record<string, number> = {}; for (const [target, key, records] of specs) written[target] = await upsertOwned(sheets, backendId, target, key, records);
  return { sourceSpreadsheetId: SOURCE_ID, liveRows: [...tables.values()].reduce((sum, table) => sum + table.rows.length, 0), written };
}
