import { google } from "googleapis";
import { REPORTING_MONTH_HEADER, normalizeReportingMonth, reportingMonthFromDate } from "./reportingMonth";

type SheetsClient = ReturnType<typeof google.sheets>;
type Assignment = { assignmentId: string; vertical: string; scope: string; theatre: string; role: string; ownerName: string; responsibility: string; effectiveFrom: string; effectiveTo: string; status: string; reportingMonth: string };
const normal = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const isSampleRow = (row: unknown[]) => row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell ?? "")));
const slug = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
const actorId = (name: string) => `ACT-${slug(name)}`;
const aliases: Record<string, string> = { decaan: "deccan", coromandal: "coromandel", commandal: "coromandel", welington: "wellington" };
const theatre = (value: unknown) => aliases[normal(value)] || normal(value);

export function resolveRegistryOwner(assignments: Assignment[], vertical: string, options: { scope?: string; theatre?: unknown; role?: string } = {}) {
  const scope = normal(options.scope || "all");
  const wantedTheatre = theatre(options.theatre);
  const role = normal(options.role || "owner");
  return assignments.find((item) => normal(item.status) === "active" && normal(item.vertical) === normal(vertical) && normal(item.role) === role
    && (normal(item.scope) === "all" || normal(item.scope) === scope)
    && (item.theatre.split("|").map(theatre).includes("all") || item.theatre.split("|").map(theatre).includes(wantedTheatre)))?.ownerName || "";
}

export function verticalForObjective(value: unknown) {
  const text = normal(value);
  if (/collection|outstanding|overdue|receivable/.test(text)) return "Collection";
  if (/finance|cash|margin|cm2|budget|control/.test(text)) return "Finance";
  if (/essential/.test(text) && /demand|conversion|customer|purchase/.test(text)) return "Essential Demand";
  if (/essential/.test(text)) return "Essential Supply";
  if (/sp|shram park/.test(text) && /supply|capacity|nest/.test(text)) return "SP Supply";
  if (/sp|shram park/.test(text)) return "SP Demand";
  if (/fono/.test(text) && /supply|capacity|readiness|nest/.test(text)) return "FONO Supply";
  if (/fono/.test(text)) return "FONO Demand";
  if (/enterprise/.test(text) && /supply|capacity|readiness/.test(text)) return "Enterprise Supply";
  if (/enterprise/.test(text)) return "Enterprise Demand";
  if (/occupancy|living/.test(text)) return "Occupancy";
  return "";
}

const rowObjects = (rows: unknown[][]) => {
  const headers = (rows[0] || []).map(normal);
  return rows.slice(1).filter((row) => !isSampleRow(row)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
};

async function ensureBackendRegistry(sheets: SheetsClient, spreadsheetId: string, assignments: Assignment[]) {
  const title = "Owner_Registry";
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  if (!(metadata.data.sheets || []).some((sheet) => sheet.properties?.title === title)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  }
  const headers = ["assignment id", "vertical", "scope", "theatre", "role type", "owner name", "business responsibility", "effective from", "effective to", "status", "owner actor id", "synced at", REPORTING_MONTH_HEADER];
  const now = new Date().toISOString();
  const values = assignments.map((item) => [item.assignmentId, item.vertical, item.scope, item.theatre, item.role, item.ownerName, item.responsibility, item.effectiveFrom, item.effectiveTo, item.status, actorId(item.ownerName), now, item.reportingMonth || reportingMonthFromDate(item.effectiveFrom)]);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A:Z` });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!A1`, valueInputOption: "RAW", requestBody: { values: [headers, ...values] } });
}

async function upsertPeople(sheets: SheetsClient, spreadsheetId: string, assignments: Assignment[]) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "People_Roster!A:Z" });
  const rows = (response.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(normal);
  const keyIndex = headers.indexOf("actor id");
  if (keyIndex < 0) throw new Error("People_Roster is missing actor id");
  const output = rows.map((row) => [...row]);
  const existing = new Map(output.slice(1).map((row, index) => [normal(row[keyIndex]), index + 1]));
  const now = new Date().toISOString();
  let inserted = 0, updated = 0;
  const active = assignments.filter((item) => normal(item.status) === "active");
  const people = [...new Map(active.map((item) => [normal(item.ownerName), item])).values()];
  const spOwners = [...new Set(active.filter((item) => normal(item.vertical) === "sp supply" && normal(item.role) === "owner").map((item) => item.ownerName))];
  if (spOwners.length) people.push({ assignmentId: "OWNER-SP-THEATRE-GROUP", vertical: "SP Supply", scope: "All", theatre: "All", role: "Owner", ownerName: spOwners.join(" / "), responsibility: "Derived Shram Park theatre-owner group", effectiveFrom: "", effectiveTo: "", status: "Active", reportingMonth: "" });
  for (const item of people) {
    const record: Record<string, unknown> = { "actor id": actorId(item.ownerName), "display name": item.ownerName, role: `${item.vertical} ${item.role}`, "active shift": "Active", language: "English / Hindi", "updated at": now, [REPORTING_MONTH_HEADER]: item.reportingMonth || reportingMonthFromDate(item.effectiveFrom) };
    if (item.assignmentId === "OWNER-SP-THEATRE-GROUP") record["actor id"] = "ACT-SP-THEATRE-OWNERS";
    const found = existing.get(normal(record["actor id"]));
    const destination = found == null ? Array(headers.length).fill("") : [...output[found]];
    headers.forEach((header, index) => { if (record[header] !== undefined) destination[index] = record[header]; });
    if (found == null) { output.push(destination); existing.set(normal(record["actor id"]), output.length - 1); inserted++; } else { output[found] = destination; updated++; }
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "People_Roster!A1", valueInputOption: "USER_ENTERED", requestBody: { values: output } });
  return { inserted, updated };
}

async function cascadeNiaGrowthOwners(sheets: SheetsClient, spreadsheetId: string) {
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ["Action_Log!A:AZ", "Approval_Log!A:AZ", "Evidence_Log!A:AZ", "Learning_History!A:AZ"] });
  const [actions, approvals, evidence, learning] = (response.data.valueRanges || []).map((range) => ((range.values || []) as unknown[][]).map((row) => [...row]));
  const actionHeaders = (actions[0] || []).map(normal), actionIdIndex = actionHeaders.indexOf("action id"), actionOwnerIndex = actionHeaders.indexOf("owner actor id");
  const ownerEntries = actions.slice(1)
    .filter((row) => /^OPS-NIA-GROWTH-/.test(String(row[actionIdIndex] || "")))
    .map((row) => [String(row[actionIdIndex]), String(row[actionOwnerIndex] || "")] as const)
    .filter(([, owner]) => Boolean(owner));
  const owners = new Map<string, string>(ownerEntries);
  let updated = 0;
  const update = (rows: unknown[][], keyHeader: string, ownerHeader: string, ownerForRow: (row: unknown[], headers: string[]) => string) => {
    const headers = (rows[0] || []).map(normal), ownerIndex = headers.indexOf(normal(ownerHeader));
    if (ownerIndex < 0) return 0;
    let count = 0;
    rows.slice(1).forEach((row) => { const owner = ownerForRow(row, headers); if (owner && row[ownerIndex] !== owner) { row[ownerIndex] = owner; count++; } });
    return count;
  };
  updated += update(approvals, "approval id", "approver actor id", (row, headers) => owners.get(String(row[headers.indexOf("linked action id")])) || "");
  updated += update(evidence, "evidence id", "uploaded by actor id", (row, headers) => owners.get(String(row[headers.indexOf("linked id")])) || "");
  updated += update(learning, "id", "owner actor id", (row, headers) => {
    const id = String(row[headers.indexOf("id")] || "");
    const match = id.match(/^OPS-NIA-GROWTH-LEARN-(FONO|SP)-(20\d{2}-\d{2})$/);
    const model = match?.[1] || "", month = match?.[2] || "";
    return model ? owners.get(`OPS-NIA-GROWTH-${model}-${month}`) || (model === "SP" ? "ACT-SP-THEATRE-OWNERS" : "") : "";
  });
  if (updated) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: [
    { range: "Approval_Log!A1", values: approvals }, { range: "Evidence_Log!A1", values: evidence }, { range: "Learning_History!A1", values: learning },
  ] } });
  return updated;
}

async function updateTab(sheets: SheetsClient, spreadsheetId: string, tab: string, assignments: Assignment[]) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` });
  const rows = ((response.data.values || []) as unknown[][]).map((row) => [...row]);
  if (rows.length < 2) return { updated: 0 };
  const headers = rows[0].map(normal);
  const index = (name: string) => headers.indexOf(normal(name));
  const setOwner = (row: unknown[], header: string, owner: string) => { const i = index(header); if (i >= 0 && owner && row[i] !== actorId(owner)) { row[i] = actorId(owner); return true; } return false; };
  let updated = 0;
  for (const row of rows.slice(1)) {
    let owner = "";
    if (tab === "Living_Hourly") owner = resolveRegistryOwner(assignments, "Occupancy");
    if (tab === "Essentials_Hourly") owner = resolveRegistryOwner(assignments, "Essential Supply");
    if (tab === "Finance_Daily") owner = resolveRegistryOwner(assignments, "Finance");
    if (tab === "Enterprise_Demand") {
      const demandId = String(row[index("demand id")] || "");
      owner = demandId.startsWith("SP-BOT-")
        ? resolveRegistryOwner(assignments, "SP Demand", { scope: "SP Demand Bot", theatre: row[index("theatre id")] })
        : resolveRegistryOwner(assignments, "Enterprise Demand");
      if (!owner && demandId.startsWith("SP-BOT-")) continue;
    }
    if (tab === "Action_Log") {
      const vertical = verticalForObjective(`${row[index("operating objective")] || ""} ${row[index("notes")] || ""}`);
      const scope = vertical === "Collection" ? "Finance" : "All";
      owner = vertical ? resolveRegistryOwner(assignments, vertical, { scope, theatre: row[index("theatre id")] }) : "";
    }
    const header = tab === "Living_Hourly" || tab === "Essentials_Hourly" ? "next action owner actor id" : tab === "Finance_Daily" ? "destination owner actor id" : "owner actor id";
    if (setOwner(row, header, owner)) updated++;
  }
  if (updated) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
  return { updated };
}

export async function syncOwnerRegistry(sheets: SheetsClient, sourceSpreadsheetId: string, spreadsheetId: string) {
  const source = await sheets.spreadsheets.values.get({ spreadsheetId: sourceSpreadsheetId, range: "TEAM_OWNER_REGISTRY!A:Z" });
  const objects = rowObjects((source.data.values || []) as unknown[][]);
  const assignments: Assignment[] = objects.map((row) => ({ assignmentId: String(row["assignment id"] || row.assignment_id || ""), vertical: String(row.vertical || ""), scope: String(row.scope || "All"), theatre: String(row.theatre || "All"), role: String(row["role type"] || row.role_type || "Owner"), ownerName: String(row["owner name"] || row.owner_name || ""), responsibility: String(row["business responsibility"] || row.business_responsibility || ""), effectiveFrom: String(row["effective from"] || row.effective_from || ""), effectiveTo: String(row["effective to"] || row.effective_to || ""), status: String(row.status || "Active"), reportingMonth: normalizeReportingMonth(row[REPORTING_MONTH_HEADER]) || reportingMonthFromDate(row["effective from"] || row.effective_from) })).filter((item) => item.assignmentId && item.ownerName);
  await ensureBackendRegistry(sheets, spreadsheetId, assignments);
  const people = await upsertPeople(sheets, spreadsheetId, assignments);
  const tabs: Record<string, { updated: number }> = {};
  for (const tab of ["Living_Hourly", "Essentials_Hourly", "Finance_Daily", "Enterprise_Demand", "Action_Log"]) tabs[tab] = await updateTab(sheets, spreadsheetId, tab, assignments);
  const niaGrowthCascaded = await cascadeNiaGrowthOwners(sheets, spreadsheetId);
  return { assignments: assignments.length, people, tabs, niaGrowthCascaded };
}
