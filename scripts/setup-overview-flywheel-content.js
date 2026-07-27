/* eslint-disable no-console */
require("dotenv").config({ path: ".env.local" });

const { google } = require("googleapis");
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is required in .env.local");

const rowsToSeed = [
  ["self-learn", "Overview", "continuity_flywheel", "kicker", "01 · THE CONTINUITY FLYWHEEL", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "headline", "One system. Three connected pillars.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "intro", "Living brings the Member in. Work and Essentials deepen continuity without starting a new relationship.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "stage_living", "Community Living", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "stage_work", "Access to work", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "stage_essentials", "Lower-cost Essentials", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "stage_stability", "Greater stability", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "stage_demand", "Stronger Living demand", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "return_caption", "Member stability strengthens Living demand", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "loop_caption", "One Member relationship", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "living_description", "Stage 1 · A Nest creates the stable base and brings the Member into the flywheel.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "living_demand_label", "Named enterprise requirement", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "living_demand_note", "Members contracted", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "living_supply_label", "Live Nests", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "living_supply_note", "Capacity live", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "work_description", "Stage 2 · Employment access supports income continuity for Members.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "work_demand_label", "Open employer headcount", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "work_demand_note", "Work_Hourly · open headcount", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "work_supply_label", "Members matched to work", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "work_supply_note", "Work_Hourly · matched headcount", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "essentials_description", "Stage 3 · Lower-cost Essentials protect savings and encourage another order.", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "essentials_demand_label", "Eligible / purchasing Members", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "essentials_demand_note", "Eligible / purchasing · live", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "essentials_supply_label", "SKU fulfilment", "text", "Operations", "Dashboard_Content", ""],
  ["self-learn", "Overview", "continuity_flywheel", "essentials_supply_note", "Essentials_Hourly · orders fulfilled", "text", "Operations", "Dashboard_Content", ""],
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
    console.log("Overview flywheel content is already present.");
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Dashboard_Content!A:I",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: missing },
  });
  console.log(`Added ${missing.length} Overview flywheel content rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
