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

const CACHE_TTL_MS = 60 * 1000;

const sheetCache = new Map<
  string,
  {
    timestamp: number;
    data: string[][];
  }
>();

export async function getSheet(range: string) {
  const cached = sheetCache.get(range);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log("CACHE HIT:", range);
    return cached.data;
  }

  console.log("GOOGLE FETCH:", range);

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });

  const values = response.data.values ?? [];

  sheetCache.set(range, {
    timestamp: Date.now(),
    data: values,
  });

  return values;
}
