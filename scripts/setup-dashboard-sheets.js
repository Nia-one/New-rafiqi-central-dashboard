require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

const keyFile = path.join(
  process.cwd(),
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json"
);

const credentials = JSON.parse(fs.readFileSync(keyFile, "utf8"));

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

console.log("Spreadsheet ID:", spreadsheetId);
console.log("Service Account:", process.env.GOOGLE_SERVICE_ACCOUNT_FILE);

const REQUIRED_SHEETS = [
  {
    title: "CM_History",
    headers: [
      "business_date",
      "actual"
    ]
  },
  {
    title: "Constraints",
    headers: [
      "id",
      "title",
      "where",
      "impact",
      "detail",
      "owner",
      "next",
      "lane",
      "stalledBlocks"
    ]
  },
  {
    title: "Previous_Block",
    headers: [
      "snapshot_time",
      "cm",
      "contracted",
      "membersActive",
      "attach",
      "closures",
      "stockoutsClearedStudios",
      "stalledTheatre",
      "staleOwner",
      "staleHours"
    ]
  }
];

async function api(pathname, options = {}) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const accessToken =
    typeof token === "string" ? token : token.token;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${pathname}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return {};
  }

  return response.json();
}

async function main() {
  console.log("Reading spreadsheet...");

  const spreadsheet = await api("");

  const existing = spreadsheet.sheets.map(
    s => s.properties.title
  );

  const toCreate = REQUIRED_SHEETS.filter(
    s => !existing.includes(s.title)
  );

  if (toCreate.length) {
    console.log("Creating missing sheets...");

    await api(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: toCreate.map(sheet => ({
          addSheet: {
            properties: {
              title: sheet.title
            }
          }
        }))
      })
    });
  }

  for (const sheet of REQUIRED_SHEETS) {
    console.log(`Preparing ${sheet.title}`);

    await api(
      `/values/${encodeURIComponent(sheet.title)}!A1:Z1?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({
          values: [sheet.headers]
        })
      }
    );
  }

  console.log("");
  console.log("✔ Dashboard backend sheets are ready.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});