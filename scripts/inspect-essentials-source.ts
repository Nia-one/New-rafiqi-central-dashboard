import dotenv from "dotenv";
import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleCredentials";

dotenv.config({ path: ".env.local" });
async function main() {
  const spreadsheetId = process.env.GOOGLE_TEAM_INPUT_SHEET_ID!;
  const sheets = google.sheets({ version: "v4", auth: new google.auth.GoogleAuth({ credentials: googleServiceAccountCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] }) });
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title,index,hidden)" });
  const requestedTitle = process.argv[2] || "Essentials";
  const tab = metadata.data.sheets?.find((sheet) => sheet.properties?.title === requestedTitle)?.properties;
  if (!tab?.title) throw new Error(`${requestedTitle} tab was not found`);
  const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab.title.replaceAll("'", "''")}'!A1:AZ8` });
  console.log(JSON.stringify({ tab, rows: values.data.values || [] }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
