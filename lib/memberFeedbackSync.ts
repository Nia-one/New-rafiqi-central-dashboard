import crypto from "crypto";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./googleCredentials";
import { normalizeReportingMonth, REPORTING_MONTH_HEADER } from "./reportingMonth";

export const MEMBER_FEEDBACK_INPUT_TAB = "TEAM_MEMBER_FEEDBACK";

export const memberFeedbackInputHeaders = [
  "member token", "score", "feedback", "collected at", "reporting month", "theatre", "studio",
  "pillar", "category", "exit risk", "action id", "raw conversation ref",
] as const;

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const isSampleRow = (row: unknown[]) => row.some((cell) => /SAMPLE.*DO.NOT.SYNC/i.test(String(cell ?? "")));
const stableId = (prefix: string, parts: unknown[]) => `${prefix}-${crypto.createHash("sha1").update(parts.map(norm).join("|")).digest("hex").slice(0, 12).toUpperCase()}`;
const validDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  const indian = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  const parsed = indian
    ? new Date(Date.UTC(Number(indian[3]), Number(indian[2]) - 1, Number(indian[1]), Number(indian[4] || 0), Number(indian[5] || 0)))
    : new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
};

type InputRecord = Record<string, unknown>;
export type DerivedMemberFeedback = {
  responses: Record<string, unknown>[];
  feedback: Record<string, unknown>[];
  dashboard: Record<string, unknown>[];
  skipped: number;
};

export function deriveMemberFeedback(records: InputRecord[], now = new Date().toISOString()): DerivedMemberFeedback {
  const responses: Record<string, unknown>[] = [];
  const feedback: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const input of records) {
    const row = Object.fromEntries(Object.entries(input).map(([key, value]) => [norm(key), value]));
    const member = String(row["member token"] ?? "").trim();
    const collectedAt = validDate(row["collected at"]);
    const reportingMonth = normalizeReportingMonth(row[REPORTING_MONTH_HEADER]);
    const score = Number(String(row.score ?? "").trim());
    if (!member || !collectedAt || !reportingMonth || collectedAt.slice(0, 7) !== reportingMonth || !Number.isInteger(score) || score < 0 || score > 10) { skipped++; continue; }
    const responseId = stableId("OPS-NPS-RESP", [member, collectedAt]);
    const response = {
      id: responseId, "member token": member, score, "follow up text": row.feedback || "",
      "collected at": collectedAt, month: reportingMonth, [REPORTING_MONTH_HEADER]: reportingMonth, theatre: row.theatre || "", studio: row.studio || "",
    };
    responses.push(response);
    if (String(row.feedback ?? "").trim()) {
      feedback.push({
        id: stableId("OPS-NPS-FB", [responseId]), "action id": row["action id"] || "", "member token": member,
        pillar: row.pillar || "Member", category: row.category || "General", theatre: row.theatre || "", studio: row.studio || "",
        summary: row.feedback, "captured at": collectedAt, source: "Member Feedback/NPS input",
        "exit risk": row["exit risk"] || (score <= 6 ? "Immediate attention" : score <= 8 ? "Watch closely" : "Low"),
        "raw conversation ref": row["raw conversation ref"] || "", "nps response id": responseId,
        [REPORTING_MONTH_HEADER]: reportingMonth,
      });
    }
  }
  // Even when there are no valid responses, the generated zero-state dashboard
  // belongs to the sync month so it remains period-addressable and never creates
  // unscoped rows in the dashboard filter.
  const latestMonth = responses.map((row) => String(row.month)).sort().at(-1) || now.slice(0, 7);
  const current = responses.filter((row) => row.month === latestMonth);
  const promoters = current.filter((row) => Number(row.score) >= 9).length;
  const detractors = current.filter((row) => Number(row.score) <= 6).length;
  const nps = current.length ? Math.round(((promoters - detractors) / current.length) * 100) : 0;
  const monthLabel = latestMonth ? new Date(`${latestMonth}-01T00:00:00Z`).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" }) : "NPS";
  const immediate = feedback.filter((row) => row["exit risk"] === "Immediate attention").length;
  const metric = (key: string, label: string, number: number, text = "") => ({ section: "Feedback summary", key, label, "value number": number, "value text": text, "owner actor id": "SYSTEM", "updated at": now, [REPORTING_MONTH_HEADER]: latestMonth, notes: "Automatically derived from TEAM_MEMBER_FEEDBACK" });
  const dashboard = [
    metric("member_nps_feedback_captured", "Feedback captured", feedback.length),
    metric("member_nps_feedback_open", "Feedback open", feedback.length),
    metric("member_nps_feedback_immediate", "Immediate attention", immediate),
    metric("member_nps_feedback_score", "NPS score", nps),
    metric("member_nps_feedback_respondents", "NPS respondents", current.length),
    metric("member_nps_feedback_detractors", "NPS detractors", detractors),
    metric("member_nps_feedback_score_label", "Score label", 0, latestMonth ? `${monthLabel} NPS` : "NPS"),
    metric("member_engagement_survey_nps_score", "Survey NPS", nps),
    metric("member_engagement_survey_nps_method", "Survey NPS method", 0, "Automatically calculated from valid 0-10 Member responses"),
  ];
  return { responses, feedback, dashboard, skipped };
}

function objects(rows: unknown[][]) {
  const headerIndex = rows.findIndex((row) => {
    const cells = row.map(norm);
    return cells.includes("member token") && cells.includes("score") && cells.includes("collected at");
  });
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(norm);
  return rows.slice(headerIndex + 1).filter((row) => !isSampleRow(row) && row.some((cell) => String(cell ?? "").trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

async function replaceOwned(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, tab: string, keyHeader: string, prefix: string, records: Record<string, unknown>[]) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:AZ` });
  const rows = (response.data.values || []) as unknown[][];
  const headers = (rows[0] || []).map(String);
  const keyIndex = headers.findIndex((header) => norm(header) === norm(keyHeader));
  if (keyIndex < 0) throw new Error(`${tab} is missing ${keyHeader}`);
  const keep = rows.slice(1).filter((row) => !norm(row[keyIndex]).startsWith(norm(prefix)));
  const generated = records.map((record) => headers.map((header) => record[norm(header)] ?? record[header] ?? ""));
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tab}!A2:AZ` });
  if (keep.length || generated.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: [...keep, ...generated] } });
  return generated.length;
}

export async function syncMemberFeedback() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sourceSpreadsheetId = process.env.GOOGLE_LEGACY_TEAM_INPUT_SHEET_ID || process.env.GOOGLE_TEAM_INPUT_SHEET_ID || "19-uFTgu-y50XfxJKGQwmA331wScGwEQW-ZPSVE6ciXU";
  if (!spreadsheetId || !sourceSpreadsheetId) throw new Error("Google Sheet IDs are not configured");
  const auth = new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const input = await sheets.spreadsheets.values.get({ spreadsheetId: sourceSpreadsheetId, range: `${MEMBER_FEEDBACK_INPUT_TAB}!A:Z` });
  const derived = deriveMemberFeedback(objects((input.data.values || []) as unknown[][]));
  const [responses, feedback, dashboard] = await Promise.all([
    replaceOwned(sheets, spreadsheetId, "Member_NPS_Responses", "id", "OPS-NPS-RESP", derived.responses),
    replaceOwned(sheets, spreadsheetId, "Member_NPS_Feedback", "id", "OPS-NPS-FB", derived.feedback),
    replaceOwned(sheets, spreadsheetId, "Member_NPS_Dashboard", "key", "member_nps_feedback_", derived.dashboard.filter((row) => String(row.key).startsWith("member_nps_feedback_"))),
  ]);
  // Engagement survey keys have a different owned prefix and are updated separately.
  await replaceOwned(sheets, spreadsheetId, "Member_NPS_Dashboard", "key", "member_engagement_survey_nps_", derived.dashboard.filter((row) => String(row.key).startsWith("member_engagement_survey_nps_")));
  return { responses, feedback, dashboard, skipped: derived.skipped };
}
