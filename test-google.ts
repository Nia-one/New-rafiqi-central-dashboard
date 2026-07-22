import { google } from "googleapis";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const keyFile = path.join(
  process.cwd(),
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
);

const credentials = JSON.parse(fs.readFileSync(keyFile, "utf8"));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function main() {
  console.log("GOOGLE_SHEET_ID =", process.env.GOOGLE_SHEET_ID);

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Dashboard_Overview!A:D",
  });

  console.log(response.data.values);
}

main().catch(console.error);
