require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

async function updateConstraintsColumns() {

  const credentials = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
      ),
      "utf8"
    )
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const sheetName = "constraints";

  const requiredColumns = [
    "idleUnits",
    "cmPerUnit",
    "riskHours",
  ];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const existingHeaders = response.data.values?.[0] || [];

  const updatedHeaders = [
    ...existingHeaders,
    ...requiredColumns.filter(
      (column) => !existingHeaders.includes(column)
    ),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!1:1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [updatedHeaders],
    },
  });

  console.log("✅ Constraint columns updated");
  console.log(updatedHeaders);
}

updateConstraintsColumns()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
