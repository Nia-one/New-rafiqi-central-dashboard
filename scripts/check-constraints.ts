import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { GoogleAuth } from "google-auth-library";

async function run() {

  const credentials = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
      ),
      "utf8"
    )
  );

  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  const accessToken =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse?.token;

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent("Constraints!A1:Z20")}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await response.json();

  console.log("CONSTRAINTS TAB DATA:");
  console.log(JSON.stringify(json.values ?? [], null, 2));
}

run();
