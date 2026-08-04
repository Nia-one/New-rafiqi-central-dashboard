const REPORTING_MONTH_PATTERN = /^(20\d{2})-(0[1-9]|1[0-2])$/;

export const REPORTING_MONTH_HEADER = "reporting month";

export function normalizeReportingMonth(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return REPORTING_MONTH_PATTERN.test(text) ? text : null;
}
export function reportingMonthTimestamp(value: unknown): string | null {
  const month = normalizeReportingMonth(value);
  return month ? `${month}-01T00:00:00+05:30` : null;
}

export function reportingMonthFromDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const direct = text.match(/^(20\d{2})[-/](0?[1-9]|1[0-2])(?:$|[-/T ])/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}`;
  const indian = text.match(/^(?:0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})/);
  if (indian) return `${indian[2]}-${indian[1].padStart(2, "0")}`;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  const date = new Date(parsed);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
