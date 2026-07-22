require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

const credentials = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE),
    "utf8"
  )
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

async function api(url, options = {}) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const accessToken =
    typeof token === "string" ? token : token.token;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${url}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) return {};

  return response.json();
}

function metricMap(rows) {
  const map = {};

  rows.slice(1).forEach((row) => {
    map[row[0]] = row[1];
  });

  return map;
}

async function main() {
  const overview = await api(
    "/values/Dashboard_Overview!A:D"
  );

  const metrics = metricMap(overview.values);

  const today = new Date().toISOString().slice(0, 10);

  console.log(metrics);

  const history = await api("/values/CM_History!A:B");

const rows = history.values || [];

const existingRow = rows.findIndex(
  (r, i) => i > 0 && r[0] === today
);

if (existingRow !== -1) {
  await api(
    `/values/CM_History!A${existingRow + 1}:B${existingRow + 1}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [[today, metrics.CM]],
      }),
    }
  );

  console.log("✔ Updated today's CM history");
} else {
  await api(
    "/values/CM_History!A:B:append?valueInputOption=RAW",
    {
      method: "POST",
      body: JSON.stringify({
        values: [[today, metrics.CM]],
      }),
    }
  );

  console.log("✔ Added today's CM history");
}

  await api(
    "/values/Previous_Block!A2:J2?valueInputOption=RAW",
    {
      method: "PUT",
      body: JSON.stringify({
        values: [[
          new Date().toISOString(),
          metrics.CM,
          metrics.Demand_Contracted,
          metrics.Members_Active,
          metrics.Attach,
          "",
          "",
          "",
          "",
          ""
        ]],
      }),
    }
  );

  console.log("✔ Previous Block updated");
}

main().catch(console.error);