import { google } from "googleapis";
import fs from "fs";
import path from "path";

const keyFile = path.join(
  process.cwd(),
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
);

const credentials = JSON.parse(fs.readFileSync(keyFile, "utf8"));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

export async function getSheet(range: string) {
  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });

  return response.data.values ?? [];
}