import { google } from "googleapis";

type SheetsClient = ReturnType<typeof google.sheets>;
type ReportTab = { sheetId: number; title: string; index: number; rowCount: number; columnCount: number };

export const BUSINESS_REPORT_TABS = ["Studios", "Fono Funnel", "Essentials", "Flow", "CM Actions"] as const;

const suffixPattern = (base: string) => new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(\\d+\\)$`);

export function reportCandidates(tabs: ReportTab[], base: string) {
  const suffix = suffixPattern(base);
  return tabs.filter((tab) => tab.title === base || suffix.test(tab.title));
}

export function latestImportedReport(tabs: ReportTab[], base: string) {
  return reportCandidates(tabs, base)
    .filter((tab) => tab.title !== base)
    .sort((a, b) => b.index - a.index)[0];
}

const columnName = (index: number) => {
  let value = index + 1;
  let output = "";
  while (value) { value--; output = String.fromCharCode(65 + (value % 26)) + output; value = Math.floor(value / 26); }
  return output;
};

export async function canonicalizeBusinessReportTabs(sheets: SheetsClient, spreadsheetId: string) {
  const response = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount))" });
  const tabs: ReportTab[] = (response.data.sheets || []).flatMap((sheet) => {
    const properties = sheet.properties;
    return properties?.sheetId != null && properties.title
      ? [{ sheetId: properties.sheetId, title: properties.title, index: properties.index || 0, rowCount: properties.gridProperties?.rowCount || 1, columnCount: properties.gridProperties?.columnCount || 1 }]
      : [];
  });
  const report: Array<Record<string, unknown>> = [];

  for (const base of BUSINESS_REPORT_TABS) {
    const candidates = reportCandidates(tabs, base);
    const canonical = candidates.find((tab) => tab.title === base);
    const latest = latestImportedReport(tabs, base);
    if (!latest) { report.push({ base, status: canonical ? "canonical" : "missing" }); continue; }

    if (!canonical) {
      const stale = candidates.filter((tab) => tab.sheetId !== latest.sheetId);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
        { updateSheetProperties: { properties: { sheetId: latest.sheetId, title: base }, fields: "title" } },
        ...stale.map((tab) => ({ deleteSheet: { sheetId: tab.sheetId } })),
      ] } });
      report.push({ base, status: "adopted", from: latest.title, deleted: stale.map((tab) => tab.title) });
      continue;
    }

    // Keep the canonical sheet ID stable. Every formula that points at the
    // canonical report therefore remains attached while the latest import is
    // copied over it and the temporary (n) sheet is removed.
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${base.replaceAll("'", "''")}'!A1:${columnName(canonical.columnCount - 1)}${canonical.rowCount}` });
    const duplicates = candidates.filter((tab) => tab.title !== base);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
      { updateSheetProperties: { properties: { sheetId: canonical.sheetId, gridProperties: { rowCount: Math.max(canonical.rowCount, latest.rowCount), columnCount: Math.max(canonical.columnCount, latest.columnCount) } }, fields: "gridProperties(rowCount,columnCount)" } },
      // Business reports are read-only snapshots. Copy their calculated values
      // (not formulas) so Google cannot rewrite relative references while moving
      // data between the temporary import and the stable canonical sheet ID.
      { copyPaste: { source: { sheetId: latest.sheetId, startRowIndex: 0, endRowIndex: latest.rowCount, startColumnIndex: 0, endColumnIndex: latest.columnCount }, destination: { sheetId: canonical.sheetId, startRowIndex: 0, endRowIndex: latest.rowCount, startColumnIndex: 0, endColumnIndex: latest.columnCount }, pasteType: "PASTE_VALUES", pasteOrientation: "NORMAL" } },
      { copyPaste: { source: { sheetId: latest.sheetId, startRowIndex: 0, endRowIndex: latest.rowCount, startColumnIndex: 0, endColumnIndex: latest.columnCount }, destination: { sheetId: canonical.sheetId, startRowIndex: 0, endRowIndex: latest.rowCount, startColumnIndex: 0, endColumnIndex: latest.columnCount }, pasteType: "PASTE_FORMAT", pasteOrientation: "NORMAL" } },
      ...duplicates.map((tab) => ({ deleteSheet: { sheetId: tab.sheetId } })),
    ] } });
    report.push({ base, status: "replaced-in-place", from: latest.title, canonicalSheetId: canonical.sheetId, deleted: duplicates.map((tab) => tab.title) });
  }
  return report;
}

export async function repairBusinessReportFormulaReferences(sheets: SheetsClient, spreadsheetId: string) {
  const tab = "TEAM_NIA_GROWTH";
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A1:U200`, valueRenderOption: "FORMULA" });
  const rows = response.data.values || [];
  const data: Array<{ range: string; values: string[][] }> = [];
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (typeof value !== "string" || !value.startsWith("=")) return;
    let formula = value;
    for (const base of BUSINESS_REPORT_TABS) {
      formula = formula
        .replaceAll(`__OLD_REPORT__${base}`, base)
        .replace(new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(\\d+\\)`, "g"), base);
    }
    if (formula !== value) data.push({ range: `'${tab}'!${columnName(columnIndex)}${rowIndex + 1}`, values: [[formula]] });
  }));
  if (data.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data } });
  return { repaired: data.length };
}
