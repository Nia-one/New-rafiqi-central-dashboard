/* eslint-disable no-console */
require("dotenv").config({ path: ".env.local" });

const { google } = require("googleapis");
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is required in .env.local");

const rowsToSeed = [
  ["self-learn", "Overview", "cm_trajectory", "kicker", "03 · CM FORECAST (CONTRIBUTION MARGIN)", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "headline_template", "At this pace, CM will reach {projection} by month end.", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "chart_reads_label", "What this chart shows", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "chart_reads_text", "This chart shows CM earned so far, the forecast for month end, and the target.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "needed_pace_prefix", "Needed pace:", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "needed_pace_template", "{askRate}/day. This is {askRateMultiple}× the current pace", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "remaining_days_template", "for the remaining {daysLeft} days.", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "earned_label", "EARNED", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "forecast_label", "FORECAST", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "target_label", "TARGET", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "actual_legend_template", "Actual through {monthName} {currentDay}", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "forecast_legend_label", "Forecast", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "cm_trajectory", "target_legend_label", "Target", "text", "Operations", "Dashboard_Content", ""],
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "service-account.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const existingRows = (await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Dashboard_Content!A:I",
  })).data.values ?? [];
  const existingKeys = new Set(existingRows.slice(1).map((row) =>
    [row[1], row[2], row[3]].map((value) => String(value ?? "").trim().toLowerCase()).join("|"),
  ));
  const missing = rowsToSeed.filter((row) =>
    !existingKeys.has([row[1], row[2], row[3]].map((value) => value.toLowerCase()).join("|")),
  );
  if (!missing.length) {
    console.log("Overview CM trajectory content is already present.");
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Dashboard_Content!A:I",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: missing },
  });
  console.log(`Added ${missing.length} Overview CM trajectory content rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
