require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const { google } = require("googleapis");

const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID;
const credentialSource = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json";
const credentials = (() => { try { return JSON.parse(credentialSource); } catch { return JSON.parse(fs.readFileSync(credentialSource, "utf8")); } })();
const norm = (value) => String(value || "").split("\n")[0].trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
const black = { red: 0.02, green: 0.02, blue: 0.02 };
const red = { red: 0.8, green: 0.03, blue: 0.03 };
const white = { red: 1, green: 1, blue: 1 };

const manual = {
  TEAM_FINANCE_DAILY: new Set([
    "date", "theatre", "studio code", "opex actual mtd", "opex forecast", "opex budget cap",
    "available cash balance", "minimum cash balance", "targeted cm", "target approved", "target owner",
    "target close date", "cm1", "cm2", "updated by", "finance notes",
  ]),
  TEAM_MEMBER_ACTIVATION: new Set([
    "member token", "activated at", "theatre id", "studio id", "nest id", "demand id", "enterprise id",
    "work assignment id", "membership billed inr", "membership collected inr", "activation evidence url",
    "verified at", "verified by", "verification status",
  ]),
  TEAM_REQ_PEOPLE_ROSTER: new Set([
    "display name", "role", "theatre id", "studio id", "manager actor id", "active shift",
    "shift start at", "shift end at", "language",
  ]),
  TEAM_LEARNING_HISTORY: new Set([
    "domain", "observed", "proposed change", "expected effect", "attribution", "evidence", "confidence", "disposition", "notes",
  ]),
};

(async () => {
  if (!spreadsheetId) throw new Error("GOOGLE_TEAM_INPUT_SHEET_ID is missing");
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const requests = [];
  for (const [title, userFields] of Object.entries(manual)) {
    const sheetId = metadata.data.sheets.find((sheet) => sheet.properties.title === title)?.properties.sheetId;
    if (sheetId == null) throw new Error(`Missing ${title}`);
    const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title}'!1:1` });
    const headers = values.data.values?.[0] || [];
    requests.push({ updateSheetProperties: { properties: { sheetId, tabColorStyle: { rgbColor: black }, gridProperties: { frozenRowCount: 1 } }, fields: "tabColorStyle,gridProperties.frozenRowCount" } });
    headers.forEach((header, column) => {
      const isManual = userFields.has(norm(header));
      requests.push({ repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 },
        cell: {
          userEnteredFormat: { backgroundColor: isManual ? black : red, textFormat: { foregroundColor: white, bold: true }, wrapStrategy: "WRAP" },
          note: isManual
            ? "BLACK = USER INPUT. Fill this field using the format shown in the data-entry guide."
            : "RED = AUTOMATED / SYSTEM FIELD. Do not edit; sync calculates or supplies this field.",
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy),note",
      } });
    });
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  console.log(JSON.stringify(Object.fromEntries(Object.entries(manual).map(([tab, fields]) => [tab, { manualColumns: fields.size } ])), null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
