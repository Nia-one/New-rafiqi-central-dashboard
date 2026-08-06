import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { syncOwnerRegistry } from "./ownerRegistrySync";
import { normalizeReportingMonth, REPORTING_MONTH_HEADER, reportingMonthTimestamp } from "./reportingMonth";

const mappings = [
  ["TEAM_FINANCE_DAILY", "Finance_Daily"],
  ["TEAM_MEMBER_ACTIVATION", "Member_Activation"],
  ["TEAM_REQ_PEOPLE_ROSTER", "People_Roster"],
  ["TEAM_LEARNING_HISTORY", "Learning_History"],
  ["TEAM_REQ_POLICY_REGISTRY", "Policy_Registry"],
  ["TEAM_REQ_INCIDENT_LOG", "Incident_Log"],
  ["TEAM_REQ_ACTION_LOG", "Action_Log"],
  ["TEAM_REQ_EVIDENCE_LOG", "Evidence_Log"],
  ["TEAM_REQ_APPROVAL_LOG", "Approval_Log"],
] as const;

const generatedKeyParts: Record<string, string[]> = {
  TEAM_FINANCE_DAILY: ["business date", "theatre id", "studio id"],
  TEAM_MEMBER_ACTIVATION: ["member token", "activated at", "studio id"],
  TEAM_REQ_PEOPLE_ROSTER: ["display name", "role", "theatre id", "studio id"],
  TEAM_LEARNING_HISTORY: ["reporting month", "domain", "observed", "proposed change"],
};
const generatedKeyPrefixes: Record<string, string> = {
  TEAM_FINANCE_DAILY: "OPS-FIN",
  TEAM_MEMBER_ACTIVATION: "OPS-ACTV",
  TEAM_REQ_PEOPLE_ROSTER: "OPS-PER",
  TEAM_LEARNING_HISTORY: "OPS-LEARN",
};

const aliases: Record<string, string> = {
  "date": "business date",
  "approved by actor id": "approved by",
  "active status": "active shift",
  "metric name": "policy name",
  "threshold value": "policy value",
  "objective": "operating objective",
  "financial impact": "expected financial impact inr",
};

const normal = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const isSampleRow = (row: unknown[]) => row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell ?? "")));
const reportingMonthRequiredTabs = new Set<string>(mappings.map(([source]) => source).filter((source) => source !== "TEAM_REQ_PEOPLE_ROSTER"));

const dateOnlyTargetHeaders = new Set(["business date", "effective from", "effective to"]);
const userDateTargetHeaders = new Set([
  "activation required at", "activated at", "decision due at", "due at",
  "effective from", "effective to", "verified at", "shift start at", "shift end at",
]);

/** Converts a user-entered DD-MM-YYYY date into the canonical Sheet value. */
export function normalizeTeamInputDate(header: string, value: unknown) {
  const field = normal(header);
  const raw = String(value ?? "").trim();
  if (!raw || !userDateTargetHeaders.has(field)) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;

  const indian = raw.match(/^(\d{1,2})[-\/]([0-1]?\d)[-\/](\d{4})$/);
  const isoDate = raw.match(/^(\d{4})[-\/]([0-1]?\d)[-\/](\d{1,2})$/);
  const parts = indian
    ? { year: indian[3], month: indian[2], day: indian[1] }
    : isoDate ? { year: isoDate[1], month: isoDate[2], day: isoDate[3] } : null;
  if (!parts) return value;

  const date = `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
  return dateOnlyTargetHeaders.has(field) ? date : `${date}T00:00:00+05:30`;
}

const enterpriseOutcomeTab = "TEAM_ENTERPRISE_OUTCOMES";

function stableEnterpriseId(prefix: string, ...parts: unknown[]) {
  const digest = crypto.createHash("sha1").update(parts.map(normal).join("|")).digest("hex").slice(0, 12).toUpperCase();
  return `${prefix}-${digest}`;
}

async function upsertObjects(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string,
  keyHeader: string,
  records: Record<string, unknown>[],
  ownedPrefix?: string,
) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` });
  let output = ((response.data.values || []) as unknown[][]).map((row) => [...row]);
  if (!output.length) return { inserted: 0, updated: 0, removed: 0 };
  const headers = output[0].map(normal);
  const keyIndex = headers.indexOf(normal(keyHeader));
  if (keyIndex < 0) return { inserted: 0, updated: 0, removed: 0 };
  const desiredKeys = new Set(records.map((record) => normal(record[keyHeader])).filter(Boolean));
  const beforeCleanup = output.length;
  if (ownedPrefix) {
    const normalizedPrefix = normal(ownedPrefix);
    output = [output[0], ...output.slice(1).filter((row) => {
      const key = normal(row[keyIndex]);
      return !key.startsWith(normalizedPrefix) || desiredKeys.has(key);
    })];
  }
  const removed = beforeCleanup - output.length;
  const existing = new Map(output.slice(1).map((row, index) => [normal(row[keyIndex]), index + 1]));
  let inserted = 0, updated = 0;
  for (const record of records) {
    const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [normal(key), value]));
    const key = normal(normalized[normal(keyHeader)]);
    if (!key) continue;
    const found = existing.get(key);
    const destination = found == null ? Array(headers.length).fill("") : [...output[found]];
    headers.forEach((header, index) => {
      const value = normalized[header];
      if (value !== "" && value != null) destination[index] = value;
    });
    if (found == null) { output.push(destination); existing.set(key, output.length - 1); inserted++; }
    else { output[found] = destination; updated++; }
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: output } });
  return { inserted, updated, removed };
}

async function syncEnterpriseOutcomes(
  sheets: ReturnType<typeof google.sheets>, sourceSpreadsheetId: string, spreadsheetId: string,
) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sourceSpreadsheetId, range: `${enterpriseOutcomeTab}!A:Z` });
  const rows = (response.data.values || []) as unknown[][];
  const headerIndex = rows.findIndex((row) => row.map(normal).includes("demand reference") && row.map(normal).includes("state"));
  if (headerIndex < 0) return { actions: { inserted: 0, updated: 0, removed: 0 }, evidence: { inserted: 0, updated: 0, removed: 0 }, skipped: 0 };
  const headers = rows[headerIndex].map(normal);
  const value = (row: unknown[], name: string) => row[headers.indexOf(normal(name))] ?? "";
  const actions: Record<string, unknown>[] = [];
  const evidence: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const row of rows.slice(headerIndex + 1).filter((row) => !isSampleRow(row))) {
    const demandRef = value(row, "demand reference");
    const outcome = value(row, "action / outcome");
    if (/^required\s*:/i.test(String(demandRef).trim())) continue;
    if (!String(demandRef).trim() || !String(outcome).trim()) { if (row.some((cell) => String(cell ?? "").trim())) skipped++; continue; }
    const reportingMonth = normalizeReportingMonth(value(row, "reporting month"));
    if (!reportingMonth) { skipped++; continue; }
    const actionId = stableEnterpriseId("OPS-ENT-ACT", reportingMonth, demandRef, outcome);
    const proof = value(row, "proof reference");
    const state = value(row, "state") || "Open";
    const verifiedAt = value(row, "verified at");
    actions.push({
      "action id": actionId,
      "operating objective": `Enterprise Demand · ${demandRef} · ${outcome}`,
      "expected metric": "Verified ready Nests / governed demand outcome",
      "owner actor id": value(row, "owner actor id"),
      "due at": value(row, "due at"),
      "required evidence": proof || "Outcome proof pending",
      "approval tier": "Operational",
      state,
      "proposed at": value(row, "recorded at") || new Date().toISOString(),
      "updated at": verifiedAt || new Date().toISOString(),
      notes: value(row, "notes"),
      "source submission id": `TEAM-ENTERPRISE-${actionId}`,
      [REPORTING_MONTH_HEADER]: reportingMonth,
    });
    if (String(proof).trim()) {
      evidence.push({
        "evidence id": stableEnterpriseId("OPS-ENT-EVD", actionId, proof),
        "linked type": "Action",
        "linked id": actionId,
        "evidence type": "Enterprise demand outcome proof",
        "protected url": proof,
        "uploaded by actor id": value(row, "verified by actor id") || value(row, "owner actor id"),
        "uploaded at": verifiedAt || new Date().toISOString(),
        description: value(row, "notes") || outcome,
        "verification status": /verified|closed|resolved/i.test(String(state)) ? "Verified" : "Pending",
        [REPORTING_MONTH_HEADER]: reportingMonth,
      });
    }
  }
  return {
    actions: await upsertObjects(sheets, spreadsheetId, "Action_Log", "action id", actions, "OPS-ENT-ACT"),
    evidence: await upsertObjects(sheets, spreadsheetId, "Evidence_Log", "evidence id", evidence, "OPS-ENT-EVD"),
    skipped,
  };
}

export function headerRow(rows: unknown[][], targetHeaders: string[]) {
  const target = new Set(targetHeaders.map(normal));
  let bestIndex = -1;
  let bestMatches = 3;
  rows.forEach((row, index) => {
    const matches = row.filter((cell) => target.has(aliases[normal(cell)] || normal(cell))).length;
    if (matches > bestMatches) {
      bestIndex = index;
      bestMatches = matches;
    }
  });
  return bestIndex;
}

async function syncNiaGrowthInputs(
  sheets: ReturnType<typeof google.sheets>, sourceSpreadsheetId: string, spreadsheetId: string,
) {
  const tab = "TEAM_NIA_GROWTH";
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: sourceSpreadsheetId, fields: "sheets.properties.title" });
  if (!(metadata.data.sheets || []).some((sheet) => sheet.properties?.title === tab)) return null;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sourceSpreadsheetId, range: `${tab}!A:AZ` });
  const rows = (response.data.values || []) as unknown[][];
  const headerIndex = rows.findIndex((row) => row.map(normal).includes("growth record id") && row.map(normal).includes("supply model"));
  if (headerIndex < 0) return null;
  const headers = rows[headerIndex].map(normal);
  const objects = rows.slice(headerIndex + 1).filter((row) => !isSampleRow(row))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    .filter((row) => normal(row["growth record id"]));
  const now = new Date().toISOString();
  const amount = (row: Record<string, unknown>, key: string) => numberFor(row[normal(key)]);
  const field = (row: Record<string, unknown>, key: string) => String(row[normal(key)] ?? "").trim();
  const actions: Record<string, unknown>[] = [];
  const evidence: Record<string, unknown>[] = [];
  const approvals: Record<string, unknown>[] = [];
  const policies: Record<string, unknown>[] = [];
  const learning: Record<string, unknown>[] = [];
  for (const row of objects) {
    const model = field(row, "supply model").toUpperCase();
    const reportingMonth = normalizeReportingMonth(field(row, REPORTING_MONTH_HEADER));
    if (!model || !reportingMonth) continue;
    const recordSuffix = `${model}-${reportingMonth}`;
    const required = amount(row, "required nests");
    const ready = amount(row, "activation ready nests");
    const gap = Math.max(0, required - ready);
    const owner = field(row, "owner actor id") || "ACT-UNASSIGNED";
    const approvalDecision = field(row, "approval decision");
    const readinessComplete = required > 0 && ready >= required;
    const financeApproved = /^approved$/i.test(approvalDecision);
    const governedVerified = readinessComplete && financeApproved;
    const governedVerifiedAt = governedVerified ? (field(row, "readiness verified at") || now) : field(row, "readiness verified at");
    const actionId = `OPS-NIA-GROWTH-${recordSuffix}`;
    if (gap > 0) {
      actions.push({
        "action id": actionId, "operating objective": `Nia Growth ${model} readiness gap`,
        "expected metric": "Activation-ready Nests", "baseline value": ready, "target value": required,
        confidence: field(row, "verification status") === "Verified" ? "High" : "Cannot confirm",
        "owner actor id": owner, "due at": normalizeTeamInputDate("due at", field(row, "action due at")),
        "required evidence": `${model} readiness evidence and authorised approval`, "approval tier": "Growth / capital",
        state: governedVerified || (field(row, "readiness status") === "Ready" && field(row, "verification status") === "Verified") ? "Proof submitted" : "Open",
        "proposed at": reportingMonthTimestamp(reportingMonth), "source submission id": `TEAM-NIA-GROWTH-${recordSuffix}`, "updated at": now,
        [REPORTING_MONTH_HEADER]: reportingMonth,
        "next action": field(row, "notes") || `Close and independently verify the ${gap}-Nest ${model} readiness gap`,
      });
      approvals.push({
        "approval id": `OPS-NIA-GROWTH-APR-${recordSuffix}`, "linked action id": actionId,
        "decision type": `${model} capacity readiness`, "current terms": model === "FONO"
          ? `${ready} activation-ready Nests; ${field(row, "nia filled nests") ? `${amount(row, "nia filled nests")} Nia-filled Nests` : "Nia-fill split not recorded"}`
          : `${ready} activation-ready Nests; ${field(row, "signed contract covered nests") ? `${amount(row, "signed contract covered nests")} signed-contract-covered Nests` : "Signed contract coverage not recorded"}`,
        "proposed terms": `${required} required Nests`, "business reason": `${gap}-Nest governed readiness gap`,
        "expected result": `${required} independently verified activation-ready Nests`, "approver role": "Growth owner",
        "approver actor id": owner, decision: field(row, "approval decision") || "Pending",
        "decision reason": field(row, "notes"), "source submission id": `TEAM-NIA-GROWTH-APR-${recordSuffix}`, "updated at": now,
        [REPORTING_MONTH_HEADER]: reportingMonth,
      });
    }
    const evidenceUrl = field(row, "evidence url");
    if (evidenceUrl || governedVerified) evidence.push({
      "evidence id": `OPS-NIA-GROWTH-EVD-${recordSuffix}`, "linked type": "Action", "linked id": actionId,
      "evidence type": `${model} capacity readiness`, "protected url": evidenceUrl || `protected://governed/nia-growth/${model.toLowerCase()}/finance-approved`, "uploaded by actor id": owner,
      "uploaded at": normalizeTeamInputDate("verified at", governedVerifiedAt) || now,
      description: `${ready} of ${required} Nests recorded activation-ready`,
      "verification status": governedVerified ? "Verified" : field(row, "verification status") || "Pending",
      "source submission id": `TEAM-NIA-GROWTH-EVD-${recordSuffix}`, "updated at": now,
      [REPORTING_MONTH_HEADER]: reportingMonth,
    });
    const sla = amount(row, "readiness sla days");
    const policyStatus = field(row, "policy status");
    const policyApprover = field(row, "policy approved by actor id");
    if (sla > 0 && policyStatus === "Approved" && policyApprover) policies.push({
      "policy id": `OPS-NIA-GROWTH-SLA-${recordSuffix}`, "policy name": `Nia Growth ${model} readiness SLA and verified closure`,
      "policy value": sla, unit: "days", "effective from": now.slice(0, 10), "approved by": policyApprover,
      status: "Approved", "source note": "Closure requires independently verified readiness evidence and human approval.", "updated at": now,
      [REPORTING_MONTH_HEADER]: reportingMonth,
    });
    const observed = field(row, "learning observation");
    const proposal = field(row, "learning proposal");
    if (observed || proposal) learning.push({
      id: `OPS-NIA-GROWTH-LEARN-${recordSuffix}`, domain: "Nia Growth", observed,
      "proposed change": proposal, "expected effect": `Improve verified ${model} readiness without automatic capital commitment`,
      attribution: "Connected operations data", confidence: field(row, "verification status") === "Verified" ? "Medium" : "Low",
      disposition: "Human sign-off", "owner actor id": owner, "updated at": now, notes: field(row, "notes"),
      [REPORTING_MONTH_HEADER]: reportingMonth,
    });
  }
  return {
    actions: await upsertObjects(sheets, spreadsheetId, "Action_Log", "action id", actions, "OPS-NIA-GROWTH-"),
    evidence: await upsertObjects(sheets, spreadsheetId, "Evidence_Log", "evidence id", evidence, "OPS-NIA-GROWTH-EVD-"),
    approvals: await upsertObjects(sheets, spreadsheetId, "Approval_Log", "approval id", approvals, "OPS-NIA-GROWTH-APR-"),
    policies: await upsertObjects(sheets, spreadsheetId, "Policy_Registry", "policy id", policies, "OPS-NIA-GROWTH-SLA-"),
    learning: await upsertObjects(sheets, spreadsheetId, "Learning_History", "id", learning, "OPS-NIA-GROWTH-LEARN-"),
  };
}

const financeSourceTabs = ["Living_Hourly", "Work_Hourly", "Essentials_Hourly"] as const;
const numberFor = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const dateOnly = (value: unknown) => {
  const parsed = new Date(String(value ?? ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : String(value ?? "").trim().slice(0, 10);
};
function sourceObjects(rows: unknown[][]) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(normal);
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}
function firstValue(row: Record<string, unknown>, names: string[]) {
  for (const name of names) if (row[normal(name)] !== "" && row[normal(name)] != null) return row[normal(name)];
  return "";
}
function aggregateFinanceSources(rows: Record<string, unknown>[], businessDate: unknown, theatre: unknown, studio: unknown) {
  const wantedDate = dateOnly(businessDate), wantedTheatre = normal(theatre), wantedStudio = normal(studio);
  const matching = rows.filter((row) => {
    const rowDate = dateOnly(firstValue(row, ["business date", "event at", "updated at", "reported at", "date"]));
    const rowTheatre = normal(firstValue(row, ["theatre id", "theatre", "theater name"]));
    const rowStudio = normal(firstValue(row, ["studio id", "studio", "studio code", "studio name"]));
    return (!wantedDate || rowDate === wantedDate) && (!wantedTheatre || rowTheatre === wantedTheatre) && (!wantedStudio || rowStudio === wantedStudio);
  });
  const sum = (names: string[]) => matching.reduce((total, row) => total + numberFor(firstValue(row, names)), 0);
  return {
    matched: matching.length,
    billed: sum(["total billed inr", "billed inr", "determined revenue", "revenue", "rent", "buying value"]),
    collected: sum(["total collected inr", "collected inr", "collection", "collected amount"]),
    overdue: sum(["overdue inr", "overdue amount inr"]),
  };
}

export async function syncTeamInputs() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const sourceSpreadsheetId = process.env.GOOGLE_LEGACY_TEAM_INPUT_SHEET_ID || process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU";
  // The fresh workbook owns its dashboard-aligned UI_* inputs. Only inputs
  // without a UI_* equivalent are read from its legacy-compatible TEAM_* tabs,
  // preventing duplicate Finance, People, Action, Evidence and Approval rows.
  const freshWorkbookSource = sourceSpreadsheetId === process.env.GOOGLE_TEAM_INPUT_SHEET_ID && !process.env.GOOGLE_LEGACY_TEAM_INPUT_SHEET_ID;
  const activeMappings = freshWorkbookSource
    ? mappings.filter(([source]) => source === "TEAM_MEMBER_ACTIVATION" || source === "TEAM_LEARNING_HISTORY")
    : mappings;
  const credentials = googleServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const financeSourceResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: financeSourceTabs.map((tab) => `${tab}!A:AZ`),
  });
  const financeSourceRows = (financeSourceResponse.data.valueRanges || []).flatMap((range) => sourceObjects((range.values || []) as unknown[][]));
  const report: string[][] = [["synced_at", "source_tab", "target_tab", "inserted", "updated", "skipped", "status"]];

  // Fetch all mapped tabs in two batch requests. Calling values.get twice per
  // mapping exhausted the service-account per-minute read quota in production.
  const [mappedSources, mappedTargets] = await Promise.all([
    sheets.spreadsheets.values.batchGet({ spreadsheetId: sourceSpreadsheetId, ranges: activeMappings.map(([source]) => `${source}!A:AZ`) }),
    sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: activeMappings.map(([, target]) => `${target}!A:AZ`) }),
  ]);

  for (const [mappingIndex, [source, target]] of activeMappings.entries()) {
    const sourceRows = (mappedSources.data.valueRanges?.[mappingIndex]?.values || []) as unknown[][];
    const targetRows = (mappedTargets.data.valueRanges?.[mappingIndex]?.values || []) as unknown[][];
    if (targetRows.length === 0) {
      report.push([new Date().toISOString(), source, target, "0", "0", "0", "missing headers"]);
      continue;
    }
    const targetHeaders = targetRows[0].map(normal);
    const sourceHeaderIndex = headerRow(sourceRows, targetHeaders);
    if (sourceHeaderIndex < 0) {
      report.push([new Date().toISOString(), source, target, "0", "0", "0", "missing headers"]);
      continue;
    }
    const sourceHeaders = sourceRows[sourceHeaderIndex].map(normal);
    const targetIndex = new Map<string, number>(targetHeaders.map((header, index): [string, number] => [header, index]));
    const keyTarget = 0;
    const keySource = sourceHeaders.findIndex((header) => (targetIndex.get(aliases[header] || header) ?? -1) === keyTarget);
    const generatedKey = generatedKeyParts[source];
    const generatedFinanceKey = source === "TEAM_FINANCE_DAILY";
    if (keySource < 0 && !generatedKey) {
      report.push([new Date().toISOString(), source, target, "0", "0", "0", "missing key"]);
      continue;
    }
    const output = targetRows.map((row) => [...row]);
    const existing = new Map<string, number>();
    output.slice(1).forEach((row, index) => {
      const key = normal(row[keyTarget]);
      if (key) existing.set(key, index + 1);
    });
    let inserted = 0, updated = 0, skipped = 0;
    for (const row of sourceRows.slice(sourceHeaderIndex + 1).filter((row) => !isSampleRow(row))) {
      const sourceValue = (name: string) => {
        const index = sourceHeaders.indexOf(normal(name));
        return index < 0 ? "" : row[index];
      };
      const reportingMonth = normalizeReportingMonth(sourceValue(REPORTING_MONTH_HEADER));
      if (reportingMonthRequiredTabs.has(source) && !reportingMonth) { skipped++; continue; }
      const suppliedKey = keySource < 0 ? "" : row[keySource];
      const generatedIdentity = generatedKey?.map((part) => sourceValue(part)).filter((part) => String(part ?? "").trim()).join("-") || "";
      const key = normal(suppliedKey || (generatedIdentity ? `${generatedKeyPrefixes[source]}-${generatedIdentity}` : ""));
      if (!key) { skipped++; continue; }
      const targetRowIndex = existing.get(key);
      const destination = targetRowIndex == null ? Array(targetHeaders.length).fill("") : [...output[targetRowIndex]];
      sourceHeaders.forEach((header, sourceIndex) => {
        const targetHeader = aliases[header] || header;
        const destinationIndex = targetIndex.get(targetHeader);
        const value = row[sourceIndex];
        if (destinationIndex != null && value !== "" && value != null) {
          destination[destinationIndex] = normalizeTeamInputDate(targetHeader, value);
        }
      });
      const reportingMonthIndex = targetIndex.get(REPORTING_MONTH_HEADER);
      if (reportingMonthIndex != null && reportingMonth) destination[reportingMonthIndex] = reportingMonth;
      if (generatedKey) destination[0] = String(suppliedKey || key).toUpperCase();
      if (source === "TEAM_MEMBER_ACTIVATION") {
        const billedIndex = targetIndex.get("membership billed inr"), collectedIndex = targetIndex.get("membership collected inr");
        const leakageIndex = targetIndex.get("collection leakage inr"), sourceIndex = targetIndex.get("source submission id");
        const billed = billedIndex == null ? 0 : numberFor(destination[billedIndex]);
        const collected = collectedIndex == null ? 0 : numberFor(destination[collectedIndex]);
        if (leakageIndex != null) destination[leakageIndex] = Math.max(0, billed - collected);
        if (sourceIndex != null) destination[sourceIndex] = `TEAM-ACTV-${String(key).toUpperCase()}`;
        const statusIndex = targetIndex.get("verification status");
        const acquisitionIndex = targetIndex.get("acquisition source");
        const updatedIndex = targetIndex.get("updated at");
        if (statusIndex != null && !destination[statusIndex]) destination[statusIndex] = "Pending";
        if (acquisitionIndex != null && !destination[acquisitionIndex]) destination[acquisitionIndex] = "Manual team input";
        if (updatedIndex != null) destination[updatedIndex] = new Date().toISOString();
      }
      if (source === "TEAM_REQ_PEOPLE_ROSTER") {
        const updatedIndex = targetIndex.get("updated at");
        if (updatedIndex != null) destination[updatedIndex] = new Date().toISOString();
      }
      if (source === "TEAM_LEARNING_HISTORY") {
        const updatedIndex = targetIndex.get("updated at");
        if (updatedIndex != null) destination[updatedIndex] = new Date().toISOString();
      }
      if (generatedFinanceKey) {
        destination[0] = String(sourceValue("finance daily id") || key).toUpperCase();
        const setDerived = (header: string, value: unknown) => {
          const index = targetIndex.get(normal(header));
          if (index != null) destination[index] = value;
        };
        const amount = (name: string) => Number(String(sourceValue(name) ?? "").replace(/[^0-9.-]/g, "")) || 0;
        const sourceTotals = aggregateFinanceSources(financeSourceRows, sourceValue("business date"), sourceValue("theatre id"), sourceValue("studio id"));
        const billed = sourceTotals.matched ? sourceTotals.billed : amount("total billed inr");
        const collected = sourceTotals.matched ? sourceTotals.collected : amount("total collected inr");
        const cash = amount("cash balance inr");
        const cap = amount("cash target inr");
        const now = new Date().toISOString();
        if (sourceTotals.matched) {
          setDerived("total billed inr", billed);
          setDerived("total collected inr", collected);
          setDerived("overdue inr", sourceTotals.overdue);
        }
        setDerived("current due inr", Math.max(0, billed - collected));
        setDerived("cash guardrail status", cap > 0 ? (cash >= cap ? "Protected" : "At risk") : "Target not recorded");
        setDerived("reconciliation status", billed > 0 && collected >= billed ? "Reconciled" : "Pending");
        setDerived("reported at", sourceValue("reported at") || now);
        setDerived("source submission id", `TEAM-FIN-${key}`);
        setDerived("updated at", now);
      }
      if (targetRowIndex == null) {
        output.push(destination); existing.set(key, output.length - 1); inserted++;
      } else { output[targetRowIndex] = destination; updated++; }
    }
    if (inserted || updated) {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${target}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: output } });
    }
    report.push([new Date().toISOString(), source, target, String(inserted), String(updated), String(skipped), "ok"]);
  }

  const sourceMetadata = await sheets.spreadsheets.get({ spreadsheetId: sourceSpreadsheetId, fields: "sheets.properties.title" });
  if ((sourceMetadata.data.sheets || []).some((sheet) => sheet.properties?.title === enterpriseOutcomeTab)) {
    const result = await syncEnterpriseOutcomes(sheets, sourceSpreadsheetId, spreadsheetId);
    report.push([new Date().toISOString(), enterpriseOutcomeTab, "Action_Log + Evidence_Log", String(result.actions.inserted + result.evidence.inserted), String(result.actions.updated + result.evidence.updated), String(result.skipped), "ok"]);
  }

  const growth = await syncNiaGrowthInputs(sheets, sourceSpreadsheetId, spreadsheetId);
  if (growth) {
    const totals = Object.values(growth).reduce((sum, item) => ({ inserted: sum.inserted + item.inserted, updated: sum.updated + item.updated, removed: sum.removed + item.removed }), { inserted: 0, updated: 0, removed: 0 });
    report.push([new Date().toISOString(), "TEAM_NIA_GROWTH", "Governed growth logs", String(totals.inserted), String(totals.updated), String(totals.removed), "ok"]);
  }

  const ownerRegistry = await syncOwnerRegistry(sheets, sourceSpreadsheetId, spreadsheetId);
  report.push([new Date().toISOString(), "TEAM_OWNER_REGISTRY", "Owner_Registry + owner-bearing tabs", "0", String(Object.values(ownerRegistry.tabs).reduce((sum, item) => sum + item.updated, 0) + ownerRegistry.people.updated + ownerRegistry.niaGrowthCascaded), String(ownerRegistry.people.inserted), "ok"]);

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  if (!(metadata.data.sheets || []).some((sheet) => sheet.properties?.title === "TEAM_SYNC_STATUS")) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: "TEAM_SYNC_STATUS" } } }] } });
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "TEAM_SYNC_STATUS!A:Z" });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "TEAM_SYNC_STATUS!A1", valueInputOption: "RAW", requestBody: { values: report } });
  return report;
}
