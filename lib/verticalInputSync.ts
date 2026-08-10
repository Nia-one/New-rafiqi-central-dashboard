import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { normalizeReportingMonth, reportingMonthFromDate, REPORTING_MONTH_HEADER } from "./reportingMonth";
import { canonicalizeBusinessReportTabs, repairBusinessReportFormulaReferences } from "./businessReportTabs";

const SOURCE_ID = process.env.GOOGLE_LEGACY_TEAM_INPUT_SHEET_ID || "1e54fm3oUeseNzsTFG8O4XweRnWVU2n8OvBc7MLOu6nE";
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const isSampleRow = (row: unknown[]) => row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell ?? "")));
const number = (v: unknown) => Number(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;
const value = (row: unknown[], headers: string[], ...names: string[]) => {
  for (const name of names) {
    const index = headers.findIndex((header) => norm(header) === norm(name));
    if (index >= 0 && String(row[index] ?? "").trim()) return row[index];
  }
  return "";
};
const id = (prefix: string, parts: unknown[]) => `${prefix}-${crypto.createHash("sha1").update(parts.map(String).join("|")).digest("hex").slice(0, 16)}`;
const timestamp = (v: unknown) => {
  const raw = String(v || "").trim();
  // Operations sheets use Indian day-month-year dates. JavaScript otherwise
  // interprets 1-8-2026 as January 8 in some runtimes.
  const indianDate = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  const date = indianDate
    ? new Date(Date.UTC(Number(indianDate[3]), Number(indianDate[2]) - 1, Number(indianDate[1])))
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

function credentials() {
  return googleServiceAccountCredentials();
}

async function replaceOwned(target: string, keyHeader: string, prefix: string, records: Record<string, unknown>[], currentRows?: unknown[][]) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const rows: unknown[][] = currentRows ?? await sheets.spreadsheets.values.get({ spreadsheetId, range: `${target}!A:AZ` }).then((current) => (current.data.values ?? []) as unknown[][]);
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === norm(keyHeader));
  if (keyIndex < 0) throw new Error(`${target} is missing ${keyHeader}`);
  const keep = rows.slice(1).filter((row) => !norm(row[keyIndex]).startsWith(norm(prefix)));
  const output = records.map((record) => headers.map((header) => record[header] ?? ""));
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${target}!A2:AZ` });
  if (keep.length || output.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${target}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: [...keep, ...output] } });
  return output.length;
}

async function replaceAllRows(target: string, records: Record<string, unknown>[]) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${target}!A1:AZ` });
  const headers = (((current.data.values || []) as unknown[][])[0] || []).map(String);
  if (!headers.length) throw new Error(`${target} has no canonical headers`);
  const output = records.map((record) => headers.map((header) => record[header] ?? ""));
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${target}!A2:AZ` });
  if (output.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${target}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: output } });
  return output.length;
}

export async function syncVerticalInputs() {
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const initialMetadata = await sheets.spreadsheets.get({ spreadsheetId: SOURCE_ID, fields: "sheets.properties(sheetId,title,index,hidden)" });
  const freshWorkbook = (initialMetadata.data.sheets || []).some((sheet) => sheet.properties?.title === "00_READ_ME");
  if (!freshWorkbook) {
    await canonicalizeBusinessReportTabs(sheets, SOURCE_ID);
    await repairBusinessReportFormulaReferences(sheets, SOURCE_ID);
  }
  // Essentials is bot-owned. Keeping the manual summary out of this connector
  // prevents a later refresh from replacing bot orders, margin and inventory.
  const baseTabs = ["TEAM_OCCUPANCY", "TEAM_REQ_SP_SUPPLY"];
  const reportBases = ["Studios", "Fono Funnel", "Essentials", "Flow", "CM Actions"];
  const metadata = freshWorkbook ? initialMetadata : await sheets.spreadsheets.get({ spreadsheetId: SOURCE_ID, fields: "sheets.properties(sheetId,title,index,hidden)" });
  const available = (metadata.data.sheets || []).map((sheet) => sheet.properties!).filter((properties) => properties.title);
  const importedTitles = reportBases.flatMap((base) => available.filter((properties) => properties.title === base || properties.title?.startsWith(`${base} (`)).sort((a, b) => (b.index || 0) - (a.index || 0)).slice(0, 1).map((properties) => properties.title!));
  const tabs = [...baseTabs, ...importedTitles];
  const result = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SOURCE_ID, ranges: tabs.map((tab) => `${tab}!A:AZ`) });
  const tables = new Map(tabs.map((tab, index) => {
    const rows = (result.data.valueRanges?.[index]?.values || []) as unknown[][];
    const headerIndex = tab.startsWith("TEAM_") ? 0 : rows.findIndex((row) => {
      const cells = row.map(norm);
      return cells.filter(Boolean).length >= 4 && cells.some((cell) => ["date", "theatre", "studio code", "client", "action", "s no."].includes(cell));
    });
    return [tab, { headers: (rows[Math.max(0, headerIndex)] || []).map(String), rows: rows.slice(Math.max(0, headerIndex) + 1).filter((row) => !isSampleRow(row) && row.some((cell) => String(cell ?? "").trim())), rawRows: rows, headerIndex: Math.max(0, headerIndex) }];
  }));
  const imported = (base: string) => {
    const title = importedTitles.find((candidate) => candidate === base || candidate.startsWith(`${base} (`));
    return title ? tables.get(title) : undefined;
  };

  const teamOccupancy = tables.get("TEAM_OCCUPANCY");
  const studioReport = imported("Studios");
  // The imported Studios report is the occupancy source of truth. Mirror it into
  // TEAM_OCCUPANCY so the operator never has to enter the same studio metrics twice.
  // Activation Ready Nests is the only field preserved from the user-input tab,
  // because that operational readiness value is not present in the report.
  let occupancySource = studioReport?.rows.length ? studioReport : teamOccupancy;
  if (!freshWorkbook && studioReport?.rows.length && teamOccupancy?.headers.length) {
    const sampleRows = teamOccupancy.rawRows.slice(teamOccupancy.headerIndex + 1).filter(isSampleRow);
    const existingByStudio = new Map(teamOccupancy.rows.map((row) => [norm(value(row, teamOccupancy.headers, "Studio Code")), row]));
    const reportDate = studioReport.rawRows?.[1]?.[1] || "";
    const mirroredRows = studioReport.rows
      .filter((row) => {
        const studio = value(row, studioReport.headers, "Studio Code");
        const status = value(row, studioReport.headers, "Status");
        return Boolean(String(studio).trim()) && norm(studio) !== "studio code" && norm(studio) !== "total" && norm(status) === "active";
      })
      .map((row) => {
        const studio = value(row, studioReport.headers, "Studio Code");
        const existing = existingByStudio.get(norm(studio));
        return teamOccupancy.headers.map((header) => {
          const sourceIndex = studioReport.headers.findIndex((candidate) => norm(candidate) === norm(header));
          if (sourceIndex >= 0) return row[sourceIndex] ?? "";
          if (norm(header) === "dashboard record id") return id("OPS-OCC", [studio]);
          if (norm(header) === "as of at" || norm(header) === "source updated at") return reportDate ? timestamp(reportDate) : "";
          if (norm(header) === REPORTING_MONTH_HEADER) return reportingMonthFromDate(reportDate) || "";
          if (norm(header) === "location id") return studio;
          if (norm(header) === "supply model") return "EXISTING";
          if (norm(header) === "activation ready nests") return existing ? value(existing, teamOccupancy.headers, "Activation Ready Nests") : "";
          return "";
        });
      });
    await sheets.spreadsheets.values.clear({ spreadsheetId: SOURCE_ID, range: "TEAM_OCCUPANCY!A2:AZ" });
    if (mirroredRows.length) await sheets.spreadsheets.values.update({
      spreadsheetId: SOURCE_ID,
      range: "TEAM_OCCUPANCY!A2",
      valueInputOption: "USER_ENTERED",
      // Keep the protected example immediately below the header so operators see
      // the input format before the automated Studio rows. Sample rows remain
      // excluded from every downstream projection by isSampleRow().
      requestBody: { values: [...sampleRows, ...mirroredRows] },
    });
    occupancySource = { ...teamOccupancy, rows: mirroredRows };
  }
  if (!occupancySource?.rows.length) throw new Error("TEAM_OCCUPANCY is required as the authoritative occupancy source");
  const livingPrefix = "OPS-RPT-OCC";
  const living = occupancySource.rows.filter((row) => norm(value(row, occupancySource.headers, "Studio Code")) !== "studio code" && Boolean(normalizeReportingMonth(value(row, occupancySource.headers, REPORTING_MONTH_HEADER)))).map((row) => {
    const studio = value(row, occupancySource.headers, "Studio Code", "Studio Name", "studio_id");
    const reportingMonth = normalizeReportingMonth(value(row, occupancySource.headers, REPORTING_MONTH_HEADER))!;
    const at = timestamp(value(row, occupancySource.headers, "as_of_at", "source_updated_at", "Date", "updated_at"));
    const contracted = number(value(row, occupancySource.headers, "Contracted Nest"));
    const occupied = number(value(row, occupancySource.headers, "Occupied Nest"));
    return { "living hourly id": id(livingPrefix, [studio, reportingMonth, at.slice(0, 13)]), "theatre id": value(row, occupancySource.headers, "Theatre", "theatre_id"), "studio id": studio, "supply model": "EXISTING", "contracted nests": contracted, "activation ready nests": number(value(row, occupancySource.headers, "Activation Ready Nests")), "occupied nests": occupied, "living billed inr": number(value(row, occupancySource.headers, "Determined Revenue", "living_billed_inr")), "living collected inr": number(value(row, occupancySource.headers, "Living Collected INR", "living_collected_inr")), "collection leakage inr": number(value(row, occupancySource.headers, "Collection Leakage INR", "collection_leakage_inr")), "occupancy ratio": contracted ? occupied / contracted : 0, "source submission id": id(`${livingPrefix}-SRC`, [studio, reportingMonth, at]), "updated at": at, [REPORTING_MONTH_HEADER]: reportingMonth };
  });

  const spSupplySource = tables.get("TEAM_REQ_SP_SUPPLY");
  const spSupply = (spSupplySource?.rows || []).filter((row) => {
    const site = value(row, spSupplySource!.headers, "sp_supply_id", "site_name", "location_id");
    return Boolean(String(site).trim()) && norm(site) !== "sp supply id" && Boolean(normalizeReportingMonth(value(row, spSupplySource!.headers, REPORTING_MONTH_HEADER)));
  }).map((row) => {
    const reportingMonth = normalizeReportingMonth(value(row, spSupplySource!.headers, REPORTING_MONTH_HEADER))!;
    const sourceId = value(row, spSupplySource!.headers, "sp_supply_id") || id("OPS-SP-SUPPLY", [
      value(row, spSupplySource!.headers, "location_id", "site_name"),
      value(row, spSupplySource!.headers, "as_of_at", "updated_at"),
    ]);
    const studioId = String(value(row, spSupplySource!.headers, "location_id") || sourceId);
    const at = timestamp(value(row, spSupplySource!.headers, "as_of_at", "updated_at"));
    const contracted = number(value(row, spSupplySource!.headers, "contracted_nests"));
    const ready = number(value(row, spSupplySource!.headers, "activation_ready_nests"));
    const occupied = number(value(row, spSupplySource!.headers, "occupied_nests"));
    const theatreId = value(row, spSupplySource!.headers, "theatre_id");
    return {
      hourly: {
        "living hourly id": `OPS-SP-SUPPLY-${String(sourceId).replace(/[^A-Za-z0-9-]/g, "-")}`,
        "theatre id": theatreId, "studio id": studioId, "supply model": "SP",
        "contracted nests": contracted, "activation ready nests": ready, "occupied nests": occupied,
        "occupancy ratio": contracted > 0 ? occupied / contracted : 0,
        "source submission id": String(sourceId), "updated at": at, [REPORTING_MONTH_HEADER]: reportingMonth,
      },
      studio: {
        "studio id": `OPS-SP-${studioId}`, "theatre id": theatreId,
        "studio name": value(row, spSupplySource!.headers, "site_name") || studioId,
        "operating model": "Shram Park", "supply model": "SP",
        "contract status": value(row, spSupplySource!.headers, "contract_coverage_status"),
        "readiness status": ready >= contracted && contracted > 0 ? "Ready" : "In progress",
        "contracted nests": contracted, "activation ready nests": ready, "occupied nests": occupied,
        "owner actor id": value(row, spSupplySource!.headers, "owner_actor_id"), "updated at": at, [REPORTING_MONTH_HEADER]: reportingMonth,
      },
    };
  });

  // FONO is projected only by syncFonoTrackerData() from the fresh workbook.
  // This connector used to write the same imported funnel as OPS-RPT-FONO rows,
  // which doubled demand whenever a full governed sync ran. Keep this cleanup so
  // existing legacy rows are removed before the canonical projection is applied.

  /* Essentials rows are produced exclusively by syncEssentialsBotData(). */
  const essentialsSource = { headers: [] as string[], rows: [] as unknown[][] };
  const essentialsReport = { rows: [] as unknown[][] };
  const hourly = essentialsSource.rows.filter((row) => norm(value(row, essentialsSource.headers, "Studio Code", "Studio Name")) !== "studio code").map((row) => {
    const studio = value(row, essentialsSource.headers, "Studio Code", "Studio Name");
    const at = new Date().toISOString();
    const billed = number(value(row, essentialsSource.headers, "Buying Value", "Total Rev (₹)"));
    return { "essentials hourly id": id(essentialsReport?.rows.length ? "OPS-RPT-ESS" : "OPS-ESS", [studio, at.slice(0, 10)]), "theatre id": value(row, essentialsSource.headers, "Theater Name", "Theatre"), "studio id": studio, "eligible members": number(value(row, essentialsSource.headers, "Total Active Member Count", "Unique Members (capped)")), "buying members": number(value(row, essentialsSource.headers, "Unique member ( Buy Essential)", "Unique Members (capped)")), "essentials billed inr": billed, "essentials collected inr": billed, "nia margin inr": number(value(row, essentialsSource.headers, "% Attche Revnue")), "attach pct": number(value(row, essentialsSource.headers, "% Attche", "Attach %")) / (String(value(row, essentialsSource.headers, "% Attche", "Attach %")).includes("%") ? 100 : 1), "source submission id": id("OPS-RPT-ESS-SRC", [studio, at.slice(0, 10)]), "updated at": at, "captured at": at };
  });

  const sourceColumn = (row: unknown[], predicate: (header: string) => boolean) => {
    const index = essentialsSource.headers.findIndex((header) => predicate(norm(header)));
    return index < 0 ? "" : row[index];
  };
  const authoritativeEssentials = essentialsSource.rows
    .filter((row) => Boolean(String(value(row, essentialsSource.headers, "Studio Name")).trim()) && norm(value(row, essentialsSource.headers, "Studio Name")) !== "studio name")
    .map((row) => {
      const studio = value(row, essentialsSource.headers, "Studio Name");
      const theatre = value(row, essentialsSource.headers, "Theater Name");
      const at = new Date().toISOString();
      const billed = number(value(row, essentialsSource.headers, "Buying Value"));
      const eligibleMembers = number(value(row, essentialsSource.headers, "Total Active Member Count"));
      const buyingMembers = number(value(row, essentialsSource.headers, "Unique member ( Buy Essential)"));
      return {
        "essentials hourly id": id("OPS-RPT-ESS", [studio, at.slice(0, 10)]),
        "theatre id": theatre, "studio id": studio, "eligible members": eligibleMembers, "buying members": buyingMembers,
        "essentials billed inr": billed, "essentials collected inr": billed,
        "product cogs inr": number(value(row, essentialsSource.headers, "Total COGS (₹)", "Product COGS (₹)")),
        "direct fulfilment cost inr": number(value(row, essentialsSource.headers, "Total Fulfilment Cost (₹)", "Fulfilment Cost (₹)")),
        "member savings inr": value(row, essentialsSource.headers, "Total Member Savings (₹)", "Member Savings (₹)"),
        "nia margin inr": value(row, essentialsSource.headers, "Total Nia Margin (₹)", "Nia Margin (₹)"),
        "attach pct": eligibleMembers > 0 ? buyingMembers / eligibleMembers : "",
        "attach floor pct": value(row, essentialsSource.headers, "Attach Floor %"),
        "repeat pct": value(row, essentialsSource.headers, "Repeat %"),
        "repeat baseline pct": value(row, essentialsSource.headers, "Repeat Baseline %"),
        "weekly message status": value(row, essentialsSource.headers, "Weekly Message Status", "Delivery Status"),
        "next action": value(row, essentialsSource.headers, "Next Action"),
        "next action owner actor id": value(row, essentialsSource.headers, "Next Action Owner Actor ID"),
        "next action due at": value(row, essentialsSource.headers, "Next Action Due At"),
        "evidence required": value(row, essentialsSource.headers, "Evidence Required"),
        "source submission id": id("OPS-RPT-ESS-SRC", [studio, at.slice(0, 10)]), "updated at": at, "captured at": at,
      };
    });

  const flow = imported("Flow");
  const work = (flow?.rows || []).filter((row) => norm(value(row, flow!.headers, "Client")) !== "client").map((row) => {
    const client = value(row, flow!.headers, "Client");
    const sourceMonth = value(row, flow!.headers, "Month");
    const month = timestamp(sourceMonth);
    const reportingMonth = reportingMonthFromDate(sourceMonth) || reportingMonthFromDate(month)!;
    return { "work hourly id": id("OPS-RPT-WORK", [client, month]), "enterprise id": id("OPS-RPT-ENT", [client]), "matched headcount": number(value(row, flow!.headers, "HC")), "work billed inr": number(value(row, flow!.headers, "Total Billing (₹)")), "work collected inr": "", "captured at": month, "source submission id": id("OPS-RPT-WORK-SRC", [client, month]), [REPORTING_MONTH_HEADER]: reportingMonth };
  });
  const cmActions = imported("CM Actions");
  const legacyReportActions = (cmActions?.rows || []).filter((row) => {
    const objective = value(row, cmActions!.headers, "Studio / Entity");
    return objective && norm(objective) !== "studio / entity";
  }).map((row) => {
    const objective = value(row, cmActions!.headers, "Studio / Entity");
    const proposedAt = timestamp(value(row, cmActions!.headers, "Date"));
    const reportingMonth = reportingMonthFromDate(proposedAt)!;
    const planned = number(value(row, cmActions!.headers, "Planned Impact (₹)"));
    const realized = number(value(row, cmActions!.headers, "Realized (₹)"));
    return { "action id": id("OPS-RPT-CM", [objective, proposedAt]), "incident id": "", "operating objective": objective, "expected metric": "CM impact (₹)", "baseline value": realized, "target value": planned, "expected financial impact inr": Math.max(0, planned - realized), "confidence": "Reported", "owner actor id": "", "due at": timestamp(value(row, cmActions!.headers, "Target Close")), "required evidence": "Business Performance Report — CM Actions source row", "approval tier": "Human", "state": value(row, cmActions!.headers, "Status") || "Open", "proposed at": proposedAt, "notes": value(row, cmActions!.headers, "Notes"), [REPORTING_MONTH_HEADER]: reportingMonth };
  });
  const componentActions = (cmActions?.rows || []).filter((row) => {
    const component = value(row, cmActions!.headers, "CM Component");
    const cmInr = number(value(row, cmActions!.headers, "CM INR"));
    const revenueInr = number(value(row, cmActions!.headers, "Revenue INR"));
    return component && norm(component) !== "living" && (cmInr !== 0 || revenueInr !== 0);
  }).map((row) => {
    const component = value(row, cmActions!.headers, "CM Component");
    const cmType = value(row, cmActions!.headers, "CM Type") || "Actual";
    const cmInr = number(value(row, cmActions!.headers, "CM INR"));
    const revenueInr = number(value(row, cmActions!.headers, "Revenue INR"));
    const volume = number(value(row, cmActions!.headers, "Volume / Nests"));
    const sourceMonth = value(row, cmActions!.headers, "Reporting Month") || new Date().toISOString();
    const proposedAt = timestamp(sourceMonth);
    const reportingMonth = reportingMonthFromDate(sourceMonth) || reportingMonthFromDate(proposedAt)!;
    const notes = value(row, cmActions!.headers, "Notes");
    const sourceMode = value(row, cmActions!.headers, "Source Mode") || "MANUAL";
    return { "action id": id("OPS-RPT-CM-COMP", [component, cmType, reportingMonth]), "incident id": "", "operating objective": component, "expected metric": `CM ${cmType}`, "baseline value": cmInr, "target value": revenueInr, "expected financial impact inr": cmInr, "confidence": sourceMode, "owner actor id": "", "due at": proposedAt, "required evidence": "CM Actions governed component input", "approval tier": "Human", "state": value(row, cmActions!.headers, "Status") || "Open", "proposed at": proposedAt, "notes": `CM_INPUT|revenue=${revenueInr}|volume=${volume}|source=${sourceMode}|${notes}`, [REPORTING_MONTH_HEADER]: reportingMonth };
  });
  const reportActions = [...legacyReportActions, ...componentActions];

  const targets = ["Living_Hourly", "Studio_Master", "Enterprise_Demand", "Work_Hourly", "Action_Log"];
  const targetResponse = await sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.GOOGLE_SHEET_ID, ranges: targets.map((target) => `${target}!A:AZ`) });
  const targetRows = new Map(targets.map((target, index) => [target, (targetResponse.data.valueRanges?.[index]?.values || []) as unknown[][]]));
  const allLiving = [...living, ...spSupply.map((row) => row.hourly)];
  const report = {
    living: await replaceOwned("Living_Hourly", "living hourly id", "OPS-", allLiving, targetRows.get("Living_Hourly")),
    spSupplyLiving: spSupply.length,
    spSupplyStudios: await replaceOwned("Studio_Master", "studio id", "OPS-SP-", spSupply.map((row) => row.studio), targetRows.get("Studio_Master")),
    demand: await replaceOwned("Enterprise_Demand", "demand id", "OPS-RPT-FONO", [], targetRows.get("Enterprise_Demand")),
    work: await replaceOwned("Work_Hourly", "work hourly id", "OPS-RPT-WORK", work, targetRows.get("Work_Hourly")),
    actions: await replaceOwned("Action_Log", "action id", "OPS-RPT-CM", reportActions, targetRows.get("Action_Log")),
  };
  // Keep only the newest Business Performance Report batch visible and clearly marked.
  // Older imported copies are deleted so daily imports do not accumulate duplicate tabs.
  const importedTabs = available.filter((properties) =>
    reportBases.some((base) => properties.title === base || properties.title?.startsWith(`${base} (`)),
  );
  if (importedTabs.length) {
    const staleImports = importedTabs.filter((properties) => !importedTitles.includes(properties.title!));
    if (staleImports.length) await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SOURCE_ID,
      requestBody: {
        requests: staleImports.map((properties) => ({ deleteSheet: { sheetId: properties.sheetId! } })),
      },
    });
  }
  return report;
}
