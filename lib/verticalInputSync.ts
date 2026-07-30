import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";

const SOURCE_ID = process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU";
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
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

async function replaceOwned(target: string, keyHeader: string, prefix: string, records: Record<string, unknown>[]) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${target}!A:AZ` });
  const rows = (current.data.values || []) as unknown[][];
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
  const baseTabs = ["TEAM_OCCUPANCY", "TEAM_ESSENTIALS_SUMMARY"];
  const reportBases = ["Studios", "Fono Funnel", "Essentials", "Flow", "CM Actions"];
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SOURCE_ID, fields: "sheets.properties(sheetId,title,index,hidden)" });
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
    return [tab, { headers: (rows[Math.max(0, headerIndex)] || []).map(String), rows: rows.slice(Math.max(0, headerIndex) + 1).filter((row) => row.some((cell) => String(cell ?? "").trim())) }];
  }));
  const imported = (base: string) => {
    const title = importedTitles.find((candidate) => candidate === base || candidate.startsWith(`${base} (`));
    return title ? tables.get(title) : undefined;
  };

  const teamOccupancy = tables.get("TEAM_OCCUPANCY");
  const studioReport = imported("Studios");
  const occupancySource = teamOccupancy?.rows.length ? teamOccupancy : studioReport;
  if (!occupancySource?.rows.length) throw new Error("TEAM_OCCUPANCY is required as the authoritative occupancy source");
  const livingPrefix = "OPS-RPT-OCC";
  const living = occupancySource.rows.filter((row) => norm(value(row, occupancySource.headers, "Studio Code")) !== "studio code").map((row) => {
    const studio = value(row, occupancySource.headers, "Studio Code", "Studio Name", "studio_id");
    const at = timestamp(value(row, occupancySource.headers, "as_of_at", "source_updated_at", "Date", "updated_at"));
    const contracted = number(value(row, occupancySource.headers, "Contracted Nest"));
    const occupied = number(value(row, occupancySource.headers, "Occupied Nest"));
    return { "living hourly id": id(livingPrefix, [studio, at.slice(0, 13)]), "theatre id": value(row, occupancySource.headers, "Theatre", "theatre_id"), "studio id": studio, "supply model": "EXISTING", "contracted nests": contracted, "activation ready nests": "", "occupied nests": occupied, "living billed inr": number(value(row, occupancySource.headers, "Determined Revenue", "living_billed_inr")), "living collected inr": number(value(row, occupancySource.headers, "Living Collected INR", "living_collected_inr")), "collection leakage inr": number(value(row, occupancySource.headers, "Collection Leakage INR", "collection_leakage_inr")), "occupancy ratio": contracted ? occupied / contracted : 0, "source submission id": id(`${livingPrefix}-SRC`, [studio, at]), "updated at": at };
  });

  const demandRecords: Record<string, unknown>[] = [];
  const fonoReport = imported("Fono Funnel");
  const fonoSources = fonoReport?.rows.length
    ? [{ table: fonoReport, prefix: "OPS-RPT-FONO", kind: "FONO" }] as const
    : [];
  for (const { table, prefix, kind } of fonoSources) {
    table.rows.forEach((row) => {
      const company = value(row, table.headers, "Company Name", "Prospect (PG / owner)", "Theatre");
      const location = value(row, table.headers, "Location", "Corridor", "Theatre");
      // Prefer the explicit lead date. Display-only values such as `6-Jun` are
      // parsed by JavaScript as 2001 and are not safe record identifiers.
      const sourceDate = value(row, table.headers, "Lead date", "Date");
      const opened = timestamp(sourceDate);
      const required = number(value(row, table.headers, "headcount_required", "Client Nests Potential", "Nests Potential", "Total Room"));
      const matched = number(value(row, table.headers, "headcount_matched", "current occupancy"));
      const sourceIdentity = [
        company,
        location,
        opened,
        value(row, table.headers, "Owner Contact NO"),
        value(row, table.headers, "Activity Type"),
        value(row, table.headers, "Time"),
      ];
      const activationAt = value(row, table.headers, "activation_required_at", "Next Action Date", "Contract start date");
      demandRecords.push({ "demand id": value(row, table.headers, "dashboard_record_id") || id(prefix, sourceIdentity), "enterprise id": value(row, table.headers, "enterprise_id") || id(`${prefix}-ENT`, [company]), "enterprise name": company, "plant id": value(row, table.headers, "plant_id") || id(`${prefix}-PLANT`, [location]), "plant name": location, latitude: number(value(row, table.headers, "Latitude")), longitude: number(value(row, table.headers, "Longitude")), "role required": kind === "FONO" ? "Living supply" : "Workforce", "headcount required": required, "headcount matched": matched, "headcount remaining": Math.max(0, required - matched), "wage inr": number(value(row, table.headers, "RENT", "monthly wage inr")), "activation required at": activationAt ? timestamp(activationAt) : "", "certainty": value(row, table.headers, "certainty", "Stage After", "Current Stage"), "status": value(row, table.headers, "status", "Stage After", "Current Stage") || "Open", "owner actor id": value(row, table.headers, "owner_actor_id", "Acquirer", "JCO", "by"), "opened at": opened, "source submission id": id(`${prefix}-SRC`, sourceIdentity), "updated at": timestamp(value(row, table.headers, "source_updated_at")) });
    });
  }

  const summary = tables.get("TEAM_ESSENTIALS_SUMMARY")!;
  const essentialsReport = imported("Essentials");
  if (!summary?.rows.length) throw new Error("TEAM_ESSENTIALS_SUMMARY is required as the authoritative Member Savings source");
  const essentialsSource = summary;
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
    const month = timestamp(value(row, flow!.headers, "Month"));
    return { "work hourly id": id("OPS-RPT-WORK", [client, month]), "enterprise id": id("OPS-RPT-ENT", [client]), "matched headcount": number(value(row, flow!.headers, "HC")), "work billed inr": number(value(row, flow!.headers, "Total Billing (₹)")), "work collected inr": "", "captured at": month, "source submission id": id("OPS-RPT-WORK-SRC", [client, month]) };
  });
  const cmActions = imported("CM Actions");
  const reportActions = (cmActions?.rows || []).filter((row) => {
    const objective = value(row, cmActions!.headers, "Studio / Entity");
    return objective && norm(objective) !== "studio / entity";
  }).map((row) => {
    const objective = value(row, cmActions!.headers, "Studio / Entity");
    const proposedAt = timestamp(value(row, cmActions!.headers, "Date"));
    const planned = number(value(row, cmActions!.headers, "Planned Impact (₹)"));
    const realized = number(value(row, cmActions!.headers, "Realized (₹)"));
    return { "action id": id("OPS-RPT-CM", [objective, proposedAt]), "incident id": "", "operating objective": objective, "expected metric": "CM impact (₹)", "baseline value": realized, "target value": planned, "expected financial impact inr": Math.max(0, planned - realized), "confidence": "Reported", "owner actor id": "", "due at": timestamp(value(row, cmActions!.headers, "Target Close")), "required evidence": "Business Performance Report — CM Actions source row", "approval tier": "Human", "state": value(row, cmActions!.headers, "Status") || "Open", "proposed at": proposedAt, "notes": value(row, cmActions!.headers, "Notes") };
  });

  const report = {
    essentials: await replaceAllRows("Essentials_Hourly", authoritativeEssentials),
    living: await replaceOwned("Living_Hourly", "living hourly id", "OPS-", living),
    demand: await replaceOwned("Enterprise_Demand", "demand id", "OPS-", demandRecords),
    work: await replaceOwned("Work_Hourly", "work hourly id", "OPS-RPT-WORK", work),
    actions: await replaceOwned("Action_Log", "action id", "OPS-RPT-CM", reportActions),
    inventory: await replaceOwned("Essentials_Inventory", "sku", "OPS-INV", []),
  };
  // Keep only the newest Business Performance Report batch visible and clearly marked.
  // Older imported copies are deleted so daily imports do not accumulate duplicate tabs.
  const importedTabs = available.filter((properties) =>
    reportBases.some((base) => properties.title === base || properties.title?.startsWith(`${base} (`)),
  );
  if (importedTabs.length) {
    const currentImports = importedTabs.filter((properties) => importedTitles.includes(properties.title!));
    const staleImports = importedTabs.filter((properties) => !importedTitles.includes(properties.title!));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SOURCE_ID,
      requestBody: {
        requests: [
          ...currentImports.map((properties) => ({
            updateSheetProperties: {
              properties: {
                sheetId: properties.sheetId,
                hidden: false,
                tabColor: { red: 0.95, green: 0.72, blue: 0.12 },
              },
              fields: "hidden,tabColor",
            },
          })),
          ...staleImports.map((properties) => ({ deleteSheet: { sheetId: properties.sheetId! } })),
        ],
      },
    });
  }
  return report;
}
