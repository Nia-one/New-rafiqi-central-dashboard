/* eslint-disable no-console */
require("dotenv").config({ path: ".env.local" });

const { google } = require("googleapis");
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is required in .env.local");

const rowsToSeed = [
  ["self-learn", "Overview", "reporting_lede", "kicker", "WHERE WE ARE NOW · {block}", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "reporting_lede", "headline_template", "{projection} projected CM by month end. {daysLeft} days remain.", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "reporting_lede", "headline_without_period_template", "{projection} projected CM by month end. Source reporting period is pending.", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "reporting_lede", "period_template", "This month · day {day} of {daysInMonth}", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "reporting_lede", "period_pending_text", "Source reporting period pending", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "reporting_lede", "snapshot_template", "Google Sheet snapshot · {updatedAt}", "template", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "reporting_lede", "snapshot_pending_text", "Google Sheet timestamp required", "text", "Operations", "Dashboard_Content", ""],
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
    console.log("Overview reporting content is already present.");
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Dashboard_Content!A:I",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: missing },
  });
  console.log(`Added ${missing.length} Overview reporting content rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
